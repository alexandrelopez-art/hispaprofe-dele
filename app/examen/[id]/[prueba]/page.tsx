import { notFound } from "next/navigation";
import { exigirPersona } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { cerrarLasQueSePasaron, registrarLasVueltas } from "@/lib/examen/hacer";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";
import { estaEntregada } from "@/lib/examen/motor";
import { usaCabeceraDelExamen } from "@/lib/carcasa/menu";
import { Cabecera } from "@/components/carcasa/cabecera";
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
  // 2. Se cierra la ausencia que hubiera abierta. Cargar esta pantalla YA es
  //    volver: por eso el rastro vive en el servidor y no en el navegador —
  //    cerrar la pestaña no lo borra, pasa por aquí igual.
  //
  // El reloj antes que la vuelta, y no al revés: si se le acabó el tiempo
  // estando fuera, el cierre por reloj SÍ cuenta la ausencia —topada hasta el
  // fin de la prueba, nunca hasta `ahora` (`ausenciaSinVuelta` en hacer.ts)—, y
  // ese orden es lo único que lo permite. Si `registrarLasVueltas` corriera
  // primero, «cargar la pantalla YA es la vuelta» cerraría la ausencia con la
  // fecha de HOY, y quien mira el examen tres días después de que el reloj lo
  // cerrara le contaría al profesor «volvió a los tres días» en vez de topar en
  // el minuto cincuenta.
  //
  // Acotado a ESTE examen: entrar en la lectura del examen B no puede cerrar una
  // ausencia de la escrita del examen A, que sigue abierta en otra pestaña.
  await cerrarLasQueSePasaron({ personaId: persona.id }, new Date());
  await registrarLasVueltas({ personaId: persona.id, examenId: id }, new Date());
  const leida = await pruebaParaHacer(id, prueba, persona.id, new Date());
  if (!leida) notFound();
  // Entregada, lo que se ve es un resultado: vuelve la cabecera del sitio.
  // Sin entregar, cada cara pinta la del examen (components/carcasa/cabecera-examen.tsx).
  // Se espera aquí como función y no como <Cabecera> porque es asíncrona (lee
  // los Pendientes del profesor): así la página entrega el árbol ya resuelto,
  // igual en Next que en las pruebas, que la pintan con renderToStaticMarkup.
  const conLaDelSitio = !usaCabeceraDelExamen(estaEntregada(leida.estado));
  const cabecera = conLaDelSitio ? await Cabecera({ persona }) : null;
  return (
    <>
      {cabecera}
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <HacerPrueba prueba={leida} />
      </main>
    </>
  );
}
