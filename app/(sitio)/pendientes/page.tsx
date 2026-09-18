import Link from "next/link";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { escritosPorCorregir } from "@/lib/examen/corregir";
import { CAJA } from "@/components/examen/piezas";
import { fechaHoraEnPalabras } from "@/lib/tiempo/madrid";

/** «3 días esperando», «1 día esperando». Es el único dato que dice por dónde
 *  empezar: lo más viejo de la cola es lo primero que hay que corregir. */
function diasEnPalabras(dias: number): string {
  return `${dias} ${dias === 1 ? "día" : "días"} esperando`;
}

/**
 * La cola del profesor: las escritas entregadas y sin firmar, lo más viejo
 * arriba (así las devuelve `escritosPorCorregir`). No cierra pruebas
 * pasadas de hora ni pide ningún ámbito: aquí solo se lee, y el cierre ya
 * lo hacen el Inicio del estudiante y la lista del examen (decisión de la
 * 3c).
 *
 * `exigirProfesor` es media puerta: la otra mitad está en
 * app/(sitio)/pendientes/[intentoId]/page.tsx y en guardarCorreccionAccion. Las tres
 * hacen falta porque `lib/examen/corregir.ts` no comprueba papeles.
 */
export default async function Cola() {
  await exigirProfesor();
  const cola = await escritosPorCorregir(new Date());

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">Por corregir</h1>
      </header>

      {cola.length === 0 ? (
        <p className="text-tinta-suave">No hay nada esperando.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {cola.map((c) => (
            <li key={c.intentoId}>
              <Link href={`/pendientes/${c.intentoId}`} className={CAJA}>
                <span className="font-bold">{c.persona.nombre}</span>
                <span className="text-tinta-suave">{c.titulo}</span>
                <span className="text-sm text-tinta-suave">
                  Entregada el {fechaHoraEnPalabras(c.entregadaEn)}
                  {c.porTiempo ? " · por tiempo" : ""} · {diasEnPalabras(c.diasEsperando)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
