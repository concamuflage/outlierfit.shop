"use client";

import { useState } from "react";

/** Builds the revealed contact address, apple_banana_2026@proton.me, from character codes. */
function buildEmail() {
  return String.fromCharCode(
    97, 112, 112, 108, 101, 95, 98, 97, 110, 97, 110, 97, 95, 50, 48, 50,
    54, 64, 112, 114, 111, 116, 111, 110, 46, 109, 101
  );
}

/** Renders /contact; selecting Reveal Email displays the configured contact address. */
export default function ContactPage() {
  const [revealed, setRevealed] = useState(false);

  const email = revealed ? buildEmail() : "Click below to reveal our email address.";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Contact Us</h1>

        <div className="mt-6 max-w-3xl space-y-4 text-base leading-8 text-zinc-700">
          <p>
            If you have any questions about sizing, shipping, returns, or your order,
            please reach out by email.
          </p>

          <div className="space-y-3">
            <p>{email}</p>

            <div className="flex flex-wrap gap-3">
              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
                >
                  Reveal Email
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
