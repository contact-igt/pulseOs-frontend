"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@pulseos/api-client";
import { Card } from "@pulseos/ui";

const ROLE_HOME: Record<string, string> = {
  DOCTOR: "/doctor-home",
  HOSPITAL_ADMIN: "/command-centre",
  SUPER_ADMIN: "/command-centre",
  FRONT_DESK: "/command-centre",
  PATIENT_COORDINATOR: "/command-centre",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold text-slate-900">PulseOS</h1>
        <p className="mt-1 text-sm text-neutral-500">Hospital operations command centre</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="login-form">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-neutral-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-neutral-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p role="alert" className="rounded bg-danger-100 px-3 py-2 text-xs text-danger-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-primary-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </Card>
    </main>
  );
}
