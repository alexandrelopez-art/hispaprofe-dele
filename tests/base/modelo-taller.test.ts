import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

// Orden de limpieza: las páginas apuntan a ficheros con Restrict, y el
// examen se lleva por cascada tareas, piezas y actividades.
beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

function unFichero(ruta = "material/pagina-1.jpg") {
  return prisma.fichero.create({
    data: { almacen: "VERCEL", ruta, tipoMime: "image/jpeg", bytes: 10 },
  });
}

function unExamen() {
  return prisma.examen.create({ data: { titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" } });
}

describe("el modelo del taller", () => {
  // Mutación que la mata: quitar A2_B1_ESCOLAR del enum Nivel.
  it("un examen del A2/B1 escolar se guarda", async () => {
    const examen = await unExamen();
    expect(examen.nivel).toBe("A2_B1_ESCOLAR");
  });

  // Mutación que la mata: onDelete Restrict o SetNull en PaginaDeExamen.examen.
  it("borrar el examen se lleva sus páginas", async () => {
    const examen = await unExamen();
    const fichero = await unFichero();
    await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: fichero.id, orden: 1 } });
    await prisma.examen.delete({ where: { id: examen.id } });
    expect(await prisma.paginaDeExamen.count()).toBe(0);
  });

  // Mutación que la mata: quitar @@unique([examenId, orden]).
  it("dos páginas con el mismo orden en un examen rebotan", async () => {
    const examen = await unExamen();
    const a = await unFichero("material/a.jpg");
    const b = await unFichero("material/b.jpg");
    await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: a.id, orden: 1 } });
    await expect(
      prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: b.id, orden: 1 } }),
    ).rejects.toThrow();
  });

  // Mutación que la mata: onDelete Cascade en PaginaDeExamen.fichero.
  it("no se puede borrar un fichero que es página de un examen", async () => {
    const examen = await unExamen();
    const fichero = await unFichero();
    await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: fichero.id, orden: 1 } });
    await expect(prisma.fichero.delete({ where: { id: fichero.id } })).rejects.toThrow();
  });

  // Mutación que la mata: onDelete SetNull en Examen.cuadernillo.
  it("no se puede borrar un cuadernillo que usa un examen", async () => {
    const cuadernillo = await prisma.cuadernillo.create({
      data: { titulo: "Inventado", texto: "SOLUCIONES", soluciones: {} },
    });
    await prisma.examen.create({
      data: { titulo: "Con cuadernillo", nivel: "A2_B1_ESCOLAR", cuadernilloId: cuadernillo.id, numeroEnCuadernillo: 1 },
    });
    await expect(prisma.cuadernillo.delete({ where: { id: cuadernillo.id } })).rejects.toThrow();
  });

  // Mutación que la mata: quitar CONVERSACION del enum TipoActividad.
  it("una actividad puede ser una conversación en directo", async () => {
    const examen = await unExamen();
    const tarea = await prisma.tarea.create({ data: { examenId: examen.id, prueba: "EO", numero: 2 } });
    const pieza = await prisma.pieza.create({ data: { tareaId: tarea.id, orden: 0, tipo: "ACTIVIDAD" } });
    const actividad = await prisma.actividad.create({
      data: { piezaId: pieza.id, tipo: "CONVERSACION", datos: { forma: "ORAL_DIRECTO" } },
    });
    expect(actividad.tipo).toBe("CONVERSACION");
  });

  // Mutación que la mata: cambiar @default([]) de etiquetas por otro valor,
  // p.ej. @default(["revisar"]) (quitar el @default a secas no la mata: sin
  // él, Prisma sigue escribiendo [] al crear, sea por el DEFAULT de la
  // columna en la migración o por el propio motor de listas de Prisma).
  it("las etiquetas de una página nacen vacías", async () => {
    const examen = await unExamen();
    const fichero = await unFichero();
    const pagina = await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: fichero.id, orden: 1 } });
    expect(pagina.etiquetas).toEqual([]);
  });
});
