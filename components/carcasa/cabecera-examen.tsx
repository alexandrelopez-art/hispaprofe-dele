"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Prueba } from "@/lib/generated/prisma";
import { NOMBRE_CORTO } from "@/lib/dele/estructura";
import { Boton, clasesDeBoton } from "@/components/ui/boton";

/**
 * Lo que dice la ventana antes de salir. El reloj solo se nombra si corre; lo
 * de «queda apuntado» solo en la escrita con reloj, que es la única prueba que
 * registra las salidas (en práctica libre de lectura y auditiva no se apunta nada, y decirlo sería
 * mentir; la escrita en libre nunca llega aquí porque guarda y se entrega de verdad).
 */
export function frasesDeSalida({ conReloj, escrita, libre = false }: { conReloj: boolean; escrita: boolean; libre?: boolean }): string[] {
  if (libre) return ["Lo que marques en esta práctica no se guarda: al volver empiezas de nuevo."];
  const frases: string[] = [];
  if (conReloj) frases.push("El reloj sigue corriendo aunque salgas.");
  frases.push("Podrás volver a entrar mientras la prueba no esté entregada.");
  if (conReloj && escrita) {
    frases.push("Salir queda apuntado, y tu profesor ve cuántas veces saliste y cuánto tiempo estuviste fuera.");
  }
  return frases;
}

/**
 * La pregunta, como <dialog> de la página y no como confirm() del navegador:
 * se viste, se prueba, Escape la cierra (evento `cancel` → onClose) y el
 * navegador devuelve el foco al botón que la abrió. Abrirla o cerrarla con
 * «Seguir la prueba» NO desmonta la pantalla de la prueba, así que no apunta
 * ninguna salida: lo que apunta es irse de verdad.
 *
 * `saliendo` es el rato entre pulsar «Salir de todos modos» y que llegue
 * Inicio: sin señal, el botón parece roto e invita al segundo clic, y
 * «Seguir la prueba» ya no puede cumplir lo que dice.
 */
export function VentanaDeSalida({
  abierta,
  saliendo = false,
  frases,
  alSeguir,
  alSalir,
}: {
  abierta: boolean;
  saliendo?: boolean;
  frases: string[];
  alSeguir: () => void;
  alSalir: () => void;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ventana.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ventana}
      onClose={alSeguir}
      aria-labelledby="titulo-de-salir"
      className="m-auto max-w-md rounded-tarjeta p-6 shadow-tarjeta backdrop:bg-tinta/40"
    >
      <h2 id="titulo-de-salir" className="text-lg font-bold">
        ¿Seguro que quieres salir?
      </h2>
      {frases.map((f) => (
        <p key={f} className="mt-2 text-tinta-suave">
          {f}
        </p>
      ))}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" onClick={alSeguir} disabled={saliendo} autoFocus>
          Seguir la prueba
        </Boton>
        <Boton variante="peligro" onClick={alSalir} enviando={saliendo} textoEnviando="Saliendo…">
          Salir de todos modos
        </Boton>
      </div>
    </dialog>
  );
}

/**
 * La cabecera mientras se hace una prueba: sustituye del todo a la del sitio.
 * Ni menú ni nombre. Se dibuja DENTRO de cada cara porque la tarea abierta es
 * estado de la cara. `reloj` es el <Reloj> de la cara, que se mueve aquí: en
 * pantalla solo puede haber uno.
 */
export function CabeceraExamen({
  prueba,
  tarea,
  reloj,
  preguntar,
  escrita = false,
  libre = false,
}: {
  prueba: Prueba;
  tarea: { actual: number; total: number } | null;
  reloj: ReactNode | null;
  preguntar: boolean;
  escrita?: boolean;
  libre?: boolean;
}) {
  const router = useRouter();
  const [preguntando, setPreguntando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tarjeta bg-white px-4 py-3 shadow-suave">
      <p className="font-bold">
        {NOMBRE_CORTO[prueba]}
        {tarea && (
          <>
            <span className="hidden sm:inline">{` · Tarea ${tarea.actual} de ${tarea.total}`}</span>
            <span className="sm:hidden">{` · ${tarea.actual}/${tarea.total}`}</span>
          </>
        )}
      </p>
      {reloj && <div className="ml-auto">{reloj}</div>}
      <div className={reloj ? "" : "ml-auto"}>
        {preguntar ? (
          <Boton variante="secundario" onClick={() => setPreguntando(true)}>
            Salir
          </Boton>
        ) : (
          <Link href="/" className={clasesDeBoton("secundario")}>
            Salir
          </Link>
        )}
      </div>
      {preguntar && (
        <VentanaDeSalida
          abierta={preguntando}
          saliendo={saliendo}
          frases={frasesDeSalida({ conReloj: reloj !== null, escrita, libre })}
          alSeguir={() => setPreguntando(false)}
          alSalir={() => {
            setSaliendo(true);
            router.push("/");
          }}
        />
      )}
    </header>
  );
}
