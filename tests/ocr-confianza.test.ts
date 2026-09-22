// tests/ocr-confianza.test.ts
//
// La capa de seguridad del OCR (lib/taller/ocr/confianza.ts): donde la IA se
// autodenuncia con `dudas`, el lector de OCR no tiene esa autoconciencia, así
// que esta capa la reconstruye mirando el Formulario ya relleno. El caso de
// cabecera es el real del corpus: en CE-2, la sexta pregunta llega partida en
// dos fragmentos irreconciliables y se descarta entera (ver
// tests/ocr-formas.test.ts, "la pregunta partida en dos líneas queda vacía").
// Un formulario así pasa `fallosDeForma` sin ningún aviso; esta capa tiene
// que ser la que lo note.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario, type FormularioDe } from "@/lib/taller/formas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";
import { leerListaComun } from "@/lib/taller/ocr/formas/lista-comun";
import { leerHuecos } from "@/lib/taller/ocr/formas/huecos";
import { leerOpciones } from "@/lib/taller/ocr/formas/opciones";
import { dudasDeOcr } from "@/lib/taller/ocr/confianza";

const CARPETA_FIXTURES = path.join(process.cwd(), "tests", "ayudas", "ocr-formas");
const fixture = (nombre: string): string => readFileSync(path.join(CARPETA_FIXTURES, nombre), "utf-8");

/** Igual que en tests/ocr-formas.test.ts: aplica el mismo filtro que pasaría lo que devuelve la IA. */
function mezclar(vacio: Formulario, leido: Formulario): Formulario {
  const resultado = imponerEstructura(vacio, leido);
  if ("error" in resultado) throw new Error(`imponerEstructura falló: ${resultado.error}`);
  return resultado.formulario;
}

/** Una tarea OPCIONES pequeña, completa y sin ningún problema: la base de los casos "no debe avisar de nada". */
function opcionesLimpio(): FormularioDe<"OPCIONES"> {
  return {
    forma: "OPCIONES",
    consigna: "Lee el texto y marca la opción correcta para cada pregunta.",
    textos: [
      { etiqueta: "EL VIAJE DE MARTA", texto: "Marta decidió viajar sola por primera vez el verano pasado." },
      { etiqueta: "OTRO VIAJE", texto: "Su hermano prefiere viajar siempre acompañado." },
    ],
    medios: { imagenes: {}, audio: null },
    actividad: {
      ejemplo: null,
      preguntas: [
        {
          numero: 13,
          enunciado: "Marta viajó sola por primera vez...",
          opciones: [
            { letra: "A", texto: "el verano pasado.", conImagen: false },
            { letra: "B", texto: "el año pasado.", conImagen: false },
            { letra: "C", texto: "hace dos veranos.", conImagen: false },
          ],
          grupo: null,
        },
        {
          numero: 14,
          enunciado: "¿Con quién viajó Marta?",
          opciones: [
            { letra: "A", texto: "Con su familia.", conImagen: false },
            { letra: "B", texto: "Con una amiga.", conImagen: false },
            { letra: "C", texto: "Sola.", conImagen: false },
          ],
          grupo: null,
        },
      ],
    },
  };
}

/** Una tarea RELACIONAR donde los elementos SÍ llevan texto propio (como CE-1). */
function relacionarConTextoDeElementos(): FormularioDe<"RELACIONAR"> {
  return {
    forma: "RELACIONAR",
    consigna: "Relaciona cada mensaje con el texto que le corresponde.",
    textos: [],
    medios: { imagenes: {}, audio: null },
    actividad: {
      ejemplo: { texto: "Busco piso cerca del centro.", letra: "J" },
      elementos: [
        { numero: 1, texto: "Necesito un compañero de piso." },
        { numero: 2, texto: "Vendo bicicleta de montaña." },
      ],
      destinos: [
        { letra: "A", titulo: "Anuncio 1", texto: "Se busca compañero de piso." },
        { letra: "B", titulo: "Anuncio 2", texto: "Se vende bicicleta." },
      ],
    },
  };
}

/** Una tarea RELACIONAR donde los elementos NUNCA llevan texto propio (como CO-2, "Mensaje 1-6"): vacíos a propósito. */
function relacionarSinTextoDeElementos(): FormularioDe<"RELACIONAR"> {
  const base = relacionarConTextoDeElementos();
  return {
    ...base,
    actividad: {
      ...base.actividad,
      ejemplo: { texto: "", letra: "J" },
      elementos: base.actividad.elementos.map((e) => ({ ...e, texto: "" })),
    },
  };
}

describe("dudasDeOcr — campos vacíos (el requisito de cabecera)", () => {
  it("caso real del corpus: la sexta pregunta de CE-2 llega vacía y se marca", () => {
    const regla = reglaDe("A2_B1_ESCOLAR", "CE", 2)!;
    const leido = leerListaComun(fixture("ce2-lista-comun.txt"), regla);
    const formulario = mezclar(formularioVacio(regla), leido);
    if (formulario.forma !== "LISTA_COMUN") throw new Error("se esperaba LISTA_COMUN");
    expect(formulario.actividad.preguntas[5].enunciado).toBe(""); // confirma la premisa del caso

    const dudas = dudasDeOcr(formulario);
    const dudaDeLaSexta = dudas.find((d) => d.clave === "actividad.preguntas.5.enunciado");
    expect(dudaDeLaSexta).toBeDefined();
    expect(dudaDeLaSexta?.nota).toContain("vacío");
    // Las cinco preguntas que sí llegaron completas no deben avisar de nada.
    for (let i = 0; i < 5; i++) expect(dudas.some((d) => d.clave === `actividad.preguntas.${i}.enunciado`)).toBe(false);
  });

  it("caso real del corpus: la opción C del hueco 22 llega vacía (tras dejar «Qsi» en la B) y se marca", () => {
    // Fixture real de tests/ocr-formas.test.ts: "Qsi" funde la marca de la
    // opción C con la palabra siguiente sin espacio; leerHuecos no adivina el
    // corte y deja la C vacía. Sirve también de prueba negativa: la consigna
    // de este fixture nombra las letras ("opción correcta (A, B o C)") y no
    // debe generar ninguna duda de "letra suelta".
    const regla = reglaDe("A2_B1_ESCOLAR", "CE", 4)!;
    const leido = leerHuecos(fixture("ce4-huecos-vocacion.txt"), regla);
    const formulario = mezclar(formularioVacio(regla), leido);
    expect(dudasDeOcr(formulario)).toEqual([
      { clave: "actividad.huecos.3.opciones.1.texto", nota: expect.stringContaining("Qsi") },
      { clave: "actividad.huecos.3.opciones.2.texto", nota: expect.stringContaining("vacío") },
    ]);
  });

  it("caso real del corpus: una tarea OPCIONES bien leída, con su consigna «(A, B o C)», no genera ninguna duda", () => {
    const regla = reglaDe("A2_B1_ESCOLAR", "CE", 3)!;
    const leido = leerOpciones(fixture("ce3-opciones.txt"), regla);
    const formulario = mezclar(formularioVacio(regla), leido);
    expect(dudasDeOcr(formulario)).toEqual([]);
  });

  it("marca un texto suelto vacío con la ruta exacta del campo", () => {
    const f = opcionesLimpio();
    const conTextoVacio: Formulario = { ...f, textos: [f.textos[0], { etiqueta: "OTRA COSA", texto: "" }] };
    const dudas = dudasDeOcr(conTextoVacio);
    expect(dudas).toEqual([{ clave: "textos.1.texto", nota: expect.stringContaining("vacío") }]);
  });

  it("no marca la opción vacía de una pregunta con imagen: ahí nunca hay texto que leer", () => {
    const f = opcionesLimpio();
    const conImagen: Formulario = {
      ...f,
      actividad: {
        ...f.actividad,
        preguntas: f.actividad.preguntas.map((p, i) =>
          i === 0 ? { ...p, opciones: p.opciones.map((o) => (o.letra === "A" ? { ...o, texto: "", conImagen: true } : o)) } : p,
        ),
      },
    };
    expect(dudasDeOcr(conImagen)).toEqual([]);
  });

  it("RELACIONAR sin texto de elementos por regla (tipo CO-2): completo así, no avisa de nada", () => {
    expect(dudasDeOcr(relacionarSinTextoDeElementos())).toEqual([]);
  });

  it("límite conocido: si el OCR pierde el texto de un elemento que SÍ debería llevarlo (tipo CE-1), esta capa no lo detecta", () => {
    // Documentado a propósito: sin la `regla` a mano no se puede distinguir este
    // caso del anterior (CO-2), así que se excluye en los dos. La falta real la
    // sigue cazando `motivosDeTarea` en estado.ts, que sí conoce la regla — a
    // costa de perder aquí el resaltado por campo.
    const f = relacionarConTextoDeElementos();
    const conPerdida: Formulario = {
      ...f,
      actividad: { ...f.actividad, elementos: [{ ...f.actividad.elementos[0], texto: "" }, f.actividad.elementos[1]] },
    };
    expect(dudasDeOcr(conPerdida)).toEqual([]);
  });
});

describe("dudasDeOcr — confianza baja de tesseract", () => {
  it("marca un campo con confianza por debajo del umbral, con el porcentaje en la nota", () => {
    const f = opcionesLimpio();
    const dudas = dudasDeOcr(f, new Map([["actividad.preguntas.0.enunciado", 42]]));
    expect(dudas).toEqual([{ clave: "actividad.preguntas.0.enunciado", nota: expect.stringContaining("42 %") }]);
  });

  it("no marca un campo justo en el umbral (80), solo el que cae por debajo (79)", () => {
    const f = opcionesLimpio();
    const dudas = dudasDeOcr(
      f,
      new Map([
        ["actividad.preguntas.0.enunciado", 80],
        ["actividad.preguntas.1.enunciado", 79],
      ]),
    );
    expect(dudas.map((d) => d.clave)).toEqual(["actividad.preguntas.1.enunciado"]);
  });

  it("un campo sin dato de confianza no se juzga por confianza", () => {
    expect(dudasDeOcr(opcionesLimpio(), new Map())).toEqual([]);
  });

  it("un campo vacío con confianza baja solo avisa una vez, de estar vacío (no también de confianza)", () => {
    const f = opcionesLimpio();
    const vacio: Formulario = {
      ...f,
      actividad: { ...f.actividad, preguntas: f.actividad.preguntas.map((p, i) => (i === 0 ? { ...p, enunciado: "" } : p)) },
    };
    const dudas = dudasDeOcr(vacio, new Map([["actividad.preguntas.0.enunciado", 10]]));
    expect(dudas).toHaveLength(1);
    expect(dudas[0].nota).not.toContain("%");
  });
});

describe("dudasDeOcr — huellas de corrupción de OCR", () => {
  it("marca de opción pegada a una palabra corta: el 'Qsi' real del corpus (C) leída como Q, pegada a 'si')", () => {
    const f = opcionesLimpio();
    const corrupto: Formulario = {
      ...f,
      actividad: {
        ...f.actividad,
        preguntas: f.actividad.preguntas.map((p, i) =>
          i === 0 ? { ...p, opciones: p.opciones.map((o) => (o.letra === "C" ? { ...o, texto: "Qsi, siempre que llueva." } : o)) } : p,
        ),
      },
    };
    const dudas = dudasDeOcr(corrupto);
    expect(dudas).toEqual([{ clave: "actividad.preguntas.0.opciones.2.texto", nota: expect.stringContaining("Qsi") }]);
  });

  it("letra suelta que sobra en medio del texto: el resto de una marca mal leída", () => {
    const f = opcionesLimpio();
    const corrupto: Formulario = {
      ...f,
      actividad: {
        ...f.actividad,
        preguntas: f.actividad.preguntas.map((p, i) => (i === 1 ? { ...p, enunciado: "El chico Q no sabía qué responder." } : p)),
      },
    };
    const dudas = dudasDeOcr(corrupto);
    expect(dudas).toEqual([{ clave: "actividad.preguntas.1.enunciado", nota: expect.stringContaining("«Q»") }]);
  });

  it("mezcla de dígito y letra en una misma palabra, típica confusión de OCR (0/O)", () => {
    const f = opcionesLimpio();
    const corrupto: Formulario = { ...f, consigna: "El aut0bús salió tarde esa mañana." };
    const dudas = dudasDeOcr(corrupto);
    expect(dudas).toEqual([{ clave: "consigna", nota: expect.stringContaining("aut0bús") }]);
  });

  it("no marca palabras españolas normales con mayúscula inicial (Como, Este, Donde)", () => {
    const f = opcionesLimpio();
    const limpio: Formulario = { ...f, consigna: "Como no tenía tiempo, decidió esperar. Este plan y Donde viva no importan." };
    expect(dudasDeOcr(limpio)).toEqual([]);
  });
});

describe("dudasDeOcr — mezcla de señales y formulario limpio", () => {
  it("un mismo campo con confianza baja Y corrupción funde las dos notas en una sola duda", () => {
    const f = opcionesLimpio();
    const corrupto: Formulario = { ...f, consigna: "El aut0bús salió tarde esa mañana." };
    const dudas = dudasDeOcr(corrupto, new Map([["consigna", 30]]));
    expect(dudas).toHaveLength(1);
    expect(dudas[0].clave).toBe("consigna");
    expect(dudas[0].nota).toContain("30 %");
    expect(dudas[0].nota).toContain("aut0bús");
    expect(dudas[0].nota).toContain(" · ");
  });

  it("una tarea OPCIONES completa y sin problemas no genera ninguna duda", () => {
    expect(dudasDeOcr(opcionesLimpio())).toEqual([]);
  });

  it("una tarea OPCIONES completa con confianza alta en todos los campos tampoco genera dudas", () => {
    const confianzas = new Map([
      ["consigna", 96],
      ["textos.0.texto", 91],
      ["actividad.preguntas.0.enunciado", 95],
    ]);
    expect(dudasDeOcr(opcionesLimpio(), confianzas)).toEqual([]);
  });

  it("una tarea RELACIONAR completa (con y sin texto de elementos) no genera ninguna duda", () => {
    expect(dudasDeOcr(relacionarConTextoDeElementos())).toEqual([]);
    expect(dudasDeOcr(relacionarSinTextoDeElementos())).toEqual([]);
  });
});
