"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { enlacesDe, inicioDe, seccionActiva, type EnlaceDelMenu, type Papel } from "@/lib/carcasa/menu";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600";

/** El número de Pendientes. Un aria-label sobre un <span> sin papel no lo lee
 *  ningún lector de pantalla: el texto para ellos va aparte, en sr-only, y el
 *  número visible se les oculta para que no lo oigan dos veces. */
function Contador({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <>
      <span className="sr-only">{`Por corregir: ${n}`}</span>
      <span aria-hidden="true" className="ml-1 rounded-full bg-coral-600 px-2 text-xs font-bold text-white">
        {n}
      </span>
    </>
  );
}

function EnlaceDeMenu({
  enlace,
  activa,
  pendientes,
  alElegir,
}: {
  enlace: EnlaceDelMenu;
  activa: string | null;
  pendientes: number | null;
  alElegir?: () => void;
}) {
  const esActiva = activa === enlace.href;
  return (
    <Link
      data-menu=""
      href={enlace.href}
      aria-current={esActiva ? "page" : undefined}
      onClick={alElegir}
      className={`inline-flex items-center rounded-full px-4 py-2 font-bold ${FOCO} ${
        esActiva ? "bg-hp-50 text-hp-700" : "text-tinta hover:bg-hp-50"
      }`}
    >
      {enlace.texto}
      {enlace.conContador && <Contador n={pendientes} />}
    </Link>
  );
}

function Salir() {
  return (
    <form action="/salir" method="post">
      <button type="submit" className={`rounded-2xl px-3 py-2 font-bold text-coral-600 hover:bg-coral-100 ${FOCO}`}>
        Salir
      </button>
    </form>
  );
}

/** El panel del móvil: cubre la pantalla bajo la barra. Está SIEMPRE en la
 *  página y cerrado lleva `hidden`, para que el aria-controls del botón Menú
 *  apunte a algo que existe. Exportado para poder probarlo abierto sin
 *  navegador. */
export function PanelMovil({
  abierto,
  enlaces,
  activa,
  nombre,
  pendientes,
  alCerrar,
  refCerrar,
}: {
  abierto: boolean;
  enlaces: EnlaceDelMenu[];
  activa: string | null;
  nombre: string;
  pendientes: number | null;
  alCerrar: () => void;
  refCerrar?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div
      id="panel-del-menu"
      hidden={!abierto}
      className="fixed inset-x-0 bottom-0 top-16 z-20 flex flex-col gap-2 bg-white p-4 md:hidden"
    >
      <button
        ref={refCerrar}
        type="button"
        aria-label="Cerrar el menú"
        onClick={alCerrar}
        className={`self-end rounded-full p-2 text-xl ${FOCO}`}
      >
        ✕
      </button>
      <nav aria-label="Menú" className="flex flex-col gap-1">
        {enlaces.map((e) => (
          <EnlaceDeMenu key={e.href} enlace={e} activa={activa} pendientes={pendientes} alElegir={alCerrar} />
        ))}
      </nav>
      <div className="mt-auto flex items-center justify-between border-t border-tinta-suave/10 pt-4">
        <span className="font-bold">{nombre}</span>
        <Salir />
      </div>
    </div>
  );
}

export function CabeceraVista({ papel, nombre, pendientes }: { papel: Papel; nombre: string; pendientes: number | null }) {
  const ruta = usePathname() ?? "";
  const enlaces = enlacesDe(papel);
  const activa = seccionActiva(ruta, enlaces);
  const [abierto, setAbierto] = useState(false);
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const nombreDetalles = useRef<HTMLDetailsElement>(null);

  // El foco sigue al panel: al abrir va a la ✕, al cerrar vuelve a «Menú».
  // Se compara con el valor anterior (y no con «es la primera vez») para no
  // mover el foco al cargar la página, tampoco cuando el modo estricto de
  // React corre el efecto dos veces.
  const abiertoAntes = useRef(abierto);
  useEffect(() => {
    if (abiertoAntes.current === abierto) return;
    abiertoAntes.current = abierto;
    (abierto ? botonCerrar : botonMenu).current?.focus();
  }, [abierto]);

  // Escape cierra el panel. Escucha en `document` solo mientras está abierto.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  // Escape cierra también el menú del nombre y devuelve el foco a su
  // <summary> (el <details> no lo hace solo).
  const cerrarNombreConEscape = (e: KeyboardEvent<HTMLDetailsElement>) => {
    const d = nombreDetalles.current;
    if (e.key !== "Escape" || !d?.open) return;
    d.open = false;
    d.querySelector("summary")?.focus();
  };

  return (
    <header className="border-b border-tinta-suave/10 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href={inicioDe(papel)} className={`text-xl font-extrabold text-hp-700 ${FOCO} rounded`}>
          HispaProfe
        </Link>

        <nav data-menu-escritorio="" aria-label="Menú" className="hidden flex-1 items-center gap-1 md:flex">
          {enlaces.map((e) => (
            <EnlaceDeMenu key={e.href} enlace={e} activa={activa} pendientes={pendientes} />
          ))}
        </nav>

        {/* El nombre abre un menú con Salir. <details> no necesita estado ni
            efecto, y el teclado lo abre con Intro; Escape lo cierra. */}
        <details ref={nombreDetalles} onKeyDown={cerrarNombreConEscape} className="relative ml-auto hidden md:block">
          <summary className={`cursor-pointer list-none rounded-2xl px-3 py-2 font-bold ${FOCO}`}>{nombre} ▾</summary>
          <div className="absolute right-0 z-20 mt-2 rounded-2xl bg-white p-2 shadow-tarjeta">
            <Salir />
          </div>
        </details>

        <button
          ref={botonMenu}
          type="button"
          className={`ml-auto rounded-2xl px-3 py-2 font-bold md:hidden ${FOCO}`}
          aria-expanded={abierto}
          aria-controls="panel-del-menu"
          onClick={() => setAbierto(true)}
        >
          Menú
          <Contador n={pendientes} />
        </button>
      </div>
      <PanelMovil
        abierto={abierto}
        enlaces={enlaces}
        activa={activa}
        nombre={nombre}
        pendientes={pendientes}
        alCerrar={() => setAbierto(false)}
        refCerrar={botonCerrar}
      />
    </header>
  );
}
