// Tests de bout en bout de l'API (nécessite une base PostgreSQL de test dans DATABASE_URL)
// Lancer : npm test
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { prisma } = require('../src/db');

let server, base;

before(async () => {
  // Repart d'une base vide puis applique les migrations Prisma
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS aides, cotisations, reunions, membres, bolondhas, utilisateurs, _prisma_migrations CASCADE');
  const dossier = path.join(__dirname, '..', 'prisma', 'migrations');
  for (const m of fs.readdirSync(dossier).filter((d) => fs.statSync(path.join(dossier, d)).isDirectory()).sort()) {
    const sql = fs.readFileSync(path.join(dossier, m, 'migration.sql'), 'utf8');
    // Une instruction par appel (requêtes préparées) ; on retire les lignes de commentaire
    for (const instr of sql.split(/;\s*$/m).map((x) => x.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(instr);
    }
  }
  const h = await bcrypt.hash('secret123', 4);
  await prisma.utilisateur.createMany({ data: [
    { email: 'admin@test.fr', nom: 'Admin', mot_de_passe: h, role: 'admin' },
    { email: 'agent@test.fr', nom: 'Agent', mot_de_passe: h, role: 'agent' },
  ] });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(async () => { server.close(); await prisma.$disconnect(); });

async function login(email) {
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, motDePasse: 'secret123' }) });
  assert.strictEqual(r.status, 200);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return async (method, url, body) => {
    const res = await fetch(base + url, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
}

test('parcours complet admin + agent', async () => {
  const anon = await fetch(base + '/membres');
  assert.strictEqual(anon.status, 401);

  const admin = await login('admin@test.fr');
  const agent = await login('agent@test.fr');

  const m1 = await admin('POST', '/membres', { prenom: 'Aminata', nom: 'Diallo', date_adhesion: '2026-01-01' });
  assert.strictEqual(m1.status, 201);
  assert.strictEqual(m1.body.date_adhesion, '2026-01-01');
  const m2 = await admin('POST', '/membres', { prenom: 'Moussa', nom: 'Bah', date_adhesion: '2026-01-01' });

  // L'agent ne peut pas gérer les membres ni les réunions
  assert.strictEqual((await agent('POST', '/membres', { prenom: 'X', nom: 'Y' })).status, 403);
  assert.strictEqual((await agent('DELETE', '/membres/' + m1.body.id)).status, 403);

  const r1 = await admin('POST', '/reunions', { date: '2026-03-14', lieu: 'Salle' });
  assert.strictEqual(r1.status, 201);
  assert.strictEqual(r1.body.montant, 30);
  assert.strictEqual(r1.body.date, '2026-03-14');
  assert.strictEqual((await agent('POST', '/reunions', { date: '2026-05-14' })).status, 403);

  const next = await admin('GET', '/reunions/prochaine-date');
  assert.strictEqual(next.body.date, '2026-05-14');

  // L'agent encaisse
  const c = await agent('POST', `/reunions/${r1.body.id}/cotisations`, { membre_id: m1.body.id });
  assert.strictEqual(c.status, 201);
  assert.strictEqual(c.body.montant, 30);
  assert.strictEqual((await agent('POST', `/reunions/${r1.body.id}/cotisations`, { membre_id: m1.body.id })).status, 409);

  const detail = await agent('GET', '/reunions/' + r1.body.id);
  assert.strictEqual(detail.body.attendus, 2);
  assert.strictEqual(detail.body.payes, 1);
  assert.strictEqual(detail.body.reste, 30);

  const membres = await admin('GET', '/membres');
  const moussa = membres.body.find((m) => m.id === m2.body.id);
  assert.strictEqual(moussa.montant_du, 30);
  assert.strictEqual(moussa.reunions_dues, 1);

  const fiche = await agent('GET', '/membres/' + m1.body.id);
  assert.strictEqual(fiche.body.historique.length, 1);
  assert.strictEqual(fiche.body.historique[0].date, '2026-03-14');
  assert.strictEqual(fiche.body.historique[0].montant_paye, 30);
  assert.strictEqual(detail.body.membres.length, 2);

  const tb = await admin('GET', '/tableau');
  assert.strictEqual(tb.body.en_caisse, 30);
  assert.strictEqual(tb.body.restant_du, 30);

  // Modification puis suppression
  assert.strictEqual((await admin('PUT', '/membres/' + m2.body.id, { prenom: 'Moussa', nom: 'Bah', telephone: '0600000000', date_adhesion: '2026-01-01' })).body.telephone, '0600000000');
  assert.strictEqual((await agent('DELETE', `/reunions/${r1.body.id}/cotisations/${m1.body.id}`)).status, 200);
  assert.strictEqual((await admin('DELETE', '/membres/' + m1.body.id)).status, 200);
  assert.strictEqual((await admin('DELETE', '/reunions/' + r1.body.id)).status, 200);

  // Validation
  assert.strictEqual((await admin('POST', '/reunions', { date: 'pas-une-date' })).status, 400);
  assert.strictEqual((await admin('POST', '/membres', { prenom: '' })).status, 400);
});

test('bolondhas : gestion par l\'admin et rattachement des membres', async () => {
  const admin = await login('admin@test.fr');
  const agent = await login('agent@test.fr');

  const b1 = await admin('POST', '/bolondhas', { nom: 'Kourasadio' });
  assert.strictEqual(b1.status, 201);
  assert.strictEqual(b1.body.nb_membres, 0);
  const b2 = await admin('POST', '/bolondhas', { nom: 'Kowly' });
  assert.strictEqual((await admin('POST', '/bolondhas', { nom: 'kowly' })).status, 409); // doublon
  assert.strictEqual((await admin('POST', '/bolondhas', { nom: ' ' })).status, 400);

  // L'agent lit la liste mais ne la modifie pas
  assert.strictEqual((await agent('GET', '/bolondhas')).status, 200);
  assert.strictEqual((await agent('POST', '/bolondhas', { nom: 'X' })).status, 403);
  assert.strictEqual((await agent('DELETE', '/bolondhas/' + b1.body.id)).status, 403);

  // Membre avec ville et bolondha
  const m = await admin('POST', '/membres', { prenom: 'Fatou', nom: 'Sow', ville: 'Paris', bolondha_id: b1.body.id, date_adhesion: '2026-01-01' });
  assert.strictEqual(m.status, 201);
  assert.strictEqual(m.body.ville, 'Paris');
  assert.strictEqual((await admin('POST', '/membres', { prenom: 'A', nom: 'B', bolondha_id: 99999 })).status, 400);

  const fiche = await admin('GET', '/membres/' + m.body.id);
  assert.strictEqual(fiche.body.bolondha, 'Kourasadio');
  assert.strictEqual((await admin('GET', '/membres?bolondha=' + b1.body.id)).body.length, 1);
  assert.strictEqual((await admin('GET', '/membres?bolondha=' + b2.body.id)).body.length, 0);
  assert.strictEqual((await admin('GET', '/membres?q=kourasa')).body.length, 1);

  // Renommer, puis suppression refusée tant qu'un membre y est rattaché
  assert.strictEqual((await admin('PUT', '/bolondhas/' + b1.body.id, { nom: 'Kourasadio Centre' })).body.nom, 'Kourasadio Centre');
  assert.strictEqual((await admin('PUT', '/bolondhas/' + b1.body.id, { nom: 'Kowly' })).status, 409);
  assert.strictEqual((await admin('GET', '/bolondhas')).body.find((b) => b.id === b1.body.id).nb_membres, 1);
  assert.strictEqual((await admin('DELETE', '/bolondhas/' + b1.body.id)).status, 409);

  await admin('PUT', '/membres/' + m.body.id, { prenom: 'Fatou', nom: 'Sow', bolondha_id: b2.body.id, date_adhesion: '2026-01-01' });
  assert.strictEqual((await admin('DELETE', '/bolondhas/' + b1.body.id)).status, 200);
  assert.strictEqual((await admin('DELETE', '/bolondhas/' + b1.body.id)).status, 404);
});

test('bilan de réunion : aides maladie/décès et remise du restant', async () => {
  const admin = await login('admin@test.fr');
  const agent = await login('agent@test.fr');

  const a = (await admin('POST', '/membres', { prenom: 'Awa', nom: 'Ba', date_adhesion: '2025-01-01' })).body;
  const b = (await admin('POST', '/membres', { prenom: 'Ibrahima', nom: 'Kane', date_adhesion: '2025-01-01' })).body;
  const r = (await admin('POST', '/reunions', { date: '2025-06-01', lieu: 'Salle' })).body;
  for (const m of [a, b]) await agent('POST', `/reunions/${r.id}/cotisations`, { membre_id: m.id });

  // Aide maladie à un membre (enregistrée par l'agent) puis décès d'une personne extérieure
  const maladie = await agent('POST', `/reunions/${r.id}/aides`, { type: 'maladie', membre_id: a.id, montant: 25, motif: 'Hospitalisation' });
  assert.strictEqual(maladie.status, 201);
  assert.strictEqual(maladie.body.beneficiaire_nom, 'Awa Ba');
  assert.strictEqual(maladie.body.montant, 25);
  assert.strictEqual((await admin('POST', `/reunions/${r.id}/aides`, { type: 'deces', beneficiaire_nom: 'Famille Diop', montant: 50 })).status, 409); // 60 − 25 = 35 dispo
  const deces = await admin('POST', `/reunions/${r.id}/aides`, { type: 'deces', beneficiaire_nom: 'Famille Diop', montant: 20 });
  assert.strictEqual(deces.status, 201);

  // Validation
  assert.strictEqual((await admin('POST', `/reunions/${r.id}/aides`, { type: 'vacances', beneficiaire_nom: 'X', montant: 5 })).status, 400);
  assert.strictEqual((await admin('POST', `/reunions/${r.id}/aides`, { type: 'autre', montant: 5 })).status, 400);
  assert.strictEqual((await admin('POST', `/reunions/${r.id}/aides`, { type: 'autre', beneficiaire_nom: 'X', montant: 0 })).status, 400);

  let detail = (await agent('GET', '/reunions/' + r.id)).body;
  assert.strictEqual(detail.encaisse, 60);
  assert.strictEqual(detail.total_aides, 45);
  assert.strictEqual(detail.restant, 15);
  assert.strictEqual(detail.aides.length, 2);

  // Remise du restant
  const remise = await agent('PUT', `/reunions/${r.id}/remise`, { depositaire_id: b.id });
  assert.strictEqual(remise.status, 200);
  assert.strictEqual(remise.body.montant_remis, 15);
  assert.strictEqual(remise.body.depositaire_nom, 'Ibrahima Kane');
  detail = (await agent('GET', '/reunions/' + r.id)).body;
  assert.strictEqual(detail.remise_a_jour, true);

  // Modifier une aide rend la remise obsolète, puis on la met à jour
  assert.strictEqual((await admin('PUT', `/reunions/${r.id}/aides/${deces.body.id}`, { type: 'deces', beneficiaire_nom: 'Famille Diop', montant: 30 })).status, 200);
  detail = (await agent('GET', '/reunions/' + r.id)).body;
  assert.strictEqual(detail.restant, 5);
  assert.strictEqual(detail.remise_a_jour, false);
  assert.strictEqual((await agent('PUT', `/reunions/${r.id}/remise`, { depositaire_id: b.id })).body.montant_remis, 5);

  // Annuler une cotisation est refusé si les aides dépassent alors l'encaissé (60 − 30 < 55)
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/cotisations/${a.id}`)).status, 409);

  // Tableau de bord : en caisse = encaissé − aides
  const tb = (await admin('GET', '/tableau')).body;
  assert.strictEqual(tb.aides_versees, 55);

  // Suppression d'une aide, annulation de la remise
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/aides/${maladie.body.id}`)).status, 200);
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/aides/${maladie.body.id}`)).status, 404);
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/remise`)).body.depositaire_id, null);
});

test('cotisations à montant libre : reste dû et avance', async () => {
  const admin = await login('admin@test.fr');
  const agent = await login('agent@test.fr');
  const solde = async (id) => (await admin('GET', '/membres/' + id)).body;

  const z = (await admin('POST', '/membres', { prenom: 'Zeinab', nom: 'Sy', date_adhesion: '2024-01-01' })).body;
  const avant = await solde(z.id); // réunions déjà existantes depuis 2024 (créées par les autres tests)
  const r1 = (await admin('POST', '/reunions', { date: '2024-02-01' })).body;
  const r2 = (await admin('POST', '/reunions', { date: '2024-04-01' })).body;

  // 50 € à la 1re réunion, 20 € à la 2e : attendu +60, payé 70
  assert.strictEqual((await agent('POST', `/reunions/${r1.id}/cotisations`, { membre_id: z.id, montant: 50 })).body.montant, 50);
  assert.strictEqual((await agent('POST', `/reunions/${r2.id}/cotisations`, { membre_id: z.id, montant: 20, mode: 'virement' })).body.mode, 'virement');
  assert.strictEqual((await agent('POST', `/reunions/${r1.id}/cotisations`, { membre_id: z.id, montant: 0 })).status, 400);

  let m = await solde(z.id);
  assert.strictEqual(m.total_attendu, avant.total_attendu + 60);
  assert.strictEqual(m.total_paye, 70);
  assert.strictEqual(m.montant_du, Math.max(0, avant.total_attendu + 60 - 70));
  assert.strictEqual(m.historique.find((h) => h.id === r2.id).montant_paye, 20);

  // Réunion 2 : 20 € sur 30 -> paiement partiel, 10 € de reste
  const d2 = (await admin('GET', '/reunions/' + r2.id)).body;
  assert.strictEqual(d2.partiels, 1);
  assert.strictEqual(d2.reste, 10);

  // Modifier un versement : 20 -> 40
  assert.strictEqual((await agent('PUT', `/reunions/${r2.id}/cotisations/${z.id}`, { montant: 40 })).body.montant, 40);
  assert.strictEqual((await agent('PUT', `/reunions/${r2.id}/cotisations/${z.id}`, { montant: 0 })).status, 400);
  assert.strictEqual((await agent('PUT', `/reunions/${r1.id}/cotisations/99999`, { montant: 10 })).status, 404);
  assert.strictEqual((await admin('GET', '/reunions/' + r2.id)).body.reste, 0);

  // Assez versé pour couvrir tout l'attendu + 10 € : avance de 10 €
  const total = avant.total_attendu + 60 + 10;
  await agent('PUT', `/reunions/${r1.id}/cotisations/${z.id}`, { montant: total - 40 });
  m = await solde(z.id);
  assert.strictEqual(m.montant_du, 0);
  assert.strictEqual(m.avance, 10);
});
