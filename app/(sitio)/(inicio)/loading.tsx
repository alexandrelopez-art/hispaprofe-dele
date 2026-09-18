/** Un esqueleto mientras llegan los exámenes: dos tarjetas grises. Solo cubre
 *  el Inicio (está en su propio grupo), no las demás pantallas. */
export default function Cargando() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando tu inicio">
      <div className="h-8 w-48 animate-pulse rounded-2xl bg-hp-100" />
      <div className="h-40 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-40 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
    </main>
  );
}
