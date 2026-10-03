"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@pulseos/api-client";
import { Eye, EyeOff } from "lucide-react";
import { PulseLockup } from "@pulseos/ui";
import { ROLE_HOME } from "../../../components/shell/nav";

// A hospital's own sign-in page (e.g. /login/namokar). It signs people into that one hospital and nothing else: the hospital
// is fixed by the address, there is nothing to choose, and none of the development conveniences of the general sign-in
// (Developer access, create account) exist here. The hospital's name comes from the server; no logo is stretched or invented.

/** "Namokar Eye & Oculoplasty Centre" -> "Namokar": the first word is what the lockup shows; the full name sits beneath. */
const brandWord = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export default function TenantLoginPage() {
  const router = useRouter();
  const { tenant: slug } = useParams<{ tenant: string }>();
  // undefined = still asking, null = no such sign-in page.
  const [branding, setBranding] = useState<{ slug: string; name: string } | null | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .tenantBranding(slug)
      .then((b) => live && setBranding(b))
      .catch(() => live && setBranding(null));
    return () => {
      live = false;
    };
  }, [slug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.tenantLogin(slug, email, password, remember);
      router.push(ROLE_HOME[user.role] ?? "/command-centre");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Incorrect email or password.");
        document.getElementById("password")?.focus();
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many sign-in attempts. Please wait a few minutes and try again.");
      } else if (err instanceof ApiError) {
        setError("PulseOS couldn't sign you in right now. Please try again in a moment.");
      } else {
        setError("Could not reach PulseOS. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (branding === undefined) return <main className="app-shell min-h-screen" aria-busy="true" data-testid="tenant-login-loading" />;

  if (branding === null) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-[400px] rounded-panel border border-line bg-white p-6 text-center shadow-glass sm:p-8" data-testid="tenant-login-missing">
          <PulseLockup tone="onWhite" size={30} showBeta={false} />
          <h1 className="mt-5 text-lg font-semibold text-slate-900">This sign-in page does not exist</h1>
          <p className="mt-2 text-sm text-neutral-600">Check the address you were given, or contact your administrator.</p>
        </div>
      </main>
    );
  }

  const word = brandWord(branding.name);

  return (
    <main className="app-shell flex min-h-screen" data-testid="tenant-login">
      <title>{`Sign in · ${branding.name}`}</title>
      <div className="app-login-visual relative hidden w-[46%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12" data-testid="login-visual">
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.10]" viewBox="0 0 800 900" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <circle cx="700" cy="140" r="200" stroke="white" strokeWidth="1" />
          <circle cx="700" cy="140" r="300" stroke="white" strokeWidth="1" />
          <circle cx="700" cy="140" r="400" stroke="white" strokeWidth="1" />
        </svg>
        <div className="relative flex items-center gap-3">
          <PulseLockup tone="onBlue" size={34} showBeta={false} />
          <span className="text-lg text-primary-200" aria-hidden="true">×</span>
          <span className="text-[26px] font-semibold tracking-tight text-white">{word}</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-balance text-[32px] font-semibold leading-[1.15] tracking-tight text-white">{branding.name}</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-primary-100">
            Every enquiry, call, appointment and follow-up for your patients, in one place.
          </p>
        </div>
        <p className="relative text-xs text-primary-200">Pilot workspace</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <PulseLockup tone="onWhite" size={30} showBeta={false} />
            <span className="text-neutral-400" aria-hidden="true">×</span>
            <span className="text-xl font-semibold tracking-tight text-slate-900">{word}</span>
          </div>

          <div className="rounded-panel border border-line bg-white p-6 shadow-glass sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
              <span className="rounded-chip border border-primary-200 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700" data-testid="tenant-login-pilot">V1 Pilot</span>
            </div>
            <p className="mt-1 text-sm text-neutral-600" data-testid="tenant-login-workspace">
              You are signing into {word}&rsquo;s PulseOS workspace.
            </p>

            <form onSubmit={onSubmit} className="mt-7 space-y-4" data-testid="login-form">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-600">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-control border border-line-strong bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-neutral-600">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-control border border-line-strong bg-white px-3.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-neutral-500 hover:text-neutral-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex min-h-11 items-start gap-2 text-xs text-neutral-600 lg:min-h-8">
                <input
                  type="checkbox"
                  data-testid="remember-me"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <span>
                  Remember me
                  <span className="block text-[11px] text-neutral-600">Stay signed in on this device for 7 days. Leave off on a shared computer.</span>
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-lg bg-danger-100 px-3 py-2 text-xs text-danger-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-control bg-primary-600 px-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-neutral-600">Need help? Contact your administrator.</p>
        </div>
      </div>
    </main>
  );
}
