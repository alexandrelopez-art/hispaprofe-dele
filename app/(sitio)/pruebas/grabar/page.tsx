import { exigirPersona } from "@/lib/puerta/sesion-http";
import { FormularioDeGrabacion } from "./formulario";

export default async function PruebaDeGrabacion() {
  await exigirPersona();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6">
      <p className="rounded-2xl bg-hp-50 p-4 font-bold text-tinta">
        Pantalla de comprobación. Se tira cuando llegue el taller.
      </p>
      <h1 className="text-2xl font-bold text-tinta">Grabar y subir a la unidad compartida</h1>
      <FormularioDeGrabacion />
    </main>
  );
}
