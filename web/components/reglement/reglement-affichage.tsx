import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reglement } from "@/types";

// Affichage du règlement : sommaire, chapitres et articles numérotés à la suite (Article 1, 2, 3…)
export function ReglementAffichage({ reglement }: { reglement: Reglement }) {
  const { sections, introduction } = reglement;
  // Premier numéro de chaque section = nombre d'articles des sections précédentes + 1
  const debutSection = sections.map((_, i) => sections.slice(0, i).reduce((n, s) => n + s.articles.length, 1));

  return (
    <div className="space-y-4">
      {introduction && (
        <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{introduction}</p>
      )}

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
  );
}
