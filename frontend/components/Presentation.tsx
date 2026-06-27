"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FiArrowLeft,
  FiArrowRight,
  FiX,
  FiUsers,
  FiShoppingBag,
  FiLayers,
  FiShield,
  FiRefreshCw,
  FiCreditCard,
  FiLock,
  FiEdit3,
} from "react-icons/fi";

/**
 * Pindrop pitch deck. Themed to the site (Fraunces serif, Caveat script, teal + lime)
 * on a soft blue canvas with a white card — but every slide has its OWN layout so the
 * deck doesn't read as one repeated template. Navigate with arrows, arrow keys, Space,
 * or the dots. Esc / Exit returns to the homepage.
 */

// Small shared bits ---------------------------------------------------------

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="mb-6 font-script text-3xl text-teal">{children}</p>;
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-4xl leading-tight text-foreground sm:text-5xl">
      {children}
    </h2>
  );
}

// Per-slide layouts ---------------------------------------------------------

function HeroSlide({ tagline }: { tagline: string }) {
  return (
    <div className="text-center">
      <Kicker>do what makes you save</Kicker>
      <h2 className="font-serif text-7xl font-semibold lowercase tracking-tight text-teal sm:text-8xl">
        pindrop
      </h2>
      <div className="mx-auto mt-7 h-1.5 w-24 rounded-full bg-lime" />
      <p className="mx-auto mt-7 max-w-xl text-xl text-teal/80">{tagline}</p>
    </div>
  );
}

function ProblemSlide() {
  return (
    <div className="text-center">
      <Kicker>the problem</Kicker>
      <Title>Buying alone is a bad deal.</Title>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-soft/60 p-7 text-left">
          <p className="font-serif text-2xl text-foreground/50 line-through decoration-from-font">
            Fixed price
          </p>
          <p className="mt-3 text-lg text-foreground/75">
            Early buyers pay full price and get nothing when more people pile in.
          </p>
        </div>
        <div className="rounded-2xl border border-hairline bg-soft/60 p-7 text-left">
          <p className="font-serif text-2xl text-foreground/50">No reason to share</p>
          <p className="mt-3 text-lg text-foreground/75">
            Nothing rewards you for bringing friends into the deal.
          </p>
        </div>
      </div>
    </div>
  );
}

function IdeaSlide() {
  // A visual descending tier ladder — the lowest tier highlighted in lime.
  const tiers = [
    { at: "1 person", price: "$139" },
    { at: "15 people", price: "$122" },
    { at: "45 people", price: "$109", best: true },
  ];
  return (
    <div className="text-center">
      <Kicker>the idea</Kicker>
      <Title>The more who join, the lower it goes.</Title>
      <div className="mx-auto mt-10 max-w-xl space-y-3">
        {tiers.map((t, idx) => (
          <div
            key={t.at}
            className={`flex items-center justify-between rounded-2xl px-6 py-4 ${
              t.best
                ? "bg-lime text-lime-ink"
                : "bg-soft/70 text-foreground"
            }`}
            style={{ marginLeft: `${idx * 2.5}rem` }}
          >
            <span className="inline-flex items-center gap-2 text-lg">
              <FiUsers aria-hidden /> {t.at}
            </span>
            <span className="font-serif text-3xl font-semibold">{t.price}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-lg text-foreground/75">
        And <span className="font-semibold text-teal">everyone</span> pays the lowest
        tier reached — not the price when they joined.
      </p>
    </div>
  );
}

function ExampleSlide() {
  return (
    <div className="text-center">
      <Kicker>live example</Kicker>
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
        <div className="text-center">
          <p className="font-serif text-7xl font-semibold text-foreground/40 line-through">
            $139
          </p>
          <p className="mt-1 text-sm uppercase tracking-wide text-muted">now</p>
        </div>
        <FiArrowRight className="h-10 w-10 text-teal" aria-hidden />
        <div className="rounded-3xl bg-lime px-10 py-6 text-center text-lime-ink shadow-lg">
          <p className="font-serif text-7xl font-semibold">$122</p>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide">
            +2 people
          </p>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-xl text-xl text-foreground/80">
        Just 2 more commits drops the price <span className="font-semibold text-teal">
        for everyone already in</span> — live, in real time.
      </p>
    </div>
  );
}

function AudienceSlide() {
  return (
    <div className="text-center">
      <Kicker>who it&apos;s for</Kicker>
      <Title>Two sides, one drop.</Title>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-teal p-8 text-left text-white">
          <FiShoppingBag className="h-8 w-8 text-lime" aria-hidden />
          <p className="mt-4 font-serif text-2xl">Shoppers</p>
          <p className="mt-2 text-white/80">
            Everyday goods — electronics, apparel, coffee, home — cheaper the more
            who join.
          </p>
        </div>
        <div className="rounded-2xl border-2 border-teal p-8 text-left">
          <FiUsers className="h-8 w-8 text-teal" aria-hidden />
          <p className="mt-4 font-serif text-2xl text-teal">Sellers</p>
          <p className="mt-2 text-foreground/75">
            Move batch inventory by turning customers into a distribution channel.
          </p>
        </div>
      </div>
      <p className="mt-8 text-sm uppercase tracking-wide text-muted">
        Track 1 — Monetizable B2C app
      </p>
    </div>
  );
}

function DsqlSlide() {
  const points = [
    {
      icon: FiLayers,
      head: "Append-only",
      body: "Each commit is its own row; the live count is a conflict-free aggregate.",
    },
    {
      icon: FiShield,
      head: "One control row",
      body: "A single per-drop row guards the batch cap — no overselling.",
    },
    {
      icon: FiRefreshCw,
      head: "OCC retry",
      body: "Conflicts surface as SQLSTATE 40001 and retry with backoff.",
    },
  ];
  return (
    <div className="text-center">
      <Kicker>the hard part</Kicker>
      <Title>Safe concurrency on Aurora DSQL.</Title>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {points.map((p) => (
          <div
            key={p.head}
            className="rounded-2xl bg-soft/70 p-6 text-left"
          >
            <p.icon className="h-7 w-7 text-teal" aria-hidden />
            <p className="mt-3 font-serif text-xl text-teal">{p.head}</p>
            <p className="mt-2 text-base text-foreground/75">{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsSlide() {
  const steps = [
    {
      icon: FiCreditCard,
      head: "Authorize on commit",
      body: "Stripe holds the card at the current price — manual capture, no charge yet.",
    },
    {
      icon: FiEdit3,
      head: "Edit or leave",
      body: "Change your quantity or drop out before close; the hold adjusts or releases.",
    },
    {
      icon: FiLock,
      head: "Capture at settle",
      body: "When the drop closes, every buyer is captured at the final, lowest tier.",
    },
  ];
  return (
    <div className="text-center">
      <Kicker>real checkout</Kicker>
      <Title>You only pay the price the crowd reached.</Title>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {steps.map((s, i) => (
          <div key={s.head} className="relative rounded-2xl bg-soft/70 p-6 text-left">
            <span className="absolute right-4 top-4 font-serif text-3xl text-hairline">
              {i + 1}
            </span>
            <s.icon className="h-7 w-7 text-teal" aria-hidden />
            <p className="mt-3 font-serif text-xl text-teal">{s.head}</p>
            <p className="mt-2 text-base text-foreground/75">{s.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm uppercase tracking-wide text-muted">
        Stripe (test mode) — authorize now, capture the final lower price
      </p>
    </div>
  );
}

function StackSlide() {
  const layers = [
    { label: "Next.js + React", sub: "Vercel", tone: "lime" },
    { label: "FastAPI + SQLAlchemy", sub: "EC2", tone: "soft" },
    { label: "Amazon Aurora DSQL", sub: "IAM auth", tone: "teal" },
  ];
  return (
    <div className="text-center">
      <Kicker>the stack</Kicker>
      <Title>Vercel × AWS, production-shaped.</Title>
      <div className="mx-auto mt-8 max-w-md space-y-3">
        {layers.map((l) => (
          <div
            key={l.label}
            className={`flex items-center justify-between rounded-2xl px-6 py-5 ${
              l.tone === "teal"
                ? "bg-teal text-white"
                : l.tone === "lime"
                  ? "bg-lime text-lime-ink"
                  : "bg-soft/70 text-foreground"
            }`}
          >
            <span className="font-serif text-xl">{l.label}</span>
            <span className="text-sm uppercase tracking-wide opacity-80">
              {l.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Real-scale stats — not a toy demo */}
      <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-6">
        {[
          { n: "200+", l: "live drops" },
          { n: "115", l: "categories" },
          { n: "real", l: "products + photos" },
        ].map((s) => (
          <div key={s.l}>
            <p className="font-serif text-3xl font-semibold text-teal">{s.n}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CloseSlide() {
  return (
    <div className="text-center">
      <Kicker>thanks</Kicker>
      <h2 className="font-serif text-7xl font-semibold lowercase tracking-tight text-teal sm:text-8xl">
        pindrop
      </h2>
      <div className="mx-auto mt-7 h-1.5 w-24 rounded-full bg-lime" />
      <p className="mt-7 text-xl text-teal/80">
        The price drops as more people join.
      </p>
      <p className="mt-2 font-serif text-lg text-teal">pin-drop-six.vercel.app</p>
    </div>
  );
}

const SLIDES: (() => React.ReactNode)[] = [
  () => (
    <HeroSlide tagline="A drop-pricing group-buy marketplace built on Amazon Aurora DSQL and Vercel." />
  ),
  ProblemSlide,
  IdeaSlide,
  ExampleSlide,
  AudienceSlide,
  DsqlSlide,
  PaymentsSlide,
  StackSlide,
  CloseSlide,
];

export function Presentation() {
  const [i, setI] = useState(0);
  const total = SLIDES.length;

  const next = useCallback(() => setI((n) => Math.min(total - 1, n + 1)), [total]);
  const prev = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        setI(0);
      } else if (e.key === "End") {
        setI(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, total]);

  const Slide = SLIDES[i];

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden text-foreground"
      style={{
        backgroundColor: "#b8ceda",
        backgroundImage:
          "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0) 60%), linear-gradient(180deg, #cdddE7 0%, #b8ceda 55%, #a6c0cf 100%)",
      }}
    >
      {/* Decorative soft blobs for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, #e6ff7d55, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-0 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #08514c44, transparent 70%)" }}
      />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-8 py-6">
        <Link
          href="/"
          aria-label="Exit presentation"
          className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-teal/70 transition-colors hover:text-teal"
        >
          <FiX aria-hidden /> Exit
        </Link>
        <span className="text-sm tabular-nums text-teal/70">
          {i + 1} / {total}
        </span>
      </div>

      {/* Slide body */}
      <div className="relative flex flex-1 items-center justify-center px-6 pb-4">
        <button
          aria-label="Previous slide"
          onClick={prev}
          className="absolute inset-y-0 left-0 z-0 w-1/4 cursor-w-resize"
        />
        <button
          aria-label="Next slide"
          onClick={next}
          className="absolute inset-y-0 right-0 z-0 w-3/4 cursor-e-resize"
        />

        <div
          key={i}
          className="relative z-10 w-full max-w-4xl animate-[fade_0.4s_ease] rounded-3xl bg-background/90 px-10 py-14 shadow-[0_30px_80px_-20px_rgba(8,81,76,0.35)] ring-1 ring-white/60 backdrop-blur-sm sm:px-16 sm:py-16"
        >
          <Slide />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-20 flex items-center justify-between px-8 py-6">
        <div className="flex gap-2">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-8 bg-teal" : "w-2 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-3">
          <button
            onClick={prev}
            disabled={i === 0}
            aria-label="Previous slide"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 text-teal transition-colors hover:bg-white disabled:opacity-30"
          >
            <FiArrowLeft aria-hidden />
          </button>
          <button
            onClick={next}
            disabled={i === total - 1}
            aria-label="Next slide"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-lime-ink shadow-lg transition-transform hover:scale-105 disabled:opacity-30"
          >
            <FiArrowRight aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
