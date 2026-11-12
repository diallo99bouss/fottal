"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { aujourdhui } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Bolondha, Membre } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  membre?: Membre | null;
}

export function MembreForm({ open, onClose, onSaved, membre }: Props) {
  // key force la remise à zéro du formulaire à chaque ouverture
  return open ? (
    <MembreFormInner key={membre?.id ?? "nouveau"} onClose={onClose} onSaved={onSaved} membre={membre} />
  ) : null;
}

function MembreFormInner({ onClose, onSaved, membre }: Omit<Props, "open">) {
  const isNew = !membre;
  const [f, setF] = useState({
    prenom: membre?.prenom ?? "",
    nom: membre?.nom ?? "",
    telephone: membre?.telephone ?? "",
    email: membre?.email ?? "",
    ville: membre?.ville ?? "",
    bolondha_id: membre?.bolondha_id ? String(membre.bolondha_id) : "",
    date_adhesion: membre?.date_adhesion ?? aujourdhui(),
    actif: membre?.actif ?? true,
  });
  const [loading, setLoading] = useState(false);
  const { data: bolondhas } = useApi<Bolondha[]>("/bolondhas");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) await api("POST", "/membres", f);
      else await api("PUT", `/membres/${membre!.id}`, f);
      toast.success(isNew ? "Membre ajouté" : "Membre modifié");
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
      title={isNew ? "Nouveau membre" : "Modifier le membre"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-membre" isLoading={loading}>
            {isNew ? "Ajouter le membre" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="form-membre" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input id="m-prenom" label="Prénom" required value={f.prenom} onChange={set("prenom")} />
        <Input id="m-nom" label="Nom" required value={f.nom} onChange={set("nom")} />
        <Input id="m-tel" label="Téléphone" type="tel" value={f.telephone} onChange={set("telephone")} />
        <Input id="m-email" label="Email" type="email" value={f.email} onChange={set("email")} />
        <Input id="m-ville" label="Ville" placeholder="ex. Paris" value={f.ville} onChange={set("ville")} />
        <Select
          id="m-bolondha"
          label="Bolondha"
          value={f.bolondha_id}
          onChange={set("bolondha_id")}
          hint={bolondhas && bolondhas.length === 0 ? "Aucune bolondha : créez-en dans Paramètres › Bolondhas" : undefined}
        >
          <option value="">— Aucune —</option>
          {bolondhas?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nom}
            </option>
          ))}
        </Select>
        <Input
          id="m-adh"
          label="Date d'adhésion"
          type="date"
          required
          value={f.date_adhesion}
          onChange={set("date_adhesion")}
        />
        <Select
          id="m-actif"
          label="Statut"
          value={f.actif ? "1" : "0"}
          onChange={(e) => setF({ ...f, actif: e.target.value === "1" })}
        >
          <option value="1">Actif</option>
          <option value="0">Inactif</option>
        </Select>
      </form>
    </Modal>
  );
}
