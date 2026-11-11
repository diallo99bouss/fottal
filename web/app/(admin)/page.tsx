import type { Metadata } from "next";
import { TableauView } from "./tableau-view";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function TableauPage() {
  return <TableauView />;
}
