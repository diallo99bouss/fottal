"use client";

import { RowActions } from "@/components/caisse/row-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";
import { eur, fmtDate, nomComplet } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Membre, Remise, ReunionDetail } from "@/types";
import { AlertTriangle, HandCoins, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Le restant de la réunion est confié à une ou plusieurs personnes qui repartent avec l'argent
export function RemisesReunion({
  r,
  membres,
  onChange,
}: {
  r: ReunionDetail;
  membres: Membre[];
  onChange: () => void;
}) {
  const [membreId, setMembreId] = useState("");
  const [montant, setMontant] = useState("");
  const [busy, setBusy] = useState(false);
  const [aModifier, setAModifier] = useState<Remise | null>(null);
  const [aSupprimer, setASupprimer] = useState<Remise | null>(null);

  const base = `/reunions/${r.id}/remises`;
  const dejaServis = new Set(r.remises.map((x) => x.membre_id));
  const choix = membres.filter((m) => m.actif && !dejaServis.has(m.id));
  const pct = r.restant > 0 ? Math.min(100, Math.round((r.total_remis / r.restant) * 100)) : 0;

  async function action(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChange();
      return true;
    } catch (ex) {
      toast.error(errMsg(ex));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold">Restant confié</h3>
        {r.restant > 0 && (
          <span className="text-sm tabular-nums text-muted-foreground">
            <b className="text-foreground">{eur(r.total_remis)}</b> sur {eur(r.restant)}
          </span>
        )}
      </div>

      {r.restant > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className={cn("h-full rounded-full", r.a_confier === 0 ? "bg-success" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Parts déjà confiées */}
      {r.remises.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {r.remises.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <UserRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{x.depositaire_nom}</p>
                <p className="text-xs text-muted-foreground">Confié le {fmtDate(x.remis_le)}</p>
              </div>
              <span className="font-semibold tabular-nums">{eur(x.montant)}</span>
              <RowActions
                label={`la part de ${x.depositaire_nom}`}
                onEdit={() => setAModifier(x)}
                onDelete={() => setASupprimer(x)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* On a confié plus que le restant (une aide ou un versement a changé depuis) */}
      {r.a_confier < 0 && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Le restant a baissé : {eur(-r.a_confier)} de trop ont été confiés. Réduisez ou retirez une part.
        </p>
      )}

      {/* Confier tout ou partie de ce qui reste */}
      {r.a_confier > 0 ? (
        <form
          className="grid gap-2 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await action(
              () => api("POST", base, { membre_id: Number(membreId), montant: montant || r.a_confier }),
              "Part confiée",
            );
            if (ok) {
              setMembreId("");
              setMontant("");
            }
          }}
        >
          <Select
            id="remise-membre"
            label={r.remises.length ? `Confier les ${eur(r.a_confier)} restants à…` : "Qui repart avec le restant ?"}
            required
            value={membreId}
            onChange={(e) => setMembreId(e.target.value)}
          >
            <option value="">— Choisir un membre —</option>
            {choix.map((m) => (
              <option key={m.id} value={m.id}>
                {nomComplet(m)}
              </option>
            ))}
          </Select>
          <Input
            id="remise-montant"
            label="Montant (€)"
            type="number"
            min={0.01}
            max={r.a_confier}
            step="0.01"
            placeholder={String(r.a_confier)}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
          />
          <Button type="submit" isLoading={busy}>
            <HandCoins className="h-4 w-4" />
            Confier {eur(Number(montant) || r.a_confier)}
          </Button>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            Pour partager le restant, confiez une partie à une personne, puis le reste à une autre.
          </p>
        </form>
      ) : r.restant <= 0 ? (
        <p className="text-sm text-muted-foreground">Aucun restant à confier pour cette réunion.</p>
      ) : (
        r.a_confier === 0 && <p className="text-sm text-success">Tout le restant a été confié.</p>
      )}

      {aModifier && (
        <ModifierPart
          key={aModifier.id}
          remise={aModifier}
          max={r.a_confier + aModifier.montant}
          onClose={() => setAModifier(null)}
          onSave={(m) => action(() => api("PUT", `${base}/${aModifier.id}`, { montant: m }), "Part modifiée")}
        />
      )}
      <ConfirmModal
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={async () => {
          if (await action(() => api("DELETE", `${base}/${aSupprimer!.id}`), "Part retirée")) setASupprimer(null);
        }}
        loading={busy}
        title="Retirer cette part ?"
        message={
          aSupprimer
            ? `${aSupprimer.depositaire_nom} ne sera plus noté comme repartant avec ${eur(aSupprimer.montant)}. Le montant redevient à confier.`
            : ""
        }
        confirmLabel="Retirer"
      />
    </div>
  );
}

function ModifierPart({
  remise,
  max,
  onClose,
  onSave,
}: {
  remise: Remise;
  max: number;
  onClose: () => void;
  onSave: (montant: string) => Promise<boolean>;
}) {
  const [montant, setMontant] = useState(String(remise.montant));
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="Modifier la part"
      description={`${remise.depositaire_nom} · maximum ${eur(max)}`}
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="form-part" isLoading={busy}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="form-part"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await onSave(montant)) onClose();
          setBusy(false);
        }}
      >
        <Input
          id="part-montant"
          label="Montant confié (€)"
          type="number"
          min={0.01}
          max={max}
          step="0.01"
          required
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
        />
      </form>
    </Modal>
  );
}
