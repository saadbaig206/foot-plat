import Link from "next/link";
import { api, type MatchPredictionDetail } from "@/lib/api";
import { Card, ErrorState, PageHeader, Stat, Tag, fmtDate } from "@/components/ui";
import ClubCrest from "@/components/ClubCrest";
import { ArrowLeft, CheckCircle2, HelpCircle, Info, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await api<MatchPredictionDetail>(`/api/predictions/match/${id}`);

  if (!res.ok) {
    return (
      <>
        <div className="mb-4">
          <Link href="/predictions" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Predictions
          </Link>
        </div>
        <ErrorState message={res.error} />
      </>
    );
  }

  const p = res.data;
  const pH = Math.round(p.probabilities.home * 100);
  const pD = Math.round(p.probabilities.draw * 100);
  const pA = Math.round(p.probabilities.away * 100);

  return (
    <>
      <div className="mb-4">
        <Link href="/predictions" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Predictions
        </Link>
      </div>

      <header className="mb-6 rounded-lg border border-line bg-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="font-semibold text-ink">{p.league_name} ({p.league_code})</span>
          <span>{fmtDate(p.match_date)} · Version {p.model_version}</span>
        </div>

        <div className="my-6 grid grid-cols-3 items-center text-center gap-4">
          <div className="flex flex-col items-center">
            <ClubCrest src={p.home_logo} name={p.home_team} size="lg" className="mb-2.5" />
            <h1 className="text-xl font-bold sm:text-2xl text-ink">{p.home_team}</h1>
            <span className="text-xs text-muted mt-0.5">Home</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-xl border border-line/80 bg-panel2 px-5 py-2.5 font-mono text-3xl font-bold tracking-widest text-pos shadow-inner">
              {p.predicted_score}
            </div>
            <span className="mt-1.5 text-xs font-medium text-muted">Expected Most Likely</span>
          </div>
          <div className="flex flex-col items-center">
            <ClubCrest src={p.away_logo} name={p.away_team} size="lg" className="mb-2.5" />
            <h1 className="text-xl font-bold sm:text-2xl text-ink">{p.away_team}</h1>
            <span className="text-xs text-muted mt-0.5">Away</span>
          </div>
        </div>

        {/* 3-Class Win Probabilities */}
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs font-semibold">
            <span className="text-pos">{p.home_team} ({pH}%)</span>
            <span className="text-muted">Draw ({pD}%)</span>
            <span className="text-amber-500">{p.away_team} ({pA}%)</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel2">
            <div style={{ width: `${pH}%` }} className="bg-pos transition-all" />
            <div style={{ width: `${pD}%` }} className="bg-muted/40 transition-all" />
            <div style={{ width: `${pA}%` }} className="bg-amber-500 transition-all" />
          </div>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Favourite Side"
          value={p.bookmaker_favourite === "home" ? p.home_team : p.away_team}
          hint={`Avoids defeat: ${(p.favourite_avoids_defeat_prob * 100).toFixed(1)}%`}
        />
        <Stat
          label="Model Confidence"
          value={`${(p.confidence * 100).toFixed(1)}%`}
          hint={`Peak outcome probability`}
        />
        <Stat
          label="Expected Goals"
          value={`${p.predicted_goals.home.toFixed(1)} - ${p.predicted_goals.away.toFixed(1)}`}
          hint="Poisson regressors (not xG)"
        />
        <Stat
          label="Market Odds"
          value={p.odds_estimated ? "Elo Synthetic" : "Live Bookmaker"}
          hint={p.odds_estimated ? "Fallback odds applied" : "Pre-match market prices"}
        />
      </div>

      {/* Qualitative Explanation */}
      <div className="mt-6">
        <Card title="Data-Grounded Match Analysis">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 shrink-0 text-pos mt-0.5" />
            <p className="text-sm leading-relaxed text-ink">{p.explanation}</p>
          </div>
        </Card>
      </div>

      {/* Poisson Scoreline Grid */}
      <div className="mt-6">
        <Card title="Top Poisson Scoreline Probabilities">
          <div className="space-y-2.5">
            {p.top_scorelines.map((item, idx) => {
              const probPct = (item.probability * 100).toFixed(1);
              return (
                <div key={item.score} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-5 font-mono text-xs text-muted">#{idx + 1}</span>
                    <span className="font-mono font-semibold text-ink">{item.score}</span>
                  </div>
                  <div className="flex items-center gap-3 w-1/2 max-w-xs">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-panel2">
                      <div style={{ width: `${Math.min(100, item.probability * 400)}%` }} className="h-full bg-pos" />
                    </div>
                    <span className="w-12 text-right font-mono text-xs text-muted">{probPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Honest Disclaimer */}
      <div className="mt-6 rounded-lg border border-line bg-panel2/50 p-4 text-xs text-muted">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 text-muted mt-0.5" />
          <div>
            <span className="font-semibold text-ink">Probabilistic Disclaimer:</span> {p.disclaimer}
            {" "}Predictions represent mathematical probabilities based on historical performance, Elo ratings, and market odds. They are never guarantees.
          </div>
        </div>
      </div>
    </>
  );
}

