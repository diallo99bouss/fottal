-- Passage en SaaS : plusieurs associations dans la même base.
-- Les données existantes (s'il y en a) sont rattachées à une première association « Fottal ».

-- CreateTable
CREATE TABLE "associations" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "montant_cotisation" DECIMAL(10,2) NOT NULL DEFAULT 30,
    "intervalle_mois" INTEGER NOT NULL DEFAULT 2,
    "reglement" JSONB,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "associations" ADD CONSTRAINT "associations_montant_check" CHECK ("montant_cotisation" >= 0);
ALTER TABLE "associations" ADD CONSTRAINT "associations_intervalle_check" CHECK ("intervalle_mois" BETWEEN 1 AND 12);

-- Colonnes association_id (remplies juste après, puis rendues obligatoires)
ALTER TABLE "utilisateurs" ADD COLUMN "association_id" INTEGER;
ALTER TABLE "membres" ADD COLUMN "association_id" INTEGER;
ALTER TABLE "reunions" ADD COLUMN "association_id" INTEGER;
ALTER TABLE "bolondhas" ADD COLUMN "association_id" INTEGER;

-- Reprise des données existantes dans l'association « Fottal » (avec son règlement)
INSERT INTO "associations" ("nom", "reglement")
SELECT 'Fottal', $reglement${
  "misAJourLe": "2026-11-13",
  "introduction": "Ce règlement fixe le fonctionnement de la caisse de l'association Fottal : l'adhésion des membres, les cotisations, les réunions, les aides en cas de maladie ou de décès et la garde de l'argent. Il s'applique à tous les membres.",
  "sections": [
    {
      "titre": "Chapitre 1 — Les membres",
      "articles": [
        {
          "titre": "Adhésion",
          "texte": "Chaque membre est inscrit avec son nom, son prénom et sa date d'adhésion. Son téléphone, son email et sa ville peuvent être ajoutés."
        },
        {
          "titre": "Bolondha",
          "texte": "Chaque membre peut être rattaché à une bolondha (par exemple Kourasadio, Kowly ou Ngioguiyabhe). La liste des bolondhas est tenue par l'administrateur."
        },
        {
          "titre": "Membre actif ou inactif",
          "texte": "Seuls les membres actifs doivent des cotisations. Un membre déclaré inactif ne doit plus rien à partir de ce moment."
        }
      ]
    },
    {
      "titre": "Chapitre 2 — Les cotisations",
      "articles": [
        {
          "titre": "Montant",
          "texte": "La cotisation est de 15 € par mois. Les réunions ayant lieu tous les deux mois, chaque membre doit 30 € par réunion."
        },
        {
          "titre": "Début des cotisations",
          "texte": "Un membre doit la cotisation de chaque réunion qui a lieu à partir de sa date d'adhésion."
        },
        {
          "titre": "Versements",
          "texte": "Un membre peut verser plus ou moins que la cotisation selon ses moyens (par exemple 15 €, 30 € ou 50 €). Le versement peut se faire en espèces, par virement ou par un autre moyen."
        },
        {
          "titre": "Retards",
          "texte": "Un versement sert d'abord à rattraper les retards les plus anciens, puis à payer la réunion du jour.\nExemple : un membre qui doit encore 15 € sur la réunion précédente et qui verse 45 € règle les 15 € de retard et les 30 € de la réunion du jour."
        },
        {
          "titre": "Avance",
          "texte": "Ce qui est versé en plus de ce qui est dû est gardé comme avance sur les réunions suivantes."
        },
        {
          "titre": "Membre à jour",
          "texte": "Un membre est à jour lorsque le total de ses versements couvre toutes les cotisations dues depuis son adhésion. Sinon, la différence constitue son reste dû."
        }
      ]
    },
    {
      "titre": "Chapitre 3 — Les réunions",
      "articles": [
        {
          "titre": "Fréquence",
          "texte": "L'association se réunit tous les deux mois. La date de la réunion suivante est fixée environ deux mois après la précédente."
        },
        {
          "titre": "Encaissement",
          "texte": "Les cotisations sont encaissées pendant la réunion. Chaque versement est enregistré au nom du membre qui paie."
        }
      ]
    },
    {
      "titre": "Chapitre 4 — Les aides",
      "articles": [
        {
          "titre": "Cas pris en charge",
          "texte": "L'association peut verser une aide en cas de maladie ou de décès, ou dans un autre cas décidé en réunion."
        },
        {
          "titre": "Bénéficiaire",
          "texte": "L'aide peut être versée à un membre de l'association ou à une personne extérieure."
        },
        {
          "titre": "Montant",
          "texte": "Le montant de chaque aide est décidé lors de la réunion. Il est pris sur les cotisations encaissées à cette réunion et ne peut pas dépasser l'argent disponible."
        }
      ]
    },
    {
      "titre": "Chapitre 5 — La garde de l'argent",
      "articles": [
        {
          "titre": "Restant",
          "texte": "À la fin de chaque réunion, on calcule le restant : cotisations encaissées moins aides versées."
        },
        {
          "titre": "Remise du restant",
          "texte": "Le restant est confié à un ou plusieurs membres, qui repartent avec l'argent. Le nom de chaque personne, le montant qui lui est confié et la date sont enregistrés."
        }
      ]
    },
    {
      "titre": "Chapitre 6 — La gestion de la caisse",
      "articles": [
        {
          "titre": "Administrateur",
          "texte": "L'administrateur gère les membres, les réunions et les bolondhas : il peut les ajouter, les modifier et les supprimer."
        },
        {
          "titre": "Agent",
          "texte": "L'agent consulte toutes les informations. Il encaisse les cotisations, enregistre les aides et la remise du restant."
        }
      ]
    }
  ]
}$reglement$::jsonb
 WHERE EXISTS (SELECT 1 FROM "utilisateurs") OR EXISTS (SELECT 1 FROM "membres")
    OR EXISTS (SELECT 1 FROM "reunions") OR EXISTS (SELECT 1 FROM "bolondhas");

UPDATE "utilisateurs" SET "association_id" = (SELECT min("id") FROM "associations");
UPDATE "membres" SET "association_id" = (SELECT min("id") FROM "associations");
UPDATE "reunions" SET "association_id" = (SELECT min("id") FROM "associations");
UPDATE "bolondhas" SET "association_id" = (SELECT min("id") FROM "associations");

ALTER TABLE "membres" ALTER COLUMN "association_id" SET NOT NULL;
ALTER TABLE "reunions" ALTER COLUMN "association_id" SET NOT NULL;
ALTER TABLE "bolondhas" ALTER COLUMN "association_id" SET NOT NULL;

-- Rôles : superadmin (toute l'application, sans association), admin (président), agent (gérant)
ALTER TABLE "utilisateurs" DROP CONSTRAINT IF EXISTS "utilisateurs_role_check";
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_role_check" CHECK ("role" IN ('superadmin', 'admin', 'agent'));
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_association_check"
  CHECK (("role" = 'superadmin') = ("association_id" IS NULL));

-- Bolondhas : nom unique par association (et non plus dans toute la base)
DROP INDEX "bolondhas_nom_key";
CREATE UNIQUE INDEX "bolondhas_association_id_nom_key" ON "bolondhas"("association_id", "nom");

-- CreateIndex
CREATE INDEX "idx_membres_association" ON "membres"("association_id");
CREATE INDEX "idx_reunions_association_date" ON "reunions"("association_id", "date");
CREATE INDEX "idx_utilisateurs_association" ON "utilisateurs"("association_id");

-- AddForeignKey
ALTER TABLE "utilisateurs" ADD CONSTRAINT "utilisateurs_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "membres" ADD CONSTRAINT "membres_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "reunions" ADD CONSTRAINT "reunions_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "bolondhas" ADD CONSTRAINT "bolondhas_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "associations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
