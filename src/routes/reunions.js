const express = require('express');
const db = require('../db');
const v = require('../validation');
const { role } = require('../middleware/auth');

const router = express.Router();
const COTISATION_REUNION = 30; // 15 € x 2 mois

// Membres attendus à une réunion : actifs et inscrits avant la date
const SELECT_REUNIONS = `
  SELECT r.*,
    (SELECT count(*) FROM membres m WHERE m.actif AND m.date_adhesion <= r.date)::int AS attendus,
    (SELECT count(*) FROM cotisations c WHERE c.reunion_id = r.id)::int                AS payes,
    (SELECT COALESCE(sum(c.montant),0) FROM cotisations c WHERE c.reunion_id = r.id)::float AS encaisse
  FROM reunions r`;

function lire(body) {
  return {
    date: v.date(body.date, 'date', { requis: true }),
    lieu: v.texte(body.lieu, 'lieu'),
    notes: v.texte(body.notes, 'notes'),
    montant: v.montant(body.montant, 'montant', COTISATION_REUNION),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`${SELECT_REUNIONS} ORDER BY r.date DESC`);
    res.json(rows.map((r) => ({ ...r, reste: Math.max(0, (r.attendus - r.payes) * r.montant) })));
  } catch (e) { next(e); }
});

// Date conseillée pour la prochaine réunion : 2 mois après la dernière
router.get('/prochaine-date', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT to_char(max(date) + interval '2 months', 'YYYY-MM-DD') AS date FROM reunions`
    );
    res.json({ date: rows[0].date });
  } catch (e) { next(e); }
});

// Détail : liste des membres attendus et leur statut de paiement
router.get('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const { rows } = await db.query(`${SELECT_REUNIONS} WHERE r.id = $1`, [id]);
    const r = rows[0];
    if (!r) return res.status(404).json({ erreur: 'Réunion introuvable' });
    const membres = await db.query(
      `SELECT m.id, m.prenom, m.nom, m.telephone,
              c.id AS cotisation_id, c.montant AS montant_paye, c.paye_le, c.mode
         FROM membres m
         LEFT JOIN cotisations c ON c.membre_id = m.id AND c.reunion_id = $1
        WHERE (m.actif AND m.date_adhesion <= $2) OR c.id IS NOT NULL
        ORDER BY m.nom, m.prenom`,
      [id, r.date]
    );
    res.json({ ...r, reste: Math.max(0, (r.attendus - r.payes) * r.montant), membres: membres.rows });
  } catch (e) { next(e); }
});

router.post('/', role('admin'), async (req, res, next) => {
  try {
    const r = lire(req.body || {});
    const { rows } = await db.query(
      'INSERT INTO reunions (date, lieu, notes, montant) VALUES ($1,$2,$3,$4) RETURNING *',
      [r.date, r.lieu, r.notes, r.montant]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const r = lire(req.body || {});
    const { rows } = await db.query(
      'UPDATE reunions SET date=$1, lieu=$2, notes=$3, montant=$4, modifie_le=now() WHERE id=$5 RETURNING *',
      [r.date, r.lieu, r.notes, r.montant, id]
    );
    if (!rows[0]) return res.status(404).json({ erreur: 'Réunion introuvable' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const { rowCount } = await db.query('DELETE FROM reunions WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ erreur: 'Réunion introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Cotisations (admin et agent) ----

// Encaisser la cotisation d'un membre pour cette réunion
router.post('/:id/cotisations', role('admin', 'agent'), async (req, res, next) => {
  try {
    const reunionId = v.id(req.params.id);
    const membreId = v.id(req.body && req.body.membre_id);
    const mode = ['especes', 'virement', 'autre'].includes(req.body.mode) ? req.body.mode : 'especes';
    const r = await db.query('SELECT montant FROM reunions WHERE id=$1', [reunionId]);
    if (!r.rows[0]) return res.status(404).json({ erreur: 'Réunion introuvable' });
    const montant = v.montant(req.body.montant, 'montant', r.rows[0].montant);
    const m = await db.query('SELECT id FROM membres WHERE id=$1', [membreId]);
    if (!m.rows[0]) return res.status(404).json({ erreur: 'Membre introuvable' });
    const { rows } = await db.query(
      `INSERT INTO cotisations (reunion_id, membre_id, montant, mode, encaisse_par)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (reunion_id, membre_id) DO NOTHING
       RETURNING *`,
      [reunionId, membreId, montant, mode, req.utilisateur.id]
    );
    if (!rows[0]) return res.status(409).json({ erreur: 'Cotisation déjà enregistrée pour ce membre' });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// Annuler un encaissement (erreur de saisie)
router.delete('/:id/cotisations/:membreId', role('admin', 'agent'), async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM cotisations WHERE reunion_id=$1 AND membre_id=$2',
      [v.id(req.params.id), v.id(req.params.membreId)]
    );
    if (!rowCount) return res.status(404).json({ erreur: 'Aucune cotisation à annuler' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
