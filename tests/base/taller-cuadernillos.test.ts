// tests/base/taller-cuadernillos.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { elegirCuadernillo, guardarCuadernillo, listarCuadernillos } from "@/lib/taller/cuadernillos";
import { ANCHO, lineasDeExamen, paginaDeSoluciones } from "../ayudas/cuadernillo-inventado";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
});

const TROZOS = paginaDeSoluciones(21, lineasDeExamen(1), lineasDeExamen(2));

describe("guardar un cuadernillo", () => {
  // Mutación que la mata: guardar `datos.titulo` sin `.trim()`.
  it("guarda el texto y las soluciones, y se lista con sus exámenes", async () => {
    const r = await guardarCuadernillo({ titulo: " Libro inventado ", trozos: TROZOS });
    if ("error" in r) throw new Error(r.error);
    const guardado = await prisma.cuadernillo.findUniqueOrThrow({ where: { id: r.id } });
    expect(guardado.titulo).toBe("Libro inventado");
    expect(guardado.texto).toContain("SOLUCIONES");
    expect(await listarCuadernillos()).toEqual([{ id: r.id, titulo: "Libro inventado", examenes: ["1", "2"] }]);
  });

  // Mutación que la mata: guardar aunque leerSoluciones no encuentre nada.
  it("un PDF sin tabla de soluciones no se guarda", async () => {
    const trozos = [{ pagina: 1, x: 50, y: 700, texto: "Transcripciones", anchoPagina: ANCHO }];
    expect(await guardarCuadernillo({ titulo: "X", trozos })).toEqual({ error: "No encuentro la tabla de SOLUCIONES en ese PDF." });
    expect(await prisma.cuadernillo.count()).toBe(0);
  });

  // Mutación que la mata: quitar la comprobación `if (!texto) return { error: ... }`.
  it("un PDF sin texto, un título vacío y unos trozos manipulados", async () => {
    expect(await guardarCuadernillo({ titulo: "X", trozos: [] })).toEqual({ error: "Ese PDF no tiene texto: parece un escaneo." });
    expect(await guardarCuadernillo({ titulo: " ", trozos: TROZOS })).toEqual({ error: "El cuadernillo necesita un título." });
    expect(await guardarCuadernillo({ titulo: "X", trozos: [{ pagina: 1 }] })).toHaveProperty("error");
    expect(await prisma.cuadernillo.count()).toBe(0);
  });
});

describe("elegir el cuadernillo de un examen", () => {
  async function preparar() {
    const c = await guardarCuadernillo({ titulo: "Libro", trozos: TROZOS });
    const e = await crearExamen({ titulo: "Examen", nivel: "A2_B1_ESCOLAR" });
    if ("error" in c || "error" in e) throw new Error();
    return { cuadernilloId: c.id, examenId: e.id };
  }

  // Mutación que la mata: en el update final, no escribir `numeroEnCuadernillo: numero` (dejarlo solo con `cuadernilloId`).
  it("elige cuadernillo y número", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo(examenId, cuadernilloId, 2)).toEqual({});
    expect(await prisma.examen.findUniqueOrThrow({ where: { id: examenId } })).toMatchObject({ cuadernilloId, numeroEnCuadernillo: 2 });
  });

  // Mutación que la mata: no comprobar que el número existe en las soluciones.
  it("un número que el cuadernillo no trae rebota", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo(examenId, cuadernilloId, 7)).toEqual({ error: "El cuadernillo no trae el examen 7." });
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examenId } })).cuadernilloId).toBeNull();
  });

  // Mutación que la mata: en la rama `cuadernilloId === null`, no borrar `numeroEnCuadernillo` (dejarlo solo con `cuadernilloId: null`).
  it("sin número todavía vale, y quitar el cuadernillo quita también el número", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo(examenId, cuadernilloId, null)).toEqual({});
    await elegirCuadernillo(examenId, cuadernilloId, 1);
    expect(await elegirCuadernillo(examenId, null, 1)).toEqual({});
    expect(await prisma.examen.findUniqueOrThrow({ where: { id: examenId } })).toMatchObject({ cuadernilloId: null, numeroEnCuadernillo: null });
  });

  // Mutación que la mata: quitar la comprobación `if (!examen) return { error: "Ese examen no existe." }`.
  it("un examen o un cuadernillo que no existen", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo("no-existe", cuadernilloId, 1)).toEqual({ error: "Ese examen no existe." });
    expect(await elegirCuadernillo(examenId, "no-existe", 1)).toEqual({ error: "Ese cuadernillo no existe." });
  });
});
