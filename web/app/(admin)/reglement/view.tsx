"use client";

import { ErrorBox } from "@/components/caisse/shared";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { ReglementAffichage } from "@/components/reglement/reglement-affichage";
import { ReglementEditeur } from "@/components/reglement/reglement-editeur";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { AssociationDetail } from "@/types";
import { Pencil, Scale } from "lucide-react";
import { useState } from "react";

// Lois et règles de l'association : lecture pour tous, modification par l'administrateur
export function ReglementView() {
  const { isAdmin } = useAuth();
  const { data, error, reload } = useApi<AssociationDetail>("/association");
  const [edition, setEdition] = useState(false);
  const reglement = data?.reglement ?? null;
  const vide = !reglement || reglement.sections.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lois et règles"
        description={
          reglement?.misAJourLe
            ? `Règlement de ${data?.nom} · mis à jour le ${fmtDate(reglement.misAJourLe)}`
            : "Règlement de l'association"
        }
        actions={
          isAdmin &&
          data &&
          !edition && (
            <Button variant={vide ? "default" : "outline"} onClick={() => setEdition(true)}>
              <Pencil className="h-4 w-4" />
              {vide ? "Rédiger le règlement" : "Modifier"}
            </Button>
          )
        }
      />

      {error && <ErrorBox message={error} />}

      {!data ? (
        !error && <Skeleton className="h-64" />
      ) : edition ? (
        <ReglementEditeur initial={reglement} onClose={() => setEdition(false)} onSaved={reload} />
      ) : vide ? (
        <EmptyState
          icon={<Scale className="h-8 w-8" />}
          title="Le règlement n'est pas encore rédigé"
          description={
            isAdmin
              ? "Rédigez les lois et règles de votre association : chapitres et articles."
              : "Les lois et règles de l'association apparaîtront ici."
          }
          action={isAdmin ? { label: "Rédiger le règlement", onClick: () => setEdition(true) } : undefined}
        />
      ) : (
        <ReglementAffichage reglement={reglement!} />
      )}
    </div>
  );
}
