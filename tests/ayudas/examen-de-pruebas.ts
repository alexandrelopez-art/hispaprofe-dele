// tests/ayudas/examen-de-pruebas.ts
// Un examen publicado, con dos tareas guardadas de verdad (por `guardarTarea`,
// como hace el taller) y sus claves: una de lectura (CE) y una de auditiva
// (CO). La comparten los tests de leer una prueba (Task 3) y los de hacerla
// (Task 4): ambos necesitan el mismo montaje.
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { crearExamen, guardarTarea } from "@/lib/taller/examenes";

export const TOPE = finDelDiaEnMadrid("2026-10-20")!;

// Clave INVENTADA de la lectura 2 (preguntas 7-12). El repositorio es público:
// la del libro no entra aquí, se contrasta a mano en la aceptación.
export const CLAVE_INVENTADA: Record<string, string> = {
  "7": "A", "8": "B", "9": "C", "10": "A", "11": "B", "12": "C",
};

// Clave INVENTADA de la auditiva 3 (preguntas 14-19), tan de mentira como la
// de arriba. Vive en una prueba distinta (CO, no CE) a propósito: es lo que
// hace que filtrar por `prueba` al leer las tareas del examen importe de verdad.
export const CLAVE_INVENTADA_CO: Record<string, string> = {
  "14": "A", "15": "B", "16": "C", "17": "A", "18": "B", "19": "C",
};

/** Una tarea de lectura 2 con sus seis preguntas y su clave inventada. */
async function guardarLectura2(examenId: string): Promise<void> {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 2)!;
  const f = formularioVacio(regla);
  if (f.forma !== "LISTA_COMUN") throw new Error("la lectura 2 es LISTA_COMUN");
  f.consigna = "Lee los textos.";
  f.textos = f.textos.map((t, i) => ({ etiqueta: `Persona ${i + 1}`, texto: `Texto ${i + 1}` }));
  f.actividad.comunes = f.actividad.comunes.map((c) => ({ ...c, texto: `Persona ${c.letra}` }));
  f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Pregunta ${p.numero}` }));
  await guardarTarea(examenId, "CE", 2, f);
}

/**
 * Una tarea de auditiva 3 (la LISTA_COMUN de la prueba oral), con sus seis
 * preguntas y su clave inventada, un trozo de pista. La comparten los tests de
 * `marcarTrozo` (Task 4, que necesitan una tarea de CO que exista de verdad) y
 * la prueba de `pruebaParaHacer` que comprueba que filtra por prueba (Task 3).
 */
async function guardarAuditiva3(examenId: string): Promise<void> {
  const regla = reglaDe("A2_B1_ESCOLAR", "CO", 3)!;
  const f = formularioVacio(regla);
  if (f.forma !== "LISTA_COMUN") throw new Error("la auditiva 3 es LISTA_COMUN");
  f.consigna = "Escucha las conversaciones.";
  f.actividad.comunes = f.actividad.comunes.map((c) => ({ ...c, texto: `Persona ${c.letra}` }));
  f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Pregunta ${p.numero}` }));
  await guardarTarea(examenId, "CO", 3, f);
}

/** Las dos tareas de la escrita, guardadas como las guarda el taller. */
async function guardarEscritas(examenId: string): Promise<void> {
  const regla1 = reglaDe("A2_B1_ESCOLAR", "EE", 1)!;
  const f1 = formularioVacio(regla1);
  if (f1.forma !== "REDACCION_UNA") throw new Error("la escrita 1 es REDACCION_UNA");
  f1.consigna = "Escribe un correo.";
  f1.actividad.situacion = "Un amigo te escribe.";
  f1.actividad.textoRecibido = "¡Hola! ¿Vienes el sábado?";
  f1.actividad.pautas = ["Salúdale", "Dile si vas"];
  f1.actividad.palabras = { min: 60, max: 70 };
  await guardarTarea(examenId, "EE", 1, f1);

  const regla2 = reglaDe("A2_B1_ESCOLAR", "EE", 2)!;
  const f2 = formularioVacio(regla2);
  if (f2.forma !== "REDACCION_DOS") throw new Error("la escrita 2 es REDACCION_DOS");
  f2.consigna = "Elige una opción.";
  f2.actividad.opciones = [
    { titulo: "Opción 1", contexto: "Tu instituto", pautas: ["Cuenta un día"] },
    { titulo: "Opción 2", contexto: "Tus vacaciones", pautas: ["Cuenta un viaje"] },
  ];
  f2.actividad.palabras = { min: 70, max: 80 };
  await guardarTarea(examenId, "EE", 2, f2);
}

export type ExamenDePruebas = { ana: Persona; luis: Persona; examen: Examen };

/**
 * Limpia personas, exámenes y cuadernillos, y monta uno nuevo: Ana y Luis, un
 * cuadernillo inventado con `numeroEnCuadernillo: 1` y sus dos claves, la
 * lectura 2 y la auditiva 3 guardadas con `guardarTarea`, el examen publicado
 * y asignado a Ana con fecha tope. Se crea con `crearExamen`, igual que el
 * taller: es lo que siembra las 14 filas de Tarea vacías, sin las cuales
 * `guardarTarea` no encuentra dónde guardar. Sin cuadernillo y sin número,
 * `guardarTarea` guarda la tarea SIN clave: la clave se copia del cuadernillo
 * en ese momento (Entrega 1). Sin este montaje, comprobar que la clave existe
 * de verdad es imposible, y la nota de quien hace el examen saldría siempre 0
 * de 0. Las dos tareas, en dos pruebas distintas (CE y CO), son también lo que
 * hace que filtrar por `prueba` al leer las tareas del examen importe: con
 * una sola tarea, quitar ese filtro no cambiaría el resultado.
 */
export async function crearExamenDePruebas(): Promise<ExamenDePruebas> {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.cuadernillo.deleteMany();

  const ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  const luis = await prisma.persona.create({ data: { correo: "luis@ejemplo.com", nombre: "Luis", papel: "ESTUDIANTE" } });
  const cuadernillo = await prisma.cuadernillo.create({
    data: { titulo: "Cuadernillo inventado", texto: "", soluciones: { "1": { CE: CLAVE_INVENTADA, CO: CLAVE_INVENTADA_CO } } },
  });
  const creado = await crearExamen({ titulo: "Examen 1", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  await prisma.examen.update({ where: { id: creado.id }, data: { cuadernilloId: cuadernillo.id, numeroEnCuadernillo: 1 } });
  await guardarLectura2(creado.id);
  await guardarAuditiva3(creado.id);
  await guardarEscritas(creado.id);
  const examen = await prisma.examen.update({ where: { id: creado.id }, data: { estado: "PUBLICADO" } });
  await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });

  return { ana, luis, examen };
}
