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
  ville: string | null;
  bolondha_id: number | null;
  bolondha: string | null; // nom de la bolondha
  date_adhesion: string;
  actif: boolean;
  reunions_dues: number; // réunions passées pas entièrement payées
  total_attendu: number; // cotisations attendues depuis l'adhésion
  total_paye: number; // tout ce qu'il a versé
  montant_du: number; // attendu − payé, si positif
  avance: number; // payé − attendu, si positif
}

export interface Bolondha {
  id: number;
  nom: string;
  nb_membres: number;
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
  partiels: number; // versements inférieurs à la cotisation
  encaisse: number;
  reste: number; // cotisations encore dues
  total_aides: number;
  restant: number; // encaissé − aides : l'argent à confier
  // Remise du restant à un membre
  depositaire_id: number | null;
  depositaire_nom: string | null;
  montant_remis: number | null;
  remis_le: string | null;
  remise_a_jour: boolean; // false si le restant a changé depuis la remise
}

export type TypeAide = "maladie" | "deces" | "autre";

export interface Aide {
  id: number;
  reunion_id: number;
  type: TypeAide;
  membre_id: number | null;
  beneficiaire_nom: string;
  motif: string | null;
  montant: number;
  cree_le: string;
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
  aides: Aide[];
  membres: MembreReunion[];
}

export interface Tableau {
  membres: number;
  en_caisse: number;
  aides_versees: number;
  restant_du: number;
  prochaine_reunion: Reunion | null;
  date_conseillee: string | null;
}
