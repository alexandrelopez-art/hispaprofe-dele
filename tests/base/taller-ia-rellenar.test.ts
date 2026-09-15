import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { crearExamen, guardarTarea } from "@/lib/taller/examenes";
import { rellenarTarea, type Dependencias } from "@/lib/taller/ia/rellenar";
import { apuntarLlamada } from "@/lib/taller/ia/registro";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

const ce3 = reglaDe("A2_B1_ESCOLAR", "CE", 3)!;
const USO = { entrada: 1000, cacheLeidos: 0, cacheEscritos: 0, salida: 100 };

async function examenConHoja(etiquetas: string[]) {
  const creado = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  const fichero = await prisma.fichero.create({ data: { almacen: "VERCEL", ruta: "material/hoja-1.jpg", tipoMime: "image/jpeg", bytes: 10 } });
  await prisma.paginaDeExamen.create({ data: { examenId: creado.id, ficheroId: fichero.id, orden: 1, etiquetas } });
  return creado.id;
}

function dobles(salida: unknown, extra: Partial<Dependencias> = {}): Dependencias {
  return {
    leer: vi.fn(async () => ({ salida, stopReason: "end_turn", modelo: "claude-opus-5", uso: USO })),
    descargar: vi.fn(async () => ({ datos: "AAAA", tipo: "image/jpeg" as const })),
    hayClave: () => true,
    reloj: () => 0,
    apuntar: apuntarLlamada,
    ...extra,
  };
}

const leido = () => ({ formulario: { ...formularioVacio(ce3), consigna: "Lee el texto." }, dudas: [] });

/** Todo lo que guarda una tarea, para comparar antes y después. */
async function fotoDeLaTarea() {
  return {
    tareas: await prisma.tarea.findMany({ orderBy: { id: "asc" } }),
    piezas: await prisma.pieza.findMany({ orderBy: { id: "asc" } }),
    actividades: await prisma.actividad.findMany({ orderBy: { id: "asc" } }),
    claves: await prisma.clave.findMany({ orderBy: { id: "asc" } }),
  };
}

describe("rellenar una tarea con IA", () => {
  // Mutación que la mata: no pasar las hojas a leer (encargo con hojas []).
  it("lee las hojas de la tarea y devuelve el formulario", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido());
    const r = await rellenarTarea(examenId, "CE", 3, d);
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("Lee el texto.");
    expect(d.descargar).toHaveBeenCalledWith("material/hoja-1.jpg", "image/jpeg");
    expect(vi.mocked(d.leer).mock.calls[0][0].hojas).toEqual([{ datos: "AAAA", tipo: "image/jpeg" }]);
  });

  // LA garantía de la entrega: nada entra sin que el profesor lo vea.
  // Mutación que la mata: llamar a guardarTarea dentro de rellenarTarea.
  it("no cambia ninguna fila de Tarea, Pieza, Actividad ni Clave", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const guardado = await guardarTarea(examenId, "CE", 3, { ...formularioVacio(ce3), consigna: "Lo que había." });
    if ("error" in guardado) throw new Error(guardado.error);
    const antes = await fotoDeLaTarea();
    const r = await rellenarTarea(examenId, "CE", 3, dobles(leido()));
    expect("error" in r).toBe(false);
    expect(await fotoDeLaTarea()).toEqual(antes);
  });

  // Mutación que la mata: apuntar la llamada solo cuando sale bien.
  it("una respuesta que no vale devuelve error y apunta la llamada como ERROR", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const r = await rellenarTarea(examenId, "CE", 3, dobles({ formulario: { forma: "HUECOS" }, dudas: [] }));
    expect(r).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
    const filas = await prisma.llamadaDeIA.findMany();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ resultado: "ERROR", tokensEntrada: 1000, examenId, prueba: "CE", numero: 3 });
  });

  // Mutación que la mata: no apuntar cuando leer lanza.
  it("si la llamada revienta, apunta la llamada con el mensaje traducido", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const examenId = await examenConHoja(["CE-3"]);
      const r = await rellenarTarea(examenId, "CE", 3, dobles(null, { leer: vi.fn(async () => { throw new SyntaxError("x"); }) }));
      expect(r).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
      expect(await prisma.llamadaDeIA.count()).toBe(1);
    } finally {
      espia.mockRestore();
    }
  });

  // Mutación que la mata: no guardar el detalle real tras « — », o llevarlo a la respuesta del profesor.
  it("el detalle real del fallo queda en el registro tras « — », y la respuesta al profesor no lo lleva", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const examenId = await examenConHoja(["CE-3"]);
      const r = await rellenarTarea(examenId, "CE", 3, dobles(null, { leer: vi.fn(async () => { throw new SyntaxError("mensaje raro del SDK"); }) }));
      expect(r).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
      const filas = await prisma.llamadaDeIA.findMany();
      expect(filas).toHaveLength(1);
      expect(filas[0].error).toBe("La IA devolvió algo que no es esta tarea. — mensaje raro del SDK");
      expect(espia).toHaveBeenCalledWith("Llamada a la IA fallida", expect.any(SyntaxError));
    } finally {
      espia.mockRestore();
    }
  });

  // Mutación que la mata: quitar la comprobación de hojas.
  it("sin hojas etiquetadas no llama a la IA ni apunta nada", async () => {
    const examenId = await examenConHoja(["CE-4"]);
    const d = dobles(leido());
    expect(await rellenarTarea(examenId, "CE", 3, d)).toEqual({ error: "Etiqueta primero las hojas de esta tarea." });
    expect(d.leer).not.toHaveBeenCalled();
    expect(await prisma.llamadaDeIA.count()).toBe(0);
  });

  // Mutación que la mata: quitar la comprobación de la clave.
  it("sin clave no llama a la IA", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido(), { hayClave: () => false });
    expect(await rellenarTarea(examenId, "CE", 3, d)).toEqual({ error: "Falta la clave de la IA." });
    expect(d.leer).not.toHaveBeenCalled();
  });

  // Mutación que la mata: seguir con las hojas que sí se descargaron.
  it("una hoja que no se descarga para todo, sin llamar ni apuntar", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido(), { descargar: vi.fn(async () => { throw new Error("404"); }) });
    expect(await rellenarTarea(examenId, "CE", 3, d)).toEqual({ error: "No se pudo leer la hoja 1 del almacén." });
    expect(d.leer).not.toHaveBeenCalled();
    expect(await prisma.llamadaDeIA.count()).toBe(0);
  });

  // Mutación que la mata: quitar el try/catch alrededor de deps.apuntar.
  it("si apuntar la llamada revienta, aun así devuelve el formulario", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido(), {
      apuntar: vi.fn(async () => {
        throw new Error("la base no responde");
      }),
    });
    const r = await rellenarTarea(examenId, "CE", 3, d);
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("Lee el texto.");
    expect(espia).toHaveBeenCalled();
    espia.mockRestore();
  });
});
