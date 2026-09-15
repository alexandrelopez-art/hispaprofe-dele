import type { Ruta } from "@/lib/taller/editar";
import type { Formulario } from "@/lib/taller/formas";

export type Duda = { clave: string; nota: string };

export const DUDA_DE_LA_CONSIGNA: Duda = { clave: "consigna", nota: "Consigna retocada: compárala con la hoja." };

export function claveDeRuta(ruta: Ruta): string {
  return ruta.join(".");
}

export function rutaDeClave(clave: string): Ruta {
  return clave.split(".").map((paso) => (/^\d+$/.test(paso) ? Number(paso) : paso));
}

/** Si la ruta llega a un valor suelto (texto, número o null), no a una lista ni a un objeto. */
function esCampo(f: unknown, ruta: Ruta): boolean {
  let aqui: unknown = f;
  for (const paso of ruta) {
    if (aqui === null || typeof aqui !== "object") return false;
    if (Array.isArray(aqui) !== (typeof paso === "number")) return false;
    if (!(paso in (aqui as object))) return false;
    aqui = (aqui as Record<string | number, unknown>)[paso];
  }
  return aqui === null || typeof aqui !== "object";
}

/**
 * Junta lo que lee la IA con la duda fija de la consigna: si la IA también
 * duda de la consigna, su nota se funde tras la fija. Dos dudas del mismo
 * campo se funden en una sola, notas unidas con « · ». La IA a veces
 * antepone "formulario." a campo (el nombre de la clave en el esquema): se
 * quita antes de comprobar si el campo existe.
 */
export function dudasDelFormulario(f: Formulario, leidas: { campo: string; nota: string }[]): Duda[] {
  const notas = new Map<string, string>([[DUDA_DE_LA_CONSIGNA.clave, DUDA_DE_LA_CONSIGNA.nota]]);
  for (const d of leidas) {
    const campo = d.campo.startsWith("formulario.") ? d.campo.slice("formulario.".length) : d.campo;
    if (campo !== DUDA_DE_LA_CONSIGNA.clave && !esCampo(f, rutaDeClave(campo))) continue;
    const previa = notas.get(campo);
    notas.set(campo, previa ? `${previa} · ${d.nota}` : d.nota);
  }
  return [...notas.entries()].map(([clave, nota]) => ({ clave, nota }));
}

function letraDeIndice(i: number): string {
  return String.fromCharCode(65 + i);
}

/**
 * Etiqueta legible para la lista de dudas, a partir de la clave (la ruta del
 * campo). Los casos comunes tienen su propia redacción; el resto, la clave
 * con los índices en base uno y los puntos cambiados por « · ».
 */
export function etiquetaDeDuda(clave: string): string {
  if (clave === DUDA_DE_LA_CONSIGNA.clave) return "Consigna";
  const ruta = rutaDeClave(clave);
  const [a, b, c, d, e, f] = ruta;
  if (ruta.length === 3 && a === "textos" && typeof b === "number" && c === "texto") return `Texto ${b + 1}`;
  if (ruta.length === 4 && a === "actividad" && b === "preguntas" && typeof c === "number" && d === "enunciado") {
    return `Pregunta ${c + 1} · enunciado`;
  }
  if (ruta.length === 6 && a === "actividad" && b === "preguntas" && typeof c === "number" && d === "opciones" && typeof e === "number" && f === "texto") {
    return `Pregunta ${c + 1} · opción ${letraDeIndice(e)}`;
  }
  if (ruta.length === 6 && a === "actividad" && b === "huecos" && typeof c === "number" && d === "opciones" && typeof e === "number" && f === "texto") {
    return `Hueco ${c + 1} · opción ${letraDeIndice(e)}`;
  }
  if (ruta.length === 5 && a === "actividad" && b === "opciones" && typeof c === "number" && d === "pautas" && typeof e === "number") {
    return `Opción ${c + 1} · pauta ${e + 1}`;
  }
  return ruta.map((paso) => (typeof paso === "number" ? String(paso + 1) : paso)).join(" · ");
}

/** Al editar un campo (o una lista entera, como las pautas) se van sus dudas. */
export function quitarDudasDe(dudas: Duda[], ruta: Ruta): Duda[] {
  const clave = claveDeRuta(ruta);
  return dudas.filter((d) => d.clave !== clave && !d.clave.startsWith(`${clave}.`));
}

function iguales(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => iguales(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => iguales((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

export function tieneAlgoEscrito(f: Formulario, vacio: Formulario): boolean {
  return !iguales(f, vacio);
}
