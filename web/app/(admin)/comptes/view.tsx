"use client";

import { ErrorBox } from "@/components/caisse/shared";
import { CompteForm } from "@/components/comptes/compte-form";
import { ListeComptes } from "@/components/comptes/liste-comptes";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { SkeletonTable } from "@/components/ui/skeleton";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Compte } from "@/types";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Comptes de l'association : le président (administrateur) gère les gérants (agents)
export function ComptesView() {
  const { user, isAdmin } = useAuth();
  const { data: comptes, error, reload } = useApi<Compte[]>(isAdmin ? "/utilisateurs" : null);
  const [formOpen, setFormOpen] = useState(false);
  const [aModifier, setAModifier] = useState<Compte | null>(null);
  const [aSupprimer, setASupprimer] = useState<Compte | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!isAdmin) return <ErrorBox message="Cette page est réservée à l'administrateur de l'association." />;

  async function supprimer() {
    if (!aSupprimer) return;
    setDeleting(true);
    try {
      await api("DELETE", `/utilisateurs/${aSupprimer.id}`);
      toast.success("Compte supprimé");
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
        title="Comptes"
        description="Personnes qui peuvent se connecter : administrateurs (président) et agents (gérants)"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Nouveau compte
          </Button>
        }
      />
      {error && <ErrorBox message={error} />}
      {!comptes ? (
        !error && <SkeletonTable rows={3} />
      ) : (
        <ListeComptes comptes={comptes} moiId={user?.id} onEdit={setAModifier} onDelete={setASupprimer} />
      )}

      <CompteForm
        open={formOpen || !!aModifier}
        onClose={() => {
          setFormOpen(false);
          setAModifier(null);
        }}
        onSaved={reload}
        compte={aModifier}
        urlCreation="/utilisateurs"
        urlModification={(id) => `/utilisateurs/${id}`}
      />
      <ConfirmModal
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={supprimer}
        loading={deleting}
        title="Supprimer ce compte ?"
        message={aSupprimer ? `${aSupprimer.nom} ne pourra plus se connecter. Ses encaissements passés sont conservés.` : ""}
        confirmLabel="Supprimer le compte"
      />
    </div>
  );
}
