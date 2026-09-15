import { enlaceDeLectura } from "@/lib/ficheros/vercel";
import type { Hoja, TipoDeHoja } from "./encargo";

const TIPOS: readonly TipoDeHoja[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** La hoja la descarga el servidor con un enlace firmado: el navegador no manda ninguna imagen. */
export async function descargarHoja(ruta: string, tipoMime: string, llamar: typeof fetch = fetch): Promise<Hoja> {
  const tipo = TIPOS.find((t) => t === tipoMime);
  if (!tipo) throw new Error(`Tipo de hoja no admitido: ${tipoMime}`);
  const url = await enlaceDeLectura(ruta, new Date());
  const r = await llamar(url);
  if (!r.ok) throw new Error(`El almacén respondió ${r.status}`);
  return { datos: Buffer.from(await r.arrayBuffer()).toString("base64"), tipo };
}
