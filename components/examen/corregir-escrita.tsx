"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParaCorregir } from "@/lib/examen/corregir";
import { BANDA_MAXIMA, CRITERIOS_EE } from "@/lib/dele/estructura";
import { guardarCorreccionAccion } from "@/app/(sitio)/pendientes/acciones";
import { EnunciadoDeEscrita } from "@/components/examen/enunciado-de-escrita";
import { huboSalidas, tiempoFueraEnPalabras, vecesEnPalabras, type ResumenDeSalidas } from "@/lib/examen/motor";
import { motivoParaNoGuardar, sumaDeNotas, type Bandas } from "@/components/examen/notas";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { GrupoDeOpciones } from "@/components/ui/grupo-de-opciones";
import { Tarjeta } from "@/components/ui/tarjeta";
import { fechaHoraEnPalabras } from "@/lib/tiempo/madrid";

/**
 * El registro de salidas, para el profesor y solo aquí: una línea, y **solo si
 * hubo salidas**. Si el chico no se salió no se pinta nada — una línea diciendo
 * «salió 0 veces» es ruido en la pantalla donde lo que importa es la redacción.
 *
 * Para qué sirve: le explica un folio corto o en blanco sin tener que suponer
 * que el chico no sabía. Por eso lleva el tiempo además de la cuenta, y la
 * tarea de la última salida: tres salidas de cinco segundos y una de doce
 * minutos son dos cosas muy distintas y no se pueden contar igual.
 *
 * Va en coral y no en rojo: no se ha roto nada, y el registro no es
 * una acusación. Que el chico se saliera puede ser una llamada de su madre.
 *
 * Pieza aparte y exportada para poder pintarla sin montar la pantalla entera.
 */
export function SalidasDelEstudiante({ resumen }: { resumen: ResumenDeSalidas }) {
  if (!huboSalidas(resumen)) return null;
  return (
    <div role="status" data-salidas>
      <Aviso tono="aviso">
        Salió de la pantalla {vecesEnPalabras(resumen.salidas)}, {tiempoFueraEnPalabras(resumen.segundosFuera)} en
        total
        {resumen.ultimaSalidaEn !== null && `; la última, el ${fechaHoraEnPalabras(resumen.ultimaSalidaEn)}`}
        {resumen.ultimaSalidaDeTarea !== null && `, desde la tarea ${resumen.ultimaSalidaDeTarea}`}.
        {/* El caso que más le dice: se fue y la prueba se cerró con él fuera. Se
            nombra con todas las letras, porque el tiempo de esa última ausencia se
            cuenta solo hasta el cierre y no hasta que alguien miró la pantalla. */}
        {resumen.ultimaSalidaSinVuelta && " De esa última no volvió: la prueba se cerró con él fuera."}
      </Aviso>
    </div>
  );
}

/** Nace vacía si nunca se corrigió (`bandas.length === 0`); si ya tiene las
 *  cuatro, son las de verdad, no ceros de relleno. */
function bandasIniciales(bandas: number[]): Bandas {
  return bandas.length === CRITERIOS_EE.length ? bandas : CRITERIOS_EE.map(() => null);
}

/** La nota marcada de un criterio, como la pide `GrupoDeOpciones`: `null` si
 *  todavía no hay, que deja los cuatro botones sin marcar (NO marca el 0). */
function valorDeBanda(bandas: Record<number, Bandas>, tarea: number, i: number): string | null {
  const b = bandas[tarea]?.[i] ?? null;
  return b === null ? null : String(b);
}

/**
 * Los dos botones de guardar, aparte de la pantalla para poder pintarlos
 * solos con `procesando` fijo: dentro de `CorregirEscrita` solo se apagan
 * tras un clic, y aquí no hay jsdom para simular uno.
 *
 * Con `motivo` (falta alguna nota) nacen apagados y el motivo va escrito al
 * lado: un botón apagado sin decir por qué parece roto. Solo el primero cambia
 * su texto a «Guardando…»: dos botones diciendo lo mismo confunden.
 */
export function BotonesDeGuardar({ procesando, motivo, alGuardar, alGuardarYSeguir }: {
  procesando: boolean; motivo: string | null; alGuardar: () => void; alGuardarYSeguir: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Boton onClick={alGuardar} disabled={motivo !== null} enviando={procesando} textoEnviando="Guardando…">Guardar</Boton>
      <Boton variante="secundario" onClick={alGuardarYSeguir} disabled={motivo !== null || procesando}>Guardar y seguir</Boton>
      {motivo && <span className="text-sm text-tinta-suave">{motivo}</span>}
    </div>
  );
}

/**
 * La pantalla de corregir UNA redacción: el enunciado de cada tarea (de
 * lectura, con `<EnunciadoDeEscrita bloqueado>`), lo que escribió el
 * estudiante, y las cuatro notas (0 a 3, en botones) más el comentario,
 * tarea a tarea. Guardar firma la corrección entera de golpe (las dos tareas juntas),
 * como hace `guardarCorreccion` en el servidor.
 *
 * Las ocho notas NACEN SIN MARCAR cuando no hay corrección previa, no a cero:
 * `guardarCorreccion` firma con la fecha en cualquier guardado, así que un
 * profesor que solo rellenara la tarea 1 y guardara firmaría la tarea 2 con
 * cuatro ceros sin querer, y esa redacción saldría de la cola con una nota
 * que nadie puso. «Guardar» y «Guardar y seguir» vienen apagados mientras
 * falte alguna, con el motivo escrito al lado; un 0 marcado a mano sigue
 * siendo una nota válida. Arriba va la suma («17 de 24»), que solo informa:
 * nunca se traduce a apto.
 */
export function CorregirEscrita({ para }: { para: ParaCorregir }) {
  const router = useRouter();
  const [bandas, setBandas] = useState<Record<number, Bandas>>(() =>
    Object.fromEntries(para.tareas.map((t) => [t.numero, bandasIniciales(t.bandas)])),
  );
  const [comentarios, setComentarios] = useState<Record<number, string>>(() =>
    Object.fromEntries(para.tareas.map((t) => [t.numero, t.comentario])),
  );
  const [error, setError] = useState<string | null>(null);
  // Apaga los dos botones desde el primer clic hasta que vuelve el servidor:
  // sin esto, un doble clic manda dos firmas a la vez y la segunda pisa a la
  // primera. Solo eso: `useTransition` vive en ESTA pestaña, así que no
  // protege de la misma redacción abierta en dos, y eso no está resuelto.
  // Tampoco hace daño hoy: las dos firmas escriben lo mismo, y la de después
  // gana, que es lo que el profesor esperaría.
  const [procesando, empezarTransicion] = useTransition();

  const numeros = para.tareas.map((t) => t.numero);
  const motivo = motivoParaNoGuardar(bandas, numeros);
  const { suma, maximo } = sumaDeNotas(bandas, numeros);

  function guardar(irASiguiente: boolean) {
    // Red por debajo de los botones apagados: no debería llegar nunca aquí
    // con huecos, pero si llega no se firma nada.
    if (motivo !== null) {
      setError(motivo);
      return;
    }
    const tareas = para.tareas.map((t) => ({
      tarea: t.numero,
      bandas: (bandas[t.numero] ?? []).map((b) => b as number),
      comentario: comentarios[t.numero] ?? t.comentario,
    }));
    empezarTransicion(async () => {
      const r = await guardarCorreccionAccion(para.intentoId, tareas);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (irASiguiente) {
        router.push(para.siguiente ? `/pendientes/${para.siguiente}` : "/pendientes");
      } else {
        router.refresh();
      }
    });
  }

  function cambiarBanda(tarea: number, indice: number, valor: number | null) {
    setBandas((actual) => {
      const fila = [...(actual[tarea] ?? bandasIniciales([]))];
      fila[indice] = valor;
      return { ...actual, [tarea]: fila };
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPagina
        titulo={para.persona.nombre}
        subtitulo={`${para.examen.titulo} · entregada el ${fechaHoraEnPalabras(para.entregadaEn)}${para.porTiempo ? " · por tiempo" : ""}`}
        acciones={<p className="text-lg font-extrabold" data-suma>{suma} de {maximo}</p>}
      />
      {/* Firmar es un acto con fecha: si ya la corrigió, la pantalla lo dice
          y avisa de que volver a guardar cambia la corrección ya firmada.
          No es un error —nada se ha roto—, así que va en info. */}
      {para.corregidaEn !== null && (
        <div role="status">
          <Aviso tono="info">Ya la corregiste el {fechaHoraEnPalabras(para.corregidaEn)}; si guardas, se cambia.</Aviso>
        </div>
      )}
      <SalidasDelEstudiante resumen={para.salidas} />
      {error && <Aviso tono="error">{error}</Aviso>}

      {para.tareas.map((t) => (
        <Tarjeta as="section" key={t.numero} className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Tarea {t.numero}</h2>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <EnunciadoDeEscrita formulario={t.formulario} opcionElegida={t.opcion} bloqueado />
              <p className="min-w-0 rounded-2xl border border-tinta-suave/20 bg-fondo p-4 whitespace-pre-line">{t.texto}</p>
              <p className="text-sm text-tinta-suave">{t.palabras} palabras</p>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {CRITERIOS_EE.map((criterio, i) => (
                <GrupoDeOpciones
                  key={criterio.clave}
                  nombre={`nota-${t.numero}-${i}`}
                  leyenda={criterio.nombre}
                  ayuda={criterio.ayuda || undefined}
                  forma="segmentos"
                  opciones={Array.from({ length: BANDA_MAXIMA + 1 }, (_, v) => ({ valor: String(v), texto: String(v) }))}
                  valor={valorDeBanda(bandas, t.numero, i)}
                  alCambiar={(v) => cambiarBanda(t.numero, i, Number(v))}
                  disabled={procesando}
                />
              ))}
              <Campo
                multilinea
                id={`comentario-${t.numero}`}
                etiqueta="Comentario"
                rows={4}
                value={comentarios[t.numero] ?? ""}
                disabled={procesando}
                onChange={(e) => setComentarios((actual) => ({ ...actual, [t.numero]: e.target.value }))}
              />
            </div>
          </div>
        </Tarjeta>
      ))}

      <div className="sticky bottom-0 border-t border-tinta-suave/20 bg-fondo py-3">
        <BotonesDeGuardar procesando={procesando} motivo={motivo} alGuardar={() => guardar(false)} alGuardarYSeguir={() => guardar(true)} />
      </div>
    </main>
  );
}
