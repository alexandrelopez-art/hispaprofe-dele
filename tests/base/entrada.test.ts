import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { pedirEnlace, usarEnlace, personaDeLaCookie, cerrarSesion } from "@/lib/puerta/entrada";
import type { Mensaje } from "@/lib/correo/mensaje";

const AHORA = new Date("2026-09-10T12:00:00Z");
const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);
const BASE = "https://hispaprofe.com";

let buzon: Mensaje[] = [];
const mandar = async (mensaje: Mensaje) => {
  buzon.push(mensaje);
};
const secretoDelUltimo = () => buzon.at(-1)!.texto.split(`${BASE}/entrar/`)[1].split("\n")[0];

beforeEach(async () => {
  buzon = [];
  await prisma.persona.deleteMany();
  await prisma.persona.create({
    data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" },
  });
});

describe("pedir un enlace", () => {
  it("manda un correo con un enlace que sirve", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(1);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    expect(resultado).toHaveProperty("cookie");
  });

  it("con un correo que no existe no manda nada y no deja rastro", async () => {
    await pedirEnlace("nadie@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(0);
    expect(await prisma.enlaceDeEntrada.count()).toBe(0);
  });

  it("con una persona dada de baja no manda nada", async () => {
    await prisma.persona.update({ where: { correo: "ana@ejemplo.com" }, data: { activa: false } });
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(0);
  });

  it("no distingue mayúsculas ni espacios al final", async () => {
    await pedirEnlace("  Ana@Ejemplo.com ", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(1);
  });

  it("frena a la sexta petición seguida", async () => {
    for (let i = 0; i < 5; i++) await pedirEnlace("ana@ejemplo.com", minutos(-i), mandar, BASE);
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(5);
  });
});

describe("usar un enlace", () => {
  it("no se puede usar dos veces", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const secreto = secretoDelUltimo();
    await usarEnlace(secreto, minutos(1));
    expect(await usarEnlace(secreto, minutos(2))).toEqual({ error: "usado" });
  });

  it("no vale pasados quince minutos", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(await usarEnlace(secretoDelUltimo(), minutos(16))).toEqual({ error: "caducado" });
  });

  it("un secreto inventado no abre nada", async () => {
    expect(await usarEnlace("inventado", AHORA)).toEqual({ error: "desconocido" });
    expect(await prisma.sesion.count()).toBe(0);
  });
});

describe("la sesión", () => {
  it("reconoce a la persona mientras dura, y deja de hacerlo al caducar", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    const cookie = (resultado as { cookie: string }).cookie;

    expect((await personaDeLaCookie(cookie, minutos(2)))?.correo).toBe("ana@ejemplo.com");
    expect(await personaDeLaCookie(cookie, minutos(60 * 24 * 31))).toBeNull();
  });

  it("al salir, la cookie deja de valer y la fila desaparece", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    const cookie = (resultado as { cookie: string }).cookie;

    await cerrarSesion(cookie);

    expect(await personaDeLaCookie(cookie, minutos(2))).toBeNull();
    expect(await prisma.sesion.count()).toBe(0);
  });
});
