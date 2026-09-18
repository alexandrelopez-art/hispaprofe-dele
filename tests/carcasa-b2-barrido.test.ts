import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory()
      ? ficheros(ruta)
      : ruta.endsWith(".tsx") || ruta.endsWith(".ts")
        ? [ruta]
        : [];
  });
}

const DEL_ESTUDIANTE = [...ficheros("components/examen"), ...ficheros("app/examen"), ...ficheros("app/entrar")]
  // corregir-escrita.tsx y notas.ts son del profesor (B1), no de esta entrega.
  .filter((f) => !f.endsWith("corregir-escrita.tsx") && !f.endsWith("notas.ts"));

describe("el barrido de la entrega B2: entrar, examen y adios a piezas.tsx", () => {
  // Mutación que la mata: devolver piezas.tsx o importarlo desde cualquier sitio.
  it("piezas.tsx ya no existe y nadie lo importa", () => {
    expect(existsSync("components/examen/piezas.tsx")).toBe(false);
    // Esta misma prueba, en su propio texto, menciona "examen/piezas.tsx":
    // se descarta a si misma del barrido para no cazarse a si misma.
    const ESTE_FICHERO = "tests/carcasa-b2-barrido.test.ts";
    const todos = [...ficheros("components"), ...ficheros("app"), ...ficheros("lib"), ...ficheros("tests")].filter(
      (f) => f !== ESTE_FICHERO,
    );
    expect(todos.filter((f) => readFileSync(f, "utf8").includes("examen/piezas"))).toEqual([]);
  });

  // Mutación que la mata: escribir a mano bg-hp-400 (o cualquier color de marca)
  // en una pantalla del estudiante. El foco (focus-visible:outline-hp-600 /
  // focus-within:outline-hp-600) es la única excepción: es el mismo del kit.
  it("las pantallas del estudiante no escriben colores de marca a mano", () => {
    const culpables = DEL_ESTUDIANTE.filter((f) =>
      /(?<!outline-)(bg|border|text)-hp-\d/.test(readFileSync(f, "utf8")),
    );
    expect(culpables).toEqual([]);
  });

  // Mutación que la mata: volver a window.confirm en cualquier pantalla del
  // estudiante. La exclusión de la comilla invertida deja pasar los
  // comentarios que solo NOMBRAN a confirm() (pregunta-de-entrega.tsx explica
  // que sustituye a `confirm()` del navegador); una llamada de verdad, como
  // window.confirm(...), no lleva esa comilla justo delante.
  it("nadie pregunta con confirm()", () => {
    const culpables = DEL_ESTUDIANTE.filter((f) => /(?<!`)confirm\(/.test(readFileSync(f, "utf8")));
    expect(culpables).toEqual([]);
  });

  // Mutación que la mata: copiar del dibujo «Cohesión» o un botón «Guardar».
  it("ni Cohesion ni boton Guardar en la escrita", () => {
    const escrita = readFileSync("components/examen/hacer-escrita.tsx", "utf8");
    expect(escrita).not.toContain("Cohesión");
    expect(escrita).not.toMatch(/>\s*Guardar\s*</);
  });
});
