import Link from "next/link";
import { CartButton } from "./cart/CartButton";
import { SearchButton } from "./SearchButton";
import { MobileNav } from "./MobileNav";

/** syrn-style frame: thin periwinkle promo bar + centered wordmark + minimal nav. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      <div className="bg-periwinkle py-2 text-center text-sm text-white">
        Free shipping on orders over $75 — every drop ships once it closes.
      </div>
      <div className="border-b border-hairline bg-background">
        <div className="relative mx-auto flex h-[72px] max-w-page items-center px-5">
          {/* Left: inline nav on sm+, hamburger on mobile (so the centered wordmark
              never collides with the links on narrow screens). */}
          <nav className="hidden gap-6 text-sm font-medium uppercase tracking-wide sm:flex">
            <Link href="/campaigns/new" className="hover:text-teal">
              Start a drop
            </Link>
            <Link href="/commitments" className="hover:text-teal">
              My drops
            </Link>
          </nav>
          <MobileNav />

          {/* Center: wordmark — absolutely centered so the right-side icons can hug
              the right edge regardless of the nav/icon widths. */}
          <Link
            href="/"
            className="absolute left-1/2 -translate-x-1/2 font-serif text-2xl font-semibold lowercase tracking-tight text-foreground"
          >
            pindrop
          </Link>

          {/* Right: search + cart, pinned to the right edge */}
          <div className="ml-auto flex items-center gap-1">
            <SearchButton />
            <CartButton />
          </div>
        </div>
      </div>
    </header>
  );
}
