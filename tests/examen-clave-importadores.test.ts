import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// `claveDeLaPrueba` (lib/examen/hacer.ts) es la única función que trae la
// tabla `Clave` —la respuesta correcta del examen— fuera de la propia tabla.
// Antes era privada: el compilador impedía que un fichero nuevo la llamara.
// Exportarla (Task 12, para que lib/examen/hoja.ts la reutilizara) cambió esa
// garantía por buena fe: si alguien añade mañana un
// `export * from "@/lib/examen/hacer"` en una ruta pública, o llama a la
// función desde un sitio nuevo sin pensarlo, la clave se filtra y ningún tipo
// lo avisa. `server-only` resolvería esto de raíz, pero no está instalado en
// el proyecto y no toca instalarlo por esto.
//
// Esta prueba hace mecánico lo que antes hacía el compilador: recorre TODO
// el código de la aplicación (app, lib, components — no node_modules, no
// lib/generated) buscando quién menciona `claveDeLaPrueba`, y falla en
// cuanto aparece un fichero que no está en la lista blanca de abajo.
//
// Mutación que la mata: añadir una llamada a `claveDeLaPrueba` en un cuarto
// fichero (o borrar uno de los tres de la lista, dejando huérfano al que de
// verdad la llama). Las dos formas dejan la lista y la realidad
// desincronizadas, y es justo eso lo que esta prueba vigila.
const LISTA_BLANCA = new Set([
  // La define, y la llama dos veces: `cerrarIntento` (congela la nota al
  // entregar lectura/auditiva) y `corregirEnLibre` (camino de ESTUDIANTE en
  // práctica libre; nunca devuelve la clave en sí, solo aciertos/fallos).
  "lib/examen/hacer.ts",
  // La única que SÍ enseña la letra correcta — y por eso exige PROFESOR y
  // exige la prueba entregada antes de llamarla.
  "lib/examen/hoja.ts",
]);

const RAICES = ["app", "lib", "components"];
const IGNORADOS = new Set(["generated", "node_modules", ".next"]);

function ficherosDeCodigo(dir: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORADOS.has(entrada.name)) continue;
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...ficherosDeCodigo(ruta));
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

/**
 * Quita los comentarios (`/* * /` y `//`) antes de buscar. Sin esto, un
 * comentario que solo NOMBRA la función —hay uno legítimo en
 * hacer-prueba.tsx— cuenta como mención, y obligaría a esos comentarios a
 * dejar de decir el nombre con tal de que la prueba calle. Un comentario no
 * tiene por qué perder precisión para que una prueba de código pase.
 */
function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("quién puede leer la clave (claveDeLaPrueba)", () => {
  it("solo la llaman, o la importan, los ficheros de la lista blanca", () => {
    // El identificador a secas, sin exigir el paréntesis pegado: buscar
    // `claveDeLaPrueba(` se dejaba escapar el descuido más normal de todos,
    // un import con alias (`import { claveDeLaPrueba as otroNombre } from
    // "./hacer"`, y luego `otroNombre(...)`), que no deja esa cadena en
    // ningún sitio. Y se busca sobre el texto SIN comentarios, para que una
    // prosa que solo nombre la función (documentación, no una llamada) no
    // cuente como mención.
    const conMenciones = RAICES.flatMap((raiz) => ficherosDeCodigo(raiz))
      .filter((ruta) => sinComentarios(readFileSync(ruta, "utf8")).includes("claveDeLaPrueba"))
      .map((ruta) => ruta.split("/").join("/")); // rutas ya vienen con "/" en POSIX

    expect(new Set(conMenciones)).toEqual(LISTA_BLANCA);
  });
});
