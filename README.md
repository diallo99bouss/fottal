# FOTTAL — caisse des associations

Application web (SaaS) pour gérer les membres, les réunions et les cotisations de **plusieurs associations**.
Chaque association ne voit que ses propres données.

- **Cotisation** : réglable par association (par défaut 30 € par réunion)
- **Réunions** : fréquence réglable (par défaut tous les 2 mois)

Technologies : **Node.js (Express)**, **PostgreSQL** via l'ORM **Prisma 7**, interface **Next.js + React + Tailwind CSS** (dossier `web/`, basée sur le template [DropX Admin](https://datadropx.net) de DataDropX).

## Rôles

| Rôle | Portée | Ce qu'il fait |
|---|---|---|
| **Super-admin** | toute l'application | crée les associations et le compte de leur président, réinitialise un mot de passe, active / désactive une association |
| **Administrateur** (président) | son association | membres, réunions, bolondhas, règlement, réglages (cotisation, fréquence), comptes des agents |
| **Agent** (gérant) | son association | consulte tout, encaisse les cotisations, enregistre les aides et la remise du restant |

## Fonctionnalités

- Tableau de bord : membres, total en caisse, restant dû, prochaine réunion, membres en retard.
- Membres : recherche, bolondha, ville, situation (à jour / pas à jour), fiche avec l'historique.
- Réunions : date conseillée selon la fréquence de l'association ; encaissement à montant libre (un versement règle d'abord les retards les plus anciens).
- Bilan de réunion : aides (maladie, décès…), restant confié à une ou plusieurs personnes.
- Lois et règles : rédigées par le président de chaque association.

## Installation

Prérequis : [Node.js 22.18+](https://nodejs.org) (24 recommandé) et PostgreSQL (ou Docker).

```bash
# 1. Récupérer le projet
git clone https://github.com/<votre-compte>/fottal.git
cd fottal
npm install
npm run web:install

# 2. Lancer PostgreSQL (si vous utilisez Docker)
docker compose up -d

# 3. Configurer
cp .env.example .env
# puis modifiez JWT_SECRET (et DATABASE_URL si besoin)

# 4. Créer les tables (applique les migrations Prisma)
npm run db:init

# 5. Créer le compte super-admin (puis les associations se créent depuis l'application)
npm run user:create -- vous@exemple.fr MotDePasseSolide superadmin "Prénom Nom"

# 6. Construire l'interface puis démarrer
npm run web:build
npm start
```

Ouvrez ensuite http://localhost:3000 et connectez-vous.

### En développement

Deux terminaux :

```bash
npm run dev       # API Express sur http://localhost:3000
npm run web:dev   # Interface Next.js sur http://localhost:3001 (relaie /api vers :3000)
```

Ouvrez http://localhost:3001 : les modifications de l'interface s'affichent à chaud.

## Structure du projet

```
prisma/schema.prisma     Modèles Prisma (Utilisateur, Membre, Reunion, Cotisation)
prisma/migrations/       Migrations SQL (Prisma Migrate)
prisma.config.ts         Configuration Prisma (lit DATABASE_URL dans .env)
src/server.js            Point d'entrée
src/app.js               Configuration Express
src/db.js                Client Prisma (adaptateur PostgreSQL)
src/serialize.js         Format JSON : dates en AAAA-MM-JJ, montants en nombres
src/generated/prisma/    Client Prisma généré (npm install / npx prisma generate, non versionné)
src/middleware/auth.js   Connexion (JWT en cookie) et contrôle des rôles
src/routes/              API : auth, membres, réunions + cotisations, tableau de bord
web/                     Interface Next.js (pages dans web/app, composants dans web/components)
web/out/                 Interface construite (npm run web:build), servie par Express
scripts/                 Création des tables et des comptes
test/api.test.js         Tests de l'API
```

## API

Toutes les routes (sauf `/api/auth/login`) demandent d'être connecté.

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/login` | tous |
| POST | `/api/auth/logout` | tous |
| GET | `/api/auth/me` | tous |
| GET | `/api/tableau` | tous |
| GET | `/api/membres?q=` | tous |
| GET | `/api/membres/:id` | tous |
| POST / PUT / DELETE | `/api/membres[/:id]` | admin |
| GET | `/api/reunions` | tous |
| GET | `/api/reunions/prochaine-date` | tous |
| GET | `/api/reunions/:id` | tous |
| POST / PUT / DELETE | `/api/reunions[/:id]` | admin |
| POST | `/api/reunions/:id/cotisations` `{ membre_id }` | admin, agent |
| DELETE | `/api/reunions/:id/cotisations/:membreId` | admin, agent |

## Base de données (Prisma)

| Commande | Effet |
|---|---|
| `npm run db:init` | applique les migrations sur la base (`prisma migrate deploy`) |
| `npm run db:migrate -- --name ma-modif` | après une modification de `prisma/schema.prisma` : crée et applique une migration |
| `npx prisma generate` | régénère le client (fait automatiquement par `npm install`) |
| `npm run db:studio` | ouvre Prisma Studio pour voir et modifier les données |

Les calculs d'agrégats (montant dû, membres attendus) restent en SQL via `prisma.$queryRaw`, les opérations simples passent par le client Prisma.

## Tests

Les tests effacent la base indiquée : utilisez une base dédiée. Pour la créer une fois avec Docker :

```bash
docker compose exec db psql -U association -d association -c "CREATE DATABASE association_test"
```

Puis :

```bash
DATABASE_URL=postgresql://association:association@localhost:5433/association_test npm test
```

## Mise en ligne

L'application peut être hébergée sur Render, Railway ou un VPS avec une base PostgreSQL. Définissez les variables `DATABASE_URL`, `DATABASE_SSL=true` si l'hébergeur l'exige, `JWT_SECRET` et `NODE_ENV=production`, puis lancez `npm run db:init` une fois.
