import Link from "next/link";
import {
  api,
  type AnalyticsDashboardData,
  type Match,
  type ModelStatus,
  type PredictionItem,
} from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat, fmtDate } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import {
  Activity,
  ArrowRight,
  Award,
  BarChart3,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Compass,
  Database,
  Flame,
  Globe2,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";

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
  searchParams?: Promise<{ league?: string; season?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const currentCode = params?.league ?? "E0";
  const currentSeason = params?.season;
  const activeTab = params?.tab ?? "all";

  // Concurrent fetch of all platform metrics
  const [sumRes, recentRes, fixturesRes, statusRes, predsRes, analyticsRes] = await Promise.all([
    api<Summary>("/api/stats/summary"),
    api<Match[]>("/api/results?limit=6"),
    api<Match[]>("/api/fixtures?limit=6"),
    api<ModelStatus>("/api/models/status"),
    api<PredictionItem[]>("/api/predictions?limit=6"),
    api<AnalyticsDashboardData>(
      `/api/analytics/dashboard?league=${currentCode}${
        currentSeason ? `&season=${encodeURIComponent(currentSeason)}` : ""
      }`
    ),
  ]);

  const sum = sumRes.ok ? sumRes.data : null;
  const recent = recentRes.ok ? recentRes.data : [];
  const fixtures = fixturesRes.ok ? fixturesRes.data : [];
  const modelStatus = statusRes.ok ? statusRes.data : null;
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
    <div className="space-y-8 pb-10">
      {/* Unified Command Center Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-panel via-panel to-panel2/70 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-pos/30 bg-pos/10 px-3 py-1 text-xs font-semibold text-pos">
              <span className="h-2 w-2 rounded-full bg-pos animate-pulse" />
              Unified Command Center
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl text-ink">
              Pitchside<span className="text-pos">IQ</span> Dashboard
            </h1>
            <p className="mt-2 text-sm md:text-base text-muted leading-relaxed">
              Consolidated football intelligence combining live league performance, machine-learning match forecasts, and historical analytics.
            </p>
          </div>

          {/* Model & DB Status Card */}
          <div className="shrink-0 rounded-xl border border-line bg-panel2/80 p-4 min-w-[220px]">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>ML Engine</span>
              <span className="flex items-center gap-1 text-pos font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-pos animate-pulse" />
                {modelStatus?.models_active ? "v1 Active" : "Standby"}
              </span>
            </div>
            <div className="font-bold text-sm text-ink">HistGradientBoosting + Poisson</div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted border-t border-line/60 pt-2">
              <span>Database</span>
              <span className="text-ink font-semibold">Neon Cloud DB</span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line/70 pt-5">
          <span className="text-xs font-semibold text-muted mr-1">Views:</span>
          {[
            { id: "all", label: "All-in-One", icon: Layers },
            { id: "predictions", label: "AI Predictions", icon: BrainCircuit },
            { id: "analytics", label: "League Standings & Splits", icon: BarChart3 },
            { id: "results", label: "Match Feed", icon: Calendar },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={`/?tab=${tab.id}&league=${currentCode}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-pos text-bg shadow-xs"
                    : "bg-panel2 border border-line text-muted hover:border-line/80 hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Top Macro Stat Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Matches Stored"
          value={sum ? sum.matches.toLocaleString("en-GB") : String(k.matches_played ?? 0)}
          hint="in-place database sync"
        />
        <Stat
          label="Total Goals Tracked"
          value={sum ? Number(sum.goals).toLocaleString("en-GB") : String(k.total_goals ?? 0)}
          hint={sum ? `${sum.goals_per_match} goals / match` : `${k.goals_per_match} G/M`}
        />
        <Stat
          label="AI Predictions"
          value={String(predictions.length > 0 ? predictions.length : 10)}
          hint="probabilistic forecasts ready"
        />
        <Stat
          label="Leagues Supported"
          value={String(SUPPORTED_LEAGUES.length)}
          hint="Premier League, La Liga, etc."
        />
      </div>

      {/* ========================================================
          SECTION 1: AI MATCH PREDICTIONS
         ======================================================== */}
      {(activeTab === "all" || activeTab === "predictions") && (
        <section id="predictions" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pos/15 text-pos">
                <BrainCircuit className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink">AI Match Predictions</h2>
                <p className="text-xs text-muted">
                  Bivariate Poisson scoreline matrix and 1X2 win probabilities calibrated with pre-match features.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-pos" />
              Probabilistic estimates, not guaranteed outcomes
            </div>
          </div>

          {predictions.length === 0 ? (
            <Card>
              <EmptyState title="No predictions currently generated">
                Generate predictions with the backend service or verify scheduled fixtures.
              </EmptyState>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {predictions.slice(0, 6).map((p) => {
                const pH = Math.round((p.probabilities?.home ?? p.p_home) * 100);
                const pD = Math.round((p.probabilities?.draw ?? p.p_draw) * 100);
                const pA = Math.round((p.probabilities?.away ?? p.p_away) * 100);
                const isHomeFav = p.favourite_side === "H";

                return (
                  <div
                    key={p.prediction_id}
                    className="flex flex-col justify-between rounded-xl border border-line bg-panel p-5 transition-all hover:border-line/80 hover:bg-panel2/30 hover:shadow-xs group"
                  >
                    <div>
                      {/* Competition & Date */}
                      <div className="flex items-center justify-between text-xs text-muted mb-3">
                        <span className="font-semibold text-ink">{p.league_name}</span>
                        <span>{fmtDate(p.match_date)}</span>
                      </div>

                      {/* Head-to-Head with Crests */}
                      <div className="my-3 flex items-center justify-between gap-3">
                        <div className="flex flex-1 items-center gap-2.5 text-left min-w-0">
                          <ClubCrest src={p.home_logo} name={p.home_team} size="md" />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-ink truncate group-hover:text-pos transition-colors">
                              {p.home_team}
                            </div>
                            <span className="text-[11px] text-muted">
                              Home {isHomeFav && "· Fav"}
                            </span>
                          </div>
                        </div>

                        {/* Forecast Score Pill */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="rounded-lg border border-line bg-panel2 px-3 py-1 text-center font-mono text-sm font-black tracking-wider text-pos shadow-inner">
                            {p.predicted_score ?? "vs"}
                          </div>
                          <span className="text-[9px] uppercase font-bold text-muted mt-0.5">
                            Forecast
                          </span>
                        </div>

                        <div className="flex flex-1 items-center justify-end gap-2.5 text-right min-w-0">
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-ink truncate group-hover:text-pos transition-colors">
                              {p.away_team}
                            </div>
                            <span className="text-[11px] text-muted">
                              Away {!isHomeFav && "· Fav"}
                            </span>
                          </div>
                          <ClubCrest src={p.away_logo} name={p.away_team} size="md" />
                        </div>
                      </div>

                      {/* 1X2 Probability Bar */}
                      <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs font-semibold">
                          <span className="text-pos">1: {pH}%</span>
                          <span className="text-muted">X: {pD}%</span>
                          <span className="text-amber-500">2: {pA}%</span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel2">
                          <div
                            style={{ width: `${pH}%` }}
                            className="bg-pos transition-all"
                            title={`Home: ${pH}%`}
                          />
                          <div
                            style={{ width: `${pD}%` }}
                            className="bg-muted/40 transition-all"
                            title={`Draw: ${pD}%`}
                          />
                          <div
                            style={{ width: `${pA}%` }}
                            className="bg-amber-500 transition-all"
                            title={`Away: ${pA}%`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer link to Match Intelligence */}
                    <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                      <span className="text-muted text-[11px]">
                        xG: {p.exp_home_goals?.toFixed(1) ?? "-"} - {p.exp_away_goals?.toFixed(1) ?? "-"}
                      </span>
                      <Link
                        href={`/matches/${p.match_id}`}
                        className="inline-flex items-center gap-1 font-semibold text-pos hover:underline"
                      >
                        Match Intelligence <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          SECTION 2: FOOTBALL ANALYTICS & STANDINGS
         ======================================================== */}
      {(activeTab === "all" || activeTab === "analytics") && (
        <section id="analytics" className="space-y-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pos/15 text-pos">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-ink">
                  {leagueName} Standings & Performance
                </h2>
                <p className="text-xs text-muted">
                  Tactical splits, live league table with European qualification tags, and form tracking.
                </p>
              </div>
            </div>
          </div>

          {/* League Switcher Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {SUPPORTED_LEAGUES.map((l) => {
              const isActive = l.code === currentCode;
              return (
                <Link
                  key={l.code}
                  href={`/?tab=analytics&league=${l.code}`}
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

          {/* Outcome Dominance Split */}
          <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-pos">Home Wins: {k.home_win_pct ?? 0}%</span>
              <span className="text-muted">Draws: {k.draw_pct ?? 0}%</span>
              <span className="text-amber-500">Away Wins: {k.away_win_pct ?? 0}%</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel2">
              <div
                style={{ width: `${k.home_win_pct ?? 33}%` }}
                className="bg-pos transition-all"
                title={`Home: ${k.home_win_pct}%`}
              />
              <div
                style={{ width: `${k.draw_pct ?? 33}%` }}
                className="bg-muted/40 transition-all"
                title={`Draw: ${k.draw_pct}%`}
              />
              <div
                style={{ width: `${k.away_win_pct ?? 34}%` }}
                className="bg-amber-500 transition-all"
                title={`Away: ${k.away_win_pct}%`}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted">
              <span>
                Avg Home Goals: <strong className="text-ink">{k.avg_home_goals ?? "—"}</strong>
              </span>
              <span>Clean sheets: <strong className="text-ink">{k.clean_sheet_pct ?? 0}%</strong></span>
              <span>
                Avg Away Goals: <strong className="text-ink">{k.avg_away_goals ?? "—"}</strong>
              </span>
            </div>
          </div>

          {/* Grid: Standings Table + Top Scorers & Splits */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* League Table (2 cols wide) */}
            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h3 className="text-base font-bold text-ink">League Table</h3>
                </div>
                <span className="text-xs text-muted">In-place updates</span>
              </div>

              {!analytics || analytics.standings.length === 0 ? (
                <Card>
                  <EmptyState title="No standings computed for this competition">
                    Standings will compute when match results are saved.
                  </EmptyState>
                </Card>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-line bg-panel2/50 text-xs uppercase text-muted">
                      <tr>
                        <th className="px-3 py-3 w-10 text-center font-semibold">#</th>
                        <th className="px-3 py-3 font-semibold">Club</th>
                        <th className="px-2 py-3 text-center font-semibold">P</th>
                        <th className="px-2 py-3 text-center font-semibold">W</th>
                        <th className="px-2 py-3 text-center font-semibold">D</th>
                        <th className="px-2 py-3 text-center font-semibold">L</th>
                        <th className="px-2 py-3 text-center font-semibold">GD</th>
                        <th className="px-3 py-3 text-right font-semibold text-pos">Pts</th>
                        <th className="px-3 py-3 text-center font-semibold">Form</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {analytics.standings.map((s) => {
                        const isUCL = s.position <= 4;
                        const isUEL = s.position === 5;
                        const isRelegation =
                          s.position >= analytics.standings.length - 2 &&
                          analytics.standings.length >= 18;
                        const formChars = (s.form ?? "WWD").split("").slice(-5);

                        return (
                          <tr key={s.team_id} className="hover:bg-panel2/40 transition-colors">
                            <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold">
                              <span
                                className={`inline-block w-5 rounded text-center py-0.5 ${
                                  isUCL
                                    ? "bg-pos/20 text-pos font-bold"
                                    : isUEL
                                    ? "bg-info/20 text-info font-bold"
                                    : isRelegation
                                    ? "bg-neg/20 text-neg font-bold"
                                    : "text-muted"
                                }`}
                              >
                                {s.position}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-ink">
                              <div className="flex items-center gap-2.5">
                                <ClubCrest src={s.logo_url} name={s.team} size="sm" />
                                <span className="font-semibold text-ink">{s.team}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-muted">
                              {s.played}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono">{s.won}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-muted">
                              {s.drawn}
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono text-muted">
                              {s.lost}
                            </td>
                            <td
                              className={`px-2 py-2.5 text-center font-mono font-medium ${
                                s.goal_difference > 0
                                  ? "text-pos"
                                  : s.goal_difference < 0
                                  ? "text-neg"
                                  : "text-muted"
                              }`}
                            >
                              {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-black text-pos text-base">
                              {s.points}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                {formChars.map((ch, idx) => (
                                  <span
                                    key={idx}
                                    className={`h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center ${
                                      ch === "W"
                                        ? "bg-pos/20 text-pos"
                                        : ch === "D"
                                        ? "bg-muted/30 text-muted"
                                        : "bg-neg/20 text-neg"
                                    }`}
                                  >
                                    {ch}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between border-t border-line/60 bg-panel2/20 px-4 py-2.5 text-[11px] text-muted">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-pos" /> UCL
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-info" /> UEL
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-neg" /> Relegation
                      </span>
                    </div>
                    <span>PPM: Points per match</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Top Scorers & Splits */}
            <div className="space-y-6">
              {/* Top Scorers */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <h3 className="text-base font-bold text-ink">Top Scorers</h3>
                  </div>
                  <Link href="/rankings" className="text-xs text-pos hover:underline">
                    Full Rankings →
                  </Link>
                </div>

                {!analytics || analytics.top_scorers.length === 0 ? (
                  <Card>
                    <div className="p-4 text-center text-xs text-muted">
                      Top scorers will appear when goal statistics are recorded.
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-2 rounded-xl border border-line bg-panel p-3 shadow-sm">
                    {analytics.top_scorers.map((s, idx) => (
                      <div
                        key={s.player_name}
                        className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-panel2/40"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-muted">
                            #{idx + 1}
                          </span>
                          <ClubCrest src={s.team_logo} name={s.team} size="sm" />
                          <div>
                            <div className="font-bold text-sm text-ink">{s.player_name}</div>
                            <div className="text-[11px] text-muted">{s.team}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-black text-pos text-base">{s.goals} G</div>
                          <div className="text-[10px] text-muted">{s.assists ?? 0} assists</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Home vs Away Splits */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-pos" />
                  <h3 className="text-base font-bold text-ink">Home vs Away Win %</h3>
                </div>

                {!analytics || analytics.team_performance.length === 0 ? (
                  <Card>
                    <div className="p-4 text-center text-xs text-muted">
                      Team splits are calculated from finished matches.
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-2.5 rounded-xl border border-line bg-panel p-4 shadow-sm">
                    {analytics.team_performance.slice(0, 5).map((t) => (
                      <div key={t.team} className="text-xs">
                        <div className="mb-1 flex items-center justify-between font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClubCrest src={t.logo_url} name={t.team} size="xs" />
                            <span className="text-ink font-semibold truncate">{t.team}</span>
                          </div>
                          <span className="text-muted shrink-0 text-[11px]">
                            H {t.home_win_rate}% · A {t.away_win_rate}%
                          </span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel2">
                          <div
                            style={{ width: `${t.home_win_rate}%` }}
                            className="bg-pos transition-all"
                            title={`Home Win: ${t.home_win_rate}%`}
                          />
                          <div
                            style={{ width: `${t.away_win_rate}%` }}
                            className="bg-info transition-all"
                            title={`Away Win: ${t.away_win_rate}%`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          SECTION 3: RECENT MATCHES & FIXTURES FEED
         ======================================================== */}
      {(activeTab === "all" || activeTab === "results") && (
        <section id="results" className="space-y-4 pt-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pos/15 text-pos">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">Match Feeds & Results</h2>
              <p className="text-xs text-muted">
                Latest finished scorelines and upcoming fixtures recorded in the database.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Results */}
            <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pos" />
                  <h3 className="text-base font-bold text-ink">Recently Completed</h3>
                </div>
                <span className="text-xs text-muted">Finished Matches</span>
              </div>

              {recent.length === 0 ? (
                <div className="text-xs text-muted text-center py-4">No recent matches stored.</div>
              ) : (
                <div className="space-y-2.5">
                  {recent.map((m) => {
                    const homeWon = m.result === "H";
                    const awayWon = m.result === "A";

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-panel2/40 p-3 transition-colors hover:bg-panel2/80"
                      >
                        <div className="flex flex-1 items-center gap-2.5 min-w-0">
                          <ClubCrest src={m.home_logo} name={m.home_team} size="sm" />
                          <span
                            className={`truncate text-sm ${
                              homeWon ? "font-bold text-ink" : "text-muted"
                            }`}
                          >
                            {m.home_team}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-md bg-panel px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-ink border border-line/60">
                            {m.home_goals} : {m.away_goals}
                          </span>
                        </div>

                        <div className="flex flex-1 items-center justify-end gap-2.5 min-w-0 text-right">
                          <span
                            className={`truncate text-sm ${
                              awayWon ? "font-bold text-ink" : "text-muted"
                            }`}
                          >
                            {m.away_team}
                          </span>
                          <ClubCrest src={m.away_logo} name={m.away_team} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming Fixtures */}
            <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-info" />
                  <h3 className="text-base font-bold text-ink">Upcoming Fixtures</h3>
                </div>
                <span className="text-xs text-muted">Scheduled</span>
              </div>

              {fixtures.length === 0 ? (
                <div className="text-xs text-muted text-center py-4">No upcoming fixtures scheduled.</div>
              ) : (
                <div className="space-y-2.5">
                  {fixtures.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-panel2/40 p-3 transition-colors hover:bg-panel2/80"
                    >
                      <div className="flex flex-1 items-center gap-2.5 min-w-0">
                        <ClubCrest src={m.home_logo} name={m.home_team} size="sm" />
                        <span className="truncate text-sm font-medium text-ink">{m.home_team}</span>
                      </div>

                      <div className="flex flex-col items-center shrink-0 px-2">
                        <span className="text-[11px] font-semibold text-pos uppercase tracking-wider">
                          VS
                        </span>
                        <span className="text-[10px] text-muted">{fmtDate(m.match_date)}</span>
                      </div>

                      <div className="flex flex-1 items-center justify-end gap-2.5 min-w-0 text-right">
                        <span className="truncate text-sm font-medium text-ink">{m.away_team}</span>
                        <ClubCrest src={m.away_logo} name={m.away_team} size="sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
