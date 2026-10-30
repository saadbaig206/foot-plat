import Link from "next/link";
import { api, type League } from "@/lib/api";
import { Card, ErrorState, PageHeader, fmtDate } from "@/components/ui";
import { ArrowRight, Globe2, Trophy } from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Germany: "🇩🇪",
  Italy: "🇮🇹",
  France: "🇫🇷",
  Netherlands: "🇳🇱",
  Portugal: "🇵🇹",
  Belgium: "🇧🇪",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Turkey: "🇹🇷",
  Greece: "🇬🇷",
};

export default async function Leagues() {
  const r = await api<League[]>("/api/leagues");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitions & Leagues"
        subtitle="Explore European domestic leagues, total stored fixtures, and analytical profiles."
      />

      {!r.ok ? (
        <ErrorState message={r.error} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.data.map((l) => {
            const flag = (l.country && COUNTRY_FLAGS[l.country]) || "⚽";

            return (
              <div
                key={l.id}
                className="flex flex-col justify-between rounded-xl border border-line bg-panel p-5 transition-all hover:border-line/80 hover:bg-panel2/50 hover:shadow-xs group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-muted mb-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span>{flag}</span>
                      <span>{l.country ?? "Europe"}</span>
                    </span>
                    <span className="rounded bg-panel2 px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-muted border border-line/50">
                      Tier {l.tier ?? 1}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-ink group-hover:text-pos transition-colors">
                    {l.name}
                  </h2>
                  <div className="mt-1 font-mono text-xs text-muted">
                    Code: <strong className="text-ink">{l.code}</strong>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-line/60 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="font-bold text-ink font-mono">{l.matches.toLocaleString("en-GB")}</span>{" "}
                    <span className="text-muted">matches</span>
                  </div>

                  <Link
                    href={`/analytics?league=${l.code}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-pos hover:underline"
                  >
                    Analytics <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
