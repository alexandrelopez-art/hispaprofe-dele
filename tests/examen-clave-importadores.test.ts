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

describe("quién puede leer la clave (claveDeLaPrueba)", () => {
  it("solo la llaman los ficheros de la lista blanca", () => {
    // `claveDeLaPrueba(` y no solo `claveDeLaPrueba`: así una prosa que
    // NOMBRE la función en un comentario (hay una en hacer-prueba.tsx, sin
    // llamarla) no cuenta como llamador. Lo que importa es quién la invoca
    // (o la define, que también lleva esa forma en su propia firma).
    const conLlamadas = RAICES.flatMap((raiz) => ficherosDeCodigo(raiz))
      .filter((ruta) => readFileSync(ruta, "utf8").includes("claveDeLaPrueba("))
      .map((ruta) => ruta.split("/").join("/")); // rutas ya vienen con "/" en POSIX

    expect(new Set(conLlamadas)).toEqual(LISTA_BLANCA);
  });
});
