import type { Metadata } from "next";
import { ReglagesView } from "./view";

export const metadata: Metadata = { title: "Réglages" };

export default function ReglagesPage() {
  return <ReglagesView />;
}
