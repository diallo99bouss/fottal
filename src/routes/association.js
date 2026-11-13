// Réglages et règlement de l'association de l'utilisateur
//   GET  /api/association            -> tous (admin et agent)
//   PUT  /api/association            -> admin : nom, cotisation par réunion, mois entre deux réunions
//   PUT  /api/association/reglement  -> admin : lois et règles
const express = require('express');
const { prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { role } = require('../middleware/auth');

const router = express.Router();

const SELECT = { id: true, nom: true, montant_cotisation: true, intervalle_mois: true, reglement: true, cree_le: true };

router.get('/', async (req, res, next) => {
  try {
    const a = await prisma.association.findUnique({ where: { id: req.asso }, select: SELECT });
    res.json(s.association(a));
  } catch (e) { next(e); }
});

function lireIntervalle(valeur, defaut) {
  if (valeur === undefined || valeur === null || valeur === '') return defaut;
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    throw new v.ErreurValidation('Le nombre de mois entre deux réunions doit être entre 1 et 12');
  }
  return n;
}

router.put('/', role('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const actuel = await prisma.association.findUnique({ where: { id: req.asso } });
    const a = await prisma.association.update({
      where: { id: req.asso },
      data: {
        nom: v.texte(body.nom, 'nom', { requis: true }),
        montant_cotisation: v.montant(body.montant_cotisation, 'cotisation', s.nombre(actuel.montant_cotisation)),
        intervalle_mois: lireIntervalle(body.intervalle_mois, actuel.intervalle_mois),
      },
      select: SELECT,
    });
    res.json(s.association(a));
  } catch (e) { next(e); }
});

// Règlement : { introduction, misAJourLe, sections: [{ titre, articles: [{ titre, texte }] }] }
function lireReglement(body) {
  const sections = Array.isArray(body.sections) ? body.sections : null;
  if (!sections) throw new v.ErreurValidation('Règlement invalide : sections manquantes');
  if (sections.length > 50) throw new v.ErreurValidation('Trop de sections (50 au maximum)');
  return {
    introduction: v.texte(body.introduction, 'introduction') || '',
    misAJourLe: s.aujourdhui(),
    sections: sections.map((sec, i) => {
      const articles = Array.isArray(sec && sec.articles) ? sec.articles : [];
      if (articles.length > 100) throw new v.ErreurValidation('Trop d\'articles dans une section (100 au maximum)');
      return {
        titre: v.texte(sec && sec.titre, `titre de la section ${i + 1}`, { requis: true }),
        articles: articles.map((a, j) => ({
          titre: v.texte(a && a.titre, 'titre de l\'article') || undefined,
          texte: v.texte(a && a.texte, `texte de l'article ${j + 1} (section ${i + 1})`, { requis: true }),
        })),
      };
    }),
  };
}

router.put('/reglement', role('admin'), async (req, res, next) => {
  try {
    const reglement = lireReglement(req.body || {});
    const a = await prisma.association.update({ where: { id: req.asso }, data: { reglement }, select: SELECT });
    res.json(s.association(a));
  } catch (e) { next(e); }
});

module.exports = router;
