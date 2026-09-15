import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { reglaDe } from "@/lib/dele/estructura";
import { actividadParaElEstudiante } from "@/lib/examen/paraElEstudiante";
import { formularioVacio } from "@/lib/taller/formas";
import { apuntarLlamada } from "@/lib/taller/ia/registro";
import {
  crearExamen,
  examenParaElTaller,
  guardarTarea,
  listarExamenes,
  tareaParaElTaller,
} from "@/lib/taller/examenes";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

// Letras inventadas: el repo es público.
const SOLUCIONES = {
  "1": { CE: { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" }, CO: {} },
  "2": { CE: { "13": "C", "14": "C", "15": "C", "16": "C", "17": "C", "18": "C" }, CO: {} },
};

async function examenConCuadernillo(numero: number | null = 1) {
  const cuadernillo = await prisma.cuadernillo.create({ data: { titulo: "Inventado", texto: "SOLUCIONES", soluciones: SOLUCIONES } });
  const creado = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  await prisma.examen.update({ where: { id: creado.id }, data: { cuadernilloId: cuadernillo.id, numeroEnCuadernillo: numero } });
  return creado.id;
}

function ce3Lleno() {
  const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
  if (f.forma !== "OPCIONES") throw new Error();
  f.consigna = "Lee el texto.";
  f.textos[0] = { etiqueta: "", texto: "Un texto inventado." };
  for (const p of f.actividad.preguntas) {
    p.enunciado = `Pregunta ${p.numero}`;
    for (const o of p.opciones) o.texto = `Opción ${o.letra}`;
  }
  return f;
}

describe("crear un examen", () => {
  // Mutación que la mata: no crear las tareas al crear el examen.
  it("el escolar nace con sus catorce tareas", async () => {
    const r = await crearExamen({ titulo: "  Libro, examen 1 ", nivel: "A2_B1_ESCOLAR" });
    if ("error" in r) throw new Error(r.error);
    const examen = await prisma.examen.findUniqueOrThrow({ where: { id: r.id }, include: { tareas: true } });
    expect(examen.titulo).toBe("Libro, examen 1");
    expect(examen.tareas).toHaveLength(14);
  });

  // Mutación que la mata: aceptar cualquier valor del enum Nivel.
  it("un nivel sin números no se crea", async () => {
    expect(await crearExamen({ titulo: "B2", nivel: "B2" })).toEqual({ error: "Ese nivel todavía no tiene sus números en el taller." });
    expect(await crearExamen({ titulo: "Nada", nivel: "Z9" })).toHaveProperty("error");
    expect(await prisma.examen.count()).toBe(0);
  });

  // Mutación que la mata: comprobar `!datos.titulo` en vez de `!titulo` (el título sin recortar).
  it("sin título no se crea", async () => {
    expect(await crearExamen({ titulo: "   ", nivel: "A2_B1_ESCOLAR" })).toEqual({ error: "El examen necesita un título." });
  });
});

describe("listar exámenes", () => {
  // Mutación que la mata: `orderBy: { createdAt: "asc" }` en vez de "desc".
  it("trae el más nuevo primero, con solo las columnas de la lista", async () => {
    const primero = await crearExamen({ titulo: "El primero", nivel: "A2_B1_ESCOLAR" });
    const segundo = await crearExamen({ titulo: "El segundo", nivel: "A2_B1_ESCOLAR" });
    if ("error" in primero || "error" in segundo) throw new Error();
    const lista = await listarExamenes();
    expect(lista.map((e) => e.id)).toEqual([segundo.id, primero.id]);
    for (const fila of lista) expect(Object.keys(fila).sort()).toEqual(["estado", "id", "nivel", "titulo"]);
  });
});

describe("guardar una tarea", () => {
  // Mutación que la mata: no crear la Clave al crear la Actividad (dejar `clave: undefined` siempre).
  it("guarda consigna, texto y actividad, y la clave del cuadernillo aparte", async () => {
    const id = await examenConCuadernillo();
    const r = await guardarTarea(id, "CE", 3, ce3Lleno());
    expect(r).toEqual({ estado: { estado: "COMPLETA", motivos: [] } });

    const piezas = await prisma.pieza.findMany({
      where: { tarea: { examenId: id, prueba: "CE", numero: 3 } },
      include: { actividad: { include: { clave: true } } },
      orderBy: { orden: "asc" },
    });
    expect(piezas.map((p) => p.tipo)).toEqual(["TEXTO", "TEXTO", "ACTIVIDAD"]);
    const actividad = piezas[2].actividad!;
    expect(actividad.tipo).toBe("OPCION");
    expect(actividad.clave?.respuestas).toEqual(SOLUCIONES["1"].CE);
    // Lo que sale hacia el estudiante no lleva la clave por ningún lado.
    expect(JSON.stringify(actividadParaElEstudiante(actividad))).not.toContain('"respuestas"');
  });

  // Mutación que la mata: no borrar las piezas viejas antes de escribir.
  it("guardar dos veces sustituye, no duplica", async () => {
    const id = await examenConCuadernillo();
    await guardarTarea(id, "CE", 3, ce3Lleno());
    await guardarTarea(id, "CE", 3, ce3Lleno());
    expect(await prisma.pieza.count({ where: { tarea: { examenId: id } } })).toBe(3);
    expect(await prisma.clave.count()).toBe(1);
  });

  // Mutación que la mata: quitar el `SELECT ... FOR UPDATE` que bloquea la
  // fila de la Tarea al principio de la transacción. Comprobado en esta
  // máquina: quitando el candado, la prueba cae en rojo 3 de 3 veces con
  // «Unique constraint failed on the constraint: `Pieza_tareaId_orden_key`»
  // (el borrado del segundo guardado no encuentra piezas que borrar porque el
  // primero ya las sustituyó, y sus creaciones chocan). Con el candado puesto,
  // verde.
  it("dos guardados a la vez de la misma tarea no fallan y dejan una sola copia", async () => {
    const id = await examenConCuadernillo();
    for (let i = 0; i < 10; i++) {
      const [r1, r2] = await Promise.all([guardarTarea(id, "CE", 3, ce3Lleno()), guardarTarea(id, "CE", 3, ce3Lleno())]);
      expect(r1).toHaveProperty("estado");
      expect(r2).toHaveProperty("estado");
    }
    expect(await prisma.pieza.count({ where: { tarea: { examenId: id } } })).toBe(3);
    expect(await prisma.clave.count()).toBe(1);
  });

  // Mutación que la mata: escribir sin validar con esquemaDelFormulario.
  it("unos datos que no casan no escriben nada", async () => {
    const id = await examenConCuadernillo();
    const malo = { ...ce3Lleno(), extra: true };
    expect(await guardarTarea(id, "CE", 3, malo)).toEqual({
      error: "Los datos no casan con la forma de la tarea. No se ha guardado nada.",
    });
    expect(await prisma.pieza.count()).toBe(0);
  });

  // Mutación que la mata: devolver el estado con `formulario` cambiado por `null` (VACIA en vez de A_MEDIAS).
  it("una tarea a medias se guarda igual y dice qué falta", async () => {
    const id = await examenConCuadernillo();
    const f = ce3Lleno();
    f.consigna = "";
    const r = await guardarTarea(id, "CE", 3, f);
    expect(r).toMatchObject({ estado: { estado: "A_MEDIAS", motivos: ["Falta la consigna."] } });
    expect(await prisma.pieza.count()).toBe(3);
  });

  // Mutación que la mata: crear la Clave con `clave ?? {}` en vez de comprobar `clave ?` antes de crearla.
  it("sin cuadernillo se guarda sin clave", async () => {
    const creado = await crearExamen({ titulo: "Sin cuadernillo", nivel: "A2_B1_ESCOLAR" });
    if ("error" in creado) throw new Error();
    await guardarTarea(creado.id, "CE", 3, ce3Lleno());
    expect(await prisma.clave.count()).toBe(0);
  });

  // Mutación que la mata: quitar entera la comprobación `if (!examen || !tarea || !regla) return { error: ... }` en guardarTarea.
  it("una tarea que no existe", async () => {
    const id = await examenConCuadernillo();
    expect(await guardarTarea(id, "CE", 9, ce3Lleno())).toEqual({ error: "Esa tarea no existe." });
    expect(await guardarTarea("no-existe", "CE", 3, ce3Lleno())).toEqual({ error: "Esa tarea no existe." });
  });
});

describe("leer para el taller", () => {
  // Mutación que la mata: invertir el orden del `.sort` a `(a, b) => b.numero - a.numero`.
  it("el examen trae sus catorce tareas en orden, con su estado", async () => {
    const id = await examenConCuadernillo();
    await guardarTarea(id, "CE", 3, ce3Lleno());
    const examen = (await examenParaElTaller(id))!;
    expect(examen.tareas.map((t) => `${t.prueba}-${t.numero}`)).toEqual([
      "CE-1", "CE-2", "CE-3", "CE-4", "CO-1", "CO-2", "CO-3", "CO-4",
      "EE-1", "EE-2", "EO-1", "EO-2", "EO-3", "EO-4",
    ]);
    expect(examen.tareas[2].estado.estado).toBe("COMPLETA");
    expect(examen.tareas[0].estado.estado).toBe("VACIA");
    expect(examen.cuadernillo?.resumen.map((r) => r.examen)).toEqual(["1", "2"]);
  });

  // Mutación que la mata: no pasar la clave guardada a estadoDeTarea.
  it("si se cambia el número de examen del cuadernillo, la tarea pide volver a guardar", async () => {
    const id = await examenConCuadernillo(1);
    await guardarTarea(id, "CE", 3, ce3Lleno());
    await prisma.examen.update({ where: { id }, data: { numeroEnCuadernillo: 2 } });
    const examen = (await examenParaElTaller(id))!;
    expect(examen.tareas[2].estado.motivos).toContain(
      "La clave guardada no coincide con el cuadernillo: vuelve a guardar la tarea.",
    );
  });

  // Mutación que la mata: no filtrar las páginas por la etiqueta de la tarea.
  it("la tarea trae solo sus páginas, en orden", async () => {
    const id = await examenConCuadernillo();
    const ficheros = await Promise.all(
      [1, 2, 3].map((n) => prisma.fichero.create({ data: { almacen: "VERCEL", ruta: `material/p${n}.jpg`, tipoMime: "image/jpeg", bytes: 1 } })),
    );
    await prisma.paginaDeExamen.createMany({
      data: [
        { examenId: id, ficheroId: ficheros[0].id, orden: 1, etiquetas: ["CE-2"] },
        { examenId: id, ficheroId: ficheros[1].id, orden: 2, etiquetas: ["CE-2", "CE-3"] },
        { examenId: id, ficheroId: ficheros[2].id, orden: 3, etiquetas: ["CE-3"] },
      ],
    });
    const tarea = (await tareaParaElTaller(id, "CE", 3))!;
    expect(tarea.paginas).toEqual([
      { ficheroId: ficheros[1].id, orden: 2 },
      { ficheroId: ficheros[2].id, orden: 3 },
    ]);
    expect(tarea.guardada).toBe(false);
    expect(tarea.respuestas).toEqual(SOLUCIONES["1"].CE);
  });

  // Mutación que la mata: buscar la hermana con `t.numero === numero` en vez de `t.numero === regla.hermana`.
  it("una oral en directo trae los temas de su hermana", async () => {
    const id = await examenConCuadernillo();
    const eo1 = formularioVacio(reglaDe("A2_B1_ESCOLAR", "EO", 1)!);
    if (eo1.forma !== "ORAL_SOLO") throw new Error();
    eo1.actividad.opciones[0].tema = "Las vacaciones";
    eo1.actividad.opciones[1].tema = "El deporte";
    await guardarTarea(id, "EO", 1, eo1);
    expect((await tareaParaElTaller(id, "EO", 2))!.temasDeLaHermana).toEqual(["Las vacaciones", "El deporte"]);
    expect((await tareaParaElTaller(id, "EO", 1))!.temasDeLaHermana).toBeNull();
  });

  // Mutación que la mata: quitar el `if (!examen) return null` inicial de examenParaElTaller.
  it("una tarea o un examen que no existen", async () => {
    const id = await examenConCuadernillo();
    expect(await tareaParaElTaller(id, "CE", 7)).toBeNull();
    expect(await examenParaElTaller("no-existe")).toBeNull();
  });

  // Mutación que la mata: no rellenar `gasto` en examenParaElTaller (dejarlo a cero).
  it("el examen del taller trae el gasto de sus llamadas a la IA", async () => {
    const id = await examenConCuadernillo();
    await apuntarLlamada({ examenId: id, prueba: "CE", numero: 3, modelo: "claude-opus-5", uso: { entrada: 10_000, cacheLeidos: 0, cacheEscritos: 0, salida: 0 }, milisegundos: 1, error: null });
    expect((await examenParaElTaller(id))!.gasto).toEqual({ llamadas: 1, milesimas: 50 });
  });
});

describe("fotos y pista al guardar", () => {
  function fichero(tipoMime: string) {
    return prisma.fichero.create({ data: { almacen: "VERCEL", ruta: `material/${Math.random().toString(36).slice(2)}`, tipoMime, bytes: 1 } });
  }
  const co1 = () => formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);

  // Mutación que la mata: no escribir `cortes` (o `ficheroId`) al crear la pieza.
  it("la foto y la pista con sus marcas van y vuelven", async () => {
    const id = await examenConCuadernillo();
    const [foto, pista] = [await fichero("image/jpeg"), await fichero("audio/mpeg")];
    const f = co1();
    f.medios = { imagenes: { "ejemplo-A": foto.id }, audio: { fichero: pista.id, cortes: [30.5, 75.25] } };
    const r = await guardarTarea(id, "CO", 1, f);
    if ("error" in r) throw new Error(r.error);
    expect((await tareaParaElTaller(id, "CO", 1))!.formulario.medios).toEqual(f.medios);
  });

  // Mutación que la mata: comprobar que el fichero existe sin mirar que sea una imagen.
  it("una foto que no es una imagen no se guarda, y no se escribe nada", async () => {
    const id = await examenConCuadernillo();
    const f = co1();
    f.medios.imagenes["ejemplo-A"] = (await fichero("audio/mpeg")).id;
    expect(await guardarTarea(id, "CO", 1, f)).toEqual({ error: "Una de las fotos ya no existe: vuelve a subirla." });
    expect(await prisma.pieza.count()).toBe(0);
  });

  // Mutación que la mata: no comprobar la pista.
  it("una pista que no existe no se guarda", async () => {
    const id = await examenConCuadernillo();
    const f = co1();
    f.medios.audio = { fichero: "no-existe", cortes: [] };
    expect(await guardarTarea(id, "CO", 1, f)).toEqual({ error: "La pista de audio ya no existe: vuelve a subirla." });
    expect(await prisma.pieza.count()).toBe(0);
  });
});
