import { notFound } from "next/navigation";
import { exigirPersona } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { cerrarLasQueSePasaron, resolverLasSalidas } from "@/lib/examen/hacer";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";
import { HacerPrueba } from "@/components/examen/hacer-prueba";

export default async function PantallaDelExamen({
  params,
}: {
  params: Promise<{ id: string; prueba: string }>;
}) {
  const persona = await exigirPersona();
  const { id, prueba } = await params;
  if (!esPrueba(prueba)) notFound();
  // Se escribe ANTES de leer, y en este orden:
  //
  // 1. Se cierran las que se pasaron de hora: si no, quien cerró el portátil
  //    vería «a medias» para siempre y no tendría nota nunca.
  // 2. Se resuelven las salidas pendientes. Cargar esta pantalla YA es volver:
  //    por eso la marca vive en el servidor y no en el navegador — cerrar la
  //    pestaña y volver a entrar no salva el texto, pasa por aquí igual.
  //
  // El reloj ANTES que la salida, y no al revés: si se le acabó el tiempo
  // estando fuera, la prueba se entrega con lo que tuviera y ya no se le borra
  // nada (`resolverLasSalidas` solo mira los intentos sin entregar). Lo
  // entregado es lo que el profesor tiene que corregir. Es además el mismo orden
  // que sigue `volverALaEscrita`, donde la guarda del reloj corre primero: los
  // dos caminos de vuelta tienen que acabar igual, o el que menos borrara sería
  // el atajo. Lo que NO se le devuelve es el tiempo: el reloj no se para.
  await cerrarLasQueSePasaron({ personaId: persona.id }, new Date());
  await resolverLasSalidas({ personaId: persona.id }, new Date());
  const leida = await pruebaParaHacer(id, prueba, persona.id, new Date());
  if (!leida) notFound();
  return <HacerPrueba prueba={leida} />;
}
