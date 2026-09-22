-- AlterTable
ALTER TABLE "Intento" ADD COLUMN     "corregidaEn" TIMESTAMP(3),
ADD COLUMN     "corregidaPorId" TEXT;

-- CreateTable
CREATE TABLE "EscritoDeIntento" (
    "id" TEXT NOT NULL,
    "intentoId" TEXT NOT NULL,
    "tarea" INTEGER NOT NULL,
    "opcion" INTEGER,
    "texto" TEXT NOT NULL,
    "palabras" INTEGER NOT NULL DEFAULT 0,
    "guardadoEn" TIMESTAMP(3) NOT NULL,
    "bandas" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "comentario" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "EscritoDeIntento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EscritoDeIntento_intentoId_idx" ON "EscritoDeIntento"("intentoId");

-- CreateIndex
CREATE UNIQUE INDEX "EscritoDeIntento_intentoId_tarea_key" ON "EscritoDeIntento"("intentoId", "tarea");

-- AddForeignKey
ALTER TABLE "Intento" ADD CONSTRAINT "Intento_corregidaPorId_fkey" FOREIGN KEY ("corregidaPorId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscritoDeIntento" ADD CONSTRAINT "EscritoDeIntento_intentoId_fkey" FOREIGN KEY ("intentoId") REFERENCES "Intento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
