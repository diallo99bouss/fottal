"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { reglement } from "@/config/reglement";
import { fmtDate } from "@/lib/format";
import { Scale } from "lucide-react";

export function ReglementView() {
  const { sections, introduction, misAJourLe } = reglement;
  // Numérotation continue des articles sur tout le règlement (Article 1, 2, 3…) :
  // premier numéro de chaque section = nombre d'articles des sections précédentes + 1
  const debutSection = sections.map((_, i) =>
    sections.slice(0, i).reduce((n, s) => n + s.articles.length, 1),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lois et règles"
        description={
          misAJourLe ? `Règlement de l'association · mis à jour le ${fmtDate(misAJourLe)}` : "Règlement de l'association"
        }
      />

      {sections.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-8 w-8" />}
          title="Le règlement n'est pas encore rédigé"
          description="Les lois et règles de l'association apparaîtront ici."
        />
      ) : (
        <div className="space-y-4">
          {introduction && (
            <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {introduction}
            </p>
          )}

          {/* Sommaire */}
          {sections.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Sommaire</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-inside list-decimal space-y-1 text-sm">
                  {sections.map((s, i) => (
                    <li key={i}>
                      <a href={`#section-${i + 1}`} className="text-primary hover:underline">
                        {s.titre}
                      </a>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {sections.map((s, i) => (
            <Card key={i} id={`section-${i + 1}`} className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="text-base">{s.titre}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {s.articles.map((a, j) => (
                  <div key={j} className="border-l-2 border-primary/30 pl-4">
                    <p className="text-sm font-semibold">
                      Article {debutSection[i] + j}
                      {a.titre && <span className="font-normal text-muted-foreground"> · {a.titre}</span>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{a.texte}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
