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

export function dudasDelFormulario(f: Formulario, leidas: { campo: string; nota: string }[]): Duda[] {
  const validas = leidas
    .filter((d) => d.campo !== DUDA_DE_LA_CONSIGNA.clave && esCampo(f, rutaDeClave(d.campo)))
    .map((d) => ({ clave: d.campo, nota: d.nota }));
  return [DUDA_DE_LA_CONSIGNA, ...validas];
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
