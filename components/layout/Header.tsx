"use client";

import React from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import CartButton from "@/components/cart/CartButton";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import LoginModal from "@/components/auth/LoginModal";
import SignupModal from "@/components/auth/SignupModal";

/**
 * Site header with auth actions and cart entry point.
 * Shows login/signup buttons when logged out, and sign-out when logged in.
 * For example, logged-out visitors on /products see Sign up and Sign in.
 * Every page shows the expected Boston shipping date, e.g. around December 20.
 * The banner explains the Asian-proportion long-sleeve fit and discloses Chinese care labels.
 */
export default function Header() {
  const { data: session } = useSession();
  const {
    authMode,
    isAuthOpen,
    openLoginModal,
    openSignupModal,
    switchToLogin,
    switchToSignup,
    closeAuthModal,
  } = useAuthModal();
  const pathname = usePathname();
  const router = useRouter();
  const openedFromAuthPage = pathname === "/login" || pathname === "/signup";

  const handleLoginModalSuccess = () => {
    closeAuthModal();
    if (openedFromAuthPage) {
      router.push("/products");
      router.refresh();
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/products" });
  };

  return (
    <header className="border-b border-zinc-200 bg-white">
      <aside aria-label="Shipping announcement" className="bg-zinc-900 text-white">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-3 text-center text-sm leading-5 sm:px-6">
          <p className="font-semibold">We expect to ship from Boston around December 20.</p>
          <p>
            Our long-sleeve styles are designed with Asian body proportions in mind, with a shorter sleeve fit.
            {" "}Please check sleeve measurements before ordering.
            {" "}We plan to offer more sleeve-length options for customers of all ethnic backgrounds in the future.
          </p>
          <p className="text-xs text-zinc-300">Please note that care labels are in Chinese.</p>
        </div>
      </aside>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-lg font-semibold tracking-tight sm:text-xl">OutlierFit</div>
        <nav className="flex flex-wrap items-center gap-3 text-sm sm:gap-4 lg:justify-end lg:gap-6">
          <Link className="whitespace-nowrap hover:underline" href="/about">
            About
          </Link>
          <Link className="whitespace-nowrap hover:underline" href="/contact">
            Contact Us
          </Link>
          <Link
            className="whitespace-nowrap rounded-full bg-zinc-900 px-3 py-2 text-white hover:bg-zinc-800 sm:px-4"
            href="/products"
          >
            Browse Items
          </Link>
          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                aria-label="Open profile"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:border-zinc-400 hover:text-zinc-900"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="whitespace-nowrap text-xs text-zinc-600 hover:text-zinc-900"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={openSignupModal}
                className="whitespace-nowrap rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 hover:border-zinc-400"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={openLoginModal}
                className="whitespace-nowrap rounded-full border border-zinc-200 px-4 py-2 text-sm text-zinc-900 hover:border-zinc-400"
              >
                Sign in
              </button>
            </div>
          )}
          {session?.user ? <CartButton /> : null}
        </nav>
      </div>

      {/* Render the correct modal based on current auth mode. */}
      {authMode === "login" ? (
        <LoginModal
          isOpen={isAuthOpen}
          onClose={closeAuthModal}
          onSuccess={handleLoginModalSuccess}
          // Switching modes keeps the modal open and swaps the content.
          onSwitchToSignup={switchToSignup}
        />
      ) : (
        <SignupModal
          isOpen={isAuthOpen}
          onClose={closeAuthModal}
          // Switching modes keeps the modal open and swaps the content.
          onSwitchToLogin={switchToLogin}
        />
      )}
    </header>
  );
}
