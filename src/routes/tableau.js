const express = require('express');
const { prisma } = require('../db');
const s = require('../serialize');
const { prochaineDate } = require('./reunions');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const [membres, caisse, du, prochaine, conseillee] = await Promise.all([
      prisma.membre.count({ where: { actif: true } }),
      prisma.cotisation.aggregate({ _sum: { montant: true } }),
      // Total des réunions passées non payées par les membres actifs (agrégat SQL)
      prisma.$queryRaw`
        SELECT COALESCE(sum(r.montant),0)::float AS total
          FROM membres m JOIN reunions r ON r.date >= m.date_adhesion AND r.date <= CURRENT_DATE
         WHERE m.actif
           AND NOT EXISTS (SELECT 1 FROM cotisations c WHERE c.reunion_id=r.id AND c.membre_id=m.id)`,
      prisma.reunion.findFirst({
        where: { date: { gte: s.versDate(s.aujourdhui()) } },
        orderBy: { date: 'asc' },
      }),
      prochaineDate(),
    ]);
    res.json({
      membres,
      en_caisse: s.nombre(caisse._sum.montant) || 0,
      restant_du: du[0].total,
      prochaine_reunion: s.reunion(prochaine),
      date_conseillee: conseillee,
    });
  } catch (e) { next(e); }
});

module.exports = router;
