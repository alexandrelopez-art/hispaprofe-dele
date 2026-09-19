import { Enlace } from "@/components/ui/enlace";

export default function Enviado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-tinta">Mira tu correo</h1>
      <p className="text-tinta-suave">
        Si esa dirección está dada de alta, te hemos mandado un enlace para entrar. Vale
        quince minutos y una sola vez.
      </p>
      <Enlace href="/entrar">Pedir otro enlace</Enlace>
    </main>
  );
}
