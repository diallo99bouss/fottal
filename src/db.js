// Connexion à PostgreSQL via Prisma ORM (client généré dans src/generated/prisma par `npx prisma generate`)
// Le client est généré en TypeScript (.mts) : Node 22.18+ le charge directement (suppression des types).
const { PrismaClient, Prisma } = require('./generated/prisma/client.mts');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const prisma = new PrismaClient({ adapter });

module.exports = { prisma, Prisma };
