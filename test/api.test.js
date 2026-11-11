// Tests de bout en bout de l'API (nécessite une base PostgreSQL de test dans DATABASE_URL)
// Lancer : npm test
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool } = require('../src/db');

let server, base;

before(async () => {
  await pool.query('DROP TABLE IF EXISTS cotisations, reunions, membres, utilisateurs CASCADE');
  await pool.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  const h = await bcrypt.hash('secret123', 4);
  await pool.query(`INSERT INTO utilisateurs (email, nom, mot_de_passe, role) VALUES
    ('admin@test.fr','Admin',$1,'admin'), ('agent@test.fr','Agent',$1,'agent')`, [h]);
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
after(async () => { server.close(); await pool.end(); });

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
  const m2 = await admin('POST', '/membres', { prenom: 'Moussa', nom: 'Bah', date_adhesion: '2026-01-01' });

  // L'agent ne peut pas gérer les membres ni les réunions
  assert.strictEqual((await agent('POST', '/membres', { prenom: 'X', nom: 'Y' })).status, 403);
  assert.strictEqual((await agent('DELETE', '/membres/' + m1.body.id)).status, 403);

  const r1 = await admin('POST', '/reunions', { date: '2026-03-14', lieu: 'Salle' });
  assert.strictEqual(r1.status, 201);
  assert.strictEqual(r1.body.montant, 30);
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
