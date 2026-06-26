"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiSearch, FiX, FiArrowLeft, FiArrowRight } from "react-icons/fi";
import {
  getCampaigns,
  getCategories,
  type CampaignSummary,
} from "@/lib/api";
import { money } from "@/lib/format";

const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * Slide-in search panel (left side). Holds a search field, category SUGGESTIONS, and a
 * FEATURED carousel of live drops. Opening lazy-loads categories + featured products.
 */
export function SearchDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [featured, setFeatured] = useState<CampaignSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Lazy-load data + focus the field + lock scroll when opened.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    let active = true;
    (async () => {
      try {
        const [cats, drops] = await Promise.all([getCategories(), getCampaigns()]);
        if (!active) return;
        setCategories(cats.slice(0, 6));
        setFeatured(drops.slice(0, 8));
      } catch {
        /* ignore */
      }
    })();

    return () => {
      active = false;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/drops?q=${encodeURIComponent(q)}` : "/drops");
    onClose();
  }

  function goCategory(cat: string) {
    router.push(`/drops?q=${encodeURIComponent(cat)}`);
    onClose();
  }

  function scrollRail(dir: 1 | -1) {
    railRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] transition-opacity duration-500 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel — slides in from the right, squared corners to match the card style */}
      <aside
        role="dialog"
        aria-label="Search"
        aria-modal="true"
        className={`fixed right-0 top-0 z-[90] flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-500 ${EASE} ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-7">
          <h2 className="text-lg font-semibold uppercase tracking-[0.14em] text-teal">
            Search
          </h2>
          <button
            onClick={onClose}
            aria-label="Close search"
            className="-mr-1 flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:text-teal"
          >
            <FiX className="h-6 w-6" aria-hidden />
          </button>
        </div>

        {/* Search field (squared) */}
        <form onSubmit={submit} className="px-7 pt-6">
          <div className="flex items-center gap-3 border border-foreground/80 px-4 py-3">
            <FiSearch className="h-5 w-5 text-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Search drops"
              aria-label="Search drops"
              className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted"
            />
          </div>
        </form>

        <div className="flex-1 overflow-y-auto px-7 pb-10 pt-8">
          {/* Suggestions */}
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">
            Suggestions
          </p>
          <ul className="mt-3 space-y-1">
            {categories.map((c) => (
              <li key={c}>
                <button
                  onClick={() => goCategory(c)}
                  className="block w-full py-1.5 text-left font-serif text-xl text-teal transition-colors hover:text-teal-700 hover:underline"
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>

          {/* Featured carousel */}
          <div className="mt-10 flex items-center justify-between">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">
              Featured
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => scrollRail(-1)}
                aria-label="Scroll left"
                className="flex h-8 w-8 items-center justify-center text-teal transition-colors hover:text-teal-700"
              >
                <FiArrowLeft aria-hidden />
              </button>
              <button
                onClick={() => scrollRail(1)}
                aria-label="Scroll right"
                className="flex h-8 w-8 items-center justify-center text-teal transition-colors hover:text-teal-700"
              >
                <FiArrowRight aria-hidden />
              </button>
            </div>
          </div>

          <div
            ref={railRef}
            className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {featured.map((s) => (
              <Link
                key={s.campaign.id}
                href={`/campaigns/${s.campaign.id}`}
                onClick={onClose}
                className="group w-44 shrink-0 snap-start"
              >
                <div className="aspect-square w-full overflow-hidden bg-soft p-4">
                  {s.campaign.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.campaign.image_url}
                      alt={s.campaign.title}
                      loading="lazy"
                      className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-2 line-clamp-2 font-serif text-base leading-snug text-foreground group-hover:text-teal">
                  {s.campaign.title}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-teal">
                  {money(s.current_price)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
