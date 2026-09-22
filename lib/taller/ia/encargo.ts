import { z } from "zod";
import type { Nivel, Prueba } from "@/lib/generated/prisma";
import { NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, letrasHasta, type Forma, type ReglaTarea } from "@/lib/dele/estructura";
import { ESQUEMA_PARA_LA_IA, formularioVacio, type Formulario } from "@/lib/taller/formas";

export type TipoDeHoja = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export type Hoja = { datos: string; tipo: TipoDeHoja };
/**
 * `forma` va aparte de `regla` porque el esquema de la respuesta solo depende
 * de ella; `regla` la necesita el lector local, que rellena el formulario él
 * mismo y para eso tiene que saber cuántos ítems y cuántas letras lleva.
 */
export type Encargo = { system: string; hojas: Hoja[]; texto: string; forma: Forma; regla: ReglaTarea };

/**
 * Igual en todas las llamadas, letra a letra: es el bloque que la API
 * reaprovecha de una tarea a la siguiente. Nada que dependa de la tarea va aquí.
 */
export const INSTRUCCIONES = `Transcribes tareas de exámenes del DELE A2/B1 para escolares a partir de las fotos de sus hojas. Lo que devuelvas lo verá un estudiante tal cual, en una web.

Recibirás las hojas de UNA tarea y su formulario vacío en JSON. Devuelve ese mismo formulario con los textos rellenados.

- Copia los textos literalmente, con sus tildes, su puntuación y sus párrafos. No resumas, no corrijas, no traduzcas.
- No cambies números, letras, grupos ni el campo conImagen: vienen puestos y mandan.
- No marques ni deduzcas respuestas correctas: no hay ningún campo para ellas. La letra del ejemplo resuelto sí se copia si la hoja la muestra.
- La consigna va corregida para la web: quita lo que solo existe en papel, como la «Hoja de respuestas» o marcar con lápiz. El resto de la consigna, literal.
- Si una opción es un dibujo o una foto (conImagen: true), deja su texto vacío y no la describas.
- Las letras, en mayúscula, sin paréntesis ni punto.
- En los huecos, el texto va con cada hueco marcado con su número entre corchetes, así: [19]. Cada marca, una sola vez.
- En la expresión oral, copia las opciones en el orden en que aparecen en las hojas.
- Rangos (palabras, minutos) y minutos de preparación: los números que diga la hoja; si no los dice, null.
- Un texto que no está en las hojas se deja vacío y se apunta en dudas.

Dudas: por cada campo que no hayas podido leer con seguridad, añade a dudas un objeto con campo y nota. campo es la ruta del campo en el formulario, con puntos e índices desde cero, por ejemplo actividad.preguntas.2.enunciado. nota dice en pocas palabras qué no se lee o qué has supuesto.`;

function del(regla: ReglaTarea): string {
  const primero = regla.primero ?? 0;
  const items = regla.items ?? 0;
  return `del ${primero} al ${primero + items - 1}`;
}

function rangoDeLetras(n: number): string {
  const abc = letrasHasta(n);
  return `${abc[0]}-${abc[abc.length - 1]}`;
}

export function descripcionDeLaForma(regla: ReglaTarea): string {
  const items = regla.items ?? 0;
  switch (regla.forma) {
    case "RELACIONAR": {
      const elementos = regla.elementosConTexto
        ? `${items} elementos (${del(regla)}) con su texto`
        : `${items} elementos (${del(regla)}) sin texto, que son «Mensaje 1» a «Mensaje ${items}»`;
      const destinos = `${regla.letras} textos con letra (${rangoDeLetras(regla.letras)})${regla.elementosConTexto ? "" : ", que son los enunciados"}`;
      // Sin texto, los elementos acaban en «Mensaje 6»: la coma antes de «y» separa las dos listas.
      const y = regla.elementosConTexto ? " y " : ", y ";
      return `un ejemplo, ${elementos}${y}${destinos}, de los que sobran ${regla.letras - items}`;
    }
    case "LISTA_COMUN": {
      const partes = [];
      if (regla.textos > 0) partes.push(`${regla.textos} textos sueltos, uno por persona con su nombre en «etiqueta»`);
      partes.push(`una lista común de ${regla.letras} opciones (${rangoDeLetras(regla.letras)})`);
      if (regla.ejemplo) partes.push("un ejemplo");
      partes.push(`${items} preguntas (${del(regla)})`);
      return partes.join("; ");
    }
    case "OPCIONES": {
      const partes = [];
      if (regla.textos > 0) partes.push("un texto largo");
      if (regla.ejemplo) partes.push("un ejemplo");
      partes.push(`${items} preguntas (${del(regla)}) con ${regla.letras} opciones cada una (${rangoDeLetras(regla.letras)})`);
      if (regla.itemsConImagen) partes.push(`las opciones ${regla.ejemplo ? "del ejemplo y " : ""}de las ${regla.itemsConImagen} primeras preguntas son dibujos`);
      if (regla.grupos) partes.push(`en ${regla.grupos} grupos de ${items / regla.grupos} preguntas`);
      return partes.join("; ");
    }
    case "HUECOS":
      return `un texto con ${items} huecos (${del(regla)}), cada uno con ${regla.letras} opciones (${rangoDeLetras(regla.letras)})`;
    case "REDACCION_UNA":
      return "una situación, el texto recibido si lo hay, las pautas y el número de palabras";
    case "REDACCION_DOS":
      return "dos opciones, cada una con título, contexto y pautas, y el número de palabras";
    case "ORAL_SOLO":
      return `dos opciones, cada una con su tema y sus pautas${regla.opcionesConImagen ? ", y cada una lleva una foto" : ""}; los minutos y la preparación`;
    case "ORAL_DIRECTO":
      return "dos opciones de conversación con el examinador, cada una con tema, situación, papel del examinador y pautas; los minutos";
  }
}

/** El formulario sin las fotos ni la pista: la IA no las ve, no las rellena y no las devuelve. */
export function sinMedios(f: Formulario): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...f };
  delete copia.medios;
  return copia;
}

export function esquemaDeRespuesta(forma: Forma) {
  return z.strictObject({
    formulario: ESQUEMA_PARA_LA_IA[forma],
    dudas: z.array(z.strictObject({ campo: z.string(), nota: z.string() })),
  });
}

export function encargoDeTarea(nivel: Nivel, prueba: Prueba, regla: ReglaTarea, hojas: Hoja[]): Encargo {
  const texto = [
    `Tarea: ${NOMBRE_DE_PRUEBA[prueba]}, tarea ${regla.numero}, ${NOMBRE_DE_NIVEL[nivel]}.`,
    `Qué tiene: ${descripcionDeLaForma(regla)}.`,
    "Formulario vacío:",
    JSON.stringify(sinMedios(formularioVacio(regla)), null, 2),
  ].join("\n");
  return { system: INSTRUCCIONES, hojas, texto, forma: regla.forma, regla };
}
