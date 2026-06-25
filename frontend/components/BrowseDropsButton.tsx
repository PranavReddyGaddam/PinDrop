"use client";

/**
 * Smoothly scrolls to the #live-drops section instead of jumping. Client component so it
 * can run the scroll animation on click.
 */
export function BrowseDropsButton() {
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    const el = document.getElementById("live-drops");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <a
      href="#live-drops"
      onClick={handleClick}
      className="text-base font-medium text-foreground/70 transition-colors hover:text-teal"
    >
      Browse live drops
    </a>
  );
}
