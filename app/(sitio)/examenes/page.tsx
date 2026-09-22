import Link from "next/link";
import type { EstadoExamen } from "@/lib/generated/prisma";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { NOMBRE_DE_NIVEL, nivelesConReglas } from "@/lib/dele/estructura";
import { listarExamenes } from "@/lib/taller/examenes";
import { tonoDelExamen } from "@/lib/carcasa/tonos";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Enlace } from "@/components/ui/enlace";
import { BloqueVacio } from "@/components/ui/bloque-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Aviso } from "@/components/ui/aviso";
import { Campo } from "@/components/ui/campo";
import { Desplegable } from "@/components/ui/desplegable";
import { Boton } from "@/components/ui/boton";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { crearExamenAccion } from "./acciones";

const NOMBRE_DEL_ESTADO: Record<EstadoExamen, string> = {
  EN_CONSTRUCCION: "En construcción",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};

export default async function Examenes({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await exigirProfesor();
  const [examenes, { error }] = await Promise.all([listarExamenes(), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPagina titulo="Exámenes" acciones={<Enlace href="#nuevo" comoBoton="principal">Nuevo examen</Enlace>} />
      {examenes.length === 0 ? (
        <BloqueVacio titulo="Todavía no hay ningún examen" texto="Crea el primero con el formulario de abajo." />
      ) : (
        <ul className="flex flex-col gap-3">
          {examenes.map((e) => (
            <li key={e.id}>
              <Link
                href={`/examenes/${e.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-white p-5 shadow-tarjeta hover:bg-hp-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">{e.titulo}</span>
                  <span className="text-sm text-tinta-suave">{NOMBRE_DE_NIVEL[e.nivel]}</span>
                </span>
                <EtiquetaEstado tono={tonoDelExamen(e.estado)}>{NOMBRE_DEL_ESTADO[e.estado]}</EtiquetaEstado>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Tarjeta as="section" className="flex flex-col gap-4">
        <h2 id="nuevo" className="scroll-mt-20 text-xl font-bold">
          Nuevo examen
        </h2>
        {error && <Aviso tono="error">{error}</Aviso>}
        <form action={crearExamenAccion} className="flex flex-col gap-4">
          <Campo id="titulo-nuevo" name="titulo" etiqueta="Título" required placeholder="Libro de preparación, examen 1" />
          <Desplegable
            id="nivel-nuevo"
            name="nivel"
            etiqueta="Nivel"
            opciones={nivelesConReglas().map((n) => ({ valor: n, texto: NOMBRE_DE_NIVEL[n] }))}
          />
          <div>
            <Boton type="submit">Crear el examen</Boton>
          </div>
        </form>
      </Tarjeta>
    </main>
  );
}
