import { pedirEntrada } from "./acciones";

const AVISOS: Record<string, string> = {
  caducado: "Ese enlace ya no vale. Pide otro y te lo mandamos.",
  usado: "Ese enlace ya se usó. Pide otro y te lo mandamos.",
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ fallo?: string }>;
}) {
  const { fallo } = await searchParams;
  const aviso = fallo ? AVISOS[fallo] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-tinta">Entrar en HispaProfe</h1>
      <p className="text-tinta-suave">
        Escribe tu correo y te mandamos un enlace para entrar. No hace falta contraseña.
      </p>
      {aviso && <p className="rounded-2xl bg-hp-50 p-4 text-tinta">{aviso}</p>}
      <form action={pedirEntrada} className="flex flex-col gap-4">
        <input
          type="email"
          name="correo"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="rounded-2xl border border-tinta-suave/30 p-4"
        />
        <button type="submit" className="rounded-2xl bg-hp-400 p-4 font-bold text-white">
          Mandarme el enlace
        </button>
      </form>
    </main>
  );
}
