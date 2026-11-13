"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/providers/auth-provider";
import { api, errMsg } from "@/lib/api";
import { aujourdhui } from "@/lib/format";
import type { Reunion } from "@/types";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  reunion?: Reunion | null;
}

export function ReunionForm({ open, onClose, onSaved, reunion }: Props) {
  return open ? (
    <ReunionFormInner key={reunion?.id ?? "nouvelle"} onClose={onClose} onSaved={onSaved} reunion={reunion} />
  ) : null;
}

function ReunionFormInner({ onClose, onSaved, reunion }: Omit<Props, "open">) {
  const isNew = !reunion;
  const { association } = useAuth();
  const [f, setF] = useState({
    date: reunion?.date ?? aujourdhui(),
    montant: String(reunion?.montant ?? association?.montant_cotisation ?? 30),
    lieu: reunion?.lieu ?? "",
    notes: reunion?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);

  // Nouvelle réunion : on propose la date conseillée (2 mois après la précédente)
  useEffect(() => {
    if (!isNew) return;
    api<{ date: string | null }>("GET", "/reunions/prochaine-date")
      .then((p) => p.date && setF((prev) => ({ ...prev, date: p.date! })))
      .catch(() => {});
  }, [isNew]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) await api("POST", "/reunions", f);
      else await api("PUT", `/reunions/${reunion!.id}`, f);
      toast.success(isNew ? "Réunion créée" : "Réunion modifiée");
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
      title={isNew ? "Nouvelle réunion" : "Modifier la réunion"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-reunion" isLoading={loading}>
            {isNew ? "Créer la réunion" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="form-reunion" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input
          id="r-date"
          label="Date"
          type="date"
          required
          value={f.date}
          onChange={(e) => setF({ ...f, date: e.target.value })}
        />
        <Input
          id="r-montant"
          label="Cotisation (€)"
          type="number"
          min={0}
          step={1}
          required
          value={f.montant}
          onChange={(e) => setF({ ...f, montant: e.target.value })}
        />
        <div className="sm:col-span-2">
          <Input
            id="r-lieu"
            label="Lieu"
            placeholder="Salle, adresse…"
            value={f.lieu}
            onChange={(e) => setF({ ...f, lieu: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Textarea
            id="r-notes"
            label="Ordre du jour / notes"
            rows={3}
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
        </div>
      </form>
    </Modal>
  );
}
