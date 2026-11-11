"use client";

import { DueBadge, ErrorBox } from "@/components/caisse/shared";
import { MembreForm } from "@/components/caisse/membre-form";
import { RowActions } from "@/components/caisse/row-actions";
import { ConfirmModal } from "@/components/ui/modal";
import { api, errMsg } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { fmtDate, nomComplet } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Membre } from "@/types";
import { Search, UserPlus, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function MembresView() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const qUrl = params.get("q") ?? "";
  const [q, setQ] = useState(qUrl);
  const [recherche, setRecherche] = useState(qUrl);
  const [formOpen, setFormOpen] = useState(false);
  const [aModifier, setAModifier] = useState<Membre | null>(null);
  const [aSupprimer, setASupprimer] = useState<Membre | null>(null);
  const [deleting, setDeleting] = useState(false);

  // La recherche du header change ?q= : on suit l'URL
  const [qUrlPrec, setQUrlPrec] = useState(qUrl);
  if (qUrl !== qUrlPrec) {
    setQUrlPrec(qUrl);
    setQ(qUrl);
    setRecherche(qUrl);
  }

  // Attend 250 ms après la dernière frappe avant d'interroger l'API
  useEffect(() => {
    const t = setTimeout(() => setRecherche(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: membres, error, reload } = useApi<Membre[]>(
    "/membres" + (recherche ? "?q=" + encodeURIComponent(recherche) : ""),
  );

  const ouvrir = (id: number) => router.push(`/membres/fiche?id=${id}`);

  async function supprimer() {
    if (!aSupprimer) return;
    setDeleting(true);
    try {
      await api("DELETE", `/membres/${aSupprimer.id}`);
      toast.success("Membre supprimé");
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
        title="Membres"
        description={membres ? `${membres.length} membre${membres.length > 1 ? "s" : ""}` : "Chargement…"}
        actions={
          isAdmin && (
            <Button onClick={() => setFormOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Nouveau membre
            </Button>
          )
        }
      />

      <div className="max-w-sm">
        <Input
          id="recherche-membres"
          type="search"
          aria-label="Rechercher un membre"
          placeholder="Rechercher un nom ou un téléphone"
          icon={<Search className="h-4 w-4" />}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <ErrorBox message={error} />}

      {!membres ? (
        !error && <SkeletonTable rows={5} />
      ) : membres.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title={recherche ? "Aucun membre ne correspond" : "Aucun membre pour l'instant"}
          description={
            recherche
              ? "Essayez avec une autre partie du nom ou du numéro."
              : isAdmin
                ? "Ajoutez le premier membre de l'association."
                : undefined
          }
          action={!recherche && isAdmin ? { label: "Ajouter un membre", onClick: () => setFormOpen(true) } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Membre</th>
                  <th className="px-5 py-3">Téléphone</th>
                  <th className="px-5 py-3">Adhésion</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Cotisations</th>
                  {isAdmin && (
                    <th className="px-5 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {membres.map((m) => (
                  <tr
                    key={m.id}
                    tabIndex={0}
                    onClick={() => ouvrir(m.id)}
                    onKeyDown={(e) => e.key === "Enter" && ouvrir(m.id)}
                    className="cursor-pointer border-b border-border hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={nomComplet(m)} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{nomComplet(m)}</p>
                          {m.email && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{m.telephone || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{fmtDate(m.date_adhesion)}</td>
                    <td className="px-5 py-3">
                      {m.actif ? <Badge variant="info">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <DueBadge montant={m.montant_du} />
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <RowActions
                          label={nomComplet(m)}
                          onEdit={() => setAModifier(m)}
                          onDelete={() => setASupprimer(m)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <MembreForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
      <MembreForm
        open={!!aModifier}
        onClose={() => setAModifier(null)}
        onSaved={reload}
        membre={aModifier}
      />
      <ConfirmModal
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        loading={deleting}
        title="Supprimer ce membre ?"
        message={
          aSupprimer
            ? `${nomComplet(aSupprimer)} et tout son historique de cotisations seront supprimés. Cette action est définitive.`
            : ""
        }
      />
    </div>
  );
}
