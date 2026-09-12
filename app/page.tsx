import Link from "next/link";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";

// Sin diseño: es para poder comprobar que entrar funcionó, no la portada de
// verdad. Antes de esto la portada era idéntica antes y después de pulsar el
// enlace, así que quien entraba no tenía forma de saber si había servido de
// algo.
export default async function Portada() {
  const persona = await personaDeLaPeticion();

  return (
    <main className="p-8">
      <h1 className="text-3xl font-extrabold">HispaProfe</h1>
      {persona ? (
        <div className="mt-6 flex flex-col gap-2">
          <p>
            Hola, {persona.nombre}.
          </p>
          <nav className="flex flex-col gap-1">
            {persona.papel === "PROFESOR" && <Link href="/personas">Personas</Link>}
            <Link href="/pruebas/grabar">Prueba: grabar</Link>
            <Link href="/pruebas/subir">Prueba: subir</Link>
            <form action="/salir" method="post">
              <button type="submit" className="underline">
                Salir
              </button>
            </form>
          </nav>
        </div>
      ) : (
        <p className="mt-6">
          <Link href="/entrar">Entrar</Link>
        </p>
      )}
    </main>
  );
}
