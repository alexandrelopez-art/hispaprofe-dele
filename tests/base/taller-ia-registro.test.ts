import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { apuntarLlamada, gastoDelExamen } from "@/lib/taller/ia/registro";
import { SIN_USO } from "@/lib/taller/ia/coste";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

async function unExamen() {
  const r = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in r) throw new Error(r.error);
  return r.id;
}

const USO = { entrada: 10_000, cacheLeidos: 20_000, cacheEscritos: 4_000, salida: 3_000 };

describe("el registro de llamadas a la IA", () => {
  // Mutación que la mata: no guardar costeMilesimasDeDolar (poner 0).
  it("apunta una llamada buena con sus tokens y su coste", async () => {
    const examenId = await unExamen();
    await apuntarLlamada({ examenId, prueba: "CE", numero: 3, modelo: "claude-opus-5", uso: USO, milisegundos: 1234, error: null });
    const [fila] = await prisma.llamadaDeIA.findMany();
    expect(fila).toMatchObject({
      prueba: "CE", numero: 3, modelo: "claude-opus-5", resultado: "OK", error: null,
      tokensEntrada: 10_000, tokensCacheLeidos: 20_000, tokensCacheEscritos: 4_000, tokensSalida: 3_000,
      costeMilesimasDeDolar: 160, milisegundos: 1234,
    });
  });

  // Mutación que la mata: poner resultado "OK" siempre.
  it("una llamada con error queda como ERROR con su mensaje", async () => {
    const examenId = await unExamen();
    await apuntarLlamada({ examenId, prueba: "CO", numero: 1, modelo: "claude-opus-5", uso: SIN_USO, milisegundos: 5, error: "La IA no responde ahora." });
    const [fila] = await prisma.llamadaDeIA.findMany();
    expect(fila.resultado).toBe("ERROR");
    expect(fila.error).toBe("La IA no responde ahora.");
  });

  // Mutación que la mata: sumar las llamadas de todos los exámenes (quitar el where).
  it("el gasto suma solo las llamadas de ese examen", async () => {
    const a = await unExamen();
    const b = await unExamen();
    await apuntarLlamada({ examenId: a, prueba: "CE", numero: 1, modelo: "m", uso: USO, milisegundos: 1, error: null });
    await apuntarLlamada({ examenId: a, prueba: "CE", numero: 2, modelo: "m", uso: USO, milisegundos: 1, error: "x" });
    await apuntarLlamada({ examenId: b, prueba: "CE", numero: 1, modelo: "m", uso: USO, milisegundos: 1, error: null });
    expect(await gastoDelExamen(a)).toEqual({ llamadas: 2, milesimas: 320 });
  });

  // Mutación que la mata: devolver milesimas null cuando no hay filas.
  it("sin llamadas el gasto es cero", async () => {
    expect(await gastoDelExamen(await unExamen())).toEqual({ llamadas: 0, milesimas: 0 });
  });

  // Mutación que la mata: onDelete Restrict en LlamadaDeIA.examen.
  it("borrar el examen se lleva sus llamadas", async () => {
    const examenId = await unExamen();
    await apuntarLlamada({ examenId, prueba: "CE", numero: 1, modelo: "m", uso: USO, milisegundos: 1, error: null });
    await prisma.examen.delete({ where: { id: examenId } });
    expect(await prisma.llamadaDeIA.count()).toBe(0);
  });
});
