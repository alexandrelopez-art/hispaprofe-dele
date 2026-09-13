// Solo navegador: usa document y canvas. Nunca se importa desde el servidor.
import { trozosDeDocumento, type Trozo } from "./trozos";

async function abrir(fichero: File) {
  const pdfjs = await import("pdfjs-dist");
  // No `new URL(..., import.meta.url)`: Turbopack no sabe externalizar el
  // paquete. El worker lo copia a public/ el postinstall.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ data: await fichero.arrayBuffer() }).promise;
}

/** Un PDF, a una imagen JPEG por hoja (escala 2, calidad 0,85). */
export async function paginasDePdf(fichero: File): Promise<File[]> {
  const doc = await abrir(fichero);
  const base = fichero.name.replace(/\.pdf$/i, "");
  const salida: File[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 2 });
    const lienzo = document.createElement("canvas");
    lienzo.width = vista.width;
    lienzo.height = vista.height;
    await pagina.render({ canvasContext: lienzo.getContext("2d")!, viewport: vista, canvas: lienzo }).promise;
    const blob = await new Promise<Blob>((listo, fallo) =>
      lienzo.toBlob((b) => (b ? listo(b) : fallo(new Error(`No se pudo convertir la hoja ${n}.`))), "image/jpeg", 0.85),
    );
    salida.push(new File([blob], `${base}-${String(n).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
  }
  return salida;
}

/** Los trozos de texto del PDF con su posición. El PDF no sale del navegador. */
export async function trozosDePdf(fichero: File): Promise<Trozo[]> {
  return trozosDeDocumento(await abrir(fichero));
}
