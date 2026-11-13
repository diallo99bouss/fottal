import type { NavGroup, Role } from "@/types";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  MapPinned,
  Scale,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

// Menu des comptes d'une association (président = admin, gérant = agent)
const navigationAssociation: NavGroup[] = [
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
      { title: "Comptes", href: "/comptes", icon: UserCog, roles: ["admin"] },
      { title: "Réglages", href: "/reglages", icon: Settings, roles: ["admin"] },
    ],
  },
];

// Menu du super-admin (administration de l'application)
const navigationSuperAdmin: NavGroup[] = [
  {
    label: "Administration",
    items: [{ title: "Associations", href: "/super", icon: Building2 }],
  },
];

// Menu affiché selon le rôle ; les entrées réservées à d'autres rôles sont retirées
export function navigationPour(role: Role | undefined): NavGroup[] {
  const groupes = role === "superadmin" ? navigationSuperAdmin : navigationAssociation;
  return groupes
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (role && i.roles.includes(role))) }))
    .filter((g) => g.items.length > 0);
}

// Libellés du fil d'Ariane pour chaque segment d'URL
export const libellesRoutes: Record<string, string> = {
  membres: "Membres",
  reunions: "Réunions",
  bolondhas: "Bolondhas",
  reglement: "Lois et règles",
  comptes: "Comptes",
  reglages: "Réglages",
  super: "Associations",
  association: "Association",
  fiche: "Fiche",
};

export const LIBELLES_ROLES: Record<Role, string> = {
  superadmin: "Super-admin",
  admin: "Administrateur",
  agent: "Agent",
};
