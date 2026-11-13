import type { Metadata } from "next";
import { Suspense } from "react";
import { SuperAssociationView } from "./view";

export const metadata: Metadata = { title: "Association" };

export default function SuperAssociationPage() {
  // Suspense requis par useSearchParams lors de l'export statique
  return (
    <Suspense>
      <SuperAssociationView />
    </Suspense>
  );
}
