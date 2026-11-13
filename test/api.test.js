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
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS remises, aides, cotisations, reunions, membres, bolondhas, utilisateurs, associations, _prisma_migrations CASCADE');
  const dossier = path.join(__dirname, '..', 'prisma', 'migrations');
  for (const m of fs.readdirSync(dossier).filter((d) => fs.statSync(path.join(dossier, d)).isDirectory()).sort()) {
    const sql = fs.readFileSync(path.join(dossier, m, 'migration.sql'), 'utf8');
    // Une instruction par appel (requêtes préparées) ; on retire les lignes de commentaire
    for (const instr of sql.split(/;\s*$/m).map((x) => x.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(instr);
    }
  }
  // Association de test (président admin@ et gérant agent@) + super-admin de l'application
  const h = await bcrypt.hash('secret123', 4);
  const asso = await prisma.association.create({ data: { nom: 'Association de test' } });
  await prisma.utilisateur.createMany({ data: [
    { email: 'admin@test.fr', nom: 'Admin', mot_de_passe: h, role: 'admin', association_id: asso.id },
    { email: 'agent@test.fr', nom: 'Agent', mot_de_passe: h, role: 'agent', association_id: asso.id },
    { email: 'super@test.fr', nom: 'Super', mot_de_passe: h, role: 'superadmin' },
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

  // Le restant (15 €) est partagé entre deux personnes
  const remises = `/reunions/${r.id}/remises`;
  const rB = await agent('POST', remises, { membre_id: b.id, montant: 10 });
  assert.strictEqual(rB.status, 201);
  assert.strictEqual(rB.body.montant, 10);
  assert.strictEqual(rB.body.depositaire_nom, 'Ibrahima Kane');
  assert.strictEqual((await agent('POST', remises, { membre_id: b.id, montant: 1 })).status, 409); // déjà une part
  assert.strictEqual((await agent('POST', remises, { membre_id: a.id, montant: 6 })).status, 409); // plus que le reste
  const rA = await agent('POST', remises, { membre_id: a.id }); // par défaut : tout le reste
  assert.strictEqual(rA.body.montant, 5);
  assert.strictEqual((await agent('POST', remises, { membre_id: a.id })).status, 409); // tout est confié

  detail = (await agent('GET', '/reunions/' + r.id)).body;
  assert.strictEqual(detail.total_remis, 15);
  assert.strictEqual(detail.a_confier, 0);
  assert.strictEqual(detail.remises.length, 2);
  assert.strictEqual(detail.depositaires, 'Ibrahima Kane, Awa Ba');
  assert.strictEqual((await agent('GET', '/reunions')).body.find((x) => x.id === r.id).depositaires, 'Ibrahima Kane, Awa Ba');

  // L'argent déjà confié n'est plus disponible pour une aide
  const aideDeces = `/reunions/${r.id}/aides/${deces.body.id}`;
  const partAwa = `${remises}/${rA.body.id}`;
  assert.strictEqual((await admin('PUT', aideDeces, { type: 'deces', beneficiaire_nom: 'Famille Diop', montant: 30 })).status, 409);
  assert.strictEqual((await agent('PUT', partAwa, { montant: 0 })).status, 400);
  assert.strictEqual((await agent('PUT', partAwa, { montant: 4 })).body.montant, 4);

  // On reprend la part d'Awa : 5 € redeviennent disponibles pour l'aide décès (20 -> 25)
  assert.strictEqual((await agent('DELETE', partAwa)).status, 200);
  assert.strictEqual((await agent('DELETE', partAwa)).status, 404);
  assert.strictEqual((await admin('PUT', aideDeces, { type: 'deces', beneficiaire_nom: 'Famille Diop', montant: 25 })).status, 200);
  detail = (await agent('GET', '/reunions/' + r.id)).body;
  assert.strictEqual(detail.restant, 10);
  assert.strictEqual(detail.a_confier, 0);

  // Annuler une cotisation est refusé si les aides dépassent alors l'encaissé (60 − 30 < 50)
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/cotisations/${a.id}`)).status, 409);

  // Tableau de bord : en caisse = encaissé − aides
  const tb = (await admin('GET', '/tableau')).body;
  assert.strictEqual(tb.aides_versees, 50);

  // Suppression d'une aide, annulation de la remise
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/aides/${maladie.body.id}`)).status, 200);
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/aides/${maladie.body.id}`)).status, 404);
  assert.strictEqual((await agent('DELETE', `/reunions/${r.id}/remises/${rB.body.id}`)).status, 200);
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

  // Réunion 2 : 20 € versés, mais les 20 € donnés en trop à la réunion 1 la complètent -> réglée
  const d2 = (await admin('GET', '/reunions/' + r2.id)).body;
  assert.strictEqual(d2.partiels, 0);
  assert.strictEqual(d2.reste, 0);
  assert.strictEqual(d2.encaisse, 20); // la caisse de la réunion 2 n'a reçu que 20 €
  assert.strictEqual(m.historique.find((h) => h.id === r2.id).couvert, 30);

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

test('un versement comble d\'abord le retard de la réunion précédente', async () => {
  const admin = await login('admin@test.fr');
  const agent = await login('agent@test.fr');

  // Membre récent : seules ces deux réunions le concernent
  const k = (await admin('POST', '/membres', { prenom: 'Kadiatou', nom: 'Barry', date_adhesion: '2026-08-01' })).body;
  const prec = (await admin('POST', '/reunions', { date: '2026-08-15' })).body;
  const jour = (await admin('POST', '/reunions', { date: '2026-10-15' })).body;

  // Réunion précédente : 15 € sur 30 -> 15 € de retard
  await agent('POST', `/reunions/${prec.id}/cotisations`, { membre_id: k.id, montant: 15 });
  let detail = (await agent('GET', '/reunions/' + jour.id)).body;
  let ligne = detail.membres.find((m) => m.id === k.id);
  assert.strictEqual(ligne.du_cumule, 45); // 15 € de retard + 30 € du jour : montant proposé à l'encaissement
  assert.strictEqual(ligne.couvert, 0);

  // Réunion du jour : il verse 45 € -> 15 € complètent la précédente, 30 € paient celle du jour
  await agent('POST', `/reunions/${jour.id}/cotisations`, { membre_id: k.id, montant: 45 });

  const precDetail = (await agent('GET', '/reunions/' + prec.id)).body;
  const lignePrec = precDetail.membres.find((m) => m.id === k.id);
  assert.strictEqual(lignePrec.montant_paye, 15); // versé ce jour-là
  assert.strictEqual(lignePrec.couvert, 30); // mais réglée grâce au versement suivant

  detail = (await agent('GET', '/reunions/' + jour.id)).body;
  ligne = detail.membres.find((m) => m.id === k.id);
  assert.strictEqual(ligne.montant_paye, 45);
  assert.strictEqual(ligne.couvert, 30);
  assert.strictEqual(ligne.du_cumule, 0);
  assert.strictEqual(detail.encaisse, 45); // les 45 € sont bien dans la caisse du jour

  const fiche = (await admin('GET', '/membres/' + k.id)).body;
  assert.strictEqual(fiche.montant_du, 0);
  assert.strictEqual(fiche.reunions_dues, 0);
  assert.ok(fiche.historique.every((h) => h.couvert === h.montant));
});

test("super-admin : création d'association avec son président, désactivation", async () => {
  const sup = await login('super@test.fr');
  const admin = await login('admin@test.fr');

  // Le super-admin n'accède pas aux données d'une association, et un président n'accède pas au super-admin
  assert.strictEqual((await sup('GET', '/membres')).status, 403);
  assert.strictEqual((await admin('GET', '/superadmin/associations')).status, 403);

  const creee = await sup('POST', '/superadmin/associations', {
    nom: 'Association B', montant_cotisation: 20, intervalle_mois: 1,
    admin: { nom: 'Président B', email: 'President.B@test.fr', motDePasse: 'secret123' },
  });
  assert.strictEqual(creee.status, 201);
  assert.strictEqual(creee.body.montant_cotisation, 20);
  // Email déjà pris, mot de passe trop court, fréquence invalide
  assert.strictEqual((await sup('POST', '/superadmin/associations', { nom: 'X', admin: { nom: 'X', email: 'admin@test.fr', motDePasse: 'secret123' } })).status, 409);
  assert.strictEqual((await sup('POST', '/superadmin/associations', { nom: 'X', admin: { nom: 'X', email: 'x@test.fr', motDePasse: 'court' } })).status, 400);
  assert.strictEqual((await sup('POST', '/superadmin/associations', { nom: 'X', intervalle_mois: 13, admin: { nom: 'X', email: 'x@test.fr', motDePasse: 'secret123' } })).status, 400);

  const liste = (await sup('GET', '/superadmin/associations')).body;
  const b = liste.find((a) => a.id === creee.body.id);
  assert.strictEqual(b.administrateurs, 'Président B');
  assert.strictEqual(b.comptes, 1);

  // Le président B se connecte (email insensible à la casse) et voit son association
  const presB = await login('president.b@test.fr');
  const moi = (await presB('GET', '/auth/me')).body;
  assert.strictEqual(moi.role, 'admin');
  assert.strictEqual(moi.association.nom, 'Association B');

  // Désactivée : plus d'accès, ni connexion
  assert.strictEqual((await sup('PUT', `/superadmin/associations/${b.id}`, { actif: false })).body.actif, false);
  assert.strictEqual((await presB('GET', '/membres')).status, 403);
  const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'president.b@test.fr', motDePasse: 'secret123' }) });
  assert.strictEqual(r.status, 403);
  await sup('PUT', `/superadmin/associations/${b.id}`, { actif: true });
});

test("étanchéité : une association ne voit ni ne modifie les données d'une autre", async () => {
  const sup = await login('super@test.fr');
  const adminA = await login('admin@test.fr');
  const c = await sup('POST', '/superadmin/associations', {
    nom: 'Association C', admin: { nom: 'Président C', email: 'president.c@test.fr', motDePasse: 'secret123' },
  });
  assert.strictEqual(c.status, 201);
  const adminC = await login('president.c@test.fr');

  // Données de C
  const mC = (await adminC('POST', '/membres', { prenom: 'Secret', nom: 'DeC', date_adhesion: '2024-01-01' })).body;
  const rC = (await adminC('POST', '/reunions', { date: '2024-06-01' })).body;
  const bC = (await adminC('POST', '/bolondhas', { nom: 'Kowly' })).body; // même nom possible dans une autre association
  assert.ok(bC.id);
  await adminC('POST', `/reunions/${rC.id}/cotisations`, { membre_id: mC.id, montant: 30 });

  // A ne voit rien de C
  assert.ok(!(await adminA('GET', '/membres')).body.some((m) => m.id === mC.id));
  assert.ok(!(await adminA('GET', '/reunions')).body.some((r) => r.id === rC.id));
  assert.ok(!(await adminA('GET', '/bolondhas')).body.some((b) => b.id === bC.id));
  assert.strictEqual((await adminA('GET', '/membres/' + mC.id)).status, 404);
  assert.strictEqual((await adminA('GET', '/reunions/' + rC.id)).status, 404);

  // A ne peut rien modifier chez C
  assert.strictEqual((await adminA('PUT', '/membres/' + mC.id, { prenom: 'X', nom: 'Y' })).status, 404);
  assert.strictEqual((await adminA('DELETE', '/membres/' + mC.id)).status, 404);
  assert.strictEqual((await adminA('DELETE', '/reunions/' + rC.id)).status, 404);
  assert.strictEqual((await adminA('PUT', '/bolondhas/' + bC.id, { nom: 'Pirate' })).status, 404);
  assert.strictEqual((await adminA('DELETE', '/bolondhas/' + bC.id)).status, 404);
  assert.strictEqual((await adminA('POST', `/reunions/${rC.id}/cotisations`, { membre_id: mC.id })).status, 404);
  assert.strictEqual((await adminA('POST', `/reunions/${rC.id}/aides`, { type: 'autre', beneficiaire_nom: 'X', montant: 1 })).status, 404);
  assert.strictEqual((await adminA('POST', `/reunions/${rC.id}/remises`, { membre_id: mC.id })).status, 404);

  // A ne peut pas utiliser un membre ou une bolondha de C dans ses propres données
  const rA = (await adminA('POST', '/reunions', { date: '2024-06-02' })).body;
  assert.strictEqual((await adminA('POST', `/reunions/${rA.id}/cotisations`, { membre_id: mC.id })).status, 404);
  assert.strictEqual((await adminA('POST', '/membres', { prenom: 'A', nom: 'B', bolondha_id: bC.id })).status, 400);

  // Le tableau de bord de C ne compte que ses données
  const tbC = (await adminC('GET', '/tableau')).body;
  assert.strictEqual(tbC.membres, 1);
  assert.strictEqual(tbC.aides_versees, 0);
  await adminA('DELETE', '/reunions/' + rA.id);
});

test("réglages, règlement et comptes de l'association", async () => {
  const admin = await login('admin@test.fr');
  const agent = await login('agent@test.fr');

  // Réglages : seuls les admins modifient ; le montant par défaut des réunions suit la cotisation
  assert.strictEqual((await agent('PUT', '/association', { nom: 'X' })).status, 403);
  const a = await admin('PUT', '/association', { nom: 'Association de test', montant_cotisation: 25, intervalle_mois: 3 });
  assert.strictEqual(a.body.montant_cotisation, 25);
  assert.strictEqual((await admin('PUT', '/association', { nom: 'X', intervalle_mois: 0 })).status, 400);
  const r = (await admin('POST', '/reunions', { date: '2023-01-10' })).body;
  assert.strictEqual(r.montant, 25);
  await admin('DELETE', '/reunions/' + r.id);
  await admin('PUT', '/association', { nom: 'Association de test', montant_cotisation: 30, intervalle_mois: 2 });

  // Règlement
  const reg = await admin('PUT', '/association/reglement', {
    introduction: 'Intro',
    sections: [{ titre: 'Chapitre 1', articles: [{ titre: 'Cotisation', texte: '30 € par réunion' }] }],
  });
  assert.strictEqual(reg.status, 200);
  assert.strictEqual((await agent('GET', '/association')).body.reglement.sections[0].articles[0].texte, '30 € par réunion');
  assert.strictEqual((await admin('PUT', '/association/reglement', { sections: [{ titre: '', articles: [] }] })).status, 400);
  assert.strictEqual((await agent('PUT', '/association/reglement', { sections: [] })).status, 403);

  // Comptes : le président ajoute un gérant ; l'agent n'a pas accès
  assert.strictEqual((await agent('GET', '/utilisateurs')).status, 403);
  const g = await admin('POST', '/utilisateurs', { nom: 'Gérant 2', email: 'gerant2@test.fr', motDePasse: 'secret123', role: 'agent' });
  assert.strictEqual(g.status, 201);
  assert.strictEqual(g.body.mot_de_passe, undefined);
  assert.strictEqual((await admin('POST', '/utilisateurs', { nom: 'X', email: 'gerant2@test.fr', motDePasse: 'secret123' })).status, 409);
  const gerant2 = await login('gerant2@test.fr');
  assert.strictEqual((await gerant2('GET', '/membres')).status, 200);

  // On ne peut pas retirer le dernier administrateur, ni se supprimer soi-même
  const moi = (await admin('GET', '/auth/me')).body;
  assert.strictEqual((await admin('PUT', '/utilisateurs/' + moi.id, { nom: 'Admin', email: 'admin@test.fr', role: 'agent' })).status, 409);
  assert.strictEqual((await admin('DELETE', '/utilisateurs/' + moi.id)).status, 409);
  assert.strictEqual((await admin('DELETE', '/utilisateurs/' + g.body.id)).status, 200);
});

test('coordonnées des comptes : téléphone, adresse, ville', async () => {
  const sup = await login('super@test.fr');
  const admin = await login('admin@test.fr');

  // Président créé avec l'association, avec ses coordonnées
  const d = await sup('POST', '/superadmin/associations', {
    nom: 'Association D',
    admin: { nom: 'Président D', email: 'president.d@test.fr', motDePasse: 'secret123', telephone: '0601020304', adresse: '1 rue de la Paix', ville: 'Lyon' },
  });
  assert.strictEqual(d.status, 201);

  // La liste des associations montre le président, son téléphone, sa ville et les comptes
  const ligne = (await sup('GET', '/superadmin/associations')).body.find((a) => a.id === d.body.id);
  assert.strictEqual(ligne.president, 'Président D');
  assert.strictEqual(ligne.president_telephone, '0601020304');
  assert.strictEqual(ligne.president_ville, 'Lyon');
  assert.strictEqual(ligne.comptes, 1);
  assert.strictEqual(ligne.agents, 0);

  // Compte ajouté par le super-admin, puis modifié sans perdre les coordonnées non envoyées
  const g = await sup('POST', `/superadmin/associations/${d.body.id}/comptes`, { nom: 'Gérant D', email: 'gerant.d@test.fr', motDePasse: 'secret123', role: 'agent', ville: 'Lyon' });
  assert.strictEqual(g.body.ville, 'Lyon');
  const maj = await sup('PUT', `/superadmin/comptes/${g.body.id}`, { telephone: '0700000000' });
  assert.strictEqual(maj.body.telephone, '0700000000');
  assert.strictEqual(maj.body.ville, 'Lyon');
  assert.strictEqual((await sup('GET', '/superadmin/associations')).body.find((a) => a.id === d.body.id).agents, 1);

  // Le président d'une association saisit les coordonnées de ses gérants
  const c = await admin('POST', '/utilisateurs', { nom: 'Gérant 3', email: 'gerant3@test.fr', motDePasse: 'secret123', telephone: '0611111111', adresse: '2 avenue Foch', ville: 'Paris' });
  assert.strictEqual(c.status, 201);
  const liste = (await admin('GET', '/utilisateurs')).body;
  const g3 = liste.find((u) => u.id === c.body.id);
  assert.strictEqual(g3.adresse, '2 avenue Foch');
  assert.strictEqual(g3.ville, 'Paris');
  await admin('DELETE', '/utilisateurs/' + c.body.id);
});
