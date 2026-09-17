// Salirse de la pantalla a media redacción, contra Postgres de verdad.
//
// La regla del profesor, en dos decisiones: se borra lo escrito, y se le avisa
// antes de empezar; y se borra la tarea entera, pero solo si tarda más de diez
// segundos en volver. Lo demás son decisiones de diseño: solo en modo COMPLETO,
// la salida se apunta en el SERVIDOR, el reloj no se para, y solo se borra la
// tarea que tenía abierta.
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";
import {
  empezarPrueba,
  entregarPrueba,
  guardarEscrito,
  resolverLasSalidas,
  salirDeLaEscrita,
  volverALaEscrita,
} from "@/lib/examen/hacer";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";

const AHORA = new Date("2026-09-20T09:00:00Z");
const enSegundos = (n: number) => new Date(AHORA.getTime() + n * 1000);

let ana: Persona;
let luis: Persona;
let examen: Examen;
let asignacion: Asignacion;

beforeEach(async () => {
  ({ ana, luis, examen } = await crearExamenDePruebas());
  asignacion = await prisma.asignacion.findFirstOrThrow();
});

/** La escrita empezada y con las dos tareas escritas: es lo que hay que perder. */
async function conLasDosTareasEscritas(): Promise<void> {
  expect(await empezarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
  expect(await guardarEscrito(examen.id, ana.id, 1, "Mi carta para el sábado", null, AHORA)).toEqual({});
  expect(await guardarEscrito(examen.id, ana.id, 2, "Mi día en el instituto", 1, AHORA)).toEqual({});
}

const textoDe = async (tarea: number): Promise<string | null> =>
  (await prisma.escritoDeIntento.findFirst({ where: { tarea } }))?.texto ?? null;

const marcas = async () => {
  const i = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
  return { salioEn: i.salioEn, salioDeTarea: i.salioDeTarea };
};

describe("salirse y volver enseguida", () => {
  // Mutación que la mata: borrar siempre que haya marca, sin mirar cuánto rato
  // estuvo fuera (quitar `tardoEnVolver` de `resolverUnaSalida`). Una
  // notificación, o mirar la hora, le costarían el folio: es exactamente lo que
  // el profesor decidió que NO pasara.
  it("a los cinco segundos no se borra nada, y las marcas quedan limpias", async () => {
    await conLasDosTareasEscritas();
    expect(await salirDeLaEscrita(examen.id, ana.id, 1, AHORA)).toEqual({});
    expect((await marcas()).salioEn).toEqual(AHORA);

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(5))).toEqual({ borrada: null });

    expect(await textoDe(1)).toBe("Mi carta para el sábado");
    expect(await textoDe(2)).toBe("Mi día en el instituto");
    // Y las marcas se limpian igual: son marcas vivas, no un historial. Sin
    // esto, la siguiente vuelta contaría desde esta salida y borraría de más.
    expect(await marcas()).toEqual({ salioEn: null, salioDeTarea: null });
  });

  // Mutación que la mata: comparar con `>=` en vez de `>` en `tardoEnVolver`.
  // Los diez segundos exactos todavía son «volver enseguida», igual que en
  // `seAcaboElTiempo` el segundo exacto del tope todavía es tiempo.
  it("los diez segundos justos todavía se perdonan", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(10))).toEqual({ borrada: null });
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
  });
});

describe("salirse y tardar en volver", () => {
  // Mutación que la mata: borrar los escritos del intento entero
  // (`deleteMany({ where: { intentoId } })`, sin la tarea) o borrar la tarea
  // abierta AHORA en vez de la que tenía abierta al irse. Se pierde la tarea
  // que estaba escribiendo, no las dos: la otra no la ha abandonado.
  it("a los treinta segundos se borra la tarea que tenía abierta, y solo esa", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(30))).toEqual({ borrada: 1 });

    expect(await textoDe(1)).toBeNull();
    expect(await textoDe(2)).toBe("Mi día en el instituto");
    expect(await marcas()).toEqual({ salioEn: null, salioDeTarea: null });
  });

  // Mutación que la mata: borrar solo el texto y dejar la fila con su `opcion`
  // puesta. La decisión es que se pierde «la tarea entera»: en la tarea 2 eso
  // incluye el tema elegido, que es la mitad del trabajo.
  it("de la tarea 2 se lleva también la opción elegida", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 2, AHORA);

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(30))).toEqual({ borrada: 2 });

    expect(await prisma.escritoDeIntento.findFirst({ where: { tarea: 2 } })).toBeNull();
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
  });

  // Mutación que la mata: quitar `salioEn: null` del `where` de
  // `salirDeLaEscrita`, de forma que la segunda salida pise la hora de la
  // primera. Bastaría con asomarse a la pantalla un instante cada diez segundos
  // —sin llegar a volver de verdad— para no perder nunca nada.
  it("la cuenta va desde la PRIMERA salida, y guarda la primera tarea", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    // Vuelve a «salir» ocho segundos después, y desde la otra tarea: ni la hora
    // ni la tarea se pisan.
    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(8));
    expect(await marcas()).toEqual({ salioEn: AHORA, salioDeTarea: 1 });

    // Doce segundos desde la primera salida: tarde.
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(12))).toEqual({ borrada: 1 });
    expect(await textoDe(1)).toBeNull();
    expect(await textoDe(2)).toBe("Mi día en el instituto");
  });

  // Mutación que la mata: no limpiar las marcas al resolver (quitar el
  // `updateMany` final de `resolverUnaSalida`). La segunda llamada volvería a
  // ver la misma salida vieja y borraría la tarea recién reescrita: el chaval no
  // podría terminar el examen nunca.
  it("resolver dos veces no borra dos veces: es idempotente", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(30))).toEqual({ borrada: 1 });

    // Vuelve a escribirla, y mira la pantalla otra vez sin haberse ido.
    await guardarEscrito(examen.id, ana.id, 1, "La escribo otra vez", null, enSegundos(40));
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(50))).toEqual({ borrada: null });
    expect(await resolverLasSalidas({ personaId: ana.id }, enSegundos(60))).toEqual({ borradas: [] });
    expect(await textoDe(1)).toBe("La escribo otra vez");
  });
});

describe("cerrar la pestaña no salva el texto", () => {
  // LA prueba de que la marca vive en el servidor. El navegador nunca avisa de
  // que ha vuelto: se cierra la pestaña y se entra de nuevo por la dirección,
  // que es lo que hace `resolverLasSalidas` desde la página.
  //
  // Mutación que la mata: apuntar la salida solo en el navegador —o quitar la
  // llamada al resolvedor de `app/examen/[id]/[prueba]/page.tsx`—. Cerrar la
  // pestaña y volver a entrar sería el agujero obvio, y a un chaval de catorce
  // años ese truco le dura media tarde.
  it("la página resuelve la salida al cargar, sin que nadie avise de la vuelta", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);

    const r = await resolverLasSalidas({ personaId: ana.id }, enSegundos(30));

    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(r.borradas).toEqual([{ intentoId: intento.id, tarea: 1 }]);
    expect(await textoDe(1)).toBeNull();
    expect(await textoDe(2)).toBe("Mi día en el instituto");
  });

  // Mutación que la mata: buscar las salidas por `examenId` cuando piden
  // `personaId` (o al revés). El resolvedor de la página corre sobre la persona
  // que mira; el de una pantalla del profesor, sobre el examen entero.
  it("por examen encuentra la misma salida", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 2, AHORA);
    expect((await resolverLasSalidas({ examenId: examen.id }, enSegundos(30))).borradas).toHaveLength(1);
    expect(await prisma.escritoDeIntento.findFirst({ where: { tarea: 2 } })).toBeNull();
  });
});

describe("el reloj no se para mientras está fuera", () => {
  // Mutación que la mata: parar el reloj al salir (por ejemplo, empujando
  // `empezadaEn` hacia delante los segundos que estuvo fuera, que es «lo
  // amable»). Salirse saldría gratis en tiempo, y entonces salirse a buscar la
  // respuesta solo costaría un folio que se puede volver a escribir con calma.
  it("los segundos que quedan bajan igual, estuviera fuera o no", async () => {
    await conLasDosTareasEscritas();
    const alEmpezar = (await pruebaParaHacer(examen.id, "EE", ana.id, AHORA))!.segundosQueQuedan!;

    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(30));

    const alVolver = (await pruebaParaHacer(examen.id, "EE", ana.id, enSegundos(30)))!.segundosQueQuedan!;
    expect(alVolver).toBe(alEmpezar - 30);
    // Y `empezadaEn` sigue donde estaba: nadie ha tocado el reloj.
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.empezadaEn).toEqual(AHORA);
  });
});

describe("en práctica libre no se marca ni se borra nada", () => {
  beforeEach(async () => {
    await prisma.asignacion.update({ where: { id: asignacion.id }, data: { modo: "LIBRE" } });
  });

  // Mutación que la mata: quitar el `if (abierta.minutos === null) return {}` de
  // `salirDeLaEscrita` (o el de `volverALaEscrita`). En práctica libre se
  // practica: no hay reloj, no hay examen y no hay nada que castigar. Mira las
  // DOS cosas —que no marca y que no borra— porque cada guarda tapa una.
  it("sale, vuelve a los treinta y sigue todo donde estaba", async () => {
    await conLasDosTareasEscritas();

    expect(await salirDeLaEscrita(examen.id, ana.id, 1, AHORA)).toEqual({});
    expect(await marcas()).toEqual({ salioEn: null, salioDeTarea: null });

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(30))).toEqual({ borrada: null });
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
    expect(await textoDe(2)).toBe("Mi día en el instituto");
  });
});

describe("una marca vieja de cuando era un examen de verdad", () => {
  // La regla «solo en modo COMPLETO» se escribe una sola vez, en el `where` del
  // resolvedor, y no solo en la puerta de salir. Este es el caso que lo obliga:
  // la marca se puso con el examen en COMPLETO y el modo cambió después.
  //
  // Mutación que la mata: quitar `modo: "COMPLETO"` del `where` de
  // `resolverLasSalidas`. En práctica libre se practica, y borrarle el folio a
  // quien practica no es la regla de nadie.
  it("si el examen pasó a libre, ya no se borra nada", async () => {
    expect(await empezarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
    await guardarEscrito(examen.id, ana.id, 1, "Mi carta para el sábado", null, AHORA);
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    expect((await marcas()).salioEn).toEqual(AHORA);

    await prisma.asignacion.update({ where: { id: asignacion.id }, data: { modo: "LIBRE" } });

    expect(await resolverLasSalidas({ personaId: ana.id }, enSegundos(30))).toEqual({ borradas: [] });
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(30))).toEqual({ borrada: null });
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
  });
});

describe("con la prueba ya entregada", () => {
  // Mutación que la mata: llamar a `abrirLaPrueba` con `exigirEmpezada: false`,
  // o quitarle la comprobación de `entregadaEn`. Lo que ya mandó no se toca
  // nunca: es lo que el profesor va a corregir.
  it("salir no marca y volver no borra", async () => {
    await conLasDosTareasEscritas();
    expect(await entregarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});

    expect(await salirDeLaEscrita(examen.id, ana.id, 1, AHORA)).toEqual({ error: "Esta prueba ya está entregada." });
    expect(await marcas()).toEqual({ salioEn: null, salioDeTarea: null });

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(30))).toEqual({ error: "Esta prueba ya está entregada." });
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
    expect(await textoDe(2)).toBe("Mi día en el instituto");
  });

  // Mutación que la mata: quitar `entregadaEn: null` del `where` de
  // `resolverLasSalidas`. Una escrita que el reloj cerró mientras el chaval
  // estaba fuera se quedaría con la marca puesta, y la siguiente pantalla que
  // mirara le vaciaría una tarea YA ENTREGADA — la que el profesor tiene que
  // corregir.
  it("el resolvedor no toca una escrita que ya se entregó con la marca puesta", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await prisma.intento.updateMany({ where: { prueba: "EE" }, data: { entregadaEn: enSegundos(20), porTiempo: true } });

    expect(await resolverLasSalidas({ personaId: ana.id }, enSegundos(30))).toEqual({ borradas: [] });
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
  });

  // El caso de verdad del párrafo de arriba: se va, y estando fuera se le acaba
  // el tiempo. El reloj la entrega con lo que tuviera —no se para por estar
  // fuera—, y a partir de ahí no se le borra nada: eso es lo que el profesor
  // tiene que corregir. Los dos caminos de vuelta tienen que decir lo mismo.
  //
  // Mutación que la mata: resolver la salida ANTES de cerrar por tiempo (en la
  // página, o quitando la guarda del reloj de `volverALaEscrita`). El chaval
  // llegaría a la cola del profesor con una tarea vacía.
  it("si se le acaba el tiempo estando fuera, entrega lo que tenía y no se borra", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);

    // 50 minutos y diez segundos de gracia: a los 51 minutos ya se acabó.
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    expect(await volverALaEscrita(examen.id, ana.id, tarde)).toEqual({ error: "Se acabó el tiempo." });
    await resolverLasSalidas({ personaId: ana.id }, tarde);

    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.porTiempo).toBe(true);
    expect(await textoDe(1)).toBe("Mi carta para el sábado");
    expect(await textoDe(2)).toBe("Mi día en el instituto");
  });
});

describe("las guardas de siempre", () => {
  // Mutación que la mata: quitar CUALQUIERA de las comprobaciones de
  // `abrirLaPrueba` en las dos funciones nuevas. Son una dirección pública: sin
  // ellas, cualquiera marca salidas en el examen de otro, o en uno que no ha
  // empezado, y le borra el folio al volver.
  it("sin empezar y con un examen que no es suyo, rebotan las dos", async () => {
    expect(await salirDeLaEscrita(examen.id, ana.id, 1, AHORA)).toEqual({ error: "Todavía no has empezado esta prueba." });
    expect(await volverALaEscrita(examen.id, ana.id, AHORA)).toEqual({ error: "Todavía no has empezado esta prueba." });

    await conLasDosTareasEscritas();
    expect(await salirDeLaEscrita(examen.id, luis.id, 1, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    expect(await volverALaEscrita(examen.id, luis.id, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    expect(await marcas()).toEqual({ salioEn: null, salioDeTarea: null });
  });

  // Mutación que la mata: no comprobar la tarea contra las que tiene esta
  // escrita. Una dirección pública puede mandar la tarea 7, y entonces la marca
  // quedaría puesta apuntando a una tarea que no existe: al volver no borraría
  // nada, pero tampoco habría forma de que el castigo cayera nunca.
  it("una tarea que esta escrita no tiene rebota, y no deja marca", async () => {
    await conLasDosTareasEscritas();
    expect(await salirDeLaEscrita(examen.id, ana.id, 7, AHORA)).toEqual({ error: "Esa tarea no existe." });
    expect(await marcas()).toEqual({ salioEn: null, salioDeTarea: null });
  });
});
