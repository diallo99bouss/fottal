const express = require('express');
const { prisma, Prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { role } = require('../middleware/auth');

const router = express.Router();

// Montant dû = réunions passées depuis l'adhésion et non payées (membres actifs uniquement).
// Agrégat calculé en SQL : plus clair et plus rapide qu'en passant par l'ORM.
function selectMembres(where = Prisma.empty) {
  return prisma.$queryRaw`
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
    ) d ON TRUE
    ${where}
    ORDER BY m.nom, m.prenom`;
}

function lire(body) {
  return {
    prenom: v.texte(body.prenom, 'prénom', { requis: true }),
    nom: v.texte(body.nom, 'nom', { requis: true }),
    telephone: v.texte(body.telephone, 'téléphone'),
    email: v.texte(body.email, 'email'),
    date_adhesion: s.versDate(v.date(body.date_adhesion, "date d'adhésion") || s.aujourdhui()),
    actif: body.actif === undefined ? true : Boolean(body.actif),
  };
}

const introuvable = (res) => res.status(404).json({ erreur: 'Membre introuvable' });
const estIntrouvable = (e) => e && e.code === 'P2025';

// Liste (admin et agent)
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const like = `%${q}%`;
    const where = q
      ? Prisma.sql`WHERE m.prenom ILIKE ${like} OR m.nom ILIKE ${like} OR m.telephone ILIKE ${like}`
      : Prisma.empty;
    const rows = await selectMembres(where);
    res.json(rows.map(s.membre));
  } catch (e) { next(e); }
});

// Détail + historique des réunions depuis l'adhésion
router.get('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const [m] = await selectMembres(Prisma.sql`WHERE m.id = ${id}`);
    if (!m) return introuvable(res);
    const reunions = await prisma.reunion.findMany({
      where: { date: { gte: s.versDate(s.jour(m.date_adhesion)) } },
      orderBy: { date: 'desc' },
      include: { cotisations: { where: { membre_id: id } } },
    });
    const historique = reunions.map(({ cotisations: [c], ...r }) => ({
      id: r.id,
      date: s.jour(r.date),
      lieu: r.lieu,
      montant: s.nombre(r.montant),
      cotisation_id: c ? c.id : null,
      montant_paye: c ? s.nombre(c.montant) : null,
      paye_le: c ? c.paye_le : null,
      mode: c ? c.mode : null,
    }));
    res.json({ ...s.membre(m), historique });
  } catch (e) { next(e); }
});

// Ajouter (admin)
router.post('/', role('admin'), async (req, res, next) => {
  try {
    const m = await prisma.membre.create({ data: lire(req.body || {}) });
    res.status(201).json(s.membre(m));
  } catch (e) { next(e); }
});

// Modifier (admin) — modifie_le est mis à jour par Prisma (@updatedAt)
router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const m = await prisma.membre.update({ where: { id }, data: lire(req.body || {}) });
    res.json(s.membre(m));
  } catch (e) {
    if (estIntrouvable(e)) return introuvable(res);
    next(e);
  }
});

// Supprimer (admin) — ses cotisations sont supprimées aussi (ON DELETE CASCADE)
router.delete('/:id', role('admin'), async (req, res, next) => {
  try {
    await prisma.membre.delete({ where: { id: v.id(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    if (estIntrouvable(e)) return introuvable(res);
    next(e);
  }
});

module.exports = router;
