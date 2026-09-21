import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Igual que en tests/taller-ia-interpretar.test.ts: interpretar es pura, pero
// rellenar.ts exporta también rellenarTarea, que importa "@/lib/db" a nivel
// de módulo y sin esto exigiría DATABASE_URL para cargar el fichero.
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { ESTRUCTURAS, type ReglaTarea } from "@/lib/dele/estructura";
import { encargoDeTarea, type Hoja } from "@/lib/taller/ia/encargo";
import { interpretar } from "@/lib/taller/ia/rellenar";
import { crearLectorLocal, MODELO_LOCAL, type SesionDeLectura } from "@/lib/taller/ocr/proveedor";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;
const CE = (numero: number): ReglaTarea => ESCOLAR.CE.find((r) => r.numero === numero)!;

function textoDeAyuda(nombre: string): string {
  return readFileSync(path.join(process.cwd(), "tests/ayudas/ocr-formas", nombre), "utf-8");
}

/** Una sesión que no llama a tesseract: devuelve el texto preparado, una hoja por vez. */
function sesionFalsa(textos: readonly string[]): { abrir: () => Promise<SesionDeLectura>; cerradas: () => number } {
  let cerradas = 0;
  let i = 0;
  return {
    abrir: async () => ({
      reconocer: async () => textos[i++] ?? "",
      cerrar: async () => {
        cerradas++;
      },
    }),
    cerrar: undefined as never,
    cerradas: () => cerradas,
  } as { abrir: () => Promise<SesionDeLectura>; cerradas: () => number };
}

const HOJA: Hoja = { datos: "", tipo: "image/jpeg" };

describe("crearLectorLocal", () => {
  it("devuelve lo que interpretar() sabe validar, sin pasar por ninguna API", async () => {
    const regla = CE(4); // huecos
    const { abrir } = sesionFalsa([textoDeAyuda("ce4-huecos-vocacion.txt")]);
    const encargo = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla, [HOJA]);

    const respuesta = await crearLectorLocal(abrir)(encargo);

    expect(respuesta.modelo).toBe(MODELO_LOCAL);
    // El lector local no gasta tokens: el registro de coste tiene que quedar a cero.
    expect(respuesta.uso).toEqual({ entrada: 0, cacheLeidos: 0, cacheEscritos: 0, salida: 0 });
    const resultado = interpretar(regla, respuesta);
    expect(resultado).not.toHaveProperty("error");
    if ("error" in resultado) return;
    expect(resultado.formulario.forma).toBe("HUECOS");
    if (resultado.formulario.forma !== "HUECOS") return;
    // Los siete huecos de la tarea 4, con su texto leído de verdad.
    expect(resultado.formulario.actividad.huecos).toHaveLength(7);
    expect(resultado.formulario.actividad.texto).toContain("vocación");
  });

  it("junta las hojas de la tarea en un solo texto antes de leerlo", async () => {
    const regla = CE(3); // opciones
    const { abrir } = sesionFalsa(["TAREA 3\nInstrucciones\n", textoDeAyuda("ce3-opciones.txt")]);
    const encargo = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla, [HOJA, HOJA]);

    const resultado = interpretar(regla, await crearLectorLocal(abrir)(encargo));

    expect(resultado).not.toHaveProperty("error");
    if ("error" in resultado) return;
    if (resultado.formulario.forma !== "OPCIONES") return;
    expect(resultado.formulario.actividad.preguntas).toHaveLength(6);
  });

  it("cierra el worker aunque el lector de forma reviente, para no dejarlo vivo", async () => {
    const regla = CE(4);
    const { abrir, cerradas } = sesionFalsa([]);
    const encargo = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla, [HOJA]);

    await crearLectorLocal(abrir)(encargo).catch(() => undefined);

    expect(cerradas()).toBe(1);
  });
});
