import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { empezarPrueba, entregarPrueba, guardarEscrito } from "@/lib/examen/hacer";
import { escritosPorCorregir, escritoParaCorregir, guardarCorreccion } from "@/lib/examen/corregir";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";

const AHORA = new Date("2026-09-20T09:00:00Z");
const DESPUES = new Date("2026-09-23T09:00:00Z");

let ana: Persona;
let examen: Examen;
let profe: Persona;

beforeEach(async () => {
  ({ ana, examen } = await crearExamenDePruebas());
  profe = await prisma.persona.create({ data: { correo: "profe@ejemplo.com", nombre: "Profe", papel: "PROFESOR" } });
});

async function anaEntrega(): Promise<string> {
  await empezarPrueba(examen.id, "EE", ana.id, AHORA);
  await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA);
  await guardarEscrito(examen.id, ana.id, 2, "Cuento un viaje", 2, AHORA);
  await entregarPrueba(examen.id, "EE", ana.id, AHORA);
  const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
  return intento.id;
}

describe("la cola", () => {
  // Mutación que la mata: no filtrar por corregidaEn. Lo ya corregido se
  // quedaría en la cola para siempre y el profesor lo corregiría dos veces.
  it("solo trae escritas entregadas y sin corregir, lo más viejo arriba", async () => {
    const id = await anaEntrega();
    const cola = await escritosPorCorregir(DESPUES);
    expect(cola).toHaveLength(1);
    expect(cola[0]!.intentoId).toBe(id);
    expect(cola[0]!.persona.nombre).toBe("Ana");
    expect(cola[0]!.diasEsperando).toBe(3);
    await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 2, 2, 1], comentario: "Muy bien el saludo" },
      { tarea: 2, bandas: [3, 3, 1, 1], comentario: "Cuidado con los tiempos" },
    ], profe.id, DESPUES);
    expect(await escritosPorCorregir(DESPUES)).toHaveLength(0);
  });

  // Mutación que la mata: meter en la cola las lecturas entregadas. Se corrigen
  // solas: no hay nada que mirar, y taparían lo que sí espera.
  it("no trae la lectura", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await entregarPrueba(examen.id, "CE", ana.id, AHORA);
    expect(await escritosPorCorregir(DESPUES)).toHaveLength(0);
  });

  // Mutación que la mata: no traer una escrita sin empezar a escribir. Quien
  // entrega en blanco (o a quien cierra el reloj) también hay que corregirlo.
  it("trae también la entregada en blanco", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    expect(await escritosPorCorregir(DESPUES)).toHaveLength(1);
  });
});

describe("corregir", () => {
  // Mutación que la mata: no congelar la suma en `aciertos`/`total`. «Quién lo
  // hace» tendría que volver a sumar bandas cada vez que se pinta, y la nota
  // cambiaría sola el día que el profesor cambiara de criterio.
  it("firma, congela la suma y deja la fecha", async () => {
    const id = await anaEntrega();
    expect(await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 2, 2, 1], comentario: "Muy bien el saludo" },
      { tarea: 2, bandas: [3, 3, 1, 1], comentario: "Cuidado con los tiempos" },
    ], profe.id, DESPUES)).toEqual({});
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.aciertos).toBe(16);
    expect(intento.total).toBe(24);
    expect(intento.corregidaEn).toEqual(DESPUES);
    expect(intento.corregidaPorId).toBe(profe.id);
  });

  // Mutación que la mata: no validar las bandas. Una dirección pública podría
  // dejar un 99 o un -1 y la suma se iría por el techo.
  it("rebota bandas imposibles y tareas que no son suyas", async () => {
    const id = await anaEntrega();
    expect(await guardarCorreccion(id, [{ tarea: 1, bandas: [9, 0, 0, 0], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa nota no vale." });
    expect(await guardarCorreccion(id, [{ tarea: 1, bandas: [1, 1, 1], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa nota no vale." });
    expect(await guardarCorreccion(id, [{ tarea: 7, bandas: [1, 1, 1, 1], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa tarea no existe." });
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.corregidaEn).toBeNull();
  });

  // Mutación que la mata: dejar corregir una prueba sin entregar. Se le pondría
  // nota a un folio que el chico todavía está escribiendo.
  it("no se corrige lo que no está entregado", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(await guardarCorreccion(intento.id, [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa prueba todavía no está entregada." });
  });

  // Mutación que la mata: usar `update` en vez de `upsert` al guardar el
  // escrito. Quien entrega en blanco no tiene fila en EscritoDeIntento, y un
  // `update` sobre una fila que no existe rompe (o no guarda nada) en vez de
  // crearla. Corrige las DOS tareas (las dos en blanco, ninguna con fila
  // todavía): con una guarda de más abajo que exige las bandas de las dos
  // tareas de la escrita, dejar solo la 1 aquí ya no firmaría nada.
  it("se corrige también lo entregado en blanco", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(await guardarCorreccion(intento.id, [
      { tarea: 1, bandas: [2, 2, 2, 2], comentario: "Sin nada que corregir" },
      { tarea: 2, bandas: [2, 2, 2, 2], comentario: "Sin nada que corregir" },
    ], profe.id, DESPUES)).toEqual({});
    const corregido = await prisma.intento.findUniqueOrThrow({ where: { id: intento.id } });
    expect(corregido.aciertos).toBe(16);
    expect(corregido.corregidaEn).toEqual(DESPUES);
  });

  // Mutación que la mata: no dejar volver a corregir. El profesor tiene derecho
  // a cambiar de opinión, y la fecha tiene que ser la de la última vez. Las
  // dos llamadas traen las dos tareas completas (la guarda de completitud
  // exige las dos en cada llamada donde la 2 todavía no estuviera firmada).
  it("se puede volver a corregir", async () => {
    const id = await anaEntrega();
    await guardarCorreccion(id, [
      { tarea: 1, bandas: [1, 1, 1, 1], comentario: "" },
      { tarea: 2, bandas: [1, 1, 1, 1], comentario: "" },
    ], profe.id, DESPUES);
    const masTarde = new Date("2026-09-24T09:00:00Z");
    await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 3, 3, 3], comentario: "Mejor de lo que me pareció" },
      { tarea: 2, bandas: [3, 3, 3, 3], comentario: "" },
    ], profe.id, masTarde);
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.aciertos).toBe(24);
    expect(intento.corregidaEn).toEqual(masTarde);
  });

  // Mutación que la mata: sumar solo las tareas que llegan en ESTA llamada
  // (`sumaDeBandas(tareas...)`) en vez de sobre TODOS los escritos del intento
  // después de aplicar lo que llega (`despues`). Con esa mutación, la prueba
  // de arriba no la caza (corrige la 1 las dos veces), pero corregir solo la
  // tarea 2 aquí borraría la nota ya firmada de la tarea 1.
  //
  // La primera llamada trae las DOS tareas (así queda firmada entera, como
  // exige la guarda de completitud); la segunda corrige solo la 2, que es
  // justo el caso que el encargo pidió no rompiera: "corregir otra vez solo
  // la tarea 2, cuando la 1 ya está corregida de antes, tiene que seguir
  // funcionando".
  it("corregir solo una tarea no borra la nota ya firmada de la otra", async () => {
    const id = await anaEntrega();
    await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 3, 3, 3], comentario: "" },
      { tarea: 2, bandas: [1, 1, 1, 1], comentario: "" },
    ], profe.id, DESPUES);
    const masTarde = new Date("2026-09-24T09:00:00Z");
    await guardarCorreccion(id, [{ tarea: 2, bandas: [2, 2, 2, 2], comentario: "" }], profe.id, masTarde);
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    // 12 (tarea 1, sigue en pie) + 8 (tarea 2, la nueva) = 20.
    expect(intento.aciertos).toBe(20);
    expect(intento.corregidaEn).toEqual(masTarde);
  });

  // El agujero que se cierra en esta ronda: `guardarCorreccion` no comprueba
  // papeles (la puerta vive en exigirProfesor, en la pantalla y en la
  // acción), así que sin esta guarda una llamada a mano que corrigiera solo
  // la tarea 1 de un examen de dos firmaba igual el intento entero.
  // Mutación que la mata: quitar el bucle `for (const numero of
  // numerosDelExamen) { ... }` (o su condición). Sin él, esta llamada
  // devuelve `{}` y dejaría `corregidaEn` puesto sobre una tarea sin nota.
  it("corregir solo la tarea 1 rebota y no deja corregidaEn puesto", async () => {
    const id = await anaEntrega();
    expect(await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 2, 2, 1], comentario: "" },
    ], profe.id, DESPUES)).toEqual({ error: expect.any(String) });
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.corregidaEn).toBeNull();
    expect(intento.aciertos).toBeNull();
  });

  // La contraparte, en la misma prueba para que quede claro que no es la
  // combinación de tareas lo que falla: corregir las DOS sí firma.
  it("corregir las dos tareas sí firma", async () => {
    const id = await anaEntrega();
    expect(await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 2, 2, 1], comentario: "Muy bien el saludo" },
      { tarea: 2, bandas: [3, 3, 1, 1], comentario: "Cuidado con los tiempos" },
    ], profe.id, DESPUES)).toEqual({});
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.corregidaEn).toEqual(DESPUES);
  });

  // Mutación que la mata: no traer el enunciado. El profesor corregiría un
  // texto sin ver a qué contestaba, y en la tarea 2 sin saber qué opción eligió.
  it("para corregir se ve el enunciado, la opción y lo escrito", async () => {
    const id = await anaEntrega();
    const para = await escritoParaCorregir(id, DESPUES);
    expect(para!.tareas.map((t) => t.numero)).toEqual([1, 2]);
    expect(para!.tareas[1]!.opcion).toBe(2);
    expect(para!.tareas[1]!.texto).toBe("Cuento un viaje");
    expect(para!.tareas[0]!.formulario.forma).toBe("REDACCION_UNA");
    expect(para!.puntos).toBe(24);
    expect(para!.persona.nombre).toBe("Ana");
  });
});
