-- Le restant d'une réunion peut être confié à plusieurs personnes :
-- les colonnes de remise unique de "reunions" deviennent une table "remises".

-- CreateTable
CREATE TABLE "remises" (
    "id" SERIAL NOT NULL,
    "reunion_id" INTEGER NOT NULL,
    "membre_id" INTEGER,
    "depositaire_nom" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "remis_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_remises_membre" ON "remises"("membre_id");

-- CreateIndex
CREATE UNIQUE INDEX "remises_reunion_id_membre_id_key" ON "remises"("reunion_id", "membre_id");

-- AddForeignKey
ALTER TABLE "remises" ADD CONSTRAINT "remises_reunion_id_fkey" FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "remises" ADD CONSTRAINT "remises_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Contrainte CHECK (non gérée par le schéma Prisma)
ALTER TABLE "remises" ADD CONSTRAINT "remises_montant_check" CHECK ("montant" > 0);

-- Reprise des remises existantes (une par réunion) avant suppression des anciennes colonnes
INSERT INTO "remises" ("reunion_id", "membre_id", "depositaire_nom", "montant", "remis_le")
SELECT "id", "depositaire_id", "depositaire_nom", "montant_remis", COALESCE("remis_le", CURRENT_TIMESTAMP)
  FROM "reunions"
 WHERE "depositaire_nom" IS NOT NULL AND "montant_remis" > 0;

-- DropForeignKey
ALTER TABLE "reunions" DROP CONSTRAINT "reunions_depositaire_id_fkey";

-- AlterTable
ALTER TABLE "reunions" DROP CONSTRAINT IF EXISTS "reunions_montant_remis_check";
ALTER TABLE "reunions" DROP COLUMN "depositaire_id",
DROP COLUMN "depositaire_nom",
DROP COLUMN "montant_remis",
DROP COLUMN "remis_le";
