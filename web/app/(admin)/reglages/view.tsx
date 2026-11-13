"use client";

import { ErrorBox } from "@/components/caisse/shared";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errMsg } from "@/lib/api";
import { eur, regleCotisation } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { AssociationDetail } from "@/types";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Réglages de l'association (administrateur) : nom, cotisation par réunion, fréquence des réunions
export function ReglagesView() {
  const { isAdmin } = useAuth();
  const { data, error, reload } = useApi<AssociationDetail>("/association");

  if (!isAdmin) return <ErrorBox message="Cette page est réservée à l'administrateur de l'association." />;

  return (
    <div className="space-y-6">
      <PageHeader title="Réglages" description="Nom de l'association et règles de cotisation" />
      {error && <ErrorBox message={error} />}
      {!data ? !error && <Skeleton className="h-72 max-w-2xl" /> : <Formulaire key={data.id} asso={data} onSaved={reload} />}
    </div>
  );
}

function Formulaire({ asso, onSaved }: { asso: AssociationDetail; onSaved: () => void }) {
  const { rafraichir } = useAuth();
  const [f, setF] = useState({
    nom: asso.nom,
    montant_cotisation: String(asso.montant_cotisation),
    intervalle_mois: String(asso.intervalle_mois),
  });
  const [loading, setLoading] = useState(false);
  const apercu = {
    montant_cotisation: Number(f.montant_cotisation) || 0,
    intervalle_mois: Number(f.intervalle_mois) || 1,
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("PUT", "/association", f);
      toast.success("Réglages enregistrés");
      onSaved();
      await rafraichir(); // le nom et les montants affichés partout se mettent à jour
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Association</CardTitle>
        <CardDescription>Ces réglages s&apos;appliquent aux nouvelles réunions.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              id="r-nom"
              label="Nom de l'association"
              required
              value={f.nom}
              onChange={(e) => setF({ ...f, nom: e.target.value })}
            />
          </div>
          <Input
            id="r-montant"
            label="Cotisation par réunion (€)"
            type="number"
            min={0}
            step="0.01"
            required
            value={f.montant_cotisation}
            onChange={(e) => setF({ ...f, montant_cotisation: e.target.value })}
            hint={`Soit ${eur(apercu.montant_cotisation / apercu.intervalle_mois)} par mois`}
          />
          <Select
            id="r-intervalle"
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
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
            Règle appliquée : <b className="text-foreground">{regleCotisation(apercu)}</b>. Les réunions déjà
            créées gardent leur montant.
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" isLoading={loading}>
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
