import Link from "next/link";
import { api, type Match, type PredictionItem } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, fmtDate } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { Calendar, Filter, ShieldCheck, Sparkles, Target } from "lucide-react";

const SUPPORTED_LEAGUES = [
  { code: "", label: "All Leagues" },
  { code: "E0", label: "Premier League" },
  { code: "SP1", label: "La Liga" },
  { code: "D1", label: "Bundesliga" },
  { code: "I1", label: "Serie A" },
  { code: "F1", label: "Ligue 1" },
  { code: "E1", label: "Championship" },
  { code: "N1", label: "Eredivisie" },
  { code: "P1", label: "Primeira Liga" },
];

export default async function MatchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string; view?: string; conviction?: string }>;
}) {
  const params = await searchParams;
  const currentLeague = params?.league ?? "";
  const currentView = params?.view ?? "all"; // 'all', 'fixtures', 'results', 'high_conviction'
  const convictionFilter = params?.conviction ?? "";

  const leagueParam = currentLeague ? `&league=${currentLeague}` : "";

  const [fixturesRes, resultsRes, predsRes] = await Promise.all([
    api<Match[]>(`/api/fixtures?limit=30${leagueParam}`),
    api<Match[]>(`/api/results?limit=30${leagueParam}`),
    api<PredictionItem[]>(`/api/predictions?limit=50${leagueParam}`),
  ]);

  const rawFixtures = fixturesRes.ok ? fixturesRes.data : [];
  const results = resultsRes.ok ? resultsRes.data : [];
  const predictions = predsRes.ok ? predsRes.data : [];

  // Map predictions by match_id for rapid O(1) enrichment
  const predMap = new Map<number, PredictionItem>();
  for (const p of predictions) {
    predMap.set(p.match_id, p);
  }

  // Filter fixtures if high conviction view is requested
  const fixtures = rawFixtures.filter((m) => {
    if (currentView === "high_conviction" || convictionFilter === "high") {
      const pred = predMap.get(m.id);
      return pred?.conviction?.tier === "high";
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Match Center"
        subtitle="Browse completed match results, upcoming fixtures, and AI outcome probability forecasts across European leagues."
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3">
        {/* League Selector */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Filter className="h-3.5 w-3.5 text-muted mr-1" />
          {SUPPORTED_LEAGUES.map((l) => {
            const active = currentLeague === l.code;
            return (
              <Link
                key={l.code}
                href={`/matches?league=${l.code}${currentView !== "all" ? `&view=${currentView}` : ""}`}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  active
                    ? "bg-pos text-bg font-bold shadow-xs"
                    : "text-muted hover:text-ink hover:bg-panel2"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* View Filter: All / Upcoming / High Conviction / Results */}
        <div className="flex flex-wrap items-center rounded-lg border border-line bg-panel2/60 p-0.5 text-xs">
          {[
            { id: "all", label: "All Matches" },
            { id: "fixtures", label: "Upcoming" },
            { id: "high_conviction", label: "🎯 High Conviction (78%+)" },
            { id: "results", label: "Finished Results" },
          ].map((tab) => {
            const active = currentView === tab.id;
            return (
              <Link
                key={tab.id}
                href={`/matches?view=${tab.id}${currentLeague ? `&league=${currentLeague}` : ""}`}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  active ? "bg-panel text-ink shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Fixtures Section */}
      {(currentView === "all" || currentView === "fixtures" || currentView === "high_conviction") && (
        <Card
          title={
            currentView === "high_conviction"
              ? "🎯 High Conviction Fixtures (78%–85% Historical Model Hit Rate)"
              : "Upcoming Scheduled Fixtures & AI Forecasts"
          }
        >
          {fixtures.length === 0 ? (
            <EmptyState title="No scheduled fixtures found">
              {currentView === "high_conviction"
                ? "No upcoming matches in this league currently meet the 78%+ high-conviction threshold. Check back closer to kickoff or view all upcoming fixtures."
                : "No upcoming fixtures match the selected filter. Scheduled fixtures sync through the live feed."}
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fixtures.map((m) => {
                const pred = predMap.get(m.id);
                const conv = pred?.conviction;

                return (
                  <Link
                    key={m.id}
                    href={`/matches/${m.id}`}
                    className="group flex flex-col justify-between rounded-xl border border-line bg-panel2/40 p-4 transition-all hover:border-pos/50 hover:bg-panel2/80 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted mb-2">
                        <span className="font-semibold text-ink">{m.league}</span>
                        <span className="font-mono">{fmtDate(m.match_date)}</span>
                      </div>

                      {/* Conviction Tier Badge */}
                      {conv && (
                        <div className="mb-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              conv.tier === "high"
                                ? "bg-pos/15 text-pos border border-pos/40"
                                : conv.tier === "moderate"
                                ? "bg-amber-500/15 text-amber-500 border border-amber-500/40"
                                : "bg-panel border border-line text-muted"
                            }`}
                          >
                            {conv.tier === "high" && <Target className="h-2.5 w-2.5" />}
                            {conv.tier === "moderate" && <ShieldCheck className="h-2.5 w-2.5" />}
                            <span>{conv.badge}</span>
                          </span>
                        </div>
                      )}

                      <div className="space-y-2.5 my-1">
                        <div className="flex items-center gap-2.5">
                          <ClubCrest src={m.home_logo} name={m.home_team} size="sm" />
                          <span className="text-sm font-semibold text-ink truncate group-hover:text-pos transition-colors">
                            {m.home_team}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <ClubCrest src={m.away_logo} name={m.away_team} size="sm" />
                          <span className="text-sm font-semibold text-ink truncate group-hover:text-pos transition-colors">
                            {m.away_team}
                          </span>
                        </div>
                      </div>

                      {conv && (
                        <div className="mt-2 rounded bg-panel/80 px-2 py-1 text-[11px] text-muted flex items-center justify-between border border-line/50">
                          <span>Pick:</span>
                          <span className="font-semibold text-ink">{conv.recommended_pick}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-line/60 flex items-center justify-between text-xs">
                      <span className="text-muted flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-pos" />
                        <span>Forecast: {pred?.predicted_score ?? "Available"}</span>
                      </span>
                      <span className="text-pos font-semibold group-hover:translate-x-0.5 transition-transform">
                        Details &rarr;
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Recent Results Section */}
      {(currentView === "all" || currentView === "results") && (
        <Card title="Recent Finished Matches & Scorelines">
          {results.length === 0 ? (
            <EmptyState title="No match results found">No completed match results found for this filter.</EmptyState>
          ) : (
            <div className="space-y-2">
              {results.map((m) => (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-line/60 bg-panel2/30 px-4 py-3 transition-colors hover:border-line hover:bg-panel2"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-mono text-muted w-24 shrink-0">{fmtDate(m.match_date)}</span>
                    <div className="flex items-center gap-2 truncate text-sm text-ink">
                      <ClubCrest src={m.home_logo} name={m.home_team} size="xs" />
                      <span className={m.result === "H" ? "font-bold text-ink" : "text-muted"}>{m.home_team}</span>
                      <span className="mx-1 text-muted text-xs">vs</span>
                      <ClubCrest src={m.away_logo} name={m.away_team} size="xs" />
                      <span className={m.result === "A" ? "font-bold text-ink" : "text-muted"}>{m.away_team}</span>
                    </div>
                  </div>

                  <div className="ml-4 shrink-0 flex items-center gap-3">
                    <span className="rounded-lg bg-panel px-3 py-1 font-mono text-sm font-bold text-ink border border-line">
                      {m.home_goals} - {m.away_goals}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
