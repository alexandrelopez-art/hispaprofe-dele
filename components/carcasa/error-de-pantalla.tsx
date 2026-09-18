"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";

/** El error de una pantalla del sitio. `reset()` solo repinta con los datos que
 *  ya fallaron: sin `router.refresh()` delante, «Reintentar» no reintenta nada. */
export function ErrorDePantalla({ titulo, reset }: { titulo: string; reset: () => void }) {
  const router = useRouter();
  const reintentar = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Aviso tono="error" titulo={titulo}>
        Comprueba tu conexión e inténtalo otra vez.
      </Aviso>
      <div>
        <Boton onClick={reintentar}>Reintentar</Boton>
      </div>
    </main>
  );
}
