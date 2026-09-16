import Link from "next/link";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { asignacionesDe, type AsignacionDelEstudiante, type EstadoDeUnaPrueba } from "@/lib/examen/asignar";
import { cerrarLasQueSePasaron } from "@/lib/examen/hacer";
import { PRUEBAS_QUE_SE_HACEN } from "@/lib/examen/paraHacer";
import { NOMBRE_CORTO, NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { estaFueraDePlazo, fechaEnPalabras } from "@/lib/tiempo/madrid";

function textoDelBoton(estado: EstadoDeUnaPrueba | undefined): string {
  if (!estado) return "Practicar"; // modo libre: sin intento, sin estado que mentir.
  if (estado.estado.estado === "SIN_EMPEZAR") return "Empezar";
  if (estado.estado.estado === "HACIENDO") return "Seguir";
  return "Ver resultado";
}

export default async function Portada() {
  const persona = await personaDeLaPeticion();
  const esProfesor = persona?.papel === "PROFESOR";
  const ahora = new Date();
  // Solo se piden si hacen falta: al profesor no se le pinta ninguna tarjeta.
  let asignaciones: AsignacionDelEstudiante[] = [];
  if (persona && !esProfesor) {
    // Antes de leer: si no, quien cerró el portátil a medio examen se vería
    // "a medias" para siempre y sin nota.
    await cerrarLasQueSePasaron({ personaId: persona.id }, ahora);
    asignaciones = await asignacionesDe(persona.id);
  }

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
                    <ul className="flex flex-col gap-2 border-t border-tinta-suave/10 pt-3">
                      {PRUEBAS_QUE_SE_HACEN.map((prueba) => {
                        const deLaPrueba = a.pruebas.find((p) => p.prueba === prueba);
                        return (
                          <li key={prueba} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold">{NOMBRE_CORTO[prueba]}</span>
                            {deLaPrueba && <span className="text-sm text-tinta-suave">{deLaPrueba.texto}</span>}
                            {/* Nunca cambia nada: solo lleva a la pantalla de la prueba, así que
                                enlace está bien. Un botón que cambia algo sí tendría que ser un
                                formulario, porque Next precarga los enlaces en cuanto se pintan. */}
                            <Link
                              href={`/examen/${a.examenId}/${prueba}`}
                              className="rounded-2xl bg-hp-400 px-4 py-2 text-sm font-bold text-white"
                            >
                              {textoDelBoton(deLaPrueba)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
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
