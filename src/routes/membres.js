const express = require('express');
const { prisma, Prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { role } = require('../middleware/auth');

const router = express.Router();

// Solde d'un membre (cotisations à montant libre) :
//   total_attendu = somme des cotisations des réunions passées depuis l'adhésion
//   total_paye    = tout ce qu'il a versé (30 €, 50 €… selon les fois)
//   montant_du    = attendu − payé si positif ; avance = payé − attendu si positif
// Un membre inactif ne doit plus rien (comme avant).
// Agrégat calculé en SQL : plus clair et plus rapide qu'en passant par l'ORM.
function selectMembres(where = Prisma.empty) {
  return prisma.$queryRaw`
    SELECT m.*,
      b.nom                                                    AS bolondha,
      COALESCE(d.nb, 0)::int                                   AS reunions_dues,
      COALESCE(d.attendu, 0)::float                            AS total_attendu,
      COALESCE(p.paye, 0)::float                               AS total_paye,
      CASE WHEN m.actif THEN GREATEST(COALESCE(d.attendu, 0) - COALESCE(p.paye, 0), 0) ELSE 0 END::float AS montant_du,
      CASE WHEN m.actif THEN GREATEST(COALESCE(p.paye, 0) - COALESCE(d.attendu, 0), 0) ELSE 0 END::float AS avance
    FROM membres m
    LEFT JOIN bolondhas b ON b.id = m.bolondha_id
    LEFT JOIN LATERAL (
      -- Réunions passées depuis l'adhésion : montant attendu et nombre de réunions pas (entièrement) payées
      SELECT sum(r.montant) AS attendu,
             count(*) FILTER (WHERE COALESCE(c.montant, 0) < r.montant) AS nb
      FROM reunions r
      LEFT JOIN cotisations c ON c.reunion_id = r.id AND c.membre_id = m.id
      WHERE r.date <= CURRENT_DATE
        AND r.date >= m.date_adhesion
        AND m.actif
    ) d ON TRUE
    LEFT JOIN LATERAL (
      SELECT sum(c.montant) AS paye FROM cotisations c WHERE c.membre_id = m.id
    ) p ON TRUE
    ${where}
    ORDER BY m.nom, m.prenom`;
}

async function lire(body) {
  const bolondha_id = v.idOptionnel(body.bolondha_id);
  if (bolondha_id && !(await prisma.bolondha.findUnique({ where: { id: bolondha_id } }))) {
    throw new v.ErreurValidation('Bolondha introuvable');
  }
  return {
    prenom: v.texte(body.prenom, 'prénom', { requis: true }),
    nom: v.texte(body.nom, 'nom', { requis: true }),
    telephone: v.texte(body.telephone, 'téléphone'),
    email: v.texte(body.email, 'email'),
    ville: v.texte(body.ville, 'ville'),
    bolondha_id,
    date_adhesion: s.versDate(v.date(body.date_adhesion, "date d'adhésion") || s.aujourdhui()),
    actif: body.actif === undefined ? true : Boolean(body.actif),
  };
}

const introuvable = (res) => res.status(404).json({ erreur: 'Membre introuvable' });
const estIntrouvable = (e) => e && e.code === 'P2025';

// Liste (admin et agent) — ?q= recherche texte, ?bolondha= filtre par bolondha
router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const like = `%${q}%`;
    const bolondhaId = v.idOptionnel(req.query.bolondha);
    const conditions = [];
    if (q) {
      conditions.push(Prisma.sql`(m.prenom ILIKE ${like} OR m.nom ILIKE ${like} OR m.telephone ILIKE ${like}
        OR m.ville ILIKE ${like} OR b.nom ILIKE ${like})`);
    }
    if (bolondhaId) conditions.push(Prisma.sql`m.bolondha_id = ${bolondhaId}`);
    const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
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
    const m = await prisma.membre.create({ data: await lire(req.body || {}) });
    res.status(201).json(s.membre(m));
  } catch (e) { next(e); }
});

// Modifier (admin) — modifie_le est mis à jour par Prisma (@updatedAt)
router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const m = await prisma.membre.update({ where: { id }, data: await lire(req.body || {}) });
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
