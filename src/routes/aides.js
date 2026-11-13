// Aides (maladie, décès…) et remise du restant d'une réunion — admin et agent
// Monté sous /api/reunions/:id (voir routes/reunions.js)
const express = require('express');
const { prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { role } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.use(role('admin', 'agent'));

const TYPES = ['maladie', 'deces', 'autre'];

class Conflit extends Error {
  constructor(message) { super(message); this.status = 409; }
}

// Bilan financier d'une réunion : encaissé − aides = restant
async function bilan(reunionId, { sansAide } = {}) {
  const [c, a] = await Promise.all([
    prisma.cotisation.aggregate({ where: { reunion_id: reunionId }, _sum: { montant: true } }),
    prisma.aide.aggregate({
      where: { reunion_id: reunionId, ...(sansAide ? { NOT: { id: sansAide } } : {}) },
      _sum: { montant: true },
    }),
  ]);
  const encaisse = s.nombre(c._sum.montant) || 0;
  const aides = s.nombre(a._sum.montant) || 0;
  return { encaisse, aides, restant: Math.round((encaisse - aides) * 100) / 100 };
}

async function reunionOu404(req, res) {
  const id = v.id(req.params.id);
  const r = await prisma.reunion.findUnique({ where: { id }, select: { id: true } });
  if (!r) res.status(404).json({ erreur: 'Réunion introuvable' });
  return r;
}

// Lit et valide une aide ; le nom du bénéficiaire est repris du membre s'il n'est pas saisi
async function lireAide(body) {
  const type = TYPES.includes(body.type) ? body.type : null;
  if (!type) throw new v.ErreurValidation("Type d'aide invalide (maladie, décès ou autre)");
  const montant = v.montant(body.montant, 'montant', null);
  if (!montant || montant <= 0) throw new v.ErreurValidation('Le montant doit être supérieur à 0');
  const membre_id = v.idOptionnel(body.membre_id);
  let beneficiaire_nom = v.texte(body.beneficiaire_nom, 'bénéficiaire');
  if (membre_id) {
    const m = await prisma.membre.findUnique({ where: { id: membre_id }, select: { prenom: true, nom: true } });
    if (!m) throw new v.ErreurValidation('Membre bénéficiaire introuvable');
    beneficiaire_nom = beneficiaire_nom || `${m.prenom} ${m.nom}`;
  }
  if (!beneficiaire_nom) throw new v.ErreurValidation('Choisissez un membre ou saisissez le nom du bénéficiaire');
  return { type, montant, membre_id, beneficiaire_nom, motif: v.texte(body.motif, 'motif') };
}

// On ne verse pas plus que ce qui reste dans la caisse de la réunion (encaissé − aides − déjà confié)
async function verifierFonds(reunionId, b, montant) {
  const dispo = Math.round((b.restant - (await totalRemis(reunionId))) * 100) / 100;
  if (montant > dispo) {
    throw new Conflit(`Fonds insuffisants : il reste ${s.euros(Math.max(0, dispo))} disponibles sur cette réunion`);
  }
}

// ---- Aides ----

router.post('/aides', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const data = await lireAide(req.body || {});
    await verifierFonds(r.id, await bilan(r.id), data.montant);
    const a = await prisma.aide.create({ data: { ...data, reunion_id: r.id, enregistre_par: req.utilisateur.id } });
    res.status(201).json(s.aide(a));
  } catch (e) { next(e); }
});

router.put('/aides/:aideId', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const aideId = v.id(req.params.aideId);
    const existe = await prisma.aide.findFirst({ where: { id: aideId, reunion_id: r.id } });
    if (!existe) return res.status(404).json({ erreur: 'Aide introuvable' });
    const data = await lireAide(req.body || {});
    await verifierFonds(r.id, await bilan(r.id, { sansAide: aideId }), data.montant);
    const a = await prisma.aide.update({ where: { id: aideId }, data });
    res.json(s.aide(a));
  } catch (e) { next(e); }
});

router.delete('/aides/:aideId', async (req, res, next) => {
  try {
    const { count } = await prisma.aide.deleteMany({
      where: { id: v.id(req.params.aideId), reunion_id: v.id(req.params.id) },
    });
    if (!count) return res.status(404).json({ erreur: 'Aide introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Remises : le restant est confié à une ou plusieurs personnes ----

const arrondi = (n) => Math.round(n * 100) / 100;

// Restant de la réunion déjà confié (hors remise en cours de modification)
async function totalRemis(reunionId, sauf) {
  const { _sum } = await prisma.remise.aggregate({
    where: { reunion_id: reunionId, ...(sauf ? { NOT: { id: sauf } } : {}) },
    _sum: { montant: true },
  });
  return s.nombre(_sum.montant) || 0;
}

// Lit le membre dépositaire et le montant (par défaut : tout ce qui reste à confier)
async function lireRemise(body, aConfier) {
  const membre_id = v.id(body.membre_id);
  const m = await prisma.membre.findUnique({ where: { id: membre_id }, select: { prenom: true, nom: true } });
  if (!m) throw new v.ErreurValidation('Membre introuvable');
  const montant = v.montant(body.montant, 'montant', aConfier);
  if (!(montant > 0)) throw new v.ErreurValidation('Le montant confié doit être supérieur à 0');
  if (montant > aConfier) {
    throw new Conflit(`Il ne reste que ${s.euros(Math.max(0, aConfier))} à confier sur cette réunion`);
  }
  return { membre_id, depositaire_nom: `${m.prenom} ${m.nom}`, montant };
}

router.post('/remises', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const { restant } = await bilan(r.id);
    const aConfier = arrondi(restant - (await totalRemis(r.id)));
    if (aConfier <= 0) return res.status(409).json({ erreur: 'Tout le restant de cette réunion est déjà confié' });
    const data = await lireRemise(req.body || {}, aConfier);
    const remise = await prisma.remise.create({ data: { ...data, reunion_id: r.id } });
    res.status(201).json(s.remise(remise));
  } catch (e) {
    if (e && e.code === 'P2002') {
      return res.status(409).json({ erreur: 'Ce membre a déjà une part : modifiez son montant' });
    }
    next(e);
  }
});

router.put('/remises/:remiseId', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const remiseId = v.id(req.params.remiseId);
    const existe = await prisma.remise.findFirst({ where: { id: remiseId, reunion_id: r.id } });
    if (!existe) return res.status(404).json({ erreur: 'Remise introuvable' });
    const { restant } = await bilan(r.id);
    const aConfier = arrondi(restant - (await totalRemis(r.id, remiseId)));
    const data = await lireRemise({ membre_id: existe.membre_id, ...(req.body || {}) }, aConfier);
    const remise = await prisma.remise.update({ where: { id: remiseId }, data: { ...data, remis_le: new Date() } });
    res.json(s.remise(remise));
  } catch (e) {
    if (e && e.code === 'P2002') {
      return res.status(409).json({ erreur: 'Ce membre a déjà une part : modifiez son montant' });
    }
    next(e);
  }
});

router.delete('/remises/:remiseId', async (req, res, next) => {
  try {
    const { count } = await prisma.remise.deleteMany({
      where: { id: v.id(req.params.remiseId), reunion_id: v.id(req.params.id) },
    });
    if (!count) return res.status(404).json({ erreur: 'Remise introuvable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.bilan = bilan;
