"use client";

import { ErrorBox, PayButton, Progress } from "@/components/caisse/shared";
import { ReunionForm } from "@/components/caisse/reunion-form";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/modal";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { api, errMsg } from "@/lib/api";
import { eur, fmtDate, nomComplet } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { ReunionDetail } from "@/types";
import { AlertTriangle, CheckCircle2, FileText, Pencil, PiggyBank, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function FicheReunionView() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { data: r, error, reload } = useApi<ReunionDetail>(id ? `/reunions/${id}` : null);
  const [filtre, setFiltre] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function supprimer() {
    setDeleting(true);
    try {
      await api("DELETE", `/reunions/${id}`);
      toast.success("Réunion supprimée");
      router.replace("/reunions");
    } catch (ex) {
      toast.error(errMsg(ex));
      setDeleting(false);
    }
  }

  if (!id) return <ErrorBox message="Aucune réunion sélectionnée." />;

  const f = filtre.trim().toLowerCase();
  const membres = (r?.membres ?? []).filter(
    (m) => !f || nomComplet(m).toLowerCase().includes(f) || (m.telephone ?? "").includes(f),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={r ? `Réunion du ${fmtDate(r.date)}` : "Fiche réunion"}
        description={r ? `${r.lieu || "Lieu non précisé"} · cotisation ${eur(r.montant)}` : undefined}
        actions={
          isAdmin &&
          r && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDelOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            </>
          )
        }
      />

      {error && <ErrorBox message={error} />}

      {!r ? (
        !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px]" />
              ))}
            </div>
            <SkeletonTable rows={5} />
          </>
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Payé"
              value={`${r.payes}/${r.attendus}`}
              icon={CheckCircle2}
              tone="primary"
              hint={<Progress value={r.payes} max={r.attendus} />}
            />
            <StatCard label="Encaissé" value={eur(r.encaisse)} icon={PiggyBank} tone="success" />
            <StatCard
              label="Reste à encaisser"
              value={eur(r.reste)}
              icon={AlertTriangle}
              tone={r.reste > 0 ? "destructive" : "success"}
            />
          </div>

          {r.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Ordre du jour / notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Membres attendus</CardTitle>
                <CardDescription>Membres actifs inscrits avant la date de la réunion</CardDescription>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  id="filtre-membres-reunion"
                  type="search"
                  aria-label="Filtrer les membres"
                  placeholder="Filtrer…"
                  icon={<Search className="h-4 w-4" />}
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {r.membres.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Aucun membre inscrit à cette date.</p>
              ) : membres.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Aucun membre ne correspond.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {membres.map((m) => {
                    const paye = !!m.cotisation_id;
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                        <Avatar name={nomComplet(m)} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{nomComplet(m)}</p>
                          <p className="text-xs text-muted-foreground">
                            {paye ? `Payé le ${fmtDate(m.paye_le)}` : m.telephone || "Non payé"}
                          </p>
                        </div>
                        <PayButton reunionId={r.id} membreId={m.id} paye={paye} onChange={reload} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <ReunionForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={reload} reunion={r} />
          <ConfirmModal
            open={delOpen}
            onClose={() => setDelOpen(false)}
            onConfirm={supprimer}
            loading={deleting}
            title="Supprimer cette réunion ?"
            message="La réunion et toutes les cotisations enregistrées pour elle seront supprimées. Cette action est définitive."
          />
        </>
      )}
    </div>
  );
}
