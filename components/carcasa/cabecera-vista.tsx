"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { enlacesDe, inicioDe, seccionActiva, type EnlaceDelMenu, type Papel } from "@/lib/carcasa/menu";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600";

function Contador({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span aria-label={`Por corregir: ${n}`} className="ml-1 rounded-full bg-coral-600 px-2 text-xs font-bold text-white">
      {n}
    </span>
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

/** El panel del móvil: cubre la pantalla bajo la barra. Exportado para poder
 *  probarlo abierto sin navegador. */
export function PanelMovil({
  enlaces,
  activa,
  nombre,
  pendientes,
  alCerrar,
}: {
  enlaces: EnlaceDelMenu[];
  activa: string | null;
  nombre: string;
  pendientes: number | null;
  alCerrar: () => void;
}) {
  return (
    <div id="panel-del-menu" className="fixed inset-x-0 bottom-0 top-16 z-20 flex flex-col gap-2 bg-white p-4 md:hidden">
      <button type="button" aria-label="Cerrar el menú" onClick={alCerrar} className={`self-end rounded-full p-2 text-xl ${FOCO}`}>
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

  return (
    <header className="border-b border-tinta-suave/10 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href={inicioDe(papel)} className={`text-xl font-extrabold text-hp-700 ${FOCO} rounded`}>
          HispaProfe
        </Link>

        <nav aria-label="Menú" className="hidden flex-1 items-center gap-1 md:flex">
          {enlaces.map((e) => (
            <EnlaceDeMenu key={e.href} enlace={e} activa={activa} pendientes={pendientes} />
          ))}
        </nav>

        {/* El nombre abre un menú con Salir. <details> no necesita estado ni
            efecto, y el teclado lo abre con Intro. */}
        <details className="relative ml-auto hidden md:block">
          <summary className={`cursor-pointer list-none rounded-2xl px-3 py-2 font-bold ${FOCO}`}>{nombre} ▾</summary>
          <div className="absolute right-0 z-20 mt-2 rounded-2xl bg-white p-2 shadow-tarjeta">
            <Salir />
          </div>
        </details>

        <button
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
      {abierto && <PanelMovil enlaces={enlaces} activa={activa} nombre={nombre} pendientes={pendientes} alCerrar={() => setAbierto(false)} />}
    </header>
  );
}
