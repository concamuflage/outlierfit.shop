"use client";

import React from "react";
import Link from "next/link";
import SignupForm from "@/components/auth/SignupForm";

/**
 * Standalone signup page (non-modal).
 */
export default function SignupPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-6xl justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Primary signup form content. */}
          <SignupForm />
          {/* Keep login and signup as separate routes as well. */}
          <div className="mt-4 text-center text-xs text-zinc-600">
            Already have an account?{" "}
            <Link className="text-zinc-900 underline" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
