"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errMsg } from "@/lib/api";
import type { Reglement, SectionReglement } from "@/types";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Déplace l'élément i d'un cran (−1 vers le haut, +1 vers le bas)
function deplacer<T>(liste: T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  if (j < 0 || j >= liste.length) return liste;
  const copie = [...liste];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

function BoutonsOrdre({ onHaut, onBas, onSupprimer, label }: { onHaut: () => void; onBas: () => void; onSupprimer: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon-sm" onClick={onHaut} aria-label={`Monter ${label}`} title="Monter">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onBas} aria-label={`Descendre ${label}`} title="Descendre">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onSupprimer}
        aria-label={`Supprimer ${label}`}
        title="Supprimer"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Éditeur du règlement (administrateur) : introduction, chapitres et articles
export function ReglementEditeur({
  initial,
  onClose,
  onSaved,
}: {
  initial: Reglement | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [introduction, setIntroduction] = useState(initial?.introduction ?? "");
  const [sections, setSections] = useState<SectionReglement[]>(
    initial?.sections?.length ? initial.sections : [{ titre: "", articles: [{ titre: "", texte: "" }] }],
  );
  const [loading, setLoading] = useState(false);

  const majSection = (i: number, s: Partial<SectionReglement>) =>
    setSections(sections.map((x, k) => (k === i ? { ...x, ...s } : x)));

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("PUT", "/association/reglement", { introduction, sections });
      toast.success("Règlement enregistré");
      onSaved();
      onClose();
    } catch (ex) {
      toast.error(errMsg(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <Textarea
            id="reg-intro"
            label="Introduction (facultative)"
            rows={3}
            value={introduction}
            onChange={(e) => setIntroduction(e.target.value)}
          />
        </CardContent>
      </Card>

      {sections.map((s, i) => (
        <Card key={i}>
          <CardHeader className="flex items-end gap-2 pb-3">
            <div className="flex-1">
              <Input
                id={`reg-s${i}`}
                label={`Chapitre ${i + 1}`}
                placeholder="ex. Les cotisations"
                required
                value={s.titre}
                onChange={(e) => majSection(i, { titre: e.target.value })}
              />
            </div>
            <BoutonsOrdre
              label={`le chapitre ${i + 1}`}
              onHaut={() => setSections(deplacer(sections, i, -1))}
              onBas={() => setSections(deplacer(sections, i, 1))}
              onSupprimer={() => setSections(sections.filter((_, k) => k !== i))}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {s.articles.map((a, j) => (
              <div key={j} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      id={`reg-s${i}-a${j}-titre`}
                      label={`Article ${j + 1} — titre (facultatif)`}
                      placeholder="ex. Montant"
                      value={a.titre ?? ""}
                      onChange={(e) =>
                        majSection(i, { articles: s.articles.map((x, k) => (k === j ? { ...x, titre: e.target.value } : x)) })
                      }
                    />
                  </div>
                  <BoutonsOrdre
                    label={`l'article ${j + 1}`}
                    onHaut={() => majSection(i, { articles: deplacer(s.articles, j, -1) })}
                    onBas={() => majSection(i, { articles: deplacer(s.articles, j, 1) })}
                    onSupprimer={() => majSection(i, { articles: s.articles.filter((_, k) => k !== j) })}
                  />
                </div>
                <Textarea
                  id={`reg-s${i}-a${j}-texte`}
                  aria-label={`Texte de l'article ${j + 1}`}
                  placeholder="Texte de la règle…"
                  rows={3}
                  required
                  value={a.texte}
                  onChange={(e) =>
                    majSection(i, { articles: s.articles.map((x, k) => (k === j ? { ...x, texte: e.target.value } : x)) })
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => majSection(i, { articles: [...s.articles, { titre: "", texte: "" }] })}
            >
              <Plus className="h-4 w-4" />
              Ajouter un article
            </Button>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSections([...sections, { titre: "", articles: [{ titre: "", texte: "" }] }])}
        >
          <Plus className="h-4 w-4" />
          Ajouter un chapitre
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
            Annuler
          </Button>
          <Button type="submit" isLoading={loading}>
            <Save className="h-4 w-4" />
            Enregistrer le règlement
          </Button>
        </div>
      </div>
    </form>
  );
}
