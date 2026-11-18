/** Renders the founder story and fit guidance on /about and the homepage /. */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">About</h1>

        <div className="mt-6 max-w-3xl space-y-5 text-base leading-8 text-zinc-700">
          <p>
            As a shorter Asian guy who has lived in the U.S., I know firsthand how frustrating
            it can be to find clothes that actually fit. Even the smallest sizes often have
            sleeves that are too long or a body length that doesn&apos;t work for shorter men.
            I struggled to find even a basic T-shirt that fit me properly.
          </p>

          <p>
            That&apos;s why I started this business:{" "}
            <strong>to bring better-fitting clothes to shorter guys like me.</strong>
          </p>

          <p>
            We&apos;re still in the early stages, testing the idea and seeing whether there&apos;s
            enough demand for clothing designed specifically for shorter men. For now, our
            clothes are sourced from China, so the care labels are still in Chinese.
          </p>

          <p>
            Because these clothes are designed with Asian body proportions in mind, the sleeves
            may be shorter than those on typical American clothing. If you&apos;re not Asian, we
            recommend checking the sleeve measurements carefully before purchasing to make sure
            they&apos;re long enough for you.
          </p>

          <p>
            <strong>All measurements are based on the actual garment in the selected size and style</strong>,
            so you can check the fit before placing your order.
          </p>
        </div>
      </main>
    </div>
  );
}
