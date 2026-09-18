/** Un esqueleto mientras llegan los exámenes: dos tarjetas grises. Solo cubre
 *  el Inicio del estudiante (page.tsx lo envuelve con Suspense), no las demás
 *  pantallas. Antes vivía en loading.tsx, que cubre la ruta entera y sale
 *  antes de saber el papel: el profesor lo veía un instante antes de la
 *  redirección a Pendientes. */
export function EsqueletoDelInicio() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando tu inicio">
      <div className="h-8 w-48 animate-pulse rounded-2xl bg-hp-100" />
      <div className="h-40 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-40 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
    </main>
  );
}
