"use client";
import React, { useState } from "react";
import Link from "next/link";
import { type Match } from "@/lib/api";
import ClubCrest from "./ClubCrest";
import { fmtDate } from "./ui";
import { ArrowRight, BrainCircuit, Calendar, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

interface MatchFeedProps {
  recent: Match[];
  fixtures: Match[];
}

export default function MatchFeed({ recent, fixtures }: MatchFeedProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "results" | "all">("upcoming");
  const [search, setSearch] = useState("");

  const allMatches = [
    ...fixtures.map((m) => ({ ...m, isUpcoming: true })),
    ...recent.map((m) => ({ ...m, isUpcoming: false })),
  ];

  const displayed = (
    activeTab === "upcoming" ? fixtures : activeTab === "results" ? recent : allMatches
  ).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.home_team.toLowerCase().includes(q) || m.away_team.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Feed Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2/60 p-1">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "upcoming"
                ? "bg-panel text-pos shadow-xs border border-line/60"
                : "text-muted hover:text-ink"
            }`}
          >
            Upcoming Fixtures ({fixtures.length})
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "results"
                ? "bg-panel text-pos shadow-xs border border-line/60"
                : "text-muted hover:text-ink"
            }`}
          >
            Recent Results ({recent.length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-panel text-pos shadow-xs border border-line/60"
                : "text-muted hover:text-ink"
            }`}
          >
            All Matches
          </button>
        </div>

        {/* Search match */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by club..."
          className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-pos focus:outline-none max-w-xs"
        />
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-xl border border-line bg-panel p-8 text-center text-xs text-muted">
          No matches match your filter.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((m) => {
            const isFinished = m.status === "finished";
            const homeWon = m.result === "H";
            const awayWon = m.result === "A";

            return (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-xl border border-line bg-panel p-4 transition-all hover:border-line/80 hover:bg-panel2/40 hover:shadow-xs group"
              >
                <div>
                  {/* Match header */}
                  <div className="flex items-center justify-between text-xs text-muted mb-3">
                    <span className="font-semibold text-ink">{m.league || m.league_code}</span>
                    <span className="text-[11px]">{fmtDate(m.match_date)}</span>
                  </div>

                  {/* Clashing Clubs */}
                  <div className="my-2 space-y-2">
                    {/* Home Team */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ClubCrest src={m.home_logo} name={m.home_team} size="sm" />
                        <span
                          className={`truncate text-sm ${
                            isFinished && homeWon ? "font-bold text-ink" : "text-ink/90 font-medium"
                          }`}
                        >
                          {m.home_team}
                        </span>
                      </div>
                      {isFinished ? (
                        <span
                          className={`font-mono text-sm font-bold ${
                            homeWon ? "text-pos" : "text-muted"
                          }`}
                        >
                          {m.home_goals}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">Home</span>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ClubCrest src={m.away_logo} name={m.away_team} size="sm" />
                        <span
                          className={`truncate text-sm ${
                            isFinished && awayWon ? "font-bold text-ink" : "text-ink/90 font-medium"
                          }`}
                        >
                          {m.away_team}
                        </span>
                      </div>
                      {isFinished ? (
                        <span
                          className={`font-mono text-sm font-bold ${
                            awayWon ? "text-pos" : "text-muted"
                          }`}
                        >
                          {m.away_goals}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">Away</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Match Footer */}
                <div className="mt-3 pt-3 border-t border-line/50 flex items-center justify-between text-xs">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] uppercase font-bold ${
                      isFinished
                        ? "bg-panel2 text-muted"
                        : "bg-pos/15 text-pos"
                    }`}
                  >
                    {isFinished ? "Finished (FT)" : "Scheduled"}
                  </span>

                  <Link
                    href={`/matches/${m.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-pos hover:underline text-[11px]"
                  >
                    AI Forecast & H2H <ArrowRight className="h-3 w-3" />
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
