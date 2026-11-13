const jwt = require('jsonwebtoken');
const { prisma } = require('../db');

const COOKIE = 'session';

// Rôles :
//   superadmin : administre l'application (toutes les associations), sans association propre
//   admin      : président d'une association (membres, réunions, réglages, comptes agents)
//   agent      : gérant d'une association (encaissements, aides, remises)
const ROLES = ['superadmin', 'admin', 'agent'];

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET manquant dans .env');
  return s;
}

function signer(utilisateur) {
  return jwt.sign(
    {
      id: utilisateur.id,
      role: utilisateur.role,
      nom: utilisateur.nom,
      association_id: utilisateur.association_id ?? null,
    },
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

// Données d'une association : l'utilisateur doit appartenir à une association active.
// Définit req.asso = identifiant de l'association ; toutes les requêtes doivent filtrer dessus.
async function association(req, res, next) {
  try {
    const id = req.utilisateur.association_id;
    if (!id) return res.status(403).json({ erreur: 'Réservé aux comptes d\'une association' });
    const a = await prisma.association.findUnique({ where: { id }, select: { actif: true } });
    if (!a) return res.status(401).json({ erreur: 'Association introuvable, reconnectez-vous' });
    if (!a.actif) return res.status(403).json({ erreur: 'Cette association est désactivée' });
    req.asso = id;
    next();
  } catch (e) { next(e); }
}

module.exports = { COOKIE, ROLES, signer, authentifie, role, association };
