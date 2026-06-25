import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CreateCampaignForm } from "@/components/CreateCampaignForm";

export const metadata = {
  title: "Start a drop — Pindrop",
};

export default function NewCampaignPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-page px-5 py-12">
        <p className="font-script text-2xl text-teal">start a drop</p>
        <h1 className="mt-2 font-serif text-4xl text-foreground">
          Launch a batch
        </h1>
        <p className="mt-3 max-w-xl text-foreground/70">
          Set your batch size, deadline, and price tiers. Buyers pay the lowest
          tier reached by the time the drop closes.
        </p>
        <div className="mt-10">
          <CreateCampaignForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
