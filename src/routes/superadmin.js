// Espace super-admin (administrateur de l'application FOTTAL) — monté avec role('superadmin')
//   GET  /associations             liste + chiffres clés
//   POST /associations             crée une association et le compte de son président
//   PUT  /associations/:id         renomme / active / désactive
//   GET  /associations/:id/comptes comptes de l'association
//   POST /associations/:id/comptes ajoute un compte (admin ou agent)
//   PUT  /comptes/:id              modifie un compte (nom, email, rôle, mot de passe)
// Le super-admin ne voit pas le détail des membres ni des cotisations d'une association.
const express = require('express');
const { prisma } = require('../db');
const v = require('../validation');
const s = require('../serialize');
const { lireEmail, hacherMotDePasse, lireCoordonnees, compte, emailPris, MSG_EMAIL_PRIS } = require('../comptes');

const router = express.Router();

const introuvable = (res) => res.status(404).json({ erreur: 'Association introuvable' });

function lireRole(valeur) {
  const r = valeur || 'admin';
  if (!['admin', 'agent'].includes(r)) throw new v.ErreurValidation('Rôle invalide (administrateur ou agent)');
  return r;
}

function lireIntervalle(valeur) {
  if (valeur === undefined || valeur === null || valeur === '') return 2;
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    throw new v.ErreurValidation('Le nombre de mois entre deux réunions doit être entre 1 et 12');
  }
  return n;
}

router.get('/associations', async (req, res, next) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT a.id, a.nom, a.actif, a.cree_le, a.montant_cotisation::float AS montant_cotisation, a.intervalle_mois,
        (SELECT count(*) FROM membres m WHERE m.association_id = a.id AND m.actif)::int AS membres,
        (SELECT count(*) FROM reunions r WHERE r.association_id = a.id)::int              AS reunions,
        (SELECT count(*) FROM utilisateurs u WHERE u.association_id = a.id)::int          AS comptes,
        (SELECT max(r.date) FROM reunions r WHERE r.association_id = a.id AND r.date <= CURRENT_DATE) AS derniere_reunion,
        (SELECT string_agg(u.nom, ', ' ORDER BY u.nom) FROM utilisateurs u
          WHERE u.association_id = a.id AND u.role = 'admin')                              AS administrateurs,
        (SELECT count(*) FROM utilisateurs u WHERE u.association_id = a.id AND u.role = 'agent')::int AS agents,
        p.nom AS president, p.telephone AS president_telephone, p.ville AS president_ville
      FROM associations a
      LEFT JOIN LATERAL (
        SELECT u.nom, u.telephone, u.ville FROM utilisateurs u
         WHERE u.association_id = a.id AND u.role = 'admin'
         ORDER BY u.id LIMIT 1
      ) p ON TRUE
      ORDER BY a.nom`;
    res.json(rows.map((a) => ({ ...a, derniere_reunion: s.jour(a.derniere_reunion) })));
  } catch (e) { next(e); }
});

// Nouvelle association + compte de son président (administrateur), en une seule opération
router.post('/associations', async (req, res, next) => {
  try {
    const body = req.body || {};
    const admin = body.admin || {};
    const donneesAdmin = {
      nom: v.texte(admin.nom, 'nom du président', { requis: true }),
      email: lireEmail(admin.email),
      mot_de_passe: await hacherMotDePasse(admin.motDePasse),
      ...lireCoordonnees(admin),
      role: 'admin',
    };
    const a = await prisma.association.create({
      data: {
        nom: v.texte(body.nom, 'nom de l\'association', { requis: true }),
        montant_cotisation: v.montant(body.montant_cotisation, 'cotisation', 30),
        intervalle_mois: lireIntervalle(body.intervalle_mois),
        utilisateurs: { create: donneesAdmin },
      },
    });
    res.status(201).json(s.association(a));
  } catch (e) {
    if (emailPris(e)) return res.status(409).json({ erreur: MSG_EMAIL_PRIS });
    next(e);
  }
});

router.put('/associations/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const body = req.body || {};
    const data = {};
    if (body.nom !== undefined) data.nom = v.texte(body.nom, 'nom', { requis: true });
    if (body.actif !== undefined) data.actif = Boolean(body.actif);
    const a = await prisma.association.update({ where: { id }, data });
    res.json(s.association(a));
  } catch (e) {
    if (e && e.code === 'P2025') return introuvable(res);
    next(e);
  }
});

router.get('/associations/:id/comptes', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const liste = await prisma.utilisateur.findMany({ where: { association_id: id }, orderBy: [{ role: 'asc' }, { nom: 'asc' }] });
    res.json(liste.map(compte));
  } catch (e) { next(e); }
});

router.post('/associations/:id/comptes', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    if (!(await prisma.association.findUnique({ where: { id }, select: { id: true } }))) return introuvable(res);
    const body = req.body || {};
    const u = await prisma.utilisateur.create({
      data: {
        nom: v.texte(body.nom, 'nom', { requis: true }),
        email: lireEmail(body.email),
        role: lireRole(body.role),
        mot_de_passe: await hacherMotDePasse(body.motDePasse),
        ...lireCoordonnees(body),
        association_id: id,
      },
    });
    res.status(201).json(compte(u));
  } catch (e) {
    if (emailPris(e)) return res.status(409).json({ erreur: MSG_EMAIL_PRIS });
    next(e);
  }
});

// Modifier un compte d'association (ex. réinitialiser le mot de passe d'un président)
router.put('/comptes/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const body = req.body || {};
    const existe = await prisma.utilisateur.findUnique({ where: { id } });
    if (!existe || existe.role === 'superadmin') return res.status(404).json({ erreur: 'Compte introuvable' });
    const motDePasse = await hacherMotDePasse(body.motDePasse, { requis: false });
    const u = await prisma.utilisateur.update({
      where: { id },
      data: {
        nom: v.texte(body.nom ?? existe.nom, 'nom', { requis: true }),
        email: lireEmail(body.email ?? existe.email),
        role: lireRole(body.role ?? existe.role),
        ...lireCoordonnees({
          telephone: body.telephone !== undefined ? body.telephone : existe.telephone,
          adresse: body.adresse !== undefined ? body.adresse : existe.adresse,
          ville: body.ville !== undefined ? body.ville : existe.ville,
        }),
        ...(motDePasse ? { mot_de_passe: motDePasse } : {}),
      },
    });
    res.json(compte(u));
  } catch (e) {
    if (emailPris(e)) return res.status(409).json({ erreur: MSG_EMAIL_PRIS });
    next(e);
  }
});

module.exports = router;
