"use client";

import { RowActions } from "@/components/caisse/row-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LIBELLES_ROLES } from "@/config/navigation";
import { fmtDate } from "@/lib/format";
import type { Compte } from "@/types";

// Tableau des comptes d'une association (actions modifier / supprimer facultatives)
export function ListeComptes({
  comptes,
  moiId,
  onEdit,
  onDelete,
}: {
  comptes: Compte[];
  moiId?: number;
  onEdit?: (c: Compte) => void;
  onDelete?: (c: Compte) => void;
}) {
  const actions = !!(onEdit || onDelete);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Nom</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Téléphone</th>
              <th className="px-5 py-3">Ville</th>
              <th className="px-5 py-3">Rôle</th>
              <th className="px-5 py-3">Créé le</th>
              {actions && (
                <th className="px-5 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.nom} size="sm" />
                    <span className="font-medium">
                      {c.nom}
                      {c.id === moiId && <span className="ml-1.5 text-xs text-muted-foreground">(vous)</span>}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{c.email}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{c.telephone || "—"}</td>
                <td className="px-5 py-3">
                  <p className="text-muted-foreground">{c.ville || "—"}</p>
                  {c.adresse && <p className="max-w-[16rem] truncate text-xs text-muted-foreground">{c.adresse}</p>}
                </td>
                <td className="px-5 py-3">
                  <Badge variant={c.role === "admin" ? "default" : "info"}>{LIBELLES_ROLES[c.role]}</Badge>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{fmtDate(c.cree_le)}</td>
                {actions && (
                  <td className="px-3 py-3">
                    <RowActions
                      label={c.nom}
                      onEdit={() => onEdit?.(c)}
                      onDelete={onDelete ? () => onDelete(c) : undefined}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
