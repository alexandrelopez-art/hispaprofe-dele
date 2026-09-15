import { SEPARACION_MINIMA, cortesEnOrden } from "./medios";

/** Tramos que se miden de golpe: 100 ms. */
const VENTANA = 0.1;
/** Silencio = ventana por debajo del 2 % de la ventana más fuerte de la pista. */
const UMBRAL = 0.02;
/** Un silencio cuenta si dura al menos esto. */
const SILENCIO_MINIMO = 1.5;
/** Las instrucciones del principio no se cortan. */
const SIN_MARCAS_AL_EMPEZAR = 3;
const EPSILON = 1e-9;

export type Silencio = { inicio: number; fin: number };

const centesimas = (x: number) => Math.round(x * 100) / 100;

/** El pico de cada cubo, normalizado de 0 a 1: lo que se dibuja. */
export function picos(muestras: Float32Array, cubos: number): number[] {
  if (muestras.length === 0 || cubos <= 0) return [];
  const tam = muestras.length / cubos;
  const salida: number[] = [];
  let maximo = 0;
  for (let c = 0; c < cubos; c++) {
    const desde = Math.floor(c * tam);
    const hasta = Math.min(muestras.length, Math.max(desde + 1, Math.floor((c + 1) * tam)));
    let pico = 0;
    for (let i = desde; i < hasta; i++) pico = Math.max(pico, Math.abs(muestras[i]));
    salida.push(pico);
    maximo = Math.max(maximo, pico);
  }
  return maximo === 0 ? salida : salida.map((p) => p / maximo);
}

/** Los tramos callados de al menos 1,5 s, en segundos. Viene del sitio viejo (components/taller/onda.tsx). */
export function silencios(muestras: Float32Array, frecuencia: number): Silencio[] {
  const tam = Math.max(1, Math.round(frecuencia * VENTANA));
  const ventanas = Math.floor(muestras.length / tam);
  const rms: number[] = [];
  for (let v = 0; v < ventanas; v++) {
    let suma = 0;
    for (let i = v * tam; i < (v + 1) * tam; i++) suma += muestras[i] * muestras[i];
    rms.push(Math.sqrt(suma / tam));
  }
  const maximo = Math.max(0, ...rms);
  if (maximo === 0) return [];
  const umbral = maximo * UMBRAL;
  const salida: Silencio[] = [];
  let empieza = -1;
  for (let v = 0; v <= ventanas; v++) {
    const callada = v < ventanas && rms[v] <= umbral;
    if (callada && empieza < 0) empieza = v;
    if (!callada && empieza >= 0) {
      if ((v - empieza) * VENTANA >= SILENCIO_MINIMO - EPSILON) {
        salida.push({ inicio: centesimas((empieza * tam) / frecuencia), fin: centesimas((v * tam) / frecuencia) });
      }
      empieza = -1;
    }
  }
  return salida;
}

/**
 * Las `trozos − 1` marcas: donde vuelve el sonido tras los silencios MÁS LARGOS.
 * Entre las dos audiciones de un trozo también hay silencio, más corto que el que
 * separa un trozo del siguiente. Es una ayuda: el profesor la corrige.
 */
export function proponerCortes(lista: Silencio[], trozos: number, duracion: number): number[] {
  if (trozos <= 1) return [];
  return lista
    .filter((s) => s.fin > SIN_MARCAS_AL_EMPEZAR && s.fin < duracion - SEPARACION_MINIMA)
    .sort((a, b) => b.fin - b.inicio - (a.fin - a.inicio) || a.fin - b.fin)
    .slice(0, trozos - 1)
    .map((s) => centesimas(s.fin))
    .sort((a, b) => a - b);
}

/** Dónde queda una marca que se suelta en `t`: lejos de los extremos y de las demás. null si no cabe. */
export function ajustarMarca(t: number, otras: readonly number[], duracion: number): number | null {
  let x = Math.min(Math.max(t, SEPARACION_MINIMA), duracion - SEPARACION_MINIMA);
  for (const o of [...otras].sort((a, b) => a - b)) {
    if (Math.abs(x - o) < SEPARACION_MINIMA - EPSILON) x = x < o ? o - SEPARACION_MINIMA : o + SEPARACION_MINIMA;
  }
  x = centesimas(x);
  const cabe =
    x >= SEPARACION_MINIMA - EPSILON &&
    x <= duracion - SEPARACION_MINIMA + EPSILON &&
    otras.every((o) => Math.abs(x - o) >= SEPARACION_MINIMA - EPSILON);
  return cabe ? x : null;
}

/** [inicio, fin] de cada trozo, de 0 a la duración. */
export function trozosDe(cortes: readonly number[], duracion: number): [number, number][] {
  const bordes = [0, ...cortes, duracion];
  return bordes.slice(0, -1).map((inicio, i) => [inicio, bordes[i + 1]]);
}

export function formatearTiempo(segundos: number): string {
  const total = Math.floor(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** El campo a mano: segundos («38.5») o minutos y segundos («1:05»), separados por comas. */
export function leerCortesEscritos(texto: string): number[] | null {
  const partes = texto.split(",").map((p) => p.trim()).filter((p) => p !== "");
  const cortes: number[] = [];
  for (const p of partes) {
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(p);
    if (!m) return null;
    cortes.push(centesimas(Number(m[1] ?? 0) * 60 + Number(m[2])));
  }
  return cortesEnOrden(cortes) ? cortes : null;
}
