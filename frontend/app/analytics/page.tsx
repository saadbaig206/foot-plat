import { redirect } from "next/navigation";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ league?: string; season?: string }>;
}) {
  const params = await searchParams;
  const league = params?.league ?? "E0";
  const season = params?.season ? `&season=${encodeURIComponent(params.season)}` : "";
  redirect(`/?tab=analytics&league=${league}${season}`);
}
