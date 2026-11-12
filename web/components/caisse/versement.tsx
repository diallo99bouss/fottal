"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { eur } from "@/lib/format";
import { Check, CircleDashed, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MODES = { especes: "Espèces", virement: "Virement", autre: "Autre" } as const;
type Mode = keyof typeof MODES;

interface Props {
  reunionId: number;
  membreId: number;
  membreNom: string;
  attendu: number; // cotisation de la réunion (30 € par défaut)
  paye: number | null; // montant déjà versé, null si rien
  mode?: string | null;
  onChange: () => void;
}

// Bouton de versement d'un membre pour une réunion :
//  - rien versé : « Encaisser » -> saisie du montant (libre) et du mode
//  - déjà versé : affiche le montant (vert si complet, orange si partiel) -> modifier ou annuler
export function VersementButton(props: Props) {
  const { attendu, paye } = props;
  const [open, setOpen] = useState(false);

  return (
    <>
      {paye === null ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          Encaisser
        </Button>
      ) : paye >= attendu ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          title="Modifier ou annuler le versement"
          className="border-success/30 bg-success/10 text-success tabular-nums hover:bg-success/15 hover:text-success"
        >
          <Check className="h-3.5 w-3.5" />
          {eur(paye)}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          title={`Versement partiel : il manque ${eur(attendu - paye)}`}
          className="border-warning/30 bg-warning/10 text-warning tabular-nums hover:bg-warning/15 hover:text-warning"
        >
          <CircleDashed className="h-3.5 w-3.5" />
          {eur(paye)} / {eur(attendu)}
        </Button>
      )}
      {open && <VersementModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function VersementModal({ reunionId, membreId, membreNom, attendu, paye, mode, onChange, onClose }: Props & { onClose: () => void }) {
  const existe = paye !== null;
  const [montant, setMontant] = useState(String(paye ?? attendu));
  const [m, setM] = useState<Mode>(mode && mode in MODES ? (mode as Mode) : "especes");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const n = Number(montant);
  const ecart = Number.isFinite(n) ? n - attendu : 0;

  async function run(kind: "save" | "delete", fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    try {
      await fn();
      toast.success(ok);
      onChange();
      onClose();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setBusy(null);
    }
  }

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    const body = { montant, mode: m };
    run(
      "save",
      () =>
        existe
          ? api("PUT", `/reunions/${reunionId}/cotisations/${membreId}`, body)
          : api("POST", `/reunions/${reunionId}/cotisations`, { ...body, membre_id: membreId }),
      existe ? "Versement modifié" : `${eur(n)} encaissés`,
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={existe ? "Modifier le versement" : "Encaisser une cotisation"}
      description={`${membreNom} · cotisation attendue : ${eur(attendu)}`}
      className="max-w-md"
      footer={
        <>
          {existe && (
            <Button
              variant="ghost"
              className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
              isLoading={busy === "delete"}
              disabled={!!busy}
              onClick={() =>
                run("delete", () => api("DELETE", `/reunions/${reunionId}/cotisations/${membreId}`), "Versement annulé")
              }
            >
              <Trash2 className="h-4 w-4" />
              Annuler le versement
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" form="form-versement" isLoading={busy === "save"} disabled={!!busy}>
            {existe ? "Enregistrer" : "Encaisser"}
          </Button>
        </>
      }
    >
      <form id="form-versement" onSubmit={enregistrer} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="v-montant"
            label="Montant versé (€)"
            type="number"
            min={0.01}
            step="0.01"
            required
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
          />
          <Select id="v-mode" label="Mode de paiement" value={m} onChange={(e) => setM(e.target.value as Mode)}>
            {Object.entries(MODES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        {n > 0 && ecart !== 0 && (
          <p
            className={
              ecart < 0
                ? "rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
                : "rounded-lg bg-info/10 px-3 py-2 text-sm text-info"
            }
          >
            {ecart < 0
              ? `Versement partiel : il manquera ${eur(-ecart)} sur cette réunion.`
              : `${eur(ecart)} de plus que la cotisation : ils comptent dans son solde (avance ou rattrapage).`}
          </p>
        )}
      </form>
    </Modal>
  );
}
