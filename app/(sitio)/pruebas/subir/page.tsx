import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { FormularioDeSubida } from "./formulario";

export default async function PruebaDeSubida() {
  await exigirProfesor();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6">
      <p className="rounded-2xl bg-hp-50 p-4 font-bold text-tinta">
        Pantalla de comprobación. Se tira cuando llegue el taller.
      </p>
      <h1 className="text-2xl font-bold text-tinta">Subir un fichero al almacén</h1>
      <FormularioDeSubida />
    </main>
  );
}
