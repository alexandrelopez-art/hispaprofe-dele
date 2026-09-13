import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { TOPE_DE_TROZOS, leerSoluciones, textoDeTrozos, trozosSchema, type Soluciones } from "./soluciones";

export async function guardarCuadernillo(datos: { titulo: string; trozos: unknown }): Promise<{ id: string } | { error: string }> {
  const titulo = datos.titulo.trim();
  if (!titulo) return { error: "El cuadernillo necesita un título." };
  const trozos = trozosSchema.safeParse(datos.trozos);
  if (!trozos.success) return { error: `No se ha podido leer el PDF (como mucho ${TOPE_DE_TROZOS} trozos de texto).` };
  const texto = textoDeTrozos(trozos.data);
  if (!texto) return { error: "Ese PDF no tiene texto: parece un escaneo." };
  const soluciones = leerSoluciones(trozos.data);
  if (Object.keys(soluciones).length === 0) return { error: "No encuentro la tabla de SOLUCIONES en ese PDF." };
  const cuadernillo = await prisma.cuadernillo.create({
    data: { titulo, texto, soluciones: soluciones as Prisma.InputJsonValue },
  });
  return { id: cuadernillo.id };
}

export async function listarCuadernillos(): Promise<{ id: string; titulo: string; examenes: string[] }[]> {
  const cuadernillos = await prisma.cuadernillo.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, titulo: true, soluciones: true },
  });
  return cuadernillos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    examenes: Object.keys(c.soluciones as Soluciones).sort((a, b) => Number(a) - Number(b)),
  }));
}

/** `cuadernilloId` null quita el cuadernillo y el número. `numero` null deja el cuadernillo elegido sin número todavía. */
export async function elegirCuadernillo(
  examenId: string,
  cuadernilloId: string | null,
  numero: number | null,
): Promise<{ error?: string }> {
  const examen = await prisma.examen.findUnique({ where: { id: examenId } });
  if (!examen) return { error: "Ese examen no existe." };
  if (cuadernilloId === null) {
    await prisma.examen.update({ where: { id: examenId }, data: { cuadernilloId: null, numeroEnCuadernillo: null } });
    return {};
  }
  const cuadernillo = await prisma.cuadernillo.findUnique({ where: { id: cuadernilloId } });
  if (!cuadernillo) return { error: "Ese cuadernillo no existe." };
  if (numero !== null && !(String(numero) in (cuadernillo.soluciones as Soluciones))) {
    return { error: `El cuadernillo no trae el examen ${numero}.` };
  }
  await prisma.examen.update({ where: { id: examenId }, data: { cuadernilloId, numeroEnCuadernillo: numero } });
  return {};
}
