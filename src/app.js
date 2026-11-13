const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { authentifie, association, role } = require('./middleware/auth');

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));

// Données d'une association : réservées à ses comptes (admin et agent), filtrées sur req.asso
const asso = [authentifie, association];
app.use('/api/membres', asso, require('./routes/membres'));
app.use('/api/reunions', asso, require('./routes/reunions'));
app.use('/api/tableau', asso, require('./routes/tableau'));
app.use('/api/bolondhas', asso, require('./routes/bolondhas'));
app.use('/api/association', asso, require('./routes/association'));
app.use('/api/utilisateurs', asso, role('admin'), require('./routes/utilisateurs'));

// Administration de l'application (toutes les associations)
app.use('/api/superadmin', authentifie, role('superadmin'), require('./routes/superadmin'));

app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue' }));

// Interface web : site statique produit par `npm run web:build` (dossier web/out)
const WEB = path.join(__dirname, '..', 'web', 'out');

// /membres -> membres.html, / -> index.html (le site exporté a aussi des dossiers du même nom)
app.get(/^[^.]*$/, (req, res, next) => {
  const page = req.path === '/' ? 'index' : req.path.replace(/\/+$/, '');
  const fichier = path.join(WEB, page + '.html');
  if (!fichier.startsWith(WEB + path.sep)) return next();
  fs.access(fichier, fs.constants.R_OK, (err) => (err ? next() : res.sendFile(fichier)));
});
app.use(express.static(WEB, { redirect: false }));

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const page404 = path.join(WEB, '404.html');
  if (fs.existsSync(page404)) return res.status(404).sendFile(page404);
  res.status(404).send("Interface non construite : lancez `npm run web:build`, ou `npm run web:dev` en développement.");
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  if (err.status === 400 || err.status === 409) return res.status(err.status).json({ erreur: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide' });
  console.error(err);
  res.status(500).json({ erreur: 'Erreur serveur' });
});

module.exports = app;
