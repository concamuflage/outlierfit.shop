import Link from "next/link";


export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
     
      <main>
        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:py-24">
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Clothes that actually fit short Asian men.
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
              Curated streetwear and essentials with better sleeve length, inseam,
              and proportions. Shop faster. Return less.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-white hover:bg-zinc-800"
              >
                Shop now
              </Link>
              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 text-zinc-900 hover:bg-zinc-50"
              >
                Explore curated picks
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 text-sm text-zinc-600 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="font-medium text-zinc-900">Better fit</div>
                <div className="mt-1">Shorter sleeves & inseams</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="font-medium text-zinc-900">Curated</div>
                <div className="mt-1">Only proven silhouettes</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="font-medium text-zinc-900">Fast</div>
                <div className="mt-1">Simple sizing guidance</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-zinc-900">
                  Featured this week
                </div>
                <div className="text-xs text-zinc-500">Example items</div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-medium">Slim-fit joggers</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Better inseam options
                  </div>
                  <div className="mt-4 text-sm font-semibold">$59</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-medium">Crewneck sweatshirt</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Clean proportions
                  </div>
                  <div className="mt-4 text-sm font-semibold">$49</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-medium">Everyday tee</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Not too long
                  </div>
                  <div className="mt-4 text-sm font-semibold">$29</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-medium">Minimal jacket</div>
                  <div className="mt-1 text-xs text-zinc-600">
                    Shorter sleeves
                  </div>
                  <div className="mt-4 text-sm font-semibold">$89</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
                Tip: start with inseam and sleeve length — we recommend sizes
                based on your height.
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 p-6">
                <div className="text-sm font-medium">1) Tell us your height</div>
                <div className="mt-2 text-sm text-zinc-600">
                  We optimize for proportions that matter.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 p-6">
                <div className="text-sm font-medium">2) Pick from curated fits</div>
                <div className="mt-2 text-sm text-zinc-600">
                  No endless scrolling through bad sizing.
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 p-6">
                <div className="text-sm font-medium">3) Buy with confidence</div>
                <div className="mt-2 text-sm text-zinc-600">
                  Fewer returns, better outfits.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
