import Link from "next/link";
import type { EstadoExamen } from "@/lib/generated/prisma";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { NOMBRE_DE_NIVEL, nivelesConReglas } from "@/lib/dele/estructura";
import { listarExamenes } from "@/lib/taller/examenes";
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-bold">Exámenes</h1>

      {examenes.length === 0 ? (
        <p className="text-tinta-suave">Todavía no hay ningún examen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {examenes.map((e) => (
            <li key={e.id}>
              <Link href={`/examenes/${e.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-4">
                <span className="font-bold">{e.titulo}</span>
                <span className="text-tinta-suave">{NOMBRE_DE_NIVEL[e.nivel]} · {NOMBRE_DEL_ESTADO[e.estado]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Nuevo examen</h2>
        {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}
        <form action={crearExamenAccion} className="flex flex-col gap-4">
          <input name="titulo" required placeholder="Libro de preparación, examen 1" className="rounded-2xl border border-tinta-suave/30 bg-white p-4" />
          <select name="nivel" className="rounded-2xl border border-tinta-suave/30 bg-white p-4">
            {nivelesConReglas().map((n) => (
              <option key={n} value={n}>{NOMBRE_DE_NIVEL[n]}</option>
            ))}
          </select>
          <button type="submit" className="rounded-2xl bg-hp-400 p-4 font-bold text-white">Crear el examen</button>
        </form>
      </section>
    </main>
  );
}
