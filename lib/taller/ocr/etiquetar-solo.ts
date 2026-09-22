import { prisma } from "@/lib/db";
import { ESTRUCTURAS } from "@/lib/dele/estructura";
import { ordenarYEtiquetarPaginas, type PaginaResuelta, type SenalDePagina } from "@/lib/taller/etiquetas-automaticas";
import type { Hoja } from "@/lib/taller/ia/encargo";
import { descargarHoja } from "@/lib/taller/ia/hojas";
import { ExamenNoEditable, MENSAJE_ARCHIVADO, MENSAJE_PUBLICADO, exigirEditable } from "@/lib/taller/publicado";
import { decodificarHoja } from "./decodificar";
import type { Lienzo } from "./imagen";
import { dividirEnHojas } from "./leer-examen";
import { crearSesionOcr, detectarRotulosDePagina, type SesionOcr } from "./rotulos";

/**
 * Etiquetado automático de un examen: a diferencia de `leerExamen` (que lee
 * el CONTENIDO de las catorce tareas), esto solo decide qué `etiquetas` le
 * tocan a cada página ya guardada en la base. La señal sale de
 * `detectarRotulosDePagina` (rótulos y pie de página leídos de tiras
 * recortadas del lienzo, no de la página entera): el texto corrido de una
 * página completa NUNCA trae el número de pie impreso (confirmado contra el
 * corpus), así que `ordenarYEtiquetarPaginas` se quedaba sin ancla para
 * ordenar y el etiquetado entero desincronizaba.
 */

/** Una página que el algoritmo no pudo casar con seguridad: se le enseña al profesor para que la revise a mano, nunca se le oculta la duda. */
export type PaginaIncierta = { id: string; orden: number; etiquetas: string[] };

export type ResultadoDeEtiquetadoAutomatico =
  | { error: string }
  | { paginas: number; etiquetadas: number; inciertas: PaginaIncierta[] };

export type Dependencias = {
  descargar: (ruta: string, tipoMime: string) => Promise<Hoja>;
  abrirSesion: () => Promise<SesionOcr>;
};

const REALES: Dependencias = {
  descargar: (ruta, tipoMime) => descargarHoja(ruta, tipoMime),
  abrirSesion: () => crearSesionOcr(),
};

type PaginaConFichero = { id: string; orden: number; ruta: string; tipoMime: string };
type HojaDescargada = { id: string; orden: number; hoja: Hoja };

/**
 * Una de las una o dos caras físicas de una hoja escaneada (ver
 * `dividirEnHojas`, que ya hace este trabajo para `leerExamen`). Una hoja en
 * doble página aporta dos `LadoDeHoja` con el mismo `id`: no hay dos filas
 * que escribir en la base, solo una, así que el id de origen viaja con cada
 * lado para que `fusionarPorPagina` pueda recomponerlo al final.
 */
type LadoDeHoja = { id: string; orden: number; lienzo: Lienzo };

/**
 * Descarga todas las hojas ANTES de abrir la sesión de lectura: si una
 * página del almacén falla, se entera aquí sin haber pagado el coste de
 * levantar un worker de tesseract para nada (el mismo orden que sigue
 * `rellenarTarea` con la IA).
 */
async function descargarHojas(paginas: readonly PaginaConFichero[], deps: Dependencias): Promise<HojaDescargada[]> {
  const hojas: HojaDescargada[] = [];
  for (const p of paginas) {
    try {
      hojas.push({ id: p.id, orden: p.orden, hoja: await deps.descargar(p.ruta, p.tipoMime) });
    } catch {
      throw new Error(`No se pudo leer la hoja ${p.orden} del almacén.`);
    }
  }
  return hojas;
}

/**
 * Decodifica cada hoja a píxeles y la parte por el lomo si venía en doble
 * página. También ANTES de abrir la sesión de lectura, por la misma razón
 * que la descarga: una imagen corrupta se descubre sin gastar el arranque de
 * un worker de tesseract.
 */
function decodificarYPartir(hojas: readonly HojaDescargada[]): LadoDeHoja[] {
  const lienzos = hojas.map((h) => {
    try {
      return decodificarHoja(h.hoja);
    } catch {
      throw new Error(`No se pudo decodificar la imagen de la hoja ${h.orden}.`);
    }
  });
  return dividirEnHojas(lienzos).map((lado) => ({
    id: hojas[lado.indicePdf].id,
    orden: hojas[lado.indicePdf].orden,
    lienzo: lado.lienzo,
  }));
}

/**
 * Reconoce cada lado con UNA sola sesión de lectura, reutilizada de
 * principio a fin: levantar un worker de tesseract por página es lentísimo
 * (ver `crearSesionOcr`). El `finally` cierra el worker aunque el
 * reconocimiento de algún lado reviente a medias. El `id` de cada señal es
 * solo su posición en `lados`: `ordenarYEtiquetarPaginas` lo devuelve tal
 * cual en `PaginaResuelta.id`, y así `fusionarPorPagina` puede volver del
 * índice al id real de la página de origen.
 */
async function leerSenales(lados: readonly LadoDeHoja[], deps: Dependencias): Promise<SenalDePagina[]> {
  const sesion = await deps.abrirSesion();
  try {
    const senales: SenalDePagina[] = [];
    for (let i = 0; i < lados.length; i++) {
      try {
        const { inicios, numeroImpreso } = await detectarRotulosDePagina(lados[i].lienzo, sesion.reconocerRotulo);
        senales.push({ id: String(i), numeroImpreso, cabecera: null, inicios });
      } catch {
        throw new Error(`El lector automático no pudo leer la hoja ${lados[i].orden}.`);
      }
    }
    return senales;
  } finally {
    await sesion.cerrar();
  }
}

type PaginaFusionada = { etiquetas: string[]; segura: boolean };

/**
 * Une los resultados por página de origen: una hoja partida en dos caras
 * aporta dos entradas a `resueltas` (una por lado), pero solo hay una fila
 * en la base que escribir. Las etiquetas se juntan sin duplicar -una tarea
 * que sigue abierta de una cara a la otra repite su etiqueta en las dos- y
 * la página entera queda insegura si cualquiera de sus caras lo estaba:
 * mejor pedirle al profesor que revise de más que dar por buena una cara que
 * el algoritmo no pudo colocar.
 */
function fusionarPorPagina(resueltas: readonly PaginaResuelta[], lados: readonly LadoDeHoja[]): Map<string, PaginaFusionada> {
  const combinadas = new Map<string, PaginaFusionada>();
  for (const r of resueltas) {
    const id = lados[Number(r.id)].id;
    const previa = combinadas.get(id) ?? { etiquetas: [], segura: true };
    combinadas.set(id, {
      etiquetas: [...new Set([...previa.etiquetas, ...r.etiquetas])],
      segura: previa.segura && r.segura,
    });
  }
  return combinadas;
}

/** Invariante: `partirPorElLomo` nunca deja una hoja sin al menos un lado, así que toda página de origen aparece en `combinadas`. El `??` es solo una red de seguridad tipada. */
function fusionadaDe(combinadas: ReadonlyMap<string, PaginaFusionada>, id: string): PaginaFusionada {
  return combinadas.get(id) ?? { etiquetas: [], segura: false };
}

/**
 * Etiqueta automáticamente todas las páginas de un examen leyendo cada hoja
 * con el OCR local: el atajo que sustituye el clic manual, tarea por tarea.
 * No toca el orden de las páginas en la base — solo escribe `etiquetas` — y
 * sustituye SIEMPRE lo que hubiera antes; es la pantalla quien decide si
 * avisa al profesor de que ya había etiquetas puestas a mano.
 */
export async function etiquetarPaginasAutomaticamente(examenId: string, deps: Dependencias = REALES): Promise<ResultadoDeEtiquetadoAutomatico> {
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { paginas: { orderBy: { orden: "asc" }, include: { fichero: true } } },
  });
  if (!examen) return { error: "Ese examen no existe." };
  if (examen.estado === "PUBLICADO") return { error: MENSAJE_PUBLICADO };
  if (examen.estado === "ARCHIVADO") return { error: MENSAJE_ARCHIVADO };
  if (examen.paginas.length === 0) return { error: "Este examen no tiene páginas todavía." };
  if (!ESTRUCTURAS[examen.nivel]) return { error: "Este nivel todavía no tiene la secuencia de tareas cargada." };

  let hojas: HojaDescargada[];
  try {
    hojas = await descargarHojas(
      examen.paginas.map((p) => ({ id: p.id, orden: p.orden, ruta: p.fichero.ruta, tipoMime: p.fichero.tipoMime })),
      deps,
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo leer el examen del almacén." };
  }

  let lados: LadoDeHoja[];
  try {
    lados = decodificarYPartir(hojas);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo decodificar el examen." };
  }

  let senales: SenalDePagina[];
  try {
    senales = await leerSenales(lados, deps);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "El lector automático no pudo leer el examen." };
  }

  const resueltas = ordenarYEtiquetarPaginas(examen.nivel, senales);
  const combinadas = fusionarPorPagina(resueltas, lados);
  const resultados = examen.paginas.map((p) => ({ id: p.id, orden: p.orden, ...fusionadaDe(combinadas, p.id) }));

  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      for (const r of resultados) {
        await tx.paginaDeExamen.update({ where: { id: r.id }, data: { etiquetas: r.etiquetas } });
      }
    });
  } catch (error) {
    if (error instanceof ExamenNoEditable) return { error: error.message };
    throw error;
  }

  return {
    paginas: resultados.length,
    etiquetadas: resultados.filter((r) => r.etiquetas.length > 0).length,
    inciertas: resultados.filter((r) => !r.segura).map((r) => ({ id: r.id, orden: r.orden, etiquetas: r.etiquetas })),
  };
}
