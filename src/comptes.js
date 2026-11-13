// Création / modification des comptes de connexion (utilisé par l'admin d'une association
// pour ses gérants, et par le super-admin pour les présidents)
const bcrypt = require('bcryptjs');
const v = require('./validation');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lireEmail(valeur) {
  const email = v.texte(valeur, 'email', { requis: true }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw new v.ErreurValidation('Adresse email invalide');
  return email;
}

async function hacherMotDePasse(valeur, { requis = true } = {}) {
  if (valeur === undefined || valeur === null || valeur === '') {
    if (requis) throw new v.ErreurValidation('Le mot de passe est obligatoire');
    return null;
  }
  if (String(valeur).length < 8) throw new v.ErreurValidation('Le mot de passe doit faire au moins 8 caractères');
  return bcrypt.hash(String(valeur), 10);
}

// Coordonnées facultatives d'une personne : téléphone, adresse, ville
function lireCoordonnees(body) {
  return {
    telephone: v.texte(body.telephone, 'téléphone'),
    adresse: v.texte(body.adresse, 'adresse'),
    ville: v.texte(body.ville, 'ville'),
  };
}

// Données publiques d'un compte (jamais le mot de passe)
const compte = (u) => ({
  id: u.id,
  nom: u.nom,
  email: u.email,
  role: u.role,
  telephone: u.telephone ?? null,
  adresse: u.adresse ?? null,
  ville: u.ville ?? null,
  association_id: u.association_id ?? null,
  cree_le: u.cree_le,
});

// Erreur Prisma « email déjà utilisé » (contrainte unique)
const emailPris = (e) => e && e.code === 'P2002';
const MSG_EMAIL_PRIS = 'Cette adresse email est déjà utilisée par un autre compte';

module.exports = { lireEmail, hacherMotDePasse, lireCoordonnees, compte, emailPris, MSG_EMAIL_PRIS };
