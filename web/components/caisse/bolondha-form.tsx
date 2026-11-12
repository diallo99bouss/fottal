"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { api, errMsg } from "@/lib/api";
import type { Bolondha } from "@/types";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  bolondha?: Bolondha | null;
}

export function BolondhaForm({ open, onClose, onSaved, bolondha }: Props) {
  return open ? (
    <BolondhaFormInner key={bolondha?.id ?? "nouvelle"} onClose={onClose} onSaved={onSaved} bolondha={bolondha} />
  ) : null;
}

function BolondhaFormInner({ onClose, onSaved, bolondha }: Omit<Props, "open">) {
  const isNew = !bolondha;
  const [nom, setNom] = useState(bolondha?.nom ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) await api("POST", "/bolondhas", { nom });
      else await api("PUT", `/bolondhas/${bolondha!.id}`, { nom });
      toast.success(isNew ? "Bolondha ajoutée" : "Bolondha modifiée");
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
      title={isNew ? "Nouvelle bolondha" : "Modifier la bolondha"}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-bolondha" isLoading={loading}>
            {isNew ? "Ajouter" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="form-bolondha" onSubmit={onSubmit}>
        <Input
          id="b-nom"
          label="Nom"
          placeholder="ex. Kourasadio"
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
      </form>
    </Modal>
  );
}
