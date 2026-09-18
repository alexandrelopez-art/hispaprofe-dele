import type { Papel } from "@/lib/generated/prisma";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { listarPersonas } from "@/lib/puerta/personas";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Enlace } from "@/components/ui/enlace";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Aviso } from "@/components/ui/aviso";
import { Campo } from "@/components/ui/campo";
import { Desplegable } from "@/components/ui/desplegable";
import { Boton } from "@/components/ui/boton";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { crearPersona } from "./acciones";

// Tipado con el enum: los dos papeles que existen están aquí, así que no
// hace falta (ni tiene sentido) una reserva para un tercero que no puede
// llegar.
const NOMBRE_DEL_PAPEL: Record<Papel, string> = {
  PROFESOR: "Profesor",
  ESTUDIANTE: "Estudiante",
};

/** «Ana Pérez» → «AP»; «Ana» → «A». Solo presentación. */
function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function Estudiantes({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await exigirProfesor();
  const [personas, { error }] = await Promise.all([listarPersonas(), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPagina titulo="Estudiantes" acciones={<Enlace href="#alta" comoBoton="principal">Dar de alta</Enlace>} />
      <ul className="flex flex-col divide-y divide-tinta-suave/10 rounded-tarjeta bg-white shadow-tarjeta">
        {personas.map((persona) => (
          <li key={persona.id} className="flex items-center gap-3 p-4">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sol-100 font-bold text-tinta"
            >
              {iniciales(persona.nombre)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{persona.nombre}</span>
              <span className="truncate text-sm text-tinta-suave">{persona.correo}</span>
            </span>
            <EtiquetaEstado tono="neutro">{NOMBRE_DEL_PAPEL[persona.papel]}</EtiquetaEstado>
          </li>
        ))}
      </ul>
      <Tarjeta as="section" className="flex flex-col gap-4">
        <h2 id="alta" className="scroll-mt-20 text-xl font-bold">
          Dar de alta
        </h2>
        {error && <Aviso tono="error">{error}</Aviso>}
        <form action={crearPersona} className="flex flex-col gap-4">
          <Campo id="alta-nombre" name="nombre" etiqueta="Nombre" required />
          <Campo id="alta-correo" name="correo" etiqueta="Correo" type="email" required autoComplete="email" placeholder="correo@ejemplo.com" />
          <Desplegable
            id="alta-papel"
            name="papel"
            etiqueta="Papel"
            defaultValue="ESTUDIANTE"
            opciones={[
              { valor: "ESTUDIANTE", texto: "Estudiante" },
              { valor: "PROFESOR", texto: "Profesor" },
            ]}
          />
          <div>
            <Boton type="submit">Dar de alta</Boton>
          </div>
        </form>
      </Tarjeta>
    </main>
  );
}
