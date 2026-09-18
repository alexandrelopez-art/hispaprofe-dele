"use client";

import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";

export default function ErrorDelInicio({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Aviso tono="error" titulo="No hemos podido cargar tu inicio">
        Comprueba tu conexión e inténtalo otra vez.
      </Aviso>
      <div>
        <Boton onClick={() => reset()}>Reintentar</Boton>
      </div>
    </main>
  );
}
