import Link from "next/link";
import { api, type Match } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat, Tag, fmtDate } from "@/components/ui";

type Summary = { matches: number; goals: number; goals_per_match: string; leagues: number; latest_result_date: string | null };

export default async function Overview() {
  const [sum, recent, fixtures] = await Promise.all([
    api<Summary>("/api/stats/summary"),
    api<Match[]>("/api/results?limit=8"),
    api<Match[]>("/api/fixtures?limit=8"),
  ]);
  return (
    <>
      <PageHeader title="Overview" subtitle="Summary of stored football data. All figures are computed from the database." />
      {!sum.ok ? <ErrorState message={sum.error} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Matches played" value={sum.data.matches.toLocaleString("en-GB")} hint="finished matches stored" />
          <Stat label="Goals scored" value={Number(sum.data.goals).toLocaleString("en-GB")} />
          <Stat label="Goals per match" value={sum.data.goals_per_match} />
          <Stat label="Leagues tracked" value={String(sum.data.leagues)} hint={`latest result ${fmtDate(sum.data.latest_result_date)}`} />
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Recently completed matches">
          {!recent.ok ? <ErrorState message={recent.error} /> : (
            <ul className="divide-y divide-line">
              {recent.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{m.home_team} <span className="text-muted">v</span> {m.away_team}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tnum font-semibold">{m.home_goals}–{m.away_goals}</span>
                    <Tag kind="history" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming fixtures">
          {!fixtures.ok ? <ErrorState message={fixtures.error} /> : fixtures.data.length === 0 ? (
            <EmptyState title="No upcoming fixtures stored">
              A fixtures feed has not been connected yet. Add a football-data.org API key to enable it.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">{fixtures.data.map((m) => (
              <li key={m.id} className="py-2 text-sm">{m.home_team} v {m.away_team} <span className="text-muted">· {fmtDate(m.match_date)}</span></li>
            ))}</ul>
          )}
        </Card>
      </div>
      <Card title="AI predictions" className="mt-4">
        <p className="text-sm text-muted">Model-generated predictions appear on the <Link className="text-info underline" href="/predictions">AI Predictions</Link> page once a trained model and upcoming fixtures are available.</p>
      </Card>
    </>
  );
}
