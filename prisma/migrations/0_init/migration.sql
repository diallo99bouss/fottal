-- Migration initiale (reprise de l'ancien db/schema.sql, avec les contraintes CHECK)

CREATE TABLE utilisateurs (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  nom           TEXT NOT NULL,
  mot_de_passe  TEXT NOT NULL,              -- hash bcrypt
  role          TEXT NOT NULL CHECK (role IN ('admin', 'agent')),
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE membres (
  id              SERIAL PRIMARY KEY,
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  telephone       TEXT,
  email           TEXT,
  date_adhesion   DATE NOT NULL DEFAULT CURRENT_DATE,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  cree_le         TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reunions (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  lieu        TEXT,
  notes       TEXT,
  montant     NUMERIC(10,2) NOT NULL DEFAULT 30 CHECK (montant >= 0),
  cree_le     TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une cotisation = un membre a payé pour une réunion
CREATE TABLE cotisations (
  id            SERIAL PRIMARY KEY,
  reunion_id    INTEGER NOT NULL REFERENCES reunions(id) ON DELETE CASCADE,
  membre_id     INTEGER NOT NULL REFERENCES membres(id)  ON DELETE CASCADE,
  montant       NUMERIC(10,2) NOT NULL CHECK (montant >= 0),
  mode          TEXT NOT NULL DEFAULT 'especes' CHECK (mode IN ('especes', 'virement', 'autre')),
  paye_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  encaisse_par  INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
  UNIQUE (reunion_id, membre_id)
);

CREATE INDEX idx_cotisations_membre ON cotisations(membre_id);
CREATE INDEX idx_reunions_date ON reunions(date);
