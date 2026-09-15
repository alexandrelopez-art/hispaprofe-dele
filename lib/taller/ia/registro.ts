import type { Prueba } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { costeEnMilesimas, type Uso } from "./coste";

export async function apuntarLlamada(datos: {
  examenId: string;
  prueba: Prueba;
  numero: number;
  modelo: string;
  uso: Uso;
  milisegundos: number;
  error: string | null;
}): Promise<void> {
  await prisma.llamadaDeIA.create({
    data: {
      examenId: datos.examenId,
      prueba: datos.prueba,
      numero: datos.numero,
      modelo: datos.modelo,
      tokensEntrada: datos.uso.entrada,
      tokensCacheLeidos: datos.uso.cacheLeidos,
      tokensCacheEscritos: datos.uso.cacheEscritos,
      tokensSalida: datos.uso.salida,
      costeMilesimasDeDolar: costeEnMilesimas(datos.uso),
      milisegundos: Math.round(datos.milisegundos),
      resultado: datos.error === null ? "OK" : "ERROR",
      error: datos.error,
    },
  });
}

export async function gastoDelExamen(examenId: string): Promise<{ llamadas: number; milesimas: number }> {
  const r = await prisma.llamadaDeIA.aggregate({
    where: { examenId },
    _count: { _all: true },
    _sum: { costeMilesimasDeDolar: true },
  });
  return { llamadas: r._count._all, milesimas: r._sum.costeMilesimasDeDolar ?? 0 };
}
