import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { abrirSesionDeSubida } from "@/lib/ficheros/drive";
import { nombreSaneado } from "@/lib/ficheros/nombres";
import { direccionDelSitio } from "@/lib/puerta/sitio";

const MAX_BYTES = 500 * 1024 * 1024;

// tipoMime SÍ puede llegar vacío: es lo que manda el propio navegador cuando
// no sabe decir el tipo de la grabación. No se rechaza junto con "falta el
// campo" (z.string().min(1) caía en el 400 genérico de abajo, que no
// explica nada); se comprueba aparte, con un mensaje propio.
const cuerpo = z.object({
  nombre: z.string().min(1).max(255),
  tipoMime: z.string(),
  bytes: z.number().int().positive(),
});

/** Solo audio o vídeo: es una grabación del estudiante, nada de páginas ni de audios del examen. */
function tipoPermitido(tipoMime: string): boolean {
  return tipoMime.startsWith("audio/") || tipoMime.startsWith("video/");
}

/**
 * Abre una sesión de subida directa a la unidad compartida de Drive. Esta es
 * una ruta de DATOS, no una pantalla: si no hay sesión responde 401; nunca
 * redirige, porque quien llama espera JSON.
 *
 * Aquí sube quien graba, sea estudiante o profesor (el profesor también
 * graba ejemplos): cualquier persona con sesión puede pedir una dirección,
 * sin restricción de papel. Lo único que se devuelve es esa dirección
 * (`url`): quien sube nunca recibe el identificador de la carpeta ni ninguna
 * credencial, ni siquiera dentro de la propia dirección de sesión (esa forma
 * la decide Google, no nosotros).
 */
export async function POST(request: NextRequest) {
  const persona = await personaDeLaPeticion();
  if (!persona) {
    return NextResponse.json({ error: "Hay que entrar." }, { status: 401 });
  }

  const cuerpoRecibido = await request.json().catch(() => null);
  const datos = cuerpo.safeParse(cuerpoRecibido);
  if (!datos.success) {
    return NextResponse.json({ error: "Datos de la petición incompletos o inválidos." }, { status: 400 });
  }
  const { nombre, tipoMime, bytes } = datos.data;

  // bytes y tipoMime aquí son lo que DICE el navegador: solo sirven para
  // decidir si se abre la sesión. Lo que se guarda de verdad en la base sale
  // de lo que confirma Drive, en guardarGrabacion.
  if (tipoMime === "") {
    return NextResponse.json(
      { error: "El navegador no ha sabido decir qué tipo de grabación es. Prueba a grabar de nuevo." },
      { status: 400 },
    );
  }
  if (!tipoPermitido(tipoMime)) {
    return NextResponse.json({ error: "Solo se admiten grabaciones de audio o vídeo." }, { status: 400 });
  }
  if (bytes > MAX_BYTES) {
    return NextResponse.json({ error: "La grabación pesa más de 500 MB." }, { status: 400 });
  }

  // El nombre que pone quien sube llega hasta el campo `name` del fichero en
  // Drive, que ve el profesor al mirar la carpeta: sin sanear, un estudiante
  // podría llamar a su vídeo como el de otro (o colar algo raro). Se limpia
  // y se le pega un sufijo aleatorio, igual que rutaDelFichero en el almacén
  // de Vercel; el nombre tal como lo escribió quien sube se guarda aparte,
  // en nombreOriginal, cuando se confirma la fila (guardarGrabacion).
  const nombreParaDrive = nombreSaneado(nombre, randomBytes(6).toString("hex"));

  let url: string;
  try {
    url = await abrirSesionDeSubida({
      nombre: nombreParaDrive,
      tipoMime,
      origen: direccionDelSitio(request.headers),
    });
  } catch (error) {
    // El mensaje de la excepción NUNCA se manda al navegador: dentro de
    // abrirSesionDeSubida se interpreta el JSON de la cuenta robot
    // (GOOGLE_CUENTA_DE_SERVICIO), y si ese JSON viene mal pegado, el
    // mensaje del error de análisis puede incluir un trozo del texto de
    // entrada — es decir, de la credencial. Eso no puede llegar a cualquiera
    // con sesión, ni siquiera a un estudiante. El detalle queda solo en el
    // registro del servidor.
    console.error("No se pudo abrir la sesión de subida en Drive", error);
    return NextResponse.json(
      { error: "No se pudo abrir la sesión de subida. Avisa al profesor." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url });
}
