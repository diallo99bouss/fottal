const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { authentifie } = require('./middleware/auth');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/membres', authentifie, require('./routes/membres'));
app.use('/api/reunions', authentifie, require('./routes/reunions'));
app.use('/api/tableau', authentifie, require('./routes/tableau'));
app.use('/api/bolondhas', authentifie, require('./routes/bolondhas'));

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
