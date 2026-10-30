import { redirect } from "next/navigation";

export default async function PredictionsPage() {
  redirect("/?tab=predictions");
}
