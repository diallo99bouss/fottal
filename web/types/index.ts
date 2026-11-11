import type { LucideIcon } from "lucide-react";

// ---------- Navigation ----------
export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  badge?: string | number;
  children?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ---------- Données de l'API Express ----------
export type Role = "admin" | "agent";

export interface Utilisateur {
  id: number;
  nom: string;
  email?: string;
  role: Role;
}

export interface Membre {
  id: number;
  prenom: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  date_adhesion: string;
  actif: boolean;
  reunions_dues: number;
  montant_du: number;
}

export interface LigneHistorique {
  id: number;
  date: string;
  lieu: string | null;
  montant: number;
  cotisation_id: number | null;
  montant_paye: number | null;
  paye_le: string | null;
  mode: string | null;
}

export interface MembreDetail extends Membre {
  historique: LigneHistorique[];
}

export interface Reunion {
  id: number;
  date: string;
  lieu: string | null;
  notes: string | null;
  montant: number;
  attendus: number;
  payes: number;
  encaisse: number;
  reste: number;
}

export interface MembreReunion {
  id: number;
  prenom: string;
  nom: string;
  telephone: string | null;
  cotisation_id: number | null;
  montant_paye: number | null;
  paye_le: string | null;
  mode: string | null;
}

export interface ReunionDetail extends Reunion {
  membres: MembreReunion[];
}

export interface Tableau {
  membres: number;
  en_caisse: number;
  restant_du: number;
  prochaine_reunion: Reunion | null;
  date_conseillee: string | null;
}
