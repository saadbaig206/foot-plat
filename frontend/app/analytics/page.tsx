import Link from "next/link";
import { api, type AnalyticsDashboardData, type League } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat } from "@/components/ui";
import { Activity, Award, BarChart3, ChevronRight, Flame, Globe2, ShieldCheck, TrendingUp, Trophy } from "lucide-react";

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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string; season?: string }>;
}) {
  const params = await searchParams;
  const currentCode = params?.league ?? "E0";
  const currentSeason = params?.season;

  const queryPath = `/api/analytics/dashboard?league=${currentCode}${currentSeason ? `&season=${encodeURIComponent(currentSeason)}` : ""}`;
  const res = await api<AnalyticsDashboardData>(queryPath);

  if (!res.ok) {
    return (
      <>
        <PageHeader title="Football Analytics" subtitle="Comprehensive performance metrics and tactical breakdowns." />
        <ErrorState message={res.error} />
      </>
    );
  }

  const d = res.data;
  const k = d.kpis;
  const leagueName = d.league?.name ?? "Premier League";

  return (
    <>
      <PageHeader
        title="Football Analytics"
        subtitle={`Live performance intelligence, tactical splits, and standings for ${leagueName} (${d.season}).`}
      />

      {/* League Selection Pills */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {SUPPORTED_LEAGUES.map((l) => {
          const isActive = l.code === currentCode;
          return (
            <Link
              key={l.code}
              href={`/analytics?league=${l.code}`}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-pos text-bg font-semibold"
                  : "bg-panel border border-line text-muted hover:border-line/80 hover:text-ink"
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Macro KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Matches Tracked"
          value={String(k.matches_played ?? 0)}
          hint={`Season: ${d.season}`}
        />
        <Stat
          label="Scoring Average"
          value={k.goals_per_match ? `${k.goals_per_match} G/M` : "—"}
          hint={`${k.total_goals ?? 0} total goals scored`}
        />
        <Stat
          label="Home Win Advantage"
          value={k.home_win_pct ? `${k.home_win_pct}%` : "—"}
          hint={`vs ${k.away_win_pct ?? 0}% away wins`}
        />
        <Stat
          label="Over 2.5 Goals Rate"
          value={k.over_2_5_pct ? `${k.over_2_5_pct}%` : "—"}
          hint={`Clean sheets: ${k.clean_sheet_pct ?? 0}%`}
        />
      </div>

      {/* Outcome Distribution Bar */}
      <div className="mt-6 rounded-lg border border-line bg-panel p-5">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <span className="text-pos font-semibold">Home Wins: {k.home_win_pct ?? 0}%</span>
          <span className="text-muted">Draws: {k.draw_pct ?? 0}%</span>
          <span className="text-amber-500 font-semibold">Away Wins: {k.away_win_pct ?? 0}%</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel2">
          <div style={{ width: `${k.home_win_pct ?? 33}%` }} className="bg-pos transition-all" title={`Home Wins: ${k.home_win_pct}%`} />
          <div style={{ width: `${k.draw_pct ?? 33}%` }} className="bg-muted/40 transition-all" title={`Draws: ${k.draw_pct}%`} />
          <div style={{ width: `${k.away_win_pct ?? 34}%` }} className="bg-amber-500 transition-all" title={`Away Wins: ${k.away_win_pct}%`} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>Avg Home Goals: <strong className="text-ink">{k.avg_home_goals ?? "—"}</strong></span>
          <span>Goal Dominance Split</span>
          <span>Avg Away Goals: <strong className="text-ink">{k.avg_away_goals ?? "—"}</strong></span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* League Table & Form Guide (2 columns wide) */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-pos" />
              <h2 className="text-lg font-semibold tracking-tight">{leagueName} Standings</h2>
            </div>
            <span className="text-xs text-muted">Updated live in place</span>
          </div>

          {d.standings.length === 0 ? (
            <Card>
              <EmptyState title="No standings computed for this competition">
                Run <code className="text-ink">python -m scripts.compute_standings</code> or ingest fixtures with <code className="text-ink">python -m scripts.ingest_feed --competition {currentCode}</code>.
              </EmptyState>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-panel2/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center font-semibold">#</th>
                    <th className="px-3 py-3 font-semibold">Team</th>
                    <th className="px-2 py-3 text-center font-semibold">P</th>
                    <th className="px-2 py-3 text-center font-semibold">W</th>
                    <th className="px-2 py-3 text-center font-semibold">D</th>
                    <th className="px-2 py-3 text-center font-semibold">L</th>
                    <th className="px-2 py-3 text-center font-semibold">GD</th>
                    <th className="px-3 py-3 text-right font-semibold text-pos">Pts</th>
                    <th className="px-3 py-3 text-center font-semibold">Recent Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {d.standings.map((s) => {
                    const isUCL = s.position <= 4;
                    const isUEL = s.position === 5;
                    const isRelegation = s.position >= (d.standings.length - 2) && d.standings.length >= 18;
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
                          {s.team}
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono text-muted">{s.played}</td>
                        <td className="px-2 py-2.5 text-center font-mono">{s.won}</td>
                        <td className="px-2 py-2.5 text-center font-mono text-muted">{s.drawn}</td>
                        <td className="px-2 py-2.5 text-center font-mono text-muted">{s.lost}</td>
                        <td className={`px-2 py-2.5 text-center font-mono font-medium ${s.goal_difference > 0 ? "text-pos" : s.goal_difference < 0 ? "text-neg" : "text-muted"}`}>
                          {s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-pos text-base">
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
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pos" /> Champions League</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-info" /> Europa League</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neg" /> Relegation</span>
                </div>
                <span>PPM: Points per match</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Home vs Away & Top Scorers */}
        <div className="space-y-8">
          {/* Top Scorers Card */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-semibold tracking-tight">Top Scorers</h3>
              </div>
              <Link href="/rankings" className="text-xs text-pos hover:underline">
                Full Rankings →
              </Link>
            </div>

            {d.top_scorers.length === 0 ? (
              <Card>
                <div className="p-4 text-center text-xs text-muted">
                  Top scorers will appear when feed is ingested.
                </div>
              </Card>
            ) : (
              <div className="space-y-2 rounded-lg border border-line bg-panel p-3">
                {d.top_scorers.map((s, idx) => (
                  <div key={s.player_name} className="flex items-center justify-between rounded p-2 hover:bg-panel2/40">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-muted">#{idx + 1}</span>
                      <div>
                        <div className="font-semibold text-sm text-ink">{s.player_name}</div>
                        <div className="text-[11px] text-muted">{s.team}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-pos text-base">{s.goals} G</div>
                      <div className="text-[10px] text-muted">{s.assists ?? 0} assists</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Home vs Away Splits Card */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-pos" />
              <h3 className="text-base font-semibold tracking-tight">Home vs Away Splits</h3>
            </div>

            {d.team_performance.length === 0 ? (
              <Card>
                <div className="p-4 text-center text-xs text-muted">
                  Team splits are calculated from finished matches.
                </div>
              </Card>
            ) : (
              <div className="space-y-2.5 rounded-lg border border-line bg-panel p-4">
                {d.team_performance.slice(0, 6).map((t) => (
                  <div key={t.team} className="text-xs">
                    <div className="mb-1 flex justify-between font-medium">
                      <span className="text-ink font-semibold">{t.team}</span>
                      <span className="text-muted">Home {t.home_win_rate}% · Away {t.away_win_rate}%</span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel2">
                      <div style={{ width: `${t.home_win_rate}%` }} className="bg-pos transition-all" title={`Home Win: ${t.home_win_rate}%`} />
                      <div style={{ width: `${t.away_win_rate}%` }} className="bg-info transition-all" title={`Away Win: ${t.away_win_rate}%`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
