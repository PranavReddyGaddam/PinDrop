import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import {
  getCampaigns,
  getCategories,
  type CampaignSummary,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CampaignBrowser } from "@/components/CampaignBrowser";
import { BrowseDropsButton } from "@/components/BrowseDropsButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initial: CampaignSummary[] = [];
  let categories: string[] = [];
  try {
    [initial, categories] = await Promise.all([getCampaigns(), getCategories()]);
  } catch {
    // Backend may be down during dev; render the hero with an empty grid.
  }

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
          Directional scrim: solid white over the text column on the left, fading to
          fully transparent by center-right so the photo stays vivid and un-washed.
          Explicit color stops keep the white zone opaque, then drop to clear quickly.
        */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 [background:linear-gradient(to_right,#ffffff_0%,#ffffff_34%,rgba(255,255,255,0.85)_46%,rgba(255,255,255,0)_68%)]"
        />

        <div className="mx-auto w-full max-w-page px-5">
          {/* Text column constrained to the left so it stays in the white scrim zone. */}
          <div className="max-w-xl lg:max-w-[52%]">
            <p className="font-script text-3xl text-teal sm:text-4xl">
              do what makes you save
            </p>
            <h1 className="mt-3 font-serif text-6xl leading-[1.02] text-foreground sm:text-7xl">
              The price drops as more people join.
            </h1>
            <p className="mt-7 max-w-xl text-lg text-foreground/70">
              A group-buy marketplace for everything. Every buyer pays the lowest
              price reached by the deadline — share a drop to pay less, for you and
              everyone already in.
            </p>

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

      {/* Live drops — below the fold, with category nav */}
      <section id="live-drops" className="mx-auto max-w-page scroll-mt-32 px-5 py-20">
        <h2 className="mb-8 font-serif text-3xl text-foreground">Live drops</h2>
        <CampaignBrowser initial={initial} categories={categories} />
      </section>

      <SiteFooter />
    </>
  );
}
