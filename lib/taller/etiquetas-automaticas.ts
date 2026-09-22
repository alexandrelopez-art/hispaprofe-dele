import type { Nivel, Prueba } from "@/lib/generated/prisma";
import { esPrueba, etiquetasDeNivel, reglaDe } from "@/lib/dele/estructura";

/**
 * Por encima de este valor (1 = borde superior de la página, 0 = el
 * inferior) se asume que el rótulo "TAREA N" es lo primero de la página: no
 * queda nada de la tarea anterior ahí y esta no hereda su etiqueta.
 */
const UMBRAL_SUPERIOR = 0.85;

/** Tamaño máximo de un hueco de numeración que se resuelve probando órdenes: por encima, no compensa y se marca incierto. */
const TOPE_DE_PERMUTACION = 4;

/** Penalización de una página insegura al puntuar un posible orden: basta con que aparezca una para descartar ese orden. */
const PENALIZACION_INSEGURA = 1000;

export type MarcaDeInicio = {
  /** El número del rótulo "TAREA N". El sufijo "(OPCIÓN M)", si lo hay, no cambia este número. */
  numero: number;
  /**
   * El sufijo tal cual, cuando lo trae ("(OPCIÓN 1)"...). El resolutor no lo
   * usa: una tarea puede imprimirse sin él en un examen y con él en otro
   * (visto en el corpus), y el número solo ya basta para casarla con la
   * secuencia fija.
   */
  variante: string | null;
  /** Posición vertical normalizada dentro de la página: 1 = borde superior, 0 = borde inferior. */
  y: number;
};

export type SenalDePagina = {
  /** Identificador estable de la página (nombre de archivo, id de la BD...). No se usa para ordenar. */
  id: string;
  /** Número impreso detectado en el pie de página. null si el pie no llevaba número o no se leyó. */
  numeroImpreso: number | null;
  /**
   * Cabecera de prueba detectada tal cual llega del PDF ("PRUEBA DE
   * COMPRENSIÓN DE LECTURA"...). Se guarda para que quede constancia de la
   * señal, pero el resolutor NO la usa para decidir la prueba de una tarea:
   * el libro trae al menos una cabecera mal impresa (examen 4), así que la
   * secuencia fija de catorce tareas manda siempre sobre ella.
   */
  cabecera: string | null;
  /** Rótulos "TAREA N" detectados en la página. No hace falta que vengan ya ordenados por posición. */
  inicios: readonly MarcaDeInicio[];
};

export type PaginaResuelta = {
  /** Posición de esta página en el array de entrada, para que el llamador la recoloque. */
  indiceOriginal: number;
  id: string;
  etiquetas: string[];
  /** false cuando el algoritmo tuvo que adivinar (el orden o la etiqueta): la página se le enseña al profesor para revisar. */
  segura: boolean;
};

type TareaEnSecuencia = {
  prueba: Prueba;
  numero: number;
  etiqueta: string;
  /** El número de su tarea "hermana" (ver `ReglaTarea.hermana`), o null si no tiene. Siempre es un número menor: la hermana es la mitad de la conversación oral que se abrió primero. */
  hermana: number | null;
};
type PaginaConIndice = SenalDePagina & { indiceOriginal: number };

/** La secuencia fija de tareas del nivel, ya separada en prueba y número, en el orden del examen. */
function secuenciaDeTareas(nivel: Nivel): TareaEnSecuencia[] {
  return etiquetasDeNivel(nivel).map((etiqueta) => {
    const [prueba, numero] = etiqueta.split("-");
    if (!esPrueba(prueba)) throw new Error(`Etiqueta de estructura inesperada: ${etiqueta}`);
    const regla = reglaDe(nivel, prueba, Number(numero));
    return { prueba, numero: Number(numero), etiqueta, hermana: regla?.hermana ?? null };
  });
}

/**
 * La tarea "hermana" de `tarea` en la secuencia (EO-1↔EO-2, EO-3↔EO-4: la
 * misma conversación oral repartida en dos tareas), o null si `tarea` no
 * tiene hermana. Solo el miembro que se abre segundo declara `hermana` en
 * `estructura.ts`, así que la búsqueda siempre resuelve hacia el que se
 * abrió antes.
 */
function parejaDe(secuencia: readonly TareaEnSecuencia[], tarea: TareaEnSecuencia): TareaEnSecuencia | null {
  if (tarea.hermana === null) return null;
  return secuencia.find((t) => t.prueba === tarea.prueba && t.numero === tarea.hermana) ?? null;
}

/**
 * Las etiquetas que esta página arrastra de la tarea previa. Normalmente es
 * solo esa tarea — pero si es la mitad "de vuelta" de un par de hermanas
 * (EO-2, EO-4) y la otra mitad ya se confirmó en algún punto anterior con su
 * propio rótulo, el libro puede reimprimir el contenido de esa otra mitad
 * varias páginas después de que se diera por cerrada, y hay que arrastrar
 * las dos. Si la hermana nunca apareció con un rótulo propio no se inventa:
 * puede que este cuadernillo en concreto no la traiga, y adivinar sería
 * justo la mentira plausible que este algoritmo evita.
 */
function etiquetasAHeredar(
  secuencia: readonly TareaEnSecuencia[],
  tareaAntes: TareaEnSecuencia | null,
  confirmadas: ReadonlySet<string>,
): string[] {
  if (tareaAntes === null) return [];
  const pareja = parejaDe(secuencia, tareaAntes);
  if (pareja === null || !confirmadas.has(pareja.etiqueta)) return [tareaAntes.etiqueta];
  return [pareja, tareaAntes].sort((a, b) => a.numero - b.numero).map((t) => t.etiqueta);
}

/** La primera posición desde `desde` cuya tarea tiene este número, o -1 si no vuelve a aparecer. */
function siguientePosible(secuencia: readonly TareaEnSecuencia[], desde: number, numero: number): number {
  for (let i = desde; i < secuencia.length; i++) {
    if (secuencia[i].numero === numero) return i;
  }
  return -1;
}

type PasadaResuelta = { paginas: PaginaResuelta[]; idxFinal: number; desajustes: number };

/**
 * Recorre las páginas en el orden dado avanzando un puntero por la secuencia
 * fija. Cada rótulo se casa con la primera tarea posible desde la siguiente
 * a la actual: así una cabecera equivocada o un número repetido entre
 * pruebas (CE-1, CO-1, EO-1 comparten el "1") no descolocan nada, porque la
 * posición manda sobre la etiqueta local. Un rótulo que no aparece más
 * adelante en la secuencia no se puede casar con nada y deja la página
 * insegura; uno que aparece pero no es el inmediato siguiente cuenta como un
 * desajuste (sirve para puntuar qué orden es el bueno al rellenar un hueco).
 *
 * También lleva la cuenta de qué etiquetas se confirmaron alguna vez con un
 * rótulo propio (`confirmadas`), para que una página que hereda de la mitad
 * "de vuelta" de un par de hermanas orales (ver `etiquetasAHeredar`) pueda
 * arrastrar también la otra mitad cuando el libro la reimprime más adelante.
 */
function procesarEnOrden(
  paginas: readonly PaginaConIndice[],
  secuencia: readonly TareaEnSecuencia[],
  idxInicial: number,
): PasadaResuelta {
  let idx = idxInicial;
  let desajustes = 0;
  const resueltas: PaginaResuelta[] = [];
  const confirmadas = new Set<string>();

  for (const pagina of paginas) {
    const idxAntes = idx;
    const tareaAntes = idxAntes >= 0 ? secuencia[idxAntes] : null;

    const marcas = pagina.inicios
      .filter((m) => Number.isInteger(m.numero) && m.numero > 0)
      .slice()
      .sort((a, b) => b.y - a.y); // de arriba (y alto) a abajo (y bajo)

    let segura = true;
    const nuevas: string[] = [];
    for (const marca of marcas) {
      const siguiente = siguientePosible(secuencia, idx + 1, marca.numero);
      if (siguiente === -1) {
        segura = false;
        continue;
      }
      if (siguiente !== idx + 1) desajustes++;
      idx = siguiente;
      nuevas.push(secuencia[idx].etiqueta);
      confirmadas.add(secuencia[idx].etiqueta);
    }

    // Un rótulo pegado al borde superior es lo primero de la página: nada de
    // la tarea anterior queda ahí. Uno más abajo deja ver el final de la
    // tarea anterior, así que esta hereda su etiqueta (y la de su hermana
    // repescada, si toca) además de la nueva.
    const primeraArriba = marcas.length > 0 && marcas[0].y >= UMBRAL_SUPERIOR;
    const hereda = tareaAntes !== null && (marcas.length === 0 || !primeraArriba);
    const heredadas = etiquetasAHeredar(secuencia, tareaAntes, confirmadas);
    const etiquetas = [...(hereda ? heredadas : []), ...nuevas];

    if (marcas.length === 0 && tareaAntes === null) segura = false;
    resueltas.push({ indiceOriginal: pagina.indiceOriginal, id: pagina.id, etiquetas, segura });
  }

  return { paginas: resueltas, idxFinal: idx, desajustes };
}

/** Cuánto de malo es este posible orden: cualquier página insegura lo descarta frente a uno sin ninguna. */
function puntuarPasada(pasada: PasadaResuelta): number {
  return pasada.desajustes + pasada.paginas.filter((p) => !p.segura).length * PENALIZACION_INSEGURA;
}

function dividirPorNumero(paginas: readonly SenalDePagina[]): { conNumero: PaginaConIndice[]; sinNumero: PaginaConIndice[] } {
  const conIndice = paginas.map((p, indiceOriginal) => ({ ...p, indiceOriginal }));
  return {
    conNumero: conIndice.filter((p) => p.numeroImpreso !== null).sort((a, b) => a.numeroImpreso! - b.numeroImpreso!),
    sinNumero: conIndice.filter((p) => p.numeroImpreso === null),
  };
}

type Hueco = { despuesDe: number; tamano: number };

/** Los huecos entre números impresos consecutivos: ahí es donde tienen que caber las páginas sin pie de página. */
function hallarHuecos(conNumero: readonly PaginaConIndice[]): Hueco[] {
  const huecos: Hueco[] = [];
  for (let i = 0; i < conNumero.length - 1; i++) {
    const salto = conNumero[i + 1].numeroImpreso! - conNumero[i].numeroImpreso!;
    if (salto > 1) huecos.push({ despuesDe: i, tamano: salto - 1 });
  }
  return huecos;
}

function permutaciones<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, i) => {
    const resto = [...items.slice(0, i), ...items.slice(i + 1)];
    return permutaciones(resto).map((p) => [item, ...p]);
  });
}

type ResultadoDeOrden = { orden: PaginaConIndice[]; inciertas: Set<number> };

/**
 * Sitúa las páginas sin número impreso. Si dejan un único hueco y del tamaño
 * justo entre las que sí lo llevan, se insertan ahí: el número de página es
 * la señal más fuerte, y el PDF puede traerlas en cualquier orden (examen 6,
 * donde la última tirada del libro es el primer pliego del PDF) sin que
 * afecte al resultado, porque no se mira la posición de entrada para nada.
 * Con más de una página en el hueco se prueban sus órdenes posibles (nunca
 * más de `TOPE_DE_PERMUTACION`, ni falta que hace en un cuadernillo de
 * catorce tareas) y se toma la única que deja la secuencia sin desajustes
 * hasta el final del documento. Si no hay un hueco único que encaje, o dos
 * órdenes quedan empatados, no hay forma fiable de saber dónde van: se dejan
 * al final en su orden de llegada y se marcan todas para que el profesor las
 * revise, en vez de adivinar.
 */
function ordenarPaginas(paginas: readonly SenalDePagina[], secuencia: readonly TareaEnSecuencia[]): ResultadoDeOrden {
  const { conNumero, sinNumero } = dividirPorNumero(paginas);
  if (sinNumero.length === 0) return { orden: conNumero, inciertas: new Set() };
  if (conNumero.length === 0) return { orden: sinNumero, inciertas: new Set(sinNumero.map((p) => p.indiceOriginal)) };

  const huecos = hallarHuecos(conNumero);
  const capacidad = huecos.reduce((s, h) => s + h.tamano, 0);
  const sinAncla = huecos.length !== 1 || capacidad !== sinNumero.length || sinNumero.length > TOPE_DE_PERMUTACION;
  if (sinAncla) return { orden: [...conNumero, ...sinNumero], inciertas: new Set(sinNumero.map((p) => p.indiceOriginal)) };

  const [hueco] = huecos;
  const antes = conNumero.slice(0, hueco.despuesDe + 1);
  const despues = conNumero.slice(hueco.despuesDe + 1);

  if (sinNumero.length === 1) {
    return { orden: [...antes, ...sinNumero, ...despues], inciertas: new Set() };
  }

  const idxTrasAntes = procesarEnOrden(antes, secuencia, -1).idxFinal;
  const candidatas = permutaciones(sinNumero).map((relleno) => {
    const pasadaHueco = procesarEnOrden(relleno, secuencia, idxTrasAntes);
    const pasadaDespues = procesarEnOrden(despues, secuencia, pasadaHueco.idxFinal);
    return { relleno, puntuacion: puntuarPasada(pasadaHueco) + puntuarPasada(pasadaDespues) };
  });
  const minimo = Math.min(...candidatas.map((c) => c.puntuacion));
  const ganadoras = candidatas.filter((c) => c.puntuacion === minimo);

  if (ganadoras.length !== 1) {
    return { orden: [...antes, ...sinNumero, ...despues], inciertas: new Set(sinNumero.map((p) => p.indiceOriginal)) };
  }
  return { orden: [...antes, ...ganadoras[0].relleno, ...despues], inciertas: new Set() };
}

/**
 * Ordena las páginas de un cuadernillo y les asigna las etiquetas de tarea
 * que le tocan a cada una, casando lo que se ve en el PDF contra la
 * secuencia fija de tareas del nivel (ver `lib/dele/estructura.ts`). Las
 * páginas con `segura: false` son las que el profesor tiene que revisar a
 * mano: el algoritmo prefiere señalarlas antes que adivinar.
 */
export function ordenarYEtiquetarPaginas(nivel: Nivel, paginas: readonly SenalDePagina[]): PaginaResuelta[] {
  const secuencia = secuenciaDeTareas(nivel);
  if (secuencia.length === 0) {
    // Nivel todavía sin números de estructura (`ESTRUCTURAS[nivel] === null`): no hay contra qué casar nada.
    return paginas.map((p, indiceOriginal) => ({ indiceOriginal, id: p.id, etiquetas: [], segura: false }));
  }

  const { orden, inciertas } = ordenarPaginas(paginas, secuencia);
  const { paginas: resueltas } = procesarEnOrden(orden, secuencia, -1);
  return resueltas.map((p) => (inciertas.has(p.indiceOriginal) ? { ...p, segura: false } : p));
}
