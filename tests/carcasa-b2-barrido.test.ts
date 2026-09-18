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

// corregir-escrita.tsx y notas.ts son del profesor (B1), no de esta entrega,
// pero ya están limpios de colores de marca a mano y de window.confirm(), así
// que se dejan dentro del barrido: no hace falta seguir excluyéndolos.
const DEL_ESTUDIANTE = [...ficheros("components/examen"), ...ficheros("app/examen"), ...ficheros("app/entrar")];

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

  // Spec §6: la entrega por el reloj no pasa por la pregunta de confirmación,
  // se manda sola. Prueba leída del fuente (sin jsdom no hay forma de
  // disparar <Reloj> de verdad): se aisla el CUERPO de alAcabarse y se
  // comprueba que no menciona ninguno de los dos estados que abren el
  // diálogo de PreguntaDeEntrega.
  // Mutación que la mata: meter un setPreguntando(true) (hacer-prueba.tsx) o
  // un setConfirmando(true) (hacer-escrita.tsx) dentro de alAcabarse.
  it("alAcabarse no toca el estado de la pregunta de entrega", () => {
    for (const fichero of ["components/examen/hacer-prueba.tsx", "components/examen/hacer-escrita.tsx"]) {
      const codigo = readFileSync(fichero, "utf8");
      const m = codigo.match(/const alAcabarse = useCallback\(\(\) => \{([\s\S]*?)\n {2}\}, \[/);
      expect(m, `no se encontro el cuerpo de alAcabarse en ${fichero}`).not.toBeNull();
      const cuerpo = m![1]!;
      expect(cuerpo).not.toContain("setPreguntando");
      expect(cuerpo).not.toContain("setConfirmando");
    }
  });

  // Cuando el servidor rechaza la entrega, las dos pantallas cierran su
  // pregunta: el diálogo es un <dialog> abierto con showModal(), que deja el
  // resto de la página inerte, así que el aviso de error quedaría detrás del
  // telón de fondo (backdrop) sin que nadie pudiera verlo.
  // Mutación que la mata: quitar el setPreguntando(false) del camino de error
  // de entregarYa (hacer-prueba.tsx), o el setConfirmando(false) del camino de
  // error de entregarPruebaAccion en alEntregar (hacer-escrita.tsx).
  it("si la entrega falla, entregarYa y alEntregar cierran su dialogo", () => {
    const prueba = readFileSync("components/examen/hacer-prueba.tsx", "utf8");
    const mPrueba = prueba.match(/function entregarYa\(\) \{([\s\S]*?)\n {2}\}\n/);
    expect(mPrueba, "no se encontro entregarYa en hacer-prueba.tsx").not.toBeNull();
    expect(mPrueba![1]).toMatch(/if \(r\.error\)[\s\S]*?setPreguntando\(false\)/);

    const escrita = readFileSync("components/examen/hacer-escrita.tsx", "utf8");
    const mEscrita = escrita.match(/function alEntregar\(\) \{([\s\S]*?)\n {2}\}\n/);
    expect(mEscrita, "no se encontro alEntregar en hacer-escrita.tsx").not.toBeNull();
    // Solo el tramo de después de mandar la entrega al servidor: el camino
    // del fallo al GUARDAR el folio (antes de llegar a entregar) ya cerraba
    // el diálogo desde siempre y no es lo que esta prueba vigila.
    const cuerpo = mEscrita![1]!;
    const trasEntregar = cuerpo.slice(cuerpo.indexOf("entregarPruebaAccion"));
    expect(trasEntregar).toMatch(/if \(r\.error\)[\s\S]*?setConfirmando\(false\)/);
  });
});
