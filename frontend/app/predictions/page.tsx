import { api, type ModelStatus } from "@/lib/api";
import { Card, EmptyState, ErrorState, PageHeader, Stat } from "@/components/ui";

export default async function Predictions() {
  const s = await api<ModelStatus>("/api/models/status");
  return (
    <>
      <PageHeader title="AI Predictions" subtitle="Model-generated probabilities, not guaranteed outcomes." />
      {!s.ok ? <ErrorState message={s.error} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label="Models registered" value={String(s.data.models_registered)} />
            <Stat label="Models active" value={String(s.data.models_active)} />
            <Stat label="Prediction engine" value={s.data.ready_for_predictions ? "Ready" : "Not ready"} />
          </div>
          <div className="mt-6">
            <Card title="Upcoming match predictions">
              <EmptyState title={s.data.ready_for_predictions ? "No upcoming matches to predict" : "No trained model is active yet"}>
                {s.data.note ?? "Predictions need upcoming fixtures from the data feed."}
              </EmptyState>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
