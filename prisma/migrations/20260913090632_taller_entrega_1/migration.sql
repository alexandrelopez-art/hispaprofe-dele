-- AlterEnum
ALTER TYPE "Nivel" ADD VALUE 'A2_B1_ESCOLAR';

-- AlterEnum
ALTER TYPE "TipoActividad" ADD VALUE 'CONVERSACION';

-- AlterTable
ALTER TABLE "Examen" ADD COLUMN     "cuadernilloId" TEXT,
ADD COLUMN     "numeroEnCuadernillo" INTEGER;

-- CreateTable
CREATE TABLE "Cuadernillo" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "soluciones" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cuadernillo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaginaDeExamen" (
    "id" TEXT NOT NULL,
    "examenId" TEXT NOT NULL,
    "ficheroId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PaginaDeExamen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaginaDeExamen_examenId_idx" ON "PaginaDeExamen"("examenId");

-- CreateIndex
CREATE UNIQUE INDEX "PaginaDeExamen_examenId_orden_key" ON "PaginaDeExamen"("examenId", "orden");

-- AddForeignKey
ALTER TABLE "Examen" ADD CONSTRAINT "Examen_cuadernilloId_fkey" FOREIGN KEY ("cuadernilloId") REFERENCES "Cuadernillo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaginaDeExamen" ADD CONSTRAINT "PaginaDeExamen_examenId_fkey" FOREIGN KEY ("examenId") REFERENCES "Examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaginaDeExamen" ADD CONSTRAINT "PaginaDeExamen_ficheroId_fkey" FOREIGN KEY ("ficheroId") REFERENCES "Fichero"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
