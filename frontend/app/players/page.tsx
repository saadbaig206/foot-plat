import Link from "next/link";
import { api, type Player } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { ArrowRight, User } from "lucide-react";

export default async function Players() {
  const r = await api<Player[]>("/api/players?limit=60");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Players"
        subtitle="Explore active football player profiles, career statistics, and goal contributions across European leagues."
      />

      {!r.ok ? (
        <ErrorState message={r.error} />
      ) : r.data.length === 0 ? (
        <EmptyState title="No player data stored">
          The historical match dataset contains primarily match-level data. Player profiles and statistics are populated
          via live feed ingestion.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {r.data.map((p) => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="flex items-center gap-3.5 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-pos/50 hover:bg-panel2/80 hover:shadow-sm group cursor-pointer"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel2 border border-line text-muted group-hover:text-pos transition-colors">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-ink truncate group-hover:text-pos transition-colors">
                  {p.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                  <span>{p.position ?? "Player"}</span>
                  {p.nationality && (
                    <>
                      <span>·</span>
                      <span className="truncate">{p.nationality}</span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted/40 group-hover:text-pos group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
