-- CreateEnum
CREATE TYPE "ModoDeExamen" AS ENUM ('COMPLETO', 'LIBRE');

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "modo" "ModoDeExamen" NOT NULL DEFAULT 'COMPLETO',
    "fechaTope" TIMESTAMP(3) NOT NULL,
    "asignadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asignadaPorId" TEXT,

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asignacion_personaId_idx" ON "Asignacion"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Asignacion_examenId_personaId_key" ON "Asignacion"("examenId", "personaId");

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_asignadaPorId_fkey" FOREIGN KEY ("asignadaPorId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
