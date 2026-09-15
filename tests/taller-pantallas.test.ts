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

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
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
    dobles.examenParaElTaller.mockResolvedValue({
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
    });
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
    const base = { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR" as const, tareas: [], paginas: [], gasto: { llamadas: 0, milesimas: 0 } };
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
});
