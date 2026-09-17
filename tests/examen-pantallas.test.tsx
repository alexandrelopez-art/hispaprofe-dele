import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import type { EscritoParaHacer, PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { LETRAS_TOPE, palabras, SE_ACABO_EL_TIEMPO } from "@/lib/examen/motor";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";
import { corregirTareaEnLibre, HacerPrueba } from "@/components/examen/hacer-prueba";
import { PestanasDeTarea } from "@/components/examen/piezas";
import { Cinta } from "@/components/examen/cinta";
import { Reloj, segundosHasta } from "@/components/examen/reloj";
import { avisoDePalabras, Folio } from "@/components/examen/folio";
import { EnunciadoDeEscrita } from "@/components/examen/enunciado-de-escrita";
import {
  apagaLosFolios,
  borradoresDe,
  conOpcion,
  conTexto,
  estaCorregida,
  hayAlgoSinGuardar,
  hayQueGuardar,
  loQueFalta,
  PreguntaDeEntrega,
} from "@/components/examen/hacer-escrita";
import type { ParaCorregir, TareaParaCorregir } from "@/lib/examen/corregir";
import type { HojaDeRespuestas } from "@/lib/examen/hoja";
import { BotonesDeGuardar, CorregirEscrita } from "@/components/examen/corregir-escrita";

// Igual que tests/taller-pantallas.test.ts: la pantalla se importa tal cual
// (no un resumen de su lógica), doblando lo que toca la base y la sesión.
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  pruebaParaHacer: vi.fn(),
  cerrarLasQueSePasaron: vi.fn(),
  escritosPorCorregir: vi.fn(),
  escritoParaCorregir: vi.fn(),
  hojaDeRespuestas: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({
  redirect: dobles.redirect,
  notFound: dobles.notFound,
  // `CorregirEscrita` también llama a `router.push` (Guardar y seguir): sin
  // él en el doble, un render que llegara a dispararlo reventaría por
  // `push is not a function` en vez de fallar por lo que la prueba mira.
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
// lib/examen/paraHacer.ts importa lib/db (prisma) al cargarse; sin este
// doble, cargar el módulo real revienta por falta de DATABASE_URL (no hay
// base en esta prueba). Con lib/db a salvo, se deja pasar el resto del
// módulo real (PRUEBAS_QUE_SE_HACEN, la lista de verdad) y solo se dobla
// pruebaParaHacer, que es la única que toca la base.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/examen/paraHacer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/examen/paraHacer")>()),
  pruebaParaHacer: dobles.pruebaParaHacer,
}));
vi.mock("@/lib/examen/hacer", () => ({ cerrarLasQueSePasaron: dobles.cerrarLasQueSePasaron }));
// Las cinco acciones: la pantalla las importa a través de HacerPrueba, y
// Vitest revienta al leer una exportación que el doble no define.
vi.mock("@/app/examen/acciones", () => ({
  empezarPruebaAccion: vi.fn(),
  guardarRespuestaAccion: vi.fn(),
  marcarTrozoAccion: vi.fn(),
  entregarPruebaAccion: vi.fn(),
  corregirEnLibreAccion: vi.fn(),
  // La sexta, la de la escrita: sin ella en el doble, importar
  // hacer-escrita.tsx revienta al leer una exportación que no existe.
  guardarEscritoAccion: vi.fn(),
}));
// Las dos pantallas del profesor (app/corregir/...) solo leen: escribir es
// cosa de guardarCorreccionAccion, doblada aparte para no arrastrar
// lib/examen/corregir.ts entero (que sí toca prisma) dentro de acciones.ts.
vi.mock("@/lib/examen/corregir", () => ({
  escritosPorCorregir: dobles.escritosPorCorregir,
  escritoParaCorregir: dobles.escritoParaCorregir,
}));
// La ficha (app/examenes/[id]/hoja/...) también solo lee: dobla su única
// lectura, igual que las dos de arriba, para no arrastrar prisma aquí.
vi.mock("@/lib/examen/hoja", () => ({ hojaDeRespuestas: dobles.hojaDeRespuestas }));
vi.mock("@/app/corregir/acciones", () => ({ guardarCorreccionAccion: vi.fn() }));

import PantallaDelExamen from "@/app/examen/[id]/[prueba]/page";
import Cola from "@/app/corregir/page";
import PantallaDeCorregir from "@/app/corregir/[intentoId]/page";

const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

function como(persona: Persona) {
  dobles.cookiesGet.mockReturnValue({ value: `cookie-de-${persona.id}` });
  dobles.personaDeLaCookie.mockResolvedValue(persona);
}

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
  dobles.cerrarLasQueSePasaron.mockResolvedValue(undefined);
  como(ESTUDIANTE);
});

function tareaDe(numero: number, regla: ReglaTarea, rellenar: (f: Formulario) => void): TareaParaHacer {
  const formulario = formularioVacio(regla);
  rellenar(formulario);
  return { numero, regla, formulario, trozos: regla.trozos ?? 0, oidos: [] };
}

function pintar(
  tarea: TareaParaHacer,
  opts: { marcadas?: Record<string, string>; fallos?: number[] | null; bloqueada?: boolean },
): string {
  return renderToStaticMarkup(
    <TareaDelEstudiante
      tarea={tarea}
      marcadas={opts.marcadas ?? {}}
      fallos={opts.fallos ?? null}
      bloqueada={opts.bloqueada ?? false}
      alMarcar={() => {}}
    />,
  );
}

// CE-2: LISTA_COMUN, tres textos sueltos (las tres personas), seis preguntas 7-12.
function lecturaDos(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 2)!;
  return tareaDe(2, regla, (f) => {
    if (f.forma !== "LISTA_COMUN") throw new Error("regla equivocada");
    f.consigna = "Lee los tres textos y contesta a las preguntas.";
    f.textos = [
      { etiqueta: "Persona 1", texto: "Texto 1" },
      { etiqueta: "Persona 2", texto: "Texto 2" },
      { etiqueta: "Persona 3", texto: "Texto 3" },
    ];
    f.actividad.comunes = [
      { letra: "A", texto: "Tienda A" },
      { letra: "B", texto: "Tienda B" },
      { letra: "C", texto: "Tienda C" },
    ];
    f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Enunciado de la ${p.numero}` }));
  });
}

// CE-1: RELACIONAR, seis elementos con texto, diez destinos A-J, ejemplo en la letra B.
function lecturaUnoConEjemploEnB(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 1)!;
  return tareaDe(1, regla, (f) => {
    if (f.forma !== "RELACIONAR") throw new Error("regla equivocada");
    f.consigna = "Relaciona cada mensaje con su texto.";
    f.actividad.ejemplo = { texto: "Texto del ejemplo", letra: "B" };
    f.actividad.elementos = f.actividad.elementos.map((e) => ({ ...e, texto: `Mensaje ${e.numero}` }));
    f.actividad.destinos = f.actividad.destinos.map((d) => ({ ...d, titulo: `Título ${d.letra}`, texto: `Texto ${d.letra}` }));
  });
}

// CO-1: OPCIONES, ejemplo y las cuatro primeras preguntas con la opción en foto.
function auditivaUnoConFotos(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CO", 1)!;
  return tareaDe(1, regla, (f) => {
    if (f.forma !== "OPCIONES") throw new Error("regla equivocada");
    f.consigna = "Escucha y elige la foto que corresponde.";
    if (f.actividad.ejemplo) {
      f.actividad.ejemplo.enunciado = "Enunciado del ejemplo";
      f.actividad.ejemplo.letra = "A";
      for (const o of f.actividad.ejemplo.opciones) f.medios.imagenes[`ejemplo-${o.letra}`] = `foto-ejemplo-${o.letra}`;
    }
    f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Enunciado ${p.numero}` }));
    for (const p of f.actividad.preguntas) {
      for (const o of p.opciones) {
        if (o.conImagen) f.medios.imagenes[`${p.numero}-${o.letra}`] = `foto-${p.numero}-${o.letra}`;
      }
    }
  });
}

// CE-3: OPCIONES con un texto largo (regla.textos: 1). Es el único camino sin
// foto por el que `dosColumnas` puede salir true de verdad.
function lecturaTres(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 3)!;
  return tareaDe(3, regla, (f) => {
    if (f.forma !== "OPCIONES") throw new Error("regla equivocada");
    f.consigna = "Lee el texto y elige la opción correcta.";
    f.textos = [{ etiqueta: "Texto", texto: "Un texto largo de la lectura 3." }];
    f.actividad.preguntas = f.actividad.preguntas.map((p) => ({
      ...p,
      enunciado: `Enunciado ${p.numero}`,
      opciones: p.opciones.map((o) => ({ ...o, texto: `Opción ${o.letra} de la ${p.numero}` })),
    }));
  });
}

// CO-4: OPCIONES agrupadas en tres noticias de dos preguntas cada una
// (primero: 20, items: 6, grupos: 3): 20-21 → Noticia 1, 22-23 → Noticia 2,
// 24-25 → Noticia 3.
function auditivaCuatro(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CO", 4)!;
  return tareaDe(4, regla, (f) => {
    if (f.forma !== "OPCIONES") throw new Error("regla equivocada");
    f.consigna = "Escucha las tres noticias y contesta.";
    f.actividad.preguntas = f.actividad.preguntas.map((p) => ({
      ...p,
      enunciado: `Enunciado ${p.numero}`,
      opciones: p.opciones.map((o) => ({ ...o, texto: `Opción ${o.letra} de la ${p.numero}` })),
    }));
  });
}

// CO-4 con su pista: tres trozos y dos marcas, como la de verdad. Es la única
// fixture con audio de toda la suite, y sin ella `CintaDeLaTarea` no llega a
// pintarse nunca dentro de la pantalla: `medios.audio` llega en null en todas
// las demás y la cinta se rinde antes de pintar nada.
function auditivaCuatroConAudio(): TareaParaHacer {
  const tarea = auditivaCuatro();
  tarea.formulario.medios.audio = { fichero: "audio-co-4", cortes: [113, 195] };
  return tarea;
}

// CE-4: HUECOS, siete huecos (primero: 19, items: 7) en un texto con título y
// fuente.
function lecturaCuatro(): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 4)!;
  return tareaDe(4, regla, (f) => {
    if (f.forma !== "HUECOS") throw new Error("regla equivocada");
    f.consigna = "Completa el texto con la opción correcta en cada hueco.";
    f.actividad.titulo = "Título del texto";
    f.actividad.texto = "Un texto con el hueco [19] y también el [20], hasta el [25].";
    f.actividad.fuente = "Adaptado de una revista escolar.";
    f.actividad.huecos = f.actividad.huecos.map((h) => ({
      ...h,
      opciones: h.opciones.map((o) => ({ ...o, texto: `Opción ${o.letra} del hueco ${h.numero}` })),
    }));
  });
}

// EE-1: REDACCION_UNA, la situación y el correo al que hay que contestar.
function escritaUna(): Formulario {
  const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "EE", 1)!);
  if (f.forma !== "REDACCION_UNA") throw new Error("regla equivocada");
  f.consigna = "Lee el correo y contesta.";
  f.actividad.situacion = "Un amigo te escribe un correo. Contéstale.";
  f.actividad.textoRecibido = "Hola, ¿qué tal? ¿Vienes el sábado?";
  f.actividad.pautas = ["Salúdale", "Dile si puedes venir"];
  return f;
}

// EE-2: REDACCION_DOS, dos opciones entre las que elegir para redactar.
function escritaDos(): Formulario {
  const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "EE", 2)!);
  if (f.forma !== "REDACCION_DOS") throw new Error("regla equivocada");
  f.consigna = "Elige una de las dos opciones y escribe tu texto.";
  f.actividad.opciones = f.actividad.opciones.map((o, i) => ({
    ...o,
    contexto: `Contexto de la opción ${i + 1}`,
    pautas: [`Pauta de la opción ${i + 1}`],
  }));
  return f;
}

/** Extrae el `<input>` de una letra en una pregunta, sin depender de en qué
 * orden React sirva sus atributos (`checked` sale siempre antes que `value`,
 * pero eso es un detalle de serialización, no algo que la prueba deba fijar). */
function radioDe(html: string, nombrePregunta: string, letra: string): string {
  const patron = new RegExp(`<input[^>]*name="${nombrePregunta}"[^>]*value="${letra}"[^>]*/>`);
  return html.match(patron)?.[0] ?? "";
}

describe("TareaDelEstudiante", () => {
  // Mutación que la mata: pintar `datos` tal cual sin el estado marcado. El
  // estudiante recargaría y se encontraría el examen en blanco.
  it("enseña marcada la letra que ya eligió", () => {
    const html = pintar(lecturaDos(), { marcadas: { "8": "B" } });
    const radio = radioDe(html, "pregunta-8", "B");
    expect(radio).not.toBe(""); // que el radio exista de verdad, no que un `toContain` vacío pase solo
    expect(radio).toContain('checked=""');
  });

  // Mutación que la mata: dejar los radios vivos en una prueba entregada.
  it("entregada se ve pero no se toca", () => {
    const html = pintar(lecturaDos(), { marcadas: { "8": "B" }, bloqueada: true });
    expect(html).toContain("disabled");
    expect(html).toContain("Pregunta 8");
  });

  // Mutación que la mata (el data-fallo): dejar de marcar la pregunta
  // fallada al corregir. El `not.toContain` de la frase, en cambio, no mata
  // ninguna mutación de lógica: ningún camino de este fichero conoce la
  // letra correcta (`TareaParaHacer` no la trae), así que lo único que esa
  // línea puede cazar es que alguien pegue la frase literal en la pantalla.
  // La garantía real —que la letra correcta ni siquiera llega aquí— vive en
  // lib/examen/paraHacer.ts, que nunca selecciona la clave.
  it("al corregir marca el fallo y NO dice cuál era la buena", () => {
    const tarea = lecturaDos();
    const html = pintar(tarea, { marcadas: { "8": "B" }, fallos: [8] });
    expect(html).not.toBe("");
    expect(html).toContain('data-fallo="8"');
    expect(html).not.toContain("La respuesta correcta");
  });

  // Mutación que la mata: ofrecer en relacionar también la letra del ejemplo, que
  // ya está gastada.
  it("relacionar no ofrece la letra del ejemplo", () => {
    const html = pintar(lecturaUnoConEjemploEnB(), {});
    expect(html).not.toBe("");
    expect(html).not.toContain('value="B"');
    expect(html).toContain('value="A"');
  });

  // Mutación que la mata: no pintar las fotos de las opciones con imagen. La
  // auditiva 1 son cuatro preguntas donde la respuesta ES la foto.
  it("las opciones con foto salen por la ruta de ficheros", () => {
    const html = pintar(auditivaUnoConFotos(), {});
    expect(html).toContain('src="/api/ficheros/foto-1-A"');
  });

  // Mutación que la mata: dejar de pintar los textos sueltos (las tres personas de
  // la lectura 2, el texto largo de la 3). Sin ellos no se puede contestar.
  it("los textos sueltos se pintan enteros", () => {
    const html = pintar(lecturaDos(), {});
    expect(html).toContain("Texto 1");
    expect(html).toContain("Texto 3");
  });

  // Mutación que la mata: quitar el `aria-label` del <select> de relacionar.
  // Sin él, un lector de pantalla (VoiceOver, habitual en el colegio) anuncia
  // un combobox sin nombre: la única pista visual es la cabecera de arriba,
  // que no está asociada al control.
  it("relacionar: el desplegable lleva su propia etiqueta accesible", () => {
    const html = pintar(lecturaUnoConEjemploEnB(), {});
    expect(html).toContain('aria-label="Pregunta 1"');
  });

  // Mutación que la mata: quitar `f.textos.length > 0` de la condición de
  // `dosColumnas` (o invertirla). La foto de la auditiva 1 no tiene textos
  // sueltos, así que sin esta prueba el camino de las dos columnas en
  // OPCIONES nunca se ejecuta.
  it("opciones con texto largo (lectura 3): el texto se pinta y entra en dos columnas", () => {
    const html = pintar(lecturaTres(), {});
    expect(html).toContain("Un texto largo de la lectura 3.");
    expect(html).toContain("md:grid-cols-2");
  });

  // Mutación que la mata: cualquier desliz de índice en la condición que
  // decide cuándo pintar «Noticia N» (comparar con `a.preguntas[i]` en vez de
  // `a.preguntas[i - 1]`, o quedarse solo con `i === 0`). El primer grupo que
  // no empieza en el índice 0 (Noticia 2, en la pregunta 22) es justo donde
  // un error de uno en uno se escondería.
  it("opciones agrupadas (auditiva 4): las noticias caen justo en la pregunta que abre cada grupo", () => {
    const html = pintar(auditivaCuatro(), {});
    const orden = [...html.matchAll(/Noticia \d|Pregunta \d+/g)].map((m) => m[0]);
    expect(orden).toEqual([
      "Noticia 1", "Pregunta 20", "Pregunta 21",
      "Noticia 2", "Pregunta 22", "Pregunta 23",
      "Noticia 3", "Pregunta 24", "Pregunta 25",
    ]);
  });

  // Mutación que la mata: no pintar el título, el texto o la fuente de
  // HUECOS, o quedarse con menos de los siete huecos. Ni RELACIONAR, ni
  // LISTA_COMUN, ni OPCIONES pasan por `TextoHuecos` ni por `ActividadHuecos`:
  // sin esta prueba, ambas funciones no las cubre nada.
  it("huecos: el texto largo con su título y su fuente se pinta entero, con los siete huecos", () => {
    const html = pintar(lecturaCuatro(), {});
    expect(html).toContain("Título del texto");
    expect(html).toContain("Adaptado de una revista escolar.");
    expect(html).toContain("Opción A del hueco 19");
    expect(html).toContain("Opción A del hueco 25");
  });

  // Mutación que la mata: pintar `datos` tal cual sin el estado marcado en
  // los radios de HUECOS.
  it("huecos: el hueco marcado sale marcado", () => {
    const html = pintar(lecturaCuatro(), { marcadas: { "19": "B" } });
    const radio = radioDe(html, "pregunta-19", "B");
    expect(radio).not.toBe("");
    expect(radio).toContain('checked=""');
  });

  // Mutación que la mata: quitar `disabled={bloqueada}` de los radios de
  // HUECOS.
  it("huecos: entregado no se toca", () => {
    const html = pintar(lecturaCuatro(), { bloqueada: true });
    expect(html).toContain("Hueco 19");
    expect(html).toContain("disabled");
  });

  // Mutación que la mata: no marcar `data-fallo` en el hueco fallado.
  it("huecos: al corregir, el hueco fallado lleva data-fallo", () => {
    const html = pintar(lecturaCuatro(), { fallos: [20] });
    expect(html).not.toBe("");
    expect(html).toContain('data-fallo="20"');
  });
});

// La pantalla que hace el estudiante: app/examen/[id]/[prueba]/page.tsx con
// HacerPrueba encima. Cada fixture es una PruebaParaHacer entera, tal como la
// devuelve lib/examen/paraHacer.ts (aquí doblado).
function pruebaDePrueba(extra: Partial<PruebaParaHacer> = {}): PruebaParaHacer {
  return {
    examen: { id: "x1", titulo: "Examen 1", nivel: "A2_B1_ESCOLAR" },
    prueba: "CE",
    modo: "COMPLETO",
    fechaTope: new Date("2026-10-20T00:00:00.000Z"),
    minutos: 50,
    tareas: [lecturaDos()],
    estado: { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: null,
    respuestas: {},
    fallos: [],
    escritos: [],
    entregadaEn: null,
    corregidaEn: null,
    // Las OTRAS DOS sin empezar, que es lo normal al terminar la primera. Dos y
    // no una: desde que la escrita tiene pantalla, `pruebaParaHacer` manda
    // siempre las otras dos de PRUEBAS_QUE_SE_HACEN, y una fixture con una sola
    // escondía que la pantalla dijera «las dos pruebas» cuando son tres.
    otras: [
      { prueba: "CO", estado: { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false } },
      { prueba: "EE", estado: { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false } },
    ],
    ...extra,
  };
}

// CE (lectura): con reloj, 50 minutos.
function sinEmpezar(): PruebaParaHacer {
  return pruebaDePrueba();
}

// CE (lectura) YA EMPEZADA: la única fixture con reloj en marcha, que es donde
// la salida a Inicio tiene que advertir de que el reloj no se para.
function haciendoLectura(): PruebaParaHacer {
  return pruebaDePrueba({
    estado: { estado: "HACIENDO", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: 1800,
  });
}

// CO (auditiva) sin empezar: el aviso de audio, todavía sin intento.
function sinEmpezarAuditiva(): PruebaParaHacer {
  return pruebaDePrueba({ prueba: "CO", minutos: null, tareas: [auditivaUnoConFotos()] });
}

// CO (auditiva) YA EMPEZADA: la única fixture que pasa de verdad por
// PruebaHaciendo con `minutos: null` — sinEmpezarAuditiva() se queda en
// AvisoPrevio, que no tiene rama de reloj que mutar.
function haciendoAuditiva(): PruebaParaHacer {
  return pruebaDePrueba({
    prueba: "CO",
    minutos: null,
    estado: { estado: "HACIENDO", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: null,
    tareas: [auditivaUnoConFotos()],
  });
}

// CO ya empezada y CON pista: la única fixture que pinta la cinta dentro de la
// pantalla.
function haciendoAuditivaConCinta(): PruebaParaHacer {
  return pruebaDePrueba({
    prueba: "CO",
    minutos: null,
    estado: { estado: "HACIENDO", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: null,
    tareas: [auditivaCuatroConAudio()],
  });
}

// La misma, ya entregada: ahí la cinta se pinta agotada, sin reproductor.
function entregadaAuditivaConCinta(): PruebaParaHacer {
  return pruebaDePrueba({
    prueba: "CO",
    minutos: null,
    estado: { estado: "ENTREGADA", aciertos: 3, total: 6, porTiempo: false },
    segundosQueQuedan: null,
    tareas: [auditivaCuatroConAudio()],
  });
}

// CE-2 tiene 6 preguntas (7-12); sumadas a CE-1 (6) + CE-3 (6) + CE-4 (7) da
// los 25 de la prueba completa. Aquí solo hace falta que la nota del
// `estado` (no las tareas) diga 19 de 25.
// Entregada con dos fallos DENTRO de la lectura 2 (preguntas 7-12), para que la
// nota por tarea sea 4 de 6 y no cuadre por casualidad con el 19 de 25 global.
function entregadaCon19De25(extra: Partial<PruebaParaHacer> = {}): PruebaParaHacer {
  return pruebaDePrueba({
    tareas: [lecturaDos()],
    estado: { estado: "ENTREGADA", aciertos: 19, total: 25, porTiempo: false },
    respuestas: { "8": "B" },
    // El 20 es de OTRA tarea (la lectura 4 va de la 19 a la 25). Está aquí a
    // propósito: sin él, filtrar los fallos por la tarea o no filtrarlos daría
    // el mismo número, y la prueba de «4 de 6» no distinguiría nada.
    fallos: [8, 11, 20],
    ...extra,
  });
}

// Modo LIBRE con minutos !== null y estado HACIENDO a propósito: si la
// pantalla decidiera el reloj por `minutos`/`estado` en vez de por `modo`,
// esta fixture lo pintaría igual que una prueba normal a medias.
function enLibre(): PruebaParaHacer {
  return pruebaDePrueba({
    modo: "LIBRE",
    minutos: 50,
    estado: { estado: "HACIENDO", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: 1800,
    tareas: [lecturaDos()],
  });
}

// ── La escrita (EE) ─────────────────────────────────────────────────────────
// Las dos tareas de la escrita con su regla de verdad: la 1 es REDACCION_UNA
// (el correo al que hay que contestar) y la 2 REDACCION_DOS (elegir tema).
function tareaDeEscrita(numero: 1 | 2): TareaParaHacer {
  const regla = reglaDe("A2_B1_ESCOLAR", "EE", numero)!;
  return { numero, regla, formulario: numero === 1 ? escritaUna() : escritaDos(), trozos: 0, oidos: [] };
}

function escritoDe(
  tarea: number,
  texto: string,
  opcion: number | null,
  correccion: EscritoParaHacer["correccion"] = null,
): EscritoParaHacer {
  return { tarea, opcion, texto, palabras: palabras(texto), correccion };
}

const CARTA = "Hola Juan, el sábado no puedo.";
const FIN_DE_SEMANA = "Mi fin de semana ideal es un sábado en el río.";

// EE a medias: reloj de 50 minutos corriendo, la tarea 1 ya empezada y la 2
// todavía en blanco (por eso `escritos` trae una sola fila: la siembra de
// borradores tiene que inventar la que falta).
function escritaParaHacer(extra: Partial<PruebaParaHacer> = {}): PruebaParaHacer {
  return pruebaDePrueba({
    prueba: "EE",
    minutos: 50,
    segundosQueQuedan: 1800,
    estado: { estado: "HACIENDO", aciertos: null, total: null, porTiempo: false },
    tareas: [tareaDeEscrita(1), tareaDeEscrita(2)],
    escritos: [escritoDe(1, CARTA, null)],
    otras: [{ prueba: "CE", estado: { estado: "ENTREGADA", aciertos: 19, total: 25, porTiempo: false } }],
    ...extra,
  });
}

function escritaSinEmpezar(): PruebaParaHacer {
  return escritaParaHacer({
    estado: { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: null,
    escritos: [],
  });
}

// Entregada y sin firmar: ESPERANDO es el estado que la lectura no tiene nunca
// —una lectura entregada ya trae su nota—, y es donde vive la escrita hasta que
// el profesor la corrige.
function escritaEsperando(extra: Partial<PruebaParaHacer> = {}): PruebaParaHacer {
  return escritaParaHacer({
    estado: { estado: "ESPERANDO", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: null,
    entregadaEn: new Date("2026-09-15T09:30:00.000Z"),
    escritos: [escritoDe(1, CARTA, null), escritoDe(2, FIN_DE_SEMANA, 2)],
    ...extra,
  });
}

// Firmada: 8 + 10 = 18 de 24 (dos tareas × cuatro criterios × banda 3).
function escritaCorregida(extra: Partial<PruebaParaHacer> = {}): PruebaParaHacer {
  return escritaParaHacer({
    estado: { estado: "ENTREGADA", aciertos: 18, total: 24, porTiempo: false },
    segundosQueQuedan: null,
    entregadaEn: new Date("2026-09-15T09:30:00.000Z"),
    escritos: [
      escritoDe(1, CARTA, null, { bandas: [3, 2, 2, 1], comentario: "Muy bien el saludo" }),
      escritoDe(2, FIN_DE_SEMANA, 2, { bandas: [3, 3, 2, 2], comentario: "Cuida los acentos" }),
    ],
    corregidaEn: new Date("2026-09-16T10:00:00.000Z"),
    ...extra,
  });
}

// Práctica libre de la escrita, antes de empezar: el aviso es otro —dice
// «sin reloj», no «Tienes 50 minutos»—. `minutos: null` y `segundosQueQuedan:
// null` no son adorno de la fixture: es lo que `pruebaParaHacer` manda de
// verdad en libre (ver tests/base/examen-para-hacer.test.ts). Antes llegaban
// los del nivel y cada pantalla tenía que volver a mirar el `modo` para no
// pintar un reloj que no corre.
function escritaLibre(): PruebaParaHacer {
  return escritaParaHacer({
    modo: "LIBRE",
    minutos: null,
    estado: { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false },
    segundosQueQuedan: null,
    escritos: [],
  });
}

// La misma, ya empezada: `estado: HACIENDO` sin minutos, que es justo donde un
// reloj de más se notaría.
function escritaLibreHaciendo(): PruebaParaHacer {
  return escritaParaHacer({ modo: "LIBRE", minutos: null, segundosQueQuedan: null });
}

async function pintarPagina(prueba: PruebaParaHacer): Promise<string> {
  dobles.pruebaParaHacer.mockResolvedValue(prueba);
  const elemento = await PantallaDelExamen({
    params: Promise.resolve({ id: prueba.examen.id, prueba: prueba.prueba }),
  });
  return renderToStaticMarkup(elemento);
}

/** Para las dos pruebas que solo miran el 404: no hay fixture que pasarle. */
function pintarPaginaDe(prueba: string) {
  return PantallaDelExamen({ params: Promise.resolve({ id: "x1", prueba }) });
}

describe("la pantalla que hace el estudiante", () => {
  // Mutación que la mata: enseñar el examen sin avisar. El aviso es lo que hace
  // honesto el «no se puede repetir»: se dice ANTES, no después.
  it("sin empezar enseña el aviso, no las preguntas", async () => {
    const html = await pintarPagina(sinEmpezar());
    expect(html).toContain("50 minutos");
    expect(html).toContain("no se puede repetir");
    expect(html).toContain("Empezar");
    expect(html).not.toContain("Pregunta 8");
  });

  // Mutación que la mata: invertir `esLectura` (o compararlo con `minutos`),
  // colando el aviso de lectura en la auditiva.
  it("sin empezar, la auditiva avisa de que cada audio suena una vez", async () => {
    const html = await pintarPagina(sinEmpezarAuditiva());
    expect(html).toContain("una sola vez");
  });

  // Antes esta aserción vivía en el fixture SIN_EMPEZAR de arriba, donde no
  // podía morir nunca: AvisoPrevio no tiene ninguna rama que pinte <Reloj>,
  // así que ninguna mutación de una línea la habría hecho fallar. Aquí sí
  // pasa por la guarda de verdad, en PruebaHaciendo.
  // Mutación que la mata: borrar `prueba.minutos !== null &&
  // prueba.segundosQueQuedan !== null` antes de <Reloj> (o sustituirlo por
  // `?? 0`): con los dos en null, eso pintaría «Te quedan 0:00».
  it("empezada, la auditiva sigue sin reloj", async () => {
    const html = await pintarPagina(haciendoAuditiva());
    expect(html).toContain("Escucha y elige la foto que corresponde."); // que la tarea se pintó de verdad
    expect(html).not.toContain("Te quedan");
  });

  // La cinta, dentro de la pantalla. Hasta ahora ninguna fixture traía audio,
  // así que `CintaDeLaTarea` se rendía antes de pintar nada y ni ella ni la
  // `Cinta` de debajo se ejecutaban en toda la suite.
  // Mutación que la mata: quitar `<CintaDeLaTarea>` de `PruebaHaciendo`, o
  // invertir su guarda `tarea.trozos <= 0 || !audio`, o pintar el `<audio>` con
  // la ruta de otro fichero.
  it("empezada, la auditiva con pista pinta su cinta", async () => {
    const html = await pintarPagina(haciendoAuditivaConCinta());
    expect(html).toContain('src="/api/ficheros/audio-co-4"');
    expect(html).toContain("Escuchar el audio");
  });

  // Mutación que la mata: no pasarle `entregada` a `CintaDeLaTarea` desde
  // `PruebaEntregada`. La cinta volvería a ofrecer el botón en una prueba ya
  // cerrada, donde ningún clic puede salir bien: el servidor contestaría
  // «Esta prueba ya está entregada.» y el estudiante se quedaría con un
  // reproductor que no reproduce.
  it("entregada, la cinta sale agotada y sin reproductor", async () => {
    const html = await pintarPagina(entregadaAuditivaConCinta());
    expect(html).toContain("Este audio ya ha sonado.");
    expect(html).not.toContain("Escuchar el audio");
    expect(html).not.toContain("<audio");
  });

  // Mutación que la mata: pintar las opciones con foto en columna, como las de
  // texto (que es como estaban: tres cintas de ancho completo con la foto
  // pequeña dentro, «feas y alargadas» en palabras del profesor). En la
  // auditiva 1 la respuesta ES la foto: las tres tienen que verse a la vez y
  // compararse de un vistazo.
  it("las opciones con foto van una al lado de otra, las de texto en columna", () => {
    const conFotos = pintar(auditivaUnoConFotos(), {});
    expect(conFotos).toContain("grid grid-cols-3");
    expect(conFotos).toContain('src="/api/ficheros/foto-1-A"');
    // La auditiva 4 no lleva fotos: sus opciones siguen una debajo de otra.
    const sinFotos = pintar(auditivaCuatro(), {});
    expect(sinFotos).not.toBe("");
    expect(sinFotos).not.toContain("grid grid-cols-3");
  });

  // Mutación que la mata: volver a juntar consulta y preguntas en una sola
  // columna (el `hayConsulta` que solo mira HUECOS y los textos sueltos, como
  // estaba). Relacionar son diez anuncios y seis personas: leídos uno detrás de
  // otro, el estudiante contesta sin ver ya lo que acaba de leer. Lo dijo el
  // profesor viendo hacer la tarea 1.
  it("relacionar y lista común reparten consulta y preguntas en dos columnas", () => {
    for (const tarea of [lecturaUnoConEjemploEnB(), lecturaDos()]) {
      const html = pintar(tarea, {});
      expect(html).not.toBe("");
      expect(html).toContain("md:grid-cols-2");
      expect(html).toContain("md:overflow-y-auto");
    }
  });

  // Mutación que la mata: quitar la barra, o pintarla también en ordenador
  // (sin `md:hidden`), donde estorba porque las preguntas ya están a la vista.
  it("en pantalla estrecha las respuestas viajan en una barra pegada abajo", () => {
    const html = pintar(lecturaUnoConEjemploEnB(), { marcadas: { "2": "C" } });
    expect(html).toContain("data-barra-respuestas");
    expect(html).toContain("md:hidden");
    expect(html).toContain("sticky");
    // Lleva los seis números, y el que ya tiene letra la enseña.
    expect(html).toContain("2 C");
  });

  // Mutación que la mata: que `preguntasParaLaBarra` devuelva también las
  // preguntas de OPCIONES (quitarle el `default: return []`). La auditiva 1 se
  // escucha, no se lee: ahí la barra sería un trozo de pantalla robado a las
  // fotos de las opciones, y no hay nada arriba que consultar mientras suena.
  // NO la mata quitar la guarda `hayConsulta` de la barra: esa guarda era
  // código muerto, se descubrió mutándola y ya no está.
  it("las tareas que solo se escuchan no llevan barra", () => {
    const html = pintar(auditivaUnoConFotos(), {});
    expect(html).not.toBe("");
    expect(html).not.toContain("data-barra-respuestas");
  });

  // Mutación que la mata: dejar el mando de la barra vivo en una prueba ya
  // entregada. Es un segundo mando sobre la misma respuesta, así que tiene que
  // apagarse con el primero.
  it("la barra se apaga con la prueba entregada", () => {
    const html = pintar(lecturaDos(), { marcadas: { "8": "B" }, bloqueada: true });
    expect(html).toContain("data-barra-respuestas");
    expect(html).toContain("respuesta rápida");
    // Dos mandos apagados: el de la caja de la pregunta y el de la barra.
    expect(html.match(/disabled=""/g)?.length ?? 0).toBeGreaterThan(1);
  });

  // Mutación que la mata: no pintar el resultado, o pintar la letra buena.
  it("entregada enseña la nota y los fallos", async () => {
    const html = await pintarPagina(entregadaCon19De25());
    expect(html).toContain("19 de 25");
    expect(html).not.toContain("La respuesta correcta");
  });

  // Mutación que la mata: volver a la línea suelta de antes («Entregada, 19 de
  // 25» y nada más). El profesor dijo que así no se entendía: no decía de qué
  // prueba era, ni dónde se perdían los puntos, ni qué era el rojo, ni qué
  // quedaba por hacer.
  it("el resultado dice de qué prueba es, qué sacó en cada tarea y qué significa el rojo", async () => {
    const html = await pintarPagina(entregadaCon19De25());
    expect(html).toContain("comprensión de lectura");
    expect(html).toContain("Examen 1");
    expect(html).toContain("Tarea 2");
    expect(html).toContain("En rojo, las que fallaste");
    expect(html).toContain("vuelve al texto y búscala");
  });

  // Mutación que la mata: contar los fallos de TODA la prueba en cada tarea, o
  // no restarlos. La lectura 2 tiene seis preguntas (7-12) y el fixture falla
  // dos de ellas: son 4 de 6, y ese 4 es lo que dice dónde mirar.
  it("la nota de cada tarea sale de SUS preguntas", async () => {
    const html = await pintarPagina(entregadaCon19De25());
    expect(html).toContain("4 de 6");
  });

  // Mutación que la mata: enseñar siempre «te quedan las otras» aunque estén
  // entregadas, o no enseñarlo nunca. Es lo que dice al estudiante que aún no ha
  // terminado.
  //
  // La otra mutación, la del recuento: escribir el número a mano («las dos
  // pruebas», que es lo que decía, o el singular «Te queda» con dos pendientes).
  // Son tres pruebas desde que la escrita tiene pantalla, así que el texto no
  // puede llevar el número dentro.
  it("dice qué pruebas quedan por hacer, y si no queda ninguna, que ya está", async () => {
    const quedan = await pintarPagina(entregadaCon19De25());
    expect(quedan).toContain("Te quedan");
    expect(quedan).toContain("comprensión auditiva");
    expect(quedan).toContain("expresión escrita");

    const entregada = { estado: "ENTREGADA" as const, aciertos: 21, total: 25, porTiempo: false };
    const terminadas = await pintarPagina(
      entregadaCon19De25({
        otras: [{ prueba: "CO", estado: entregada }, { prueba: "EE", estado: entregada }],
      }),
    );
    expect(terminadas).toContain("Ya has terminado el examen");
    expect(terminadas).not.toContain("las dos pruebas");
    expect(terminadas).not.toContain("Te queda");

    // Una sola pendiente: el singular, y el enlace en singular con ella.
    const unaSola = await pintarPagina(
      entregadaCon19De25({
        otras: [
          { prueba: "CO", estado: entregada },
          { prueba: "EE", estado: { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false } },
        ],
      }),
    );
    expect(unaSola).toContain("Te queda expresión escrita.");
    expect(unaSola).toContain("Ir a hacerla<");
  });

  // Mutación que la mata: volver la línea del filtro de `Resultado` a
  // `o.estado.estado !== "ENTREGADA"`. Una escrita ESPERANDO (entregada, sin
  // nota todavía) no es "ENTREGADA" con esa comparación vieja, así que
  // reaparecería como pendiente aunque el estudiante ya la haya mandado.
  it("una escrita entregada y sin corregir no cuenta como pendiente", async () => {
    const html = await pintarPagina(
      entregadaCon19De25({
        otras: [
          { prueba: "CO", estado: { estado: "ENTREGADA", aciertos: 21, total: 25, porTiempo: false } },
          { prueba: "EE", estado: { estado: "ESPERANDO", aciertos: null, total: null, porTiempo: false } },
        ],
      }),
    );
    expect(html).not.toContain("Te queda");
  });

  // Mutación que la mata: no decir que la entregó el reloj. Para el estudiante
  // no es lo mismo un 12 de 25 contestando que un 12 de 25 porque se le acabó.
  it("si la entregó el reloj, lo dice", async () => {
    const html = await pintarPagina(
      entregadaCon19De25({ estado: { estado: "ENTREGADA", aciertos: 12, total: 25, porTiempo: true } }),
    );
    expect(html).toContain("Se entregó sola");
  });

  // Mutación que la mata: quitar <VolverAInicio> del armazón, que es como salió
  // la entrega: el sitio no tiene cabecera común, así que sin este enlace la
  // pantalla del examen es un callejón y al terminar la lectura no hay forma de
  // llegar a la auditiva salvo el botón de atrás. Lo cazó el profesor haciendo
  // la aceptación, con la lectura ya entregada y sin saber cómo seguir.
  it("las cuatro caras tienen salida a Inicio", async () => {
    for (const cara of [sinEmpezar(), haciendoAuditiva(), entregadaCon19De25(), enLibre()]) {
      const html = await pintarPagina(cara);
      expect(html).not.toBe("");
      expect(html).toContain('href="/"');
      expect(html).toContain("Volver a Inicio");
    }
  });

  // Mutación que la mata: enseñar el aviso del reloj siempre, o no enseñarlo
  // nunca. Irse a Inicio a media lectura es legal —las respuestas ya están
  // guardadas—, pero irse creyendo que el reloj se para, no.
  it("solo avisa de que el reloj sigue cuando hay reloj y está empezada", async () => {
    expect(await pintarPagina(haciendoLectura())).toContain("El reloj sigue corriendo.");
    expect(await pintarPagina(haciendoAuditiva())).not.toContain("El reloj sigue corriendo.");
    expect(await pintarPagina(sinEmpezar())).not.toContain("El reloj sigue corriendo.");
    expect(await pintarPagina(entregadaCon19De25())).not.toContain("El reloj sigue corriendo.");
  });

  // Mutación que la mata: dejar el reloj en la pantalla del modo libre.
  it("en libre no hay reloj ni entregar, y sí corregir", async () => {
    const html = await pintarPagina(enLibre());
    expect(html).not.toBe("");
    expect(html).toContain("Corregir");
    expect(html).not.toContain("Te quedan");
    expect(html).not.toContain("Entregar");
  });

  // "EE" ya pasa la guarda `esPrueba` (es una prueba real del DELE), y desde
  // la Task 5 también pasa `PRUEBAS_QUE_SE_HACEN` de verdad: `pruebaParaHacer`
  // ya no devuelve null para ella sola por estar excluida. Aquí `pruebaParaHacer`
  // está DOBLADO y se hace devolver null a propósito — no es la función real
  // filtrando por la lista —, así que esta prueba no comprueba que "EE" esté
  // excluida (ya no lo está): comprueba que la página trata «sin datos», venga
  // de donde venga, como 404. "EE" queda como ejemplo porque la pantalla
  // (`HacerPrueba`) todavía no sabe pintar una redacción, no por su guarda.
  // Mutación que la mata: quitar el `if (!leida) notFound();` de la página.
  // Sería una pantalla a medias, con `prueba={null}`.
  it("si pruebaParaHacer no encuentra nada la pantalla contesta 404", async () => {
    dobles.pruebaParaHacer.mockResolvedValue(null);
    await expect(pintarPaginaDe("EE")).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: quitar `if (!esPrueba(prueba)) notFound();`. Una
  // ruta inventada llegaría a llamar a `pruebaParaHacer` con un valor que
  // `Prueba` no admite.
  it("una prueba inventada no llega a pruebaParaHacer", async () => {
    await expect(pintarPaginaDe("XX")).rejects.toThrow("NOT_FOUND");
    expect(dobles.pruebaParaHacer).not.toHaveBeenCalled();
  });

  // Mutación que la mata: borrar `await exigirPersona()` de la página. El
  // doble de `redirect` ya lanzaba desde el principio de este fichero; hasta
  // ahora ningún test lo usaba.
  it("sin sesión, un desconocido no entra", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(null);
    await expect(pintarPaginaDe("CE")).rejects.toThrow("REDIRECT:/entrar");
    expect(dobles.pruebaParaHacer).not.toHaveBeenCalled();
  });

  // Mutación que la mata: no cerrar las pasadas de hora antes de pintar. Quien
  // cerró el portátil vería «a medias» para siempre.
  it("al abrir la pantalla se cierran las que se pasaron de hora", async () => {
    await pintarPagina(sinEmpezar());
    expect(dobles.cerrarLasQueSePasaron).toHaveBeenCalled();
  });

  // Mutación que la mata: volver a `prueba.estado.estado === "ENTREGADA"` en el
  // encaminado de HacerPrueba. Con el estado ESPERANDO, la prueba entregada
  // caería en la cara de «haciendo»: el estudiante vería otra vez sus preguntas
  // abiertas y un botón de entregar que ya no puede funcionar.
  it("una prueba entregada y sin corregir no se reabre", () => {
    const html = renderToStaticMarkup(
      <HacerPrueba prueba={entregadaCon19De25({ estado: { estado: "ESPERANDO", aciertos: null, total: null, porTiempo: false } })} />,
    );
    expect(html).not.toContain("Entregar");
  });
});

describe("«Corregir» en modo libre corrige la prueba entera pero solo cuenta y pinta la tarea abierta", () => {
  // La prueba que faltaba: hasta ahora nada ejecutaba `alCorregir` de verdad
  // (ni con jsdom ni de ninguna otra forma), así que un «Corregir» que
  // mandaba la letra buena del estudiante y se comía los fallos de las
  // otras tres tareas pasaba sin que nada lo notara.
  // Mutación que la mata: devolver `r` tal cual (sin filtrar `r.fallos` por
  // los números de la tarea, y sin recalcular `total`/`aciertos` sobre ese
  // subconjunto) — la CE-2 tiene 6 preguntas, no las 25 de toda la prueba.
  it("recorta la nota y los fallos del servidor a los números de la tarea abierta", async () => {
    const tarea = lecturaDos(); // CE-2: preguntas 7-12 (seis ítems)
    const accion = vi.fn().mockResolvedValue({
      aciertos: 22,
      total: 25,
      fallos: [
        { numero: 1, marcada: null }, // CE-1: fuera de la tarea abierta
        { numero: 8, marcada: "A" }, // CE-2: dentro
        { numero: 11, marcada: null }, // CE-2: dentro
        { numero: 19, marcada: null }, // CE-4: fuera
      ],
    });

    const r = await corregirTareaEnLibre("x1", "CE", { "8": "A" }, tarea, accion);

    expect(accion).toHaveBeenCalledWith("x1", "CE", { "8": "A" });
    expect(r).toEqual({ aciertos: 4, total: 6, fallos: [8, 11] });
  });

  // Mutación que la mata: no comprobar `"error" in r` antes de filtrar, y
  // reventar (o devolver `{ fallos: undefined }`) cuando la acción falla.
  it("si la acción devuelve error, lo deja pasar tal cual, sin tocar fallos", async () => {
    const tarea = lecturaDos();
    const accion = vi.fn().mockResolvedValue({ error: "Este examen ya no está disponible." });

    const r = await corregirTareaEnLibre("x1", "CE", {}, tarea, accion);

    expect(r).toEqual({ error: "Este examen ya no está disponible." });
  });
});

/**
 * La cinta, pintada sola. Solo se puede probar lo que es puro: el estado
 * INICIAL con el que nace y lo que sale del corto de `entregada`. Lo demás —el
 * encadenado, la pausa con cuenta atrás, el trozo que se apunta antes de sonar—
 * es estado de React movido por clics y por el `<audio>`, y sin jsdom no hay
 * forma honesta de tocarlo: sigue siendo paseo a mano (spec §10 y §11).
 *
 * Lo que tampoco se puede probar aquí, y conviene que esté dicho en voz alta:
 * la `key={tarea.numero}` de las tres llamadas a `CintaDeLaTarea`. Una `key`
 * solo hace algo al RE-renderizar (decide si React remonta o reaprovecha), y
 * `renderToStaticMarkup` monta una vez y se acaba: el marcado sale idéntico con
 * key y sin ella. Dos cintas hermanas en un mismo render tampoco valen — son
 * dos componentes distintos con estado propio, lleven key o no. Para fijarla
 * haría falta un renderizador que sepa re-renderizar (react-test-renderer),
 * que no está en el proyecto y que es justo lo que las reglas de esta suite
 * descartan. Queda escrito aquí en vez de fingir una prueba que pasa siempre.
 */
describe("la cinta", () => {
  function pintarCinta(extra: Partial<ComponentProps<typeof Cinta>> = {}): string {
    return renderToStaticMarkup(
      <Cinta
        ficheroId="audio-co-4"
        cortes={[113, 195]}
        trozos={3}
        oidos={[]}
        racionada
        alSonar={async () => ({})}
        {...extra}
      />,
    );
  }

  // Mutación que la mata: pintar el `src` del `<audio>` con el identificador
  // pelado (o con otra ruta): el único sitio que sirve ficheros, y con el
  // candado puesto, es /api/ficheros/<id>.
  it("sin nada oído, ofrece el botón y apunta a la ruta de ficheros", () => {
    const html = pintarCinta();
    expect(html).toContain('src="/api/ficheros/audio-co-4"');
    expect(html).toContain("Escuchar el audio");
    expect(html).not.toContain("Este audio ya ha sonado.");
  });

  // Mutación que la mata: quitar el `siguienteTrozo(oidos, trozos) === null`
  // del estado inicial y nacer siempre «listo». Al recargar la página con la
  // pista ya oída entera volvería a salir el botón, y pulsarlo marcaría otra
  // vez un trozo gastado.
  it("con todos los trozos oídos nace agotada", () => {
    const html = pintarCinta({ oidos: [1, 2, 3] });
    expect(html).toContain("Este audio ya ha sonado."); // que se pintó de verdad
    expect(html).not.toContain("Escuchar el audio");
  });

  // Mutación que la mata: quitar el `&& racionada` del estado inicial. En
  // práctica libre la cinta no se acaba nunca: nacer agotada porque `oidos`
  // venga lleno dejaría al estudiante sin poder repetir, que es justo lo que
  // el modo libre existe para poder hacer.
  it("en modo libre no nace agotada aunque le lleguen trozos oídos", () => {
    const html = pintarCinta({ racionada: false, oidos: [1, 2, 3] });
    expect(html).toContain("Escuchar el audio");
    expect(html).not.toContain("Este audio ya ha sonado.");
  });

  // Mutación que la mata: quitar el corto de `entregada` (el `if (entregada)`
  // de antes del `<audio>`). En una prueba entregada el intento está cerrado y
  // marcar un trozo siempre fallaría: no puede quedar ni botón ni reproductor.
  it("entregada se pinta agotada, sin botón y sin reproductor", () => {
    const html = pintarCinta({ entregada: true, oidos: [] });
    expect(html).toContain("Este audio ya ha sonado."); // que se pintó de verdad
    expect(html).not.toContain("Escuchar el audio");
    expect(html).not.toContain("<audio");
  });
});

describe("las pestañas de las tareas", () => {
  const TAREAS = [lecturaDos(), lecturaTres()];

  // Cambiar de tarea mientras suena un trozo racionado lo quema: la cinta se
  // desmonta (le cambia la `key`), el audio se corta y el trozo ya quedó
  // apuntado como oído en el servidor. Lo que esta prueba fija es la mitad que
  // se puede pintar: que `bloqueadas` llega a los botones. La otra mitad —que
  // ese `true` sale de la cinta cuando empieza a sonar— es estado de React y
  // no se puede ver con un render estático; queda para el paseo a mano.
  // Mutación que la mata: quitar el `disabled={bloqueadas}` de los botones.
  it("se apagan cuando el armazón dice que hay un trozo sonando", () => {
    const apagadas = renderToStaticMarkup(
      <PestanasDeTarea tareas={TAREAS} abierta={2} alElegir={() => {}} bloqueadas />,
    );
    expect(apagadas).toContain("Tarea 2"); // que se pintaron de verdad
    expect(apagadas.match(/disabled=""/g) ?? []).toHaveLength(2);
  });

  // Mutación que la mata: apagarlas siempre (dejar `disabled` fijo, o
  // invertir `bloqueadas`). Con las pestañas muertas no se puede volver a una
  // tarea anterior, que es lo normal en la lectura.
  it("con la cinta callada se puede cambiar de tarea", () => {
    const vivas = renderToStaticMarkup(<PestanasDeTarea tareas={TAREAS} abierta={2} alElegir={() => {}} />);
    expect(vivas).toContain("Tarea 3"); // que se pintaron de verdad
    // El atributo, no la palabra: la clase `disabled:opacity-50` lleva
    // «disabled» dentro y un `not.toContain("disabled")` a secas no podría
    // ponerse verde nunca.
    expect(vivas).not.toContain('disabled=""');
  });
});

describe("el reloj", () => {
  // `segundosHasta` es la única parte del reloj que se puede probar: lo demás
  // son temporizadores. Se le pasa el «ahora» a mano, como a todo lo que mira
  // la hora en esta suite.
  // Mutación que la mata: quitar el `Math.max(0, ...)`. Un móvil bloqueado
  // suspende los temporizadores, y al volver pasada la hora la diferencia es
  // negativa: la pantalla pintaría «Te quedan -2:-40».
  it("nunca baja de cero, aunque se vuelva pasada la hora", () => {
    expect(segundosHasta(1_000_000, 1_160_000)).toBe(0);
  });

  // Mutación que la mata: devolver la diferencia sin dividir por mil (pintaría
  // los milisegundos), o no mirar `ahora` — que es lo que hacía el reloj
  // viejo, que restaba de un contador y por eso una pestaña dormida le
  // regalaba al estudiante todo el rato que hubiera estado apagada.
  it("cuenta lo que falta para la hora de fin", () => {
    const limite = 1_000_000;
    expect(segundosHasta(limite, limite - 3_000)).toBe(3);
    expect(segundosHasta(limite, limite - 300_000)).toBe(300);
  });

  // Mutación que la mata: pintar los segundos crudos («Te quedan 2945»), o
  // perder el cero de relleno («Te quedan 49:5»).
  it("pinta minutos y segundos con su cero delante", () => {
    expect(renderToStaticMarkup(<Reloj segundos={2945} alAcabarse={() => {}} />)).toContain("Te quedan 49:05");
  });

  // Mutación que la mata: cambiar el `quedan <= 300` del aviso rojo (quitarlo,
  // o ponerlo al revés). Los últimos cinco minutos se avisan; antes, no.
  it("los últimos cinco minutos van en rojo, y el minuto anterior no", () => {
    const cinco = renderToStaticMarkup(<Reloj segundos={300} alAcabarse={() => {}} />);
    const seis = renderToStaticMarkup(<Reloj segundos={301} alAcabarse={() => {}} />);
    expect(cinco).toContain("text-error-600");
    expect(seis).toContain("Te quedan 5:01"); // que se pintó de verdad
    expect(seis).not.toContain("text-error-600");
  });
});

describe("el aviso de palabras", () => {
  // Mutación que la mata: comparar solo con el máximo. Quedarse corto también
  // es un fallo del examen, y es el más común.
  it("avisa por arriba y por abajo, y calla si no hay rango", () => {
    expect(avisoDePalabras(90, { min: 80, max: 100 })).toEqual({ texto: "90 palabras (te piden entre 80 y 100)", pasada: false });
    expect(avisoDePalabras(120, { min: 80, max: 100 }).pasada).toBe(true);
    expect(avisoDePalabras(12, { min: 80, max: 100 }).pasada).toBe(true);
    expect(avisoDePalabras(1, { min: null, max: null })).toEqual({ texto: "1 palabra", pasada: false });
  });
});

describe("el folio", () => {
  // Mutación que la mata: pintar el textarea sin `defaultValue`/`value`. Al
  // volver de un corte, el folio saldría en blanco con el reloj corriendo.
  it("trae lo ya escrito y su cuenta", () => {
    const html = renderToStaticMarkup(
      <Folio texto="Hola qué tal" rango={{ min: 80, max: 100 }} bloqueado={false} alEscribir={() => {}} />,
    );
    expect(html).toContain("Hola qué tal");
    expect(html).toContain("3 palabras (te piden entre 80 y 100)");
  });

  // Mutación que la mata: ignorar `bloqueado`. En la prueba entregada el folio
  // tiene que estar apagado de verdad, no solo parecerlo. Ojo: la propia
  // clase `disabled:bg-tinta-suave/5` contiene la palabra «disabled», así
  // que un `toContain("disabled")` a secas pasaría aunque se borrara el
  // atributo. Hay que mirar el `<textarea>` y su atributo real.
  it("bloqueado no se puede escribir", () => {
    const html = renderToStaticMarkup(
      <Folio texto="Ya está" rango={{ min: null, max: null }} bloqueado alEscribir={() => {}} />,
    );
    const textarea = html.match(/<textarea[^>]*>/)?.[0] ?? "";
    expect(textarea).toContain('disabled=""');
  });

  // Mutación que la mata: quitar `maxLength={LETRAS_TOPE}` del <textarea>. Sin
  // él, un pegado largo entra en el folio, el servidor lo rechaza con «Ese
  // texto es demasiado largo.» y el estudiante se queda con un texto que no se
  // guarda. El tope es el MISMO que comprueba `guardarEscrito`: se afirma
  // contra la constante, no contra un número escrito a mano, para que no pueda
  // quedarse desparejado.
  it("no deja pegar más letras de las que el servidor acepta", () => {
    const html = renderToStaticMarkup(
      <Folio texto="Hola" rango={{ min: null, max: null }} bloqueado={false} alEscribir={() => {}} />,
    );
    const textarea = html.match(/<textarea[^>]*>/)?.[0] ?? "";
    expect(textarea).toContain(`maxLength="${LETRAS_TOPE}"`);
  });
});

describe("el enunciado de la escrita", () => {
  // Mutación que la mata: pintar todas las opciones como si estuvieran
  // elegidas, o no marcar la elegida. El estudiante no sabría sobre cuál
  // escribe, y es lo único que distingue su tarea 2 de la del de al lado.
  // Cuenta las apariciones de `checked=""`, no solo si hay alguna: con
  // `checked={true}` fijo, las DOS opciones saldrían marcadas y una prueba
  // que solo mirase "hay al menos una" no lo vería.
  it("la tarea 2 marca la opción elegida", () => {
    const html = renderToStaticMarkup(
      <EnunciadoDeEscrita formulario={escritaDos()} opcionElegida={2} alElegir={() => {}} />,
    );
    expect(html).toContain("Opción 1");
    expect(html).toContain("Opción 2");
    expect(html.match(/checked=""/g) ?? []).toHaveLength(1);
  });

  // Mutación que la mata: dejar el `disabled={bloqueado || !alElegir}` solo
  // con `!alElegir` (o quitarlo). Con la escrita bloqueada, el estudiante no
  // debe poder cambiar de opción aunque llegue `alElegir`. Se mira el
  // atributo de cada `<input>`, no una clase que se llame parecido.
  it("bloqueado no se puede elegir otra opción", () => {
    const html = renderToStaticMarkup(
      <EnunciadoDeEscrita formulario={escritaDos()} opcionElegida={1} alElegir={() => {}} bloqueado />,
    );
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    expect(inputs.every((tag) => tag.includes('disabled=""'))).toBe(true);
  });

  // Mutación que la mata: no pintar el texto recibido. En la tarea 1 es el
  // correo al que hay que contestar: sin él no hay tarea.
  it("la tarea 1 pinta la situación, el correo y las pautas", () => {
    const html = renderToStaticMarkup(<EnunciadoDeEscrita formulario={escritaUna()} opcionElegida={null} />);
    expect(html).toContain("Un amigo te escribe");
    expect(html).toContain("¿Vienes el sábado?");
    expect(html).toContain("Salúdale");
  });
});

describe("la escrita", () => {
  // Mutación que la mata: guardar siempre que salte el temporizador, haya
  // cambiado algo o no. Serían cientos de escrituras por redacción, y cada una
  // reescribiendo la misma fila con lo mismo.
  it("solo guarda lo que ha cambiado", () => {
    expect(hayQueGuardar({ texto: "Hola", opcion: null }, { texto: "Hola", opcion: null })).toBe(false);
    expect(hayQueGuardar({ texto: "Hola", opcion: null }, { texto: "Hola ", opcion: null })).toBe(true);
    expect(hayQueGuardar({ texto: "Hola", opcion: null }, { texto: "Hola", opcion: 2 })).toBe(true);
  });

  // Mutación que la mata: avisar solo del folio vacío y olvidar la opción sin
  // elegir. Se puede entregar una tarea 2 escrita sobre ninguna opción.
  it("dice lo que falta antes de entregar", () => {
    expect(loQueFalta(escritaParaHacer(), { 1: { texto: "", opcion: null }, 2: { texto: "Algo", opcion: 1 } })).toEqual([
      "la tarea 1 está en blanco",
    ]);
    expect(loQueFalta(escritaParaHacer(), { 1: { texto: "Algo", opcion: null }, 2: { texto: "Algo", opcion: null } })).toEqual([
      "no has elegido opción en la tarea 2",
    ]);
    expect(loQueFalta(escritaParaHacer(), { 1: { texto: "A", opcion: null }, 2: { texto: "B", opcion: 1 } })).toEqual([]);
  });

  // Mutación que la mata: sembrar los borradores recorriendo `escritos` en vez
  // de `tareas`. La tarea que todavía no se ha tocado no tendría borrador, y el
  // folio de la 2 nacería `undefined`: la pantalla revienta al abrirla.
  it("siembra un borrador por tarea, con lo ya escrito", () => {
    expect(borradoresDe(escritaEsperando())).toEqual({
      1: { texto: CARTA, opcion: null },
      2: { texto: FIN_DE_SEMANA, opcion: 2 },
    });
    expect(borradoresDe(escritaSinEmpezar())).toEqual({
      1: { texto: "", opcion: null },
      2: { texto: "", opcion: null },
    });
  });

  // Mutación que la mata: devolver `true` para cualquier mensaje (que es como
  // estaba: un pestillo de un solo sentido que apagaba los folios con el primer
  // error, fuera el que fuera, y no los volvía a abrir nunca). El caso agudo es
  // «Ese texto es demasiado largo.»: el folio apagado con el texto largo dentro
  // deja al estudiante sin poder ni seguir ni recortar.
  //
  // Se afirma contra la constante compartida, no contra el literal escrito otra
  // vez aquí: si el mensaje del servidor cambiara, esta prueba tiene que seguir
  // hablando del mismo error, no de una cadena que ya no existe.
  it("solo el error del tiempo apaga los folios", () => {
    expect(apagaLosFolios(SE_ACABO_EL_TIEMPO)).toBe(true);
    expect(apagaLosFolios("Ese texto es demasiado largo.")).toBe(false);
    expect(apagaLosFolios("Esa tarea no existe.")).toBe(false);
    expect(apagaLosFolios("Esa opción no existe.")).toBe(false);
    expect(apagaLosFolios("Este examen ya no está disponible.")).toBe(false);
    expect(apagaLosFolios("Este examen no es tuyo.")).toBe(false);
  });

  // Mutación que la mata: al elegir otra opción, devolver un borrador nuevo
  // (`{ texto: "", opcion }`) en vez de conservar el folio. El chico que
  // empieza, se arrepiente y cambia de tema perdería lo escrito.
  it("cambiar de opción no borra el folio, ni escribir borra la opción", () => {
    expect(conOpcion({ texto: "Mi carta", opcion: 1 }, 2)).toEqual({ texto: "Mi carta", opcion: 2 });
    expect(conTexto({ texto: "Mi carta", opcion: 1 }, "Mi carta más larga")).toEqual({ texto: "Mi carta más larga", opcion: 1 });
  });

  // Mutación que la mata: quitar el encaminado de "EE" y dejar que la escrita
  // caiga en PruebaHaciendo. Pediría letras sobre preguntas que no existen y no
  // pintaría folio ninguno.
  it("a medias trae el reloj, el enunciado y el folio abierto", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaParaHacer()} />);
    expect(html).toContain("Te quedan");
    expect(html).toContain("Lee el correo y contesta.");
    expect(html).toContain(CARTA);
    expect(html).toContain("Entregar");
    // El folio de la tarea abierta se puede escribir: se mira el atributo del
    // `<textarea>`, no la palabra «disabled» suelta (la clase de Tailwind
    // `disabled:bg-tinta-suave/5` la lleva dentro).
    const textarea = html.match(/<textarea[^>]*>/)?.[0] ?? "";
    expect(textarea).not.toBe("");
    expect(textarea).not.toContain('disabled=""');
  });

  // Mutación que la mata: enseñar el folio antes del aviso. El «se entrega ella
  // sola» hay que decirlo ANTES de que el reloj empiece a correr.
  it("sin empezar avisa de los minutos y no enseña folio", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaSinEmpezar()} />);
    expect(html).toContain("50 minutos");
    expect(html).toContain("no se puede repetir");
    expect(html).toContain("Empezar");
    expect(html).not.toContain("<textarea");
  });

  // Mutación que la mata: usar la cara de la lectura para la escrita. La
  // pantalla pediría letras sobre preguntas que no existen.
  it("la escrita entregada y sin corregir dice que espera", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaEsperando()} />);
    expect(html).toContain("Esperando corrección");
    expect(html).not.toContain("Entregar");
  });

  // Mutación que la mata: pasar `bloqueado={false}` a los folios de la
  // entregada. Se podría reescribir encima de lo entregado y hasta creer que
  // eso cambia algo, cuando ya no se guarda nada.
  it("la entregada enseña sus dos folios apagados, con lo que mandó", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaEsperando()} />);
    expect(html).toContain(FIN_DE_SEMANA);
    const folios = html.match(/<textarea[^>]*>/g) ?? [];
    expect(folios).toHaveLength(2);
    expect(folios.every((t) => t.includes('disabled=""'))).toBe(true);
    // Y la opción que eligió sigue marcada, sin poder cambiarla.
    const opciones = html.match(/<input[^>]*>/g) ?? [];
    expect(opciones).toHaveLength(2);
    expect(opciones.every((t) => t.includes('disabled=""'))).toBe(true);
    expect(html.match(/checked=""/g) ?? []).toHaveLength(1);
  });

  // Mutación que la mata: pintar la nota sin mirar `correccion`. Diría «null de
  // 24» a quien todavía no ha sido corregido.
  it("la escrita corregida enseña las bandas, los comentarios y la suma", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaCorregida()} />);
    expect(html).toContain("18 de 24");
    expect(html).toContain("Adecuación al género discursivo");
    expect(html).toContain("Muy bien el saludo");
  });

  // Mutación que la mata: pintar la `ayuda` del criterio esté vacía o no. Hoy
  // las cuatro están vacías a propósito (las dicta el profesor), y saldrían
  // cuatro renglones en blanco bajo cada criterio.
  it("la corregida no pinta la ayuda vacía, ni deja entregar otra vez", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaCorregida()} />);
    expect(html).not.toContain("data-ayuda");
    expect(html).not.toContain("Entregar");
    // Las dos tareas, no solo la primera: el comentario de la 2 también es suyo.
    expect(html).toContain("Cuida los acentos");
  });

  // Mutación que la mata: dejar que la práctica libre pase por una cara aparte
  // que no guarda ni entrega. La decisión es la contraria (spec §9): en libre
  // la escrita se guarda y se entrega IGUAL que en un examen de verdad, sin
  // reloj y nada más.
  it("en libre se escribe y se puede entregar, igual que en un examen de verdad", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaLibreHaciendo()} />);
    expect(html).toContain("<textarea");
    expect(html).not.toContain("Te quedan");
    expect(html).toContain("Entregar");
  });

  // Mutación que la mata: pintar el reloj también en libre. Le pondría una cuenta
  // atrás de cincuenta minutos a algo que no se cierra nunca: pura mentira.
  it("la escrita libre no enseña reloj y lo dice en el aviso", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaLibre()} />);
    expect(html).not.toContain("50 minutos");
    expect(html).toContain("sin reloj");
  });

  // Mutación que la mata: encaminar la escrita ANTES del <VolverAInicio> de
  // HacerPrueba y no poner ninguna salida en su sitio. Es exactamente el fallo
  // que el profesor cazó en la lectura: la pantalla se queda sin salida y solo
  // se sale con el botón de atrás del navegador.
  it("las cuatro caras de la escrita tienen salida a Inicio", () => {
    for (const cara of [escritaSinEmpezar(), escritaParaHacer(), escritaEsperando(), escritaCorregida()]) {
      const html = renderToStaticMarkup(<HacerPrueba prueba={cara} />);
      expect(html).toContain('href="/"');
      expect(html).toContain("Volver a Inicio");
    }
  });

  // Mutación que la mata: avisar del reloj siempre (o nunca). Irse a Inicio a
  // media redacción es legal —el borrador ya está guardado—, pero irse creyendo
  // que el reloj se para, no.
  it("solo avisa de que el reloj sigue cuando de verdad corre", () => {
    expect(renderToStaticMarkup(<HacerPrueba prueba={escritaParaHacer()} />)).toContain("El reloj sigue corriendo.");
    for (const cara of [escritaSinEmpezar(), escritaEsperando(), escritaCorregida(), escritaLibreHaciendo()]) {
      expect(renderToStaticMarkup(<HacerPrueba prueba={cara} />)).not.toContain("El reloj sigue corriendo.");
    }
  });

  // Mutación que la mata: dar por corregida la escrita con solo la firma (o con
  // solo la nota). Con la firma sola y sin `aciertos` la cabecera pinta «null de
  // 24»; sin `total`, «18 de null»; y con la nota puesta pero sin firmar, las
  // bandas ni siquiera han salido de `pruebaParaHacer` y saldrían cuatro ceros.
  // Es pura y se prueba sola: la cara de la pantalla no distingue los tres casos.
  it("corregida es la firma Y la nota entera, no una de las dos", () => {
    expect(estaCorregida(escritaCorregida())).toBe(true);
    expect(estaCorregida(escritaCorregida({ estado: { estado: "ENTREGADA", aciertos: null, total: 24, porTiempo: false } }))).toBe(false);
    expect(estaCorregida(escritaCorregida({ estado: { estado: "ENTREGADA", aciertos: 18, total: null, porTiempo: false } }))).toBe(false);
    expect(estaCorregida(escritaCorregida({ corregidaEn: null }))).toBe(false);
    expect(estaCorregida(escritaEsperando())).toBe(false);
  });

  // Mutación que la mata: mirar solo la tarea abierta al decidir el cartelito.
  // Quien escribe en la tarea 1, cambia a la 2 y ve «Guardado» mientras lo de la
  // 1 sigue sin mandarse, cierra la pestaña tranquilo y lo pierde.
  it("sabe si queda algo sin mandar en CUALQUIER tarea", () => {
    const enServidor = { 1: { texto: "Hola", opcion: null }, 2: { texto: "", opcion: 2 } };
    expect(hayAlgoSinGuardar(enServidor, enServidor)).toBe(false);
    expect(hayAlgoSinGuardar(enServidor, { ...enServidor, 1: { texto: "Hola Juan", opcion: null } })).toBe(true);
    expect(hayAlgoSinGuardar(enServidor, { ...enServidor, 2: { texto: "", opcion: 1 } })).toBe(true);
    // Una tarea que el servidor todavía no conoce y ya tiene texto: sin mandar.
    expect(hayAlgoSinGuardar({}, { 1: { texto: "Algo", opcion: null } })).toBe(true);
  });

  // Mutación que la mata: volver a «Te falta {falta.join(" y ")}», que con las
  // cadenas de `loQueFalta` sale «Te falta la tarea 1 está en blanco.». Lo lee un
  // chaval de catorce años justo antes de entregar. La pieza se pinta sola
  // porque dentro de la pantalla solo aparece tras un clic, y aquí no hay jsdom.
  it("la pregunta de entrega está escrita en castellano", () => {
    const html = renderToStaticMarkup(
      <PreguntaDeEntrega
        falta={["la tarea 1 está en blanco", "no has elegido opción en la tarea 2"]}
        enviando={false}
        alSi={() => {}}
        alNo={() => {}}
      />,
    );
    expect(html).toContain("Ojo: la tarea 1 está en blanco y no has elegido opción en la tarea 2. ¿Entregar de todas formas?");
    expect(html).toContain("Sí, entregar");
    expect(html).toContain("Seguir escribiendo");
  });

  // Mutación que la mata: enseñar la lista de lo que falta aunque esté vacía
  // («Ojo: . ¿Entregar de todas formas?»), o callarse el «no se puede deshacer»
  // cuando está todo hecho, que es cuando más de verdad va la entrega.
  it("con todo hecho, la pregunta avisa de que no se puede deshacer", () => {
    const html = renderToStaticMarkup(
      <PreguntaDeEntrega falta={[]} enviando={false} alSi={() => {}} alNo={() => {}} />,
    );
    expect(html).toContain("Entregar no se puede deshacer. ¿Entregar?");
    expect(html).not.toContain("Ojo:");
  });

  // Mutación que la mata: no pintar `entregadaEn` en la cara de espera. Un chico
  // que lleva días viendo «esperando corrección» sin fecha no sabe si su
  // redacción llegó o se perdió por el camino.
  it("la que espera dice cuándo la mandó", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaEsperando()} />);
    expect(html).toContain("La mandaste el 15 de septiembre de 2026");
  });
});

// ── Las pantallas del profesor: /corregir ──────────────────────────────────
// Mismas dos personas de siempre: ana (ESTUDIANTE, definida arriba) y un
// profesor nuevo, porque hasta ahora ninguna prueba de este fichero
// necesitaba uno.
const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ana = ESTUDIANTE;
const profe = PROFESOR;

function tareaParaCorregir(
  numero: 1 | 2,
  texto: string,
  opcion: number | null,
  bandas: number[] = [],
  comentario = "",
): TareaParaCorregir {
  return {
    numero,
    formulario: numero === 1 ? escritaUna() : escritaDos(),
    opcion,
    texto,
    palabras: palabras(texto),
    bandas,
    comentario,
  };
}

// Dos tareas, como el examen de verdad: la 1 (REDACCION_UNA, el correo) con
// lo que escribió Ana, y la 2 (REDACCION_DOS) con su opción elegida.
function paraCorregirDePrueba(extra: Partial<ParaCorregir> = {}): ParaCorregir {
  return {
    intentoId: "i1",
    examen: { id: "ex1", titulo: "Libro, examen 1", nivel: "A2_B1_ESCOLAR" },
    persona: { id: "e1", nombre: "Ana" },
    entregadaEn: new Date("2026-09-15T09:30:00.000Z"),
    porTiempo: false,
    corregidaEn: null,
    puntos: 24,
    tareas: [
      tareaParaCorregir(1, "Hola, qué tal, el sábado no puedo.", null),
      tareaParaCorregir(2, "Mi fin de semana ideal es un sábado en el río.", 2),
    ],
    siguiente: null,
    ...extra,
  };
}

describe("Por corregir: la cola del profesor", () => {
  beforeEach(() => {
    dobles.escritosPorCorregir.mockResolvedValue([]);
  });

  // Mutación que la mata: quitar exigirProfesor de la página. Un estudiante
  // vería los textos y las notas de todos sus compañeros con solo escribir la
  // dirección.
  it("la cola no se le enseña a un estudiante", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ana); // ESTUDIANTE
    const { default: Cola } = await import("@/app/corregir/page");
    await expect(Cola()).rejects.toThrow();
    expect(dobles.escritosPorCorregir).not.toHaveBeenCalled();
  });

  // Mutación que la mata: pintar la cola sin los días de espera. Es el único dato
  // que dice por dónde empezar.
  it("la cola dice quién, qué examen y cuántos días lleva", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.escritosPorCorregir.mockResolvedValue([
      { intentoId: "i1", examenId: "ex1", titulo: "Libro, examen 1", persona: { id: "p1", nombre: "Ana" }, entregadaEn: new Date("2026-09-20T09:00:00Z"), porTiempo: true, diasEsperando: 3 },
    ]);
    const html = renderToStaticMarkup(await Cola());
    expect(html).toContain("Ana");
    expect(html).toContain("Libro, examen 1");
    expect(html).toContain("3 días");
    expect(html).toContain("por tiempo");
  });

  // Mutación que la mata: pintar la cola vacía sin decir nada (una lista
  // vacía y ya está), que deja al profesor sin saber si es que no hay nada o
  // si es que la pantalla se rompió a medias.
  it("con la cola vacía lo dice en una línea", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    const html = renderToStaticMarkup(await Cola());
    expect(html).toContain("No hay nada esperando.");
  });

  // Mutación que la mata: enlazar todas las filas al mismo sitio, o a
  // `/corregir` sin el id.
  it("cada fila enlaza a su propia corrección", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.escritosPorCorregir.mockResolvedValue([
      { intentoId: "i7", examenId: "ex1", titulo: "Examen 1", persona: { id: "p1", nombre: "Ana" }, entregadaEn: new Date("2026-09-20T09:00:00Z"), porTiempo: false, diasEsperando: 0 },
    ]);
    const html = renderToStaticMarkup(await Cola());
    expect(html).toContain('href="/corregir/i7"');
  });

  // Mutación que la mata: cerrar las que se pasaron de hora desde esta
  // pantalla. Decidido en el brief: la cola solo lee, y el cierre es de quien
  // tiene ámbito (el Inicio del estudiante y la lista del examen).
  it("no cierra las que se pasaron de hora: solo lee", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    await Cola();
    expect(dobles.cerrarLasQueSePasaron).not.toHaveBeenCalled();
  });
});

describe("La pantalla de corregir una redacción: /corregir/[intentoId]", () => {
  // Mutación que la mata: quitar exigirProfesor de esta página también. Es la
  // segunda mitad de la misma puerta que la cola: sin ella, un estudiante que
  // adivine el id de un compañero vería su texto entero y podría firmarle
  // una nota.
  it("tampoco se le enseña a un estudiante", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ana);
    await expect(PantallaDeCorregir({ params: Promise.resolve({ intentoId: "i1" }) })).rejects.toThrow();
    expect(dobles.escritoParaCorregir).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar el `if (!para) notFound();`. Un id que no
  // existe (o de un intento que ya no es de escrita) pintaría la pantalla con
  // datos a medias en vez de contestar 404.
  it("un intento que no existe contesta 404", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.escritoParaCorregir.mockResolvedValue(null);
    await expect(PantallaDeCorregir({ params: Promise.resolve({ intentoId: "i1" }) })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: no pasarle `para` a <CorregirEscrita>, o pasarle
  // otra cosa distinta de lo que devolvió escritoParaCorregir.
  it("con datos, pinta la corrección de esa redacción", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.escritoParaCorregir.mockResolvedValue(paraCorregirDePrueba());
    const elemento = await PantallaDeCorregir({ params: Promise.resolve({ intentoId: "i1" }) });
    const html = renderToStaticMarkup(elemento);
    expect(html).toContain("Ana");
    expect(html).toContain("Hola, qué tal");
    expect(dobles.escritoParaCorregir).toHaveBeenCalledWith("i1", expect.any(Date));
  });
});

describe("CorregirEscrita: la pantalla de las ocho bandas", () => {
  // Mutación que la mata: pintar las bandas sin `max` (o con uno distinto de
  // BANDA_MAXIMA). Se podría firmar un 7 en un criterio que llega hasta 3.
  it("la pantalla de corregir trae las ocho casillas y los dos textos", () => {
    const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect(html).toContain("Adecuación al género discursivo");
    expect(html).toContain('max="3"');
    expect((html.match(/type="number"/g) ?? []).length).toBe(8);
    expect(html).toContain("Hola, qué tal");
  });

  // Mutación que la mata: quitar `min={0}` o `step={1}` de la casilla. Con
  // solo el `max` puesto, todavía se podría escribir una nota negativa o con
  // decimales.
  it("las ocho casillas van de 0 a 3, entero a entero", () => {
    const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect((html.match(/min="0"/g) ?? []).length).toBe(8);
    expect((html.match(/step="1"/g) ?? []).length).toBe(8);
  });

  // Mutación que la mata: pintar la `ayuda` esté vacía o no (o quitarle el
  // `data-ayuda`, que es la marca que una prueba hermana usa para lo mismo en
  // hacer-escrita.tsx). Hoy los cuatro criterios llegan con `ayuda` vacía a
  // propósito, así que ningún `data-ayuda` puede aparecer todavía.
  it("hoy, sin ayuda dictada, no se pinta ningún renglón de ayuda", () => {
    const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect(html).not.toContain("data-ayuda");
  });

  // Mutación que la mata: enseñar el enunciado editable (sin `bloqueado`), o
  // no enseñarlo. El profesor tiene que ver a qué contestaba el chico, pero
  // de solo lectura: no es él quien la responde.
  it("el enunciado de cada tarea sale de solo lectura, para ver a qué contestaba", () => {
    const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect(html).toContain("Un amigo te escribe"); // tarea 1
    expect(html).toContain("Opción 1"); // tarea 2
    const radiosDeLaOpcion = html.match(/<input[^>]*name="opcion-de-la-escrita"[^>]*>/g) ?? [];
    expect(radiosDeLaOpcion.length).toBeGreaterThan(0);
    expect(radiosDeLaOpcion.every((r) => r.includes('disabled=""'))).toBe(true);
  });

  // Mutación que la mata: quitar el aviso de que ya se corrigió, o pintarlo
  // aunque `corregidaEn` sea null. Firmar es un acto con fecha: si el
  // profesor ya la corrigió, la pantalla tiene que decírselo y avisar de que
  // volver a guardar la cambia.
  it("si ya se corrigió, avisa de la fecha y de que guardar la cambia", () => {
    const sinCorregir = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect(sinCorregir).not.toContain("Ya la corregiste");

    const yaCorregida = renderToStaticMarkup(
      <CorregirEscrita
        para={paraCorregirDePrueba({
          corregidaEn: new Date("2026-09-16T10:00:00.000Z"),
          tareas: [
            tareaParaCorregir(1, "Hola, qué tal, el sábado no puedo.", null, [3, 2, 2, 1], "Muy bien el saludo"),
            tareaParaCorregir(2, "Mi fin de semana ideal es un sábado en el río.", 2, [3, 3, 2, 2], "Cuida los acentos"),
          ],
        })}
      />,
    );
    expect(yaCorregida).toContain("Ya la corregiste");
    expect(yaCorregida).toContain("se cambia");
  });

  // Mutación que la mata: sembrar las casillas a 0 en vez de vacías cuando
  // nunca se corrigió (`bandasIniciales` devolviendo `bandas.map(() => 0)`,
  // como estaba antes del arreglo). Un profesor que solo rellenara la tarea 1
  // y guardara firmaría la tarea 2 con cuatro ceros que nadie puso.
  it("sin corrección previa, las ocho casillas nacen vacías, no en cero", () => {
    const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect((html.match(/value=""/g) ?? []).length).toBe(8);
    expect(html).not.toContain('value="0"');
  });

  // Mutación que la mata: no sembrar las casillas con las bandas que ya
  // trajera `para` cuando SÍ hay corrección previa (dejarlas vacías siempre).
  // El profesor que reabre una redacción ya firmada vería sus propias notas
  // borradas.
  it("con corrección previa, las ocho casillas traen sus valores", () => {
    const html = renderToStaticMarkup(
      <CorregirEscrita
        para={paraCorregirDePrueba({
          corregidaEn: new Date("2026-09-16T10:00:00.000Z"),
          tareas: [
            tareaParaCorregir(1, "Hola, qué tal, el sábado no puedo.", null, [3, 2, 2, 1], "Muy bien el saludo"),
            tareaParaCorregir(2, "Mi fin de semana ideal es un sábado en el río.", 2, [3, 3, 2, 0], "Cuida los acentos"),
          ],
        })}
      />,
    );
    // Ninguna casilla vacía: las ocho traen su nota.
    expect(html).not.toContain('value=""');
    // El 0 de la última casilla de la tarea 2 sigue siendo un 0 de verdad, no
    // "sin nota": si `bandasIniciales` tratara un 0 guardado como vacío, esta
    // casilla saldría en blanco.
    expect((html.match(/value="0"/g) ?? []).length).toBe(1);
    expect((html.match(/value="1"/g) ?? []).length).toBe(1);
  });

  // Mutación que la mata: pintar el texto del estudiante sin su cuenta de
  // palabras. El profesor corrige alcance, y sin el número a la vista tiene
  // que contarlas él mismo.
  it("el texto del estudiante trae su cuenta de palabras", () => {
    const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
    expect(html).toContain(`${palabras("Hola, qué tal, el sábado no puedo.")} palabras`);
  });
});

describe("BotonesDeGuardar", () => {
  // Mutación que la mata: quitar `disabled={procesando}` de los dos botones.
  // Sin él, un doble clic (o la misma redacción abierta en dos pestañas)
  // manda dos firmas a la vez. Mismo patrón que PestanasDeTarea (piezas.tsx):
  // se cuentan los `disabled=""`, no la palabra suelta.
  it("con procesando, los dos botones se apagan", () => {
    const html = renderToStaticMarkup(
      <BotonesDeGuardar procesando alGuardar={() => {}} alGuardarYSeguir={() => {}} />,
    );
    expect(html).toContain("Guardar y seguir"); // que se pintaron de verdad
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
  });

  // Mutación que la mata: apagarlos siempre (`disabled` fijo), o invertir
  // `procesando`. Sin guardado en marcha, el profesor tiene que poder pulsar.
  it("sin procesando, los dos botones están vivos", () => {
    const html = renderToStaticMarkup(
      <BotonesDeGuardar procesando={false} alGuardar={() => {}} alGuardarYSeguir={() => {}} />,
    );
    expect(html).toContain("Guardar y seguir");
    expect(html).not.toContain('disabled=""');
  });

  // Mutación que la mata: no ofrecer «Guardar y seguir», o pintar los dos
  // botones como enlaces en vez de `<button type="button">`.
  it("son los dos <button type=\"button\">, no enlaces ni un submit", () => {
    const html = renderToStaticMarkup(
      <BotonesDeGuardar procesando={false} alGuardar={() => {}} alGuardarYSeguir={() => {}} />,
    );
    const botones = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)];
    const deGuardar = botones.filter((b) => b[1] === "Guardar" || b[1] === "Guardar y seguir");
    expect(deGuardar).toHaveLength(2);
    expect(deGuardar.every((b) => b[0].includes('type="button"'))).toBe(true);
  });
});

describe("La ficha pregunta a pregunta: /examenes/[id]/hoja/[personaId]/[prueba]", () => {
  function hojaDePrueba(extra: Partial<HojaDeRespuestas> = {}): HojaDeRespuestas {
    return {
      persona: { nombre: "Ana" },
      titulo: "Examen 1",
      prueba: "CE",
      aciertos: 19,
      total: 25,
      filas: [
        { numero: 7, marcada: "A", correcta: "A" },
        { numero: 8, marcada: "C", correcta: "B" },
        { numero: 9, marcada: null, correcta: "C" },
      ],
      ...extra,
    };
  }

  // Mutación que la mata: quitar exigirProfesor de la página de la ficha. Sería
  // la puerta por la que la clave del examen sale hacia un estudiante.
  it("la ficha no se le enseña a un estudiante", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ana);
    const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");
    // El `rejects.toThrow()` de aquí abajo NO basta solo: sin `exigirProfesor`,
    // `hojaDeRespuestas` (doblada, sin mockResolvedValue) da `undefined`, y
    // `if (!hoja) notFound()` también tira — la pantalla seguiría rechazando
    // por el motivo EQUIVOCADO. La aserción que de verdad mata «quitar
    // exigirProfesor» es la siguiente: sin la puerta, sí se llegaría a llamar
    // a hojaDeRespuestas. Que nadie la borre por parecer redundante.
    await expect(Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) })).rejects.toThrow();
    expect(dobles.hojaDeRespuestas).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar el `esPrueba(prueba) || notFound()`. Una
  // dirección con una prueba inventada («XX») tendría que dar 404, no colarse
  // hasta llamar a hojaDeRespuestas con un valor que no es una Prueba.
  it("una prueba que no existe contesta 404 sin llegar a mirar la base", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");
    await expect(Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "XX" }) })).rejects.toThrow("NOT_FOUND");
    expect(dobles.hojaDeRespuestas).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar el `if (!hoja) notFound()`. Una prueba sin
  // entregar (hojaDeRespuestas da null) tiene que dar 404, no una pantalla
  // rota a medio pintar.
  it("sin ficha todavía (no entregada) contesta 404", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.hojaDeRespuestas.mockResolvedValue(null);
    const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");
    await expect(Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: no pintar el nombre, el examen, el nombre de la
  // prueba o la nota congelada arriba de la ficha.
  it("arriba: el nombre, el examen, la prueba y la nota congelada", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.hojaDeRespuestas.mockResolvedValue(hojaDePrueba());
    const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");
    const html = renderToStaticMarkup(
      await Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) }),
    );
    expect(html).toContain("Ana");
    expect(html).toContain("Examen 1");
    expect(html).toContain("Lectura");
    expect(html).toContain("19");
    expect(html).toContain("25");
    expect(dobles.hojaDeRespuestas).toHaveBeenCalledWith("ex1", "p1", "CE");
  });

  // Mutación que la mata: pintar `marcada` tal cual cuando es null (una
  // celda vacía) en vez de decir «sin contestar». Dejarla en blanco tiene que
  // seguir siendo visible como una fila más, no desaparecer entre las demás.
  it("lo que dejó en blanco sale dicho como «sin contestar»", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    dobles.hojaDeRespuestas.mockResolvedValue(hojaDePrueba());
    const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");
    const html = renderToStaticMarkup(
      await Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) }),
    );
    expect(html).toContain("sin contestar");
  });

  // Mutación que la mata: quitar el `bg-error-100` de la fila donde
  // `marcada !== correcta`, o ponerlo también en la que acertó.
  it("la fila donde falló sale marcada en rojo; la que acertó, no", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(profe);
    const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");

    dobles.hojaDeRespuestas.mockResolvedValue(
      hojaDePrueba({ filas: [{ numero: 7, marcada: "A", correcta: "A" }] }),
    );
    const sinFallos = renderToStaticMarkup(
      await Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) }),
    );
    expect(sinFallos).not.toContain("bg-error-100");

    dobles.hojaDeRespuestas.mockResolvedValue(
      hojaDePrueba({ filas: [{ numero: 8, marcada: "C", correcta: "B" }] }),
    );
    const conUnFallo = renderToStaticMarkup(
      await Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) }),
    );
    expect(conUnFallo).toContain("bg-error-100");
  });
});
