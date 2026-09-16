import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";
import { reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import type { PruebaParaHacer, TareaParaHacer } from "@/lib/examen/paraHacer";
import { TareaDelEstudiante } from "@/components/examen/tarea-del-estudiante";
import { corregirTareaEnLibre } from "@/components/examen/hacer-prueba";

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

  // Mutación que la mata: no pintar el resultado, o pintar la letra buena.
  it("entregada enseña la nota y los fallos", async () => {
    const html = await pintarPagina(entregadaCon19De25());
    expect(html).toContain("19 de 25");
    expect(html).not.toContain("La respuesta correcta");
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
