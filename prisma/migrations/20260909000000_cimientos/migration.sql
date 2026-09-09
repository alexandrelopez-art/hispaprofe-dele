-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('A1', 'A2', 'B1', 'B2');

-- CreateEnum
CREATE TYPE "Prueba" AS ENUM ('CE', 'CO', 'EE', 'EO');

-- CreateEnum
CREATE TYPE "EstadoExamen" AS ENUM ('EN_CONSTRUCCION', 'PUBLICADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "TipoPieza" AS ENUM ('TEXTO', 'IMAGEN', 'AUDIO', 'VIDEO', 'ACTIVIDAD');

-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('OPCION', 'HUECOS', 'ORDENAR', 'RELACIONAR', 'REDACCION', 'GRABACION');

-- CreateTable
CREATE TABLE "Examen" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "estado" "EstadoExamen" NOT NULL DEFAULT 'EN_CONSTRUCCION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "prueba" "Prueba" NOT NULL,
    "numero" INTEGER NOT NULL,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pieza" (
    "id" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoPieza" NOT NULL,
    "texto" TEXT,
    "ficheroId" TEXT,
    "etiqueta" TEXT,

    CONSTRAINT "Pieza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" TEXT NOT NULL,
    "piezaId" TEXT NOT NULL,
    "tipo" "TipoActividad" NOT NULL,
    "datos" JSONB NOT NULL,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clave" (
    "id" TEXT NOT NULL,
    "actividadId" TEXT NOT NULL,
    "respuestas" JSONB NOT NULL,

    CONSTRAINT "Clave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Examen_estado_idx" ON "Examen"("estado");

-- CreateIndex
CREATE INDEX "Tarea_examenId_idx" ON "Tarea"("examenId");

-- CreateIndex
CREATE UNIQUE INDEX "Tarea_examenId_prueba_numero_key" ON "Tarea"("examenId", "prueba", "numero");

-- CreateIndex
CREATE INDEX "Pieza_tareaId_idx" ON "Pieza"("tareaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pieza_tareaId_orden_key" ON "Pieza"("tareaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Actividad_piezaId_key" ON "Actividad"("piezaId");

-- CreateIndex
CREATE UNIQUE INDEX "Clave_actividadId_key" ON "Clave"("actividadId");

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pieza" ADD CONSTRAINT "Pieza_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_piezaId_fkey" FOREIGN KEY ("piezaId") REFERENCES "Pieza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clave" ADD CONSTRAINT "Clave_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

