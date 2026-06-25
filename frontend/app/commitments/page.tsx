import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MyCommitments } from "@/components/MyCommitments";

export const metadata = {
  title: "My drops — Pindrop",
};

export default function CommitmentsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-page px-5 py-14">
        <header className="mb-10">
          <p className="font-script text-2xl text-teal">your group buys</p>
          <h1 className="mt-1 font-serif text-4xl text-foreground">My drops</h1>
          <p className="mt-2 max-w-xl text-muted">
            Every drop you&apos;ve joined. The price keeps falling as more people
            commit — it locks at the lowest tier reached when each drop closes.
          </p>
        </header>
        <MyCommitments />
      </main>
      <SiteFooter />
    </>
  );
}
