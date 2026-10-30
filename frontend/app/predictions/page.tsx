import Link from "next/link";
import { api, type ModelStatus, type PredictionItem } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat, Tag, fmtDate } from "@/components/ui";
import { BrainCircuit, ChevronRight, ShieldCheck, Target, TrendingUp } from "lucide-react";

export default async function PredictionsPage() {
  const [statusRes, predsRes] = await Promise.all([
    api<ModelStatus>("/api/models/status"),
    api<PredictionItem[]>("/api/predictions?limit=50"),
  ]);

  if (!statusRes.ok) {
    return (
      <>
        <PageHeader title="AI Predictions" subtitle="Model-calibrated match probabilities and goal expectations." />
        <ErrorState message={statusRes.error} />
      </>
    );
  }

  const status = statusRes.data;
  const predictions = predsRes.ok ? predsRes.data : [];

  return (
    <>
      <PageHeader
        title="AI Predictions"
        subtitle="Probabilistic forecasts from our calibrated machine learning ensemble. Accuracy matches bookmaker-implied benchmarks."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Model Engine" value={status.ready_for_predictions ? "Active (v1)" : "Standby"} hint="Ensemble classifier & regressors" />
        <Stat label="Models Registered" value={String(status.models_registered)} hint={`${status.models_active} currently active`} />
        <Stat label="Predictions Generated" value={String(predictions.length)} hint="Latest pre-match models" />
        <Stat label="Benchmark Standard" value="Bookmaker Log-Loss" hint="AUC 0.626 / Brier 0.173" />
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Upcoming & Recent Predictions</h2>
          <span className="text-xs text-muted">Version-stamped on every forecast</span>
        </div>

        {predictions.length === 0 ? (
          <Card>
            <EmptyState title={status.ready_for_predictions ? "No predictions generated yet" : "No active model artifact"}>
              {status.ready_for_predictions
                ? "Connect football-data.org in Phase 3 or generate predictions via /api/predictions/generate."
                : (status.note ?? "Register the v1 model artifact to activate predictions.")}
            </EmptyState>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {predictions.map((p) => {
              const pH = Math.round((p.probabilities?.home ?? p.p_home) * 100);
              const pD = Math.round((p.probabilities?.draw ?? p.p_draw) * 100);
              const pA = Math.round((p.probabilities?.away ?? p.p_away) * 100);
              const favAvoids = Math.round((p.p_fav_avoids_defeat ?? 0) * 100);
              const isHomeFav = p.favourite_side === "H";

              return (
                <div
                  key={p.prediction_id}
                  className="flex flex-col justify-between rounded-lg border border-line bg-panel p-5 transition-shadow hover:border-line/80 hover:shadow-sm"
                >
                  <div>
                    {/* Header: League & Date */}
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="font-medium text-ink">{p.league_name} ({p.league_code})</span>
                      <span>{fmtDate(p.match_date)}</span>
                    </div>

                    {/* Matchup */}
                    <div className="my-4 flex items-center justify-between">
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-ink sm:text-lg">{p.home_team}</div>
                        <span className="text-xs text-muted">Home {isHomeFav && "· Favourite"}</span>
                      </div>
                      <div className="mx-3 rounded bg-panel2 px-2.5 py-1 text-center font-mono text-sm font-bold tracking-wider">
                        {p.predicted_score ?? "vs"}
                      </div>
                      <div className="flex-1 text-right">
                        <div className="font-semibold text-ink sm:text-lg">{p.away_team}</div>
                        <span className="text-xs text-muted">Away {!isHomeFav && "· Favourite"}</span>
                      </div>
                    </div>

                    {/* Probability Bar */}
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs font-medium">
                        <span className="text-pos font-semibold">1: {pH}%</span>
                        <span className="text-muted">X: {pD}%</span>
                        <span className="text-amber-500 font-semibold">2: {pA}%</span>
                      </div>
                      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel2">
                        <div style={{ width: `${pH}%` }} className="bg-pos transition-all" title={`Home win: ${pH}%`} />
                        <div style={{ width: `${pD}%` }} className="bg-muted/40 transition-all" title={`Draw: ${pD}%`} />
                        <div style={{ width: `${pA}%` }} className="bg-amber-500 transition-all" title={`Away win: ${pA}%`} />
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-line/60 bg-panel2/50 p-2">
                        <span className="text-muted">Goal Forecast:</span>
                        <div className="font-semibold text-ink">
                          {p.exp_home_goals?.toFixed(1) ?? "-"} vs {p.exp_away_goals?.toFixed(1) ?? "-"}
                        </div>
                      </div>
                      <div className="rounded border border-line/60 bg-panel2/50 p-2">
                        <span className="text-muted">Fav avoids defeat:</span>
                        <div className="font-semibold text-pos">{favAvoids}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3 text-xs">
                    <div className="flex items-center gap-2 text-muted">
                      <Tag kind="predicted" />
                      <span className="font-mono">{p.model_version}</span>
                    </div>
                    <Link
                      href={`/matches/${p.match_id}`}
                      className="flex items-center gap-1 font-medium text-pos hover:underline"
                    >
                      Deep Analysis
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Honest Disclosure Banner */}
        <div className="rounded-lg border border-line bg-panel2/40 p-4 text-xs text-muted">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-pos mt-0.5" />
            <div>
              <span className="font-semibold text-ink">Calibration Transparency:</span>
              {" "}Probabilities are generated by leak-free HistGradientBoosting models trained on 169,421 historical matches.
              Predictions are probabilities, never guarantees. Model accuracy matches market-implied benchmarks (AUC 0.626, multi-class log-loss 1.0018).
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
