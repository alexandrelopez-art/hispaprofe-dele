-- CreateEnum
CREATE TYPE "ResultadoDeLlamada" AS ENUM ('OK', 'ERROR');

-- CreateTable
CREATE TABLE "LlamadaDeIA" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "prueba" "Prueba" NOT NULL,
    "numero" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL,
    "tokensCacheLeidos" INTEGER NOT NULL,
    "tokensCacheEscritos" INTEGER NOT NULL,
    "tokensSalida" INTEGER NOT NULL,
    "costeMilesimasDeDolar" INTEGER NOT NULL,
    "milisegundos" INTEGER NOT NULL,
    "resultado" "ResultadoDeLlamada" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlamadaDeIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlamadaDeIA_examenId_idx" ON "LlamadaDeIA"("examenId");

-- AddForeignKey
ALTER TABLE "LlamadaDeIA" ADD CONSTRAINT "LlamadaDeIA_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
