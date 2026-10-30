import { Card, EmptyState, PageHeader } from "@/components/ui";
import TableauEmbed from "@/components/TableauEmbed";

export default function Analytics() {
  const src = process.env.NEXT_PUBLIC_TABLEAU_VIZ_URL;
  return (
    <>
      <PageHeader title="Football Analytics" subtitle="Interactive Tableau dashboards on the shared football database." />
      {src ? (
        <Card><TableauEmbed src={src} /></Card>
      ) : (
        <EmptyState title="No Tableau dashboard connected">
          Publish a workbook to Tableau Public and set <code className="text-ink">NEXT_PUBLIC_TABLEAU_VIZ_URL</code> to its URL.
          The data extracts and build guide are in <code className="text-ink">docs/tableau.md</code> (Phase 2).
        </EmptyState>
      )}
    </>
  );
}
