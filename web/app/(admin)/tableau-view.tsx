"use client";

import { DateBox, DueBadge, ErrorBox, Progress } from "@/components/caisse/shared";
import { ReunionForm } from "@/components/caisse/reunion-form";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { siteConfig } from "@/config/site";
import { eur, fmtDate, nomComplet } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { Membre, ReunionDetail, Tableau } from "@/types";
import { AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, PiggyBank, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function TableauView() {
  const { isAdmin } = useAuth();
  const tableau = useApi<Tableau>("/tableau");
  const membres = useApi<Membre[]>("/membres");
  const prochaineId = tableau.data?.prochaine_reunion?.id;
  const prochaine = useApi<ReunionDetail>(prochaineId ? `/reunions/${prochaineId}` : null);
  const [formOpen, setFormOpen] = useState(false);

  const t = tableau.data;
  const retards = (membres.data ?? [])
    .filter((m) => m.montant_du > 0)
    .sort((a, b) => b.montant_du - a.montant_du)
    .slice(0, 8);

  const reload = () => {
    tableau.reload();
    membres.reload();
    prochaine.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description={siteConfig.regle}
        actions={
          isAdmin && (
            <Button onClick={() => setFormOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              Nouvelle réunion
            </Button>
          )
        }
      />

      {tableau.error && <ErrorBox message={tableau.error} />}

      <div className="grid gap-4 sm:grid-cols-3 stagger">
        {t ? (
          <>
            <StatCard label="Membres actifs" value={t.membres} icon={Users} tone="primary" />
            <StatCard
              label="En caisse"
              value={eur(t.en_caisse)}
              icon={PiggyBank}
              tone="success"
              hint={t.aides_versees > 0 ? `après ${eur(t.aides_versees)} d'aides versées` : undefined}
            />
            <StatCard
              label="Restant dû"
              value={eur(t.restant_du)}
              icon={AlertTriangle}
              tone={t.restant_du > 0 ? "destructive" : "success"}
            />
          </>
        ) : (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Prochaine réunion */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prochaine réunion</CardTitle>
            <CardDescription>Suivi des encaissements de la prochaine séance</CardDescription>
          </CardHeader>
          <CardContent>
            {!t ? (
              <Skeleton className="h-20" />
            ) : prochaine.data ? (
              <Link
                href={`/reunions/fiche?id=${prochaine.data.id}`}
                className="group flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <DateBox date={prochaine.data.date} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-sm font-semibold">{prochaine.data.lieu || "Réunion"}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {prochaine.data.payes}/{prochaine.data.attendus} payé · {eur(prochaine.data.encaisse)}{" "}
                    encaissés
                  </p>
                  <Progress value={prochaine.data.payes} max={prochaine.data.attendus} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : t.prochaine_reunion ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Aucune réunion planifiée.
                {t.date_conseillee && (
                  <>
                    {" "}
                    La suivante tombe vers le{" "}
                    <b className="text-foreground">{fmtDate(t.date_conseillee)}</b>.
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Retards */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Cotisations en retard</CardTitle>
              <CardDescription>Membres ayant le plus de réunions impayées</CardDescription>
            </div>
            <Link href="/membres" className="text-xs font-medium text-primary hover:underline">
              Tous les membres
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {!membres.data ? (
              <div className="space-y-2 px-5 pb-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : retards.length === 0 ? (
              <p className="flex items-center gap-2 px-5 pb-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Tous les membres sont à jour.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {retards.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/membres/fiche?id=${m.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <Avatar name={nomComplet(m)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{nomComplet(m)}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Versé {eur(m.total_paye)} sur {eur(m.total_attendu)}
                        </p>
                      </div>
                      <DueBadge montant={m.montant_du} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ReunionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={reload} />
    </div>
  );
}
