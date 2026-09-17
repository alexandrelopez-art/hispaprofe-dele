/**
 * La aritmética del examen del estudiante. Aquí no hay base de datos ni
 * `new Date()`: el «ahora» entra por argumento en todas las funciones que lo
 * necesitan. Es lo que permite probar el reloj sin esperar cincuenta minutos y
 * sin que el color de la suite dependa del huso del portátil.
 */

/** Lo que se le perdona a la red para que la última respuesta no se pierda por el viaje. */
export const SEGUNDOS_DE_GRACIA = 10;

export type Fallo = { numero: number; marcada: string | null };
export type Nota = { aciertos: number; total: number; fallos: Fallo[] };

export type EstadoDePrueba = {
  /** ESPERANDO: entregada y sin nota. Hoy solo le pasa a la escrita, pero se
   *  deduce de la fila, no de qué prueba sea: una lectura entregada SIEMPRE
   *  tiene nota, porque se congela en la misma llamada que la entrega. */
  estado: "SIN_EMPEZAR" | "HACIENDO" | "ESPERANDO" | "ENTREGADA";
  aciertos: number | null;
  total: number | null;
  porTiempo: boolean;
};

const limpia = (letra: string | undefined): string | null => {
  const s = (letra ?? "").trim().toUpperCase();
  return s === "" ? null : s;
};

/**
 * La nota manda la CLAVE, no lo que mandó el navegador: se recorre la clave, y
 * una respuesta a una pregunta que no existe ni suma ni aparece en los fallos.
 * Lo no marcado es un fallo, no un regalo.
 */
export function notaDePrueba(clave: Record<string, string>, respuestas: Record<string, string>): Nota {
  const numeros = Object.keys(clave).sort((a, b) => Number(a) - Number(b));
  let aciertos = 0;
  const fallos: Fallo[] = [];
  for (const n of numeros) {
    const marcada = limpia(respuestas[n]);
    if (marcada !== null && marcada === limpia(clave[n])) aciertos++;
    else fallos.push({ numero: Number(n), marcada });
  }
  return { aciertos, total: numeros.length, fallos };
}

export function segundosQueQuedan(empezadaEn: Date, minutos: number | null, ahora: Date): number | null {
  if (minutos === null) return null;
  const pasados = (ahora.getTime() - empezadaEn.getTime()) / 1000;
  return Math.max(0, Math.floor(minutos * 60 - pasados));
}

export function seAcaboElTiempo(empezadaEn: Date, minutos: number | null, ahora: Date): boolean {
  if (minutos === null) return false;
  const pasados = (ahora.getTime() - empezadaEn.getTime()) / 1000;
  return pasados > minutos * 60 + SEGUNDOS_DE_GRACIA;
}

/** El menor trozo que todavía no ha sonado. Con huecos también: no vale contar cuántos van. */
export function siguienteTrozo(oidos: readonly number[], trozos: number): number | null {
  for (let n = 1; n <= trozos; n++) if (!oidos.includes(n)) return n;
  return null;
}

/**
 * De dónde a dónde suena un trozo. `trozo` es 1-indexado; `cortes` trae las
 * marcas en segundos sobre la pista entera, una menos que trozos. El último
 * trozo suena hasta `null` (el final real del fichero), NUNCA hasta una
 * duración calculada: los MP3 del libro declaran una duración que sobra unos
 * segundos, y cortar ahí se comería el final de la última noticia.
 */
export function limitesDelTrozo(cortes: readonly number[], trozo: number): { desde: number; hasta: number | null } {
  const esElUltimo = trozo === cortes.length + 1;
  return { desde: trozo === 1 ? 0 : cortes[trozo - 2], hasta: esElUltimo ? null : cortes[trozo - 1] };
}

export function estadoDePrueba(
  intento: { entregadaEn: Date | null; aciertos: number | null; total: number | null; porTiempo: boolean } | null,
): EstadoDePrueba {
  if (!intento) return { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false };
  return {
    estado: !intento.entregadaEn ? "HACIENDO" : intento.aciertos === null ? "ESPERANDO" : "ENTREGADA",
    aciertos: intento.aciertos,
    total: intento.total,
    porTiempo: intento.porTiempo,
  };
}

export function textoDelEstado(e: EstadoDePrueba): string {
  if (e.estado === "SIN_EMPEZAR") return "Sin empezar";
  if (e.estado === "HACIENDO") return "A medias";
  const entregada = e.porTiempo ? "Entregada por tiempo" : "Entregada";
  if (e.estado === "ESPERANDO") return `${entregada}, esperando corrección`;
  const nota = e.total === null ? "" : `, ${e.aciertos} de ${e.total}`;
  return `${entregada}${nota}`;
}

/**
 * Las palabras que contaría una persona: trozos separados por cualquier hueco
 * (espacios, tabuladores, saltos de línea), sin contar los huecos de los
 * extremos. Un texto vacío o solo de espacios son cero palabras.
 */
export function palabras(texto: string): number {
  const limpio = texto.trim();
  return limpio === "" ? 0 : limpio.split(/\s+/u).length;
}

/** La nota de la escrita: todas las bandas de todas sus tareas. */
export function sumaDeBandas(escritos: readonly { bandas: readonly number[] }[]): number {
  return escritos.reduce((total, e) => total + e.bandas.reduce((s, b) => s + b, 0), 0);
}

/** Entregada, esté corregida o no. Las pantallas casi siempre quieren esto. */
export function estaEntregada(e: EstadoDePrueba): boolean {
  return e.estado === "ENTREGADA" || e.estado === "ESPERANDO";
}
