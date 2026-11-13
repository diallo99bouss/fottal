"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { eur } from "@/lib/format";
import { Check, CircleDashed, Clock, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MODES = { especes: "Espèces", virement: "Virement", autre: "Autre" } as const;
type Mode = keyof typeof MODES;

interface Props {
  reunionId: number;
  membreId: number;
  membreNom: string;
  attendu: number; // cotisation de la réunion (30 € par défaut)
  paye: number | null; // argent donné à CETTE réunion, null si rien
  couvert: number; // part de cette réunion réglée (tous versements confondus, plus ancien retard d'abord)
  duCumule?: number; // tout ce qu'il doit jusqu'à cette réunion incluse : montant proposé
  aVenir?: boolean; // réunion future : pas encore due, donc jamais affichée « en retard »
  mode?: string | null;
  onChange: () => void;
}

// Texte sous le nom du membre : d'où vient le règlement de cette réunion
export function detailVersement({ attendu, paye, couvert }: Pick<Props, "attendu" | "paye" | "couvert">) {
  // Une partie de l'argent donné ici a servi à régler d'autres réunions (retards plus anciens d'abord)
  if (paye !== null && paye > couvert) {
    return `${eur(paye)} versés, dont ${eur(paye - couvert)} affectés à ses réunions précédentes`;
  }
  // Cette réunion est (en partie) réglée par de l'argent donné à une autre réunion
  if (couvert > (paye ?? 0)) {
    const autre = eur(couvert - (paye ?? 0));
    if (couvert >= attendu) {
      return paye ? `${eur(paye)} versés + ${autre} d'un autre versement : réglée` : "Réglée par un autre versement";
    }
    return paye ? `${eur(paye)} versés + ${autre} d'un autre versement` : `${autre} venant d'un autre versement`;
  }
  return paye !== null ? `${eur(paye)} versés` : null;
}

// Bouton de versement d'un membre pour une réunion. Couleur = statut de la réunion :
//  vert « Réglée », orange « x / 30 » (partiel), sinon « Encaisser »
export function VersementButton(props: Props) {
  const { attendu, paye, couvert, aVenir } = props;
  const [open, setOpen] = useState(false);
  const regle = couvert >= attendu;

  return (
    <>
      {aVenir && !regle ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          title="Réunion à venir : pas encore due"
          className="text-muted-foreground tabular-nums"
        >
          <Clock className="h-3.5 w-3.5" />
          À venir{couvert > 0 ? ` · ${eur(couvert)} déjà réglés` : ""}
        </Button>
      ) : regle ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          title={paye !== null ? "Modifier ou annuler le versement" : "Encaisser un versement"}
          className="border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success"
        >
          <Check className="h-3.5 w-3.5" />
          Réglée
        </Button>
      ) : paye !== null || couvert > 0 ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          title={`Partiel : il manque ${eur(attendu - couvert)}`}
          className="border-warning/30 bg-warning/10 text-warning tabular-nums hover:bg-warning/15 hover:text-warning"
        >
          <CircleDashed className="h-3.5 w-3.5" />
          {eur(couvert)} / {eur(attendu)}
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          Encaisser
        </Button>
      )}
      {open && <VersementModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function VersementModal({
  reunionId,
  membreId,
  membreNom,
  attendu,
  paye,
  duCumule,
  mode,
  onChange,
  onClose,
}: Props & { onClose: () => void }) {
  const existe = paye !== null;
  // Nouveau versement : on propose ce qu'il doit (retards + cotisation du jour), sinon la cotisation
  const propose = duCumule && duCumule > 0 ? duCumule : attendu;
  const retard = Math.max(0, (duCumule ?? 0) - attendu);
  const [montant, setMontant] = useState(String(paye ?? propose));
  const [m, setM] = useState<Mode>(mode && mode in MODES ? (mode as Mode) : "especes");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const n = Number(montant);

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
      description={`${membreNom} · cotisation de la réunion : ${eur(attendu)}`}
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
        {!existe && retard > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
            <p className="font-medium">Il doit {eur(duCumule)} :</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li className="flex justify-between gap-4">
                <span>Retard des réunions précédentes</span>
                <span className="tabular-nums">{eur(retard)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Cotisation de cette réunion</span>
                <span className="tabular-nums">{eur(attendu)}</span>
              </li>
            </ul>
          </div>
        )}
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
        <p className="text-xs text-muted-foreground">
          Le versement règle d&apos;abord ses retards les plus anciens, puis cette réunion ; le surplus éventuel
          devient une avance.
        </p>
      </form>
    </Modal>
  );
}
