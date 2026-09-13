import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { CARPETA_DE_MATERIAL, borrarDeVercel } from "@/lib/ficheros/vercel";
import { etiquetasDeNivel } from "@/lib/dele/estructura";

const MAXIMO_DE_PAGINAS = 200;

function esClaveDuplicada(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Registra de una vez todas las páginas de un examen, en el orden del PDF.
 * Solo acepta imágenes del almacén de material: sin este filtro, un
 * identificador cualquiera (una grabación de un estudiante, por ejemplo)
 * podría acabar enseñándose como página.
 */
export async function registrarPaginas(examenId: string, ficheroIds: string[]): Promise<{ error?: string }> {
  if (ficheroIds.length === 0 || ficheroIds.length > MAXIMO_DE_PAGINAS) return { error: "No hay páginas que registrar." };
  if (new Set(ficheroIds).size !== ficheroIds.length) return { error: "Una página viene repetida." };

  const examen = await prisma.examen.findUnique({ where: { id: examenId }, include: { _count: { select: { paginas: true } } } });
  if (!examen) return { error: "Ese examen no existe." };
  if (examen._count.paginas > 0) return { error: "Este examen ya tiene páginas. Bórralas antes de subir otras." };

  const ficheros = await prisma.fichero.findMany({ where: { id: { in: ficheroIds } } });
  const validos = new Set(
    ficheros
      .filter((f) => f.almacen === "VERCEL" && f.tipoMime.startsWith("image/") && f.ruta.startsWith(`${CARPETA_DE_MATERIAL}/`))
      .map((f) => f.id),
  );
  if (ficheroIds.some((id) => !validos.has(id))) {
    return { error: "Alguna página no es una imagen subida al almacén de material." };
  }

  try {
    await prisma.paginaDeExamen.createMany({
      data: ficheroIds.map((ficheroId, i) => ({ examenId, ficheroId, orden: i + 1 })),
    });
  } catch (error) {
    // Dos subidas a la vez pueden pasar las dos la comprobación de arriba (ninguna ha
    // escrito todavía) y chocar aquí contra @@unique([examenId, orden]): la que pierde
    // la carrera recibe el mismo error que si hubiera llegado tarde.
    if (esClaveDuplicada(error)) return { error: "Este examen ya tiene páginas. Bórralas antes de subir otras." };
    throw error;
  }
  return {};
}

export async function etiquetarPagina(examenId: string, paginaId: string, etiquetas: string[]): Promise<{ error?: string }> {
  const pagina = await prisma.paginaDeExamen.findUnique({ where: { id: paginaId }, include: { examen: true } });
  if (!pagina || pagina.examenId !== examenId) return { error: "Esa página no existe." };
  const validas = etiquetasDeNivel(pagina.examen.nivel);
  if (etiquetas.some((e) => !validas.includes(e))) return { error: "Esa tarea no existe en este examen." };
  await prisma.paginaDeExamen.update({
    where: { id: paginaId },
    data: { etiquetas: validas.filter((v) => etiquetas.includes(v)) },
  });
  return {};
}

/**
 * Borra las páginas del examen y, de sus ficheros, los que ya no usa nadie
 * (ni otra página ni una pieza). Primero la fila y luego el almacén: si el
 * almacén falla, queda un fichero huérfano allí, que no rompe nada.
 */
export async function borrarPaginas(examenId: string): Promise<void> {
  const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId }, include: { fichero: true } });
  await prisma.paginaDeExamen.deleteMany({ where: { examenId } });
  for (const { fichero } of paginas) {
    const enUso =
      (await prisma.paginaDeExamen.count({ where: { ficheroId: fichero.id } })) +
      (await prisma.pieza.count({ where: { ficheroId: fichero.id } }));
    if (enUso > 0) continue;
    await prisma.fichero.delete({ where: { id: fichero.id } });
    try {
      await borrarDeVercel(fichero.ruta);
    } catch (error) {
      // La fila ya no está: un fallo del almacén aquí solo deja un blob huérfano, que
      // no rompe nada. No se puede dejar que corte el borrado de los ficheros que
      // vengan detrás en el mismo examen.
      console.error(`No se pudo borrar del almacén el fichero ${fichero.ruta}`, error);
    }
  }
}
