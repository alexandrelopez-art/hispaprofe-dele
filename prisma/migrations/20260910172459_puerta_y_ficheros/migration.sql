-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('PROFESOR', 'ESTUDIANTE');

-- CreateEnum
CREATE TYPE "Almacen" AS ENUM ('VERCEL', 'DRIVE');

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'ESTUDIANTE',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnlaceDeEntrada" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "secretoHuella" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnlaceDeEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "cookieHuella" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "ultimaVezEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fichero" (
    "id" TEXT NOT NULL,
    "almacen" "Almacen" NOT NULL,
    "ruta" TEXT NOT NULL,
    "nombreOriginal" TEXT,
    "tipoMime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "subidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fichero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Persona_correo_key" ON "Persona"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "EnlaceDeEntrada_secretoHuella_key" ON "EnlaceDeEntrada"("secretoHuella");

-- CreateIndex
CREATE INDEX "EnlaceDeEntrada_personaId_createdAt_idx" ON "EnlaceDeEntrada"("personaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_cookieHuella_key" ON "Sesion"("cookieHuella");

-- CreateIndex
CREATE INDEX "Sesion_personaId_idx" ON "Sesion"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Fichero_almacen_ruta_key" ON "Fichero"("almacen", "ruta");

-- AddForeignKey
ALTER TABLE "Pieza" ADD CONSTRAINT "Pieza_ficheroId_fkey" FOREIGN KEY ("ficheroId") REFERENCES "Fichero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnlaceDeEntrada" ADD CONSTRAINT "EnlaceDeEntrada_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fichero" ADD CONSTRAINT "Fichero_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;
