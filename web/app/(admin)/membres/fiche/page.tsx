import type { Metadata } from "next";
import { Suspense } from "react";
import { FicheMembreView } from "./view";

export const metadata: Metadata = { title: "Fiche membre" };

export default function FicheMembrePage() {
  return (
    <Suspense>
      <FicheMembreView />
    </Suspense>
  );
}
