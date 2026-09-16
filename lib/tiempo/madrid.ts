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
  if (!leido) return 0;
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
