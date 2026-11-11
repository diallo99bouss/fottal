"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, errMsg } from "@/lib/api";
import { eur, jourMois } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Bouton « Encaisser » / « Payé » : un clic sur « Payé » annule l'encaissement
export function PayButton({
  reunionId,
  membreId,
  paye,
  montant,
  onChange,
}: {
  reunionId: number;
  membreId: number;
  paye: boolean;
  montant?: number;
  onChange: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      if (paye) {
        await api("DELETE", `/reunions/${reunionId}/cotisations/${membreId}`);
        toast("Paiement annulé");
      } else {
        await api("POST", `/reunions/${reunionId}/cotisations`, { membre_id: membreId });
        toast.success("Cotisation encaissée");
      }
      onChange();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  return paye ? (
    <Button
      size="sm"
      variant="outline"
      onClick={toggle}
      isLoading={loading}
      title="Cliquer pour annuler l'encaissement"
      className="border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success"
    >
      {!loading && <Check className="h-3.5 w-3.5" />}
      Payé
    </Button>
  ) : (
    <Button size="sm" onClick={toggle} isLoading={loading}>
      Encaisser{montant !== undefined ? ` ${eur(montant)}` : ""}
    </Button>
  );
}

export function DueBadge({ montant, okLabel = "À jour" }: { montant: number; okLabel?: string }) {
  return montant > 0 ? (
    <Badge variant="danger" className="tabular-nums">
      {eur(montant)} dus
    </Badge>
  ) : (
    <Badge variant="success">{okLabel}</Badge>
  );
}

export function DateBox({ date, className }: { date: string; className?: string }) {
  const { jour, mois } = jourMois(date);
  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary",
        className,
      )}
    >
      <span className="text-base font-bold leading-none tabular-nums">{jour}</span>
      <span className="mt-0.5 text-2xs font-medium leading-none">{mois}</span>
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value} sur ${max} payé`}
    >
      <div
        className={cn("h-full rounded-full animate-progress", pct >= 100 ? "bg-success" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}
