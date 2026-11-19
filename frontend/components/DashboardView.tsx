"use client";

import { useState } from "react";
import Link from "next/link";
import ClubCrest from "@/components/ClubCrest";
import InteractiveStandings from "@/components/InteractiveStandings";
import MatchFeed from "@/components/MatchFeed";
import { Card, EmptyState, fmtDate } from "@/components/ui";
import type { AnalyticsDashboardData, Match, PredictionItem } from "@/lib/api";
import {
  ArrowRight,
  Award,
  BarChart3,
  BrainCircuit,
  Calendar,
  Filter,
  Layers,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";

interface DashboardViewProps {
  leagueName: string;
  currentCode: string;
  k: AnalyticsDashboardData["kpis"];
  standings: AnalyticsDashboardData["standings"];
  topScorers: AnalyticsDashboardData["top_scorers"];
  predictions: PredictionItem[];
  recent: Match[];
  fixtures: Match[];
  initialTab?: string;
  initialTier?: string;
}

export default function DashboardView({
  leagueName,
  currentCode,
  k,
  standings,
  topScorers,
  predictions,
  recent,
  fixtures,
  initialTab = "analytics",
  initialTier = "all",
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedTier, setSelectedTier] = useState<string>(initialTier);

  // Instant in-memory tier filtering (0ms latency)
  const filteredPredictions = predictions.filter((p) => {
    if (selectedTier === "all") return true;
    return p.conviction?.tier === selectedTier;
  });

  return (
    <div className="space-y-6">
      {/* Primary View Tabs - Instant Client-Side Switching */}
      <div className="flex items-center gap-2 border-b border-line pb-3">
        {[
          { id: "analytics", label: "Standings & Form", icon: BarChart3 },
          { id: "predictions", label: "AI Predictions", icon: BrainCircuit },
          { id: "matches", label: "Matches & Schedule", icon: Calendar },
          { id: "all", label: "Overview", icon: Layers },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-panel2 text-pos border border-pos/40 shadow-xs"
                  : "text-muted hover:text-ink hover:bg-panel2/50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================
          TAB 1: STANDINGS & FORM
         ======================================================== */}
      {(activeTab === "analytics" || activeTab === "all") && (
        <section className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Interactive Standings */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h2 className="text-base font-bold text-ink">{leagueName} Table</h2>
                </div>
                <span className="text-xs text-muted">Click tabs to toggle Home / Away / Form</span>
              </div>

              <InteractiveStandings standings={standings ?? []} leagueName={leagueName} />
            </div>

            {/* Right Column: Top Scorers & Performance Split */}
            <div className="space-y-6">
              {/* Outcome Split Bar */}
              <div className="rounded-xl border border-line bg-panel p-4 shadow-xs">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                  <span className="text-pos">Home: {k.home_win_pct ?? 0}%</span>
                  <span className="text-muted">Draws: {k.draw_pct ?? 0}%</span>
                  <span className="text-amber-500">Away: {k.away_win_pct ?? 0}%</span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel2">
                  <div style={{ width: `${k.home_win_pct ?? 33}%` }} className="bg-pos transition-all" />
                  <div style={{ width: `${k.draw_pct ?? 33}%` }} className="bg-muted/40 transition-all" />
                  <div style={{ width: `${k.away_win_pct ?? 34}%` }} className="bg-amber-500 transition-all" />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                  <span>Home Avg: <strong className="text-ink">{k.avg_home_goals ?? "—"}</strong></span>
                  <span>Clean sheets: <strong className="text-ink">{k.clean_sheet_pct ?? 0}%</strong></span>
                  <span>Away Avg: <strong className="text-ink">{k.avg_away_goals ?? "—"}</strong></span>
                </div>
              </div>

              {/* Top Scorers */}
              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-ink">Golden Boot Leaders</h3>
                  </div>
                  <Link href="/rankings" className="text-[11px] text-pos hover:underline">
                    All Rankings →
                  </Link>
                </div>

                {!topScorers || topScorers.length === 0 ? (
                  <Card>
                    <div className="p-3 text-center text-xs text-muted">
                      Top scorers will appear when goal statistics are recorded.
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-1.5 rounded-xl border border-line bg-panel p-2 shadow-xs">
                    {topScorers.slice(0, 5).map((s, idx) => (
                      <div
                        key={s.player_name}
                        className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-panel2/50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-semibold text-muted w-4">
                            #{idx + 1}
                          </span>
                          <ClubCrest src={s.team_logo} name={s.team} size="xs" />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-ink truncate">{s.player_name}</div>
                            <div className="text-[10px] text-muted truncate">{s.team}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-black text-pos text-sm">{s.goals} G</div>
                          <div className="text-[10px] text-muted">{s.assists ?? 0} ast</div>
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
          TAB 2: AI MATCH PREDICTIONS
         ======================================================== */}
      {(activeTab === "predictions" || activeTab === "all") && (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-pos" />
              <h2 className="text-base font-bold text-ink">AI Match Predictions</h2>
              <span className="text-xs text-muted">· v2 HistGradientBoosting + Poisson</span>
            </div>

            {/* In-Memory Instant Conviction Filter */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted text-[11px] mr-1 hidden sm:inline flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter Hit Rate:
              </span>
              {[
                { id: "all", label: "All Forecasts" },
                { id: "high", label: "🎯 High Conviction (78%–85%)" },
                { id: "moderate", label: "🛡️ Double Chance (75%–80%)" },
                { id: "volatile", label: "⚖️ Volatile / 50-50" },
              ].map((tierOpt) => {
                const isActive = selectedTier === tierOpt.id;
                return (
                  <button
                    key={tierOpt.id}
                    onClick={() => setSelectedTier(tierOpt.id)}
                    className={`rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-pos text-bg font-bold shadow-xs"
                        : "bg-panel border border-line text-muted hover:text-ink hover:bg-panel2"
                    }`}
                  >
                    {tierOpt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredPredictions.length === 0 ? (
            <Card>
              <EmptyState title="No matching predictions found">
                No upcoming fixtures match the selected conviction tier filter ({selectedTier}).
              </EmptyState>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPredictions.map((p) => {
                const pH = Math.round((p.probabilities?.home ?? p.p_home) * 100);
                const pD = Math.round((p.probabilities?.draw ?? p.p_draw) * 100);
                const pA = Math.round((p.probabilities?.away ?? p.p_away) * 100);
                const isHomeFav = p.favourite_side === "H";
                const conv = p.conviction;

                return (
                  <div
                    key={p.prediction_id}
                    className="flex flex-col justify-between rounded-xl border border-line bg-panel p-4 transition-all hover:border-line/80 hover:bg-panel2/30 hover:shadow-xs group"
                  >
                    <div>
                      {/* Competition & Date */}
                      <div className="flex items-center justify-between text-[11px] text-muted mb-2">
                        <span className="font-semibold text-ink">{p.league_name}</span>
                        <span>{fmtDate(p.match_date)}</span>
                      </div>

                      {/* Conviction Tier Badge */}
                      {conv && (
                        <div className="mb-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              conv.tier === "high"
                                ? "bg-pos/15 text-pos border border-pos/40"
                                : conv.tier === "moderate"
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/40"
                                : "bg-panel2 text-muted border border-line"
                            }`}
                          >
                            {conv.tier === "high" && <Target className="h-3 w-3" />}
                            {conv.tier === "moderate" && <ShieldCheck className="h-3 w-3" />}
                            <span>{conv.badge}</span>
                            <span className="opacity-70">· {conv.label}</span>
                          </span>
                        </div>
                      )}

                      {/* Head-to-Head with Crests */}
                      <div className="my-2 flex items-center justify-between gap-3">
                        <div className="flex flex-1 items-center gap-2 text-left min-w-0">
                          <ClubCrest src={p.home_logo} name={p.home_team} size="sm" />
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-ink truncate group-hover:text-pos transition-colors">
                              {p.home_team}
                            </div>
                            <span className="text-[10px] text-muted">
                              Home {isHomeFav && "· Fav"}
                            </span>
                          </div>
                        </div>

                        {/* Forecast Score Pill */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="rounded-md border border-line bg-panel2 px-2.5 py-1 text-center font-mono text-xs font-black tracking-wider text-pos shadow-inner">
                            {p.predicted_score ?? "VS"}
                          </div>
                          <span className="text-[8px] uppercase font-bold text-muted mt-0.5">
                            Forecast
                          </span>
                        </div>

                        <div className="flex flex-1 items-center justify-end gap-2 text-right min-w-0">
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-ink truncate group-hover:text-pos transition-colors">
                              {p.away_team}
                            </div>
                            <span className="text-[10px] text-muted">
                              Away {!isHomeFav && "· Fav"}
                            </span>
                          </div>
                          <ClubCrest src={p.away_logo} name={p.away_team} size="sm" />
                        </div>
                      </div>

                      {/* 1X2 Probability Bar */}
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[11px] font-semibold">
                          <span className="text-pos">1: {pH}%</span>
                          <span className="text-muted">X: {pD}%</span>
                          <span className="text-amber-500">2: {pA}%</span>
                        </div>
                        <div className="flex h-2 w-full overflow-hidden rounded-full bg-panel2">
                          <div style={{ width: `${pH}%` }} className="bg-pos transition-all" />
                          <div style={{ width: `${pD}%` }} className="bg-muted/40 transition-all" />
                          <div style={{ width: `${pA}%` }} className="bg-amber-500 transition-all" />
                        </div>
                      </div>

                      {/* Recommended Pick Box */}
                      {conv && (
                        <div className="mt-2.5 rounded-lg bg-panel2/60 border border-line/60 px-2.5 py-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-muted">Target:</span>
                          <span className="font-bold text-ink truncate ml-1">{conv.recommended_pick}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer link to Match Intelligence & H2H */}
                    <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px]">
                      <span className="text-muted">
                        xG: {p.exp_home_goals?.toFixed(1) ?? "-"} - {p.exp_away_goals?.toFixed(1) ?? "-"}
                      </span>
                      <Link
                        href={`/matches/${p.match_id}`}
                        className="inline-flex items-center gap-1 font-semibold text-pos hover:underline"
                      >
                        H2H & Analysis <ArrowRight className="h-3 w-3" />
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
          TAB 3: MATCHES & SCHEDULE
         ======================================================== */}
      {(activeTab === "matches" || activeTab === "all") && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-info" />
              <h2 className="text-base font-bold text-ink">Fixtures & Results</h2>
            </div>
            <span className="text-xs text-muted">Browse scheduled and completed matches</span>
          </div>

          <MatchFeed recent={recent} fixtures={fixtures} />
        </section>
      )}
    </div>
  );
}
