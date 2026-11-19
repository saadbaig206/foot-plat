import Link from "next/link";
import { api, type Match, type Team } from "@/lib/api";
import { Card, EmptyState, ErrorState, Stat, fmtDate } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { ArrowLeft, Calendar, Shield, Trophy } from "lucide-react";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [teamRes, resultsRes, fixturesRes] = await Promise.all([
    api<Team>(`/api/teams/${id}`),
    api<Match[]>(`/api/results?team_id=${id}&limit=8`),
    api<Match[]>(`/api/fixtures?team_id=${id}&limit=6`),
  ]);

  if (!teamRes.ok) {
    return (
      <div className="space-y-4">
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Teams
        </Link>
        <ErrorState message={teamRes.error} />
      </div>
    );
  }

  const team = teamRes.data;
  const recentMatches = resultsRes.ok ? resultsRes.data : [];
  const upcomingFixtures = fixturesRes.ok ? fixturesRes.data : [];

  // Calculate form
  const formPills = recentMatches.slice(0, 5).map((m) => {
    const isHome = m.home_team_id === team.id;
    let outcome: "W" | "D" | "L" = "D";
    if (m.result === "D") outcome = "D";
    else if ((isHome && m.result === "H") || (!isHome && m.result === "A")) outcome = "W";
    else outcome = "L";

    const color =
      outcome === "W"
        ? "bg-pos text-bg font-bold"
        : outcome === "D"
        ? "bg-muted/30 text-ink"
        : "bg-neg text-bg font-bold";

    return { outcome, color, match: m };
  });

  return (
    <div className="space-y-6 pb-12">
      <Link href="/teams" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Clubs & Teams
      </Link>

      {/* Team Header Hero */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-2xl border border-line bg-panel p-6 shadow-xs">
        <ClubCrest src={team.logo_url} name={team.name} size="lg" className="h-20 w-20 shrink-0" />
        <div className="text-center sm:text-left flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink">{team.name}</h1>
          <p className="text-sm text-muted mt-1 flex items-center justify-center sm:justify-start gap-2">
            <span>{team.country ?? "European Club"}</span>
            {team.short_name && (
              <>
                <span>·</span>
                <span className="font-mono text-xs">{team.short_name}</span>
              </>
            )}
          </p>

          {/* Form Guide */}
          {formPills.length > 0 && (
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-1.5">
              <span className="text-xs text-muted font-medium mr-1.5">Recent Form:</span>
              {formPills.map((f, i) => (
                <span
                  key={i}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs ${f.color}`}
                  title={`${f.match.home_team} vs ${f.match.away_team} (${f.match.home_goals}-${f.match.away_goals})`}
                >
                  {f.outcome}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixtures & Results Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Results */}
        <Card title="Recent Match Results">
          {recentMatches.length === 0 ? (
            <EmptyState title="No recent matches found">No completed matches recorded for this team.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {recentMatches.map((m) => (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded-lg border border-line/70 bg-panel2/40 px-3.5 py-2.5 transition-colors hover:border-line hover:bg-panel2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs text-muted font-mono w-20 shrink-0">{fmtDate(m.match_date)}</span>
                    <div className="truncate text-xs sm:text-sm text-ink">
                      <span className={m.home_team_id === team.id ? "font-bold text-pos" : ""}>{m.home_team}</span>
                      <span className="mx-1.5 text-muted">vs</span>
                      <span className={m.away_team_id === team.id ? "font-bold text-pos" : ""}>{m.away_team}</span>
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 rounded bg-panel px-2.5 py-1 font-mono text-xs font-bold text-ink border border-line">
                    {m.home_goals} - {m.away_goals}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Fixtures & Predictions */}
        <Card title="Upcoming Scheduled Fixtures">
          {upcomingFixtures.length === 0 ? (
            <EmptyState title="No scheduled fixtures">No upcoming fixtures currently synced for this team.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {upcomingFixtures.map((m) => (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className="flex items-center justify-between rounded-lg border border-line/70 bg-panel2/40 px-3.5 py-2.5 transition-colors hover:border-pos/50 hover:bg-panel2 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs text-muted font-mono w-20 shrink-0">{fmtDate(m.match_date)}</span>
                    <div className="truncate text-xs sm:text-sm text-ink">
                      <span className={m.home_team_id === team.id ? "font-bold text-pos" : ""}>{m.home_team}</span>
                      <span className="mx-1.5 text-muted">vs</span>
                      <span className={m.away_team_id === team.id ? "font-bold text-pos" : ""}>{m.away_team}</span>
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 text-xs text-pos group-hover:underline font-medium">
                    View AI Forecast &rarr;
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
