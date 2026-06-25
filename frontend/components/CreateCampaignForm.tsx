"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiPlus, FiTrash2, FiArrowRight } from "react-icons/fi";
import { createCampaign, ApiError } from "@/lib/api";
import { getDemoSellerId } from "@/lib/format";

interface TierRow {
  min_quantity: string;
  unit_price: string;
}

const inputCls =
  "w-full rounded-lg border border-hairline bg-white px-3.5 py-2.5 text-foreground outline-none focus:border-teal";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

const CATEGORIES = [
  "Electronics",
  "Home",
  "Apparel",
  "Coffee",
  "Toys",
  "Beauty",
  "Sports",
  "Other",
];

export function CreateCampaignForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [batchCap, setBatchCap] = useState("100");
  const [closesAt, setClosesAt] = useState("");
  const [tiers, setTiers] = useState<TierRow[]>([
    { min_quantity: "1", unit_price: "" },
    { min_quantity: "10", unit_price: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTier(i: number, key: keyof TierRow, value: string) {
    setTiers((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)),
    );
  }
  function addTier() {
    setTiers((rows) => [...rows, { min_quantity: "", unit_price: "" }]);
  }
  function removeTier(i: number) {
    setTiers((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedTiers = tiers
      .map((t) => ({
        min_quantity: parseInt(t.min_quantity, 10),
        unit_price: parseFloat(t.unit_price),
      }))
      .filter((t) => !Number.isNaN(t.min_quantity) && !Number.isNaN(t.unit_price))
      .sort((a, b) => a.min_quantity - b.min_quantity);

    if (parsedTiers.length === 0) {
      setError("Add at least one price tier with a quantity and price.");
      return;
    }
    if (parsedTiers[0].min_quantity !== 1) {
      setError("The first tier must unlock at quantity 1 (the floor price).");
      return;
    }
    if (!closesAt) {
      setError("Pick a close date and time.");
      return;
    }

    setSubmitting(true);
    try {
      const campaign = await createCampaign({
        seller_id: getDemoSellerId(),
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        category,
        batch_cap: parseInt(batchCap, 10),
        opens_at: new Date().toISOString(),
        closes_at: new Date(closesAt).toISOString(),
        tiers: parsedTiers,
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not create the drop. Is the backend running?",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="grid gap-5">
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ethiopia Yirgacheffe Natural — Batch #47"
            required
          />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            className={`${inputCls} min-h-24 resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Single-origin natural process. 60kg batch roasted to order…"
          />
        </div>

        <div>
          <label className={labelCls}>Image URL</label>
          <input
            className={inputCls}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Batch cap (units)</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={batchCap}
              onChange={(e) => setBatchCap(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Closes at</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Price tiers */}
      <div className="mt-10">
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal">
          Price tiers
        </p>
        <p className="mb-4 text-sm text-muted">
          The price falls as the committed count crosses each threshold. The first
          tier (qty 1) is the starting price.
        </p>

        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium uppercase tracking-wide text-muted">
            <span>Unlocks at qty</span>
            <span>Price ($)</span>
            <span className="w-9" />
          </div>
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={t.min_quantity}
                onChange={(e) => updateTier(i, "min_quantity", e.target.value)}
                placeholder="10"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputCls}
                value={t.unit_price}
                onChange={(e) => updateTier(i, "unit_price", e.target.value)}
                placeholder="42.00"
              />
              <button
                type="button"
                onClick={() => removeTier(i)}
                disabled={tiers.length <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-foreground disabled:opacity-30"
                aria-label="Remove tier"
              >
                <FiTrash2 aria-hidden />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addTier}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teal hover:underline"
        >
          <FiPlus aria-hidden />
          Add tier
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-7 py-3.5 text-base font-semibold text-lime-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
      >
        {submitting ? "Launching…" : "Launch drop"}
        {!submitting && <FiArrowRight aria-hidden />}
      </button>
    </form>
  );
}
