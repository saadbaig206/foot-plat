"use client";
import React, { useState } from "react";
import ClubCrest from "./ClubCrest";

interface StandingsRow {
  position: number;
  team_id: number;
  team: string;
  logo_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  points_per_match: number;
  form: string | null;
  home_played?: number;
  home_won?: number;
  home_drawn?: number;
  home_lost?: number;
  home_gf?: number;
  home_ga?: number;
  home_points?: number;
  home_gd?: number;
  away_played?: number;
  away_won?: number;
  away_drawn?: number;
  away_lost?: number;
  away_gf?: number;
  away_ga?: number;
  away_points?: number;
  away_gd?: number;
  form_points?: number;
}

interface InteractiveStandingsProps {
  standings: StandingsRow[];
  leagueName: string;
}

export default function InteractiveStandings({ standings, leagueName }: InteractiveStandingsProps) {
  const [filter, setFilter] = useState<"overall" | "home" | "away" | "form">("overall");

  if (!standings || standings.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel p-6 text-center text-xs text-muted">
        No standings computed for this competition yet.
      </div>
    );
  }

  // Sort rows based on selected filter
  const sorted = [...standings].sort((a, b) => {
    if (filter === "home") {
      const pDiff = (b.home_points ?? 0) - (a.home_points ?? 0);
      if (pDiff !== 0) return pDiff;
      return (b.home_gd ?? 0) - (a.home_gd ?? 0);
    }
    if (filter === "away") {
      const pDiff = (b.away_points ?? 0) - (a.away_points ?? 0);
      if (pDiff !== 0) return pDiff;
      return (b.away_gd ?? 0) - (a.away_gd ?? 0);
    }
    if (filter === "form") {
      const fDiff = (b.form_points ?? 0) - (a.form_points ?? 0);
      if (fDiff !== 0) return fDiff;
      return b.points - a.points;
    }
    return a.position - b.position;
  });

  return (
    <div className="space-y-3">
      {/* Table Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel2/60 p-1">
          {[
            { id: "overall", label: "Overall" },
            { id: "home", label: "Home" },
            { id: "away", label: "Away" },
            { id: "form", label: "Form (Last 5)" },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-panel text-pos shadow-xs border border-line/60"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <span className="text-[11px] text-muted hidden sm:inline">
          {filter === "overall"
            ? "Full table"
            : filter === "home"
            ? "Home fixtures only"
            : filter === "away"
            ? "Away fixtures only"
            : "Recent 5 games"}
        </span>
      </div>

      {/* Standings Table */}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-panel2/40 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3 w-10 text-center font-semibold">#</th>
              <th className="px-3 py-3 font-semibold">Club</th>
              <th className="px-2 py-3 text-center font-semibold">P</th>
              <th className="px-2 py-3 text-center font-semibold">W</th>
              <th className="px-2 py-3 text-center font-semibold">D</th>
              <th className="px-2 py-3 text-center font-semibold">L</th>
              <th className="px-2 py-3 text-center font-semibold">GD</th>
              <th className="px-3 py-3 text-right font-semibold text-pos">Pts</th>
              <th className="px-3 py-3 text-center font-semibold">Recent Form</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {sorted.map((s, idx) => {
              const displayPos = idx + 1;
              const isUCL = displayPos <= 4;
              const isUEL = displayPos === 5;
              const isRelegation = displayPos >= sorted.length - 2 && sorted.length >= 18;
              const formChars = (s.form ?? "WWD").split("").slice(-5);

              // Determine columns based on active tab
              const p = filter === "home" ? s.home_played ?? 0 : filter === "away" ? s.away_played ?? 0 : s.played;
              const w = filter === "home" ? s.home_won ?? 0 : filter === "away" ? s.away_won ?? 0 : s.won;
              const d = filter === "home" ? s.home_drawn ?? 0 : filter === "away" ? s.away_drawn ?? 0 : s.drawn;
              const l = filter === "home" ? s.home_lost ?? 0 : filter === "away" ? s.away_lost ?? 0 : s.lost;
              const gd = filter === "home" ? s.home_gd ?? 0 : filter === "away" ? s.away_gd ?? 0 : s.goal_difference;
              const pts = filter === "home" ? s.home_points ?? 0 : filter === "away" ? s.away_points ?? 0 : s.points;

              return (
                <tr key={s.team_id} className="hover:bg-panel2/40 transition-colors">
                  <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold">
                    <span
                      className={`inline-block w-5 rounded text-center py-0.5 ${
                        isUCL
                          ? "bg-pos/20 text-pos font-bold"
                          : isUEL
                          ? "bg-info/20 text-info font-bold"
                          : isRelegation
                          ? "bg-neg/20 text-neg font-bold"
                          : "text-muted"
                      }`}
                    >
                      {displayPos}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-ink">
                    <div className="flex items-center gap-2.5">
                      <ClubCrest src={s.logo_url} name={s.team} size="sm" />
                      <span className="font-semibold text-ink">{s.team}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center font-mono text-muted">{p}</td>
                  <td className="px-2 py-2.5 text-center font-mono">{w}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-muted">{d}</td>
                  <td className="px-2 py-2.5 text-center font-mono text-muted">{l}</td>
                  <td
                    className={`px-2 py-2.5 text-center font-mono font-medium ${
                      gd > 0 ? "text-pos" : gd < 0 ? "text-neg" : "text-muted"
                    }`}
                  >
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-black text-pos text-base">
                    {pts}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      {formChars.map((ch, fIdx) => (
                        <span
                          key={fIdx}
                          className={`h-5 w-5 rounded text-[10px] font-bold flex items-center justify-center ${
                            ch === "W"
                              ? "bg-pos/20 text-pos"
                              : ch === "D"
                              ? "bg-muted/30 text-muted"
                              : "bg-neg/20 text-neg"
                          }`}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-line/60 bg-panel2/20 px-4 py-2.5 text-[11px] text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-pos" /> Champions League
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-info" /> Europa League
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-neg" /> Relegation
            </span>
          </div>
          <span>Showing: {filter.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
