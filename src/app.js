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

app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route inconnue' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Gestion des erreurs
app.use((err, req, res, next) => {
  if (err.status === 400) return res.status(400).json({ erreur: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide' });
  console.error(err);
  res.status(500).json({ erreur: 'Erreur serveur' });
});

module.exports = app;
