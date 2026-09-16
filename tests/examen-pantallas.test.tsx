import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import type { PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";
import { corregirTareaEnLibre, PestanasDeTarea } from "@/components/examen/hacer-prueba";
import { Cinta } from "@/components/examen/cinta";
import { Reloj, segundosHasta } from "@/components/examen/reloj";

// Igual que tests/taller-pantallas.test.ts: la pantalla se importa tal cual
// (no un resumen de su lógica), doblando lo que toca la base y la sesión.
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  pruebaParaHacer: vi.fn(),
  cerrarLasQueSePasaron: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({
  redirect: dobles.redirect,
  notFound: dobles.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
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
}));

import PantallaDelExamen from "@/app/examen/[id]/[prueba]/page";

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
function entregadaCon19De25(): PruebaParaHacer {
  return pruebaDePrueba({
    tareas: [lecturaDos()],
    estado: { estado: "ENTREGADA", aciertos: 19, total: 25, porTiempo: false },
    respuestas: { "8": "B" },
    fallos: [8],
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

  // Antes se llamaba «la escrita y la oral contestan 404», pero eso no es lo
  // que prueba: "EE" ya pasa la guarda `esPrueba` (es una prueba real del
  // DELE, solo que sin pantalla propia todavía), así que la 404 de aquí sale
  // de `pruebaParaHacer` devolviendo null — doblado más abajo — no de
  // `esPrueba`. Esa guarda tiene su propia prueba justo debajo.
  // Mutación que la mata: quitar el `if (!leida) notFound();` de la página.
  // Sería una pantalla a medias, con `prueba={null}`.
  it("si pruebaParaHacer no encuentra nada (aquí, EE, que aún no tiene pantalla propia) la pantalla contesta 404", async () => {
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
