import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

const TOPE = finDelDiaEnMadrid("2026-10-20")!;

let profesor: Persona;
let ana: Persona;
let examen: Examen;

beforeEach(async () => {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  profesor = await prisma.persona.create({ data: { correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR" } });
  ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  examen = await prisma.examen.create({ data: { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
});

describe("la tabla de asignaciones", () => {
  // Mutación que la mata: quitar @@unique([examenId, personaId]). Sin ella, dos
  // clics seguidos en Asignar dejan dos filas y el estudiante recibe dos avisos.
  it("no admite dos veces el mismo examen a la misma persona", async () => {
    await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE, asignadaPorId: profesor.id } });
    await expect(
      prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE, asignadaPorId: profesor.id } }),
    ).rejects.toThrow();
    expect(await prisma.asignacion.count()).toBe(1);
  });

  // Mutación que la mata: poner el modo sin valor por defecto, o por defecto LIBRE.
  it("el modo nace en completo", async () => {
    const creada = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    expect(creada.modo).toBe("COMPLETO");
    expect(creada.asignadaPorId).toBeNull();
  });

  // Mutación que la mata: cambiar el onDelete de Cascade a Restrict en examen o
  // persona; borrar un examen dejaría asignaciones apuntando al vacío.
  it("borrar el examen se lleva sus asignaciones", async () => {
    await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    await prisma.examen.delete({ where: { id: examen.id } });
    expect(await prisma.asignacion.count()).toBe(0);
  });
});
