"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@pulseos/api-client";
import type { Role } from "@pulseos/types";
import { ChevronDown, CircleGauge, Eye, EyeOff, HeartPulse, TrendingUp, UsersRound } from "lucide-react";
import { ROLE_HOME } from "../../components/shell/nav";

const BENEFITS = [
  { icon: UsersRound, title: "Acquire", body: "Capture enquiries from every channel." },
  { icon: CircleGauge, title: "Convert", body: "Turn enquiries into appointments and consultations." },
  { icon: TrendingUp, title: "Grow", body: "Improve treatment conversion and follow-up." },
];

const STATS = [
  { value: "10K+", label: "Patients" },
  { value: "25+", label: "Clinics" },
  { value: "98%", label: "Satisfaction" },
];

// Development-only one-click sign-in — entirely absent outside local
// development, not just hidden: /auth/dev-login/roles is a 404 (the route
// doesn't exist, see auth.routes.ts::devLoginEnabled) anywhere the env flag
// isn't explicitly on, so this renders nothing rather than an empty
// placeholder. Deliberately quiet — collapsed by default, secondary to the
// real Sign in button above it, never a competing CTA. The demo environment
// (a separate seeded tenant) is chosen first, then the role within it.
function DevLoginBlock() {
  const router = useRouter();
  const [roles, setRoles] = useState<{ role: Role; label: string }[] | null>(null);
  const [environments, setEnvironments] = useState<{ key: string; label: string }[]>([]);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingInAs, setLoggingInAs] = useState<Role | null>(null);

  useEffect(() => {
    // Environments are optional: a server with a single tenant just has none to pick from.
    Promise.all([api.devLoginRoles(), api.devLoginEnvironments().catch(() => [])])
      .then(([r, e]) => {
        setRoles(r);
        setEnvironments(e);
        setEnvironment(e[0]?.key ?? null);
      })
      .catch(() => setRoles([]));
  }, []);

  if (!roles || roles.length === 0) return null;
  const environmentLabel = environments.find((e) => e.key === environment)?.label;

  async function loginAs(role: Role) {
    setLoggingInAs(role);
    try {
      const { user } = await api.devLogin(role, environment ?? undefined);
      router.push(ROLE_HOME[user.role]);
    } catch {
      setLoggingInAs(null);
    }
  }

  return (
    <div className="mt-6 border-t border-neutral-100 pt-4" data-testid="dev-login-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="dev-login-panel"
        className="flex min-h-11 w-full items-center justify-between rounded text-xs font-medium text-neutral-600 transition hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 lg:min-h-8"
        data-testid="dev-login-toggle"
      >
        <span>Development</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="dev-login-panel" className="mt-2 space-y-2">
          {environments.length > 1 && (
            <div role="group" aria-label="Demo environment" className="grid grid-cols-2 gap-1" data-testid="dev-login-environments">
              {environments.map((e) => (
                <button
                  key={e.key}
                  type="button"
                  aria-pressed={environment === e.key}
                  onClick={() => setEnvironment(e.key)}
                  className={`min-h-11 rounded-md border px-2 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 lg:min-h-8 ${
                    environment === e.key
                      ? "border-primary-500 bg-primary-50 font-semibold text-primary-700"
                      : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                  }`}
                  data-testid={`dev-login-env-${e.key}`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5" data-testid="dev-login-roles">
            {roles.map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => loginAs(r.role)}
                disabled={loggingInAs !== null}
                aria-label={environmentLabel ? `${r.label}, ${environmentLabel}` : r.label}
                aria-busy={loggingInAs === r.role}
                className="min-h-11 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:opacity-50 lg:min-h-8"
                data-testid={`dev-login-role-${r.role}`}
              >
                {loggingInAs === r.role ? "Signing in…" : r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user } = await api.login(email, password);
      router.push(ROLE_HOME[user.role] ?? "/command-centre");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Incorrect email or password.");
      } else {
        setError("Could not reach PulseOS API. Is it running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen app-canvas">
      {/* Brand canvas — desktop only */}
      <div className="relative hidden w-[62%] overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* subtle abstract decoration */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]" viewBox="0 0 800 900" fill="none" aria-hidden="true">
          <circle cx="680" cy="120" r="220" stroke="white" strokeWidth="1" />
          <circle cx="680" cy="120" r="320" stroke="white" strokeWidth="1" />
          <circle cx="60" cy="820" r="180" stroke="white" strokeWidth="1" />
          <path d="M0 700 Q 400 600 800 720" stroke="white" strokeWidth="1" />
        </svg>

        <div className="relative flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <HeartPulse size={18} className="text-white" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">PulseOS</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] text-white">One view of every patient journey.</h1>
          <p className="mt-3 text-sm text-primary-100">From enquiry to consultation, treatment and follow-up.</p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div key={b.title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <b.icon size={17} className="text-white" strokeWidth={2} />
                </span>
                <p className="mt-2.5 text-sm font-medium text-white">{b.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-primary-100">{b.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <span className="block text-2xl font-semibold text-white">{s.value}</span>
              <span className="block text-xs text-primary-100">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <HeartPulse size={18} className="text-white" strokeWidth={2.25} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-primary-700">PulseOS</span>
          </div>

          <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-neutral-500">Sign in to your PulseOS account</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" data-testid="login-form">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-600">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-neutral-600">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-400 hover:text-neutral-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              Remember me
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-100 px-3 py-2 text-xs text-danger-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <DevLoginBlock />

          <p className="mt-6 text-center text-xs text-neutral-600">Need help? Contact your administrator.</p>
        </div>
      </div>
    </main>
  );
}
