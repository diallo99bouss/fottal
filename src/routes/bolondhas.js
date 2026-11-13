const express = require('express');
const { prisma } = require('../db');
const v = require('../validation');
const { role } = require('../middleware/auth');

const router = express.Router();
// Toutes les requêtes sont limitées à l'association de l'utilisateur : req.asso (middleware association)

const introuvable = (res) => res.status(404).json({ erreur: 'Bolondha introuvable' });
const formater = ({ _count, ...b }) => ({ ...b, nb_membres: _count.membres });

// Refuse un nom déjà pris dans l'association (sans tenir compte des majuscules)
async function verifierNomLibre(asso, nom, saufId) {
  const existe = await prisma.bolondha.findFirst({
    where: { association_id: asso, nom: { equals: nom, mode: 'insensitive' }, ...(saufId ? { NOT: { id: saufId } } : {}) },
  });
  if (existe) {
    const e = new Error(`La bolondha « ${existe.nom} » existe déjà`);
    e.status = 409;
    throw e;
  }
}

// Liste avec le nombre de membres (admin et agent : sert au formulaire et aux filtres)
router.get('/', async (req, res, next) => {
  try {
    const liste = await prisma.bolondha.findMany({
      where: { association_id: req.asso },
      orderBy: { nom: 'asc' },
      include: { _count: { select: { membres: true } } },
    });
    res.json(liste.map(formater));
  } catch (e) { next(e); }
});

router.post('/', role('admin'), async (req, res, next) => {
  try {
    const nom = v.texte((req.body || {}).nom, 'nom', { requis: true });
    await verifierNomLibre(req.asso, nom);
    const b = await prisma.bolondha.create({
      data: { nom, association_id: req.asso },
      include: { _count: { select: { membres: true } } },
    });
    res.status(201).json(formater(b));
  } catch (e) { next(e); }
});

router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const nom = v.texte((req.body || {}).nom, 'nom', { requis: true });
    await verifierNomLibre(req.asso, nom, id);
    const b = await prisma.bolondha.update({
      where: { id, association_id: req.asso },
      data: { nom },
      include: { _count: { select: { membres: true } } },
    });
    res.json(formater(b));
  } catch (e) {
    if (e.code === 'P2025') return introuvable(res);
    next(e);
  }
});

// Suppression refusée tant que des membres y sont rattachés
router.delete('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const b = await prisma.bolondha.findFirst({ where: { id, association_id: req.asso }, select: { id: true } });
    if (!b) return introuvable(res);
    const nb = await prisma.membre.count({ where: { bolondha_id: id } });
    if (nb > 0) {
      return res.status(409).json({
        erreur: `Impossible de supprimer : ${nb} membre${nb > 1 ? 's sont rattachés' : ' est rattaché'} à cette bolondha. Changez d'abord leur bolondha.`,
      });
    }
    await prisma.bolondha.delete({ where: { id, association_id: req.asso } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return introuvable(res);
    if (e.code === 'P2003') return res.status(409).json({ erreur: 'Des membres sont encore rattachés à cette bolondha' });
    next(e);
  }
});

module.exports = router;
