"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { cn, getInitials } from "@/lib/utils";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function UserMenu() {
  const { user, isAdmin, deconnecter } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;
  const RoleIcon = isAdmin ? ShieldCheck : UserRound;
  const roleLabel = isAdmin ? "Administrateur" : "Agent";

  return (
    <div ref={rootRef} className="relative ml-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className="flex h-9 items-center gap-2 rounded-xl border border-border/80 bg-background px-1 shadow-card transition-colors hover:border-primary/30 hover:bg-primary/5 sm:px-2.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#7dc142] text-2xs font-bold text-white">
          {getInitials(user.nom)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-xs font-semibold leading-none">{user.nom}</span>
          <span className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground">
            <RoleIcon className={cn("h-3 w-3", isAdmin ? "text-success" : "text-info")} />
            {roleLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu du compte"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-card p-1.5 shadow-dropdown"
        >
          <div className="border-b border-border px-2.5 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold">{user.nom}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                deconnecter();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
