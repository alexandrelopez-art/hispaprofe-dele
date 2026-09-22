export default function CargandoEstudiantes() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando los estudiantes">
      <div className="h-14 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-14 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-14 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
    </main>
  );
}
