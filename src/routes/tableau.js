const express = require('express');
const { prisma } = require('../db');
const s = require('../serialize');
const { prochaineDate } = require('./reunions');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [membres, caisse, aides, du, prochaine, conseillee] = await Promise.all([
      prisma.membre.count({ where: { actif: true } }),
      prisma.cotisation.aggregate({ _sum: { montant: true } }),
      prisma.aide.aggregate({ _sum: { montant: true } }),
      // Somme de ce que doit chaque membre actif (attendu − payé, positif) ; une avance ne compense pas la dette d'un autre
      prisma.$queryRaw`
        SELECT COALESCE(sum(GREATEST(
                 (SELECT COALESCE(sum(r.montant),0) FROM reunions r WHERE r.date >= m.date_adhesion AND r.date <= CURRENT_DATE)
               - (SELECT COALESCE(sum(c.montant),0) FROM cotisations c WHERE c.membre_id = m.id), 0)),0)::float AS total
          FROM membres m
         WHERE m.actif`,
      prisma.reunion.findFirst({
        where: { date: { gte: s.versDate(s.aujourdhui()) } },
        orderBy: { date: 'asc' },
      }),
      prochaineDate(),
    ]);
    res.json({
      membres,
      // Cotisations encaissées moins les aides versées (= total des restants confiés aux membres)
      en_caisse: Math.round(((s.nombre(caisse._sum.montant) || 0) - (s.nombre(aides._sum.montant) || 0)) * 100) / 100,
      aides_versees: s.nombre(aides._sum.montant) || 0,
      restant_du: du[0].total,
      prochaine_reunion: s.reunion(prochaine),
      date_conseillee: conseillee,
    });
  } catch (e) { next(e); }
});

module.exports = router;
