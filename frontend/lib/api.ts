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
  id: number;
  league_code: string;
  league: string;
  match_date: string;
  status: string;
  home_team_id: number;
  home_team: string;
  home_logo?: string | null;
  away_team_id: number;
  away_team: string;
  away_logo?: string | null;
  home_goals: number | null;
  away_goals: number | null;
  result: "H" | "D" | "A" | null;
  source: string;
  last_updated: string;
}

export interface League {
  id: number;
  code: string;
  name: string;
  country: string | null;
  tier: number | null;
  matches: number;
  first_match: string | null;
  last_match: string | null;
}

export interface Team {
  id: number;
  name: string;
  short_name?: string | null;
  country: string | null;
  logo_url: string | null;
}

export interface Player {
  id: number;
  name: string;
  nationality: string | null;
  position: string | null;
  photo_url?: string | null;
}

export interface ModelStatus {
  models_registered: number;
  models_active: number;
  ready_for_predictions: boolean;
  note: string | null;
  models?: Array<{
    name: string;
    version: string;
    trained_at: string;
    is_active: boolean;
    metrics: any;
  }>;
}

export interface LastUpdated {
  matches: string | null;
  standings: string | null;
  player_stats: string | null;
  latest_result_date: string | null;
  last_successful_ingest: string | null;
}

export interface ConvictionInfo {
  tier: "high" | "moderate" | "volatile";
  label: string;
  badge: string;
  recommended_pick: string;
  recommended_market: string;
  double_chance_prob: number;
}

export interface PredictionItem {
  prediction_id: number;
  match_id: number;
  generated_at: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  p_fav_avoids_defeat: number;
  favourite_side: "H" | "A";
  exp_home_goals: number;
  exp_away_goals: number;
  predicted_score: string;
  confidence: number;
  model_version: string;
  match_date: string;
  status: string;
  home_goals: number | null;
  away_goals: number | null;
  result: "H" | "D" | "A" | null;
  league_code: string;
  league_name: string;
  home_team_id: number;
  home_team: string;
  home_logo: string | null;
  away_team_id: number;
  away_team: string;
  away_logo: string | null;
  disclaimer: string;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  conviction?: ConvictionInfo;
}

export interface MatchPredictionDetail {
  match_id: number;
  match_date: string;
  kickoff_utc: string | null;
  league_code: string;
  league_name: string;
  home_team: string;
  home_logo: string | null;
  away_team: string;
  away_logo: string | null;
  model_version: string;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  most_likely_outcome: "H" | "D" | "A";
  confidence: number;
  bookmaker_favourite: "home" | "away";
  favourite_avoids_defeat_prob: number;
  conviction?: ConvictionInfo;
  predicted_goals: {
    home: number;
    away: number;
    label: string;
  };
  predicted_score: string;
  top_scorelines: Array<{ score: string; probability: number }>;
  odds_estimated: boolean;
  explanation: string;
  h2h?: {
    total: number;
    home_wins: number;
    draws: number;
    away_wins: number;
    past_matches: Array<{
      id: number;
      match_date: string;
      home_team: string;
      home_logo: string | null;
      away_team: string;
      away_logo: string | null;
      home_goals: number;
      away_goals: number;
      result: string;
    }>;
  };
  disclaimer: string;
}

export interface PlayerRanking {
  rank: number;
  player_id: number;
  player_name: string;
  nationality: string | null;
  position: string | null;
  photo_url: string | null;
  team_id: number | null;
  team_name: string | null;
  team_logo: string | null;
  league_code?: string;
  league_name: string;
  season: string;
  appearances: number;
  minutes: number | null;
  goals: number;
  assists: number | null;
  total_contributions?: number;
  minutes_per_goal?: number | null;
  composite_rating?: number;
}

export interface AnalyticsDashboardData {
  league: { id: number; code: string; name: string; country: string } | null;
  season: string;
  kpis: {
    matches_played: number;
    total_goals: number;
    goals_per_match: number;
    avg_home_goals?: number;
    avg_away_goals?: number;
    home_win_pct: number;
    draw_pct: number;
    away_win_pct: number;
    over_2_5_pct: number;
    clean_sheet_pct?: number;
  };
  standings: Array<{
    position: number;
    team_id: number;
    team: string;
    logo_url: string | null;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    points_per_match: number;
    form: string | null;
    home_played?: number;
    home_won?: number;
    home_drawn?: number;
    home_lost?: number;
    home_gf?: number;
    home_ga?: number;
    home_points?: number;
    home_gd?: number;
    away_played?: number;
    away_won?: number;
    away_drawn?: number;
    away_lost?: number;
    away_gf?: number;
    away_ga?: number;
    away_points?: number;
    away_gd?: number;
    form_points?: number;
  }>;
  team_performance: Array<{
    team: string;
    logo_url?: string | null;
    home_played: number;
    home_won: number;
    home_drawn: number;
    home_lost: number;
    home_gf: number;
    home_ga: number;
    away_played: number;
    away_won: number;
    away_drawn: number;
    away_lost: number;
    away_gf: number;
    away_ga: number;
    home_win_rate: number;
    away_win_rate: number;
  }>;
  top_scorers: Array<{
    player_name: string;
    team: string;
    team_logo: string | null;
    appearances: number;
    goals: number;
    assists: number | null;
    mins_per_goal: number | null;
  }>;
}
