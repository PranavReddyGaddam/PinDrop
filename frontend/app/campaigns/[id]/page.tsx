import { notFound } from "next/navigation";
import { getCampaignStats, ApiError } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PriceDropDisplay } from "@/components/PriceDropDisplay";
import { PreviousDrops } from "@/components/PreviousDrops";

// Always fetch fresh — prices are live.
export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let initial;
  try {
    initial = await getCampaignStats(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const { campaign } = initial;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-page grid-cols-1 gap-10 px-5 py-8 lg:grid-cols-2 lg:gap-16 lg:py-12">
        {/* Full-bleed editorial image on a soft background. */}
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-soft">
          {campaign.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.image_url}
              alt={campaign.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-script text-4xl text-muted">
                roasted to order
              </span>
            </div>
          )}
        </div>

        {/* Live price panel. */}
        <div className="lg:py-2">
          <PriceDropDisplay initial={initial} />

          {campaign.description && (
            <div className="mt-10 border-t border-hairline pt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                About this batch
              </p>
              <p className="leading-relaxed text-foreground/80">
                {campaign.description}
              </p>
            </div>
          )}

          {/* Finished drops for the same product. */}
          <PreviousDrops campaignId={id} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
