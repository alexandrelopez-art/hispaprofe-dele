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
 * De una lista de ficheros que ya no hacen falta (páginas borradas o
 * sustituidas), borra los que de verdad ya no usa nadie (ni otra página ni
 * una pieza) y, salvo que sigan entre los ids que se acaban de escribir,
 * también su blob. Primero la fila y luego el almacén: si el almacén falla,
 * queda un fichero huérfano allí, que no rompe nada — no se puede dejar que
 * corte la limpieza de los ficheros que vengan detrás en el mismo examen.
 */
async function limpiarSiHuerfanos(candidatos: { id: string; ruta: string }[], idsQueSiguenEnUso: Set<string>): Promise<void> {
  for (const fichero of candidatos) {
    if (idsQueSiguenEnUso.has(fichero.id)) continue;
    const enUso =
      (await prisma.paginaDeExamen.count({ where: { ficheroId: fichero.id } })) +
      (await prisma.pieza.count({ where: { ficheroId: fichero.id } }));
    if (enUso > 0) continue;
    await prisma.fichero.delete({ where: { id: fichero.id } });
    try {
      await borrarDeVercel(fichero.ruta);
    } catch (error) {
      console.error(`No se pudo borrar del almacén el fichero ${fichero.ruta}`, error);
    }
  }
}

/**
 * Borra las páginas del examen y limpia los ficheros que se quedan huérfanos.
 */
export async function borrarPaginas(examenId: string): Promise<void> {
  const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId }, include: { fichero: true } });
  await prisma.paginaDeExamen.deleteMany({ where: { examenId } });
  await limpiarSiHuerfanos(paginas.map((p) => p.fichero), new Set());
}

/**
 * Sustituye de una vez las páginas de un examen, tenga o no páginas ya. A
 * diferencia de `registrarPaginas`, no rechaza un examen que ya tiene
 * páginas: las reemplaza dentro de una única transacción para que un fallo a
 * mitad de camino (red, arranque en frío de Neon, una segunda pestaña) no
 * pueda dejar el examen sin páginas y sin ninguna forma de reintentar.
 *
 * El bloqueo de fila (`FOR UPDATE` sobre el Examen) sirve el mismo papel que
 * en `guardarTarea`: serializa dos sustituciones a la vez para que la
 * segunda no choque contra @@unique([examenId, orden]) a mitad de un
 * `createMany`. Si aun así choca (una carrera rarísima, o dos pestañas que
 * entraron casi a la vez), se traduce en un aviso claro en vez de un 500.
 *
 * La limpieza de los ficheros antiguos (fila y blob) se hace DESPUÉS de que
 * la transacción confirme: si se hiciera dentro, un fallo del almacén (que
 * no es transaccional) forzaría deshacer un registro que ya está bien.
 */
export async function sustituirPaginas(examenId: string, ficheroIds: string[]): Promise<{ error?: string }> {
  if (ficheroIds.length === 0 || ficheroIds.length > MAXIMO_DE_PAGINAS) return { error: "No hay páginas que registrar." };
  if (new Set(ficheroIds).size !== ficheroIds.length) return { error: "Una página viene repetida." };

  const examen = await prisma.examen.findUnique({ where: { id: examenId } });
  if (!examen) return { error: "Ese examen no existe." };

  const ficheros = await prisma.fichero.findMany({ where: { id: { in: ficheroIds } } });
  const validos = new Set(
    ficheros
      .filter((f) => f.almacen === "VERCEL" && f.tipoMime.startsWith("image/") && f.ruta.startsWith(`${CARPETA_DE_MATERIAL}/`))
      .map((f) => f.id),
  );
  if (ficheroIds.some((id) => !validos.has(id))) {
    return { error: "Alguna página no es una imagen subida al almacén de material." };
  }

  let antiguas: { fichero: { id: string; ruta: string } }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Examen" WHERE id = ${examenId} FOR UPDATE`;
      antiguas = await tx.paginaDeExamen.findMany({ where: { examenId }, include: { fichero: true } });
      await tx.paginaDeExamen.deleteMany({ where: { examenId } });
      await tx.paginaDeExamen.createMany({
        data: ficheroIds.map((ficheroId, i) => ({ examenId, ficheroId, orden: i + 1 })),
      });
    });
  } catch (error) {
    if (esClaveDuplicada(error)) return { error: "Otra pestaña está subiendo páginas a este examen. Recarga la pantalla." };
    throw error;
  }

  await limpiarSiHuerfanos(antiguas.map((p) => p.fichero), new Set(ficheroIds));
  return {};
}
