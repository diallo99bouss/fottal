const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const eur = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";

// Date locale au format YYYY-MM-DD (pas toISOString, qui passe en UTC)
export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, j] = String(d).slice(0, 10).split("-");
  return `${+j} ${MOIS[+m - 1]} ${y}`;
}

export function jourMois(d: string) {
  const [y, m, j] = d.slice(0, 10).split("-");
  return { jour: +j, mois: `${MOIS[+m - 1]} ${y.slice(2)}` };
}

export const nomComplet = (m: { prenom: string; nom: string }) => `${m.prenom} ${m.nom}`;

export const TYPES_AIDE = {
  maladie: "Maladie",
  deces: "Décès",
  autre: "Autre",
} as const;

// « 30 € par réunion · une réunion tous les 2 mois » selon les réglages de l'association
export function regleCotisation(a: { montant_cotisation: number; intervalle_mois: number } | null) {
  if (!a) return "";
  const freq = a.intervalle_mois === 1 ? "une réunion par mois" : `une réunion tous les ${a.intervalle_mois} mois`;
  return `${eur(a.montant_cotisation)} par réunion · ${freq}`;
}
