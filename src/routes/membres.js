const express = require('express');
const db = require('../db');
const v = require('../validation');
const { role } = require('../middleware/auth');

const router = express.Router();

// Réunions passées depuis l'adhésion et non payées => montant dû
const SELECT_MEMBRES = `
  SELECT m.*,
    COALESCE(d.nb, 0)::int        AS reunions_dues,
    COALESCE(d.total, 0)::float   AS montant_du
  FROM membres m
  LEFT JOIN LATERAL (
    SELECT count(*) AS nb, sum(r.montant) AS total
    FROM reunions r
    WHERE r.date <= CURRENT_DATE
      AND r.date >= m.date_adhesion
      AND m.actif
      AND NOT EXISTS (SELECT 1 FROM cotisations c WHERE c.reunion_id = r.id AND c.membre_id = m.id)
  ) d ON TRUE`;

function lire(body) {
  return {
    prenom: v.texte(body.prenom, 'prénom', { requis: true }),
    nom: v.texte(body.nom, 'nom', { requis: true }),
    telephone: v.texte(body.telephone, 'téléphone'),
    email: v.texte(body.email, 'email'),
    date_adhesion: v.date(body.date_adhesion, "date d'adhésion") || new Date().toISOString().slice(0, 10),
    actif: body.actif === undefined ? true : Boolean(body.actif),
  };
}

// Liste (admin et agent)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const params = [];
    let where = '';
    if (q) {
      params.push(`%${q}%`);
      where = `WHERE m.prenom ILIKE $1 OR m.nom ILIKE $1 OR m.telephone ILIKE $1`;
    }
    const { rows } = await db.query(`${SELECT_MEMBRES} ${where} ORDER BY m.nom, m.prenom`, params);
    res.json(rows);
  } catch (e) { next(e); }
});

// Détail + historique des réunions
router.get('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const { rows } = await db.query(`${SELECT_MEMBRES} WHERE m.id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ erreur: 'Membre introuvable' });
    const hist = await db.query(
      `SELECT r.id, r.date, r.lieu, r.montant, c.id AS cotisation_id, c.montant AS montant_paye, c.paye_le, c.mode
         FROM reunions r
         LEFT JOIN cotisations c ON c.reunion_id = r.id AND c.membre_id = $1
        WHERE r.date >= $2
        ORDER BY r.date DESC`,
      [id, rows[0].date_adhesion]
    );
    res.json({ ...rows[0], historique: hist.rows });
  } catch (e) { next(e); }
});

// Ajouter (admin)
router.post('/', role('admin'), async (req, res, next) => {
  try {
    const m = lire(req.body || {});
    const { rows } = await db.query(
      `INSERT INTO membres (prenom, nom, telephone, email, date_adhesion, actif)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [m.prenom, m.nom, m.telephone, m.email, m.date_adhesion, m.actif]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Modifier (admin)
router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const m = lire(req.body || {});
    const { rows } = await db.query(
      `UPDATE membres SET prenom=$1, nom=$2, telephone=$3, email=$4, date_adhesion=$5, actif=$6, modifie_le=now()
       WHERE id=$7 RETURNING *`,
      [m.prenom, m.nom, m.telephone, m.email, m.date_adhesion, m.actif, id]
    );
    if (!rows[0]) return res.status(404).json({ erreur: 'Membre introuvable' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// Supprimer (admin) — ses cotisations sont supprimées aussi (ON DELETE CASCADE)
router.delete('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const { rowCount } = await db.query('DELETE FROM membres WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ erreur: 'Membre introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
