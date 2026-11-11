import type { Metadata } from "next";
import { Suspense } from "react";
import { MembresView } from "./view";

export const metadata: Metadata = { title: "Membres" };

export default function MembresPage() {
  // Suspense requis par useSearchParams lors de l'export statique
  return (
    <Suspense>
      <MembresView />
    </Suspense>
  );
}
