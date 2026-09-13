export type Trozo = { pagina: number; x: number; y: number; texto: string; anchoPagina: number };

/**
 * Lo mínimo de un documento de pdf.js. Así la misma función sirve en el
 * navegador (pdfjs-dist) y en la prueba de Node (pdfjs-dist/legacy).
 */
export type DocumentoPdf = {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(opciones: { scale: number }): { width: number };
    getTextContent(): Promise<{ items: ReadonlyArray<unknown> }>;
  }>;
};

/** Cada trozo de texto del PDF con su página y su posición. Los vacíos no cuentan. */
export async function trozosDeDocumento(doc: DocumentoPdf): Promise<Trozo[]> {
  const trozos: Trozo[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const anchoPagina = pagina.getViewport({ scale: 1 }).width;
    const { items } = await pagina.getTextContent();
    for (const item of items) {
      if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) continue;
      const { str, transform } = item as { str: string; transform: number[] };
      if (!str.trim()) continue;
      trozos.push({ pagina: n, x: transform[4], y: transform[5], texto: str, anchoPagina });
    }
  }
  return trozos;
}
