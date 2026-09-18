"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";

export default function ErrorDelInicio({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // `reset()` solo repinta con los datos del servidor que ya fallaron: sin
  // `router.refresh()` delante, «Reintentar» no vuelve a pedir nada. Los dos
  // en la misma transición, para que el repintado espere a los datos nuevos.
  // startTransition suelto (no useTransition): no hace falta el «pendiente».
  const reintentar = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Aviso tono="error" titulo="No hemos podido cargar tu inicio">
        Comprueba tu conexión e inténtalo otra vez.
      </Aviso>
      <div>
        <Boton onClick={reintentar}>Reintentar</Boton>
      </div>
    </main>
  );
}
