import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Persona, Prueba } from "@/lib/generated/prisma";

// Una acción de servidor es una dirección pública: quien la conozca la llama
// sin pasar por la pantalla. Se llama a CADA una directamente, una por una,
// tal como en tests/taller-acciones.test.ts.
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); }),
  notFound: vi.fn(),
  revalidatePath: vi.fn(),
  empezarPrueba: vi.fn(),
  guardarRespuesta: vi.fn(),
  marcarTrozo: vi.fn(),
  entregarPrueba: vi.fn(),
  corregirEnLibre: vi.fn(),
  guardarEscrito: vi.fn(),
  guardarCorreccion: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect: dobles.redirect, notFound: dobles.notFound }));
vi.mock("next/cache", () => ({ revalidatePath: dobles.revalidatePath }));
// lib/examen/paraHacer.ts (de donde sale PRUEBAS_QUE_SE_HACEN) importa
// lib/db para pruebaParaHacer, que esta prueba nunca llama; sin este doble,
// cargar el módulo real revienta por falta de DATABASE_URL (no hay base en
// esta prueba). PRUEBAS_QUE_SE_HACEN sí queda real: es la lista de verdad.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/examen/hacer", () => ({
  empezarPrueba: dobles.empezarPrueba,
  guardarRespuesta: dobles.guardarRespuesta,
  marcarTrozo: dobles.marcarTrozo,
  entregarPrueba: dobles.entregarPrueba,
  corregirEnLibre: dobles.corregirEnLibre,
  guardarEscrito: dobles.guardarEscrito,
}));
// La acción del profesor vive sobre guardarCorreccion, que a su vez es
// lib/examen/corregir.ts entero (y ese toca prisma). Se dobla solo esta
// exportación: nada más de este fichero necesita el resto del módulo.
vi.mock("@/lib/examen/corregir", () => ({ guardarCorreccion: dobles.guardarCorreccion }));

import {
  corregirEnLibreAccion,
  empezarPruebaAccion,
  entregarPruebaAccion,
  guardarEscritoAccion,
  guardarRespuestaAccion,
  marcarTrozoAccion,
} from "@/app/examen/acciones";
import { guardarCorreccionAccion } from "@/app/corregir/acciones";

const ANA: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };
const PROFE: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };

beforeEach(() => {
  vi.resetAllMocks();
  // Cookie presente por defecto: lo que decide si hay o no sesión, en estas
  // pruebas, es personaDeLaCookie, no la cookie en sí.
  dobles.cookiesGet.mockReturnValue({ value: "cookie-de-prueba" });
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
});

// Una acción de servidor es una dirección pública: quien la conozca la llama sin
// pasar por la pantalla. Se llama a CADA una directamente, una por una.
describe("las acciones del estudiante", () => {
  // Mutación que la mata: borrar el `await exigirPersona()` de cualquiera de las cinco.
  it("sin sesión no entra ninguna", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(null);
    await expect(empezarPruebaAccion("ex1", "CE")).rejects.toThrow("REDIRECT:/entrar");
    await expect(guardarRespuestaAccion("ex1", "CE", 8, "B")).rejects.toThrow("REDIRECT:/entrar");
    await expect(marcarTrozoAccion("ex1", "CO", 1, 1)).rejects.toThrow("REDIRECT:/entrar");
    await expect(entregarPruebaAccion("ex1", "CE")).rejects.toThrow("REDIRECT:/entrar");
    await expect(corregirEnLibreAccion("ex1", "CE", {})).rejects.toThrow("REDIRECT:/entrar");
    expect(dobles.empezarPrueba).not.toHaveBeenCalled();
  });

  // Mutación que la mata: coger la persona de un argumento en vez de de la sesión.
  // Con eso, un estudiante contestaría el examen de otro desde la consola.
  it("la persona sale de la sesión, y con ella se llama al motor", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ANA);
    dobles.empezarPrueba.mockResolvedValue({});
    await empezarPruebaAccion("ex1", "CE");
    expect(dobles.empezarPrueba).toHaveBeenCalledWith("ex1", "CE", ANA.id, expect.any(Date));
  });

  // Mutación que la mata: dejar pasar cualquier texto como prueba. `esPrueba` ya
  // existe y hay que usarlo: una prueba inventada no puede llegar a la base.
  it("una prueba que no existe rebota antes de tocar nada", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ANA);
    expect(await empezarPruebaAccion("ex1", "XX" as Prueba)).toEqual({ error: "Esa prueba todavía no se puede hacer." });
    expect(dobles.empezarPrueba).not.toHaveBeenCalled();
  });

  // Mutación que la mata: no revalidar. La pantalla del estudiante se quedaría
  // enseñando «a medias» después de entregar.
  it("entregar refresca la pantalla del examen", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ANA);
    dobles.entregarPrueba.mockResolvedValue({});
    await entregarPruebaAccion("ex1", "CE");
    expect(dobles.revalidatePath).toHaveBeenCalledWith("/examen/ex1/CE");
  });
});

describe("lo que hace cada acción con la persona ya en sesión", () => {
  beforeEach(() => dobles.personaDeLaCookie.mockResolvedValue(ANA));

  // Mutación que la mata: llamar a guardarRespuesta con `numero + 1` o con
  // `letra` y `numero` intercambiados.
  it("guardar una respuesta pasa examen, prueba, persona, número y letra tal cual", async () => {
    dobles.guardarRespuesta.mockResolvedValue({});
    await guardarRespuestaAccion("ex1", "CE", 8, "B");
    expect(dobles.guardarRespuesta).toHaveBeenCalledWith("ex1", "CE", ANA.id, 8, "B", expect.any(Date));
  });

  // Mutación que la mata: invertir tarea y trozo al llamar a marcarTrozo.
  it("marcar un trozo pasa tarea y trozo en ese orden", async () => {
    dobles.marcarTrozo.mockResolvedValue({});
    await marcarTrozoAccion("ex1", "CO", 2, 5);
    expect(dobles.marcarTrozo).toHaveBeenCalledWith("ex1", "CO", ANA.id, 2, 5, expect.any(Date));
  });

  // `porTiempo` no viaja desde el navegador: lo decide entregarPrueba con el
  // reloj del servidor. Una acción de servidor es una dirección pública, y con
  // el argumento puesto cualquiera podía dejarle al profesor un «Entregada por
  // tiempo» en una prueba entregada con toda la calma — la única señal que
  // tiene de a quién se le acabó el tiempo.
  // Mutación que la mata: devolverle a entregarPrueba un quinto argumento
  // tomado de quien llama (la firma de antes), o comerse el error.
  it("entregar no le pasa al motor ningún porTiempo, y devuelve el error si lo hay", async () => {
    dobles.entregarPrueba.mockResolvedValue({ error: "Se acabó el tiempo." });
    expect(await entregarPruebaAccion("ex1", "CE")).toEqual({ error: "Se acabó el tiempo." });
    expect(dobles.entregarPrueba).toHaveBeenCalledWith("ex1", "CE", ANA.id, expect.any(Date));
  });

  // Mutación que la mata: devolver `{}` fijo en vez de lo que corregirEnLibre
  // calcule, perdiendo la nota real.
  // El doble devuelve un `Fallo` de verdad ({ numero, marcada }): `marcada` es
  // LO QUE MARCÓ el estudiante, nunca la letra buena. Antes decía `letra`, que
  // ni existe en el tipo (vi.fn() lo tipa como any y nadie se quejaba) ni
  // significa lo mismo: un doble con esa forma da a entender que por aquí
  // vuelve la respuesta correcta.
  it("corregir en libre devuelve la nota que calcule el motor, sin guardar nada", async () => {
    dobles.corregirEnLibre.mockResolvedValue({ aciertos: 3, total: 5, fallos: [{ numero: 2, marcada: "B" }] });
    expect(await corregirEnLibreAccion("ex1", "CE", { "1": "A" })).toEqual({ aciertos: 3, total: 5, fallos: [{ numero: 2, marcada: "B" }] });
    expect(dobles.corregirEnLibre).toHaveBeenCalledWith("ex1", "CE", ANA.id, { "1": "A" });
    expect(dobles.revalidatePath).not.toHaveBeenCalled();
  });

  // Mutación que la mata: comprobar la prueba después de llamar a la capa de
  // escritura en vez de antes, dejando pasar "XX" hasta guardarRespuesta.
  it("una prueba inventada rebota también en las otras cuatro", async () => {
    expect(await guardarRespuestaAccion("ex1", "XX" as Prueba, 1, "A")).toEqual({ error: "Esa prueba todavía no se puede hacer." });
    expect(await marcarTrozoAccion("ex1", "XX" as Prueba, 1, 1)).toEqual({ error: "Esa prueba todavía no se puede hacer." });
    expect(await entregarPruebaAccion("ex1", "XX" as Prueba)).toEqual({ error: "Esa prueba todavía no se puede hacer." });
    expect(await corregirEnLibreAccion("ex1", "XX" as Prueba, {})).toEqual({ error: "Esa prueba todavía no se puede hacer." });
    expect(dobles.guardarRespuesta).not.toHaveBeenCalled();
    expect(dobles.marcarTrozo).not.toHaveBeenCalled();
    expect(dobles.entregarPrueba).not.toHaveBeenCalled();
    expect(dobles.corregirEnLibre).not.toHaveBeenCalled();
  });

  // Mutación que la mata: pasarle un personaId que venga de fuera en vez de la
  // sesión. Es la regla de las seis acciones: una dirección pública no puede
  // decir por quién escribe.
  it("guardarEscritoAccion escribe por quien tiene la sesión", async () => {
    dobles.guardarEscrito.mockResolvedValue({});
    expect(await guardarEscritoAccion("ex1", 1, "Hola", null)).toEqual({});
    expect(dobles.guardarEscrito).toHaveBeenCalledWith("ex1", ANA.id, 1, "Hola", null, expect.any(Date));
  });
});

// Mutación que la mata: quitar exigirPersona de guardarEscritoAccion. Sin
// sesión, cualquiera escribiría en el examen de otro con solo conocer la
// dirección.
describe("guardarEscritoAccion sin sesión", () => {
  it("no escribe nada", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(null);
    await expect(guardarEscritoAccion("ex1", 1, "Hola", null)).rejects.toThrow("REDIRECT:/entrar");
    expect(dobles.guardarEscrito).not.toHaveBeenCalled();
  });
});

// guardarCorreccionAccion es la única puerta por la que se firma una nota:
// lib/examen/corregir.ts no comprueba papeles, así que TODA la barrera vive
// en exigirProfesor.
describe("guardarCorreccionAccion", () => {
  const ana = ANA; // ESTUDIANTE

  // Mutación que la mata: usar exigirPersona en vez de exigirProfesor. Un
  // estudiante se pondría nota a sí mismo llamando a la dirección.
  it("guardarCorreccionAccion es solo del profesor", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ana); // ESTUDIANTE
    await expect(guardarCorreccionAccion("i1", [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: "" }])).rejects.toThrow();
    expect(dobles.guardarCorreccion).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar exigirPersona/exigirProfesor del todo. Sin
  // ninguna sesión no hay ni papel que mirar.
  it("sin sesión, tampoco entra", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(null);
    await expect(guardarCorreccionAccion("i1", [])).rejects.toThrow("REDIRECT:/entrar");
    expect(dobles.guardarCorreccion).not.toHaveBeenCalled();
  });

  // Mutación que la mata: coger el profesorId de un argumento en vez de la
  // sesión. Una acción de servidor es una dirección pública: con un
  // argumento, cualquiera firmaría en nombre de otro profesor.
  it("firma con quien tiene la sesión, no con lo que llegue de fuera", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(PROFE);
    dobles.guardarCorreccion.mockResolvedValue({});
    const tareas = [{ tarea: 1, bandas: [3, 2, 2, 1], comentario: "Bien" }];

    await guardarCorreccionAccion("i1", tareas);

    expect(dobles.guardarCorreccion).toHaveBeenCalledWith("i1", tareas, PROFE.id, expect.any(Date));
  });

  // Mutación que la mata: no revalidar la cola, o no revalidar la propia
  // pantalla. El profesor vería la redacción que acaba de firmar todavía
  // «por corregir», o la cola con una fila de más.
  it("refresca la cola y la pantalla de esa corrección", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(PROFE);
    dobles.guardarCorreccion.mockResolvedValue({});

    await guardarCorreccionAccion("i1", []);

    expect(dobles.revalidatePath).toHaveBeenCalledWith("/corregir");
    expect(dobles.revalidatePath).toHaveBeenCalledWith("/corregir/i1");
  });

  // Mutación que la mata: comerse el error que devuelva guardarCorreccion
  // (una nota fuera de 0-3, una tarea que no existe) y devolver `{}` fijo.
  it("devuelve el error tal cual si guardarCorreccion lo rechaza", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(PROFE);
    dobles.guardarCorreccion.mockResolvedValue({ error: "Esa nota no vale." });

    const r = await guardarCorreccionAccion("i1", [{ tarea: 1, bandas: [9, 0, 0, 0], comentario: "" }]);

    expect(r).toEqual({ error: "Esa nota no vale." });
  });

  // guardarCorreccion hace `.length` y recorre `bandas` sin comprobar nada:
  // es la única barrera contra una llamada a mano con datos que no tienen la
  // forma del tipo. Una acción de servidor es una dirección pública, así que
  // esto no es hipotético.
  // Mutación que la mata: quitar `tareasConFormaValida` (o su llamada). Con
  // `bandas: null`, `guardarCorreccion` (o el doble, que también haría
  // `.length`) reventaría con un TypeError en vez de devolver `{ error }`.
  it("una tarea con `bandas` que no es un array se rechaza sin tocar guardarCorreccion", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(PROFE);

    const r = await guardarCorreccionAccion("i1", [{ tarea: 1, bandas: null, comentario: "" }] as never);

    expect(r).toEqual({ error: expect.any(String) });
    expect(dobles.guardarCorreccion).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar el tope de longitud del comentario (o
  // subirlo tanto que no lo detecte esta prueba). Sin tope, una llamada a
  // mano podría intentar meter cualquier cosa en esa columna.
  it("un comentario más largo que el tope se rechaza sin tocar guardarCorreccion", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(PROFE);
    const comentarioLargo = "x".repeat(2001);

    const r = await guardarCorreccionAccion("i1", [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: comentarioLargo }]);

    expect(r).toEqual({ error: expect.any(String) });
    expect(dobles.guardarCorreccion).not.toHaveBeenCalled();
  });

  // El caso normal sigue pasando con el tope puesto: 2000 caracteres exactos
  // no se rechazan.
  it("un comentario de hasta el tope sí llega a guardarCorreccion", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(PROFE);
    dobles.guardarCorreccion.mockResolvedValue({});
    const comentarioAlTope = "x".repeat(2000);

    const r = await guardarCorreccionAccion("i1", [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: comentarioAlTope }]);

    expect(r).toEqual({});
    expect(dobles.guardarCorreccion).toHaveBeenCalled();
  });
});
