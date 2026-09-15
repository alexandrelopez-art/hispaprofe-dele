import type { Ruta } from "@/lib/taller/editar";
import type { Formulario } from "@/lib/taller/formas";

/** Las que manda el formulario vacío, diga lo que diga la IA. `medios` la repone la pantalla (conMediosDe). */
const FIJAS = new Set(["forma", "numero", "conImagen", "grupo", "medios"]);
/** Listas cuya cantidad no fija la forma. */
const LIBRES = new Set(["pautas"]);
const NOMBRE_DE_LISTA: Record<string, string> = {
  textos: "textos sueltos",
  elementos: "elementos",
  destinos: "textos con letra",
  comunes: "opciones de la lista común",
  preguntas: "preguntas",
  opciones: "opciones",
  huecos: "huecos",
};

class Descuadre extends Error {}

function donde(ruta: Ruta): string {
  // actividad.preguntas es el primer nivel: no hace falta decir dónde.
  return ruta.length > 2 ? ` (en ${ruta.slice(0, -1).join(".")})` : "";
}

function mezclar(vacio: unknown, leido: unknown, ruta: Ruta): unknown {
  const clave = String(ruta[ruta.length - 1] ?? "");
  if (Array.isArray(vacio)) {
    const lista = Array.isArray(leido) ? leido : [];
    if (LIBRES.has(clave)) return lista;
    if (lista.length !== vacio.length) {
      throw new Descuadre(`La IA leyó ${lista.length} ${NOMBRE_DE_LISTA[clave] ?? clave} y la tarea tiene ${vacio.length}${donde(ruta)}.`);
    }
    return vacio.map((v, i) => mezclar(v, lista[i], [...ruta, i]));
  }
  if (vacio === null) return clave === "ejemplo" ? null : leido;
  if (typeof vacio === "object") {
    if (leido === null || typeof leido !== "object") {
      if (clave === "ejemplo") throw new Descuadre("La IA no leyó el ejemplo.");
      throw new Descuadre(`La IA no leyó ${ruta.join(".")}.`);
    }
    const de = vacio as Record<string, unknown>;
    const la = leido as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(de).map((k) => {
        if (FIJAS.has(k)) return [k, de[k]];
        if (k === "letra") return [k, de[k] !== "" ? de[k] : String(la[k] ?? "").trim().toUpperCase().slice(-1)];
        return [k, mezclar(de[k], la[k], [...ruta, k])];
      }),
    );
  }
  return leido;
}

/**
 * Pone los textos que leyó la IA sobre la forma del formulario vacío. Números,
 * letras, grupos e imágenes mandan los del vacío; una lista con otra cantidad se
 * rechaza entera, porque recolocarla a ojo es el error que no se ve.
 */
export function imponerEstructura(vacio: Formulario, leido: Formulario): { formulario: Formulario } | { error: string } {
  try {
    return { formulario: mezclar(vacio, leido, []) as Formulario };
  } catch (e) {
    if (e instanceof Descuadre) return { error: e.message };
    throw e;
  }
}
