"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import CartButton from "@/components/cart/CartButton";
import LoginModal from "@/components/auth/LoginModal";
import SignupModal from "@/components/auth/SignupModal";

/**
 * Site header with auth actions and cart entry point.
 * Shows login/signup buttons when logged out, and sign-out when logged in.
 */
export default function Header() {
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="text-lg font-semibold tracking-tight">AsianFit</div>
        <nav className="flex items-center gap-6 text-sm">
          <Link className="hover:underline" href="/about">
            About
          </Link>
          <Link
            className="rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800"
            href="/products"
          >
            Browse Items
          </Link>
          {session?.user ? (
            <div className="flex items-center gap-3">
              <div className="text-xs text-zinc-600">
                Hi, {session.user.name ?? session.user.email}
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-xs text-zinc-600 hover:text-zinc-900"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setIsAuthOpen(true);
                }}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 hover:border-zinc-400"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setIsAuthOpen(true);
                }}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 hover:border-zinc-400"
              >
                Sign in
              </button>
            </div>
          )}
          <CartButton />
        </nav>
      </div>

      {/* Render the correct modal based on current auth mode. */}
      {authMode === "login" ? (
        <LoginModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          // Switching modes keeps the modal open and swaps the content.
          onSwitchToSignup={() => setAuthMode("signup")}
        />
      ) : (
        <SignupModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          // Switching modes keeps the modal open and swaps the content.
          onSwitchToLogin={() => setAuthMode("login")}
        />
      )}
    </header>
  );
}
