import { describe, it, expect, vi } from "vitest";

// interpretar es pura y no toca la base, pero rellenar.ts también exporta
// rellenarTarea, que importa "@/lib/db" a nivel de módulo. Sin esto, cargar
// el fichero exige DATABASE_URL igual que en tests/ficheros-rutas.test.ts.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { interpretar } from "@/lib/taller/ia/rellenar";
import { SIN_USO } from "@/lib/taller/ia/coste";

const ce3 = reglaDe("A2_B1_ESCOLAR", "CE", 3)!;
const respuesta = (salida: unknown, stopReason: string | null = "end_turn") => ({ salida, stopReason, modelo: "claude-opus-5", uso: SIN_USO });
const bueno = () => {
  const f = formularioVacio(ce3);
  return { ...f, consigna: "Lee el texto." };
};

describe("interpretar lo que devuelve la IA", () => {
  // Mutación que la mata: no mirar stop_reason (la salida cortada validaría igual).
  it("cortada por largo es error aunque la salida valga", () => {
    expect(interpretar(ce3, respuesta({ formulario: bueno(), dudas: [] }, "max_tokens"))).toEqual({ error: "La IA se quedó sin espacio y la respuesta está a medias." });
  });

  // Mutación que la mata: quitar la rama de refusal.
  it("rechazada es error", () => {
    expect(interpretar(ce3, respuesta(null, "refusal"))).toEqual({ error: "La IA no quiso leer estas hojas." });
  });

  // Mutación que la mata: no validar con el esquema (aceptar cualquier objeto).
  it("una salida de otra forma es error", () => {
    const otra = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 4)!);
    expect(interpretar(ce3, respuesta({ formulario: otra, dudas: [] }))).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
  });

  // Mutación que la mata: no llamar a imponerEstructura.
  it("una pregunta de menos es error", () => {
    const f = bueno();
    if (f.forma !== "OPCIONES") throw new Error();
    f.actividad.preguntas.pop();
    expect(interpretar(ce3, respuesta({ formulario: f, dudas: [] }))).toEqual({ error: "La IA leyó 5 preguntas y la tarea tiene 6." });
  });

  // Mutación que la mata: no normalizar "letra" antes de validar (el esquema, letra max 1, rechazaría "b." entero).
  it("la letra del ejemplo escrita «b.» se acepta y queda «B»", () => {
    const uno = reglaDe("A2_B1_ESCOLAR", "CE", 1)!;
    const f = formularioVacio(uno);
    if (f.forma !== "RELACIONAR") throw new Error();
    f.consigna = "Relaciona los mensajes.";
    f.actividad.ejemplo.letra = "b.";
    const r = interpretar(uno, respuesta({ formulario: f, dudas: [] }));
    if ("error" in r) throw new Error(r.error);
    if (r.formulario.forma !== "RELACIONAR") throw new Error();
    expect(r.formulario.actividad.ejemplo.letra).toBe("B");
  });

  // Mutación que la mata: devolver las dudas crudas sin filtrar.
  it("el caso bueno devuelve el formulario y las dudas filtradas con la de la consigna", () => {
    const r = interpretar(ce3, respuesta({ formulario: bueno(), dudas: [{ campo: "actividad.preguntas.0.enunciado", nota: "borroso" }, { campo: "nada", nota: "x" }] }));
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("Lee el texto.");
    expect(r.dudas.map((d) => d.clave)).toEqual(["consigna", "actividad.preguntas.0.enunciado"]);
  });
});
