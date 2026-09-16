import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { empezarPrueba, guardarRespuesta, marcarTrozo, entregarPrueba, cerrarLasQueSePasaron, corregirEnLibre } from "@/lib/examen/hacer";
import { crearExamenDePruebas, CLAVE_INVENTADA } from "../ayudas/examen-de-pruebas";

const AHORA = new Date("2026-09-20T09:00:00Z");

let ana: Persona;
let luis: Persona;
let examen: Examen;
let asignacion: Asignacion;

beforeEach(async () => {
  ({ ana, luis, examen } = await crearExamenDePruebas());
  asignacion = await prisma.asignacion.findFirstOrThrow();
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

describe("hacer la prueba", () => {
  // Mutación que la mata: cambiar el upsert por un create, o no comprobar el
  // intento que ya existe: el reloj arrancaría de nuevo y regalaría 50 minutos.
  it("empezar dos veces no reinicia el reloj", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await empezarPrueba(examen.id, "CE", ana.id, new Date(AHORA.getTime() + 20 * 60_000));
    const intentos = await prisma.intento.findMany();
    expect(intentos).toHaveLength(1);
    expect(intentos[0]!.empezadaEn.toISOString()).toBe(AHORA.toISOString());
  });

  // Mutación que la mata: dejar de comprobar la asignación.
  it("no empieza quien no lo tiene asignado", async () => {
    expect(await empezarPrueba(examen.id, "CE", luis.id, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    expect(await prisma.intento.count()).toBe(0);
  });

  // Mutación que la mata: guardar sin mirar el reloj del servidor. El navegador
  // no es de fiar: es el sitio donde el estudiante puede tocar la hora.
  it("una respuesta tardía no se guarda y cierra la prueba", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    expect(await guardarRespuesta(examen.id, "CE", ana.id, 8, "B", tarde)).toEqual({ error: "Se acabó el tiempo." });
    expect(await prisma.respuestaDeIntento.count()).toBe(0);
    const intento = await prisma.intento.findFirstOrThrow();
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.porTiempo).toBe(true);
  });

  // Mutación que la mata: quitar los diez segundos de gracia.
  it("dentro de la gracia todavía entra", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    const justo = new Date(AHORA.getTime() + 50 * 60_000 + 5_000);
    expect(await guardarRespuesta(examen.id, "CE", ana.id, 8, "B", justo)).toEqual({});
    expect(await prisma.respuestaDeIntento.count()).toBe(1);
  });

  // Mutación que la mata: dejar escribir sobre una prueba entregada.
  it("una prueba entregada no admite ni una letra más", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await entregarPrueba(examen.id, "CE", ana.id, AHORA, false);
    expect(await guardarRespuesta(examen.id, "CE", ana.id, 8, "B", AHORA)).toEqual({ error: "Esta prueba ya está entregada." });
    expect(await empezarPrueba(examen.id, "CE", ana.id, AHORA)).toEqual({ error: "Esta prueba ya está entregada." });
  });

  // Mutación que la mata: borrar y reescribir el trozo en vez de no tocarlo.
  // Contar filas no basta —borrar y crear también deja una sola fila—, así
  // que se comprueba que sigue siendo LA MISMA fila (mismo id).
  it("marcar un trozo dos veces no lo devuelve", async () => {
    await empezarPrueba(examen.id, "CO", ana.id, AHORA);
    expect(await marcarTrozo(examen.id, "CO", ana.id, 3, 1, AHORA)).toEqual({});
    const primero = await prisma.trozoOido.findFirstOrThrow();
    expect(await marcarTrozo(examen.id, "CO", ana.id, 3, 1, AHORA)).toEqual({});
    const oidos = await prisma.trozoOido.findMany();
    expect(oidos).toHaveLength(1);
    expect(oidos[0]!.id).toBe(primero.id);
  });

  // Mutación que la mata: calcular la nota al leer el resultado en vez de al
  // entregar. Corregir una tarea después no puede cambiarle la nota a nadie.
  it("la nota y los fallos se congelan al entregar", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await guardarRespuesta(examen.id, "CE", ana.id, 7, CLAVE_INVENTADA["7"], AHORA);
    await guardarRespuesta(examen.id, "CE", ana.id, 8, "Z", AHORA);
    await entregarPrueba(examen.id, "CE", ana.id, AHORA, false);

    const antes = await prisma.intento.findFirstOrThrow();
    expect(antes.aciertos).toBe(1);
    expect(antes.total).toBe(6);
    expect(antes.fallos).toEqual([8, 9, 10, 11, 12]);

    await prisma.clave.deleteMany();
    const despues = await prisma.intento.findFirstOrThrow();
    expect(despues.aciertos).toBe(1);
    expect(despues.fallos).toEqual([8, 9, 10, 11, 12]);
  });

  // Mutación que la mata: no cerrar las pasadas de hora al mirar. Quien cierre el
  // portátil a mitad se quedaría «a medias» para siempre y sin nota.
  it("al mirar, la que se pasó de hora queda entregada por tiempo", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await cerrarLasQueSePasaron({ personaId: ana.id }, new Date(AHORA.getTime() + 51 * 60_000));
    const intento = await prisma.intento.findFirstOrThrow();
    expect(intento.porTiempo).toBe(true);
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.total).toBe(6);
  });

  // Mutación que la mata: cerrar también las que van en hora.
  it("al mirar, la que va en hora no se toca", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await cerrarLasQueSePasaron({ personaId: ana.id }, new Date(AHORA.getTime() + 10 * 60_000));
    expect((await prisma.intento.findFirstOrThrow()).entregadaEn).toBeNull();
  });

  // Mutación que la mata: guardar algo en modo libre, o devolver la letra buena.
  it("corregir en libre no guarda nada y no dice la buena", async () => {
    await prisma.asignacion.updateMany({ where: { personaId: ana.id }, data: { modo: "LIBRE" } });
    const nota = await corregirEnLibre(examen.id, "CE", ana.id, { "7": CLAVE_INVENTADA["7"], "8": "Z" });
    expect(nota).toMatchObject({ aciertos: 1, total: 6 });
    expect(JSON.stringify(nota)).not.toContain(CLAVE_INVENTADA["8"]);
    expect(await prisma.intento.count()).toBe(0);
  });
});
