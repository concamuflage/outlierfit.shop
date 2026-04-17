"use client";

import { useState } from "react";

function buildEmail() {
  return String.fromCharCode(
    97, 115, 105, 97, 110, 102, 105, 116, 46, 105, 110, 102, 111, 64, 103, 109,
    97, 105, 108, 46, 99, 111, 109
  );
}

export default function ContactPage() {
  const [revealed, setRevealed] = useState(false);

  const email = revealed ? buildEmail() : "Click below to reveal our email address.";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-3xl flex-col justify-center px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Contact Us</h1>

        <div className="mt-6 space-y-4 text-base leading-8 text-zinc-700">
          <p>
            If you have any questions about sizing, shipping, returns, or your order,
            please reach out by email.
          </p>

          <div className="space-y-3">
            <p>{email}</p>

            <div className="flex gap-3">
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
