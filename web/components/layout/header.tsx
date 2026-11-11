"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSidebarOpen, toggleCollapse } from "@/store/slices/sidebar-slice";
import { cn } from "@/lib/utils";
import { Maximize2, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { UserMenu } from "./user-menu";

export function Header() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isCollapsed } = useAppSelector((state) => state.sidebar);
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd + K place le curseur dans la recherche de membres
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const actionButton =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground shadow-card transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary";

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:px-5">
      <div className="flex h-[68px] items-center gap-3">
        <button
          onClick={() => dispatch(setSidebarOpen(true))}
          className={cn(actionButton, "lg:hidden")}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          onClick={() => dispatch(toggleCollapse())}
          className={cn(actionButton, "hidden lg:flex")}
          aria-label={isCollapsed ? "Déplier le menu" : "Replier le menu"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>

        {/* Recherche de membres */}
        <form
          role="search"
          className="flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/membres" + (q.trim() ? "?q=" + encodeURIComponent(q.trim()) : ""));
            setQ("");
            inputRef.current?.blur();
          }}
        >
          <label className="flex h-10 w-full max-w-xl items-center gap-2 rounded-xl border border-border/80 bg-background px-3 text-sm text-muted-foreground shadow-card transition-colors focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/10 hover:border-primary/30">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Rechercher un membre</span>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un membre (nom, téléphone)…"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="ml-auto hidden rounded-md border border-border bg-muted px-1.5 py-0.5 text-2xs font-semibold sm:inline">
              Ctrl K
            </kbd>
          </label>
        </form>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen();
              else document.exitFullscreen();
            }}
            className={cn(actionButton, "hidden md:flex")}
            aria-label="Plein écran"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Les deux icônes sont rendues côté serveur ; le CSS choisit laquelle afficher */}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className={actionButton}
            aria-label="Changer de thème"
          >
            <Sun className="hidden h-4 w-4 dark:block" />
            <Moon className="h-4 w-4 dark:hidden" />
          </button>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
