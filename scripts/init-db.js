// Crée les tables à partir de db/schema.sql
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Tables créées (ou déjà présentes).');
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
