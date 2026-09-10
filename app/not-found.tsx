import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-bold text-tinta">Esta página no existe</h1>
      <p className="text-tinta-suave">Comprueba la dirección, o vuelve al principio.</p>
      <Link href="/" className="font-bold text-hp-600">
        Ir a la portada
      </Link>
    </main>
  );
}
