// Solo navegador: usa canvas y Web Audio. Nunca se importa desde el servidor.

const LADO_MAXIMO = 1600;
/** La onda no necesita más: 8.000 muestras por segundo en un canal. */
export const FRECUENCIA_DE_ONDA = 8000;

/** Una foto, a JPEG al 0,85 con el lado largo en 1600 px como mucho. */
export async function reducirFoto(fichero: File): Promise<File> {
  let mapa: ImageBitmap;
  try {
    mapa = await createImageBitmap(fichero);
  } catch {
    throw new Error("Este navegador no puede abrir esa foto. Pásala a JPG o PNG.");
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext("2d")!.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();
  const blob = await new Promise<Blob>((listo, fallo) =>
    lienzo.toBlob((b) => (b ? listo(b) : fallo(new Error("No se pudo preparar la foto."))), "image/jpeg", 0.85),
  );
  return new File([blob], `${fichero.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

/**
 * La pista descodificada a un canal y 8.000 muestras por segundo: una de 11
 * minutos ocupa unos 45 MB y no los ~250 MB de descodificarla a 44,1 kHz.
 * decodeAudioData remuestrea a la frecuencia del contexto.
 */
export async function muestrasDeAudio(datos: ArrayBuffer): Promise<{ muestras: Float32Array; frecuencia: number; duracion: number }> {
  const contexto = new OfflineAudioContext(1, 1, FRECUENCIA_DE_ONDA);
  const pista = await contexto.decodeAudioData(datos);
  return { muestras: pista.getChannelData(0), frecuencia: pista.sampleRate, duracion: pista.duration };
}
