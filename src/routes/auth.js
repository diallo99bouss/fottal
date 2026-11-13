const express = require('express');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const s = require('../serialize');
const { COOKIE, signer, authentifie } = require('../middleware/auth');

const router = express.Router();

const SELECT_ASSO = { id: true, nom: true, montant_cotisation: true, intervalle_mois: true, actif: true };

// Utilisateur renvoyé au frontend (sans le mot de passe), avec son association
function profil(u, asso) {
  return {
    id: u.id,
    nom: u.nom,
    email: u.email,
    role: u.role,
    association_id: u.association_id ?? null,
    association: asso ? s.association(asso) : null,
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, motDePasse } = req.body || {};
    if (!email || !motDePasse) return res.status(400).json({ erreur: 'Email et mot de passe requis' });
    const u = await prisma.utilisateur.findFirst({
      where: { email: { equals: String(email).trim(), mode: 'insensitive' } },
      include: { association: { select: SELECT_ASSO } },
    });
    if (!u || !(await bcrypt.compare(String(motDePasse), u.mot_de_passe))) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' });
    }
    if (u.association && !u.association.actif) {
      return res.status(403).json({ erreur: 'Votre association est désactivée. Contactez l\'administrateur de FOTTAL.' });
    }
    res.cookie(COOKIE, signer(u), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 3600 * 1000,
    });
    res.json(profil(u, u.association));
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

// Profil à jour (nom de l'association, réglages) : relu en base à chaque appel
router.get('/me', authentifie, async (req, res, next) => {
  try {
    const u = await prisma.utilisateur.findUnique({
      where: { id: req.utilisateur.id },
      include: { association: { select: SELECT_ASSO } },
    });
    if (!u) {
      res.clearCookie(COOKIE);
      return res.status(401).json({ erreur: 'Compte introuvable, reconnectez-vous' });
    }
    if (u.association && !u.association.actif) {
      res.clearCookie(COOKIE);
      return res.status(403).json({ erreur: 'Votre association est désactivée' });
    }
    res.json(profil(u, u.association));
  } catch (e) { next(e); }
});

module.exports = router;
