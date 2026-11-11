import type { Metadata } from "next";
import { Suspense } from "react";
import { FicheReunionView } from "./view";

export const metadata: Metadata = { title: "Fiche réunion" };

export default function FicheReunionPage() {
  return (
    <Suspense>
      <FicheReunionView />
    </Suspense>
  );
}
