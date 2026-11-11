# Caisse de l'Association

Application web pour gérer les membres, les réunions et les cotisations d'une association.

- **Cotisation** : 15 € par mois
- **Réunion** : tous les 2 mois, donc **30 € par réunion**

Technologies : **Node.js (Express)**, **PostgreSQL**, interface en **JavaScript** sans framework.

## Rôles

| Action | Administrateur | Agent |
|---|:---:|:---:|
| Voir le tableau de bord, les membres, les réunions | ✅ | ✅ |
| Ajouter / modifier / supprimer un membre | ✅ | ❌ |
| Ajouter / modifier / supprimer une réunion | ✅ | ❌ |
| Encaisser ou annuler une cotisation | ✅ | ✅ |

## Fonctionnalités

- Tableau de bord : nombre de membres, total en caisse, montant restant dû, prochaine réunion, membres en retard.
- Membres : recherche, fiche avec l'historique des réunions et le montant dû.
- Réunions : la date proposée tombe 2 mois après la précédente ; pour chaque réunion, liste des membres avec un bouton « Encaisser ».
- Calcul automatique des retards : un membre doit 30 € pour chaque réunion passée depuis son adhésion qu'il n'a pas payée.

## Installation

Prérequis : [Node.js 18+](https://nodejs.org) et PostgreSQL (ou Docker).

```bash
# 1. Récupérer le projet
git clone https://github.com/<votre-compte>/association-cotisations.git
cd association-cotisations
npm install

# 2. Lancer PostgreSQL (si vous utilisez Docker)
docker compose up -d

# 3. Configurer
cp .env.example .env
# puis modifiez JWT_SECRET (et DATABASE_URL si besoin)

# 4. Créer les tables
npm run db:init

# 5. Créer les comptes de connexion
npm run user:create -- admin@monasso.fr MotDePasseSolide admin "Prénom Nom"
npm run user:create -- agent@monasso.fr AutreMotDePasse agent "Prénom Nom"

# 6. Démarrer
npm start
```

Ouvrez ensuite http://localhost:3000 et connectez-vous.

## Structure du projet

```
db/schema.sql            Tables PostgreSQL
src/server.js            Point d'entrée
src/app.js               Configuration Express
src/db.js                Connexion à PostgreSQL
src/middleware/auth.js   Connexion (JWT en cookie) et contrôle des rôles
src/routes/              API : auth, membres, réunions + cotisations, tableau de bord
public/                  Interface web (HTML, CSS, JavaScript)
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

## Tests

Les tests effacent la base indiquée : utilisez une base dédiée.

```bash
DATABASE_URL=postgresql://association:association@localhost:5433/association_test npm test
```

## Mise en ligne

L'application peut être hébergée sur Render, Railway ou un VPS avec une base PostgreSQL. Définissez les variables `DATABASE_URL`, `DATABASE_SSL=true` si l'hébergeur l'exige, `JWT_SECRET` et `NODE_ENV=production`, puis lancez `npm run db:init` une fois.
