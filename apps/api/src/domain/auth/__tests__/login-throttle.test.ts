import { describe, expect, it } from "vitest";
import { LoginThrottle } from "../login-throttle.js";

const clock = () => {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};

describe("LoginThrottle", () => {
  it("allows a few typos, then locks that account+address with a retry time", () => {
    const c = clock();
    const th = new LoginThrottle({ now: c.now, maxPerAccount: 3, windowMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      expect(th.check("1.1.1.1", "a@x.com").blocked).toBe(false);
      th.recordFailure("1.1.1.1", "a@x.com");
    }
    const d = th.check("1.1.1.1", "a@x.com");
    expect(d.blocked).toBe(true);
    expect(d.retryAfterSeconds).toBeGreaterThan(0);
    expect(d.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("is per account AND address: another person on another address, or another account, is unaffected", () => {
    const th = new LoginThrottle({ maxPerAccount: 2 });
    th.recordFailure("1.1.1.1", "a@x.com");
    th.recordFailure("1.1.1.1", "a@x.com");
    expect(th.check("1.1.1.1", "a@x.com").blocked).toBe(true);
    expect(th.check("2.2.2.2", "a@x.com").blocked).toBe(false);
    expect(th.check("1.1.1.1", "b@x.com").blocked).toBe(false);
  });

  it("the email is normalised (case and spaces do not dodge the limit)", () => {
    const th = new LoginThrottle({ maxPerAccount: 2 });
    th.recordFailure("1.1.1.1", "Mixed@X.com ");
    th.recordFailure("1.1.1.1", " mixed@x.COM");
    expect(th.check("1.1.1.1", "mixed@x.com").blocked).toBe(true);
  });

  it("spraying many accounts from one address trips the address limit", () => {
    const th = new LoginThrottle({ maxPerAccount: 5, maxPerAddress: 4 });
    for (let i = 0; i < 4; i++) th.recordFailure("9.9.9.9", `u${i}@x.com`);
    expect(th.check("9.9.9.9", "fresh@x.com").blocked).toBe(true);
    expect(th.check("8.8.8.8", "fresh@x.com").blocked).toBe(false);
  });

  it("a success clears the pair, so an old typo never blocks someone who now has the right password", () => {
    const th = new LoginThrottle({ maxPerAccount: 3 });
    th.recordFailure("1.1.1.1", "a@x.com");
    th.recordFailure("1.1.1.1", "a@x.com");
    th.recordSuccess("1.1.1.1", "a@x.com");
    th.recordFailure("1.1.1.1", "a@x.com");
    th.recordFailure("1.1.1.1", "a@x.com");
    expect(th.check("1.1.1.1", "a@x.com").blocked).toBe(false);
  });

  it("the lock ends by itself when the window passes", () => {
    const c = clock();
    const th = new LoginThrottle({ now: c.now, maxPerAccount: 2, windowMs: 60_000 });
    th.recordFailure("1.1.1.1", "a@x.com");
    th.recordFailure("1.1.1.1", "a@x.com");
    expect(th.check("1.1.1.1", "a@x.com").blocked).toBe(true);
    c.advance(60_001);
    expect(th.check("1.1.1.1", "a@x.com").blocked).toBe(false);
    th.recordFailure("1.1.1.1", "a@x.com"); // a fresh window starts at 1
    expect(th.check("1.1.1.1", "a@x.com").blocked).toBe(false);
  });

  it("memory is bounded: a flood of random accounts never grows the table past its cap", () => {
    const th = new LoginThrottle({ maxEntries: 50 });
    for (let i = 0; i < 500; i++) th.recordFailure("3.3.3.3", `flood${i}@x.com`);
    expect((th as unknown as { entries: Map<string, unknown> }).entries.size).toBeLessThanOrEqual(50);
  });

  it("keeps no email or address in the clear", () => {
    const th = new LoginThrottle();
    th.recordFailure("203.0.113.9", "secret.person@hospital.org");
    const keys = [...(th as unknown as { entries: Map<string, unknown> }).entries.keys()].join(" ");
    expect(keys).not.toContain("secret");
    expect(keys).not.toContain("203.0.113");
  });
});
