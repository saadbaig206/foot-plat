import Link from "next/link";
import { api, type Team } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { Search, Shield, Trophy } from "lucide-react";

export default async function Teams({ searchParams }: PageProps<"/teams">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const r = await api<Team[]>(`/api/teams?limit=60${q ? `&q=${encodeURIComponent(q)}` : ""}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clubs & Teams"
        subtitle="Explore registered football clubs, performance profiles, and upcoming fixtures across all European competitions."
      />

      {/* Search Input Bar */}
      <form className="flex gap-2.5 max-w-md" role="search">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search club (e.g. Arsenal, Real Madrid, Bayern)..."
            aria-label="Search teams"
            className="w-full rounded-lg border border-line bg-panel pl-9 pr-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pos focus:outline-none focus:ring-1 focus:ring-pos"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-pos px-4 py-2 text-sm font-semibold text-bg transition-transform hover:opacity-95"
        >
          Search
        </button>
      </form>

      {!r.ok ? (
        <ErrorState message={r.error} />
      ) : r.data.length === 0 ? (
        <EmptyState title="No clubs match your query">
          Try searching with a different club name or clear the search to see all clubs.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {r.data.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3.5 transition-all hover:border-line/80 hover:bg-panel2/60 hover:shadow-xs group"
            >
              <ClubCrest src={t.logo_url} name={t.name} size="md" className="group-hover:scale-105 transition-transform" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-ink truncate group-hover:text-pos transition-colors">
                  {t.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                  <span>{t.country ?? "Europe"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
