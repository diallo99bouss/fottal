import type { Metadata } from "next";
import { ReunionsView } from "./view";

export const metadata: Metadata = { title: "Réunions" };

export default function ReunionsPage() {
  return <ReunionsView />;
}
