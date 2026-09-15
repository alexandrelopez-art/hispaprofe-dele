import type { Prueba } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { etiquetaDeTarea, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { SIN_USO } from "./coste";
import { dudasDelFormulario, type Duda } from "./dudas";
import { encargoDeTarea, esquemaDeRespuesta, type Hoja } from "./encargo";
import { mensajeDeError } from "./errores";
import { imponerEstructura } from "./estructura";
import { descargarHoja } from "./hojas";
import { MODELO, hayClaveDeIA, leerConClaude, type LeerHojas, type RespuestaDeLaIA } from "./llamar";
import { apuntarLlamada } from "./registro";

export type ResultadoDeRelleno = { formulario: Formulario; dudas: Duda[] } | { error: string };

export type Dependencias = {
  leer: LeerHojas;
  descargar: (ruta: string, tipoMime: string) => Promise<Hoja>;
  hayClave: () => boolean;
  reloj: () => number;
  apuntar: typeof apuntarLlamada;
};

const REALES: Dependencias = {
  leer: leerConClaude,
  descargar: (ruta, tipoMime) => descargarHoja(ruta, tipoMime),
  hayClave: hayClaveDeIA,
  reloj: () => Date.now(),
  apuntar: apuntarLlamada,
};

export function interpretar(regla: ReglaTarea, respuesta: RespuestaDeLaIA): ResultadoDeRelleno {
  if (respuesta.stopReason === "max_tokens") return { error: "La IA se quedó sin espacio y la respuesta está a medias." };
  if (respuesta.stopReason === "refusal") return { error: "La IA no quiso leer estas hojas." };
  const leida = esquemaDeRespuesta(regla.forma).safeParse(respuesta.salida);
  if (!leida.success) return { error: "La IA devolvió algo que no es esta tarea." };
  const impuesta = imponerEstructura(formularioVacio(regla), leida.data.formulario);
  if ("error" in impuesta) return impuesta;
  const fallos = fallosDeForma(regla, impuesta.formulario);
  if (fallos.length > 0) return { error: `Fallo del taller al ordenar lo leído: ${fallos[0]}` };
  return { formulario: impuesta.formulario, dudas: dudasDelFormulario(impuesta.formulario, leida.data.dudas) };
}

/**
 * Apunta la llamada sin dejar que un fallo al escribir en LlamadaDeIA se lleve
 * por delante el resultado ya calculado (el formulario, o el error traducido).
 * Si falla, queda en el log del servidor: se pierde el registro del gasto,
 * nunca la respuesta al profesor.
 */
async function apuntarSinRomper(deps: Dependencias, datos: Parameters<typeof apuntarLlamada>[0]): Promise<void> {
  try {
    await deps.apuntar(datos);
  } catch (e) {
    console.error("No se pudo apuntar la llamada a la IA", e);
  }
}

/**
 * Lee las hojas de una tarea con la IA y devuelve el formulario para la
 * pantalla. NO guarda nada de la tarea: solo apunta la llamada, que se paga
 * aunque falle.
 */
export async function rellenarTarea(examenId: string, prueba: Prueba, numero: number, deps: Dependencias = REALES): Promise<ResultadoDeRelleno> {
  if (!deps.hayClave()) return { error: "Falta la clave de la IA." };
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { paginas: { orderBy: { orden: "asc" }, include: { fichero: true } } },
  });
  const regla = examen ? reglaDe(examen.nivel, prueba, numero) : null;
  if (!examen || !regla) return { error: "Esa tarea no existe." };

  const etiqueta = etiquetaDeTarea(prueba, numero);
  const paginas = examen.paginas.filter((p) => p.etiquetas.includes(etiqueta));
  if (paginas.length === 0) return { error: "Etiqueta primero las hojas de esta tarea." };

  const hojas: Hoja[] = [];
  for (const p of paginas) {
    try {
      hojas.push(await deps.descargar(p.fichero.ruta, p.fichero.tipoMime));
    } catch {
      return { error: `No se pudo leer la hoja ${p.orden} del almacén.` };
    }
  }

  const encargo = encargoDeTarea(examen.nivel, prueba, regla, hojas);
  const inicio = deps.reloj();
  let respuesta: RespuestaDeLaIA;
  try {
    respuesta = await deps.leer(encargo);
  } catch (e) {
    const error = mensajeDeError(e);
    await apuntarSinRomper(deps, { examenId, prueba, numero, modelo: MODELO, uso: SIN_USO, milisegundos: deps.reloj() - inicio, error });
    return { error };
  }

  let resultado: ResultadoDeRelleno;
  try {
    resultado = interpretar(regla, respuesta);
  } catch {
    resultado = { error: "Fallo del taller al ordenar lo leído." };
  }
  await apuntarSinRomper(deps, {
    examenId,
    prueba,
    numero,
    modelo: respuesta.modelo,
    uso: respuesta.uso,
    milisegundos: deps.reloj() - inicio,
    error: "error" in resultado ? resultado.error : null,
  });
  return resultado;
}
