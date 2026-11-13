"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import type { Compte } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  compte?: Compte | null;
  urlCreation: string; // ex. "/utilisateurs" ou "/superadmin/associations/3/comptes"
  urlModification: (id: number) => string; // ex. (id) => `/utilisateurs/${id}`
  roleParDefaut?: "admin" | "agent";
}

// Création / modification d'un compte d'association (administrateur ou agent)
export function CompteForm(props: Props) {
  return props.open ? <CompteFormInner key={props.compte?.id ?? "nouveau"} {...props} /> : null;
}

function CompteFormInner({ onClose, onSaved, compte, urlCreation, urlModification, roleParDefaut = "agent" }: Props) {
  const isNew = !compte;
  const [f, setF] = useState({
    nom: compte?.nom ?? "",
    email: compte?.email ?? "",
    role: compte?.role ?? roleParDefaut,
    motDePasse: "",
    telephone: compte?.telephone ?? "",
    adresse: compte?.adresse ?? "",
    ville: compte?.ville ?? "",
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) await api("POST", urlCreation, f);
      else await api("PUT", urlModification(compte!.id), f);
      toast.success(isNew ? "Compte créé" : "Compte modifié");
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
      title={isNew ? "Nouveau compte" : "Modifier le compte"}
      description={isNew ? "Communiquez l'email et le mot de passe à la personne concernée." : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-compte" isLoading={loading}>
            {isNew ? "Créer le compte" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="form-compte" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input id="c-nom" label="Nom" required value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} />
        <Select
          id="c-role"
          label="Rôle"
          value={f.role}
          onChange={(e) => setF({ ...f, role: e.target.value as "admin" | "agent" })}
        >
          <option value="agent">Agent (gérant)</option>
          <option value="admin">Administrateur (président)</option>
        </Select>
        <div className="sm:col-span-2">
          <Input
            id="c-email"
            label="Email de connexion"
            type="email"
            required
            autoComplete="off"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </div>
        <Input
          id="c-tel"
          label="Téléphone"
          type="tel"
          value={f.telephone}
          onChange={(e) => setF({ ...f, telephone: e.target.value })}
        />
        <Input id="c-ville" label="Ville" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} />
        <div className="sm:col-span-2">
          <Input
            id="c-adresse"
            label="Adresse"
            placeholder="N°, rue, code postal"
            value={f.adresse}
            onChange={(e) => setF({ ...f, adresse: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            id="c-mdp"
            label={isNew ? "Mot de passe" : "Nouveau mot de passe"}
            type="password"
            minLength={8}
            required={isNew}
            autoComplete="new-password"
            value={f.motDePasse}
            onChange={(e) => setF({ ...f, motDePasse: e.target.value })}
            hint={isNew ? "8 caractères minimum" : "Laisser vide pour ne pas le changer"}
          />
        </div>
      </form>
    </Modal>
  );
}
