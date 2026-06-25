import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-hairline">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="font-serif text-lg lowercase text-foreground">pindrop</span>
        <nav className="flex gap-6">
          <Link href="/" className="hover:text-teal">
            Drops
          </Link>
          <Link href="/campaigns/new" className="hover:text-teal">
            Start a drop
          </Link>
        </nav>
        <span>The price drops as more people join.</span>
      </div>
    </footer>
  );
}
