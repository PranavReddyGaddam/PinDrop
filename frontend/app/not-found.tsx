import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-page flex-1 flex-col items-start px-5 py-24">
        <p className="font-script text-3xl text-teal">nothing here</p>
        <h1 className="mt-2 font-serif text-5xl text-foreground">
          This drop has vanished.
        </h1>
        <p className="mt-4 max-w-md text-foreground/70">
          The campaign may have closed or never existed. Browse the live drops
          instead.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-base font-medium text-teal hover:underline"
        >
          <FiArrowLeft aria-hidden />
          Back to drops
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
