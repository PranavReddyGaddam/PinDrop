"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMenu, FiX } from "react-icons/fi";

/**
 * Mobile-only nav: a hamburger that toggles a slide-down panel with the nav links.
 * Hidden at sm+ where the inline nav takes over (see SiteHeader). Keeps the centered
 * wordmark from colliding with the links on narrow screens.
 *
 * The panel and backdrop stay mounted and animate via CSS (max-height / opacity /
 * translate) so both opening AND closing are smooth. The icon cross-fades menu <-> X.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center text-foreground transition-colors hover:text-teal"
      >
        {/* Cross-fading / rotating icons */}
        <FiMenu
          className={`absolute h-5 w-5 transition-all duration-300 ${
            open ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
        <FiX
          className={`absolute h-5 w-5 transition-all duration-300 ${
            open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
      </button>

      {/* Backdrop — fades; pointer-events off while closed so it never blocks taps. */}
      <button
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={`fixed inset-x-0 bottom-0 top-[112px] z-40 bg-foreground/20 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel — slides + fades via max-height/opacity/translate. */}
      <nav
        className={`absolute left-0 right-0 top-full z-50 flex flex-col overflow-hidden border-hairline bg-background shadow-lg transition-all duration-300 ease-out ${
          open
            ? "max-h-40 translate-y-0 border-b opacity-100"
            : "pointer-events-none max-h-0 -translate-y-1 border-b-0 opacity-0"
        }`}
      >
        <Link
          href="/campaigns/new"
          onClick={() => setOpen(false)}
          tabIndex={open ? 0 : -1}
          className="px-5 py-3 text-sm font-medium uppercase tracking-wide text-foreground hover:bg-soft hover:text-teal"
        >
          Start a drop
        </Link>
        <Link
          href="/commitments"
          onClick={() => setOpen(false)}
          tabIndex={open ? 0 : -1}
          className="px-5 py-3 text-sm font-medium uppercase tracking-wide text-foreground hover:bg-soft hover:text-teal"
        >
          My drops
        </Link>
      </nav>
    </div>
  );
}
