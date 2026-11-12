// Crée (ou met à jour) un compte de connexion
// Usage : npm run user:create -- <email> <motDePasse> <admin|agent> "<Nom affiché>"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/db');

(async () => {
  const [email, motDePasse, role, ...nomParts] = process.argv.slice(2);
  const nom = nomParts.join(' ') || email;
  if (!email || !motDePasse || !['admin', 'agent'].includes(role)) {
    console.log('Usage : npm run user:create -- <email> <motDePasse> <admin|agent> "<Nom>"');
    process.exit(1);
  }
  if (motDePasse.length < 8) {
    console.log('Le mot de passe doit faire au moins 8 caractères.');
    process.exit(1);
  }
  const data = { nom, mot_de_passe: await bcrypt.hash(motDePasse, 10), role };
  const u = await prisma.utilisateur.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), ...data },
    update: data,
  });
  console.log(`Compte prêt : ${u.email} (${u.role})`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
