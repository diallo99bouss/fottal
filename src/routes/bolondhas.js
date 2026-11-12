const express = require('express');
const { prisma } = require('../db');
const v = require('../validation');
const { role } = require('../middleware/auth');

const router = express.Router();

const introuvable = (res) => res.status(404).json({ erreur: 'Bolondha introuvable' });
const formater = ({ _count, ...b }) => ({ ...b, nb_membres: _count.membres });

// Refuse un nom déjà pris (sans tenir compte des majuscules)
async function verifierNomLibre(nom, saufId) {
  const existe = await prisma.bolondha.findFirst({
    where: { nom: { equals: nom, mode: 'insensitive' }, ...(saufId ? { NOT: { id: saufId } } : {}) },
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
      orderBy: { nom: 'asc' },
      include: { _count: { select: { membres: true } } },
    });
    res.json(liste.map(formater));
  } catch (e) { next(e); }
});

router.post('/', role('admin'), async (req, res, next) => {
  try {
    const nom = v.texte((req.body || {}).nom, 'nom', { requis: true });
    await verifierNomLibre(nom);
    const b = await prisma.bolondha.create({
      data: { nom },
      include: { _count: { select: { membres: true } } },
    });
    res.status(201).json(formater(b));
  } catch (e) { next(e); }
});

router.put('/:id', role('admin'), async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const nom = v.texte((req.body || {}).nom, 'nom', { requis: true });
    await verifierNomLibre(nom, id);
    const b = await prisma.bolondha.update({
      where: { id },
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
    const nb = await prisma.membre.count({ where: { bolondha_id: id } });
    if (nb > 0) {
      return res.status(409).json({
        erreur: `Impossible de supprimer : ${nb} membre${nb > 1 ? 's sont rattachés' : ' est rattaché'} à cette bolondha. Changez d'abord leur bolondha.`,
      });
    }
    await prisma.bolondha.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return introuvable(res);
    if (e.code === 'P2003') return res.status(409).json({ erreur: 'Des membres sont encore rattachés à cette bolondha' });
    next(e);
  }
});

module.exports = router;
