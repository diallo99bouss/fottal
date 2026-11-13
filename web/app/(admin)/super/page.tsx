import type { Metadata } from "next";
import { SuperView } from "./view";

export const metadata: Metadata = { title: "Associations" };

export default function SuperPage() {
  return <SuperView />;
}
