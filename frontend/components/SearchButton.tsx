"use client";

import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { SearchDrawer } from "./SearchDrawer";

/** Search icon in the header that opens the slide-in search panel. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-soft hover:text-teal"
      >
        <FiSearch className="h-5 w-5" aria-hidden />
      </button>
      <SearchDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
