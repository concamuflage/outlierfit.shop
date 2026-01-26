
import Link from "next/link";
import CartButton from "@/components/cart/CartButton";

export default function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="text-lg font-semibold tracking-tight">AsianFit</div>
        <nav className="flex items-center gap-6 text-sm">
          <Link className="hover:underline" href="/products">
            Shop
          </Link>
          <Link className="hover:underline" href="/about">
            About
          </Link>
          <Link
            className="rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800"
            href="/products"
          >
            Browse Items
          </Link>
          <CartButton />
        </nav>
      </div>
    </header>
  );
}
