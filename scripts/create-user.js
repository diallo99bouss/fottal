// Crée (ou met à jour) un compte de connexion.
//
//   Super-admin (administre toute l'application) :
//     npm run user:create -- <email> <motDePasse> superadmin "<Nom>"
//
//   Compte d'une association (président = admin, gérant = agent) :
//     npm run user:create -- <email> <motDePasse> <admin|agent> "<Nom>" --association <id>
//   (les comptes d'association se créent normalement depuis l'application)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');

const USAGE = [
  'Usage :',
  '  npm run user:create -- <email> <motDePasse> superadmin "<Nom>"',
  '  npm run user:create -- <email> <motDePasse> <admin|agent> "<Nom>" --association <id>',
].join('\n');

(async () => {
  const args = process.argv.slice(2);
  // Option --association <id> (ou --association=<id>)
  let associationId = null;
  const i = args.findIndex((a) => a.startsWith('--association'));
  if (i >= 0) {
    const [, valeurInline] = args[i].split('=');
    associationId = Number(valeurInline ?? args[i + 1]);
    args.splice(i, valeurInline ? 1 : 2);
  }

  const [email, motDePasse, role, ...nomParts] = args;
  const nom = nomParts.join(' ') || email;
  if (!email || !motDePasse || !['superadmin', 'admin', 'agent'].includes(role)) {
    console.log(USAGE);
    process.exit(1);
  }
  if (motDePasse.length < 8) {
    console.log('Le mot de passe doit faire au moins 8 caractères.');
    process.exit(1);
  }
  if (role === 'superadmin') {
    associationId = null;
  } else {
    if (!Number.isInteger(associationId) || associationId <= 0) {
      const liste = await prisma.association.findMany({ select: { id: true, nom: true }, orderBy: { id: 'asc' } });
      console.log(USAGE);
      console.log('\nAssociations : ' + (liste.length ? liste.map((a) => `${a.id} = ${a.nom}`).join(', ') : 'aucune'));
      process.exit(1);
    }
    if (!(await prisma.association.findUnique({ where: { id: associationId } }))) {
      console.log(`Association ${associationId} introuvable.`);
      process.exit(1);
    }
  }

  const data = { nom, mot_de_passe: await bcrypt.hash(motDePasse, 10), role, association_id: associationId };
  const u = await prisma.utilisateur.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), ...data },
    update: data,
  });
  console.log(`Compte prêt : ${u.email} (${u.role}${u.association_id ? `, association ${u.association_id}` : ''})`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
