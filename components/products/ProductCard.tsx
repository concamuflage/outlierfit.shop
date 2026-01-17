

import Link from "next/link";

export type Product = {
  slug: string;
  name: string;
  price: number;
  currency?: string; // default USD
  brand?: string;
  imageUrl?: string;
  fitNote?: string; // e.g., "Best for 160–168cm"
  tags?: string[];  // e.g., ["Shorter sleeves", "Regular fit"]
};

type ProductCardProps = {
  product: Product;
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProductCard({ product }: ProductCardProps) {
  const currency = product.currency ?? "USD";

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:shadow"
    >
      <div className="aspect-[4/5] w-full bg-zinc-100">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
            No image yet
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm text-zinc-500">
              {product.brand ?? "Curated"}
            </div>
            <h3 className="mt-1 line-clamp-2 text-base font-medium text-zinc-900">
              {product.name}
            </h3>
          </div>
          <div className="shrink-0 text-sm font-semibold text-zinc-900">
            {formatPrice(product.price, currency)}
          </div>
        </div>

        {product.fitNote ? (
          <div className="mt-3 inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
            {product.fitNote}
          </div>
        ) : null}

        {product.tags && product.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {product.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-zinc-900/5 px-3 py-1 text-xs text-zinc-700"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {product.fitNote ? (
          <p className="mt-3 text-sm text-zinc-600">{product.fitNote}</p>
        ) : product.fitNote === undefined && product.fitNote !== "" ? (
          <p className="mt-3 text-sm text-zinc-600">Fit-focused pick for shorter proportions.</p>
        ) : null}
      </div>
    </Link>
  );
}