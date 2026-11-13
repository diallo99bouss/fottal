"use client";

// Pagination partagée par tous les tableaux :
//   const pg = usePagination(lignes, { resetKey: recherche });
//   pg.pageItems.map(...)            -> lignes de la page courante
//   <Pagination {...pg} />           -> barre « 1–10 sur 42 » + navigation

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

export const TAILLES_PAGE = [10, 25, 50] as const;

interface Options {
  pageSize?: number;
  // Quand cette valeur change (recherche, filtre…), on revient à la page 1
  resetKey?: unknown;
}

export function usePagination<T>(items: T[] | undefined, { pageSize: initiale = 10, resetKey }: Options = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initiale);

  const [cleePrec, setCleePrec] = useState(resetKey);
  if (resetKey !== cleePrec) {
    setCleePrec(resetKey);
    setPage(1);
  }

  const total = items?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  // Après une suppression, la page courante peut ne plus exister : on la ramène dans les bornes
  const courante = Math.min(page, pages);
  const debut = (courante - 1) * pageSize;

  return {
    page: courante,
    pages,
    pageSize,
    total,
    debut,
    pageItems: items ? items.slice(debut, debut + pageSize) : [],
    setPage,
    setPageSize: (n: number) => {
      setPageSizeState(n);
      setPage(1);
    },
  };
}

// Numéros affichés : 1 … 4 5 6 … 12
function numeros(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const res: (number | "…")[] = [1];
  const a = Math.max(2, page - 1);
  const b = Math.min(pages - 1, page + 1);
  if (a > 2) res.push("…");
  for (let i = a; i <= b; i++) res.push(i);
  if (b < pages - 1) res.push("…");
  res.push(pages);
  return res;
}

interface PaginationProps {
  page: number;
  pages: number;
  pageSize: number;
  total: number;
  debut: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  className?: string;
}

export function Pagination({ page, pages, pageSize, total, debut, setPage, setPageSize, className }: PaginationProps) {
  // Barre toujours visible (même sur une seule page), sauf si le tableau est vide
  if (total === 0) return null;
  const fin = Math.min(debut + pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 border-t border-border px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="tabular-nums">
          {debut + 1}–{fin} sur {total}
        </span>
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Par page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Lignes par page"
            className="h-8 cursor-pointer rounded-lg border border-input bg-card px-2 text-sm text-foreground shadow-card focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {TAILLES_PAGE.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {numeros(page, pages).map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-muted-foreground" aria-hidden="true">
              …
            </span>
          ) : (
            <Button
              key={n}
              variant={n === page ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setPage(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              className="tabular-nums"
            >
              {n}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setPage(page + 1)}
          disabled={page === pages}
          aria-label="Page suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
