import { api, type Player } from "@/lib/api";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";

export default async function Players() {
  const r = await api<Player[]>("/api/players?limit=50");
  return (
    <>
      <PageHeader title="Players" subtitle="Player profiles and statistics." />
      {!r.ok ? <ErrorState message={r.error} /> : r.data.length === 0 ? (
        <EmptyState title="No player data stored">
          The historical match dataset contains no player data. Player profiles and statistics need a football data API (Phase 3);
          fields the free tier does not provide will be shown as unavailable.
        </EmptyState>
      ) : <ul>{r.data.map((p) => <li key={p.id}>{p.name}</li>)}</ul>}
    </>
  );
}
