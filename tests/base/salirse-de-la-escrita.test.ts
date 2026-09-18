// El registro de salidas de la escrita, contra Postgres de verdad.
//
// La regla del profesor: **no se borra nada, nunca**. Se apunta cuándo se fue,
// cuánto tardó en volver y de qué tarea estaba, y él lo ve al corregir. El
// navegador no sabe distinguir «se fue a buscar la respuesta» de «le entró una
// llamada», así que un borrado lo acabaría pagando quien no hizo nada.
//
// Y por eso mismo la exactitud del registro ES la pieza: el profesor va a hablar
// con un alumno con esto delante. Un registro que inventa minutos es peor que no
// tenerlo.
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";
import {
  cerrarLasQueSePasaron,
  empezarPrueba,
  entregarPrueba,
  guardarEscrito,
  registrarLasVueltas,
  salirDeLaEscrita,
  volverALaEscrita,
} from "@/lib/examen/hacer";
import { escritoParaCorregir } from "@/lib/examen/corregir";

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

/** La escrita empezada y con las dos tareas escritas. */
async function conLasDosTareasEscritas(): Promise<void> {
  expect(await empezarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
  expect(await guardarEscrito(examen.id, ana.id, 1, "Mi carta para el sábado", null, AHORA)).toEqual({});
  expect(await guardarEscrito(examen.id, ana.id, 2, "Mi día en el instituto", 1, AHORA)).toEqual({});
}

const intento = async () => prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });

/** Lo que el profesor acabará leyendo. */
async function registro() {
  const i = await intento();
  return {
    salidas: i.salidas,
    segundosFuera: i.segundosFuera,
    ultimaSalidaEn: i.ultimaSalidaEn,
    ultimaSalidaDeTarea: i.ultimaSalidaDeTarea,
    ultimaSalidaSinVuelta: i.ultimaSalidaSinVuelta,
  };
}

const marca = async () => {
  const i = await intento();
  return { salioEn: i.salioEn, salioDeTarea: i.salioDeTarea };
};

const textos = async () =>
  (await prisma.escritoDeIntento.findMany({ orderBy: { tarea: "asc" } })).map((e) => e.texto);

describe("no se borra nada, nunca", () => {
  // La decisión del profesor, y la prueba que la vigila: por larga que sea la
  // ausencia, el texto sigue ahí. Es LA regla de esta pieza.
  //
  // Mutación que la mata: volver a borrar o vaciar el folio al registrar la
  // vuelta (`escritoDeIntento.updateMany({ data: { texto: "" } })` en
  // `cerrarLaAusencia`). Es exactamente lo que se ha quitado, y nadie más lo
  // notaría: el registro seguiría contando bien.
  it("media hora fuera y el texto de las dos tareas sigue intacto", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(1800));

    expect(await textos()).toEqual(["Mi carta para el sábado", "Mi día en el instituto"]);
    // Y la opción elegida tampoco se toca.
    const dos = await prisma.escritoDeIntento.findFirstOrThrow({ where: { tarea: 2 } });
    expect(dos.opcion).toBe(1);
  });

  // Mutación que la mata: dejar que `salirDeLaEscrita` (o el registro de la
  // vuelta) escriba en la tabla de escritos. Ninguna de las dos la toca, y esta
  // prueba lo fija mirando la fecha de guardado: si alguien la reescribiera con
  // lo mismo, el texto seguiría igual pero `guardadoEn` se movería.
  it("registrar una salida no escribe en la tabla de escritos", async () => {
    await conLasDosTareasEscritas();
    const antes = (await prisma.escritoDeIntento.findMany({ orderBy: { tarea: "asc" } })).map((e) => e.guardadoEn);
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(300));
    const despues = (await prisma.escritoDeIntento.findMany({ orderBy: { tarea: "asc" } })).map((e) => e.guardadoEn);
    expect(despues).toEqual(antes);
  });
});

describe("lo que se apunta de una salida", () => {
  // Mutación que la mata: no sumar los segundos (dejar `segundosFuera` a cero),
  // o contar desde `ahora` en vez de desde `salioEn`. El profesor vería «salió 1
  // vez, 0 segundos», que no le dice nada: la diferencia entre asomarse cinco
  // segundos y desaparecer doce minutos es TODA la información.
  it("cuenta la salida, el tiempo fuera, la hora y la tarea", async () => {
    await conLasDosTareasEscritas();
    expect(await salirDeLaEscrita(examen.id, ana.id, 2, AHORA)).toEqual({});
    // Mientras está fuera, la marca viva dice dónde estaba.
    expect(await marca()).toEqual({ salioEn: AHORA, salioDeTarea: 2 });

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(95))).toEqual({});

    expect(await registro()).toEqual({
      salidas: 1,
      segundosFuera: 95,
      ultimaSalidaEn: AHORA,
      ultimaSalidaDeTarea: 2,
      ultimaSalidaSinVuelta: false,
    });
    // Y la marca viva queda limpia: la ausencia ya está contada.
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });
  });

  // Mutación que la mata: pisar los contadores en vez de sumarlos (`salidas: 1`
  // y `segundosFuera: segundos` en vez de `{ increment }`). Con tres salidas el
  // profesor leería «salió 1 vez, 20 segundos» y no se enteraría de nada.
  it("tres salidas se suman, y la última manda en la hora y la tarea", async () => {
    await conLasDosTareasEscritas();

    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(10));
    await volverALaEscrita(examen.id, ana.id, enSegundos(15));
    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(30));
    await volverALaEscrita(examen.id, ana.id, enSegundos(60));
    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(100));
    await volverALaEscrita(examen.id, ana.id, enSegundos(120));

    expect(await registro()).toEqual({
      salidas: 3,
      segundosFuera: 5 + 30 + 20,
      ultimaSalidaEn: enSegundos(100),
      ultimaSalidaDeTarea: 2,
      ultimaSalidaSinVuelta: false,
    });
  });

  // Mutación que la mata: quitar `salioEn: null` del `where` de
  // `salirDeLaEscrita`, de forma que la segunda salida pise la primera. La
  // ausencia empezó en la primera, y contarla desde la segunda le regalaría al
  // registro los segundos de en medio.
  it("salir dos veces sin volver es UNA ausencia, contada desde la primera", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(40));
    expect(await marca()).toEqual({ salioEn: AHORA, salioDeTarea: 1 });

    await volverALaEscrita(examen.id, ana.id, enSegundos(60));

    expect(await registro()).toEqual({
      salidas: 1,
      segundosFuera: 60,
      ultimaSalidaEn: AHORA,
      ultimaSalidaDeTarea: 1,
      ultimaSalidaSinVuelta: false,
    });
  });

  // Mutación que la mata: contar la vuelta aunque no hubiera marca (quitar el
  // `if (marca.salioEn === null) return false`). Cada carga de la pantalla
  // sumaría una salida, y el profesor vería veinte salidas de cero segundos en
  // una redacción en la que el chico no se movió.
  it("volver sin haberse ido no apunta nada, y es idempotente", async () => {
    await conLasDosTareasEscritas();
    await volverALaEscrita(examen.id, ana.id, enSegundos(10));
    expect(await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(20))).toEqual({ cerradas: 0 });
    expect(await registro()).toMatchObject({ salidas: 0, segundosFuera: 0 });

    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(30));
    await volverALaEscrita(examen.id, ana.id, enSegundos(50));
    // Y la segunda vuelta, sobre la misma ausencia ya cerrada, tampoco suma.
    await volverALaEscrita(examen.id, ana.id, enSegundos(70));
    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 20 });
  });
});

describe("la red contra una marca que llega tarde", () => {
  // EL caso que hacía mentir al registro. Las dos peticiones del navegador se
  // cruzan: «he vuelto» llega primero y «me voy» aterriza después, dejando la
  // marca puesta con el chaval delante. Veinte minutos más tarde, cualquier
  // carga de página la cerraría como una ausencia de veinte minutos que nunca
  // ocurrió.
  //
  // Mutación que la mata: quitar la comprobación `salioEn <= volvioEn` de
  // `cerrarLaAusencia`. El profesor leería «estuvo fuera 20 minutos» de un chico
  // que no se movió de la silla.
  it("una salida anterior a la última vuelta se limpia y no suma", async () => {
    await conLasDosTareasEscritas();

    // Se va y vuelve enseguida: ausencia normal, contada.
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(2));
    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 2 });

    // Y AHORA aterriza el «me voy» que se había quedado en el aire, con la fecha
    // de cuando se ocultó la pantalla: anterior a esa vuelta.
    await prisma.intento.update({
      where: { id: (await intento()).id },
      data: { salioEn: AHORA, salioDeTarea: 1 },
    });

    // Veinte minutos después, el chaval sigue escribiendo y la pantalla se
    // recarga. La marca se limpia sin inventar nada.
    expect(await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(1200))).toEqual({ cerradas: 0 });
    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 2 });
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });
  });

  // La misma red no puede comerse una salida legítima: la de después de la
  // vuelta sí cuenta.
  //
  // Mutación que la mata: comparar con `>=` en la red (`salioEn >= volvioEn`),
  // o descartar cualquier marca con `volvioEn` puesto. Nadie volvería a
  // registrar una segunda salida en toda la prueba.
  it("la salida POSTERIOR a la última vuelta sí cuenta", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(10));

    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(20));
    await volverALaEscrita(examen.id, ana.id, enSegundos(50));

    expect(await registro()).toMatchObject({ salidas: 2, segundosFuera: 40 });
  });

  // Mutación que la mata: quitar el `Math.max(0, …)` de los segundos. Un reloj
  // que va para atrás (dos servidores con la hora ligeramente distinta) restaría
  // tiempo del acumulado, y el registro empezaría a dar cuentas negativas.
  it("el registro no puede restar tiempo", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(100));
    // Se vuelve «antes» de haberse ido. No hay `volvioEn` todavía, así que la
    // red de arriba no lo caza: lo caza el suelo de cero.
    await volverALaEscrita(examen.id, ana.id, enSegundos(40));
    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 0 });
  });
});

describe("dos peticiones a la vez no cuentan la misma ausencia dos veces", () => {
  // La lectura de `registrarLasVueltas` (`findMany`) y la escritura de
  // `cerrarLaAusencia` (antes, un `update` por `id` a secas) no son atómicas:
  // la carga de la página y la acción del `visibilitychange` —o dos pestañas—
  // pueden leer las dos la MISMA ausencia abierta antes de que ninguna haya
  // escrito, y las dos harían el `increment`. Se repite 10 veces porque la
  // carrera depende del entrelazado real de dos conexiones a Postgres, no es
  // determinista con una sola pasada (mismo patrón que
  // tests/base/taller-paginas.test.ts).
  //
  // Mutación que la mata: en `cerrarLaAusencia`, volver a
  // `prisma.intento.update({ where: { id: marca.id } })` sin `salioEn:
  // marca.salioEn` en el `where` (el compare-and-swap quitado). Comprobado en
  // esta máquina: con el `update` a secas la prueba cae en rojo por
  // `segundosFuera`/`salidas` duplicados en varias de las 10 vueltas.
  it("diez vueltas a la vez, una por ausencia, no doblan ni una sola cuenta", async () => {
    await conLasDosTareasEscritas();
    for (let i = 0; i < 10; i++) {
      await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(i * 100));
      const resultados = await Promise.all([
        volverALaEscrita(examen.id, ana.id, enSegundos(i * 100 + 5)),
        volverALaEscrita(examen.id, ana.id, enSegundos(i * 100 + 5)),
      ]);
      expect(resultados).toEqual([{}, {}]);
    }
    expect(await registro()).toMatchObject({ salidas: 10, segundosFuera: 50 });
  });
});

describe("la vuelta adelanta volvioEn aunque no encuentre nada que cerrar", () => {
  // Mutación que la mata: quitar el segundo `updateMany` de
  // `registrarLasVueltas` (el que adelanta `volvioEn` sobre las filas SIN
  // ausencia abierta). Sin él, una vuelta que no cierra nada no deja rastro.
  it("una vuelta sin ausencia que cerrar adelanta volvioEn igual", async () => {
    await conLasDosTareasEscritas();
    expect((await intento()).volvioEn).toBeNull();

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(10))).toEqual({});

    expect((await intento()).volvioEn).toEqual(enSegundos(10));
  });

  // El caso completo que motiva el arreglo: dos pestañas, dos colas
  // independientes (`encadenar` solo ordena dentro de UNA pantalla montada).
  // La vuelta de la pestaña B llega primero y no encuentra nada que cerrar; el
  // «me voy» de la pestaña A aterriza después, sellado con una fecha que la
  // red de `cerrarLaAusencia` sí puede cazar PORQUE esta vuelta, aunque no
  // cerró nada, ya había adelantado `volvioEn`. Sin el arreglo, `volvioEn`
  // seguiría en null y esta misma marca se contaría como una ausencia de
  // veinte minutos que nunca ocurrió (es el mismo escenario que en «la red
  // contra una marca que llega tarde», pero el `volvioEn` que la caza lo puso
  // una vuelta que no cerró nada, no una que sí).
  //
  // Mutación que la mata: la misma que en la prueba anterior.
  it("un me-voy tardío que aterriza después de una vuelta sin nada que cerrar no se cuenta", async () => {
    await conLasDosTareasEscritas();
    // La vuelta de la pestaña B: no hay ausencia abierta todavía.
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(10))).toEqual({});

    // El «me voy» de la pestaña A, sellado con una fecha anterior a esa
    // vuelta: no hay ausencia abierta con la que `salirDeLaEscrita` pueda
    // chocar, así que se escribe igual.
    expect(await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(5))).toEqual({});
    expect(await marca()).toEqual({ salioEn: enSegundos(5), salioDeTarea: 1 });

    // Veinte minutos después, el chico sigue escribiendo y cualquier vuelta la
    // encuentra. Se limpia y no suma.
    expect(await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(1200))).toEqual({ cerradas: 0 });
    expect(await registro()).toMatchObject({ salidas: 0, segundosFuera: 0 });
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });
  });
});

describe("cerrar la pestaña también queda registrado", () => {
  // Por esto el rastro vive en el servidor y no en el navegador: cerrar la
  // pestaña no lo borra. La vuelta no la avisa nadie — cargar la pantalla YA es
  // la vuelta, y eso es lo que hace `registrarLasVueltas` desde la página.
  //
  // Mutación que la mata: quitar `registrarLasVueltas` de
  // `app/examen/[id]/[prueba]/page.tsx`, o apuntar la salida solo en el
  // navegador. Cerrar la pestaña borraría el rastro, y a un chaval de catorce
  // años ese truco le dura media tarde.
  it("la página cierra la ausencia al cargar, sin que nadie avise de la vuelta", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);

    expect(await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(240))).toEqual({ cerradas: 1 });

    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 240 });
  });

  // Mutación que la mata: buscar las ausencias solo por `personaId` y no por el
  // examen que se está abriendo. Entrar en la lectura del examen B cerraría —y
  // contaría— la ausencia de la escrita del examen A, que sigue abierta en otra
  // pestaña: el registro de A diría que volvió cuando no ha vuelto.
  it("otro examen de la misma persona no cierra esta ausencia", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);

    const otro = await prisma.examen.create({
      data: { titulo: "Examen 2", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" },
    });
    expect(await registrarLasVueltas({ personaId: ana.id, examenId: otro.id }, enSegundos(300))).toEqual({ cerradas: 0 });

    expect(await marca()).toEqual({ salioEn: AHORA, salioDeTarea: 1 });
    expect(await registro()).toMatchObject({ salidas: 0 });
  });

  // Mutación que la mata: quitar `examen: { estado: "PUBLICADO" }` del `where`
  // del registro. Los dos caminos de vuelta acabarían distinto con un examen
  // retirado: la acción rebota (lo exige `abrirLaPrueba`) y la página registraría
  // igual, así que el registro contaría una cosa u otra según por dónde volviera.
  it("con el examen retirado, ninguno de los dos caminos registra", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "ARCHIVADO" } });

    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(300))).toEqual({
      error: "Este examen ya no está disponible.",
    });
    expect(await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(300))).toEqual({ cerradas: 0 });
    expect(await registro()).toMatchObject({ salidas: 0 });
  });
});

describe("el reloj no se para mientras está fuera", () => {
  // Mutación que la mata: empujar `empezadaEn` hacia delante los segundos que
  // estuvo fuera, que es «lo amable». Salirse saldría gratis en tiempo.
  it("salir y volver no toca el reloj", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(300));
    expect((await intento()).empezadaEn).toEqual(AHORA);
  });
});

describe("en práctica libre no se registra nada", () => {
  beforeEach(async () => {
    await prisma.asignacion.update({ where: { id: asignacion.id }, data: { modo: "LIBRE" } });
  });

  // Mutación que la mata: quitar el `if (abierta.minutos === null) return {}` de
  // `salirDeLaEscrita`, o el `modo: "COMPLETO"` del `where` del registro. En
  // práctica libre se practica: un registro de la práctica no le dice nada a
  // nadie, y al profesor le ensuciaría la pantalla de corregir.
  it("ni se marca la salida ni se cuenta la vuelta", async () => {
    await conLasDosTareasEscritas();

    expect(await salirDeLaEscrita(examen.id, ana.id, 1, AHORA)).toEqual({});
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });

    // Y aunque la marca apareciera por otro camino, el registro no la cierra.
    await prisma.intento.update({ where: { id: (await intento()).id }, data: { salioEn: AHORA, salioDeTarea: 1 } });
    expect(await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(300))).toEqual({ cerradas: 0 });
    expect(await registro()).toMatchObject({ salidas: 0, segundosFuera: 0 });
  });
});

describe("con la prueba entregada", () => {
  // Mutación que la mata: llamar a `abrirLaPrueba` sin `exigirEmpezada`, o
  // quitarle la comprobación de `entregadaEn`. La prueba se acabó: no hay
  // salidas que registrar, y sumarlas cambiaría lo que el profesor lee de una
  // redacción ya entregada.
  it("salir y volver rebotan, y el registro no se mueve", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(60));
    expect(await entregarPrueba(examen.id, "EE", ana.id, enSegundos(70))).toEqual({});

    expect(await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(80))).toEqual({ error: "Esta prueba ya está entregada." });
    expect(await volverALaEscrita(examen.id, ana.id, enSegundos(200))).toEqual({ error: "Esta prueba ya está entregada." });
    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 60 });
  });

  // EL caso que faltaba, y el más sospechoso de todos: se fue, no volvió, y la
  // prueba la cerró el reloj por él. Antes se limpiaba la marca SIN contarla, y
  // entonces ese chico le llegaba al profesor con cero salidas — un agujero
  // justo en el sitio donde el registro hace falta.
  //
  // El tiempo se cuenta hasta el CIERRE de la prueba (`empezadaEn` más sus
  // cincuenta minutos), NO hasta el momento en que alguien miró la pantalla: el
  // cierre por reloj puede llegar tres días después, y apuntarle tres días fuera
  // sería inventar el dato más gordo del registro.
  //
  // Mutación que la mata: volver a limpiar la marca sin contarla, o contar hasta
  // `ahora` en vez de hasta el tope del reloj.
  it("el reloj la cierra con él fuera: la ausencia se cuenta, y solo hasta el cierre", async () => {
    await conLasDosTareasEscritas();
    // Se va a los diez minutos y no vuelve nunca.
    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(600));

    // Nadie mira la pantalla hasta tres días después. Ahí la cierra el reloj.
    const tresDias = new Date(AHORA.getTime() + 3 * 24 * 60 * 60_000);
    await cerrarLasQueSePasaron({ personaId: ana.id }, tresDias);

    // 50 minutos de prueba menos los 10 que llevaba escritos: 40 minutos fuera.
    expect(await registro()).toEqual({
      salidas: 1,
      segundosFuera: 40 * 60,
      ultimaSalidaEn: enSegundos(600),
      ultimaSalidaDeTarea: 2,
      ultimaSalidaSinVuelta: true,
    });
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });
    // Y lo que hubiera escrito sigue entero: nunca se borra nada.
    expect(await textos()).toEqual(["Mi carta para el sábado", "Mi día en el instituto"]);
  });

  // El mismo caso por la otra puerta: la prueba se cierra con el botón mientras
  // él está fuera. Aquí el cierre llega ANTES del tope del reloj, así que manda
  // el cierre: no se cuenta ni un segundo más allá.
  //
  // Mutación que la mata: contar siempre hasta el tope del reloj en vez de hasta
  // el menor de los dos. A quien entregó en el minuto doce se le apuntarían
  // treinta y ocho minutos fuera que no existieron.
  it("entregar con él fuera también cuenta, y solo hasta la entrega", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(120));

    // La entrega la manda la propia pantalla a los cinco minutos.
    expect(await entregarPrueba(examen.id, "EE", ana.id, enSegundos(300))).toEqual({});

    expect(await registro()).toEqual({
      salidas: 1,
      segundosFuera: 180,
      ultimaSalidaEn: enSegundos(120),
      ultimaSalidaDeTarea: 1,
      ultimaSalidaSinVuelta: true,
    });
  });

  // Mutación que la mata: dejar `ultimaSalidaSinVuelta` puesta para siempre
  // (quitar el `ultimaSalidaSinVuelta: false` de la vuelta normal). Un chico que
  // se fue, no volvió de aquella, y en el examen siguiente salió y volvió bien,
  // seguiría saliendo como que abandonó. La bandera habla de la ÚLTIMA salida.
  it("si después vuelve de otra salida, la bandera se apaga", async () => {
    await conLasDosTareasEscritas();
    // Una que acaba sin vuelta, forzada a mano sobre la marca.
    await prisma.intento.update({
      where: { id: (await intento()).id },
      data: { salidas: 1, segundosFuera: 30, ultimaSalidaEn: AHORA, ultimaSalidaDeTarea: 1, ultimaSalidaSinVuelta: true },
    });

    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(100));
    await volverALaEscrita(examen.id, ana.id, enSegundos(140));

    expect(await registro()).toEqual({
      salidas: 2,
      segundosFuera: 70,
      ultimaSalidaEn: enSegundos(100),
      ultimaSalidaDeTarea: 2,
      ultimaSalidaSinVuelta: false,
    });
  });

  // La red de la marca tardía vale también aquí: una marca de una ausencia ya
  // contada no puede cobrarse otra vez al cerrar la prueba.
  //
  // Mutación que la mata: quitar la comprobación `salioEn <= volvioEn` de
  // `ausenciaSinVuelta`. Al chico que volvió y siguió escribiendo se le apuntaría
  // un abandono que no ocurrió, que es la peor línea posible en esa pantalla.
  it("una marca que llegó tarde no se convierte en un abandono al cerrar", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 1, AHORA);
    await volverALaEscrita(examen.id, ana.id, enSegundos(5));
    // Y ahora aterriza el «me voy» que se había quedado en el aire.
    await prisma.intento.update({
      where: { id: (await intento()).id },
      data: { salioEn: AHORA, salioDeTarea: 1 },
    });

    expect(await entregarPrueba(examen.id, "EE", ana.id, enSegundos(600))).toEqual({});

    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 5, ultimaSalidaSinVuelta: false });
  });
});

describe("el tope del reloj también vale al cerrar por una vuelta normal", () => {
  // La misma regla que en `ausenciaSinVuelta` («hasta dónde se cuenta, y ni un
  // segundo más»), pero por la otra puerta: aquí no hace falta que el reloj
  // cierre la prueba primero, basta con llamar a `registrarLasVueltas`
  // directamente —la ventana exacta que puede colarse entre las dos llamadas
  // de `app/examen/[id]/[prueba]/page.tsx` si `cerrarLasQueSePasaron` todavía
  // no ha corrido sobre este intento—, y el intento sigue `entregadaEn: null`.
  //
  // Mutación que la mata: quitar el tope de `cerrarLaAusencia` (contar hasta
  // `ahora.getTime()` en vez de hasta `Math.min(ahora.getTime(), tope)`). Sin
  // él, esta vuelta le apuntaría al chico casi tres horas fuera en una prueba
  // de cincuenta minutos.
  it("una vuelta que llega tras el fin de la prueba no cuenta más allá del minuto 50", async () => {
    await conLasDosTareasEscritas();
    // Se va a los diez minutos.
    await salirDeLaEscrita(examen.id, ana.id, 1, enSegundos(600));

    // Tres horas después, sin haber pasado por `cerrarLasQueSePasaron`.
    expect(
      await registrarLasVueltas({ personaId: ana.id, examenId: examen.id }, enSegundos(3 * 60 * 60)),
    ).toEqual({ cerradas: 1 });

    // 50 minutos de prueba menos los 10 que llevaba escritos: 40 minutos
    // fuera, ni uno más.
    expect(await registro()).toMatchObject({ salidas: 1, segundosFuera: 40 * 60 });
  });
});

describe("lo que ve el profesor", () => {
  // Mutación que la mata: no llevar el registro a `escritoParaCorregir` (o
  // llevarlo con ceros fijos). El profesor vería un folio corto sin saber que el
  // chico salió tres veces, y tendría que suponer que no sabía.
  it("el registro llega a la pantalla de corregir esa redacción", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(10));
    await volverALaEscrita(examen.id, ana.id, enSegundos(70));
    await entregarPrueba(examen.id, "EE", ana.id, enSegundos(80));

    const para = await escritoParaCorregir((await intento()).id, enSegundos(90));

    expect(para!.salidas).toEqual({
      salidas: 1,
      segundosFuera: 60,
      ultimaSalidaEn: enSegundos(10),
      ultimaSalidaDeTarea: 2,
      ultimaSalidaSinVuelta: false,
    });
  });

  // El abandono, de punta a punta: se va, no vuelve, se la cierra el reloj, y el
  // profesor lo lee. Es el camino entero del caso que antes le llegaba con cero
  // salidas.
  //
  // Mutación que la mata: no llevar `ultimaSalidaSinVuelta` a `escritoParaCorregir`
  // (dejarlo en `false` fijo). El profesor vería «salió 1 vez, 40 minutos» sin
  // saber que esos cuarenta minutos acaban en que no volvió — que es lo que
  // separa una consulta larga de un abandono.
  it("el abandono llega entero a la pantalla de corregir", async () => {
    await conLasDosTareasEscritas();
    await salirDeLaEscrita(examen.id, ana.id, 2, enSegundos(600));
    await cerrarLasQueSePasaron({ personaId: ana.id }, new Date(AHORA.getTime() + 3 * 24 * 60 * 60_000));

    const para = await escritoParaCorregir((await intento()).id, new Date(AHORA.getTime() + 4 * 24 * 60 * 60_000));

    expect(para!.salidas).toEqual({
      salidas: 1,
      segundosFuera: 40 * 60,
      ultimaSalidaEn: enSegundos(600),
      ultimaSalidaDeTarea: 2,
      ultimaSalidaSinVuelta: true,
    });
  });

  // Quien no se salió llega con el registro a cero, y la pantalla no pinta nada.
  // Mutación que la mata: dar a `salidas` o `segundosFuera` un valor por defecto
  // distinto de 0 en el modelo. A todo el mundo le saldría una línea de salidas.
  it("quien no se salió llega con el registro a cero", async () => {
    await conLasDosTareasEscritas();
    await entregarPrueba(examen.id, "EE", ana.id, enSegundos(80));

    const para = await escritoParaCorregir((await intento()).id, enSegundos(90));

    expect(para!.salidas).toEqual({
      salidas: 0,
      segundosFuera: 0,
      ultimaSalidaEn: null,
      ultimaSalidaDeTarea: null,
      ultimaSalidaSinVuelta: false,
    });
  });
});

describe("las guardas de siempre", () => {
  // Mutación que la mata: quitar CUALQUIERA de las comprobaciones de
  // `abrirLaPrueba` en las dos funciones nuevas. Son direcciones públicas: sin
  // ellas, cualquiera le apunta salidas al examen de otro.
  it("sin empezar y con un examen que no es suyo, rebotan las dos", async () => {
    expect(await salirDeLaEscrita(examen.id, ana.id, 1, AHORA)).toEqual({ error: "Todavía no has empezado esta prueba." });
    expect(await volverALaEscrita(examen.id, ana.id, AHORA)).toEqual({ error: "Todavía no has empezado esta prueba." });

    await conLasDosTareasEscritas();
    expect(await salirDeLaEscrita(examen.id, luis.id, 1, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    expect(await volverALaEscrita(examen.id, luis.id, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });
  });

  // Mutación que la mata: no comprobar la tarea contra la estructura del nivel.
  // Una dirección pública puede mandar la tarea 7, y el profesor leería «salió
  // desde la tarea 7» de una escrita que tiene dos.
  it("una tarea que esta escrita no tiene rebota, y no deja marca", async () => {
    await conLasDosTareasEscritas();
    expect(await salirDeLaEscrita(examen.id, ana.id, 7, AHORA)).toEqual({ error: "Esa tarea no existe." });
    expect(await marca()).toEqual({ salioEn: null, salioDeTarea: null });
  });
});
