import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";
import { empezarPrueba, guardarEscrito, entregarPrueba } from "@/lib/examen/hacer";
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
    // Y las claves existen de verdad en la base, de ESTE examen (la de CE y la
    // de CO del montaje): si no, esta prueba no probaría nada. Contadas por su
    // examen, no la tabla entera: que otra fixture cambie cuántas Clave hay en
    // total no puede colar esta prueba en verde por accidente.
    const clavesDelExamen = await prisma.clave.count({
      where: { actividad: { pieza: { tarea: { examenId: examen.id } } } },
    });
    expect(clavesDelExamen).toBe(2);
  });

  // Dos mutaciones, una por línea, porque la prueba comprueba las dos cosas:
  // 1) dejar de filtrar por asignación — cualquiera con sesión podría abrir el
  //    examen de otro escribiendo su identificador;
  // 2) quitar la comprobación de `estado !== "PUBLICADO"` — un examen que el
  //    profesor retiró para tocarlo se seguiría pudiendo hacer, cambiando por
  //    debajo mientras alguien lo contesta.
  it("solo lo lee quien lo tiene asignado, y solo si está publicado", async () => {
    expect(await pruebaParaHacer(examen.id, "CE", luis.id, AHORA)).toBeNull();
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "EN_CONSTRUCCION" } });
    expect(await pruebaParaHacer(examen.id, "CE", ana.id, AHORA)).toBeNull();
  });

  // Mutación que la mata: aceptar cualquier prueba. La oral todavía no tiene
  // pantalla hasta la 3e (la escrita ya la tiene desde la 3d: ver "la escrita
  // para hacer" más abajo).
  it("la oral todavía no", async () => {
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

describe("la escrita para hacer", () => {
  // LA PRUEBA IMPORTANTE DE LA ENTREGA. Mutación que la mata: devolver la fila
  // entera de EscritoDeIntento (con `bandas` y `comentario`) en vez de
  // construir el objeto campo a campo. El estudiante recibiría su corrección en
  // el HTML antes de que el profesor la hubiera firmado, y ni siquiera haría
  // falta mirar: está en la fuente de la página.
  it("no enseña las bandas antes de que el profesor firme", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    // El profesor escribe la corrección pero NO la firma (corregidaEn sigue null).
    await prisma.escritoDeIntento.updateMany({
      where: { intentoId: intento.id, tarea: 1 },
      data: { bandas: [3, 2, 2, 1], comentario: "Muy bien" },
    });

    const sinFirmar = await pruebaParaHacer(examen.id, "EE", ana.id, AHORA);
    expect(sinFirmar!.estado.estado).toBe("ESPERANDO");
    // Mutación que mata esto solo: devolver `entregadaEn: null` (o la fecha de
    // la firma). La cara de espera de la escrita dice «la mandaste el …», y sin
    // esta fecha un chico que lleva días esperando no sabe si su redacción
    // llegó. El estado no lo cubre: ESPERANDO sale igual con fecha o sin ella.
    expect(sinFirmar!.entregadaEn).toEqual(AHORA);
    expect(sinFirmar!.escritos[0]!.correccion).toBeNull();
    // Mutación que mata esto solo: cambiar `corregidaEn: firmada` por
    // `corregidaEn: null` en paraHacer.ts. El resto de la prueba seguiría en
    // verde (el estado se deduce de `aciertos`, no de este campo), así que
    // `corregidaEn` necesita su propia aserción a los dos lados de la firma.
    expect(sinFirmar!.corregidaEn).toBeNull();
    expect(JSON.stringify(sinFirmar)).not.toContain("Muy bien");

    await prisma.intento.update({
      where: { id: intento.id },
      data: { corregidaEn: AHORA, aciertos: 8, total: 24 },
    });
    const firmada = await pruebaParaHacer(examen.id, "EE", ana.id, AHORA);
    expect(firmada!.escritos[0]!.correccion).toEqual({ bandas: [3, 2, 2, 1], comentario: "Muy bien" });
    expect(firmada!.estado).toEqual({ estado: "ENTREGADA", aciertos: 8, total: 24, porTiempo: false });
    expect(firmada!.corregidaEn).toEqual(AHORA);
  });

  // Mutación que la mata: no devolver los escritos. Al volver de un corte, el
  // estudiante encontraría el folio en blanco y el reloj corriendo.
  it("devuelve el borrador tal como se guardó", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 2, "Elijo la dos", 2, AHORA);
    const leida = await pruebaParaHacer(examen.id, "EE", ana.id, AHORA);
    expect(leida!.escritos).toEqual([{ tarea: 2, opcion: 2, texto: "Elijo la dos", palabras: 3, correccion: null }]);
    // El otro lado de la fecha: empezada y sin entregar, no hay fecha que dar.
    expect(leida!.entregadaEn).toBeNull();
    expect(leida!.minutos).toBe(50);
    expect(leida!.tareas.map((t) => t.numero)).toEqual([1, 2]);
  });

  // Mutación que la mata: dejar "EO" dentro de PRUEBAS_QUE_SE_HACEN. La oral no
  // tiene pantalla hasta la 3e, y media pantalla es peor que ninguna.
  it("la oral sigue sin poderse hacer", async () => {
    expect(await pruebaParaHacer(examen.id, "EO", ana.id, AHORA)).toBeNull();
  });
});
