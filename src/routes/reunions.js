const express = require('express');
const { prisma, Prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { role } = require('../middleware/auth');
const aides = require('./aides');
const { COUVERTURE } = require('../couverture');

const router = express.Router();
const COTISATION_REUNION = 30; // 15 € x 2 mois
const MODES = ['especes', 'virement', 'autre'];

// Statistiques par réunion :
//   attendus = membres actifs inscrits avant la date
//   payes / partiels / reste = selon la répartition des versements (couverture.js) :
//     une réunion est réglée si les versements du membre, affectés du plus ancien retard
//     au plus récent, la couvrent — même si l'argent a été donné à une réunion suivante
//   encaisse = argent réellement reçu à CETTE réunion (sert au bilan et à la remise)
async function selectReunions(where = Prisma.empty) {
  const rows = await prisma.$queryRaw`
    WITH ${COUVERTURE}
    SELECT r.*,
      (SELECT count(*) FROM couverture cv WHERE cv.reunion_id = r.id)::int                                  AS attendus,
      (SELECT count(*) FROM couverture cv WHERE cv.reunion_id = r.id AND cv.couvert >= cv.montant)::int     AS payes,
      (SELECT count(*) FROM couverture cv WHERE cv.reunion_id = r.id AND cv.couvert > 0 AND cv.couvert < cv.montant)::int AS partiels,
      (SELECT COALESCE(sum(c.montant),0) FROM cotisations c WHERE c.reunion_id = r.id)::float               AS encaisse,
      (SELECT COALESCE(sum(a.montant),0) FROM aides a WHERE a.reunion_id = r.id)::float                     AS total_aides,
      (SELECT COALESCE(sum(rm.montant),0) FROM remises rm WHERE rm.reunion_id = r.id)::float                AS total_remis,
      (SELECT string_agg(rm.depositaire_nom, ', ' ORDER BY rm.montant DESC) FROM remises rm WHERE rm.reunion_id = r.id) AS depositaires,
      (SELECT COALESCE(sum(cv.montant - cv.couvert),0) FROM couverture cv WHERE cv.reunion_id = r.id)::float AS reste
    FROM reunions r
    ${where}
    ORDER BY r.date DESC`;
  return rows.map((row) => {
    const r = s.reunion(row);
    const restant = Math.round((r.encaisse - r.total_aides) * 100) / 100;
    return {
      ...r,
      restant, // encaissé − aides : l'argent à confier
      // Partie du restant pas encore confiée (négatif si on a confié plus que le restant,
      // par ex. après une aide ou un versement modifié)
      a_confier: Math.round((restant - r.total_remis) * 100) / 100,
    };
  });
}

// Date conseillée : 2 mois après la dernière réunion
async function prochaineDate() {
  const { _max } = await prisma.reunion.aggregate({ _max: { date: true } });
  return _max.date ? s.ajouterMois(s.jour(_max.date), 2) : null;
}

function lire(body) {
  return {
    date: s.versDate(v.date(body.date, 'date', { requis: true })),
    lieu: v.texte(body.lieu, 'lieu'),
    notes: v.texte(body.notes, 'notes'),
    montant: v.montant(body.montant, 'montant', COTISATION_REUNION),
  };
}

const introuvable = (res) => res.status(404).json({ erreur: 'Réunion introuvable' });
const estIntrouvable = (e) => e && e.code === 'P2025';

router.get('/', async (req, res, next) => {
  try {
    res.json(await selectReunions());
  } catch (e) { next(e); }
});

router.get('/prochaine-date', async (req, res, next) => {
  try {
    res.json({ date: await prochaineDate() });
  } catch (e) { next(e); }
});

// Détail : membres attendus et leur statut de paiement
router.get('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const [r] = await selectReunions(Prisma.sql`WHERE r.id = ${id}`);
    if (!r) return introuvable(res);
    const membres = await prisma.membre.findMany({
      where: {
        OR: [
          { actif: true, date_adhesion: { lte: s.versDate(r.date) } },
          { cotisations: { some: { reunion_id: id } } },
        ],
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      select: {
        id: true,
        prenom: true,
        nom: true,
        telephone: true,
        cotisations: { where: { reunion_id: id } },
      },
    });
    // Par membre : part de cette réunion réglée, et tout ce qu'il doit jusqu'à cette réunion incluse
    // (retards + cotisation du jour) — sert à préremplir le montant à encaisser
    const couv = await prisma.$queryRaw`
      WITH ${COUVERTURE}
      SELECT cv.membre_id,
             cv.couvert::float AS couvert,
             (SELECT COALESCE(sum(c2.montant - c2.couvert), 0) FROM couverture c2
               WHERE c2.membre_id = cv.membre_id AND c2.date <= cv.date)::float AS du_cumule
        FROM couverture cv
       WHERE cv.reunion_id = ${id}`;
    const couvPar = new Map(couv.map((c) => [c.membre_id, c]));
    const [listeAides, listeRemises] = await Promise.all([
      prisma.aide.findMany({ where: { reunion_id: id }, orderBy: { cree_le: 'asc' } }),
      prisma.remise.findMany({ where: { reunion_id: id }, orderBy: { remis_le: 'asc' } }),
    ]);
    res.json({
      ...r,
      aides: listeAides.map(s.aide),
      remises: listeRemises.map(s.remise),
      membres: membres.map(({ cotisations: [c], ...m }) => ({
        ...m,
        // Membre inactif (pas de répartition) : on prend ce qu'il a versé ici
        couvert: couvPar.has(m.id) ? couvPar.get(m.id).couvert : Math.min(r.montant, c ? s.nombre(c.montant) : 0),
        du_cumule: couvPar.has(m.id) ? couvPar.get(m.id).du_cumule : 0,
        cotisation_id: c ? c.id : null,
        montant_paye: c ? s.nombre(c.montant) : null,
        paye_le: c ? c.paye_le : null,
        mode: c ? c.mode : null,
      })),
    });
  } catch (e) { next(e); }
});

router.post('/', role('admin'), async (req, res, next) => {
  try {
    const r = await prisma.reunion.create({ data: lire(req.body || {}) });
    res.status(201).json(s.reunion(r));
  } catch (e) { next(e); }
});

router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const r = await prisma.reunion.update({ where: { id: v.id(req.params.id) }, data: lire(req.body || {}) });
    res.json(s.reunion(r));
  } catch (e) {
    if (estIntrouvable(e)) return introuvable(res);
    next(e);
  }
});

router.delete('/:id', role('admin'), async (req, res, next) => {
  try {
    await prisma.reunion.delete({ where: { id: v.id(req.params.id) } });
    res.json({ ok: true });
  } catch (e) {
    if (estIntrouvable(e)) return introuvable(res);
    next(e);
  }
});

// ---- Aides et remise du restant (admin et agent) ----
router.use('/:id', aides);

// ---- Cotisations (admin et agent) ----

// Montant versé : libre (30 €, 50 €…), par défaut la cotisation de la réunion, jamais 0
function lireVersement(body, defaut) {
  const montant = v.montant(body.montant, 'montant', defaut);
  if (!(montant > 0)) throw new v.ErreurValidation('Le montant versé doit être supérieur à 0');
  return { montant, mode: MODES.includes(body.mode) ? body.mode : 'especes' };
}

// Encaisser la cotisation d'un membre pour cette réunion
router.post('/:id/cotisations', role('admin', 'agent'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const reunionId = v.id(req.params.id);
    const membreId = v.id(body.membre_id);
    const r = await prisma.reunion.findUnique({ where: { id: reunionId }, select: { montant: true } });
    if (!r) return introuvable(res);
    const { montant, mode } = lireVersement(body, s.nombre(r.montant));
    const m = await prisma.membre.findUnique({ where: { id: membreId }, select: { id: true } });
    if (!m) return res.status(404).json({ erreur: 'Membre introuvable' });
    const c = await prisma.cotisation.create({
      data: { reunion_id: reunionId, membre_id: membreId, montant, mode, encaisse_par: req.utilisateur.id },
    });
    res.status(201).json(s.cotisation(c));
  } catch (e) {
    // Contrainte UNIQUE (reunion_id, membre_id)
    if (e && e.code === 'P2002') return res.status(409).json({ erreur: 'Cotisation déjà enregistrée pour ce membre' });
    next(e);
  }
});

// Modifier un versement (montant ou mode) — refusé si les aides dépasseraient alors l'encaissé
router.put('/:id/cotisations/:membreId', role('admin', 'agent'), async (req, res, next) => {
  try {
    const reunionId = v.id(req.params.id);
    const membreId = v.id(req.params.membreId);
    const c = await prisma.cotisation.findFirst({ where: { reunion_id: reunionId, membre_id: membreId } });
    if (!c) return res.status(404).json({ erreur: 'Aucune cotisation à modifier' });
    const { montant, mode } = lireVersement(req.body || {}, s.nombre(c.montant));
    const b = await aides.bilan(reunionId);
    if (b.restant - s.nombre(c.montant) + montant < 0) {
      return res.status(409).json({
        erreur: `Montant trop faible : les aides versées (${s.euros(b.aides)}) dépasseraient l'argent encaissé. Modifiez d'abord les aides.`,
      });
    }
    const maj = await prisma.cotisation.update({ where: { id: c.id }, data: { montant, mode } });
    res.json(s.cotisation(maj));
  } catch (e) { next(e); }
});

// Annuler un encaissement (erreur de saisie)
router.delete('/:id/cotisations/:membreId', role('admin', 'agent'), async (req, res, next) => {
  try {
    // Refusé si les aides déjà versées dépasseraient alors l'argent encaissé
    const reunionId = v.id(req.params.id);
    const c = await prisma.cotisation.findFirst({ where: { reunion_id: reunionId, membre_id: v.id(req.params.membreId) } });
    if (c) {
      const b = await aides.bilan(reunionId);
      if (b.restant - s.nombre(c.montant) < 0) {
        return res.status(409).json({
          erreur: `Annulation impossible : les aides versées (${s.euros(b.aides)}) dépasseraient l'argent encaissé. Modifiez d'abord les aides.`,
        });
      }
    }
    const { count } = await prisma.cotisation.deleteMany({
      where: { reunion_id: v.id(req.params.id), membre_id: v.id(req.params.membreId) },
    });
    if (!count) return res.status(404).json({ erreur: 'Aucune cotisation à annuler' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.prochaineDate = prochaineDate;
