import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";
import { asignacionesDe, asignacionesDelExamen, asignarExamen, estudiantesParaAsignar, quitarAsignacion } from "@/lib/examen/asignar";
import type { Mensaje } from "@/lib/correo/mensaje";
import { archivarExamen, recuperarExamen, retirarExamen } from "@/lib/taller/examenes";

const TOPE = finDelDiaEnMadrid("2026-10-20")!;

let profesor: Persona;
let ana: Persona;
let luis: Persona;
let examen: Examen;

beforeEach(async () => {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  profesor = await prisma.persona.create({ data: { correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR" } });
  ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  luis = await prisma.persona.create({ data: { correo: "luis@ejemplo.com", nombre: "Luis", papel: "ESTUDIANTE" } });
  examen = await prisma.examen.create({ data: { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
});

describe("la tabla de asignaciones", () => {
  // Mutación que la mata: quitar @@unique([examenId, personaId]). Sin ella, dos
  // clics seguidos en Asignar dejan dos filas y el estudiante recibe dos avisos.
  it("no admite dos veces el mismo examen a la misma persona", async () => {
    await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE, asignadaPorId: profesor.id } });
    await expect(
      prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE, asignadaPorId: profesor.id } }),
    ).rejects.toThrow();
    expect(await prisma.asignacion.count()).toBe(1);
  });

  // Mutación que la mata: poner el modo sin valor por defecto, o por defecto LIBRE.
  it("el modo nace en completo", async () => {
    const creada = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    expect(creada.modo).toBe("COMPLETO");
    expect(creada.asignadaPorId).toBeNull();
  });

  // Mutación que la mata: cambiar el onDelete de Cascade a Restrict en examen o
  // persona; borrar un examen dejaría asignaciones apuntando al vacío.
  it("borrar el examen se lleva sus asignaciones", async () => {
    await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    await prisma.examen.delete({ where: { id: examen.id } });
    expect(await prisma.asignacion.count()).toBe(0);
  });
});

const ANTES = new Date("2026-09-16T10:00:00Z");

describe("asignar un examen", () => {
  // Mutación que la mata: no llamar a finDelDiaEnMadrid y guardar la medianoche
  // UTC, o no mandar el correo.
  it("guarda la fecha tope de Madrid y avisa a cada uno", async () => {
    const enviados: Mensaje[] = [];
    const r = await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async (m) => { enviados.push(m); }, "https://sitio", ANTES);

    expect(r).toEqual({ asignados: 1, sinAviso: [] });
    const guardada = await prisma.asignacion.findFirstOrThrow();
    expect(guardada.fechaTope.toISOString()).toBe("2026-10-20T21:59:59.999Z");
    expect(guardada.asignadaPorId).toBe(profesor.id);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.a).toBe("ana@ejemplo.com");
    expect(enviados[0]!.texto).toContain("martes, 20 de octubre de 2026");
    expect(enviados[0]!.texto).toContain("https://sitio"); // el enlace del sitio: es lo único que la ata a la portada
  });

  // La spec (§10.8) pide «uno por estudiante marcado», y con un solo estudiante
  // en la prueba de arriba, cambiar el `for` por un único `await mandar(...personas[0]...)`
  // seguiría en verde: doce asignados de verdad, once sin correo, y la pantalla
  // diciendo «Asignado a 12.».
  // Mutación que la mata: sustituir el `for (const persona of guardado.personas)`
  // por un envío a una sola persona.
  it("avisa a CADA estudiante marcado, no solo al primero", async () => {
    const enviados: Mensaje[] = [];
    const r = await asignarExamen(
      examen.id,
      [ana.id, luis.id],
      "2026-10-20",
      profesor.id,
      async (m) => { enviados.push(m); },
      "https://sitio",
      ANTES,
    );

    expect(r).toEqual({ asignados: 2, sinAviso: [] });
    expect(await prisma.asignacion.count()).toBe(2);
    expect(enviados).toHaveLength(2);
    expect(enviados.map((m) => m.a).sort()).toEqual(["ana@ejemplo.com", "luis@ejemplo.com"]);
  });

  // Mutación que la mata: deshacer la transacción, o dejar de guardar las
  // asignaciones de los demás, cuando el correo de uno solo revienta. Las
  // asignaciones de todos tienen que seguir en la base, y solo el nombre de
  // quien no recibió el aviso aparece en `sinAviso`.
  it("si el correo revienta con uno solo, el resto sigue asignado y avisado", async () => {
    const r = await asignarExamen(
      examen.id,
      [ana.id, luis.id],
      "2026-10-20",
      profesor.id,
      async (m) => { if (m.a === "ana@ejemplo.com") throw new Error("SMTP caído"); },
      "https://sitio",
      ANTES,
    );

    expect(r).toEqual({ asignados: 2, sinAviso: ["Ana"] });
    expect(await prisma.asignacion.count()).toBe(2);
  });

  // Mutación que la mata: usar create en vez de upsert.
  it("asignárselo otra vez le cambia la fecha y no duplica", async () => {
    const nada = async () => {};
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, nada, "https://sitio", ANTES);
    await asignarExamen(examen.id, [ana.id], "2026-11-05", profesor.id, nada, "https://sitio", ANTES);

    expect(await prisma.asignacion.count()).toBe(1);
    expect((await prisma.asignacion.findFirstOrThrow()).fechaTope.toISOString()).toBe("2026-11-05T22:59:59.999Z");
  });

  // Mutación que la mata: mandar el correo DENTRO de la transacción, o deshacerla
  // si falla. Un correo que rebota dejaría a los otros once sin examen.
  it("si el correo falla, la asignación se queda y dice a quién no le llegó", async () => {
    const r = await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => { throw new Error("SMTP caído"); }, "https://sitio", ANTES);

    expect(r).toEqual({ asignados: 1, sinAviso: ["Ana"] });
    expect(await prisma.asignacion.count()).toBe(1);
  });

  // Mutación que la mata: quitar la comprobación de estado. Asignar un examen en
  // construcción manda a doce personas a un examen que aún cambia.
  it("un examen que no está publicado no se asigna", async () => {
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "EN_CONSTRUCCION" } });
    const r = await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(r).toEqual({ error: "Solo se asigna un examen publicado." });
    expect(await prisma.asignacion.count()).toBe(0);
  });

  // Mutación que la mata: quitar cualquiera de las tres comprobaciones de entrada.
  it("sin nadie, sin fecha o con una fecha pasada no hace nada", async () => {
    const llamar = (ids: string[], dia: string) => asignarExamen(examen.id, ids, dia, profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await llamar([], "2026-10-20")).toEqual({ error: "Marca al menos un estudiante." });
    expect(await llamar([ana.id], "")).toEqual({ error: "Falta la fecha, o no es una fecha." });
    expect(await llamar([ana.id], "2026-09-01")).toEqual({ error: "Esa fecha ya pasó." });
    expect(await prisma.asignacion.count()).toBe(0);
  });

  // Mutación que la mata: no filtrar por papel ni por activa. El profesor se
  // asignaría el examen a sí mismo sin querer al pulsar «marcar todos».
  it("solo se asigna a estudiantes activos, y si uno no vale no se asigna ninguno", async () => {
    const r = await asignarExamen(examen.id, [ana.id, profesor.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(r).toEqual({ error: "Esa lista de estudiantes no vale." });
    expect(await prisma.asignacion.count()).toBe(0);
    expect((await estudiantesParaAsignar()).map((e) => e.nombre)).toEqual(["Ana", "Luis"]);
  });
});

describe("quitar y listar", () => {
  // Mutación que la mata: que quitarAsignacion borre por personaId sin mirar el
  // examen, y se lleve por delante los demás exámenes de esa persona.
  it("quitar borra solo esa pareja", async () => {
    const otro = await prisma.examen.create({ data: { titulo: "Examen 2", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);
    await asignarExamen(otro.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await quitarAsignacion(examen.id, ana.id)).toEqual({});
    expect((await asignacionesDe(ana.id)).map((a) => a.examenId)).toEqual([otro.id]);
    expect(await quitarAsignacion(examen.id, ana.id)).toEqual({ error: "Esa asignación ya no existe." });
  });

  // Mutación que la mata: devolver la fila entera de la base en asignacionesDe.
  // Lo que viaja al navegador del estudiante se construye campo a campo.
  it("lo del estudiante trae lo justo para pintar", async () => {
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await asignacionesDe(ana.id)).toEqual([
      { examenId: examen.id, titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", modo: "COMPLETO", fechaTope: new Date("2026-10-20T21:59:59.999Z") },
    ]);
    expect(await asignacionesDelExamen(examen.id)).toEqual([
      { personaId: ana.id, nombre: "Ana", fechaTope: new Date("2026-10-20T21:59:59.999Z") },
    ]);
  });

  // Mutación que la mata: quitar la comprobación del intento. La asignación cae en
  // cascada sobre el intento: quitar a alguien de la lista le borraría la nota.
  it("no se quita una asignación con un examen empezado", async () => {
    const asignacion = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    expect(await quitarAsignacion(examen.id, ana.id)).toEqual({ error: "Ana ya ha empezado este examen: no se le puede quitar." });
    expect(await prisma.asignacion.count()).toBe(1);
    expect(await prisma.intento.count()).toBe(1);
  });
});

describe("retirar un examen que tiene gente dentro", () => {
  // Mutación que la mata: dejar retirarExamen como estaba (un updateMany sin
  // mirar asignaciones). El estudiante se quedaría mirando un examen que cambia
  // debajo.
  it("no deja, dice los nombres, y el examen sigue publicado", async () => {
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await retirarExamen(examen.id)).toEqual({
      error: "No se puede retirar: lo tienen asignado Ana. Quítaselo antes.",
    });
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("PUBLICADO");
  });

  // Mutación que la mata: quitar el `tx.examen.update` que pasa a
  // EN_CONSTRUCCION. La función seguiría devolviendo {}, pero el examen se
  // quedaría publicado.
  it("sin nadie dentro retira como siempre", async () => {
    expect(await retirarExamen(examen.id)).toEqual({});
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("EN_CONSTRUCCION");
  });
});

describe("archivar", () => {
  // Mutación que la mata: dejar archivar desde publicado. Se saltaría la
  // comprobación de asignaciones, que solo vive en retirar.
  it("un examen publicado hay que retirarlo primero", async () => {
    expect(await archivarExamen(examen.id)).toEqual({ error: "Retíralo antes de archivarlo." });
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("PUBLICADO");
  });

  // Mutación que la mata: que archivar dos veces dé error (publicar lo ya
  // publicado tampoco lo da) o que recuperar no vuelva a construcción.
  it("desde construcción archiva, y recuperar lo devuelve", async () => {
    await retirarExamen(examen.id);
    expect(await archivarExamen(examen.id)).toEqual({});
    expect(await archivarExamen(examen.id)).toEqual({});
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("ARCHIVADO");
    expect(await recuperarExamen(examen.id)).toEqual({});
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("EN_CONSTRUCCION");
  });
});
