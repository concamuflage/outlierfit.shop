"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type VerificationState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const email = searchParams.get("email");
    const token = searchParams.get("token");
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!email || !token) {
      setState("error");
      setMessage("This verification link is incomplete.");
      return;
    }

    if (!apiBase) {
      setState("error");
      setMessage("Missing API base URL.");
      return;
    }

    const controller = new AbortController();

    async function verifyEmail() {
      const params = new URLSearchParams({ email, token });
      const response = await fetch(`${apiBase}/auth/verify-email?${params.toString()}`, {
        method: "GET",
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setState("error");
        setMessage(payload?.error ?? "Unable to verify your email.");
        return;
      }

      setState("success");
      setMessage(payload?.message ?? "Email verified successfully. You can now sign in.");
    }

    verifyEmail().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setState("error");
      setMessage("Unable to verify your email.");
    });

    return () => controller.abort();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex max-w-6xl justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">
            {state === "loading" ? "Verifying your email" : state === "success" ? "Email verified" : "Verification failed"}
          </h1>
          <p className={`mt-4 text-sm ${state === "error" ? "text-red-600" : "text-zinc-600"}`}>{message}</p>
          <div className="mt-6">
            <Link className="text-sm text-zinc-900 underline" href="/login">
              Go to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
