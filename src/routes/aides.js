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

// On ne verse pas plus que ce qui a été encaissé à cette réunion
function verifierFonds(b, montant) {
  if (montant > b.restant) {
    throw new Conflit(`Fonds insuffisants : il reste ${s.euros(Math.max(0, b.restant))} disponibles sur cette réunion`);
  }
}

// ---- Aides ----

router.post('/aides', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const data = await lireAide(req.body || {});
    verifierFonds(await bilan(r.id), data.montant);
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
    verifierFonds(await bilan(r.id, { sansAide: aideId }), data.montant);
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

// ---- Remise du restant à un membre ----

// Confier (ou mettre à jour) : le montant et le nom sont figés à cet instant
router.put('/remise', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const depositaire_id = v.id((req.body || {}).depositaire_id);
    const m = await prisma.membre.findUnique({ where: { id: depositaire_id }, select: { prenom: true, nom: true } });
    if (!m) return res.status(400).json({ erreur: 'Membre introuvable' });
    const { restant } = await bilan(r.id);
    if (restant <= 0) return res.status(409).json({ erreur: "Il n'y a pas de restant à confier pour cette réunion" });
    const maj = await prisma.reunion.update({
      where: { id: r.id },
      data: { depositaire_id, depositaire_nom: `${m.prenom} ${m.nom}`, montant_remis: restant, remis_le: new Date() },
    });
    res.json(s.reunion(maj));
  } catch (e) { next(e); }
});

router.delete('/remise', async (req, res, next) => {
  try {
    const r = await reunionOu404(req, res);
    if (!r) return;
    const maj = await prisma.reunion.update({
      where: { id: r.id },
      data: { depositaire_id: null, depositaire_nom: null, montant_remis: null, remis_le: null },
    });
    res.json(s.reunion(maj));
  } catch (e) { next(e); }
});

module.exports = router;
module.exports.bilan = bilan;
