import Link from "next/link";
import {
  api,
  type AnalyticsDashboardData,
  type Match,
  type PredictionItem,
} from "@/lib/api";
import DashboardView from "@/components/DashboardView";

type Summary = {
  matches: number;
  goals: number;
  goals_per_match: string;
  leagues: number;
  latest_result_date: string | null;
};

const SUPPORTED_LEAGUES = [
  { code: "E0", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "SP1", label: "La Liga", flag: "🇪🇸" },
  { code: "D1", label: "Bundesliga", flag: "🇩🇪" },
  { code: "I1", label: "Serie A", flag: "🇮🇹" },
  { code: "F1", label: "Ligue 1", flag: "🇫🇷" },
  { code: "E1", label: "Championship", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "N1", label: "Eredivisie", flag: "🇳🇱" },
  { code: "P1", label: "Primeira Liga", flag: "🇵🇹" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string; season?: string; tab?: string; tier?: string }>;
}) {
  const params = await searchParams;
  const currentCode = params?.league ?? "E0";
  const currentSeason = params?.season;
  const initialTab = params?.tab ?? "analytics";
  const initialTier = params?.tier ?? "all";

  // Concurrent fetch of platform metrics (cached with 30s revalidation for sub-10ms loads)
  const [sumRes, recentRes, fixturesRes, predsRes, analyticsRes] = await Promise.all([
    api<Summary>("/api/stats/summary", 60),
    api<Match[]>("/api/results?limit=12", 30),
    api<Match[]>("/api/fixtures?limit=12", 30),
    api<PredictionItem[]>("/api/predictions?limit=30", 30),
    api<AnalyticsDashboardData>(
      `/api/analytics/dashboard?league=${currentCode}${
        currentSeason ? `&season=${encodeURIComponent(currentSeason)}` : ""
      }`,
      30
    ),
  ]);

  const sum = sumRes.ok ? sumRes.data : null;
  const recent = recentRes.ok ? recentRes.data : [];
  const fixtures = fixturesRes.ok ? fixturesRes.data : [];
  const predictions = predsRes.ok ? predsRes.data : [];
  const analytics = analyticsRes.ok ? analyticsRes.data : null;

  const k = analytics?.kpis ?? {
    matches_played: 0,
    total_goals: 0,
    goals_per_match: 0,
    home_win_pct: 0,
    draw_pct: 0,
    away_win_pct: 0,
    over_2_5_pct: 0,
  };
  const leagueName = analytics?.league?.name ?? "Premier League";

  return (
    <div className="space-y-6 pb-12">
      {/* Clean Top Header & League Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-ink">
              Pitchside<span className="text-pos">IQ</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Live league tables, home/away records, and AI match probability forecasts.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 text-xs">
            <div className="rounded-lg bg-panel border border-line px-3 py-1.5">
              <span className="text-muted">Matches: </span>
              <strong className="text-ink font-mono">{sum ? sum.matches : k.matches_played}</strong>
            </div>
            <div className="rounded-lg bg-panel border border-line px-3 py-1.5">
              <span className="text-muted">Goals / Game: </span>
              <strong className="text-pos font-mono">{sum ? sum.goals_per_match : k.goals_per_match}</strong>
            </div>
          </div>
        </div>

        {/* League Selector Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {SUPPORTED_LEAGUES.map((l) => {
            const isActive = l.code === currentCode;
            return (
              <Link
                key={l.code}
                href={`/?tab=${initialTab}&league=${l.code}`}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-pos text-bg shadow-xs"
                    : "bg-panel border border-line text-muted hover:border-line/80 hover:text-ink"
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Interactive Instant Dashboard View (0ms tab switching & instant client filtering) */}
      <DashboardView
        leagueName={leagueName}
        currentCode={currentCode}
        k={k}
        standings={analytics?.standings ?? []}
        topScorers={analytics?.top_scorers ?? []}
        predictions={predictions}
        recent={recent}
        fixtures={fixtures}
        initialTab={initialTab}
        initialTier={initialTier}
      />
    </div>
  );
}
