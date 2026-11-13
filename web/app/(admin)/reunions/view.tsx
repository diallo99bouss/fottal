"use client";

import { DateBox, ErrorBox, Progress } from "@/components/caisse/shared";
import { ReunionForm } from "@/components/caisse/reunion-form";
import { RowActions } from "@/components/caisse/row-actions";
import { ConfirmModal } from "@/components/ui/modal";
import { api, errMsg } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SkeletonTable } from "@/components/ui/skeleton";
import { aujourdhui, eur, fmtDate, regleCotisation } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";
import type { Reunion } from "@/types";
import { CalendarDays, CalendarPlus, Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReunionsView() {
  const { isAdmin, association } = useAuth();
  const router = useRouter();
  const reunions = useApi<Reunion[]>("/reunions");
  const pg = usePagination(reunions.data);
  const conseil = useApi<{ date: string | null }>("/reunions/prochaine-date");
  const [formOpen, setFormOpen] = useState(false);
  const [aModifier, setAModifier] = useState<Reunion | null>(null);
  const [aSupprimer, setASupprimer] = useState<Reunion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const today = aujourdhui();

  const ouvrir = (id: number) => router.push(`/reunions/fiche?id=${id}`);
  const reload = () => {
    reunions.reload();
    conseil.reload();
  };

  async function supprimer() {
    if (!aSupprimer) return;
    setDeleting(true);
    try {
      await api("DELETE", `/reunions/${aSupprimer.id}`);
      toast.success("Réunion supprimée");
      setASupprimer(null);
      reload();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réunions"
        description={regleCotisation(association)}
        actions={
          isAdmin && (
            <Button onClick={() => setFormOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              Nouvelle réunion
            </Button>
          )
        }
      />

      {conseil.data?.date && (
        <p className="flex items-center gap-2 rounded-lg border border-info/20 bg-info/10 px-4 py-2.5 text-sm text-info">
          <Lightbulb className="h-4 w-4 shrink-0" />
          <span>
            Prochaine date conseillée : <b>{fmtDate(conseil.data.date)}</b>
          </span>
        </p>
      )}

      {reunions.error && <ErrorBox message={reunions.error} />}

      {!reunions.data ? (
        !reunions.error && <SkeletonTable rows={4} />
      ) : reunions.data.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          title="Aucune réunion"
          description={isAdmin ? "Créez la première réunion pour commencer à encaisser." : undefined}
          action={isAdmin ? { label: "Créer une réunion", onClick: () => setFormOpen(true) } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Réunion</th>
                  <th className="px-5 py-3">Paiements</th>
                  <th className="px-5 py-3 text-right">Encaissé</th>
                  <th className="px-5 py-3 text-right">Reste dû</th>
                  <th className="px-5 py-3 text-right">Aides</th>
                  <th className="px-5 py-3">Restant</th>
                  {isAdmin && (
                    <th className="px-5 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => ouvrir(r.id)}
                    onKeyDown={(e) => e.key === "Enter" && ouvrir(r.id)}
                    className="cursor-pointer border-b border-border hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <DateBox date={r.date} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.lieu || "Réunion"}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(r.date)} · {eur(r.montant)} / membre
                          </p>
                        </div>
                        {r.date > today && <Badge variant="info">À venir</Badge>}
                      </div>
                    </td>
                    <td className="min-w-40 px-5 py-3">
                      <p className="mb-1.5 text-xs text-muted-foreground tabular-nums">
                        {r.payes}/{r.attendus} payé
                      </p>
                      <Progress value={r.payes} max={r.attendus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">
                      {eur(r.encaisse)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.reste > 0 ? (
                        <Badge variant="danger" className="tabular-nums">
                          {eur(r.reste)} dus
                        </Badge>
                      ) : r.attendus ? (
                        <Badge variant="success">Complet</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                      {r.total_aides > 0 ? (
                        <span className="text-destructive">− {eur(r.total_aides)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium tabular-nums">{eur(r.restant)}</p>
                      {r.depositaires && (
                        <p className={cn("text-xs", r.a_confier < 0 ? "text-warning" : "text-muted-foreground")}>
                          {r.a_confier < 0 ? "⚠ " : "→ "}
                          {r.depositaires}
                        </p>
                      )}
                      {r.a_confier > 0 && (
                        <p className="text-xs text-warning">
                          {r.total_remis > 0 ? `${eur(r.a_confier)} restent à confier` : "non confié"}
                        </p>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <RowActions
                          label={`la réunion du ${fmtDate(r.date)}`}
                          onEdit={() => setAModifier(r)}
                          onDelete={() => setASupprimer(r)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pg} />
        </Card>
      )}

      <ReunionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
      <ReunionForm
        open={!!aModifier}
        onClose={() => setAModifier(null)}
        onSaved={reload}
        reunion={aModifier}
      />
      <ConfirmModal
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        loading={deleting}
        title="Supprimer cette réunion ?"
        message={
          aSupprimer
            ? `La réunion du ${fmtDate(aSupprimer.date)} et toutes les cotisations enregistrées pour elle seront supprimées. Cette action est définitive.`
            : ""
        }
      />
    </div>
  );
}
