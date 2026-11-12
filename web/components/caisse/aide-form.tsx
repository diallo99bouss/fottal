"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { eur, nomComplet, TYPES_AIDE } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Aide, Membre, TypeAide } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reunionId: number;
  membres: Membre[];
  disponible: number; // argent encore disponible sur la réunion (hors aide modifiée)
  aide?: Aide | null;
}

export function AideForm(props: Props) {
  return props.open ? <AideFormInner key={props.aide?.id ?? "nouvelle"} {...props} /> : null;
}

function AideFormInner({ onClose, onSaved, reunionId, membres, disponible, aide }: Props) {
  const isNew = !aide;
  // Bénéficiaire : un membre de la liste, ou une personne extérieure saisie à la main
  const [externe, setExterne] = useState(aide ? !aide.membre_id : false);
  const [f, setF] = useState({
    type: (aide?.type ?? "maladie") as TypeAide,
    membre_id: aide?.membre_id ? String(aide.membre_id) : "",
    beneficiaire_nom: aide && !aide.membre_id ? aide.beneficiaire_nom : "",
    montant: aide ? String(aide.montant) : "",
    motif: aide?.motif ?? "",
  });
  const [loading, setLoading] = useState(false);
  const max = disponible + (aide?.montant ?? 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body = {
      type: f.type,
      montant: f.montant,
      motif: f.motif,
      membre_id: externe ? null : f.membre_id || null,
      beneficiaire_nom: externe ? f.beneficiaire_nom : null,
    };
    try {
      if (isNew) await api("POST", `/reunions/${reunionId}/aides`, body);
      else await api("PUT", `/reunions/${reunionId}/aides/${aide!.id}`, body);
      toast.success(isNew ? "Aide enregistrée" : "Aide modifiée");
      onSaved();
      onClose();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  const choix = (actif: boolean) =>
    cn(
      "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      actif ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Nouvelle aide" : "Modifier l'aide"}
      description={`Disponible sur cette réunion : ${eur(max)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-aide" isLoading={loading}>
            {isNew ? "Enregistrer l'aide" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="form-aide" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Select
          id="a-type"
          label="Type d'aide"
          value={f.type}
          onChange={(e) => setF({ ...f, type: e.target.value as TypeAide })}
        >
          {Object.entries(TYPES_AIDE).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input
          id="a-montant"
          label="Montant (€)"
          type="number"
          min={0.01}
          max={max}
          step="0.01"
          required
          value={f.montant}
          onChange={(e) => setF({ ...f, montant: e.target.value })}
        />

        <div className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-medium leading-none">Bénéficiaire</span>
          <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Type de bénéficiaire">
            <button type="button" className={choix(!externe)} aria-pressed={!externe} onClick={() => setExterne(false)}>
              Un membre
            </button>
            <button type="button" className={choix(externe)} aria-pressed={externe} onClick={() => setExterne(true)}>
              Personne extérieure
            </button>
          </div>
        </div>
        <div className="sm:col-span-2">
          {externe ? (
            <Input
              id="a-nom"
              aria-label="Nom du bénéficiaire"
              placeholder="ex. Famille Diop"
              required
              value={f.beneficiaire_nom}
              onChange={(e) => setF({ ...f, beneficiaire_nom: e.target.value })}
            />
          ) : (
            <Select
              id="a-membre"
              aria-label="Membre bénéficiaire"
              required
              value={f.membre_id}
              onChange={(e) => setF({ ...f, membre_id: e.target.value })}
            >
              <option value="">— Choisir un membre —</option>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>
                  {nomComplet(m)}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="sm:col-span-2">
          <Input
            id="a-motif"
            label="Motif (facultatif)"
            placeholder="ex. Hospitalisation, décès de sa mère…"
            value={f.motif}
            onChange={(e) => setF({ ...f, motif: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
