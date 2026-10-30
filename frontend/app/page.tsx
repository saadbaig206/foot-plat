import Link from "next/link";
import { api, type Match } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat, fmtDate } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { ArrowRight, BarChart3, BrainCircuit, Calendar, CheckCircle2, ChevronRight, Flame, Trophy } from "lucide-react";

type Summary = { matches: number; goals: number; goals_per_match: string; leagues: number; latest_result_date: string | null };

export default async function Overview() {
  const [sum, recent, fixtures] = await Promise.all([
    api<Summary>("/api/stats/summary"),
    api<Match[]>("/api/results?limit=8"),
    api<Match[]>("/api/fixtures?limit=8"),
  ]);

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-panel via-panel to-panel2/60 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pos/30 bg-pos/10 px-3 py-1 text-xs font-semibold text-pos">
            <span className="h-1.5 w-1.5 rounded-full bg-pos animate-pulse" />
            Live Football Intelligence
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl md:text-4xl text-ink">
            Data-Grounded Football Analytics & AI Predictions
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted leading-relaxed">
            Machine learning probability calibration, expected scoreline matrices, and in-depth performance standings across top European competitions.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/analytics"
              className="inline-flex items-center gap-2 rounded-lg bg-pos px-4 py-2 text-sm font-semibold text-bg transition-transform hover:opacity-95 hover:scale-[1.02]"
            >
              <BarChart3 className="h-4 w-4" />
              Explore Analytics Dashboard
            </Link>
            <Link
              href="/predictions"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel2 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line/40"
            >
              <BrainCircuit className="h-4 w-4 text-pos" />
              View Match Predictions
            </Link>
          </div>
        </div>
      </div>

      {/* Headline Numbers */}
      {!sum.ok ? (
        <ErrorState message={sum.error} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Finished Matches"
            value={sum.data.matches.toLocaleString("en-GB")}
            hint="stored in database"
          />
          <Stat
            label="Total Goals"
            value={Number(sum.data.goals).toLocaleString("en-GB")}
            hint="across all tracked fixtures"
          />
          <Stat
            label="Goals Per Match"
            value={sum.data.goals_per_match ? `${sum.data.goals_per_match} G/M` : "—"}
            hint="overall scoring intensity"
          />
          <Stat
            label="Competitions"
            value={String(sum.data.leagues)}
            hint={`latest: ${fmtDate(sum.data.latest_result_date)}`}
          />
        </div>
      )}

      {/* Main Grids: Recent Results & Upcoming Fixtures */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recently Completed Matches */}
        <div className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-pos" />
              <h2 className="text-base font-semibold tracking-tight text-ink">Recent Results</h2>
            </div>
            <Link href="/analytics" className="inline-flex items-center gap-1 text-xs text-muted hover:text-pos">
              League Standings <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {!recent.ok ? (
            <ErrorState message={recent.error} />
          ) : (
            <div className="space-y-2.5">
              {recent.data.map((m) => {
                const homeWon = m.result === "H";
                const awayWon = m.result === "A";

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-panel2/40 p-3 transition-colors hover:bg-panel2/80"
                  >
                    {/* Home Team */}
                    <div className="flex flex-1 items-center gap-2.5 min-w-0">
                      <ClubCrest src={m.home_logo} name={m.home_team} size="sm" />
                      <span className={`truncate text-sm ${homeWon ? "font-bold text-ink" : "text-muted"}`}>
                        {m.home_team}
                      </span>
                    </div>

                    {/* Scoreline */}
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-md bg-panel px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-ink border border-line/60">
                        {m.home_goals} : {m.away_goals}
                      </span>
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-1 items-center justify-end gap-2.5 min-w-0 text-right">
                      <span className={`truncate text-sm ${awayWon ? "font-bold text-ink" : "text-muted"}`}>
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
              <h2 className="text-base font-semibold tracking-tight text-ink">Upcoming Fixtures</h2>
            </div>
            <Link href="/predictions" className="inline-flex items-center gap-1 text-xs text-muted hover:text-pos">
              AI Predictions <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {!fixtures.ok ? (
            <ErrorState message={fixtures.error} />
          ) : fixtures.data.length === 0 ? (
            <EmptyState title="No upcoming fixtures scheduled">
              Upcoming fixtures will appear when the league schedule is updated.
            </EmptyState>
          ) : (
            <div className="space-y-2.5">
              {fixtures.data.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-panel2/40 p-3 transition-colors hover:bg-panel2/80"
                >
                  {/* Home Team */}
                  <div className="flex flex-1 items-center gap-2.5 min-w-0">
                    <ClubCrest src={m.home_logo} name={m.home_team} size="sm" />
                    <span className="truncate text-sm font-medium text-ink">{m.home_team}</span>
                  </div>

                  {/* VS & Match Date */}
                  <div className="flex flex-col items-center shrink-0 px-2">
                    <span className="text-[11px] font-semibold text-pos uppercase tracking-wider">VS</span>
                    <span className="text-[10px] text-muted">{fmtDate(m.match_date)}</span>
                  </div>

                  {/* Away Team */}
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
    </div>
  );
}
