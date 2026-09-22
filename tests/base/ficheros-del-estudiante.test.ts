import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { guardarTarea } from "@/lib/taller/examenes";
import { ficherosDeLasPruebasAbiertas } from "@/lib/ficheros/abiertos";
import { crearExamenDePruebas } from "@/tests/ayudas/examen-de-pruebas";

/**
 * El agujero que estas pruebas cierran, encontrado por el profesor haciendo la
 * aceptación: en la auditiva 1 la respuesta ES la foto, y las fotos no se veían.
 *
 * La pista de audio se guarda como una PIEZA con su fichero colgando, así que
 * el candado la reconocía. Las fotos de las opciones no: son identificadores
 * dentro del `datos` de la actividad, sin ninguna pieza que apunte a ellas. El
 * candado preguntaba «¿de qué tarea cuelga este fichero?», la respuesta era
 * «de ninguna», y contestaba 404. El profesor no lo notaba porque el profesor
 * lo ve todo, y ninguna prueba lo cazó porque las del candado se fabricaban un
 * fichero CON pieza — que es lo que tiene el audio y nunca han tenido las fotos.
 */

let ana: Persona;
let luis: Persona;
let examen: Examen;
let fotoDeLaOpcion: string;
let pistaDeLaTarea: string;
let hojaEscaneada: string;

async function ficheroDePrueba(ruta: string, tipoMime: string): Promise<string> {
  const f = await prisma.fichero.create({
    data: { almacen: "VERCEL", ruta, tipoMime, bytes: 10, nombreOriginal: ruta },
  });
  return f.id;
}

/** La auditiva 1 de verdad: opciones con foto, y una pista. Es la tarea del agujero. */
async function guardarAuditiva1(examenId: string): Promise<void> {
  const regla = reglaDe("A2_B1_ESCOLAR", "CO", 1)!;
  const f = formularioVacio(regla);
  if (f.forma !== "OPCIONES") throw new Error("la auditiva 1 es OPCIONES");
  f.consigna = "Escucha y elige la foto.";
  f.actividad.preguntas = f.actividad.preguntas.map((p) => ({
    ...p,
    enunciado: `Enunciado ${p.numero}`,
    opciones: p.opciones.map((o) => ({ ...o, texto: o.conImagen ? "" : `Opción ${o.letra}` })),
  }));
  if (f.actividad.ejemplo) {
    f.actividad.ejemplo.enunciado = "Ejemplo";
    f.actividad.ejemplo.letra = "A";
  }
  // Una sola foto basta para el agujero: la de la opción A de la pregunta 1.
  f.medios.imagenes = { "1-A": fotoDeLaOpcion };
  f.medios.audio = { fichero: pistaDeLaTarea, cortes: [10, 20, 30, 40, 50, 60, 70] };
  const r = await guardarTarea(examenId, "CO", 1, f);
  if ("error" in r && r.error) throw new Error(`no se pudo guardar la auditiva 1: ${r.error}`);
}

beforeEach(async () => {
  // Orden obligado: un `Fichero` no se borra mientras una pieza o una página lo
  // referencien (onDelete: Restrict), así que primero se va el examen —que
  // arrastra sus tareas y piezas— y solo después los ficheros. En la primera
  // vuelta da igual; en la segunda, al revés, revienta.
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.fichero.deleteMany();
  const montaje = await crearExamenDePruebas();
  ana = montaje.ana;
  luis = montaje.luis;
  examen = montaje.examen;

  fotoDeLaOpcion = await ficheroDePrueba("material/foto-1-a.jpg", "image/jpeg");
  pistaDeLaTarea = await ficheroDePrueba("material/pista-05.mp3", "audio/mpeg");
  hojaEscaneada = await ficheroDePrueba("material/hoja-1.jpg", "image/jpeg");

  // Retirado para poder guardar una tarea más, y publicado otra vez al final:
  // un examen publicado no se edita.
  await prisma.examen.update({ where: { id: examen.id }, data: { estado: "EN_CONSTRUCCION" } });
  await guardarAuditiva1(examen.id);
  await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: hojaEscaneada, orden: 1, etiquetas: ["CO-1"] } });
  await prisma.examen.update({ where: { id: examen.id }, data: { estado: "PUBLICADO" } });
});

async function empezarLa(prueba: "CE" | "CO"): Promise<void> {
  const asignacion = await prisma.asignacion.findFirstOrThrow({ where: { personaId: ana.id } });
  await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba } });
}

describe("los ficheros que un estudiante puede abrir", () => {
  // Mutación que la mata: buscar solo por `Pieza.ficheroId` (lo que hacía el
  // candado). La pista aparecería y la foto no, que es exactamente el fallo que
  // vio el profesor: la auditiva 1 sin fotos, y en esa tarea la foto ES la
  // respuesta.
  it("la foto de una opción cuenta igual que la pista", async () => {
    await empezarLa("CO");
    const abiertos = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(abiertos.has(pistaDeLaTarea)).toBe(true);
    expect(abiertos.has(fotoDeLaOpcion)).toBe(true);
  });

  // Mutación que la mata: devolver los ficheros de todo el examen sin mirar qué
  // prueba está abierta. Con la lectura empezada no se puede bajar la pista ni
  // las fotos de la auditiva antes de empezarla.
  it("solo los de la prueba que ha empezado", async () => {
    await empezarLa("CE");
    const conLaLectura = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(conLaLectura.has(fotoDeLaOpcion)).toBe(false);
    expect(conLaLectura.has(pistaDeLaTarea)).toBe(false);

    // Y ahora la auditiva, con el MISMO montaje: si los dos «false» de arriba
    // salieran de que no hay nada que encontrar, esto también saldría vacío.
    // Sale lleno, así que lo de arriba es el filtro haciendo su trabajo. En el
    // DELE ninguna tarea de lectura lleva ficheros, y por eso hay que probarlo
    // así y no poniéndole una foto a la lectura.
    await empezarLa("CO");
    const conLasDos = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(conLasDos.has(fotoDeLaOpcion)).toBe(true);
    expect(conLasDos.has(pistaDeLaTarea)).toBe(true);
  });

  // Mutación que la mata: quitar `examen: { estado: "PUBLICADO" }` del filtro.
  // Hoy no se puede llegar a esa situación por pantalla —retirar se niega con
  // gente asignada—, así que la prueba fuerza el estado a mano: es un cinturón,
  // y un cinturón sin prueba se cae solo el día que alguien afloje la otra guarda.
  it("de un examen que ya no está publicado, nada", async () => {
    await empezarLa("CO");
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "ARCHIVADO" } });
    const abiertos = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(abiertos.size).toBe(0);
  });

  // Mutación que la mata: dar por abiertos los ficheros de un examen asignado
  // sin intento. Antes de pulsar «Empezar» no se descarga nada.
  it("sin empezar nada, ninguno", async () => {
    const abiertos = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(abiertos.size).toBe(0);
  });

  // Mutación que la mata: quitar el caso de modo libre. En práctica libre no
  // hay intento que empezar, así que sin esta rama la pantalla se queda muda.
  //
  // También mata reducir a mano `TODAS_LAS_PRUEBAS` (lib/ficheros/abiertos.ts)
  // a, por ejemplo, ["CE","CO"]: en LIBRE se abren las CUATRO de golpe, y sin
  // la escrita en esa lista sus fotos darían 404 en cuanto una tarea las
  // llevara — el mismo fallo que el profesor encontró en la aceptación de la
  // 3c con la auditiva 1, esta vez en la lista que sí es de mano.
  //
  // La escrita 1 es REDACCION_UNA, y hoy `huecosDeImagen` (lib/taller/medios.ts)
  // no da NINGUNA clave de imagen para esa forma: cualquier clave dentro de
  // `medios.imagenes` hace que `guardarTarea` rechace el guardado con «no es
  // de ninguna opción con imagen» (fallosDeForma, lib/taller/formas.ts), así
  // que la foto no se puede meter por el camino normal del taller. Lo que
  // prueba el candado es que lee `datos.imagenes` de la Actividad tal como
  // queda en la base (lib/ficheros/abiertos.ts), así que aquí se escribe esa
  // clave directamente sobre la fila que ya dejó `crearExamenDePruebas` (la
  // escrita 1 del montaje), con la forma real que deja `piezasDelFormulario`.
  // Lo que importa es el candado, no si el taller sabe hoy poner esa foto.
  it("en práctica libre, sin intento, se abren igual, y también la de la escrita", async () => {
    const fotoDeLaEscrita = await ficheroDePrueba("material/foto-escrita.jpg", "image/jpeg");
    const pieza = await prisma.pieza.findFirstOrThrow({
      where: { tarea: { examenId: examen.id, prueba: "EE", numero: 1 }, tipo: "ACTIVIDAD" },
      select: { actividad: { select: { id: true, datos: true } } },
    });
    const datos = pieza.actividad!.datos as Record<string, unknown>;
    await prisma.actividad.update({
      where: { id: pieza.actividad!.id },
      data: { datos: { ...datos, imagenes: { situacion: fotoDeLaEscrita } } },
    });

    await prisma.asignacion.updateMany({ where: { personaId: ana.id }, data: { modo: "LIBRE" } });
    const abiertos = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(abiertos.has(fotoDeLaOpcion)).toBe(true);
    expect(abiertos.has(pistaDeLaTarea)).toBe(true);
    expect(abiertos.has(fotoDeLaEscrita)).toBe(true);
  });

  // Mutación que la mata: alcanzar los ficheros por el examen en vez de por sus
  // tareas. Una hoja escaneada es el examen entero en PDF y no la ve ningún
  // estudiante, nunca, ni con la prueba abierta.
  it("una hoja escaneada no entra jamás", async () => {
    await empezarLa("CO");
    const abiertos = await ficherosDeLasPruebasAbiertas(ana.id);
    expect(abiertos.size).toBeGreaterThan(0); // que no pase por estar vacío
    expect(abiertos.has(hojaEscaneada)).toBe(false);
  });

  // Mutación que la mata: no filtrar por persona. Lo de Ana no es de Luis.
  it("lo de otra persona, tampoco", async () => {
    await empezarLa("CO");
    const abiertos = await ficherosDeLasPruebasAbiertas(luis.id);
    expect(abiertos.size).toBe(0);
  });
});
