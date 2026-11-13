"use client";

import { AideForm } from "@/components/caisse/aide-form";
import { RemisesReunion } from "@/components/caisse/remises-reunion";
import { RowActions } from "@/components/caisse/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/modal";
import { api, errMsg } from "@/lib/api";
import { eur, TYPES_AIDE } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type { Aide, Membre, ReunionDetail } from "@/types";
import { HandCoins, HandHeart, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const couleurType = { maladie: "warning", deces: "secondary", autre: "info" } as const;

// Encaissé − aides = restant, puis remise du restant à un membre
export function BilanReunion({ r, onChange }: { r: ReunionDetail; onChange: () => void }) {
  const { data: membres } = useApi<Membre[]>("/membres");
  const [formOpen, setFormOpen] = useState(false);
  const [aModifier, setAModifier] = useState<Aide | null>(null);
  const [aSupprimer, setASupprimer] = useState<Aide | null>(null);
  const [busy, setBusy] = useState(false);

  async function action(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChange();
      return true;
    } catch (ex) {
      toast.error(errMsg(ex));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const ligne = "flex items-center justify-between gap-4 px-5 py-2.5 text-sm";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-muted-foreground" />
            Bilan de la réunion
          </CardTitle>
          <CardDescription>Cotisations du jour, aides versées et restant confié à un membre</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setFormOpen(true)} disabled={r.a_confier <= 0}>
          <Plus className="h-4 w-4" />
          Ajouter une aide
        </Button>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {/* Calcul */}
        <div className="border-y border-border">
          <div className={ligne}>
            <span className="text-muted-foreground">Cotisations encaissées</span>
            <span className="font-medium tabular-nums">{eur(r.encaisse)}</span>
          </div>
          <div className={ligne}>
            <span className="text-muted-foreground">
              Aides versées{r.aides.length > 0 && ` (${r.aides.length})`}
            </span>
            <span className={cn("font-medium tabular-nums", r.total_aides > 0 && "text-destructive")}>
              − {eur(r.total_aides)}
            </span>
          </div>
          <div className={cn(ligne, "border-t border-border bg-muted/40 py-3")}>
            <span className="font-semibold">Restant</span>
            <span className="text-lg font-semibold tabular-nums">{eur(r.restant)}</span>
          </div>
        </div>

        {/* Aides */}
        {r.aides.length > 0 && (
          <ul className="divide-y divide-border border-b border-border">
            {r.aides.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                  <HandHeart className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{a.beneficiaire_nom}</span>
                    <Badge variant={couleurType[a.type]}>{TYPES_AIDE[a.type]}</Badge>
                    {!a.membre_id && <span className="text-xs font-normal text-muted-foreground">extérieur</span>}
                  </p>
                  {a.motif && <p className="truncate text-xs text-muted-foreground">{a.motif}</p>}
                </div>
                <span className="font-medium tabular-nums text-destructive">− {eur(a.montant)}</span>
                <RowActions
                  label={`l'aide à ${a.beneficiaire_nom}`}
                  onEdit={() => setAModifier(a)}
                  onDelete={() => setASupprimer(a)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Restant confié à une ou plusieurs personnes */}
        <RemisesReunion r={r} membres={membres ?? []} onChange={onChange} />
      </CardContent>

      <AideForm
        open={formOpen || !!aModifier}
        onClose={() => {
          setFormOpen(false);
          setAModifier(null);
        }}
        onSaved={onChange}
        reunionId={r.id}
        membres={membres ?? []}
        disponible={r.a_confier}
        aide={aModifier}
      />
      <ConfirmModal
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={async () => {
          if (await action(() => api("DELETE", `/reunions/${r.id}/aides/${aSupprimer!.id}`), "Aide supprimée")) {
            setASupprimer(null);
          }
        }}
        loading={busy}
        title="Supprimer cette aide ?"
        message={aSupprimer ? `L'aide de ${eur(aSupprimer.montant)} à ${aSupprimer.beneficiaire_nom} sera supprimée.` : ""}
      />
    </Card>
  );
}
