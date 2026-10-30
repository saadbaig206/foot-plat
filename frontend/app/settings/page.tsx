import { api, API_URL, type LastUpdated } from "@/lib/api";
import { Card, ErrorState, PageHeader, fmtDate, fmtDateTime } from "@/components/ui";

export default async function Settings() {
  const [health, upd] = await Promise.all([api<{ status: string }>("/api/health"), api<LastUpdated>("/api/data/last-updated")]);
  const rows: [string, string][] = [
    ["API endpoint", API_URL],
    ["API status", health.ok ? "Online" : health.error],
    ["Latest result in data", upd.ok ? fmtDate(upd.data.latest_result_date) : "unavailable"],
    ["Matches last updated", upd.ok ? fmtDateTime(upd.data.matches) : "unavailable"],
    ["Last successful ingest", upd.ok ? fmtDateTime(upd.data.last_successful_ingest) : "unavailable"],
    ["Standings last updated", upd.ok ? fmtDateTime(upd.data.standings) : "unavailable"],
  ];
  return (
    <>
      <PageHeader title="Settings" subtitle="System status and data freshness." />
      {!upd.ok && <div className="mb-4"><ErrorState message={upd.error} /></div>}
      <Card><dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="tnum text-right">{v}</dd></div>)}
      </dl></Card>
      <p className="mt-4 text-xs text-muted">Data: Football-Data.co.uk results and odds, ClubElo ratings (MIT-licensed compilation by xgabora).</p>
    </>
  );
}
