import type { Papel } from "@/lib/generated/prisma";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { listarPersonas } from "@/lib/puerta/personas";
import { crearPersona } from "./acciones";

// Tipado con el enum: los dos papeles que existen están aquí, así que no
// hace falta (ni tiene sentido) una reserva para un tercero que no puede
// llegar.
const NOMBRE_DEL_PAPEL: Record<Papel, string> = {
  PROFESOR: "Profesor",
  ESTUDIANTE: "Estudiante",
};

export default async function Personas({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await exigirProfesor();
  const [personas, { error }] = await Promise.all([listarPersonas(), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-bold text-tinta">Personas</h1>

      <ul className="flex flex-col gap-2">
        {personas.map((persona) => (
          <li
            key={persona.id}
            className="flex items-center justify-between rounded-2xl border border-tinta-suave/30 p-4"
          >
            <div>
              <p className="font-bold text-tinta">{persona.nombre}</p>
              <p className="text-tinta-suave">{persona.correo}</p>
            </div>
            <span className="text-tinta-suave">{NOMBRE_DEL_PAPEL[persona.papel]}</span>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-tinta">Dar de alta</h2>
        {error && <p className="rounded-2xl bg-hp-50 p-4 text-tinta">{error}</p>}
        <form action={crearPersona} className="flex flex-col gap-4">
          <input
            type="text"
            name="nombre"
            required
            placeholder="Nombre"
            className="rounded-2xl border border-tinta-suave/30 p-4"
          />
          <input
            type="email"
            name="correo"
            required
            autoComplete="email"
            placeholder="correo@ejemplo.com"
            className="rounded-2xl border border-tinta-suave/30 p-4"
          />
          <select
            name="papel"
            defaultValue="ESTUDIANTE"
            className="rounded-2xl border border-tinta-suave/30 p-4"
          >
            <option value="ESTUDIANTE">Estudiante</option>
            <option value="PROFESOR">Profesor</option>
          </select>
          <button type="submit" className="rounded-2xl bg-hp-400 p-4 font-bold text-white">
            Dar de alta
          </button>
        </form>
      </section>
    </main>
  );
}
