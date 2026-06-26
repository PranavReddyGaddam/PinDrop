import { Suspense } from "react";
import {
  getCampaigns,
  getCategories,
  type CampaignSummary,
} from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CampaignBrowser } from "@/components/CampaignBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "All drops — Pindrop",
};

export default async function DropsPage() {
  let initial: CampaignSummary[] = [];
  let categories: string[] = [];
  try {
    [initial, categories] = await Promise.all([getCampaigns(), getCategories()]);
  } catch {
    // backend may be down during dev
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-page px-5 py-14">
        <header className="mb-10">
          <p className="font-script text-2xl text-teal">browse every drop</p>
          <h1 className="mt-1 font-serif text-4xl text-foreground">All drops</h1>
          <p className="mt-2 max-w-xl text-muted">
            Filter by category or search by name. The price falls as more people join —
            every buyer pays the lowest tier reached by the deadline.
          </p>
        </header>
        <Suspense fallback={null}>
          <CampaignBrowser initial={initial} categories={categories} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
