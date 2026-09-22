import { describe, it, expect, beforeEach, vi } from "vitest";
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
  await prisma.persona.create({
    data: { correo: "berta@ejemplo.com", nombre: "Berta", papel: "ESTUDIANTE" },
  });
});

describe("pedir un enlace", () => {
  it("manda un correo con un enlace que sirve", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(1);
    expect(buzon[0].a).toBe("ana@ejemplo.com");
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    expect(resultado).toHaveProperty("cookie");
    // Esta prueba sola no basta contra "devolver siempre ESTUDIANTE": Ana ya
    // es estudiante. La prueba de abajo, con un profesor, es la que mata esa
    // mutación de verdad.
    expect((resultado as { papel: string }).papel).toBe("ESTUDIANTE");
  });

  // Mutación que la mata: devolver siempre "ESTUDIANTE" en vez del papel real
  // de la persona del enlace. Con Marta (profesora) la mutación se nota: la
  // prueba de arriba sola no la habría cazado, porque Ana ya es estudiante.
  it("el enlace de un profesor trae su papel, no ESTUDIANTE a secas", async () => {
    await prisma.persona.create({
      data: { correo: "marta@ejemplo.com", nombre: "Marta", papel: "PROFESOR" },
    });
    await pedirEnlace("marta@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    expect((resultado as { papel: string }).papel).toBe("PROFESOR");
  });

  it("con un correo que no existe no manda nada y no deja rastro (en la respuesta)", async () => {
    await pedirEnlace("nadie@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(0);
    expect(await prisma.enlaceDeEntrada.count()).toBe(0);
  });

  // Los tres motivos de vuelta en silencio son indistinguibles desde fuera a
  // propósito, pero tienen que dejar rastro en el registro del servidor:
  // sin esto, cuando un estudiante diga «no me llega nada» no hay forma de
  // saber cuál de los tres pasó. Mutación que mata cada una de estas tres
  // pruebas: quitar su console.warn correspondiente.
  it("con un correo que no existe, se registra en el servidor sin la dirección completa", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await pedirEnlace("nadie@ejemplo.com", AHORA, mandar, BASE);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("no dado de alta"));
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("ejemplo.com"));
    expect(aviso).not.toHaveBeenCalledWith(expect.stringContaining("nadie@ejemplo.com"));
    aviso.mockRestore();
  });

  it("con una persona dada de baja no manda nada", async () => {
    await prisma.persona.update({ where: { correo: "ana@ejemplo.com" }, data: { activa: false } });
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(0);
  });

  it("con una persona dada de baja, se registra en el servidor con su id, no su correo", async () => {
    const ana = await prisma.persona.update({
      where: { correo: "ana@ejemplo.com" },
      data: { activa: false },
    });
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("inactiva"));
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining(ana.id));
    expect(aviso).not.toHaveBeenCalledWith(expect.stringContaining("ana@ejemplo.com"));
    aviso.mockRestore();
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

  it("al frenar la sexta petición, se registra en el servidor con su id, no su correo", async () => {
    const ana = await prisma.persona.findUniqueOrThrow({ where: { correo: "ana@ejemplo.com" } });
    for (let i = 0; i < 5; i++) await pedirEnlace("ana@ejemplo.com", minutos(-i), mandar, BASE);
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("límite de peticiones"));
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining(ana.id));
    expect(aviso).not.toHaveBeenCalledWith(expect.stringContaining("ana@ejemplo.com"));
    aviso.mockRestore();
  });

  it("si el envío de correo falla, no revienta y no delata que el correo existe", async () => {
    const mandarQueFalla = async () => {
      throw new Error("SMTP caído");
    };
    await expect(
      pedirEnlace("ana@ejemplo.com", AHORA, mandarQueFalla, BASE),
    ).resolves.toBeUndefined();
  });
});

describe("usar un enlace", () => {
  it("no se puede usar dos veces", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const secreto = secretoDelUltimo();
    await usarEnlace(secreto, minutos(1));
    expect(await usarEnlace(secreto, minutos(2))).toEqual({ error: "usado" });
  });

  it("usado a la vez por partida doble solo abre una sesión", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const secreto = secretoDelUltimo();

    const resultados = await Promise.all([
      usarEnlace(secreto, minutos(1)),
      usarEnlace(secreto, minutos(1)),
    ]);

    expect(resultados.filter((r) => "cookie" in r)).toHaveLength(1);
    expect(resultados.filter((r) => "error" in r && r.error === "usado")).toHaveLength(1);
  });

  it("no vale pasados quince minutos", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(await usarEnlace(secretoDelUltimo(), minutos(16))).toEqual({ error: "caducado" });
  });

  it("un secreto inventado no abre nada", async () => {
    expect(await usarEnlace("inventado", AHORA)).toEqual({ error: "desconocido" });
    expect(await prisma.sesion.count()).toBe(0);
  });

  it("una persona dada de baja no puede usar su enlace", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const secreto = secretoDelUltimo();
    await prisma.persona.update({ where: { correo: "ana@ejemplo.com" }, data: { activa: false } });
    expect(await usarEnlace(secreto, minutos(1))).toEqual({ error: "desconocido" });
  });

  it("al gastar un enlace, los demás enlaces vivos de la misma persona dejan de servir", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const secretoUno = secretoDelUltimo();
    await pedirEnlace("ana@ejemplo.com", minutos(1), mandar, BASE);
    const secretoDos = secretoDelUltimo();

    await usarEnlace(secretoDos, minutos(2));

    expect(await usarEnlace(secretoUno, minutos(3))).toEqual({ error: "usado" });
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

  it("una cookie pertenece a quien pidió el enlace, no a otra persona", async () => {
    await pedirEnlace("berta@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    const cookie = (resultado as { cookie: string }).cookie;

    expect((await personaDeLaCookie(cookie, minutos(2)))?.correo).toBe("berta@ejemplo.com");
  });

  it("una persona dada de baja deja de reconocerse aunque tenga cookie", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    const cookie = (resultado as { cookie: string }).cookie;

    await prisma.persona.update({ where: { correo: "ana@ejemplo.com" }, data: { activa: false } });

    expect(await personaDeLaCookie(cookie, minutos(2))).toBeNull();
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
