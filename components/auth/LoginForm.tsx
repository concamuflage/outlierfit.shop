// LoginForm (client component)
//
// This component renders the login form UI and handles
// client-side form state and submission.
//
// IMPORTANT ARCHITECTURE NOTE:
// - This component runs in the BROWSER.
// - It does NOT authenticate users directly.
// - It delegates authentication to NextAuth via `signIn("credentials")`.
//
// Auth flow:
// User submits form
//   -> signIn("credentials")
//   -> NextAuth API route (/api/auth/*)
//   -> authorize() runs on the NextAuth server
//   -> backend server validates credentials

"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  onSuccess?: () => void;
  compact?: boolean;
};

/**
 * Login form UI and client-side submission handler.
 * Delegates auth to NextAuth credentials provider.
 */
export default function LoginForm({ onSuccess, compact = false }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Submit handler for the login form.
   * Prevents full-page reload and calls NextAuth.
   */
  // Handles form submission when user clicks "Sign in"
  const handleSubmit = async (event: React.FormEvent) => {
    // Prevents the browser from doing a full page reload
    // (default HTML form behavior)
    event.preventDefault();

    // Turn on loading state to disable button and show spinner text
    setLoading(true);

    // Clear any previous error message before attempting login
    setError(null);

    // TEMP DEV: Add small artificial delay so we can SEE the loading state.
    // In production, you normally would NOT do this.
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Ask NextAuth to validate credentials without doing a full redirect.
    // Call NextAuth's credentials provider.
    // This does NOT talk directly to your backend.
    // Instead, it sends a request to:
    //    /api/auth/callback/credentials
    // which runs the `authorize()` function on the server.
    //
    // redirect: false → prevents automatic page navigation.
    // We want to manually control success/error handling here.
    const result = await signIn("credentials", {
      // These values are sent to the NextAuth server,
      // which then forwards them to your backend for validation.
      email,
      password,

      // Disable automatic redirect so we can check `result.error`
      // and display custom UI feedback.
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    setLoading(false);
    if (onSuccess) {
      onSuccess();
      return;
    }

    router.push(result?.url ?? "/");
    router.refresh();
  };

  return (
    /*
      Root container. The `compact` flag is used when the form is embedded
      inside a modal that already has a padded card background.
    */
    <div className={compact ? "" : "rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm"}>
      <h1 className={compact ? "text-base font-semibold" : "text-2xl font-semibold"}>
        Welcome back
      </h1>
      <p className="mt-2 text-sm text-zinc-600">Sign in with email</p>

      {/* Main form. autoComplete keeps browser password managers happy. */}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit} autoComplete="on">
        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
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
          <label className="text-xs font-medium text-zinc-600" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error ? <div className="text-xs text-red-600">{error}</div> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
