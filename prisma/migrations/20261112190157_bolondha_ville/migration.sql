-- AlterTable
ALTER TABLE "membres" ADD COLUMN     "bolondha_id" INTEGER,
ADD COLUMN     "ville" TEXT;

-- CreateTable
CREATE TABLE "bolondhas" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bolondhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bolondhas_nom_key" ON "bolondhas"("nom");

-- CreateIndex
CREATE INDEX "idx_membres_bolondha" ON "membres"("bolondha_id");

-- AddForeignKey
ALTER TABLE "membres" ADD CONSTRAINT "membres_bolondha_id_fkey" FOREIGN KEY ("bolondha_id") REFERENCES "bolondhas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
