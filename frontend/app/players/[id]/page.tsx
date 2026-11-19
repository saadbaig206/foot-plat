import Link from "next/link";
import { api, type Player } from "@/lib/api";
import { Card, EmptyState, ErrorState, Stat, fmtDate } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { ArrowLeft, Award, Flame, Timer, User } from "lucide-react";

interface PlayerDetail extends Player {
  team_id?: number | null;
  team?: string | null;
  team_logo?: string | null;
  appearances?: number | null;
  minutes?: number | null;
  goals?: number | null;
  assists?: number | null;
  birth_date?: string | null;
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await api<PlayerDetail>(`/api/players/${id}`);

  if (!res.ok) {
    return (
      <div className="space-y-4">
        <Link href="/players" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Players
        </Link>
        <ErrorState message={res.error} />
      </div>
    );
  }

  const p = res.data;
  const minsPerGoal =
    p.goals && p.goals > 0 && p.minutes && p.minutes > 0
      ? (p.minutes / p.goals).toFixed(1)
      : null;

  return (
    <div className="space-y-6 pb-12">
      <Link href="/players" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Players
      </Link>

      {/* Hero Profile Card */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded-2xl border border-line bg-panel p-6 shadow-xs">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-panel2 border border-line text-muted">
          {p.photo_url ? (
            <img src={p.photo_url} alt={p.name} className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <User className="h-12 w-12 text-muted" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-muted">
            {p.nationality && <span className="rounded-md bg-panel2 px-2.5 py-1 font-medium">{p.nationality}</span>}
            {p.position && <span className="rounded-md bg-pos/15 text-pos font-semibold px-2.5 py-1">{p.position}</span>}
            {p.birth_date && <span>Born {fmtDate(p.birth_date)}</span>}
          </div>

          {p.team && p.team_id && (
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs text-muted">Current Club:</span>
              <Link
                href={`/teams/${p.team_id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-pos transition-colors"
              >
                <ClubCrest src={p.team_logo} name={p.team} size="sm" />
                <span>{p.team}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Appearances" value={String(p.appearances ?? 0)} />
        <Stat label="Minutes Played" value={p.minutes ? p.minutes.toLocaleString() : "0"} />
        <Stat label="Goals Scored" value={String(p.goals ?? 0)} />
        <Stat label="Assists" value={String(p.assists ?? 0)} />
      </div>

      {/* Detailed Efficiency Metrics */}
      <Card title="Player Efficiency & Scoring Metrics">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-panel2/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Timer className="h-4 w-4 text-pos" />
              <span>Minutes Per Goal</span>
            </div>
            <div className="mt-2 text-2xl font-black text-ink">{minsPerGoal ? `${minsPerGoal} min` : "—"}</div>
            <div className="mt-1 text-xs text-muted">Average playing time per goal scored</div>
          </div>

          <div className="rounded-xl border border-line bg-panel2/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Award className="h-4 w-4 text-pos" />
              <span>Goal Contributions</span>
            </div>
            <div className="mt-2 text-2xl font-black text-ink">{(p.goals ?? 0) + (p.assists ?? 0)}</div>
            <div className="mt-1 text-xs text-muted">Total goals + assists this season</div>
          </div>

          <div className="rounded-xl border border-line bg-panel2/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Flame className="h-4 w-4 text-pos" />
              <span>Goals Per 90</span>
            </div>
            <div className="mt-2 text-2xl font-black text-ink">
              {p.minutes && p.minutes >= 90 && p.goals
                ? ((p.goals / p.minutes) * 90).toFixed(2)
                : "—"}
            </div>
            <div className="mt-1 text-xs text-muted">Standardized scoring rate per 90 mins</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
