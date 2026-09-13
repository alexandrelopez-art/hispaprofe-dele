import type { Nivel, Prueba } from "@/lib/generated/prisma";

/** Cómo es el formulario de una tarea. Una por formato del DELE. */
export type Forma =
  | "RELACIONAR"
  | "LISTA_COMUN"
  | "OPCIONES"
  | "HUECOS"
  | "REDACCION_UNA"
  | "REDACCION_DOS"
  | "ORAL_SOLO"
  | "ORAL_DIRECTO";

export type ReglaTarea = {
  numero: number;
  /** Ítems que cuentan. null = respuesta abierta. El ejemplo no cuenta. */
  items: number | null;
  /** Número del libro del primer ítem. null en las abiertas. */
  primero: number | null;
  forma: Forma;
  /** Si la tarea trae un ejemplo resuelto (el «0»). */
  ejemplo: boolean;
  /** Letras entre las que se elige: 3 (A-C) o, en relacionar, los destinos (10, A-J). 0 en las abiertas. */
  letras: number;
  /** Textos sueltos que se copian además de la actividad (CE2: 3 personas; CE3: el texto largo). */
  textos: number;
  /** RELACIONAR: si cada elemento y el ejemplo llevan texto (CE1 sí; CO2 son «Mensaje 1-6»). */
  elementosConTexto?: boolean;
  /** OPCIONES: cuántos ítems, desde el primero, tienen las opciones en imagen. El ejemplo, si lo hay, también. */
  itemsConImagen?: number;
  /** OPCIONES: en cuántos grupos iguales se reparten los ítems (CO4: tres noticias). */
  grupos?: number;
  /** ORAL_SOLO: si cada opción lleva foto. */
  opcionesConImagen?: boolean;
  /** ORAL_DIRECTO: el número de la tarea con la que va emparejada por tema. */
  hermana?: number;
};

export type EstructuraDeNivel = Readonly<Record<Prueba, ReadonlyArray<Readonly<ReglaTarea>>>>;

/**
 * Contrastado contra las páginas de los exámenes 1 y 2 del libro y contra el
 * Modelo 0 y mayo 2015 del Cervantes. Los números viven aquí y no en el
 * modelo: el modelo tiene que servir mañana a un examen armado a mano.
 */
const ESCOLAR: EstructuraDeNivel = {
  CE: [
    { numero: 1, items: 6, primero: 1, forma: "RELACIONAR", ejemplo: true, letras: 10, textos: 0, elementosConTexto: true },
    { numero: 2, items: 6, primero: 7, forma: "LISTA_COMUN", ejemplo: false, letras: 3, textos: 3 },
    { numero: 3, items: 6, primero: 13, forma: "OPCIONES", ejemplo: false, letras: 3, textos: 1 },
    { numero: 4, items: 7, primero: 19, forma: "HUECOS", ejemplo: false, letras: 3, textos: 0 },
  ],
  CO: [
    { numero: 1, items: 7, primero: 1, forma: "OPCIONES", ejemplo: true, letras: 3, textos: 0, itemsConImagen: 4 },
    { numero: 2, items: 6, primero: 8, forma: "RELACIONAR", ejemplo: true, letras: 10, textos: 0, elementosConTexto: false },
    { numero: 3, items: 6, primero: 14, forma: "LISTA_COMUN", ejemplo: true, letras: 3, textos: 0 },
    { numero: 4, items: 6, primero: 20, forma: "OPCIONES", ejemplo: false, letras: 3, textos: 0, grupos: 3 },
  ],
  EE: [
    { numero: 1, items: null, primero: null, forma: "REDACCION_UNA", ejemplo: false, letras: 0, textos: 0 },
    { numero: 2, items: null, primero: null, forma: "REDACCION_DOS", ejemplo: false, letras: 0, textos: 0 },
  ],
  EO: [
    { numero: 1, items: null, primero: null, forma: "ORAL_SOLO", ejemplo: false, letras: 0, textos: 0, opcionesConImagen: true },
    { numero: 2, items: null, primero: null, forma: "ORAL_DIRECTO", ejemplo: false, letras: 0, textos: 0, hermana: 1 },
    { numero: 3, items: null, primero: null, forma: "ORAL_SOLO", ejemplo: false, letras: 0, textos: 0, opcionesConImagen: false },
    { numero: 4, items: null, primero: null, forma: "ORAL_DIRECTO", ejemplo: false, letras: 0, textos: 0, hermana: 3 },
  ],
};

/** null = ese nivel todavía no tiene sus números: no se carga en el taller ni se publica. */
export const ESTRUCTURAS: Readonly<Record<Nivel, EstructuraDeNivel | null>> = {
  A2_B1_ESCOLAR: ESCOLAR,
  A1: null,
  A2: null,
  B1: null,
  B2: null,
};

export const PRUEBAS: readonly Prueba[] = ["CE", "CO", "EE", "EO"];

export function esPrueba(valor: string): valor is Prueba {
  return (PRUEBAS as readonly string[]).includes(valor);
}

export function nivelesConReglas(): Nivel[] {
  return (Object.keys(ESTRUCTURAS) as Nivel[]).filter((n) => ESTRUCTURAS[n] !== null);
}

export function reglaDe(nivel: Nivel, prueba: Prueba, numero: number): Readonly<ReglaTarea> | null {
  return ESTRUCTURAS[nivel]?.[prueba].find((r) => r.numero === numero) ?? null;
}

export const NOMBRE_DE_PRUEBA: Record<Prueba, string> = {
  CE: "comprensión de lectura",
  CO: "comprensión auditiva",
  EE: "expresión escrita",
  EO: "expresión oral",
};

const NOMBRE_CORTO: Record<Prueba, string> = { CE: "Lectura", CO: "Auditiva", EE: "Escrita", EO: "Oral" };

export const NOMBRE_DE_NIVEL: Record<Nivel, string> = {
  A2_B1_ESCOLAR: "A2/B1 escolar",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
};

export function letrasHasta(n: number): string[] {
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

export function etiquetaDeTarea(prueba: Prueba, numero: number): string {
  return `${prueba}-${numero}`;
}

export function etiquetasDeNivel(nivel: Nivel): string[] {
  const estructura = ESTRUCTURAS[nivel];
  if (!estructura) return [];
  return PRUEBAS.flatMap((p) => estructura[p].map((r) => etiquetaDeTarea(p, r.numero)));
}

export function nombreCortoDeTarea(prueba: Prueba, numero: number): string {
  return `${NOMBRE_CORTO[prueba]} ${numero}`;
}

export function nombreDeEtiqueta(etiqueta: string): string {
  const [prueba, numero] = etiqueta.split("-");
  return esPrueba(prueba) ? nombreCortoDeTarea(prueba, Number(numero)) : etiqueta;
}
