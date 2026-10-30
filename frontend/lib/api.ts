export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Server-side fetch that never throws: pages render an error state instead of crashing. */
export async function api<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `API returned ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, error: "Cannot reach the API. Is the backend running?" };
  }
}

export interface Match {
  id: number; league_code: string; league: string; match_date: string; status: string;
  home_team_id: number; home_team: string; away_team_id: number; away_team: string;
  home_goals: number | null; away_goals: number | null; result: "H" | "D" | "A" | null;
  source: string; last_updated: string;
}
export interface League { id: number; code: string; name: string; country: string | null; tier: number | null;
  matches: number; first_match: string | null; last_match: string | null; }
export interface Team { id: number; name: string; country: string | null; logo_url: string | null; }
export interface Player { id: number; name: string; nationality: string | null; position: string | null; }
export interface ModelStatus { models_registered: number; models_active: number; ready_for_predictions: boolean; note: string | null; }
export interface LastUpdated { matches: string | null; standings: string | null; player_stats: string | null;
  latest_result_date: string | null; last_successful_ingest: string | null; }
