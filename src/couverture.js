// Répartition des versements sur les réunions (du plus ancien retard au plus récent).
//
// L'argent reste encaissé à la réunion où il a été donné (bilan et caisse justes),
// mais pour savoir quelles réunions sont réglées, on répartit le total versé par
// chaque membre sur ses réunions, dans l'ordre chronologique :
//   ex. il doit 15 € sur la réunion précédente et verse 45 € aujourd'hui
//       -> la réunion précédente est complétée (15 €), celle du jour est payée (30 €).
//
// À utiliser en tête de requête :
//   prisma.$queryRaw`WITH ${couverture(req.asso)} SELECT … FROM couverture …`
// Colonnes : membre_id, reunion_id, date, montant (attendu), couvert (part réglée, 0 → montant)
// Seuls les membres actifs ont des réunions dues (comme pour le reste dû).
// Toujours limitée à UNE association : ses membres × ses réunions.
const { Prisma } = require('./db');

function couverture(associationId) {
  return Prisma.sql`
  couverture AS (
    SELECT d.membre_id, d.reunion_id, d.date, d.montant,
           LEAST(d.montant, GREATEST(COALESCE(p.total, 0) - d.avant, 0)) AS couvert
      FROM (
        SELECT m.id AS membre_id, r.id AS reunion_id, r.date, r.montant,
               -- total attendu sur les réunions précédentes de ce membre
               COALESCE(SUM(r.montant) OVER (
                 PARTITION BY m.id ORDER BY r.date, r.id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS avant
          FROM membres m
          JOIN reunions r ON r.association_id = m.association_id AND r.date >= m.date_adhesion
         WHERE m.actif AND m.association_id = ${associationId}
      ) d
      LEFT JOIN (SELECT membre_id, SUM(montant) AS total FROM cotisations GROUP BY membre_id) p
        ON p.membre_id = d.membre_id
  )`;
}

module.exports = { couverture };
