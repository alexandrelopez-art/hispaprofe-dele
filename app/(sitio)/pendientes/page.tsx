import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { colaPorCorregir } from "@/lib/carcasa/pendientes";
import { RefrescarAlEntrar } from "@/components/carcasa/refrescar-al-entrar";
import { fechaHoraEnPalabras } from "@/lib/tiempo/madrid";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Tarjeta } from "@/components/ui/tarjeta";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Enlace } from "@/components/ui/enlace";
import { BloqueVacio } from "@/components/ui/bloque-vacio";

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
  // La misma consulta que ya hizo la cabecera para el número (cache()).
  const cola = await colaPorCorregir();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <RefrescarAlEntrar />
      <EncabezadoPagina titulo="Pendientes" subtitulo="Redacciones entregadas que esperan tu nota, la más antigua primero." />
      {cola.length === 0 ? (
        <BloqueVacio titulo="No hay redacciones por corregir" texto="Cuando un estudiante entregue una, aparecerá aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {cola.map((c) => (
            <Tarjeta as="li" key={c.intentoId} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{c.persona.nombre}</span>
                  <EtiquetaEstado tono="info">Redacción</EtiquetaEstado>
                </span>
                <span className="text-tinta-suave">{c.titulo}</span>
                <span className="text-sm text-tinta-suave">
                  Entregada el {fechaHoraEnPalabras(c.entregadaEn)}
                  {c.porTiempo ? " · por tiempo" : ""} · {diasEnPalabras(c.diasEsperando)}
                </span>
              </div>
              <Enlace href={`/pendientes/${c.intentoId}`} comoBoton="principal">
                Corregir
              </Enlace>
            </Tarjeta>
          ))}
        </ul>
      )}
    </main>
  );
}
