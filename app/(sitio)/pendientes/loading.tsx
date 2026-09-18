export default function CargandoPendientes() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando Pendientes">
      <div className="h-8 w-48 animate-pulse rounded-2xl bg-hp-100" />
      <div className="h-24 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-24 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
    </main>
  );
}
