import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { darDeAlta } from "@/lib/puerta/personas";
import type { Persona } from "@/lib/generated/prisma";

let profesor: Persona;
let estudiante: Persona;

beforeEach(async () => {
  await prisma.persona.deleteMany();
  profesor = await prisma.persona.create({
    data: { correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR" },
  });
  estudiante = await prisma.persona.create({
    data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" },
  });
});

describe("dar de alta a una persona", () => {
  it("el profesor puede", async () => {
    const resultado = await darDeAlta(profesor, {
      correo: "Nuevo@Ejemplo.com",
      nombre: "Nuevo",
      papel: "ESTUDIANTE",
    });
    expect(resultado).toHaveProperty("persona");
    expect(await prisma.persona.count()).toBe(3);
  });

  it("guarda el correo en minúsculas, para que no entren dos veces la misma persona", async () => {
    await darDeAlta(profesor, { correo: "Nuevo@Ejemplo.com", nombre: "Nuevo", papel: "ESTUDIANTE" });
    expect(await prisma.persona.findUnique({ where: { correo: "nuevo@ejemplo.com" } })).not.toBeNull();
  });

  it("un estudiante no puede, y no crea nada", async () => {
    const resultado = await darDeAlta(estudiante, {
      correo: "otro@ejemplo.com",
      nombre: "Otro",
      papel: "ESTUDIANTE",
    });
    expect(resultado).toEqual({ error: "Solo el profesor puede dar de alta a alguien." });
    expect(await prisma.persona.count()).toBe(2);
  });

  it("no admite un correo repetido", async () => {
    const resultado = await darDeAlta(profesor, {
      correo: "ana@ejemplo.com",
      nombre: "Ana otra vez",
      papel: "ESTUDIANTE",
    });
    expect(resultado).toEqual({ error: "Ese correo ya está dado de alta." });
  });

  it("no admite un correo sin arroba", async () => {
    const resultado = await darDeAlta(profesor, { correo: "ana", nombre: "Ana", papel: "ESTUDIANTE" });
    expect(resultado).toEqual({ error: "Eso no parece una dirección de correo." });
  });
});
