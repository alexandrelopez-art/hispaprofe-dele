-- AlterTable
ALTER TABLE "Intento" ADD COLUMN     "salidas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "segundosFuera" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimaSalidaDeTarea" INTEGER,
ADD COLUMN     "ultimaSalidaEn" TIMESTAMP(3),
ADD COLUMN     "volvioEn" TIMESTAMP(3);
