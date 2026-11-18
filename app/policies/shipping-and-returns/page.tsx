/**
 * Displays /policies/shipping-and-returns with the store's current policy terms.
 * Shipping states the weekly USPS schedule: all orders ship on Sundays.
 * For example, an unworn shirt with tags attached is eligible when its size does not fit.
 */
export default function ShippingAndReturnsPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Shipping and Returns</h1>

        <section aria-labelledby="shipping-heading" className="mt-6 max-w-3xl text-base leading-8 text-zinc-700">
          <h2 id="shipping-heading" className="text-xl font-semibold text-zinc-900">Shipping</h2>
          <p className="mt-3">
            <strong>
              We ship all orders via USPS every Sunday.
            </strong>
          </p>
        </section>

        <section aria-labelledby="returns-heading" className="mt-8 max-w-3xl space-y-4 text-base leading-8 text-zinc-700">
          <h2 id="returns-heading" className="text-xl font-semibold text-zinc-900">Returns</h2>
          <table className="w-full table-fixed border-collapse text-left text-sm leading-6 sm:text-base">
            <caption className="sr-only">Return policy terms</caption>
            <thead className="border-b border-zinc-200 text-zinc-900">
              <tr>
                <th scope="col" className="w-[36%] py-3 pr-4 font-semibold">Policy term</th>
                <th scope="col" className="py-3 font-semibold">Return policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 align-top">
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Return window</th>
                <td className="py-3">30 days from delivery</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Return eligibility</th>
                <td className="py-3">Unworn, unwashed, undamaged, with tags attached</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Size doesn&apos;t fit</th>
                <td className="py-3">Return accepted</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Return shipping</th>
                <td className="py-3">Customer pays</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Wrong or defective item</th>
                <td className="py-3">Free replacement or refund</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Exchanges</th>
                <td className="py-3">Return the item and place a new order</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Original shipping fee</th>
                <td className="py-3">Non-refundable</td>
              </tr>
              <tr>
                <th scope="row" className="py-3 pr-4 font-medium">Refund processing</th>
                <td className="py-3">Within 5 business days after inspection</td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
