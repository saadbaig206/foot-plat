import { api, type PlayerRanking } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { Award, Flame, Medal, Trophy, User } from "lucide-react";

export default async function RankingsPage() {
  const [bootRes, ballonRes] = await Promise.all([
    api<PlayerRanking[]>("/api/rankings/golden-boot?limit=25"),
    api<PlayerRanking[]>("/api/rankings/ballon-dor?limit=25"),
  ]);

  const bootData = bootRes.ok ? bootRes.data : [];
  const ballonData = ballonRes.ok ? ballonRes.data : [];

  return (
    <>
      <PageHeader
        title="Player Rankings & Awards"
        subtitle="Objective individual performance metrics: Golden Boot race and data-grounded Ballon d'Or composite ratings."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Golden Boot Leader" value={bootData[0]?.player_name ?? "—"} hint={`${bootData[0]?.goals ?? 0} goals`} />
        <Stat label="Top Ballon d'Or Rating" value={ballonData[0]?.player_name ?? "—"} hint={`Composite: ${ballonData[0]?.composite_rating ?? 0}`} />
        <Stat label="Ranked Players" value={String(Math.max(bootData.length, ballonData.length))} hint="Across registered leagues" />
        <Stat label="Algorithm Basis" value="Phase 5 Models" hint="Weighted individual & team impact" />
      </div>

      <div className="mt-8 space-y-8">
        {/* Golden Boot Race */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold tracking-tight">Golden Boot Leaderboard</h2>
            </div>
            <span className="text-xs text-muted">Goals & scoring efficiency</span>
          </div>

          {bootData.length === 0 ? (
            <Card>
              <EmptyState title="No player stats available yet">
                Player stats and top scorers will populate once the Phase 3 data integration or history loader runs.
              </EmptyState>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-panel2/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Player</th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">League</th>
                    <th className="px-4 py-3 text-center font-semibold">Apps</th>
                    <th className="px-4 py-3 text-right font-semibold">Assists</th>
                    <th className="px-4 py-3 text-right font-semibold">Mins / Goal</th>
                    <th className="px-4 py-3 text-right font-semibold text-pos">Goals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {bootData.map((p) => (
                    <tr key={p.player_id} className="hover:bg-panel2/40">
                      <td className="px-4 py-3 font-mono font-medium text-muted">
                        {p.rank === 1 ? <span className="text-amber-500 font-bold">🥇 #1</span> :
                         p.rank === 2 ? <span className="text-zinc-400 font-bold">🥈 #2</span> :
                         p.rank === 3 ? <span className="text-amber-700 font-bold">🥉 #3</span> : `#${p.rank}`}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">{p.player_name}</td>
                      <td className="px-4 py-3 text-muted">
                        <div className="flex items-center gap-2">
                          <ClubCrest src={p.team_logo} name={p.team_name ?? ""} size="xs" />
                          <span className="text-sm font-medium text-ink">{p.team_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{p.league_name}</td>
                      <td className="px-4 py-3 text-center font-mono text-muted">{p.appearances}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{p.assists ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted">{p.minutes_per_goal ? `${p.minutes_per_goal}m` : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-pos sm:text-base">{p.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ballon d'Or / Player of the Season */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-pos" />
              <h2 className="text-lg font-semibold tracking-tight">Ballon d&apos;Or Composite Index</h2>
            </div>
            <span className="text-xs text-muted">Weighted algorithm: Goals, Assists, Appearances & Team Standing</span>
          </div>

          {ballonData.length === 0 ? (
            <Card>
              <EmptyState title="No composite rankings available">
                Rankings require player statistics and league standings to be computed.
              </EmptyState>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-panel2/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Player</th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">League</th>
                    <th className="px-4 py-3 text-right font-semibold">Goals</th>
                    <th className="px-4 py-3 text-right font-semibold">Assists</th>
                    <th className="px-4 py-3 text-right font-semibold">Team Pts</th>
                    <th className="px-4 py-3 text-right font-semibold text-pos">Composite Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {ballonData.map((p) => (
                    <tr key={p.player_id} className="hover:bg-panel2/40">
                      <td className="px-4 py-3 font-mono font-medium text-muted">#{p.rank}</td>
                      <td className="px-4 py-3 font-medium text-ink">{p.player_name}</td>
                      <td className="px-4 py-3 text-muted">
                        <div className="flex items-center gap-2">
                          <ClubCrest src={p.team_logo} name={p.team_name ?? ""} size="xs" />
                          <span className="text-sm font-medium text-ink">{p.team_name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{p.league_name}</td>
                      <td className="px-4 py-3 text-right font-mono">{p.goals}</td>
                      <td className="px-4 py-3 text-right font-mono">{p.assists ?? 0}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted">{p.team_id ? "Active" : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-pos sm:text-base">
                        {p.composite_rating?.toFixed(1) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

