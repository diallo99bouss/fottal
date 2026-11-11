const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { COOKIE, signer, authentifie } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, motDePasse } = req.body || {};
    if (!email || !motDePasse) return res.status(400).json({ erreur: 'Email et mot de passe requis' });
    const { rows } = await db.query('SELECT * FROM utilisateurs WHERE lower(email) = lower($1)', [email.trim()]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(motDePasse, u.mot_de_passe))) {
      return res.status(401).json({ erreur: 'Email ou mot de passe incorrect' });
    }
    res.cookie(COOKIE, signer(u), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 12 * 3600 * 1000,
    });
    res.json({ id: u.id, nom: u.nom, email: u.email, role: u.role });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get('/me', authentifie, (req, res) => {
  res.json(req.utilisateur);
});

module.exports = router;
