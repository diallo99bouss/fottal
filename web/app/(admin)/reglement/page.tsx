import type { Metadata } from "next";
import { ReglementView } from "./view";

export const metadata: Metadata = { title: "Lois et règles" };

export default function ReglementPage() {
  return <ReglementView />;
}
