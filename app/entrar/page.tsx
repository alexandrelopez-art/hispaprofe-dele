import { pedirEntrada } from "./acciones";
import { Aviso } from "@/components/ui/aviso";
import { Campo } from "@/components/ui/campo";
import { Boton } from "@/components/ui/boton";

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
  const aviso = fallo && Object.hasOwn(AVISOS, fallo) ? AVISOS[fallo] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-tinta">Entrar en HispaProfe</h1>
      <p className="text-tinta-suave">
        Escribe tu correo y te mandamos un enlace para entrar. No hace falta contraseña.
      </p>
      {aviso && <Aviso tono="info">{aviso}</Aviso>}
      <form action={pedirEntrada} className="flex flex-col gap-4">
        <Campo
          id="correo"
          etiqueta="Tu correo"
          type="email"
          name="correo"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
        />
        <Boton type="submit">Mandarme el enlace</Boton>
      </form>
    </main>
  );
}
