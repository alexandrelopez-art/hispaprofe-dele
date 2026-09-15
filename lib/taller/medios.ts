import type { Formulario } from "./formas";

/** Ni dos marcas del audio ni una marca y un extremo pueden quedar más cerca. */
export const SEPARACION_MINIMA = 0.3;

export type HuecoDeImagen = { clave: string; etiqueta: string };

/** Cada opción que lleva foto, con la clave que usa `medios.imagenes` y cómo se nombra en los motivos. */
export function huecosDeImagen(f: Formulario): HuecoDeImagen[] {
  switch (f.forma) {
    case "OPCIONES": {
      const huecos: HuecoDeImagen[] = [];
      for (const o of f.actividad.ejemplo?.opciones ?? []) {
        if (o.conImagen) huecos.push({ clave: `ejemplo-${o.letra}`, etiqueta: `la opción ${o.letra} del ejemplo` });
      }
      for (const p of f.actividad.preguntas) {
        for (const o of p.opciones) {
          if (o.conImagen) huecos.push({ clave: `${p.numero}-${o.letra}`, etiqueta: `la opción ${o.letra} de la pregunta ${p.numero}` });
        }
      }
      return huecos;
    }
    case "ORAL_SOLO":
      return f.actividad.opciones.flatMap((o, i) => (o.conImagen ? [{ clave: `opcion-${i + 1}`, etiqueta: `la opción ${i + 1}` }] : []));
    default:
      return [];
  }
}

/** Las marcas, en segundos: positivas, crecientes y separadas al menos SEPARACION_MINIMA. */
export function cortesEnOrden(cortes: readonly number[]): boolean {
  // El 1e-9 absorbe el redondeo de coma flotante: 10.3 - 10 no da exactamente 0.3.
  return cortes.every((c, i) => c > 0 && (i === 0 || c - cortes[i - 1] >= SEPARACION_MINIMA - 1e-9));
}

/** Lo que leyó la IA, con las fotos y la pista que ya había en pantalla: la IA nunca las toca. */
export function conMediosDe<F extends Formulario>(leido: F, enPantalla: Formulario): F {
  return { ...leido, medios: enPantalla.medios };
}
