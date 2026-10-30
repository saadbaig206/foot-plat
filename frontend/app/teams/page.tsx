import { api, type Team } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";

export default async function Teams({ searchParams }: PageProps<"/teams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const r = await api<Team[]>(`/api/teams?limit=60${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  return (
    <>
      <PageHeader title="Teams" subtitle="Search clubs in the database." />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search teams" aria-label="Search teams"
          className="w-full max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-sm placeholder:text-muted" />
        <button className="rounded-md bg-pos px-4 py-2 text-sm font-medium text-bg">Search</button>
      </form>
      {!r.ok ? <ErrorState message={r.error} /> : r.data.length === 0 ? <EmptyState title="No teams match your search" /> : (
        <Card><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {r.data.map((t) => <li key={t.id} className="rounded-md bg-panel2 px-3 py-2 text-sm">{t.name} <span className="text-muted">· {t.country ?? "—"}</span></li>)}
        </ul></Card>
      )}
    </>
  );
}
