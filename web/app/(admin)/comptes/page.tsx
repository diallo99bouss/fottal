import type { Metadata } from "next";
import { ComptesView } from "./view";

export const metadata: Metadata = { title: "Comptes" };

export default function ComptesPage() {
  return <ComptesView />;
}
