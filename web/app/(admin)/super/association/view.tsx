"use client";

import { ErrorBox } from "@/components/caisse/shared";
import { CompteForm } from "@/components/comptes/compte-form";
import { ListeComptes } from "@/components/comptes/liste-comptes";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { api, errMsg } from "@/lib/api";
import { fmtDate, regleCotisation } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { AssociationResume, Compte } from "@/types";
import { CalendarDays, Pencil, Power, UserCog, UserPlus, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

// Fiche d'une association pour le super-admin : comptes, renommage, activation
export function SuperAssociationView() {
  const id = Number(useSearchParams().get("id"));
  const liste = useApi<AssociationResume[]>("/superadmin/associations");
  const comptes = useApi<Compte[]>(id ? `/superadmin/associations/${id}/comptes` : null);
  const [compteOpen, setCompteOpen] = useState(false);
  const [aModifier, setAModifier] = useState<Compte | null>(null);
  const [renommer, setRenommer] = useState(false);
  const [basculer, setBasculer] = useState(false);
  const [busy, setBusy] = useState(false);

  const a = liste.data?.find((x) => x.id === id);

  async function changerStatut() {
    if (!a) return;
    setBusy(true);
    try {
      await api("PUT", `/superadmin/associations/${a.id}`, { actif: !a.actif });
      toast.success(a.actif ? "Association désactivée" : "Association réactivée");
      setBasculer(false);
      liste.reload();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setBusy(false);
    }
  }

  if (!id) return <ErrorBox message="Aucune association sélectionnée." />;
  if (liste.data && !a) return <ErrorBox message="Association introuvable." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={a?.nom ?? "Association"}
        description={a ? `${regleCotisation(a)} · créée le ${fmtDate(a.cree_le)}` : undefined}
        actions={
          a && (
            <>
              <Button variant="outline" onClick={() => setRenommer(true)}>
                <Pencil className="h-4 w-4" />
                Renommer
              </Button>
              <Button
                variant="outline"
                className={a.actif ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : ""}
                onClick={() => setBasculer(true)}
              >
                <Power className="h-4 w-4" />
                {a.actif ? "Désactiver" : "Réactiver"}
              </Button>
            </>
          )
        }
      />

      {liste.error && <ErrorBox message={liste.error} />}

      {!a ? (
        !liste.error && <Skeleton className="h-[104px]" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Membres actifs" value={a.membres} icon={Users} tone="primary" />
          <StatCard
            label="Réunions"
            value={a.reunions}
            icon={CalendarDays}
            tone="info"
            hint={a.derniere_reunion ? `dernière le ${fmtDate(a.derniere_reunion)}` : "aucune pour l'instant"}
          />
          <StatCard
            label="Statut"
            value={a.actif ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Désactivée</Badge>}
            icon={Power}
            tone={a.actif ? "success" : "warning"}
            hint={a.actif ? "ses comptes peuvent se connecter" : "connexion bloquée pour ses comptes"}
          />
        </div>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              Comptes
            </CardTitle>
            <CardDescription>Président(s) et gérants. Le crayon permet de réinitialiser un mot de passe.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCompteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Ajouter un compte
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {comptes.error && <ErrorBox message={comptes.error} />}
          {!comptes.data ? (
            !comptes.error && <SkeletonTable rows={2} />
          ) : (
            <ListeComptes comptes={comptes.data} onEdit={setAModifier} />
          )}
        </CardContent>
      </Card>

      <CompteForm
        open={compteOpen || !!aModifier}
        onClose={() => {
          setCompteOpen(false);
          setAModifier(null);
        }}
        onSaved={() => {
          comptes.reload();
          liste.reload();
        }}
        compte={aModifier}
        roleParDefaut="admin"
        urlCreation={`/superadmin/associations/${id}/comptes`}
        urlModification={(cid) => `/superadmin/comptes/${cid}`}
      />
      {renommer && a && (
        <Renommer
          nom={a.nom}
          onClose={() => setRenommer(false)}
          onSave={async (nom) => {
            await api("PUT", `/superadmin/associations/${a.id}`, { nom });
            toast.success("Association renommée");
            liste.reload();
          }}
        />
      )}
      <ConfirmModal
        open={basculer}
        onClose={() => setBasculer(false)}
        onConfirm={changerStatut}
        loading={busy}
        title={a?.actif ? "Désactiver cette association ?" : "Réactiver cette association ?"}
        message={
          a?.actif
            ? "Ses comptes ne pourront plus se connecter. Aucune donnée n'est supprimée : vous pourrez la réactiver à tout moment."
            : "Ses comptes pourront de nouveau se connecter."
        }
        confirmLabel={a?.actif ? "Désactiver" : "Réactiver"}
      />
    </div>
  );
}

function Renommer({ nom, onClose, onSave }: { nom: string; onClose: () => void; onSave: (nom: string) => Promise<void> }) {
  const [valeur, setValeur] = useState(nom);
  const [loading, setLoading] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title="Renommer l'association"
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-renommer" isLoading={loading}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="form-renommer"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          try {
            await onSave(valeur);
            onClose();
          } catch (ex) {
            toast.error(errMsg(ex));
          } finally {
            setLoading(false);
          }
        }}
      >
        <Input id="ren-nom" label="Nom" required value={valeur} onChange={(e) => setValeur(e.target.value)} />
      </form>
    </Modal>
  );
}
