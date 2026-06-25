"use client";

import { useCart } from "./CartContext";

/** Cart icon (uses /cart.svg) + live item-count badge; opens the cart drawer. */
export function CartButton() {
  const { count, open } = useCart();

  return (
    <button
      onClick={open}
      aria-label={`Open cart (${count} item${count === 1 ? "" : "s"})`}
      className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-soft hover:text-teal"
    >
      {/*
        Render cart.svg as a CSS mask so it inherits the button's text color
        (the raw <img> couldn't pick up currentColor). 37:27 aspect ratio.
      */}
      <span
        aria-hidden
        className="block h-6 w-[33px] bg-current"
        style={{
          maskImage: "url(/cart.svg)",
          WebkitMaskImage: "url(/cart.svg)",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
        }}
      />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-lime px-1 text-xs font-semibold text-lime-ink">
          {count}
        </span>
      )}
    </button>
  );
}
