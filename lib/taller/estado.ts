import type { ReglaTarea } from "@/lib/dele/estructura";
import { huecosDeImagen } from "./medios";
import type { Formulario, FormularioDe } from "./formas";
import type { RespuestasDeUnaPrueba } from "./soluciones";

export type EstadoDeTarea = {
  estado: "VACIA" | "A_MEDIAS" | "COMPLETA";
  motivos: string[];
};

const vacio = (s: string) => s.trim() === "";

function enumerar(cosas: readonly string[]): string {
  return cosas.length <= 1 ? cosas.join("") : `${cosas.slice(0, -1).join(", ")} y ${cosas.at(-1)}`;
}

export function itemsDelFormulario(f: Formulario): number[] {
  switch (f.forma) {
    case "RELACIONAR": return f.actividad.elementos.map((e) => e.numero);
    case "LISTA_COMUN":
    case "OPCIONES": return f.actividad.preguntas.map((p) => p.numero);
    case "HUECOS": return f.actividad.huecos.map((h) => h.numero);
    default: return [];
  }
}

/** Las letras que puede tener la respuesta de un ítem. En relacionar, la del ejemplo ya está gastada. */
export function letrasPosibles(f: Formulario, numero: number): string[] {
  switch (f.forma) {
    case "RELACIONAR": return f.actividad.destinos.map((d) => d.letra).filter((l) => l !== f.actividad.ejemplo.letra);
    case "LISTA_COMUN": return f.actividad.comunes.map((c) => c.letra);
    case "OPCIONES": return f.actividad.preguntas.find((p) => p.numero === numero)?.opciones.map((o) => o.letra) ?? [];
    case "HUECOS": return f.actividad.huecos.find((h) => h.numero === numero)?.opciones.map((o) => o.letra) ?? [];
    default: return [];
  }
}

export function claveDelFormulario(f: Formulario, respuestas: RespuestasDeUnaPrueba | null): Record<string, string> | null {
  const numeros = itemsDelFormulario(f);
  if (numeros.length === 0 || !respuestas) return null;
  const clave: Record<string, string> = {};
  for (const n of numeros) {
    const letra = respuestas[String(n)];
    if (letra) clave[String(n)] = letra;
  }
  return clave;
}

function mismaClave(a: Record<string, string>, b: Record<string, string> | null): boolean {
  const otra = b ?? {};
  const ka = Object.keys(a).sort();
  const kb = Object.keys(otra).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === otra[k]);
}

function textosQueFaltan(regla: ReglaTarea, f: Formulario): string[] {
  const m: string[] = [];
  const falta = (valor: string, motivo: string) => { if (vacio(valor)) m.push(motivo); };
  const pautasVacias = (pautas: string[], donde: string) => {
    if (pautas.length === 0 || pautas.some(vacio)) m.push(`Hay una pauta vacía en ${donde}.`);
  };

  falta(f.consigna, "Falta la consigna.");
  f.textos.forEach((t, i) => falta(t.texto, `Falta el texto ${i + 1}.`));

  switch (f.forma) {
    case "RELACIONAR": {
      const a = f.actividad;
      falta(a.ejemplo.letra, "Falta la letra del ejemplo.");
      if (regla.elementosConTexto) {
        falta(a.ejemplo.texto, "Falta el texto del ejemplo.");
        for (const e of a.elementos) falta(e.texto, `Falta el texto de la ${e.numero}.`);
      }
      for (const d of a.destinos) falta(d.texto, `Falta el texto ${d.letra}.`);
      break;
    }
    case "LISTA_COMUN": {
      const a = f.actividad;
      for (const c of a.comunes) falta(c.texto, `Falta el texto de la opción ${c.letra}.`);
      if (a.ejemplo) {
        falta(a.ejemplo.enunciado, "Falta el enunciado del ejemplo.");
        falta(a.ejemplo.letra, "Falta la letra del ejemplo.");
      }
      for (const p of a.preguntas) falta(p.enunciado, `Falta el enunciado de la ${p.numero}.`);
      break;
    }
    case "OPCIONES": {
      const a = f.actividad;
      if (a.ejemplo) {
        falta(a.ejemplo.enunciado, "Falta el enunciado del ejemplo.");
        falta(a.ejemplo.letra, "Falta la letra del ejemplo.");
        for (const o of a.ejemplo.opciones) if (!o.conImagen) falta(o.texto, `Falta el texto de la opción ${o.letra} del ejemplo.`);
      }
      for (const p of a.preguntas) {
        falta(p.enunciado, `Falta el enunciado de la ${p.numero}.`);
        for (const o of p.opciones) if (!o.conImagen) falta(o.texto, `Falta el texto de la opción ${o.letra} de la ${p.numero}.`);
      }
      break;
    }
    case "HUECOS": {
      const a = f.actividad;
      falta(a.texto, "Falta el texto con los huecos.");
      for (const h of a.huecos) for (const o of h.opciones) falta(o.texto, `Falta la opción ${o.letra} del hueco ${h.numero}.`);
      break;
    }
    case "REDACCION_UNA":
      falta(f.actividad.situacion, "Falta la situación.");
      pautasVacias(f.actividad.pautas, "la tarea");
      break;
    case "REDACCION_DOS":
      f.actividad.opciones.forEach((o, i) => {
        falta(o.contexto, `Falta el contexto de la opción ${i + 1}.`);
        pautasVacias(o.pautas, `la opción ${i + 1}`);
      });
      break;
    case "ORAL_SOLO":
      f.actividad.opciones.forEach((o, i) => {
        falta(o.tema, `Falta el tema de la opción ${i + 1}.`);
        pautasVacias(o.pautas, `la opción ${i + 1}`);
      });
      break;
    case "ORAL_DIRECTO":
      f.actividad.opciones.forEach((o, i) => {
        falta(o.tema, `Falta el tema de la opción ${i + 1}.`);
        falta(o.situacion, `Falta la situación de la opción ${i + 1}.`);
        pautasVacias(o.pautas, `la opción ${i + 1}`);
      });
      break;
  }
  return m;
}

function motivosDeMarcas(f: FormularioDe<"HUECOS">): string[] {
  if (vacio(f.actividad.texto)) return [];
  const m: string[] = [];
  const marcas = [...f.actividad.texto.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
  for (const h of f.actividad.huecos) {
    const veces = marcas.filter((n) => n === h.numero).length;
    if (veces === 0) m.push(`Falta la marca [${h.numero}] en el texto.`);
    if (veces > 1) m.push(`La marca [${h.numero}] aparece ${veces} veces en el texto.`);
  }
  const conocidos = new Set(f.actividad.huecos.map((h) => h.numero));
  for (const n of new Set(marcas)) if (!conocidos.has(n)) m.push(`El texto tiene una marca [${n}] que no es de ningún hueco.`);
  return m;
}

/** Las fotos que faltan y la pista: que esté, y que sus marcas den los trozos que lleva la tarea. */
function motivosDeMedios(regla: ReglaTarea, f: Formulario): string[] {
  const m = huecosDeImagen(f)
    .filter((h) => !f.medios.imagenes[h.clave])
    .map((h) => `Falta la foto de ${h.etiqueta}.`);
  if (regla.trozos) {
    const audio = f.medios.audio;
    if (!audio) m.push("Falta la pista de audio.");
    else if (audio.cortes.length + 1 !== regla.trozos) {
      m.push(`La pista tiene ${audio.cortes.length + 1} trozos y esta tarea lleva ${regla.trozos}.`);
    }
  }
  return m;
}

export function motivosDeTarea(
  regla: ReglaTarea,
  f: Formulario,
  respuestas: RespuestasDeUnaPrueba | null,
  claveGuardada: Record<string, string> | null,
): string[] {
  const motivos = textosQueFaltan(regla, f);
  if (f.forma === "HUECOS") motivos.push(...motivosDeMarcas(f));
  motivos.push(...motivosDeMedios(regla, f));

  const numeros = itemsDelFormulario(f);
  if (numeros.length === 0) return motivos;
  if (!respuestas) return [...motivos, "Falta el cuadernillo, o no trae las respuestas de este examen."];

  const porLetra = new Map<string, number[]>();
  for (const n of numeros) {
    const letra = respuestas[String(n)];
    if (!letra) { motivos.push(`El cuadernillo no trae la respuesta de la ${n}.`); continue; }
    if (f.forma === "RELACIONAR" && letra === f.actividad.ejemplo.letra) {
      motivos.push(`La respuesta de la ${n} es «${letra}», que es la del ejemplo.`);
      continue;
    }
    const posibles = letrasPosibles(f, n);
    if (!posibles.includes(letra)) {
      motivos.push(`La respuesta de la ${n} es «${letra}», y esa pregunta solo tiene ${enumerar(posibles)}.`);
      continue;
    }
    porLetra.set(letra, [...(porLetra.get(letra) ?? []), n]);
  }
  if (f.forma === "RELACIONAR") {
    for (const [letra, ns] of porLetra) {
      if (ns.length > 1) motivos.push(`Las preguntas ${enumerar(ns.map(String))} tienen la misma respuesta, «${letra}».`);
    }
  }
  if (claveGuardada && !mismaClave(claveGuardada, claveDelFormulario(f, respuestas))) {
    motivos.push("La clave guardada no coincide con el cuadernillo: vuelve a guardar la tarea.");
  }
  return motivos;
}

export function estadoDeTarea(
  regla: ReglaTarea,
  f: Formulario | null,
  respuestas: RespuestasDeUnaPrueba | null,
  claveGuardada: Record<string, string> | null,
): EstadoDeTarea {
  if (!f) return { estado: "VACIA", motivos: ["Sin guardar todavía."] };
  const motivos = motivosDeTarea(regla, f, respuestas, claveGuardada);
  return { estado: motivos.length === 0 ? "COMPLETA" : "A_MEDIAS", motivos };
}
