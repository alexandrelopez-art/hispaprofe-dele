import Link from "next/link";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { asignacionesDe } from "@/lib/examen/asignar";
import { NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { estaFueraDePlazo, fechaEnPalabras } from "@/lib/tiempo/madrid";

export default async function Portada() {
  const persona = await personaDeLaPeticion();
  const esProfesor = persona?.papel === "PROFESOR";
  // Solo se piden si hacen falta: al profesor no se le pinta ninguna tarjeta.
  const asignaciones = persona && !esProfesor ? await asignacionesDe(persona.id) : [];
  const ahora = new Date();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-3xl font-extrabold">HispaProfe</h1>
      {!persona ? (
        <p>
          <Link href="/entrar" className="text-hp-600 underline">
            Entrar
          </Link>
        </p>
      ) : (
        <>
          <p>Hola, {persona.nombre}.</p>

          {!esProfesor &&
            (asignaciones.length === 0 ? (
              <p className="text-tinta-suave">No tienes nada pendiente.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {asignaciones.map((a) => (
                  <li key={a.examenId} className="rounded-2xl border border-tinta-suave/20 bg-white p-5">
                    <h2 className="text-xl font-bold">{a.titulo}</h2>
                    <p className="text-tinta-suave">{NOMBRE_DE_NIVEL[a.nivel]}</p>
                    <p>
                      {estaFueraDePlazo(a.fechaTope, ahora)
                        ? `Se pasó el plazo el ${fechaEnPalabras(a.fechaTope)}.`
                        : `Para el ${fechaEnPalabras(a.fechaTope)}.`}
                    </p>
                    {/* El botón de empezar llega con la 3c: hasta entonces se dice, no se
                        enseña un botón que no lleva a ninguna parte. */}
                    <p className="text-sm text-tinta-suave">Todavía no puedes empezarlo. Te avisaré cuando se abra.</p>
                  </li>
                ))}
              </ul>
            ))}

          <nav className="flex flex-col gap-1">
            {esProfesor && (
              <Link href="/personas" className="text-hp-600 underline">
                Personas
              </Link>
            )}
            {esProfesor && (
              <Link href="/examenes" className="text-hp-600 underline">
                Exámenes
              </Link>
            )}
            {esProfesor && (
              <Link href="/pruebas/grabar" className="text-hp-600 underline">
                Prueba: grabar
              </Link>
            )}
            {esProfesor && (
              <Link href="/pruebas/subir" className="text-hp-600 underline">
                Prueba: subir
              </Link>
            )}
            <form action="/salir" method="post">
              <button type="submit" className="underline">
                Salir
              </button>
            </form>
          </nav>
        </>
      )}
    </main>
  );
}
