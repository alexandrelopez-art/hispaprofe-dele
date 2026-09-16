import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";

const AHORA = new Date("2026-09-20T09:00:00Z");

let ana: Persona;
let luis: Persona;
let examen: Examen;

beforeEach(async () => {
  ({ ana, luis, examen } = await crearExamenDePruebas());
});

describe("leer una prueba para hacerla", () => {
  // Mutación que la mata: devolver la tarea leída de la base tal cual, con su
  // `clave` incluida. Es LA prueba de esta entrega: la respuesta correcta no
  // puede llegar al navegador de quien está haciendo el examen.
  it("no devuelve ni un solo campo con las respuestas correctas", async () => {
    const leido = await pruebaParaHacer(examen.id, "CE", ana.id, AHORA);
    expect(leido).not.toBeNull();
    const prohibidos: string[] = [];
    const mirar = (valor: unknown, camino: string) => {
      if (Array.isArray(valor)) return valor.forEach((v, i) => mirar(v, `${camino}[${i}]`));
      if (valor && typeof valor === "object") {
        for (const [k, v] of Object.entries(valor)) {
          if (k === "clave" || k === "respuestasCorrectas" || k === "soluciones") prohibidos.push(`${camino}.${k}`);
          mirar(v, `${camino}.${k}`);
        }
      }
    };
    mirar(leido, "prueba");
    expect(prohibidos).toEqual([]);
    // Y las claves existen de verdad en la base (la de CE y la de CO del
    // montaje): si no, esta prueba no probaría nada.
    expect(await prisma.clave.count()).toBe(2);
  });

  // Mutación que la mata: dejar de filtrar por asignación. Cualquiera con sesión
  // podría abrir el examen de otro escribiendo su identificador.
  it("solo lo lee quien lo tiene asignado, y solo si está publicado", async () => {
    expect(await pruebaParaHacer(examen.id, "CE", luis.id, AHORA)).toBeNull();
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "EN_CONSTRUCCION" } });
    expect(await pruebaParaHacer(examen.id, "CE", ana.id, AHORA)).toBeNull();
  });

  // Mutación que la mata: aceptar cualquier prueba. La escrita y la oral no
  // tienen pantalla hasta la 3d y la 3e.
  it("la escrita y la oral todavía no", async () => {
    expect(await pruebaParaHacer(examen.id, "EE", ana.id, AHORA)).toBeNull();
    expect(await pruebaParaHacer(examen.id, "EO", ana.id, AHORA)).toBeNull();
  });

  // Mutación que la mata: no traer los minutos de `minutosDePrueba`, ni el
  // modo de la asignación, ni la regla de la propia tarea (p. ej. adjuntar
  // siempre `reglaDe(nivel, prueba, 1)` en vez de la de cada tarea leída).
  it("trae la tarea guardada con su regla, su formulario y los minutos de la prueba", async () => {
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, AHORA))!;
    expect(leido.minutos).toBe(50);
    expect(leido.modo).toBe("COMPLETO");
    expect(leido.tareas.map((t) => t.numero)).toEqual([2]);
    expect(leido.tareas[0]!.regla.forma).toBe("LISTA_COMUN");
    expect(leido.tareas[0]!.formulario.consigna).toBe("Lee los textos.");
    expect(leido.tareas[0]!.trozos).toBe(0);
    expect(leido.estado.estado).toBe("SIN_EMPEZAR");
    expect(leido.segundosQueQuedan).toBeNull();
  });

  // Mutación que la mata: calcular los segundos desde «ahora» en vez de desde
  // que empezó, o no devolver lo que ya lleva marcado.
  it("con la prueba empezada trae el reloj y lo que lleva marcado", async () => {
    const asignacion = await prisma.asignacion.findFirstOrThrow();
    const intento = await prisma.intento.create({
      data: { asignacionId: asignacion.id, prueba: "CE", empezadaEn: AHORA },
    });
    await prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 8, letra: "B" } });

    const diezMinutosDespues = new Date(AHORA.getTime() + 10 * 60_000);
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, diezMinutosDespues))!;
    expect(leido.estado.estado).toBe("HACIENDO");
    expect(leido.segundosQueQuedan).toBe(40 * 60);
    expect(leido.respuestas).toEqual({ "8": "B" });
  });

  // Mutación que la mata: no leer los trozos oídos; la cinta los volvería a poner.
  it("trae los trozos que ya han sonado", async () => {
    const asignacion = await prisma.asignacion.findFirstOrThrow();
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE", empezadaEn: AHORA } });
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 2, trozo: 1 } });
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, AHORA))!;
    expect(leido.tareas[0]!.oidos).toEqual([1]);
  });

  // Mutación que la mata: quitar `where: { prueba }` al leer las tareas del
  // examen. El montaje guarda una tarea de lectura (CE, numero 2) y una de
  // auditiva (CO, numero 3): sin el filtro, la auditiva se colaría en la
  // lectura. Con una sola tarea guardada esto no se vería: hacen falta las dos.
  it("no trae tareas de otra prueba", async () => {
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, AHORA))!;
    expect(leido.tareas.map((t) => t.numero)).toEqual([2]);
  });
});
