// Crée (ou met à jour) un compte de connexion
// Usage : npm run user:create -- <email> <motDePasse> <admin|agent> "<Nom affiché>"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

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
  const hash = await bcrypt.hash(motDePasse, 10);
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (email, nom, mot_de_passe, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET nom=EXCLUDED.nom, mot_de_passe=EXCLUDED.mot_de_passe, role=EXCLUDED.role
     RETURNING id, email, role`,
    [email.toLowerCase(), nom, hash, role]
  );
  console.log(`Compte prêt : ${rows[0].email} (${rows[0].role})`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
