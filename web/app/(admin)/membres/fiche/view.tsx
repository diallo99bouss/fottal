"use client";

import { ErrorBox } from "@/components/caisse/shared";
import { detailVersement, VersementButton } from "@/components/caisse/versement";
import { MembreForm } from "@/components/caisse/membre-form";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { api, errMsg } from "@/lib/api";
import { aujourdhui, eur, fmtDate, nomComplet } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { MembreDetail } from "@/types";
import { CalendarX, HandCoins, Mail, MapPin, Pencil, Phone, Trash2, Wallet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function FicheMembreView() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const { data: m, error, reload } = useApi<MembreDetail>(id ? `/membres/${id}` : null);
  const pg = usePagination(m?.historique);
  // Ce qu'il doit jusqu'à chaque réunion incluse (retards + cotisation du jour) : montant proposé à l'encaissement
  const duJusqua = new Map<number, number>();
  [...(m?.historique ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .reduce((cumul, h) => {
      const total = cumul + (h.montant - h.couvert);
      duJusqua.set(h.id, total);
      return total;
    }, 0);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function supprimer() {
    setDeleting(true);
    try {
      await api("DELETE", `/membres/${id}`);
      toast.success("Membre supprimé");
      router.replace("/membres");
    } catch (ex) {
      toast.error(errMsg(ex));
      setDeleting(false);
    }
  }

  if (!id) return <ErrorBox message="Aucun membre sélectionné." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={m ? nomComplet(m) : "Fiche membre"}
        description={m ? `Membre depuis le ${fmtDate(m.date_adhesion)}` : undefined}
        actions={
          isAdmin &&
          m && (
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

      {!m ? (
        !error && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[104px]" />
              ))}
            </div>
            <SkeletonTable rows={4} />
          </>
        )
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex items-center gap-4 p-5">
              <Avatar name={nomComplet(m)} size="lg" />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{m.telephone || "Pas de téléphone"}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{m.email || "Pas d'email"}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{m.ville || "Ville non renseignée"}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {m.actif ? <Badge variant="info">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}
                  {m.bolondha && <Badge variant="default">{m.bolondha}</Badge>}
                </div>
              </div>
            </Card>
            <StatCard
              label="Total versé"
              value={eur(m.total_paye)}
              icon={HandCoins}
              tone="primary"
              hint={`sur ${eur(m.total_attendu)} attendus depuis son adhésion`}
            />
            {m.avance > 0 ? (
              <StatCard label="Avance" value={eur(m.avance)} icon={Wallet} tone="info" hint="versé en plus de l'attendu" />
            ) : (
              <StatCard
                label="Reste dû"
                value={eur(m.montant_du)}
                icon={m.montant_du > 0 ? CalendarX : Wallet}
                tone={m.montant_du > 0 ? "destructive" : "success"}
                hint={
                  m.reunions_dues > 0
                    ? `${m.reunions_dues} réunion${m.reunions_dues > 1 ? "s" : ""} pas entièrement payée${m.reunions_dues > 1 ? "s" : ""}`
                    : "à jour"
                }
              />
            )}
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Historique des cotisations</CardTitle>
              <CardDescription>Réunions depuis son adhésion</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {m.historique.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Aucune réunion depuis son adhésion.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-sm">
                    <thead className="border-y border-border bg-muted/50 text-left text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Lieu</th>
                        <th className="px-5 py-3">Versé le</th>
                        <th className="px-5 py-3 text-right">Attendu</th>
                        <th className="px-5 py-3 text-right">Versement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pg.pageItems.map((r) => (
                        <tr key={r.id} className="border-b border-border hover:bg-muted/50">
                          <td className="whitespace-nowrap px-5 py-3 font-medium">{fmtDate(r.date)}</td>
                          <td className="px-5 py-3">
                            <p className="text-muted-foreground">{r.lieu || "Réunion"}</p>
                            {detailVersement({ attendu: r.montant, paye: r.montant_paye, couvert: r.couvert }) && (
                              <p className="text-xs text-muted-foreground">
                                {detailVersement({ attendu: r.montant, paye: r.montant_paye, couvert: r.couvert })}
                              </p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                            {r.paye_le ? fmtDate(r.paye_le) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-muted-foreground">
                            {eur(r.montant)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <VersementButton
                              reunionId={r.id}
                              membreId={m.id}
                              membreNom={nomComplet(m)}
                              attendu={r.montant}
                              paye={r.montant_paye}
                              couvert={r.couvert}
                              duCumule={duJusqua.get(r.id)}
                              aVenir={r.date > aujourdhui()}
                              mode={r.mode}
                              onChange={reload}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination {...pg} />
            </CardContent>
          </Card>

          <MembreForm open={editOpen} onClose={() => setEditOpen(false)} onSaved={reload} membre={m} />
          <ConfirmModal
            open={delOpen}
            onClose={() => setDelOpen(false)}
            onConfirm={supprimer}
            loading={deleting}
            title="Supprimer ce membre ?"
            message={`${nomComplet(m)} et tout son historique de cotisations seront supprimés. Cette action est définitive.`}
          />
        </>
      )}
    </div>
  );
}
