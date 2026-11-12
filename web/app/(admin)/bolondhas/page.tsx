import type { Metadata } from "next";
import { BolondhasView } from "./view";

export const metadata: Metadata = { title: "Bolondhas" };

export default function BolondhasPage() {
  return <BolondhasView />;
}
