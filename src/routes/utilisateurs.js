// Comptes de l'association, gérés par son administrateur (président) :
// il crée les comptes des gérants (agents), peut ajouter un autre administrateur,
// changer un mot de passe ou supprimer un compte. Monté avec role('admin').
const express = require('express');
const { prisma } = require('../db');
const v = require('../validation');
const { lireEmail, hacherMotDePasse, lireCoordonnees, compte, emailPris, MSG_EMAIL_PRIS } = require('../comptes');

const router = express.Router();
const ROLES_ASSO = ['admin', 'agent'];

const introuvable = (res) => res.status(404).json({ erreur: 'Compte introuvable' });

function lireRole(valeur) {
  const r = valeur || 'agent';
  if (!ROLES_ASSO.includes(r)) throw new v.ErreurValidation('Rôle invalide (administrateur ou agent)');
  return r;
}

// L'association doit toujours garder au moins un administrateur
async function resteUnAdmin(asso, sansId) {
  const n = await prisma.utilisateur.count({ where: { association_id: asso, role: 'admin', NOT: { id: sansId } } });
  return n > 0;
}

router.get('/', async (req, res, next) => {
  try {
    const liste = await prisma.utilisateur.findMany({
      where: { association_id: req.asso },
      orderBy: [{ role: 'asc' }, { nom: 'asc' }],
    });
    res.json(liste.map(compte));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const u = await prisma.utilisateur.create({
      data: {
        nom: v.texte(body.nom, 'nom', { requis: true }),
        email: lireEmail(body.email),
        role: lireRole(body.role),
        mot_de_passe: await hacherMotDePasse(body.motDePasse),
        ...lireCoordonnees(body),
        association_id: req.asso,
      },
    });
    res.status(201).json(compte(u));
  } catch (e) {
    if (emailPris(e)) return res.status(409).json({ erreur: MSG_EMAIL_PRIS });
    next(e);
  }
});

// Modifier : nom, email, rôle ; mot de passe seulement s'il est fourni
router.put('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    const body = req.body || {};
    const existe = await prisma.utilisateur.findFirst({ where: { id, association_id: req.asso } });
    if (!existe) return introuvable(res);
    const nouveauRole = lireRole(body.role || existe.role);
    if (existe.role === 'admin' && nouveauRole !== 'admin' && !(await resteUnAdmin(req.asso, id))) {
      return res.status(409).json({ erreur: 'L\'association doit garder au moins un administrateur' });
    }
    const motDePasse = await hacherMotDePasse(body.motDePasse, { requis: false });
    const u = await prisma.utilisateur.update({
      where: { id },
      data: {
        nom: v.texte(body.nom, 'nom', { requis: true }),
        email: lireEmail(body.email),
        role: nouveauRole,
        ...lireCoordonnees(body),
        ...(motDePasse ? { mot_de_passe: motDePasse } : {}),
      },
    });
    res.json(compte(u));
  } catch (e) {
    if (emailPris(e)) return res.status(409).json({ erreur: MSG_EMAIL_PRIS });
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = v.id(req.params.id);
    if (id === req.utilisateur.id) return res.status(409).json({ erreur: 'Vous ne pouvez pas supprimer votre propre compte' });
    const existe = await prisma.utilisateur.findFirst({ where: { id, association_id: req.asso } });
    if (!existe) return introuvable(res);
    if (existe.role === 'admin' && !(await resteUnAdmin(req.asso, id))) {
      return res.status(409).json({ erreur: 'L\'association doit garder au moins un administrateur' });
    }
    await prisma.utilisateur.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
