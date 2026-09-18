import Link from "next/link";
import { redirect } from "next/navigation";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { asignacionesDe, type AsignacionDelEstudiante, type EstadoDeUnaPrueba } from "@/lib/examen/asignar";
import { cerrarLasQueSePasaron } from "@/lib/examen/hacer";
import { PRUEBAS_QUE_SE_HACEN } from "@/lib/examen/paraHacer";
import { NOMBRE_CORTO, NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { estaFueraDePlazo, fechaEnPalabras } from "@/lib/tiempo/madrid";
import { inicioDe } from "@/lib/carcasa/menu";
import { tonoDelEstado, varianteDelBoton } from "@/lib/carcasa/tonos";
import { Tarjeta } from "@/components/ui/tarjeta";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Enlace } from "@/components/ui/enlace";
import { BloqueVacio } from "@/components/ui/bloque-vacio";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";

function textoDelBoton(estado: EstadoDeUnaPrueba | undefined): string {
  if (!estado) return "Practicar"; // modo libre: sin intento, sin estado que mentir.
  if (estado.estado.estado === "SIN_EMPEZAR") return "Empezar";
  if (estado.estado.estado === "HACIENDO") return "Seguir";
  return "Ver resultado";
}

export default async function Portada() {
  const persona = await personaDeLaPeticion();
  // El profesor no tiene nada que hacer en el Inicio del estudiante: su
  // pantalla de siempre es la cola de Pendientes.
  if (persona?.papel === "PROFESOR") redirect(inicioDe("PROFESOR"));
  const ahora = new Date();
  // Solo se piden si hacen falta: sin persona no hay a quién pedírselas.
  let asignaciones: AsignacionDelEstudiante[] = [];
  if (persona) {
    // Antes de leer: si no, quien cerró el portátil a medio examen se vería
    // "a medias" para siempre y sin nota.
    await cerrarLasQueSePasaron({ personaId: persona.id }, ahora);
    asignaciones = await asignacionesDe(persona.id);
  }

  if (!persona) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
        <h1 className="text-3xl font-extrabold">HispaProfe</h1>
        <p>
          <Link href="/entrar" className="text-hp-600 underline">
            Entrar
          </Link>
        </p>
      </main>
    );
  }

  // Aquí solo llega un estudiante: el profesor ya redirigió arriba.
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPagina titulo={`Hola, ${persona.nombre}`} subtitulo="¿Qué tienes que hacer hoy?" />
      {asignaciones.length === 0 ? (
        <BloqueVacio titulo="No tienes nada pendiente" texto="Cuando el profesor te asigne un examen, aparecerá aquí." />
      ) : (
        <ul className="flex flex-col gap-4">
          {asignaciones.map((a) => (
            <Tarjeta as="li" key={a.examenId}>
              <h2 className="text-xl font-bold">{a.titulo}</h2>
              <p className="text-tinta-suave">{NOMBRE_DE_NIVEL[a.nivel]}</p>
              {estaFueraDePlazo(a.fechaTope, ahora) ? (
                <div className="mt-2">
                  <EtiquetaEstado tono="aviso">{`Se pasó el plazo el ${fechaEnPalabras(a.fechaTope)}.`}</EtiquetaEstado>
                </div>
              ) : (
                <p>{`Para el ${fechaEnPalabras(a.fechaTope)}.`}</p>
              )}
              <ul className="mt-3 flex flex-col gap-3 border-t border-tinta-suave/10 pt-3">
                {PRUEBAS_QUE_SE_HACEN.map((prueba) => {
                  const deLaPrueba = a.pruebas.find((p) => p.prueba === prueba);
                  return (
                    <li key={prueba} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{NOMBRE_CORTO[prueba]}</span>
                        {deLaPrueba && <EtiquetaEstado tono={tonoDelEstado(deLaPrueba)}>{deLaPrueba.texto}</EtiquetaEstado>}
                      </span>
                      {/* Enlace y no botón: solo lleva a la pantalla; Next precarga los enlaces. */}
                      <Enlace href={`/examen/${a.examenId}/${prueba}`} comoBoton={varianteDelBoton(deLaPrueba)}>
                        {textoDelBoton(deLaPrueba)}
                      </Enlace>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          ))}
        </ul>
      )}
    </main>
  );
}
