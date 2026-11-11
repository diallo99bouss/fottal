"use client";

import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

// Boutons Modifier / Supprimer d'une ligne de tableau (la ligne elle-même reste cliquable)
export function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="flex items-center justify-end gap-1" onKeyDown={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={stop(onEdit)}
        aria-label={`Modifier ${label}`}
        title="Modifier"
        className="text-muted-foreground hover:bg-primary/10 hover:text-primary"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={stop(onDelete)}
        aria-label={`Supprimer ${label}`}
        title="Supprimer"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
