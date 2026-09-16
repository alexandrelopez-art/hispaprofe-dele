import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

const TOPE = finDelDiaEnMadrid("2026-10-20")!;

let ana: Persona;
let examen: Examen;
let asignacion: Asignacion;

beforeEach(async () => {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  examen = await prisma.examen.create({ data: { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
  asignacion = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
});

describe("la tabla de intentos", () => {
  // Mutación que la mata: quitar @@unique([asignacionId, prueba]). Sin ella, dos
  // clics seguidos en «Empezar» dejan dos intentos y el reloj arranca dos veces.
  it("no admite dos intentos de la misma prueba", async () => {
    await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    await expect(prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } })).rejects.toThrow();
    // La otra prueba del mismo examen sí, que son intentos distintos.
    await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CO" } });
    expect(await prisma.intento.count()).toBe(2);
  });

  // Mutación que la mata: dar valor por defecto a aciertos/total, o hacerlos no nulos.
  it("nace sin entregar y sin nota", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    expect(intento.entregadaEn).toBeNull();
    expect(intento.aciertos).toBeNull();
    expect(intento.total).toBeNull();
    expect(intento.fallos).toEqual([]);
    expect(intento.porTiempo).toBe(false);
    expect(intento.empezadaEn).toBeInstanceOf(Date);
  });

  // Mutación que la mata: quitar @@unique([intentoId, numero]); el estudiante
  // cambiaría de opinión y quedarían dos letras para la misma pregunta.
  it("una sola letra por pregunta, y se puede cambiar", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    await prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 7, letra: "A" } });
    await expect(
      prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 7, letra: "B" } }),
    ).rejects.toThrow();
    await prisma.respuestaDeIntento.update({ where: { intentoId_numero: { intentoId: intento.id, numero: 7 } }, data: { letra: "B" } });
    const guardadas = await prisma.respuestaDeIntento.findMany();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]!.letra).toBe("B");
  });

  // Mutación que la mata: quitar @@unique([intentoId, tarea, trozo]). Es el
  // candado que impide que un trozo suene dos veces.
  it("un trozo oído no se apunta dos veces, y los de otra tarea no chocan", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CO" } });
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 1, trozo: 1 } });
    await expect(prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 1, trozo: 1 } })).rejects.toThrow();
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 2, trozo: 1 } });
    expect(await prisma.trozoOido.count()).toBe(2);
  });

  // Mutación que la mata: poner onDelete Restrict en la asignación. Con Cascade,
  // borrar la asignación se lleva la nota — y por eso la Task 4 impide borrarla.
  it("borrar la asignación se lleva el intento entero", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    await prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 1, letra: "A" } });
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 1, trozo: 1 } });
    await prisma.asignacion.delete({ where: { id: asignacion.id } });
    expect(await prisma.intento.count()).toBe(0);
    expect(await prisma.respuestaDeIntento.count()).toBe(0);
    expect(await prisma.trozoOido.count()).toBe(0);
  });
});
