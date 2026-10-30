import { api, type League } from "@/lib/api";
import { Card, ErrorState, PageHeader, fmtDate } from "@/components/ui";

export default async function Leagues() {
  const r = await api<League[]>("/api/leagues");
  return (
    <>
      <PageHeader title="Leagues" subtitle="Competitions stored in the database." />
      {!r.ok ? <ErrorState message={r.error} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">League</th><th>Country</th><th>Tier</th><th className="text-right">Matches</th><th className="pr-3 text-right">Latest</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.data.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 font-medium">{l.name} <span className="text-muted">({l.code})</span></td>
                  <td>{l.country ?? "—"}</td><td>{l.tier ?? "—"}</td>
                  <td className="tnum text-right">{l.matches.toLocaleString("en-GB")}</td>
                  <td className="tnum pr-3 text-right">{fmtDate(l.last_match)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
