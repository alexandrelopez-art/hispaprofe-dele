import { z } from "zod";
import type { TipoActividad } from "@/lib/generated/prisma";
import { letrasHasta, type Forma, type ReglaTarea } from "@/lib/dele/estructura";
import { cortesEnOrden, huecosDeImagen } from "./medios";

// Los textos pueden llegar vacíos: guardar a medias es legal. Lo que falta lo
// dice el estado de la tarea (lib/taller/estado.ts), no el esquema. El esquema
// solo garantiza la FORMA, y es estricto: un campo que no conoce, rebota.
const texto = z.string().max(20_000);
const letra = z.string().max(1);
const numeroDelLibro = z.number().int().min(1).max(99);
const pautas = z.array(texto).max(12);
const rango = z.strictObject({
  min: z.number().int().min(0).nullable(),
  max: z.number().int().min(0).nullable(),
});
const textoSuelto = z.strictObject({ etiqueta: texto, texto });
const textos = z.array(textoSuelto).max(5);
const opcion = z.strictObject({ letra, texto, conImagen: z.boolean() });
const letraConTexto = z.strictObject({ letra, texto });
const idDeFichero = z.string().min(1).max(40);
const medios = z.strictObject({
  /** Clave de `huecosDeImagen` → id del Fichero. */
  imagenes: z.record(z.string().max(20), idDeFichero),
  audio: z.strictObject({ fichero: idDeFichero, cortes: z.array(z.number()).max(20) }).nullable(),
});
export type Medios = z.infer<typeof medios>;

const relacionar = z.strictObject({
  forma: z.literal("RELACIONAR"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    ejemplo: z.strictObject({ texto, letra }),
    elementos: z.array(z.strictObject({ numero: numeroDelLibro, texto })).max(20),
    destinos: z.array(z.strictObject({ letra, titulo: texto, texto })).max(20),
  }),
});

const listaComun = z.strictObject({
  forma: z.literal("LISTA_COMUN"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    comunes: z.array(letraConTexto).max(10),
    ejemplo: z.strictObject({ enunciado: texto, letra }).nullable(),
    preguntas: z.array(z.strictObject({ numero: numeroDelLibro, enunciado: texto })).max(20),
  }),
});

const opciones = z.strictObject({
  forma: z.literal("OPCIONES"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    ejemplo: z.strictObject({ enunciado: texto, opciones: z.array(opcion).max(10), letra }).nullable(),
    preguntas: z
      .array(
        z.strictObject({
          numero: numeroDelLibro,
          enunciado: texto,
          opciones: z.array(opcion).max(10),
          grupo: z.number().int().min(1).nullable(),
        }),
      )
      .max(20),
  }),
});

const huecos = z.strictObject({
  forma: z.literal("HUECOS"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    titulo: texto,
    texto,
    fuente: texto,
    huecos: z.array(z.strictObject({ numero: numeroDelLibro, opciones: z.array(letraConTexto).max(10) })).max(20),
  }),
});

const redaccionUna = z.strictObject({
  forma: z.literal("REDACCION_UNA"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({ situacion: texto, textoRecibido: texto, pautas, palabras: rango }),
});

const redaccionDos = z.strictObject({
  forma: z.literal("REDACCION_DOS"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    opciones: z.array(z.strictObject({ titulo: texto, contexto: texto, pautas })).max(4),
    palabras: rango,
  }),
});

const oralSolo = z.strictObject({
  forma: z.literal("ORAL_SOLO"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    opciones: z.array(z.strictObject({ tema: texto, pautas, conImagen: z.boolean() })).max(4),
    minutos: rango,
    preparacion: z.number().int().min(0).nullable(),
  }),
});

const oralDirecto = z.strictObject({
  forma: z.literal("ORAL_DIRECTO"),
  consigna: texto,
  textos,
  medios,
  actividad: z.strictObject({
    opciones: z.array(z.strictObject({ tema: texto, situacion: texto, papelExaminador: texto, pautas })).max(4),
    minutos: rango,
  }),
});

export const formularioBase = z.discriminatedUnion("forma", [
  relacionar,
  listaComun,
  opciones,
  huecos,
  redaccionUna,
  redaccionDos,
  oralSolo,
  oralDirecto,
]);

export type Formulario = z.infer<typeof formularioBase>;
export type FormularioDe<F extends Forma> = Extract<Formulario, { forma: F }>;

/** Lo que ve la IA: cada forma sin `medios` (las fotos y la pista no son suyas). */
export const ESQUEMA_PARA_LA_IA = {
  RELACIONAR: relacionar.omit({ medios: true }),
  LISTA_COMUN: listaComun.omit({ medios: true }),
  OPCIONES: opciones.omit({ medios: true }),
  HUECOS: huecos.omit({ medios: true }),
  REDACCION_UNA: redaccionUna.omit({ medios: true }),
  REDACCION_DOS: redaccionDos.omit({ medios: true }),
  ORAL_SOLO: oralSolo.omit({ medios: true }),
  ORAL_DIRECTO: oralDirecto.omit({ medios: true }),
} as const satisfies Record<Forma, z.ZodType>;

export const TIPO_DE_ACTIVIDAD: Record<Forma, TipoActividad> = {
  RELACIONAR: "RELACIONAR",
  LISTA_COMUN: "OPCION",
  OPCIONES: "OPCION",
  HUECOS: "HUECOS",
  REDACCION_UNA: "REDACCION",
  REDACCION_DOS: "REDACCION",
  ORAL_SOLO: "GRABACION",
  ORAL_DIRECTO: "CONVERSACION",
};

const OPCIONES_ABIERTAS = 2;

function numerosDe(regla: ReglaTarea): number[] {
  if (regla.items === null || regla.primero === null) return [];
  return Array.from({ length: regla.items }, (_, i) => regla.primero! + i);
}

function grupoDe(regla: ReglaTarea, indice: number): number | null {
  if (!regla.grupos || regla.items === null) return null;
  return Math.floor(indice / (regla.items / regla.grupos)) + 1;
}

function iguales(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Lo que no cuadra entre un formulario y la forma que manda su regla: cuántos
 * ítems, qué números, qué letras, qué opciones son imagen, qué grupos. No
 * mira si faltan textos: eso no impide guardar.
 */
export function fallosDeForma(regla: ReglaTarea, f: Formulario): string[] {
  if (f.forma !== regla.forma) return [`Esta tarea es de forma ${regla.forma} y ha llegado ${f.forma}.`];
  const fallos: string[] = [];
  const numeros = numerosDe(regla);
  const abc = letrasHasta(regla.letras);
  if (f.textos.length !== regla.textos) {
    fallos.push(`Tiene que llevar ${regla.textos} textos sueltos y lleva ${f.textos.length}.`);
  }
  const ejemploCuadra = (hay: boolean) => {
    if (hay !== regla.ejemplo) fallos.push(regla.ejemplo ? "Falta el hueco del ejemplo." : "Esta tarea no lleva ejemplo.");
  };

  switch (f.forma) {
    case "RELACIONAR": {
      const a = f.actividad;
      if (!iguales(a.elementos.map((e) => e.numero), numeros)) fallos.push(`Los elementos tienen que ser ${numeros.join(", ")}.`);
      if (!iguales(a.destinos.map((d) => d.letra), abc)) fallos.push(`Los destinos tienen que ser ${abc.join(", ")}.`);
      break;
    }
    case "LISTA_COMUN": {
      const a = f.actividad;
      if (!iguales(a.preguntas.map((p) => p.numero), numeros)) fallos.push(`Las preguntas tienen que ser ${numeros.join(", ")}.`);
      if (!iguales(a.comunes.map((c) => c.letra), abc)) fallos.push(`La lista común tiene que ser ${abc.join(", ")}.`);
      ejemploCuadra(a.ejemplo !== null);
      break;
    }
    case "OPCIONES": {
      const a = f.actividad;
      const conImagen = regla.itemsConImagen ?? 0;
      if (!iguales(a.preguntas.map((p) => p.numero), numeros)) fallos.push(`Las preguntas tienen que ser ${numeros.join(", ")}.`);
      a.preguntas.forEach((p, i) => {
        if (!iguales(p.opciones.map((o) => o.letra), abc)) fallos.push(`La pregunta ${p.numero} tiene que tener las opciones ${abc.join(", ")}.`);
        if (p.opciones.some((o) => o.conImagen !== i < conImagen)) fallos.push(`La pregunta ${p.numero} no tiene las imágenes que le tocan.`);
        if (p.grupo !== grupoDe(regla, i)) fallos.push(`La pregunta ${p.numero} no está en su grupo.`);
      });
      ejemploCuadra(a.ejemplo !== null);
      if (a.ejemplo) {
        if (!iguales(a.ejemplo.opciones.map((o) => o.letra), abc)) fallos.push(`El ejemplo tiene que tener las opciones ${abc.join(", ")}.`);
        if (a.ejemplo.opciones.some((o) => o.conImagen !== conImagen > 0)) fallos.push("El ejemplo no tiene las imágenes que le tocan.");
      }
      break;
    }
    case "HUECOS": {
      const a = f.actividad;
      if (!iguales(a.huecos.map((h) => h.numero), numeros)) fallos.push(`Los huecos tienen que ser ${numeros.join(", ")}.`);
      for (const h of a.huecos) {
        if (!iguales(h.opciones.map((o) => o.letra), abc)) fallos.push(`El hueco ${h.numero} tiene que tener las opciones ${abc.join(", ")}.`);
      }
      break;
    }
    case "REDACCION_UNA":
      break;
    case "REDACCION_DOS":
      if (f.actividad.opciones.length !== OPCIONES_ABIERTAS) fallos.push("Tiene que llevar dos opciones.");
      break;
    case "ORAL_SOLO":
      if (f.actividad.opciones.length !== OPCIONES_ABIERTAS) fallos.push("Tiene que llevar dos opciones.");
      if (f.actividad.opciones.some((o) => o.conImagen !== Boolean(regla.opcionesConImagen))) fallos.push("Las opciones no tienen las fotos que les tocan.");
      break;
    case "ORAL_DIRECTO":
      if (f.actividad.opciones.length !== OPCIONES_ABIERTAS) fallos.push("Tiene que llevar dos opciones.");
      break;
  }
  const huecosValidos = new Set(huecosDeImagen(f).map((h) => h.clave));
  for (const clave of Object.keys(f.medios.imagenes)) {
    if (!huecosValidos.has(clave)) fallos.push(`La foto «${clave}» no es de ninguna opción con imagen.`);
  }
  if (f.medios.audio) {
    if (!regla.trozos) fallos.push("Esta tarea no lleva audio.");
    else if (!cortesEnOrden(f.medios.audio.cortes)) fallos.push("Las marcas del audio tienen que ir en orden y separadas al menos 0,3 s.");
  }
  return fallos;
}

export function esquemaDelFormulario(regla: ReglaTarea) {
  return formularioBase.superRefine((f, ctx) => {
    for (const message of fallosDeForma(regla, f)) ctx.addIssue({ code: "custom", message });
  });
}

/** El formulario de una tarea sin guardar: la forma entera, con todos los textos vacíos. */
export function formularioVacio(regla: ReglaTarea): Formulario {
  const numeros = numerosDe(regla);
  const abc = letrasHasta(regla.letras);
  const consigna = "";
  const medios = { imagenes: {}, audio: null };
  const textos = Array.from({ length: regla.textos }, () => ({ etiqueta: "", texto: "" }));
  const opcionesVacias = (conImagen: boolean) => abc.map((l) => ({ letra: l, texto: "", conImagen }));
  const sinRango = { min: null, max: null };
  const dos = <T,>(hacer: () => T): T[] => Array.from({ length: OPCIONES_ABIERTAS }, hacer);

  switch (regla.forma) {
    case "RELACIONAR":
      return {
        forma: "RELACIONAR", consigna, textos, medios,
        actividad: {
          ejemplo: { texto: "", letra: "" },
          elementos: numeros.map((numero) => ({ numero, texto: "" })),
          destinos: abc.map((l) => ({ letra: l, titulo: "", texto: "" })),
        },
      };
    case "LISTA_COMUN":
      return {
        forma: "LISTA_COMUN", consigna, textos, medios,
        actividad: {
          comunes: abc.map((l) => ({ letra: l, texto: "" })),
          ejemplo: regla.ejemplo ? { enunciado: "", letra: "" } : null,
          preguntas: numeros.map((numero) => ({ numero, enunciado: "" })),
        },
      };
    case "OPCIONES": {
      const conImagen = regla.itemsConImagen ?? 0;
      return {
        forma: "OPCIONES", consigna, textos, medios,
        actividad: {
          ejemplo: regla.ejemplo ? { enunciado: "", opciones: opcionesVacias(conImagen > 0), letra: "" } : null,
          preguntas: numeros.map((numero, i) => ({
            numero, enunciado: "", opciones: opcionesVacias(i < conImagen), grupo: grupoDe(regla, i),
          })),
        },
      };
    }
    case "HUECOS":
      return {
        forma: "HUECOS", consigna, textos, medios,
        actividad: {
          titulo: "", texto: "", fuente: "",
          huecos: numeros.map((numero) => ({ numero, opciones: abc.map((l) => ({ letra: l, texto: "" })) })),
        },
      };
    case "REDACCION_UNA":
      return { forma: "REDACCION_UNA", consigna, textos, medios, actividad: { situacion: "", textoRecibido: "", pautas: [""], palabras: sinRango } };
    case "REDACCION_DOS":
      return {
        forma: "REDACCION_DOS", consigna, textos, medios,
        actividad: { opciones: dos(() => ({ titulo: "", contexto: "", pautas: [""] })), palabras: sinRango },
      };
    case "ORAL_SOLO":
      return {
        forma: "ORAL_SOLO", consigna, textos, medios,
        actividad: {
          opciones: dos(() => ({ tema: "", pautas: [""], conImagen: Boolean(regla.opcionesConImagen) })),
          minutos: sinRango, preparacion: null,
        },
      };
    case "ORAL_DIRECTO":
      return {
        forma: "ORAL_DIRECTO", consigna, textos, medios,
        actividad: { opciones: dos(() => ({ tema: "", situacion: "", papelExaminador: "", pautas: [""] })), minutos: sinRango },
      };
  }
}
