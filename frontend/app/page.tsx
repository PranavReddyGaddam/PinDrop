import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { getCampaigns, type CampaignSummary } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CampaignGrid } from "@/components/CampaignGrid";
import { BrowseDropsButton } from "@/components/BrowseDropsButton";

export const dynamic = "force-dynamic";

const FEATURED_COUNT = 12;

/** A varied "featured" selection: pick one drop per category round-robin, so the
 *  homepage looks editorial instead of dumping a slice of one category. */
function featuredMix(all: CampaignSummary[], n: number): CampaignSummary[] {
  const byCat = new Map<string, CampaignSummary[]>();
  for (const s of all) {
    const k = s.campaign.category;
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(s);
  }
  const buckets = [...byCat.values()];
  const out: CampaignSummary[] = [];
  let i = 0;
  while (out.length < n && buckets.some((b) => b.length)) {
    const b = buckets[i % buckets.length];
    if (b.length) out.push(b.shift()!);
    i++;
  }
  return out.slice(0, n);
}

export default async function Home() {
  let all: CampaignSummary[] = [];
  try {
    all = await getCampaigns();
  } catch {
    // Backend may be down during dev; render the hero with an empty grid.
  }
  const featured = featuredMix(all, FEATURED_COUNT);

  return (
    <>
      <SiteHeader />

      {/*
        Hero fills the viewport: headline + the price-drop ticker motif only.
        Live drops live below the fold, reached by scrolling.
        Header is 72px + a thin border; subtract it so the hero sits flush.
      */}
      <section className="relative flex min-h-[calc(100vh-73px)] items-center overflow-hidden">
        {/* Full-bleed hero image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        {/*
          Soft left-edge gradient: dark on the far left, fully transparent by ~60%, so the
          white hero text stays legible over a busy photo without washing the image out.
        */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [background:linear-gradient(to_right,rgba(10,10,10,0.62)_0%,rgba(10,10,10,0.38)_28%,rgba(10,10,10,0)_60%)]"
        />

        <div className="mx-auto w-full max-w-page px-5">
          {/* Text column kept left, where the gradient guarantees contrast. */}
          <div className="max-w-xl lg:max-w-[52%]">
            <p className="font-script text-3xl text-lime sm:text-4xl">
              shop with your people
            </p>
            <h1 className="mt-3 font-serif text-6xl leading-[1.02] text-white drop-shadow-sm sm:text-7xl">
              Great finds,
              <br />
              better together.
            </h1>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/campaigns/new"
                className="inline-flex items-center gap-2 rounded-full bg-lime px-7 py-3.5 text-base font-semibold text-lime-ink transition-transform hover:scale-[1.02]"
              >
                Start a drop
                <FiArrowRight aria-hidden />
              </Link>
              <BrowseDropsButton />
            </div>
          </div>
        </div>
      </section>

      {/* Live drops — a curated, mixed selection. Full catalog lives on /drops. */}
      <section id="live-drops" className="mx-auto max-w-page scroll-mt-32 px-5 py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="font-script text-2xl text-teal">live right now</p>
            <h2 className="mt-1 font-serif text-3xl text-foreground">
              Featured drops
            </h2>
          </div>
          <Link
            href="/drops"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-medium uppercase tracking-wide text-teal hover:underline"
          >
            Browse all drops
            <FiArrowRight aria-hidden />
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-muted">No live drops right now.</p>
        ) : (
          <CampaignGrid items={featured} />
        )}

        <div className="mt-14 text-center">
          <Link
            href="/drops"
            className="inline-flex items-center gap-2 rounded-full border border-hairline px-7 py-3.5 text-base font-medium text-foreground transition-colors hover:border-teal hover:text-teal"
          >
            See all {all.length} drops
            <FiArrowRight aria-hidden />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
