import { createHash } from "node:crypto";

// A small in-memory throttle for FAILED sign-ins. Not an anti-fraud platform: it stops a script from guessing
// passwords against one account (or spraying many accounts from one address) at wire speed.
//   - per account + address: MAX_PER_ACCOUNT failures inside the window locks that pair until the window ends;
//   - per address: MAX_PER_ADDRESS failures (across any emails) locks the address, so rotating emails does not help.
// Keys are SHA-256 digests — no email or address is kept in memory in the clear. A success clears the account+address
// pair, so an old typo never blocks a person who now has the right password; a quiet window clears everything.
// State is per API process: behind several instances each enforces its own limit (a shared store is the upgrade path).

export interface LoginThrottleOptions {
  maxPerAccount?: number;
  maxPerAddress?: number;
  windowMs?: number;
  /** Hard cap on tracked keys, so a flood of random emails cannot grow memory without bound. */
  maxEntries?: number;
  now?: () => number;
}

interface Entry {
  count: number;
  windowStart: number;
}

export interface ThrottleDecision {
  blocked: boolean;
  retryAfterSeconds: number;
}

const digest = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly maxPerAccount: number;
  private readonly maxPerAddress: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(opts: LoginThrottleOptions = {}) {
    this.maxPerAccount = opts.maxPerAccount ?? 5;
    this.maxPerAddress = opts.maxPerAddress ?? 50;
    this.windowMs = opts.windowMs ?? 15 * 60_000;
    this.maxEntries = opts.maxEntries ?? 10_000;
    this.now = opts.now ?? Date.now;
  }

  private keys(address: string, email: string) {
    return { account: `a:${digest(`${address}|${email.trim().toLowerCase()}`)}`, address: `i:${digest(address)}` };
  }

  private live(key: string): Entry | null {
    const e = this.entries.get(key);
    if (!e) return null;
    if (this.now() - e.windowStart >= this.windowMs) {
      this.entries.delete(key);
      return null;
    }
    return e;
  }

  /** Whether this attempt may even be tried. Checked BEFORE the password is, so a lockout reveals nothing about the account. */
  check(address: string, email: string): ThrottleDecision {
    const { account, address: addr } = this.keys(address, email);
    const hit = [
      [this.live(account), this.maxPerAccount],
      [this.live(addr), this.maxPerAddress],
    ] as const;
    let wait = 0;
    for (const [entry, max] of hit) if (entry && entry.count >= max) wait = Math.max(wait, entry.windowStart + this.windowMs - this.now());
    return { blocked: wait > 0, retryAfterSeconds: Math.max(Math.ceil(wait / 1000), 0) };
  }

  /** A wrong password (or unknown account — indistinguishable on purpose). */
  recordFailure(address: string, email: string): void {
    const { account, address: addr } = this.keys(address, email);
    for (const key of [account, addr]) {
      const e = this.live(key);
      if (e) e.count += 1;
      else this.entries.set(key, { count: 1, windowStart: this.now() });
    }
    if (this.entries.size > this.maxEntries) this.evict();
  }

  /** A correct sign-in clears that account+address pair (not the address-wide counter, which only the window clears). */
  recordSuccess(address: string, email: string): void {
    this.entries.delete(this.keys(address, email).account);
  }

  private evict() {
    for (const [key, e] of this.entries) if (this.now() - e.windowStart >= this.windowMs) this.entries.delete(key);
    // Still over the cap (a flood inside one window): drop the oldest entries first.
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(key);
    }
  }
}
