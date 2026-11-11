const jwt = require('jsonwebtoken');

const COOKIE = 'session';

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET manquant dans .env');
  return s;
}

function signer(utilisateur) {
  return jwt.sign(
    { id: utilisateur.id, role: utilisateur.role, nom: utilisateur.nom },
    secret(),
    { expiresIn: '12h' }
  );
}

// Vérifie que l'utilisateur est connecté
function authentifie(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ erreur: 'Connexion requise' });
  try {
    req.utilisateur = jwt.verify(token, secret());
    next();
  } catch {
    res.clearCookie(COOKIE);
    return res.status(401).json({ erreur: 'Session expirée, reconnectez-vous' });
  }
}

// Réservé aux rôles donnés, ex. role('admin')
function role(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.utilisateur.role)) {
      return res.status(403).json({ erreur: 'Action réservée à : ' + roles.join(', ') });
    }
    next();
  };
}

module.exports = { COOKIE, signer, authentifie, role };
