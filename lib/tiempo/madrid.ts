const HUSO = "Europe/Madrid";

/**
 * El desfase de Madrid, en minutos, en un instante concreto. Sale de la base de
 * husos del sistema (Intl), no de una tabla nuestra: los cambios de hora los
 * decide la Unión Europea y no se codifican a mano.
 */
function desfaseEnMinutos(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: HUSO, timeZoneName: "longOffset" }).formatToParts(instante);
  const texto = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const leido = /GMT([+-])(\d{2}):(\d{2})/.exec(texto);
  // Hoy es inalcanzable con Europe/Madrid: Intl siempre da "GMT+02:00" o
  // "GMT+01:00". Un `return 0` en silencio, si esto se reutiliza con otro
  // huso el día que Intl cambie de forma, se traduciría en una fecha tope una
  // hora larga sin que nada se ponga rojo.
  if (!leido) throw new Error(`No se pudo leer el desfase de Madrid de "${texto}".`);
  return (leido[1] === "-" ? -1 : 1) * (Number(leido[2]) * 60 + Number(leido[3]));
}

/**
 * El instante en que acaba ese día en Madrid. El desfase se pide al MEDIODÍA
 * UTC del día pedido, que cae siempre dentro de ese día en Madrid se sume o se
 * reste una hora, y además ya está del lado bueno del cambio de hora, que
 * ocurre de madrugada. Preguntarlo a medianoche falla el día del cambio.
 */
export function finDelDiaEnMadrid(dia: string): Date | null {
  const leido = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!leido) return null;
  const [anio, mes, numero] = [Number(leido[1]), Number(leido[2]), Number(leido[3])];
  const mediodia = new Date(Date.UTC(anio, mes - 1, numero, 12));
  // Date.UTC estira los meses sin protestar: el 30 de febrero se vuelve 2 de
  // marzo. Si al leerlo de vuelta no es el mismo día, el día no existía.
  if (mediodia.getUTCFullYear() !== anio || mediodia.getUTCMonth() !== mes - 1 || mediodia.getUTCDate() !== numero) return null;
  return new Date(Date.UTC(anio, mes - 1, numero, 23, 59, 59, 999) - desfaseEnMinutos(mediodia) * 60_000);
}

/** «martes, 20 de octubre de 2026». */
export function fechaEnPalabras(instante: Date): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: HUSO, dateStyle: "full" }).format(instante);
}

/** El «ahora» se recibe: si se leyera aquí dentro, la prueba cambiaría de color según la hora. */
export function estaFueraDePlazo(fechaTope: Date, ahora: Date): boolean {
  return ahora.getTime() > fechaTope.getTime();
}

/** El día del calendario de Madrid en el que cae un instante, como {anio, mes, dia}. */
function diaEnMadrid(instante: Date): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: HUSO, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(
    instante,
  );
  const numero = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: numero("year"), mes: numero("month"), dia: numero("day") };
}

/**
 * Días de calendario de Madrid entre dos instantes, no milisegundos
 * transcurridos divididos entre 24 horas. El último domingo de octubre el
 * reloj se atrasa: ese día tiene 25 horas reales, y dos instantes que caen un
 * solo día de calendario aparte (pero cruzando ese domingo) están separados
 * por 25 horas de reloj, no 24. Dividir milisegundos entre 86 400 000 y
 * redondear contaría esa hora de más como un día entero. Ver diasDeRetraso.
 */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = diaEnMadrid(desde);
  const b = diaEnMadrid(hasta);
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86_400_000);
}

/**
 * Días enteros de retraso entre el tope y la entrega, contados por calendario
 * de Madrid (ver diasEntre). Al menos 1: el tope ya es el final del día, así
 * que cualquier entrega posterior cuenta como un día de retraso como mínimo,
 * aunque las dos fechas cayeran el mismo día de calendario.
 */
export function diasDeRetraso(fechaTope: Date, entregadaEn: Date): number {
  return Math.max(1, diasEntre(fechaTope, entregadaEn));
}
