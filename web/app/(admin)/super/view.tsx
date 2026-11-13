"use client";

import { ErrorBox } from "@/components/caisse/shared";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SkeletonTable } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { api, errMsg } from "@/lib/api";
import { fmtDate, regleCotisation } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { AssociationResume } from "@/types";
import { Building2, CalendarDays, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

// Espace super-admin : toutes les associations de l'application
export function SuperView() {
  const router = useRouter();
  const { data: associations, error, reload } = useApi<AssociationResume[]>("/superadmin/associations");
  const pg = usePagination(associations);
  const [formOpen, setFormOpen] = useState(false);

  const actives = associations?.filter((a) => a.actif).length ?? 0;
  const membres = associations?.reduce((n, a) => n + a.membres, 0) ?? 0;
  const ouvrir = (id: number) => router.push(`/super/association?id=${id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Associations"
        description="Associations qui utilisent FOTTAL"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle association
          </Button>
        }
      />

      {associations && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Associations" value={associations.length} icon={Building2} tone="primary" />
          <StatCard label="Actives" value={actives} icon={CalendarDays} tone="success" />
          <StatCard label="Membres actifs" value={membres} icon={Users} tone="info" hint="toutes associations" />
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {!associations ? (
        !error && <SkeletonTable rows={4} />
      ) : associations.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="Aucune association"
          description="Créez la première association et le compte de son président."
          action={{ label: "Créer une association", onClick: () => setFormOpen(true) }}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Association</th>
                  <th className="px-5 py-3">Président</th>
                  <th className="px-5 py-3">Téléphone</th>
                  <th className="px-5 py-3">Ville</th>
                  <th className="px-5 py-3">Comptes</th>
                  <th className="px-5 py-3 text-right">Membres</th>
                  <th className="px-5 py-3 text-right">Réunions</th>
                  <th className="px-5 py-3">Dernière réunion</th>
                  <th className="px-5 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((a) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onClick={() => ouvrir(a.id)}
                    onKeyDown={(e) => e.key === "Enter" && ouvrir(a.id)}
                    className="cursor-pointer border-b border-border hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.nom}</p>
                      <p className="text-xs text-muted-foreground">{regleCotisation(a)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.president || "—"}</p>
                      {a.administrateurs && a.administrateurs !== a.president && (
                        <p className="text-xs text-muted-foreground">Admins : {a.administrateurs}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{a.president_telephone || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.president_ville || "—"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                      {a.comptes} compte{a.comptes > 1 ? "s" : ""}
                      <p className="text-xs">
                        {a.comptes - a.agents} admin · {a.agents} agent{a.agents > 1 ? "s" : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{a.membres}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{a.reunions}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{fmtDate(a.derniere_reunion)}</td>
                    <td className="px-5 py-3">
                      {a.actif ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Désactivée</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...pg} />
        </Card>
      )}

      {formOpen && <NouvelleAssociation onClose={() => setFormOpen(false)} onSaved={reload} />}
    </div>
  );
}

// Création d'une association et du compte de son président (administrateur)
function NouvelleAssociation({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ nom: "", montant_cotisation: "30", intervalle_mois: "2" });
  const [admin, setAdmin] = useState({ nom: "", email: "", motDePasse: "", telephone: "", adresse: "", ville: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("POST", "/superadmin/associations", { ...f, admin });
      toast.success(`Association « ${f.nom} » créée`);
      onSaved();
      onClose();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouvelle association"
      description="Le président pourra ensuite créer les comptes de ses gérants."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-asso" isLoading={loading}>
            Créer l&apos;association
          </Button>
        </>
      }
    >
      <form id="form-asso" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input id="a-nom" label="Nom de l'association" required value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        </div>
        <Input
          id="a-montant"
          label="Cotisation par réunion (€)"
          type="number"
          min={0}
          step="0.01"
          required
          value={f.montant_cotisation}
          onChange={(e) => setF({ ...f, montant_cotisation: e.target.value })}
        />
        <Select
          id="a-intervalle"
          label="Une réunion tous les…"
          value={f.intervalle_mois}
          onChange={(e) => setF({ ...f, intervalle_mois: e.target.value })}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "mois" : `${n} mois`}
            </option>
          ))}
        </Select>

        <p className="border-t border-border pt-4 text-sm font-semibold sm:col-span-2">Président (administrateur)</p>
        <Input id="a-pnom" label="Nom" required value={admin.nom} onChange={(e) => setAdmin({ ...admin, nom: e.target.value })} />
        <Input
          id="a-pemail"
          label="Email de connexion"
          type="email"
          required
          autoComplete="off"
          value={admin.email}
          onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
        />
        <Input
          id="a-ptel"
          label="Téléphone"
          type="tel"
          value={admin.telephone}
          onChange={(e) => setAdmin({ ...admin, telephone: e.target.value })}
        />
        <Input id="a-pville" label="Ville" value={admin.ville} onChange={(e) => setAdmin({ ...admin, ville: e.target.value })} />
        <div className="sm:col-span-2">
          <Input
            id="a-padresse"
            label="Adresse"
            placeholder="N°, rue, code postal"
            value={admin.adresse}
            onChange={(e) => setAdmin({ ...admin, adresse: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            id="a-pmdp"
            label="Mot de passe provisoire"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={admin.motDePasse}
            onChange={(e) => setAdmin({ ...admin, motDePasse: e.target.value })}
            hint="8 caractères minimum, à communiquer au président"
          />
        </div>
      </form>
    </Modal>
  );
}
