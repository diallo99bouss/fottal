import type { NavGroup } from "@/types";
import { CalendarDays, LayoutDashboard, MapPinned, Scale, Users } from "lucide-react";

export const navigation: NavGroup[] = [
  {
    label: "Caisse",
    items: [
      { title: "Tableau de bord", href: "/", icon: LayoutDashboard },
      { title: "Membres", href: "/membres", icon: Users },
      { title: "Réunions", href: "/reunions", icon: CalendarDays },
    ],
  },
  {
    label: "Paramètres",
    items: [
      { title: "Bolondhas", href: "/bolondhas", icon: MapPinned },
      { title: "Lois et règles", href: "/reglement", icon: Scale },
    ],
  },
];

// Libellés du fil d'Ariane pour chaque segment d'URL
export const libellesRoutes: Record<string, string> = {
  membres: "Membres",
  reunions: "Réunions",
  bolondhas: "Bolondhas",
  reglement: "Lois et règles",
  fiche: "Fiche",
};
