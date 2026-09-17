import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";

// Cada pantalla se importa tal cual (no un resumen de su lógica), para que
// borrar su `await exigirProfesor()` ponga esto en rojo.
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  listarExamenes: vi.fn(),
  examenParaElTaller: vi.fn(),
  tareaParaElTaller: vi.fn(),
  listarCuadernillos: vi.fn(),
  estudiantesParaAsignar: vi.fn(),
  asignacionesDelExamen: vi.fn(),
  cerrarLasQueSePasaron: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect: dobles.redirect, notFound: dobles.notFound, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/taller/examenes", () => ({
  listarExamenes: dobles.listarExamenes,
  examenParaElTaller: dobles.examenParaElTaller,
  tareaParaElTaller: dobles.tareaParaElTaller,
}));
vi.mock("@/lib/taller/cuadernillos", () => ({ listarCuadernillos: dobles.listarCuadernillos }));
// Declarado para TODO el fichero, con [] por defecto en el beforeEach común: la
// prueba de tabla más abajo pinta TODAS las pantallas, y sin este doble la
// pantalla del examen llamaría a Prisma de verdad en cuanto el examen esté
// publicado.
vi.mock("@/lib/examen/asignar", () => ({
  asignacionesDelExamen: dobles.asignacionesDelExamen,
  estudiantesParaAsignar: dobles.estudiantesParaAsignar,
}));
vi.mock("@/lib/examen/hacer", () => ({ cerrarLasQueSePasaron: dobles.cerrarLasQueSePasaron }));
// Cada acción que importan las pantallas o sus componentes tiene que existir en
// el doble: Vitest revienta al leer una exportación que el doble no define.
vi.mock("@/app/examenes/acciones", () => ({
  crearExamenAccion: vi.fn(),
  elegirCuadernilloAccion: vi.fn(),
  registrarPaginasAccion: vi.fn(),
  sustituirPaginasAccion: vi.fn(),
  borrarPaginasAccion: vi.fn(),
  etiquetarPaginaAccion: vi.fn(),
  guardarCuadernilloAccion: vi.fn(),
  guardarTareaAccion: vi.fn(),
  publicarExamenAccion: vi.fn(),
  retirarExamenAccion: vi.fn(),
  asignarExamenAccion: vi.fn(),
  quitarAsignacionAccion: vi.fn(),
  archivarExamenAccion: vi.fn(),
  recuperarExamenAccion: vi.fn(),
}));

import Examenes from "@/app/examenes/page";
import PantallaDelExamen from "@/app/examenes/[id]/page";
import PantallaDeTarea from "@/app/examenes/[id]/[prueba]/[numero]/page";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

function como(persona: Persona) {
  dobles.cookiesGet.mockReturnValue({ value: `cookie-de-${persona.id}` });
  dobles.personaDeLaCookie.mockResolvedValue(persona);
}

const sinError = () => Promise.resolve({});

function examenDePrueba(extra: Record<string, unknown> = {}) {
  return {
    id: "x1",
    titulo: "Examen 1",
    nivel: "A2_B1_ESCOLAR",
    numeroEnCuadernillo: 1,
    cuadernillo: {
      id: "c1",
      titulo: "Libro de preparación",
      resumen: [
        { examen: "1", pruebas: [], bien: true },
        { examen: "2", pruebas: [], bien: false },
      ],
    },
    paginas: [
      { id: "p1", ficheroId: "f1", orden: 1, etiquetas: ["CE-1"] },
      { id: "p2", ficheroId: "f2", orden: 2, etiquetas: [] },
    ],
    tareas: [
      { prueba: "CE", numero: 1, estado: { estado: "A_MEDIAS", motivos: ["Falta la consigna.", "Falta el texto 1."] } },
    ],
    gasto: { llamadas: 0, milesimas: 0 },
    estado: "EN_CONSTRUCCION",
    motivosParaPublicar: [],
    ...extra,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
  // Por defecto vacíos: la prueba de tabla pinta un examen PUBLICADO sin
  // pensar en la asignación, y sin esto la pantalla recibiría `undefined`
  // donde espera una lista.
  dobles.estudiantesParaAsignar.mockResolvedValue([]);
  dobles.asignacionesDelExamen.mockResolvedValue([]);
});

const PANTALLAS = [
  { nombre: "la lista de exámenes", pintar: () => Examenes({ searchParams: sinError() }), lee: dobles.listarExamenes },
  { nombre: "la pantalla del examen", pintar: () => PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }), lee: dobles.examenParaElTaller },
  { nombre: "la pantalla de una tarea", pintar: () => PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "3" }) }), lee: dobles.tareaParaElTaller },
];

describe("las pantallas del taller exigen al profesor", () => {
  // Mutación que la mata: quitar `await exigirProfesor()` de cualquiera de las tres.
  it.each(PANTALLAS)("$nombre: un estudiante topa con el no encontrado y no se lee nada", async ({ pintar, lee }) => {
    como(ESTUDIANTE);
    await expect(pintar()).rejects.toThrow("NOT_FOUND");
    expect(lee).not.toHaveBeenCalled();
  });
});

describe("lo que no existe da el no encontrado", () => {
  beforeEach(() => como(PROFESOR));

  // Mutación que la mata: quitar `if (!examen) notFound();` en app/examenes/[id]/page.tsx.
  it("un examen que no existe", async () => {
    dobles.examenParaElTaller.mockResolvedValue(null);
    await expect(PantallaDelExamen({ params: Promise.resolve({ id: "nada" }), searchParams: sinError() })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: no comprobar esPrueba antes de ir a la base.
  it("una prueba inventada o un número que no es número no llegan a la base", async () => {
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "XX", numero: "3" }) })).rejects.toThrow("NOT_FOUND");
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "tres" }) })).rejects.toThrow("NOT_FOUND");
    expect(dobles.tareaParaElTaller).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar `if (!tarea) notFound();` en app/examenes/[id]/[prueba]/[numero]/page.tsx.
  it("una tarea que no existe", async () => {
    dobles.tareaParaElTaller.mockResolvedValue(null);
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "9" }) })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: en app/examenes/page.tsx, cambiar
  // `Promise.all([listarExamenes(), searchParams])` por
  // `Promise.all([searchParams, listarExamenes()])` sin tocar la
  // desestructuración: `examenes` pasa a ser el resultado de `searchParams`
  // ({}), `.map` no existe en un objeto y la pantalla revienta en vez de
  // resolver.
  it("el profesor ve la lista", async () => {
    dobles.listarExamenes.mockResolvedValue([]);
    await expect(Examenes({ searchParams: sinError() })).resolves.toBeDefined();
  });
});

describe("lo que el profesor ve de verdad (camino feliz)", () => {
  beforeEach(() => como(PROFESOR));

  // Mutación que la mata: en app/examenes/page.tsx, dejar de interpolar
  // `e.id` en el href (usar una ruta fija como `/examenes/x`).
  it("la lista enseña cada examen con su enlace, nivel y estado", async () => {
    dobles.listarExamenes.mockResolvedValue([
      { id: "e1", titulo: "Examen Uno", nivel: "A2_B1_ESCOLAR", estado: "EN_CONSTRUCCION" },
      { id: "e2", titulo: "Examen Dos", nivel: "A2_B1_ESCOLAR", estado: "EN_CONSTRUCCION" },
    ]);
    const marcado = renderToStaticMarkup(await Examenes({ searchParams: sinError() }));
    expect(marcado).toContain("Examen Uno");
    expect(marcado).toContain("Examen Dos");
    expect(marcado).toContain('href="/examenes/e1"');
    expect(marcado).toContain('href="/examenes/e2"');
    expect(marcado).toContain("A2/B1 escolar · En construcción");
  });

  // Mutación que la mata: quitar el párrafo «Hay N hoja(s) sin etiquetar.»
  // (el `{examen.paginas.length > 0 && sinEtiqueta > 0 && (...)}`).
  it("la pantalla del examen enseña el aviso de páginas sin etiquetar, cuántas tareas faltan y qué examen del cuadernillo cuadra", async () => {
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba());
    // El cuadernillo trae un tercer examen (el "3") que el resumen guardado
    // no tiene: si el select del número saliera del resumen (el bug que se
    // arregla aquí) en vez de la lista de cuadernillos, "Examen 3" no
    // aparecería nunca.
    dobles.listarCuadernillos.mockResolvedValue([{ id: "c1", titulo: "Libro de preparación", examenes: ["1", "2", "3"] }]);

    const marcado = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));

    expect(marcado).toContain("Hay 1 hoja sin etiquetar.");
    expect(marcado).toContain("2 por resolver");
    expect(marcado).toContain(">Sí<");
    expect(marcado).toContain(">No<");
    expect(marcado).toContain(">Examen 3<");
  });

  // Mutación que la mata: invertir la condición (`tarea.paginas.length > 0`)
  // del párrafo, dejando el aviso «Ninguna hoja lleva esta tarea» para
  // cuando SÍ hay páginas.
  it("la pantalla de una tarea sin páginas etiquetadas avisa de que no hay ninguna", async () => {
    const regla = reglaDe("A2_B1_ESCOLAR", "EE", 1)!;
    dobles.tareaParaElTaller.mockResolvedValue({
      examen: { id: "x1", titulo: "Examen 1" },
      prueba: "EE",
      numero: 1,
      regla,
      formulario: formularioVacio(regla),
      guardada: false,
      publicado: false,
      estado: { estado: "VACIA", motivos: ["Sin guardar todavía."] },
      respuestas: null,
      paginas: [],
      temasDeLaHermana: null,
    });
    const marcado = renderToStaticMarkup(
      await PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "EE", numero: "1" }) }),
    );
    expect(marcado).toContain("Ninguna hoja lleva esta tarea");
  });

  // Mutación que la mata: quitar el `.map` y pintar una sola imagen
  // (`tarea.paginas.slice(0, 1).map(...)`), perdiendo las páginas que no son
  // la primera.
  it("la pantalla de una tarea con dos páginas etiquetadas enseña las dos imágenes", async () => {
    const regla = reglaDe("A2_B1_ESCOLAR", "EE", 1)!;
    dobles.tareaParaElTaller.mockResolvedValue({
      examen: { id: "x1", titulo: "Examen 1" },
      prueba: "EE",
      numero: 1,
      regla,
      formulario: formularioVacio(regla),
      guardada: true,
      publicado: false,
      estado: { estado: "A_MEDIAS", motivos: ["Falta la consigna."] },
      respuestas: null,
      paginas: [
        { ficheroId: "f1", orden: 3 },
        { ficheroId: "f2", orden: 4 },
      ],
      temasDeLaHermana: null,
    });
    const marcado = renderToStaticMarkup(
      await PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "EE", numero: "1" }) }),
    );
    expect(marcado).toContain('src="/api/ficheros/f1"');
    expect(marcado).toContain('src="/api/ficheros/f2"');
  });

  // El `key` que se le puso a <ElegirCuadernillo> en app/examenes/[id]/page.tsx
  // (finding 3 de la revisión) arregla un fallo que solo se ve cuando React
  // vuelve a renderizar la MISMA instancia montada del componente (tras
  // guardar un cuadernillo y refrescar la pantalla, sin desmontarla): el
  // `useState` interno de ElegirCuadernillo se queda con el valor con el que
  // se montó la primera vez. `renderToStaticMarkup` no reconstruye una
  // instancia ya montada — cada llamada es un montaje nuevo — así que esta
  // prueba NO puede observar ese re-montaje ni lo que el `key` arregla:
  // quitar el `key` de la página no la pondría en rojo. Lo que sí puede
  // probarse aquí, honestamente, es que la pantalla lee el cuadernillo y el
  // número elegidos de `examen` (no de otro sitio) y se los pasa tal cual al
  // selector, para cada examen por separado.
  // Mutación que la mata: fijar `elegidoId` o `numero` a un valor constante
  // (por ejemplo `elegidoId={null}` o `numero={1}`) en vez de leerlos de
  // `examen.cuadernillo` / `examen.numeroEnCuadernillo`.
  it("la pantalla pasa el cuadernillo y el número guardados de CADA examen al selector, no uno fijo", async () => {
    const base = { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR" as const, tareas: [], paginas: [], gasto: { llamadas: 0, milesimas: 0 }, estado: "EN_CONSTRUCCION" as const, motivosParaPublicar: [] };
    dobles.listarCuadernillos.mockResolvedValue([
      { id: "c1", titulo: "Libro Uno", examenes: ["1"] },
      { id: "c2", titulo: "Libro Dos", examenes: ["2"] },
    ]);

    dobles.examenParaElTaller.mockResolvedValue({
      ...base,
      id: "x1",
      numeroEnCuadernillo: 1,
      cuadernillo: { id: "c1", titulo: "Libro Uno", resumen: [] },
    });
    const primero = renderToStaticMarkup(
      await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }),
    );

    dobles.examenParaElTaller.mockResolvedValue({
      ...base,
      id: "x2",
      numeroEnCuadernillo: 2,
      cuadernillo: { id: "c2", titulo: "Libro Dos", resumen: [] },
    });
    const segundo = renderToStaticMarkup(
      await PantallaDelExamen({ params: Promise.resolve({ id: "x2" }), searchParams: sinError() }),
    );

    expect(primero).toContain('value="c1" selected');
    expect(primero).not.toContain('value="c2" selected');
    expect(segundo).toContain('value="c2" selected');
    expect(segundo).not.toContain('value="c1" selected');
  });

  // Mutación que la mata: no apagar «Publicar» cuando hay motivos.
  it("en construcción con motivos: Publicar apagado y la lista de por qué", async () => {
    dobles.listarCuadernillos.mockResolvedValue([]);
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ motivosParaPublicar: ["Faltan por completar: CO1, EO1."] }));
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).toContain("data-publicacion");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Publicar<\/button>/);
    expect(html).toContain("Faltan por completar: CO1, EO1.");
    expect(html).toContain("Subir un cuadernillo nuevo");
  });

  // Mutación que la mata: fijar disabled en true siempre (apagar «Publicar») en app/examenes/[id]/page.tsx.
  it("sin motivos, Publicar encendido", async () => {
    dobles.listarCuadernillos.mockResolvedValue([]);
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba());
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Publicar<\/button>/);
    expect(html).toContain(">Publicar</button>");
  });

  // Mutación que la mata: seguir pintando los editores (cuadernillo, páginas, etiquetas) con el examen publicado.
  it("publicado: Retirar, el aviso, y nada que edite", async () => {
    dobles.listarCuadernillos.mockResolvedValue([]);
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ estado: "PUBLICADO" }));
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).toContain(">Retirar</button>");
    expect(html).toContain("El examen está publicado: retíralo para editarlo.");
    expect(html).not.toContain("Subir un cuadernillo nuevo");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain(">Publicar</button>");
  });

  // Un examen ARCHIVADO no es PUBLICADO (`publicado` es `false`), así que si la
  // pantalla siguiera decidiendo con `!publicado` (como hacía antes de esta
  // ronda) un archivado se pintaría como en construcción: ElegirCuadernillo,
  // «Subir un cuadernillo nuevo» y SubirPaginas volverían a aparecer sobre un
  // examen fuera de circulación.
  // Mutación que la mata: volver a decidir con `!publicado` en vez de
  // `editable` en cualquiera de los cuatro sitios de la pantalla.
  it("archivado: Recuperar, el aviso, y nada que edite", async () => {
    dobles.listarCuadernillos.mockResolvedValue([]);
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ estado: "ARCHIVADO" }));
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).toContain(">Recuperar</button>");
    expect(html).toContain("Archivado: fuera de circulación.");
    expect(html).not.toContain("Subir un cuadernillo nuevo");
    expect(html).not.toContain("Qué examen del libro es");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain(">Publicar</button>");
    expect(html).not.toContain(">Retirar</button>");
  });
});

describe("la caja de quién hace el examen", () => {
  const pintar = async (estado: string) => {
    dobles.cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    dobles.personaDeLaCookie.mockResolvedValue(PROFESOR);
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ estado }));
    dobles.listarCuadernillos.mockResolvedValue([]);
    return renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
  };

  const SIN_EMPEZAR = { estado: "SIN_EMPEZAR" as const, aciertos: null, total: null, porTiempo: false };
  const dosSinEmpezar = () => [
    { prueba: "CE" as const, estado: SIN_EMPEZAR, texto: "Sin empezar" },
    { prueba: "CO" as const, estado: SIN_EMPEZAR, texto: "Sin empezar" },
  ];

  beforeEach(() => {
    dobles.estudiantesParaAsignar.mockResolvedValue([{ id: "e1", nombre: "Ana", correo: "ana@ejemplo.com" }]);
    dobles.asignacionesDelExamen.mockResolvedValue([
      { personaId: "e1", nombre: "Ana", fechaTope: new Date("2026-10-20T21:59:59.999Z"), pruebas: dosSinEmpezar() },
      // A las 23:30 UTC del 20 ya son las 01:30 del 21 en Madrid (CEST, +2):
      // esta fecha sí discrepa entre pintar con huso o sin él (la de Ana cae
      // el mismo día se aplique el huso o no, y por sí sola no distinguiría).
      { personaId: "e2", nombre: "Luis", fechaTope: new Date("2026-10-20T23:30:00.000Z"), pruebas: dosSinEmpezar() },
    ]);
  });

  // La caja sigue en pantalla en construcción, pero sin formulario: la
  // diferencia entre «no hay nada que asignar todavía» y «esto se rompió» la
  // paga el profesor en una pregunta si no se dice.
  // Mutación que la mata: volver al `{publicado && (...)}` (quitar la caja
  // entera en construcción), o pintar el formulario de todos modos.
  it("en construcción, la caja explica por qué en vez de desaparecer", async () => {
    const marcado = await pintar("EN_CONSTRUCCION");

    expect(marcado.length).toBeGreaterThan(200); // que no esté vacío: si no, cualquier ausencia pasa
    expect(marcado).toContain("Quién lo hace");
    expect(marcado).toContain("Publícalo primero: un examen en construcción todavía no se asigna.");
    expect(marcado).not.toContain("Marcar todos");
    expect(marcado).toContain("Archivar");
    // Mutación que la mata: barrer también cuando no está publicado. No hay
    // nada que asignar todavía, así que no hay nada que cerrar.
    expect(dobles.cerrarLasQueSePasaron).not.toHaveBeenCalled();
  });

  // Mutación que la mata: no pintar la fecha de quien ya lo tiene, o pintarla
  // sin huso (quitar el `timeZone: "Europe/Madrid"` de fechaEnPalabras). Bajo
  // TZ=UTC, como corre esta suite, la fecha de Luis (23:30 UTC del 20) cae en
  // el 21 de octubre solo si se aplica el huso de Madrid; sin huso saldría el
  // 20, igual que la de Ana, y la prueba no distinguiría nada.
  it("publicado, lista a los estudiantes y a quien ya lo tiene con su fecha", async () => {
    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain("Quién lo hace");
    expect(marcado).toContain("Ana");
    expect(marcado).toContain("martes, 20 de octubre de 2026");
    expect(marcado).toContain("Luis");
    expect(marcado).toContain("miércoles, 21 de octubre de 2026");
  });

  // Mutación que la mata: no pasar `pruebas` a QuienLoHace, o no pintar
  // `p.texto` junto a cada nombre. Sin esto el profesor no sabe, sin entrar en
  // cada examen, quién ya lo entregó ni con qué nota.
  it("junto a cada nombre, el estado y la nota de las dos pruebas", async () => {
    dobles.asignacionesDelExamen.mockResolvedValue([
      {
        personaId: "e1",
        nombre: "Ana",
        fechaTope: new Date("2026-10-20T21:59:59.999Z"),
        pruebas: [
          { prueba: "CE" as const, estado: { estado: "ENTREGADA" as const, aciertos: 19, total: 25, porTiempo: false }, texto: "Entregada, 19 de 25" },
          { prueba: "CO" as const, estado: { estado: "HACIENDO" as const, aciertos: null, total: null, porTiempo: false }, texto: "A medias" },
        ],
      },
    ]);

    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain("Ana");
    expect(marcado).toContain("Entregada, 19 de 25");
    expect(marcado).toContain("A medias");
  });

  // El cálculo del retraso vive en asignar.ts y se prueba aparte, contra la
  // base, en tests/base/asignaciones.test.ts. Aquí solo se comprueba que la
  // pantalla PINTA el texto que le llega, entero.
  // Mutación que la mata: no pintar `p.texto` tal cual (cortarlo, o no pasar
  // `pruebas` a QuienLoHace).
  it("quien entregó fuera de plazo lo lleva escrito", async () => {
    dobles.asignacionesDelExamen.mockResolvedValue([
      {
        personaId: "e2",
        nombre: "Luis",
        fechaTope: new Date("2026-10-20T23:30:00.000Z"),
        pruebas: [
          { prueba: "CE" as const, estado: { estado: "ENTREGADA" as const, aciertos: 10, total: 25, porTiempo: false }, texto: "Entregada, 10 de 25 — 2 días tarde" },
          { prueba: "CO" as const, estado: SIN_EMPEZAR, texto: "Sin empezar" },
        ],
      },
    ]);

    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain("Luis");
    expect(marcado).toContain("2 días tarde");
  });

  // Mutación que la mata: pintar un estado vacío o «Sin empezar» cuando
  // `pruebas` llega vacío (modo libre: ahí no hay intento nunca, y un estado
  // sería mentira).
  it("en modo libre, sin pruebas, no pinta ningún estado", async () => {
    dobles.asignacionesDelExamen.mockResolvedValue([
      { personaId: "e3", nombre: "Marta", fechaTope: new Date("2026-10-20T21:59:59.999Z"), pruebas: [] },
    ]);

    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain("Marta");
    expect(marcado).not.toContain("Sin empezar");
  });

  // Mutación que la mata: no barrer antes de leer, o barrer sin ámbito (toda
  // la base en vez de este examen). El profesor vería «a medias» eterno de
  // quien cerró el portátil.
  it("antes de leer quién lo hace, cierra las pruebas de ESTE examen que se pasaron de hora", async () => {
    await pintar("PUBLICADO");

    expect(dobles.cerrarLasQueSePasaron).toHaveBeenCalledWith({ examenId: "x1" }, expect.any(Date));
    expect(dobles.cerrarLasQueSePasaron.mock.invocationCallOrder[0]).toBeLessThan(
      dobles.asignacionesDelExamen.mock.invocationCallOrder[0]!,
    );
  });

  // Quitárselo cambia algo: tiene que ser un formulario POST, nunca un enlace
  // (Next precarga los enlaces en cuanto se pintan, y eso los dispara solos).
  // Antes esto se probaba con un `not.toContain('href="/examenes/x1/quitar')`
  // sobre una ruta que no existe ni ha existido nunca: ninguna mutación real la
  // haría aparecer.
  // Mutación que la mata: cambiar el `<form action={quitarAsignacionAccion...}>`
  // por un `<a href={...}>Quitárselo</a>`.
  it("«Quitárselo» va en un formulario, uno por asignación además del de asignar", async () => {
    const marcado = await pintar("PUBLICADO");
    expect(marcado).toContain("Ana"); // que la caja se pintó de verdad

    // Acotado a la caja «Quién lo hace»: la pantalla tiene otro <form> aparte
    // (Retirar), que no es lo que esta prueba quiere vigilar.
    const inicio = marcado.indexOf("data-asignacion");
    const caja = marcado.slice(inicio, marcado.indexOf("</section>", inicio));
    expect(caja.match(/<form /g) ?? []).toHaveLength(3); // el de asignar + uno por cada una de las dos asignaciones
    expect(caja.match(/>Quitárselo<\/button>/g) ?? []).toHaveLength(2);
  });

  // Mutación que la mata: dejar las casillas marcadas de quien ya lo tiene.
  // Asignárselo a uno nuevo le cambiaría la fecha a los demás sin pedirlo.
  // Acotado a las casillas de estudiante (antes miraba el marcado entero): la
  // caja tiene ahora otro control que SÍ nace marcado, el modo «Completo», y
  // un `not.toContain("checked")` sobre todo el marcado confundiría las dos
  // cosas y se pondría rojo por el motivo equivocado.
  it("las casillas nacen vacías aunque ya lo tengan", async () => {
    const marcado = await pintar("PUBLICADO");
    const casillas = marcado.match(/<input[^>]*name="estudiante"[^>]*\/>/g) ?? [];
    expect(casillas).toHaveLength(1); // la de Ana, pintada de verdad
    expect(casillas.join("")).not.toContain("checked");
  });

  // Nada en toda la aplicación escribía `modo`: sin estas dos casillas, la
  // práctica libre —su pantalla, su corrección al vuelo, su candado NO_LIBRE y
  // la rama de los ficheros— no se podía alcanzar desde el sitio.
  // Mutación que la mata: quitar las dos casillas del modo, o quitarles el
  // `name="modo"` (la acción lee `formulario.get("modo")`, y sin nombre no
  // viaja nada: todo el mundo saldría en completo).
  it("el profesor elige entre completo y práctica libre, y nace en completo", async () => {
    const marcado = await pintar("PUBLICADO");
    const modos = marcado.match(/<input[^>]*name="modo"[^>]*\/>/g) ?? [];
    expect(modos).toHaveLength(2);
    expect(marcado).toContain("Práctica libre");
    const completo = modos.filter((m) => m.includes('value="COMPLETO"'));
    const libre = modos.filter((m) => m.includes('value="LIBRE"'));
    expect(completo).toHaveLength(1);
    expect(libre).toHaveLength(1);
    expect(completo[0]).toContain('checked=""');
    expect(libre[0]).not.toContain("checked");
  });

  // Mutación que la mata: quitar el botón. `renderToStaticMarkup` solo ve el
  // estado inicial (las casillas nacen vacías), así que no puede probar que el
  // texto alterne al marcar todos: eso es para una prueba con jsdom, no esta.
  it("el botón «marcar todos» aparece, y con las casillas vacías dice «Marcar todos»", async () => {
    const marcado = await pintar("PUBLICADO");
    expect(marcado).toContain("Ana"); // que la caja se pintó de verdad
    expect(marcado).toContain("Marcar todos");
    expect(marcado).not.toContain("Desmarcar todos");
  });

  // Mutación que la mata: enlazar también una lectura o auditiva que todavía
  // no está ENTREGADA (HACIENDO, ESPERANDO o SIN_EMPEZAR). Ahí no hay ficha
  // que enseñar: `hojaDeRespuestas` daría null.
  it("solo la lectura y la auditiva ENTREGADAS enlazan a su ficha", async () => {
    dobles.asignacionesDelExamen.mockResolvedValue([
      {
        personaId: "e1",
        nombre: "Ana",
        fechaTope: new Date("2026-10-20T21:59:59.999Z"),
        pruebas: [
          { prueba: "CE" as const, estado: { estado: "ENTREGADA" as const, aciertos: 19, total: 25, porTiempo: false }, texto: "Entregada, 19 de 25" },
          { prueba: "CO" as const, estado: { estado: "HACIENDO" as const, aciertos: null, total: null, porTiempo: false }, texto: "A medias" },
        ],
      },
    ]);

    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain('href="/examenes/x1/hoja/e1/CE"');
    expect(marcado).not.toContain('href="/examenes/x1/hoja/e1/CO"');
  });

  // Mutación que la mata: enlazar también la escrita cuando está ENTREGADA (o
  // ESPERANDO). La escrita se corrige en /corregir, que es otra pantalla; una
  // que espera corrección no tiene ficha congelada que enseñar todavía.
  it("la escrita nunca enlaza a la ficha, esté ENTREGADA o ESPERANDO", async () => {
    dobles.asignacionesDelExamen.mockResolvedValue([
      {
        personaId: "e1",
        nombre: "Ana",
        fechaTope: new Date("2026-10-20T21:59:59.999Z"),
        pruebas: [
          { prueba: "EE" as const, estado: { estado: "ESPERANDO" as const, aciertos: null, total: null, porTiempo: false }, texto: "Esperando corrección" },
        ],
      },
    ]);

    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain("Esperando corrección");
    expect(marcado).not.toContain('href="/examenes/x1/hoja/e1/EE"');
  });
});
