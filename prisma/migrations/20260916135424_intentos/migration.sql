-- CreateTable
CREATE TABLE "Intento" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "prueba" "Prueba" NOT NULL,
    "empezadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregadaEn" TIMESTAMP(3),
    "porTiempo" BOOLEAN NOT NULL DEFAULT false,
    "aciertos" INTEGER,
    "total" INTEGER,
    "fallos" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "Intento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespuestaDeIntento" (
    "id" TEXT NOT NULL,
    "intentoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "letra" TEXT NOT NULL,
    "marcadaEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RespuestaDeIntento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrozoOido" (
    "id" TEXT NOT NULL,
    "intentoId" TEXT NOT NULL,
    "tarea" INTEGER NOT NULL,
    "trozo" INTEGER NOT NULL,
    "oidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrozoOido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Intento_asignacionId_idx" ON "Intento"("asignacionId");

-- CreateIndex
CREATE UNIQUE INDEX "Intento_asignacionId_prueba_key" ON "Intento"("asignacionId", "prueba");

-- CreateIndex
CREATE UNIQUE INDEX "RespuestaDeIntento_intentoId_numero_key" ON "RespuestaDeIntento"("intentoId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "TrozoOido_intentoId_tarea_trozo_key" ON "TrozoOido"("intentoId", "tarea", "trozo");

-- AddForeignKey
ALTER TABLE "Intento" ADD CONSTRAINT "Intento_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "Asignacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespuestaDeIntento" ADD CONSTRAINT "RespuestaDeIntento_intentoId_fkey" FOREIGN KEY ("intentoId") REFERENCES "Intento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrozoOido" ADD CONSTRAINT "TrozoOido_intentoId_fkey" FOREIGN KEY ("intentoId") REFERENCES "Intento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
