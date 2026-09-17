import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";

const AHORA = new Date("2026-09-20T09:00:00Z");

let ana: Persona;
let luis: Persona;
let examen: Examen;
let asignacion: Asignacion;

beforeEach(async () => {
  ({ ana, luis, examen } = await crearExamenDePruebas());
  asignacion = await prisma.asignacion.findFirstOrThrow();
});

describe("la tabla de escritos", () => {
  // Mutación que la mata: quitar @@unique([intentoId, tarea]). Sin ella, cada
  // guardado automático del borrador dejaría una fila nueva y la corrección no
  // sabría cuál es el texto bueno.
  it("una sola fila por tarea, y el texto se reescribe", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "EE" } });
    await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Hola", palabras: 1 } });
    await expect(
      prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Otra vez", palabras: 2 } }),
    ).rejects.toThrow();
    await prisma.escritoDeIntento.update({
      where: { intentoId_tarea: { intentoId: intento.id, tarea: 1 } },
      data: { texto: "Hola, qué tal", palabras: 3 },
    });
    // La tarea 2 del mismo intento sí, que es otra tarea.
    await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 2, texto: "", palabras: 0 } });
    expect(await prisma.escritoDeIntento.count()).toBe(2);
  });

  // Mutación que la mata: dar valor por defecto a `bandas` (por ejemplo [0,0,0,0])
  // o hacer `corregidaEn` no nulo. Un escrito recién guardado parecería corregido
  // con un cero, y saldría de la cola sin que nadie lo hubiera mirado.
  it("nace sin corregir", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "EE" } });
    const escrito = await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Hola", palabras: 1 } });
    expect(escrito.bandas).toEqual([]);
    expect(escrito.comentario).toBe("");
    expect(escrito.opcion).toBeNull();
    const leido = await prisma.intento.findUniqueOrThrow({ where: { id: intento.id } });
    expect(leido.corregidaEn).toBeNull();
    expect(leido.corregidaPorId).toBeNull();
  });

  // Mutación que la mata: poner onDelete: Restrict (o SetNull) en la relación con
  // Intento. Quitar una asignación dejaría escritos huérfanos apuntando a nada.
  it("los escritos se van con el intento", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "EE" } });
    await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Hola", palabras: 1 } });
    await prisma.intento.delete({ where: { id: intento.id } });
    expect(await prisma.escritoDeIntento.count()).toBe(0);
  });

  // Mutación que la mata: poner onDelete: Cascade en corregidaPor. Borrar al
  // profesor se llevaría por delante intentos y notas de los alumnos.
  it("borrar a quien corrigió no borra la corrección", async () => {
    const profe = await prisma.persona.create({ data: { correo: "profe@ejemplo.com", nombre: "Profe", papel: "PROFESOR" } });
    const intento = await prisma.intento.create({
      data: { asignacionId: asignacion.id, prueba: "EE", corregidaEn: new Date(), corregidaPorId: profe.id },
    });
    await prisma.persona.delete({ where: { id: profe.id } });
    const leido = await prisma.intento.findUniqueOrThrow({ where: { id: intento.id } });
    expect(leido.corregidaPorId).toBeNull();
    expect(leido.corregidaEn).not.toBeNull();
  });
});
