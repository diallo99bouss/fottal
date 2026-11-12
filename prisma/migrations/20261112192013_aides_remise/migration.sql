-- AlterTable
ALTER TABLE "reunions" ADD COLUMN     "depositaire_id" INTEGER,
ADD COLUMN     "depositaire_nom" TEXT,
ADD COLUMN     "montant_remis" DECIMAL(10,2),
ADD COLUMN     "remis_le" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "aides" (
    "id" SERIAL NOT NULL,
    "reunion_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "membre_id" INTEGER,
    "beneficiaire_nom" TEXT NOT NULL,
    "motif" TEXT,
    "montant" DECIMAL(10,2) NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enregistre_par" INTEGER,

    CONSTRAINT "aides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_aides_reunion" ON "aides"("reunion_id");

-- CreateIndex
CREATE INDEX "idx_aides_membre" ON "aides"("membre_id");

-- AddForeignKey
ALTER TABLE "reunions" ADD CONSTRAINT "reunions_depositaire_id_fkey" FOREIGN KEY ("depositaire_id") REFERENCES "membres"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "aides" ADD CONSTRAINT "aides_reunion_id_fkey" FOREIGN KEY ("reunion_id") REFERENCES "reunions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "aides" ADD CONSTRAINT "aides_membre_id_fkey" FOREIGN KEY ("membre_id") REFERENCES "membres"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "aides" ADD CONSTRAINT "aides_enregistre_par_fkey" FOREIGN KEY ("enregistre_par") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Contraintes CHECK (non gérées par le schéma Prisma)
ALTER TABLE "aides" ADD CONSTRAINT "aides_type_check" CHECK ("type" IN ('maladie', 'deces', 'autre'));
ALTER TABLE "aides" ADD CONSTRAINT "aides_montant_check" CHECK ("montant" > 0);
ALTER TABLE "reunions" ADD CONSTRAINT "reunions_montant_remis_check" CHECK ("montant_remis" IS NULL OR "montant_remis" >= 0);
