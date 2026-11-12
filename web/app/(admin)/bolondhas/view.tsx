"use client";

import { BolondhaForm } from "@/components/caisse/bolondha-form";
import { RowActions } from "@/components/caisse/row-actions";
import { ErrorBox } from "@/components/caisse/shared";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { SkeletonTable } from "@/components/ui/skeleton";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Bolondha } from "@/types";
import { MapPinned, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function BolondhasView() {
  const { isAdmin } = useAuth();
  const { data: bolondhas, error, reload } = useApi<Bolondha[]>("/bolondhas");
  const pg = usePagination(bolondhas);
  const [formOpen, setFormOpen] = useState(false);
  const [aModifier, setAModifier] = useState<Bolondha | null>(null);
  const [aSupprimer, setASupprimer] = useState<Bolondha | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function supprimer() {
    if (!aSupprimer) return;
    setDeleting(true);
    try {
      await api("DELETE", `/bolondhas/${aSupprimer.id}`);
      toast.success("Bolondha supprimée");
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
        title="Bolondhas"
        description={
          bolondhas
            ? `${bolondhas.length} bolondha${bolondhas.length > 1 ? "s" : ""} · rattachez chaque membre à sa bolondha`
            : "Chargement…"
        }
        actions={
          isAdmin && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle bolondha
            </Button>
          )
        }
      />

      {error && <ErrorBox message={error} />}

      {!bolondhas ? (
        !error && <SkeletonTable rows={3} />
      ) : bolondhas.length === 0 ? (
        <EmptyState
          icon={<MapPinned className="h-8 w-8" />}
          title="Aucune bolondha"
          description={isAdmin ? "Ajoutez les bolondhas de l'association (ex. Kourasadio, Kowly…)." : undefined}
          action={isAdmin ? { label: "Ajouter une bolondha", onClick: () => setFormOpen(true) } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Nom</th>
                  <th className="px-5 py-3">Membres</th>
                  {isAdmin && (
                    <th className="px-5 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((b) => (
                  <tr key={b.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MapPinned className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="font-medium">{b.nom}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/membres?bolondha=${b.id}`}
                        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary hover:underline"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {b.nb_membres} membre{b.nb_membres > 1 ? "s" : ""}
                      </Link>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <RowActions
                          label={b.nom}
                          onEdit={() => setAModifier(b)}
                          onDelete={() => setASupprimer(b)}
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

      <BolondhaForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
      <BolondhaForm
        open={!!aModifier}
        onClose={() => setAModifier(null)}
        onSaved={reload}
        bolondha={aModifier}
      />
      <ConfirmModal
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        loading={deleting}
        title="Supprimer cette bolondha ?"
        message={
          aSupprimer
            ? aSupprimer.nb_membres > 0
              ? `« ${aSupprimer.nom} » a encore ${aSupprimer.nb_membres} membre${aSupprimer.nb_membres > 1 ? "s" : ""} : changez d'abord leur bolondha, sinon la suppression sera refusée.`
              : `« ${aSupprimer.nom} » sera supprimée définitivement.`
            : ""
        }
      />
    </div>
  );
}
