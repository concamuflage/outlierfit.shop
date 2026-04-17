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

type SignupFormProps = {
  onSuccess?: () => void;
  compact?: boolean;
};

const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must be at least 12 characters and include uppercase, lowercase, a number, a special character, and no spaces.";

function isStrongPassword(password: string) {
  return (
    password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    !/\s/.test(password)
  );
}

/**
 * Signup form UI and client-side submission handler.
 * Creates a user in the backend and prompts for email verification.
 */
export default function SignupForm({ onSuccess, compact = false }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  /**
   * Submit handler for the signup form.
   * Validates password confirmation, creates the user, then shows verification instructions.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    // Client-side check to avoid an unnecessary network call.
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (!isStrongPassword(password)) {
      setError(PASSWORD_REQUIREMENTS_MESSAGE);
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

    setLoading(false);
    const data = await res.json().catch(() => null);
    setSuccessMessage(data?.message ?? "Check your email to verify your account before signing in.");
    onSuccess?.();
  };

  const handleResendVerification = async () => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBase) {
      setError("Missing API base URL.");
      return;
    }

    setResending(true);
    setError(null);

    const res = await fetch(`${apiBase}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Unable to resend verification email.");
      setResending(false);
      return;
    }

    setSuccessMessage(data?.message ?? "Verification email sent.");
    setResending(false);
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
            <label className="text-xs font-medium text-zinc-600" htmlFor="signup-first-name">
              First name
            </label>
            <input
              id="signup-first-name"
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
            <label className="text-xs font-medium text-zinc-600" htmlFor="signup-last-name">
              Last name
            </label>
            <input
              id="signup-last-name"
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
          <label className="text-xs font-medium text-zinc-600" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
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
          <label className="text-xs font-medium text-zinc-600" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
          <p className="mt-2 text-xs text-zinc-500">
            Use at least 12 characters with uppercase, lowercase, a number, a special character,
            and no spaces.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="signup-confirm-password">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
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
        {successMessage ? <div className="text-xs text-emerald-700">{successMessage}</div> : null}

        {successMessage ? (
          <button
            type="button"
            disabled={resending || !email}
            onClick={handleResendVerification}
            className="text-left text-xs text-zinc-700 underline disabled:opacity-50"
          >
            {resending ? "Sending verification email..." : "Resend verification email"}
          </button>
        ) : null}

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
