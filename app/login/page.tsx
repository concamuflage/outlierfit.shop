"use client";

import React from "react";
import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

/**
 * Standalone login page (non-modal).
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-6xl justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Primary login form content. */}
          <LoginForm />
          {/* Keep login and signup as separate routes as well. */}
          <div className="mt-4 text-center text-xs text-zinc-600">
            New here?{" "}
            <Link className="text-zinc-900 underline" href="/signup">
              Create an account
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
