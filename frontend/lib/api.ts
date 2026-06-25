/**
 * API client + types for the Pindrop FastAPI backend.
 * Shapes mirror backend/app/schemas.py (snake_case from FastAPI).
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export interface Campaign {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string;
  batch_cap: number;
  opens_at: string;
  closes_at: string;
  status: string;
}

export interface Tier {
  min_quantity: number;
  unit_price: number;
}

export interface CampaignStats {
  campaign: Campaign;
  current_count: number;
  current_price: number;
  next_tier_price: number | null;
  next_tier_at: number | null;
  seconds_remaining: number;
  reserved_count: number;
  tiers: Tier[];
}

export interface CampaignSummary {
  campaign: Campaign;
  current_count: number;
  current_price: number;
  floor_price: number;
  seconds_remaining: number;
}

export interface CommitResult {
  success: boolean;
  authorized_unit_price: number;
  payment_intent_id: string | null;
}

export interface SettleResult {
  success: boolean;
  final_price: number;
  settled: number;
}

export interface PreviousDrop {
  campaign_id: string;
  final_price: number;
  floor_price: number;
  committed: number;
  closed_at: string;
}

export interface MyCommitment {
  commitment_id: string;
  campaign: Campaign;
  quantity: number;
  committed_at: string;
  current_price: number;
  current_count: number;
  seconds_remaining: number;
  settled: boolean;
}

export interface CreateCampaignBody {
  seller_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  category: string;
  batch_cap: number;
  opens_at: string;
  closes_at: string;
  tiers: { min_quantity: number; unit_price: number }[];
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function getCampaigns(
  category?: string,
): Promise<CampaignSummary[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return handle(
    await fetch(`${API_BASE}/api/campaigns${qs}`, { cache: "no-store" }),
  );
}

export async function getCategories(): Promise<string[]> {
  return handle(
    await fetch(`${API_BASE}/api/categories`, { cache: "no-store" }),
  );
}

export async function createCampaign(
  body: CreateCampaignBody,
): Promise<Campaign> {
  return handle(
    await fetch(`${API_BASE}/api/campaigns`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function getCampaignStats(id: string): Promise<CampaignStats> {
  return handle(
    await fetch(`${API_BASE}/api/campaigns/${id}`, { cache: "no-store" }),
  );
}

export async function commit(
  id: string,
  body: { user_id: string; quantity?: number },
): Promise<CommitResult> {
  return handle(
    await fetch(`${API_BASE}/api/campaigns/${id}/commit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function settle(id: string): Promise<SettleResult> {
  return handle(
    await fetch(`${API_BASE}/api/campaigns/${id}/settle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    }),
  );
}

export async function getCampaignHistory(
  id: string,
): Promise<PreviousDrop[]> {
  return handle(
    await fetch(`${API_BASE}/api/campaigns/${id}/history`, {
      cache: "no-store",
    }),
  );
}

export async function getMyCommitments(
  userId: string,
): Promise<MyCommitment[]> {
  return handle(
    await fetch(`${API_BASE}/api/users/${userId}/commitments`, {
      cache: "no-store",
    }),
  );
}
