const express = require('express');
const { prisma, Prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { role } = require('../middleware/auth');
const { couverture } = require('../couverture');

const router = express.Router();
// Toutes les requêtes sont limitées à l'association de l'utilisateur : req.asso (middleware association)

// Solde d'un membre (cotisations à montant libre) :
//   total_attendu = somme des cotisations des réunions passées depuis l'adhésion
//   total_paye    = tout ce qu'il a versé (30 €, 50 €… selon les fois)
//   montant_du    = attendu − payé si positif ; avance = payé − attendu si positif
//   reunions_dues = réunions passées pas entièrement réglées, une fois les versements
//                   répartis du plus ancien retard au plus récent (voir couverture.js)
// Un membre inactif ne doit plus rien (comme avant).
// Agrégat calculé en SQL : plus clair et plus rapide qu'en passant par l'ORM.
function selectMembres(asso, conditions = []) {
  const where = Prisma.join([Prisma.sql`m.association_id = ${asso}`, ...conditions], ' AND ');
  return prisma.$queryRaw`
    WITH ${couverture(asso)}
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
      -- Réunions passées depuis l'adhésion : montant attendu et nombre de réunions pas entièrement réglées
      SELECT sum(cv.montant) AS attendu,
             count(*) FILTER (WHERE cv.couvert < cv.montant) AS nb
      FROM couverture cv
      WHERE cv.membre_id = m.id AND cv.date <= CURRENT_DATE
    ) d ON TRUE
    LEFT JOIN LATERAL (
      SELECT sum(c.montant) AS paye FROM cotisations c WHERE c.membre_id = m.id
    ) p ON TRUE
    WHERE ${where}
    ORDER BY m.nom, m.prenom`;
}

async function lire(body, asso) {
  const bolondha_id = v.idOptionnel(body.bolondha_id);
  if (bolondha_id && !(await prisma.bolondha.findFirst({ where: { id: bolondha_id, association_id: asso } }))) {
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
    const rows = await selectMembres(req.asso, conditions);
    res.json(rows.map(s.membre));
  } catch (e) { next(e); }
});

// Détail + historique des réunions depuis l'adhésion
router.get('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const [m] = await selectMembres(req.asso, [Prisma.sql`m.id = ${id}`]);
    if (!m) return introuvable(res);
    const reunions = await prisma.reunion.findMany({
      where: { association_id: req.asso, date: { gte: s.versDate(s.jour(m.date_adhesion)) } },
      orderBy: { date: 'desc' },
      include: { cotisations: { where: { membre_id: id } } },
    });
    // Part de chaque réunion réglée par l'ensemble de ses versements (du plus ancien retard au plus récent)
    const couv = await prisma.$queryRaw`
      WITH ${couverture(req.asso)}
      SELECT reunion_id, couvert::float AS couvert FROM couverture WHERE membre_id = ${id}`;
    const couvertPar = new Map(couv.map((c) => [c.reunion_id, c.couvert]));
    const historique = reunions.map(({ cotisations: [c], ...r }) => ({
      id: r.id,
      date: s.jour(r.date),
      lieu: r.lieu,
      montant: s.nombre(r.montant),
      // Membre inactif : pas de répartition, on prend ce qu'il a versé à cette réunion
      couvert: couvertPar.has(r.id) ? couvertPar.get(r.id) : Math.min(s.nombre(r.montant), c ? s.nombre(c.montant) : 0),
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
    const data = await lire(req.body || {}, req.asso);
    const m = await prisma.membre.create({ data: { ...data, association_id: req.asso } });
    res.status(201).json(s.membre(m));
  } catch (e) { next(e); }
});

// Modifier (admin) — modifie_le est mis à jour par Prisma (@updatedAt)
router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const data = await lire(req.body || {}, req.asso);
    const m = await prisma.membre.update({ where: { id, association_id: req.asso }, data });
    res.json(s.membre(m));
  } catch (e) {
    if (estIntrouvable(e)) return introuvable(res);
    next(e);
  }
});

// Supprimer (admin) — ses cotisations sont supprimées aussi (ON DELETE CASCADE)
router.delete('/:id', role('admin'), async (req, res, next) => {
  try {
    await prisma.membre.delete({ where: { id: v.id(req.params.id), association_id: req.asso } });
    res.json({ ok: true });
  } catch (e) {
    if (estIntrouvable(e)) return introuvable(res);
    next(e);
  }
});

module.exports = router;
