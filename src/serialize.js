// Conversion des résultats Prisma vers le JSON attendu par le frontend :
// - colonnes DATE   -> 'YYYY-MM-DD'  (Prisma renvoie un Date à minuit UTC)
// - colonnes NUMERIC -> nombre JS    (Prisma renvoie un Decimal)

const jour = (v) => {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
};

const nombre = (v) => (v === null || v === undefined ? null : Number(v));

// 'YYYY-MM-DD' -> Date utilisable par Prisma pour une colonne @db.Date
const versDate = (s) => (s ? new Date(s + 'T00:00:00Z') : s);

// Date du jour (fuseau du serveur) au format 'YYYY-MM-DD'
function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Ajoute n mois à 'YYYY-MM-DD' comme PostgreSQL (31 janv. + 1 mois = 28/29 févr.)
function ajouterMois(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const cible = new Date(Date.UTC(y, m - 1 + n, 1));
  const dernierJour = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(d, dernierJour));
  return jour(cible);
}

const membre = (m) => m && { ...m, date_adhesion: jour(m.date_adhesion) };
const reunion = (r) => r && { ...r, date: jour(r.date), montant: nombre(r.montant), montant_remis: nombre(r.montant_remis) };
const cotisation = (c) => c && { ...c, montant: nombre(c.montant) };
const aide = (a) => a && { ...a, montant: nombre(a.montant) };

// 1234.5 -> "1 234,5 €" (messages d'erreur)
const euros = (n) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " €";

module.exports = { jour, nombre, versDate, aujourdhui, ajouterMois, membre, reunion, cotisation, aide, euros };
