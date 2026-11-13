"use client";

import { Badge } from "@/components/ui/badge";
import { eur, jourMois } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

// Solde d'un membre : reste dû (rouge), avance (bleu) ou à jour (vert)
export function DueBadge({ montant, avance = 0, okLabel = "À jour" }: { montant: number; avance?: number; okLabel?: string }) {
  if (montant > 0)
    return (
      <Badge variant="danger" className="tabular-nums">
        {eur(montant)} dus
      </Badge>
    );
  if (avance > 0)
    return (
      <Badge variant="info" className="tabular-nums">
        Avance {eur(avance)}
      </Badge>
    );
  return <Badge variant="success">{okLabel}</Badge>;
}

// Un membre est « à jour » s'il ne doit rien (attendu − versé ≤ 0). Inactif : pas de situation.
export const estAJour = (m: { actif: boolean; montant_du: number }) => !m.actif || m.montant_du <= 0;

export function SituationBadge({ actif, montant_du }: { actif: boolean; montant_du: number }) {
  if (!actif) return <span className="text-muted-foreground">—</span>;
  return montant_du > 0 ? (
    <Badge variant="danger" className="gap-1">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Pas à jour
    </Badge>
  ) : (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      À jour
    </Badge>
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
