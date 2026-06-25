import Link from "next/link";
import { CartButton } from "./cart/CartButton";

/** syrn-style frame: thin periwinkle promo bar + centered wordmark + minimal nav. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="bg-periwinkle py-2 text-center text-sm text-white">
        The price drops as more people join — share to pay less.
      </div>
      <div className="border-b border-hairline bg-background">
        <div className="mx-auto grid h-[72px] max-w-page grid-cols-3 items-center px-5">
          <nav className="flex gap-6 text-sm font-medium uppercase tracking-wide">
            <Link href="/" className="hover:text-teal">
              Drops
            </Link>
            <Link href="/campaigns/new" className="hover:text-teal">
              Start a drop
            </Link>
            <Link href="/commitments" className="hover:text-teal">
              My drops
            </Link>
          </nav>
          <Link
            href="/"
            className="text-center font-serif text-2xl font-semibold lowercase tracking-tight text-foreground"
          >
            pindrop
          </Link>
          <div className="flex justify-end">
            <CartButton />
          </div>
        </div>
      </div>
    </header>
  );
}
