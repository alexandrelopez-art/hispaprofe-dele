const LARGO_MAXIMO_DE_LA_EXTENSION = 8;

/**
 * Un nombre de fichero limpio, con un sufijo aleatorio para que dos subidas con
 * el mismo nombre (o el mismo nombre elegido a propósito por otra persona) no
 * choquen ni se confundan. No lleva ninguna carpeta: cada almacén decide por su
 * cuenta cómo cuelga el nombre de la suya (Vercel con una ruta "carpeta/nombre";
 * Drive con el campo `name`, que ni siquiera admite barras).
 *
 * Compartido entre lib/ficheros/vercel.ts (dentro de rutaDelFichero) y
 * lib/ficheros/drive.ts, para que las dos subidas apliquen la misma limpieza:
 * sin ella, un nombre elegido por quien sube llega tal cual hasta donde lo ve
 * otra persona (el profesor mirando el material, o la unidad compartida de las
 * grabaciones), pudiendo hacerse pasar por el fichero de otro.
 */
export function nombreSaneado(nombre: string, aleatorio: string): string {
  const punto = nombre.lastIndexOf(".");
  // La extensión también viene de quien sube: sin sanear, una barra o un signo
  // raro colados aquí meten un tramo de carpeta extra en la ruta firmada (o un
  // carácter que Drive no admite en `name`).
  const extensionCruda = punto > 0 ? nombre.slice(punto + 1) : "";
  const extension =
    extensionCruda
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, LARGO_MAXIMO_DE_LA_EXTENSION) || "bin";
  const base = (punto > 0 ? nombre.slice(0, punto) : nombre)
    .split(/[\\/]/)
    .pop()!
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${aleatorio}.${extension}`;
}
