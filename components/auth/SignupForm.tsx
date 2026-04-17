// SignupForm (client component)
//
// This component renders the signup form UI and handles
// client-side form state and submission.
//
// IMPORTANT ARCHITECTURE NOTE:
// - This component runs in the BROWSER.
// - It does NOT authenticate users directly.
// - It creates users via the backend and then delegates
//   authentication to NextAuth via `signIn("credentials")`.

"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";

type SignupFormProps = {
  onSuccess?: () => void;
  compact?: boolean;
};

/**
 * Signup form UI and client-side submission handler.
 * Creates a user in the backend and then logs in via NextAuth.
 */
export default function SignupForm({ onSuccess, compact = false }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Submit handler for the signup form.
   * Validates password confirmation, creates the user, then signs in.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side check to avoid an unnecessary network call.
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    // The backend URL must be provided at build/runtime.
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) {
      setError("Missing API base URL.");
      setLoading(false);
      return;
    }

    // Create the user in the backend first.
    const res = await fetch(`${apiBase}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    // If signup fails, show backend error (if any) and stop.
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Signup failed.");
      setLoading(false);
      return;
    }

    // After successful signup, log the user in via NextAuth.
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess?.();
  };

  return (
    /*
      Root container. The `compact` flag is used when the form is embedded
      inside a modal that already has a padded card background.
    */
    <div className={compact ? "" : "rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm"}>
      <h1 className={compact ? "text-base font-semibold" : "text-2xl font-semibold"}>
        Create your account
      </h1>
      <p className="mt-2 text-sm text-zinc-600">Sign up with email</p>

      {/* Main form. autoComplete helps password managers. */}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit} autoComplete="on">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="firstName">
              First name
            </label>
            <input
              id="firstName"
              name="given-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              placeholder="First"
              autoComplete="given-name"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="lastName">
              Last name
            </label>
            <input
              id="lastName"
              name="family-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              placeholder="Last"
              autoComplete="family-name"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="you@example.com"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="confirmPassword">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </div>

        {error ? <div className="text-xs text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-70"
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>
    </div>
  );
}
