const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [membres, caisse, du, prochaine, derniere] = await Promise.all([
      db.query('SELECT count(*)::int AS n FROM membres WHERE actif'),
      db.query('SELECT COALESCE(sum(montant),0)::float AS total FROM cotisations'),
      db.query(`SELECT COALESCE(sum(r.montant),0)::float AS total
                  FROM membres m JOIN reunions r ON r.date >= m.date_adhesion AND r.date <= CURRENT_DATE
                 WHERE m.actif
                   AND NOT EXISTS (SELECT 1 FROM cotisations c WHERE c.reunion_id=r.id AND c.membre_id=m.id)`),
      db.query('SELECT * FROM reunions WHERE date >= CURRENT_DATE ORDER BY date LIMIT 1'),
      db.query(`SELECT to_char(max(date) + interval '2 months','YYYY-MM-DD') AS date FROM reunions`),
    ]);
    res.json({
      membres: membres.rows[0].n,
      en_caisse: caisse.rows[0].total,
      restant_du: du.rows[0].total,
      prochaine_reunion: prochaine.rows[0] || null,
      date_conseillee: derniere.rows[0].date,
    });
  } catch (e) { next(e); }
});

module.exports = router;
