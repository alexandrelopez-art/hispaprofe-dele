import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

const CORREO = "prueba@hispaprofe.com";

beforeEach(async () => {
  // El orden importa: una pieza sujeta a su fichero con Restrict, así que primero
  // se va el examen (que se lleva tareas y piezas en cascada) y después el fichero.
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.fichero.deleteMany();
});

describe("el modelo de la puerta", () => {
  it("no admite dos personas con el mismo correo", async () => {
    await prisma.persona.create({ data: { correo: CORREO, nombre: "Ana", papel: "ESTUDIANTE" } });
    await expect(
      prisma.persona.create({ data: { correo: CORREO, nombre: "Otra", papel: "ESTUDIANTE" } }),
    ).rejects.toThrow();
  });

  it("borrar a una persona se lleva sus enlaces y sus sesiones", async () => {
    const persona = await prisma.persona.create({
      data: { correo: CORREO, nombre: "Ana", papel: "ESTUDIANTE" },
    });
    await prisma.enlaceDeEntrada.create({
      data: { personaId: persona.id, secretoHuella: "a".repeat(64), expiraEn: new Date() },
    });
    await prisma.sesion.create({
      data: { personaId: persona.id, cookieHuella: "b".repeat(64), expiraEn: new Date() },
    });

    await prisma.persona.delete({ where: { id: persona.id } });

    expect(await prisma.enlaceDeEntrada.count()).toBe(0);
    expect(await prisma.sesion.count()).toBe(0);
  });

  it("no deja borrar un fichero que una pieza está usando", async () => {
    const fichero = await prisma.fichero.create({
      data: { almacen: "VERCEL", ruta: "examenes/1/pagina-1.jpg", tipoMime: "image/jpeg", bytes: 10 },
    });
    const examen = await prisma.examen.create({
      data: { titulo: "Modelo 0", nivel: "A2" },
    });
    const tarea = await prisma.tarea.create({
      data: { examenId: examen.id, prueba: "CE", numero: 1 },
    });
    await prisma.pieza.create({
      data: { tareaId: tarea.id, orden: 1, tipo: "IMAGEN", ficheroId: fichero.id },
    });

    await expect(prisma.fichero.delete({ where: { id: fichero.id } })).rejects.toThrow();
  });
});
