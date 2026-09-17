import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";
import { empezarPrueba, guardarEscrito, entregarPrueba, cerrarLasQueSePasaron } from "@/lib/examen/hacer";

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

describe("guardar el borrador", () => {
  async function empezada(): Promise<void> {
    const r = await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    expect(r.error).toBeUndefined();
  }

  // Mutación que la mata: quitar "EE" de la lista de pruebas que abren en
  // abrirLaPrueba. La escrita no se podría ni empezar.
  it("guarda el texto, las palabras y la opción", async () => {
    await empezada();
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA)).toEqual({});
    expect(await guardarEscrito(examen.id, ana.id, 2, "Elijo la dos", 2, AHORA)).toEqual({});
    const escritos = await prisma.escritoDeIntento.findMany({ orderBy: { tarea: "asc" } });
    expect(escritos.map((e) => [e.tarea, e.texto, e.palabras, e.opcion])).toEqual([
      [1, "Hola, qué tal", 3, null],
      [2, "Elijo la dos", 3, 2],
    ]);
  });

  // Mutación que la mata: fiarse de las palabras que mande el navegador. Se
  // cuentan aquí, sobre el texto que llegó.
  it("reescribe el mismo borrador, no acumula filas", async () => {
    await empezada();
    await guardarEscrito(examen.id, ana.id, 1, "Uno", null, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Uno dos tres", null, AHORA);
    const escritos = await prisma.escritoDeIntento.findMany();
    expect(escritos).toHaveLength(1);
    expect(escritos[0]!.palabras).toBe(3);
  });

  // Mutación que la mata: quitar CUALQUIERA de las cinco comprobaciones de
  // abrirLaPrueba. Son las mismas que guardan una letra en la lectura.
  it("rebota sin empezar, con el examen retirado, entregada y sin tiempo", async () => {
    // Sin empezar.
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", null, AHORA)).toEqual({ error: "Todavía no has empezado esta prueba." });
    await empezada();
    // No es suyo.
    expect(await guardarEscrito(examen.id, luis.id, 1, "Hola", null, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    // Sin tiempo: 50 minutos y diez segundos de gracia.
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", null, tarde)).toEqual({ error: "Se acabó el tiempo." });
    // Y al rebotar por tiempo, la prueba queda entregada.
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.porTiempo).toBe(true);
    // Ya entregada.
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", null, tarde)).toEqual({ error: "Esta prueba ya está entregada." });
  });

  // Mutación que la mata: no mirar el tope, o mirarlo con `>=` en vez de `>`
  // (que rebotaría también el límite exacto). Una columna de texto sin límite
  // es una invitación a pegar un libro entero desde una dirección pública.
  it("rebota un texto imposible y una tarea que no existe", async () => {
    await empezada();
    expect(await guardarEscrito(examen.id, ana.id, 1, "x".repeat(10_001), null, AHORA)).toEqual({
      error: "Ese texto es demasiado largo.",
    });
    expect(await guardarEscrito(examen.id, ana.id, 7, "Hola", null, AHORA)).toEqual({ error: "Esa tarea no existe." });
    expect(await prisma.escritoDeIntento.count()).toBe(0);
    // El límite exacto SÍ se guarda: 10.000 letras no es "demasiado largo".
    expect(await guardarEscrito(examen.id, ana.id, 1, "x".repeat(10_000), null, AHORA)).toEqual({});
    const escrito = await prisma.escritoDeIntento.findFirstOrThrow({ where: { tarea: 1 } });
    expect(escrito.texto).toHaveLength(10_000);
    expect(escrito.palabras).toBe(1);
  });

  // Mutación que la mata: no validar la opción contra las que tiene la tarea,
  // o dejar solo el tramo `opcion > opciones` y perder el `Number.isInteger`
  // o el `opcion < 1`. Una acción de servidor es pública: cualquiera puede
  // mandar la opción 99, o 1,5, o 0, o -1.
  it("rebota una opción que la tarea no tiene", async () => {
    await empezada();
    expect(await guardarEscrito(examen.id, ana.id, 2, "Hola", 99, AHORA)).toEqual({ error: "Esa opción no existe." });
    // Y en la tarea 1, que no tiene opciones, elegir una también rebota.
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", 1, AHORA)).toEqual({ error: "Esa opción no existe." });
    // No entera, ni cero, ni negativa: tampoco son opciones válidas.
    expect(await guardarEscrito(examen.id, ana.id, 2, "Hola", 1.5, AHORA)).toEqual({ error: "Esa opción no existe." });
    expect(await guardarEscrito(examen.id, ana.id, 2, "Hola", 0, AHORA)).toEqual({ error: "Esa opción no existe." });
    expect(await guardarEscrito(examen.id, ana.id, 2, "Hola", -1, AHORA)).toEqual({ error: "Esa opción no existe." });
  });
});

describe("entregar la escrita", () => {
  // Mutación que la mata: dejar que congelarNota corra también para la escrita.
  // Buscaría una clave que no existe, la nota saldría 0 de 0, y el estado diría
  // «Entregada, 0 de 0» en vez de «esperando corrección»: el chico vería un cero
  // que no es suyo y la escrita no entraría nunca en la cola.
  it("no calcula nota: queda esperando corrección", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA);
    expect(await entregarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.aciertos).toBeNull();
    expect(intento.total).toBeNull();
    expect(intento.fallos).toEqual([]);
    expect(intento.porTiempo).toBe(false);
  });

  // Mutación que la mata: quitar la bifurcación de `cerrarIntento` en el
  // camino del reloj (`cerrarLasQueSePasaron`), de forma que también calcule
  // nota para la escrita. Comprueba que los dos caminos de cierre —el botón y
  // el reloj— la dejan igual de sin nota, y que cerrar no toca lo escrito
  // (cerrarIntento no lee ni escribe la tabla de escritos).
  it("el reloj la cierra y conserva lo escrito", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Iba por aquí", null, AHORA);
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    await cerrarLasQueSePasaron({ personaId: ana.id }, tarde);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.porTiempo).toBe(true);
    expect(intento.aciertos).toBeNull();
    const escrito = await prisma.escritoDeIntento.findFirstOrThrow();
    expect(escrito.texto).toBe("Iba por aquí");
  });

  // Mutación que la mata: quitar `if (intento?.entregadaEn) return { error:
  // YA_ENTREGADA }` de `abrirLaPrueba`. Con dos llamadas en serie es esta
  // guarda la que corta la segunda antes de llegar a `cerrarIntento`, no el
  // `entregadaEn: null` del `where` del `updateMany` — ese protege, aparte,
  // dos peticiones EN VUELO a la vez, algo que esta prueba (en serie) no
  // ejerce.
  it("entregar dos veces no cambia la primera entrega", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    const primera = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    const despues = new Date(AHORA.getTime() + 60_000);
    expect(await entregarPrueba(examen.id, "EE", ana.id, despues)).toEqual({ error: "Esta prueba ya está entregada." });
    const segunda = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(segunda.entregadaEn).toEqual(primera.entregadaEn);
  });
});

describe("la escrita en modo libre", () => {
  beforeEach(async () => {
    await prisma.asignacion.updateMany({ where: { personaId: ana.id }, data: { modo: "LIBRE" } });
  });

  // Mutación que la mata: sacar los minutos del nivel sin mirar el modo. Una
  // escrita de práctica se cerraría sola a los 50 minutos, entraría en la cola
  // sin que nadie la mandara, y no habría forma de seguir escribiéndola.
  it("no lleva reloj: no se cierra sola ni rebota por tiempo", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    const muchoDespues = new Date(AHORA.getTime() + 5 * 60 * 60_000);
    expect(await guardarEscrito(examen.id, ana.id, 1, "Sigo escribiendo", null, muchoDespues)).toEqual({});
    await cerrarLasQueSePasaron({ personaId: ana.id }, muchoDespues);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).toBeNull();
  });

  // Mutación que la mata: prohibir entregar en libre. Practicar a escribir sin
  // que nadie lo lea no sirve de nada: es justo lo que decidió el profesor.
  //
  // `escritosPorCorregir` todavía no existe (la escribe la próxima tarea): se
  // comprueba la misma condición contra la base, que es exactamente lo que
  // esa función recogerá — un Intento de la escrita entregado y sin corregir.
  it("se manda a corregir igual, y entra en la cola", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Para que me la mires", null, AHORA);
    expect(await entregarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
    const pendientes = await prisma.intento.findMany({
      where: { prueba: "EE", entregadaEn: { not: null }, corregidaEn: null },
    });
    expect(pendientes).toHaveLength(1);
  });

  // Mutación que la mata: dejar reabrir una escrita ya mandada en libre. El
  // «repitiendo» del modo libre es de la lectura y la auditiva, que se
  // corrigen solas; aquí hay una persona al otro lado.
  it("una escrita mandada no se reescribe, tampoco en libre", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    expect(await guardarEscrito(examen.id, ana.id, 1, "Otra vez", null, AHORA)).toEqual({
      error: "Esta prueba ya está entregada.",
    });
  });
});
