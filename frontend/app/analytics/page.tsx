import { api, type League, type Match } from "@/lib/api";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import TableauEmbed from "@/components/TableauEmbed";
import { BarChart3, Database, ExternalLink, FileSpreadsheet, Layers } from "lucide-react";
import Link from "next/link";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string; season?: string }>;
}) {
  const params = await searchParams;
  const src = process.env.NEXT_PUBLIC_TABLEAU_VIZ_URL;

  const [leaguesRes, matchesRes] = await Promise.all([
    api<League[]>("/api/leagues"),
    api<Match[]>("/api/results?limit=10"),
  ]);

  const leagues = leaguesRes.ok ? leaguesRes.data : [];
  const matches = matchesRes.ok ? matchesRes.data : [];
  const selectedLeague = params?.league ?? "E0";
  const selectedSeason = params?.season ?? "2024/25";

  return (
    <>
      <PageHeader
        title="Football Analytics"
        subtitle="Visual analytics powered by Tableau Public extracts and historical match intelligence."
      />

      {/* Tableau Embed or Architecture Showcase */}
      {src ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel p-3">
            <span className="text-xs font-medium text-muted">Tableau Embedding API v3 Connected</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted">Synced Filters:</span>
              <span className="rounded bg-panel2 px-2 py-0.5 font-mono text-ink">league: {selectedLeague}</span>
              <span className="rounded bg-panel2 px-2 py-0.5 font-mono text-ink">season: {selectedSeason}</span>
            </div>
          </div>
          <Card>
            <TableauEmbed
              src={src}
              filters={{
                league_code: selectedLeague,
                season: selectedSeason,
              }}
            />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-dashed border-line bg-panel p-6 text-center">
            <BarChart3 className="mx-auto mb-3 h-8 w-8 text-pos" />
            <h2 className="text-base font-semibold">Tableau Public Dashboard Integration</h2>
            <p className="mx-auto mt-1 max-w-xl text-xs text-muted">
              PitchsideIQ exports 7 clean CSV extracts for Tableau Desktop. Once published to Tableau Public,
              set <code className="rounded bg-panel2 px-1 text-ink">NEXT_PUBLIC_TABLEAU_VIZ_URL</code> in <code className="rounded bg-panel2 px-1 text-ink">.env.local</code> to embed the interactive workbook here.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-panel2 px-3 py-1.5 text-xs font-medium text-ink">
                <FileSpreadsheet className="h-4 w-4 text-pos" />
                Extracts: <code className="text-muted">data/tableau/*.csv</code>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-panel2 px-3 py-1.5 text-xs font-medium text-ink">
                <Layers className="h-4 w-4 text-pos" />
                Build Guide: <code className="text-muted">docs/tableau.md</code>
              </span>
            </div>
          </div>

          {/* 7 Workbooks Grid */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              7 Standard Workbooks &amp; Extracts
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "1. League Overview", desc: "Aggregate KPIs, total goals, goals per match trends, and country treemaps.", file: "tableau_overview.csv" },
                { title: "2. Standings & Form", desc: "Interactive league tables, Points per Match, and 5-match form heatmaps.", file: "tableau_standings.csv" },
                { title: "3. Fixtures & Odds", desc: "1X2 results vs implied probabilities, market margins, and Elo disparities.", file: "tableau_fixtures_results.csv" },
                { title: "4. Match In-Depth Stats", desc: "Shots vs shots-on-target quadrants, corners, fouls, and cards.", file: "tableau_match_stats.csv" },
                { title: "5. Team Performance", desc: "Home vs away win-rate splits, attack vs defense matrices.", file: "tableau_team_performance.csv" },
                { title: "6. Player Intelligence", desc: "Golden Boot race, minutes per goal efficiency bubbles, and contributions.", file: "tableau_player_stats.csv" },
                { title: "7. Marquee Matches", desc: "Derbies, title-deciders, and major underdog upsets.", file: "tableau_important_matches.csv" },
              ].map((w) => (
                <div key={w.title} className="rounded-lg border border-line bg-panel p-4">
                  <div className="font-semibold text-ink text-sm">{w.title}</div>
                  <p className="mt-1 text-xs text-muted">{w.desc}</p>
                  <div className="mt-3 font-mono text-[11px] text-pos">{w.file}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Native League Snapshot */}
          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Live Database Competitions Snapshot
            </h3>
            <div className="overflow-x-auto rounded-lg border border-line bg-panel">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-panel2/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">League</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3 text-right">Stored Matches</th>
                    <th className="px-4 py-3 text-right">Coverage Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {leagues.slice(0, 8).map((l) => (
                    <tr key={l.code} className="hover:bg-panel2/40">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-pos">{l.code}</td>
                      <td className="px-4 py-2.5 font-medium">{l.name}</td>
                      <td className="px-4 py-2.5 text-muted">{l.country ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{l.matches?.toLocaleString() ?? 0}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                        {l.first_match?.slice(0, 4) ?? "—"} – {l.last_match?.slice(0, 4) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
