import { describe, it, expect } from "vitest";
import { ESTRUCTURAS, PRUEBAS, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import {
  TIPO_DE_ACTIVIDAD,
  esquemaDelFormulario,
  formularioVacio,
  type Formulario,
} from "@/lib/taller/formas";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;
const regla = (prueba: "CE" | "CO" | "EE" | "EO", numero: number) => reglaDe("A2_B1_ESCOLAR", prueba, numero)!;
const TODAS = PRUEBAS.flatMap((prueba) => ESCOLAR[prueba].map((r) => ({ nombre: `${prueba}-${r.numero}`, regla: r })));
const CERRADAS = TODAS.filter((t) => t.regla.items !== null);

function pasa(r: ReglaTarea, f: unknown): boolean {
  return esquemaDelFormulario(r).safeParse(f).success;
}

/** El primer ítem de un formulario cerrado, para meterle un campo que no debe existir. */
function primerItem(f: Formulario): Record<string, unknown> {
  switch (f.forma) {
    case "RELACIONAR": return f.actividad.elementos[0];
    case "LISTA_COMUN":
    case "OPCIONES": return f.actividad.preguntas[0];
    case "HUECOS": return f.actividad.huecos[0];
    default: throw new Error("no es una tarea cerrada");
  }
}

describe("las formas del formulario", () => {
  // Mutación que la mata: que formularioVacio de alguna forma no cuadre con
  // fallosDeForma (una letra de menos, un número mal empezado).
  it.each(TODAS)("el formulario vacío de $nombre cumple su forma", ({ regla: r }) => {
    expect(pasa(r, formularioVacio(r))).toBe(true);
  });

  // El candado de la sección 3 del diseño: la solución no viaja en los datos.
  // Mutación que la mata: cambiar z.strictObject por z.object en el ítem.
  it.each(["respuesta", "respuestas", "correcta", "correctas", "clave", "solucion"])(
    "ningún ítem de ninguna tarea cerrada admite el campo «%s»",
    (campo) => {
      for (const { regla: r } of CERRADAS) {
        const f = structuredClone(formularioVacio(r));
        primerItem(f)[campo] = "B";
        expect(pasa(r, f)).toBe(false);
      }
    },
  );

  // Mutación que la mata: cambiar z.strictObject por z.object en formularioBase o sus discriminantes.
  it("un campo desconocido en la raíz también rebota", () => {
    const r = regla("EE", 1);
    expect(pasa(r, { ...formularioVacio(r), extra: 1 })).toBe(false);
  });

  // Mutación que la mata: no comparar la longitud de preguntas con items.
  it("Lectura 3 con una pregunta de menos rebota", () => {
    const r = regla("CE", 3);
    const f = formularioVacio(r);
    if (f.forma !== "OPCIONES") throw new Error();
    f.actividad.preguntas.pop();
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: comprobar solo cuántos elementos hay, no sus números.
  it("Lectura 1 con los números corridos rebota", () => {
    const r = regla("CE", 1);
    const f = formularioVacio(r);
    if (f.forma !== "RELACIONAR") throw new Error();
    f.actividad.elementos = f.actividad.elementos.map((e) => ({ ...e, numero: e.numero + 1 }));
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: cambiar numeros.map o abc.map en formularioVacio para RELACIONAR, o alterar letrasHasta(10).
  it("Lectura 1 tiene seis elementos del 1 al 6 y diez destinos de la A a la J", () => {
    const f = formularioVacio(regla("CE", 1));
    if (f.forma !== "RELACIONAR") throw new Error();
    expect(f.actividad.elementos.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(f.actividad.destinos.map((d) => d.letra).join("")).toBe("ABCDEFGHIJ");
  });

  // Mutación que la mata: no mirar conImagen en fallosDeForma.
  it("Auditiva 1: las opciones de las cuatro primeras son imagen y las demás no", () => {
    const r = regla("CO", 1);
    const f = formularioVacio(r);
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.actividad.preguntas.map((p) => p.opciones.every((o) => o.conImagen))).toEqual([
      true, true, true, true, false, false, false,
    ]);
    expect(f.actividad.ejemplo?.opciones.every((o) => o.conImagen)).toBe(true);
    f.actividad.preguntas[4].opciones[0].conImagen = true;
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: eliminar `grupo: grupoDe(regla, i)` de formularioVacio para OPCIONES, o cambiar la fórmula en grupoDe.
  it("Auditiva 4 reparte las seis preguntas en tres noticias de dos", () => {
    const f = formularioVacio(regla("CO", 4));
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.actividad.preguntas.map((p) => p.grupo)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  // Mutación que la mata: no comprobar que la forma que llega es la de la regla.
  it("un formulario de otra forma rebota", () => {
    expect(pasa(regla("CE", 3), formularioVacio(regla("CE", 1)))).toBe(false);
  });

  // Mutación que la mata: quitar `.nullable()` del esquema de ejemplo en LISTA_COMUN y OPCIONES, o no comprobar `hay !== regla.ejemplo` en fallosDeForma.
  it("una tarea sin ejemplo no admite ejemplo, y una con ejemplo lo exige", () => {
    const ce2 = regla("CE", 2);
    const f = formularioVacio(ce2);
    if (f.forma !== "LISTA_COMUN") throw new Error();
    f.actividad.ejemplo = { enunciado: "", letra: "" };
    expect(pasa(ce2, f)).toBe(false);

    const co3 = regla("CO", 3);
    const g = formularioVacio(co3);
    if (g.forma !== "LISTA_COMUN") throw new Error();
    g.actividad.ejemplo = null;
    expect(pasa(co3, g)).toBe(false);
  });

  // Mutación que la mata: cambiar `Boolean(regla.opcionesConImagen)` a siempre true o siempre false en formularioVacio para ORAL_SOLO, o no comprobar conImagen en fallosDeForma.
  it("Oral 1 lleva foto en sus dos opciones; Oral 3 no", () => {
    const eo1 = formularioVacio(regla("EO", 1));
    const eo3 = formularioVacio(regla("EO", 3));
    if (eo1.forma !== "ORAL_SOLO" || eo3.forma !== "ORAL_SOLO") throw new Error();
    expect(eo1.actividad.opciones.map((o) => o.conImagen)).toEqual([true, true]);
    expect(eo3.actividad.opciones.map((o) => o.conImagen)).toEqual([false, false]);
  });

  // Mutación que la mata: eliminar la comprobación `f.textos.length !== regla.textos` de fallosDeForma.
  it("Lectura 2 pide tres textos y Lectura 3 uno", () => {
    expect(formularioVacio(regla("CE", 2)).textos).toHaveLength(3);
    expect(formularioVacio(regla("CE", 3)).textos).toHaveLength(1);
    const r = regla("CE", 2);
    const f = formularioVacio(r);
    f.textos.pop();
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: cambiar `ORAL_DIRECTO: "CONVERSACION"` a `ORAL_DIRECTO: "GRABACION"` en TIPO_DE_ACTIVIDAD.
  it("las orales en directo se guardan como conversación, no como grabación", () => {
    expect(TIPO_DE_ACTIVIDAD.ORAL_DIRECTO).toBe("CONVERSACION");
    expect(TIPO_DE_ACTIVIDAD.ORAL_SOLO).toBe("GRABACION");
    expect(TIPO_DE_ACTIVIDAD.HUECOS).toBe("HUECOS");
    expect(TIPO_DE_ACTIVIDAD.LISTA_COMUN).toBe("OPCION");
  });

  // Mutación que la mata: no mirar las claves de medios.imagenes en fallosDeForma.
  it("una foto en una clave que no es de ninguna opción con imagen no pasa", () => {
    const r = regla("CO", 1);
    const f = formularioVacio(r);
    f.medios.imagenes["ejemplo-A"] = "f1";
    expect(pasa(r, f)).toBe(true);
    f.medios.imagenes["5-A"] = "f2";
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: no mirar regla.trozos antes de aceptar un audio.
  it("audio solo en las tareas con trozos, y con las marcas en orden", () => {
    const ce3 = regla("CE", 3);
    const conAudio = formularioVacio(ce3);
    conAudio.medios.audio = { fichero: "a1", cortes: [] };
    expect(pasa(ce3, conAudio)).toBe(false);

    const co4 = regla("CO", 4);
    const f = formularioVacio(co4);
    f.medios.audio = { fichero: "a1", cortes: [120, 240] };
    expect(pasa(co4, f)).toBe(true);
    f.medios.audio = { fichero: "a1", cortes: [240, 120] };
    expect(pasa(co4, f)).toBe(false);
  });

  // Mutación que la mata: olvidar medios en el vacío de alguna forma.
  it.each(TODAS)("el vacío de $nombre no trae fotos ni pista", ({ regla: r }) => {
    expect(formularioVacio(r).medios).toEqual({ imagenes: {}, audio: null });
  });
});
