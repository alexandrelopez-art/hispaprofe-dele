# Entrega 3c: el estudiante hace la lectura y la auditiva — plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un estudiante con un examen asignado pueda hacer la comprensión de lectura (con reloj) y la comprensión auditiva (con audios racionados), y reciba una nota calculada en el servidor.

**Architecture:** Tres tablas nuevas (`Intento`, `RespuestaDeIntento`, `TrozoOido`) guardan lo que hace el estudiante. Toda la aritmética —nota, tiempo restante, qué trozo toca— vive en `lib/examen/motor.ts`, puro y sin base de datos. `lib/examen/hacer.ts` es la única puerta que escribe, y `lib/examen/paraHacer.ts` la única que lee hacia el navegador, construyendo el objeto campo a campo para que la `Clave` no pueda colarse. Las pantallas del estudiante cuelgan de `/examen/[id]/[prueba]`, en singular, para no confundirse nunca con `/examenes`, que es del profesor.

**Tech Stack:** Next 16 (App Router, acciones de servidor), React 19, Prisma 7 sobre Postgres, Zod 4, Tailwind 4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-16-taller-entrega-3c-design.md` — hay que leerla entera antes de la Task 1.

## Global Constraints

- **Todo en castellano**: ficheros, funciones, variables, comentarios y mensajes de pantalla. Sin tildes en los nombres de fichero.
- **El repositorio es PÚBLICO.** Ni una respuesta real del cuadernillo del libro puede entrar en una prueba. Para claves de mentira existe `tests/ayudas/cuadernillo-inventado.ts`.
- **Ninguna prueba llama a `new Date()` dentro, y ninguna función del motor tampoco**: el «ahora» se pasa siempre como argumento. Es lo que evita la suite roja de madrugada.
- **Cada prueba lleva escrito al lado, en un comentario, la mutación que tiene que matar.** Un comentario que no se ha comprobado mutando a mano no vale.
- **Sin jsdom.** Las pantallas se comprueban con `renderToStaticMarkup`. Un `useState` no se puede pulsar en una prueba: lo que dependa de un clic va al paseo por el navegador.
- **Antes de dar por buena una ausencia** (`not.toContain`), la prueba comprueba que lo pintado no está vacío.
- **Un botón que cambia algo es un formulario POST**, nunca un enlace: Next precarga los enlaces al pintarlos y los dispararía solos.
- **El cliente de Prisma no está en git.** Después de tocar `prisma/schema.prisma`, en ESTA carpeta: `DATABASE_URL=postgresql://x@127.0.0.1:1/x DIRECT_URL=postgresql://x@127.0.0.1:1/x npx prisma generate`.
- **Las cuatro órdenes que tienen que quedar verdes al cerrar cada tarea:** `npm test`, `npm run test:base`, `npx tsc --noEmit`, `npm run lint`.
- **Colores de la casa:** `hp-400` y `hp-600` para lo interactivo, `tinta-suave` para lo secundario. Botón principal: `rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white`.
- **Todo tiene que verse a 400 px de ancho.**

---

## Mapa de ficheros

**Se crean:**

| Fichero | De qué responde |
|---|---|
| `lib/examen/motor.ts` | La aritmética pura: nota, tiempo, qué trozo toca, cómo se llama un estado. |
| `lib/examen/paraHacer.ts` | Leer una prueba para hacerla. La única puerta de salida hacia el navegador. |
| `lib/examen/hacer.ts` | Las seis escrituras: empezar, guardar, marcar trozo, entregar, cerrar las pasadas de hora, corregir en libre. |
| `app/examen/[id]/[prueba]/page.tsx` | La pantalla del estudiante, con sus tres estados. |
| `app/examen/acciones.ts` | Las acciones de servidor del estudiante. |
| `components/examen/hacer-prueba.tsx` | El armazón de cliente: pestañas de tarea, guardado al marcar, entregar. |
| `components/examen/tarea-del-estudiante.tsx` | Pinta una tarea de las cuatro formas cerradas, con sus respuestas. |
| `components/examen/reloj.tsx` | La cuenta atrás. |
| `components/examen/cinta.tsx` | El reproductor encadenado y racionado. |
| `tests/examen-motor.test.ts`, `tests/examen-acciones.test.ts`, `tests/examen-pantallas.test.tsx`, `tests/base/intentos.test.ts`, `tests/base/examen-para-hacer.test.ts` | Las pruebas nuevas. |

**Se modifican:** `prisma/schema.prisma` (tres tablas), `lib/dele/estructura.ts` (los minutos), `lib/ficheros/permisos.ts` y `app/api/ficheros/[id]/route.ts` (la tercera rama del candado), `lib/ficheros/vercel.ts` (el plazo largo del audio), `lib/examen/asignar.ts` (quitar con intento no deja, y los estados hacia las dos listas), `app/page.tsx` (Inicio), `components/taller/quien-lo-hace.tsx` y `app/examenes/[id]/page.tsx` (la lista del profesor), y las pruebas `tests/ficheros-permisos.test.ts`, `tests/ficheros-rutas.test.ts`, `tests/portada.test.ts`, `tests/base/asignaciones.test.ts`.

---

## Task 1: Las tres tablas

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<fecha>_intentos/migration.sql` (lo escribe Prisma)
- Test: `tests/base/intentos.test.ts`

**Interfaces:**
- Consumes: `Asignacion` y `Prueba`, que ya existen.
- Produces: los modelos `Intento`, `RespuestaDeIntento` y `TrozoOido` tal como los escribe la sección 2 de la spec, y la relación inversa `Asignacion.intentos`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/base/intentos.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

const TOPE = finDelDiaEnMadrid("2026-10-20")!;

let ana: Persona;
let examen: Examen;
let asignacion: Asignacion;

beforeEach(async () => {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  examen = await prisma.examen.create({ data: { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
  asignacion = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
});

describe("la tabla de intentos", () => {
  // Mutación que la mata: quitar @@unique([asignacionId, prueba]). Sin ella, dos
  // clics seguidos en «Empezar» dejan dos intentos y el reloj arranca dos veces.
  it("no admite dos intentos de la misma prueba", async () => {
    await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    await expect(prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } })).rejects.toThrow();
    // La otra prueba del mismo examen sí, que son intentos distintos.
    await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CO" } });
    expect(await prisma.intento.count()).toBe(2);
  });

  // Mutación que la mata: dar valor por defecto a aciertos/total, o hacerlos no nulos.
  it("nace sin entregar y sin nota", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    expect(intento.entregadaEn).toBeNull();
    expect(intento.aciertos).toBeNull();
    expect(intento.total).toBeNull();
    expect(intento.fallos).toEqual([]);
    expect(intento.porTiempo).toBe(false);
    expect(intento.empezadaEn).toBeInstanceOf(Date);
  });

  // Mutación que la mata: quitar @@unique([intentoId, numero]); el estudiante
  // cambiaría de opinión y quedarían dos letras para la misma pregunta.
  it("una sola letra por pregunta, y se puede cambiar", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    await prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 7, letra: "A" } });
    await expect(
      prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 7, letra: "B" } }),
    ).rejects.toThrow();
    await prisma.respuestaDeIntento.update({ where: { intentoId_numero: { intentoId: intento.id, numero: 7 } }, data: { letra: "B" } });
    const guardadas = await prisma.respuestaDeIntento.findMany();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]!.letra).toBe("B");
  });

  // Mutación que la mata: quitar @@unique([intentoId, tarea, trozo]). Es el
  // candado que impide que un trozo suene dos veces.
  it("un trozo oído no se apunta dos veces, y los de otra tarea no chocan", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CO" } });
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 1, trozo: 1 } });
    await expect(prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 1, trozo: 1 } })).rejects.toThrow();
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 2, trozo: 1 } });
    expect(await prisma.trozoOido.count()).toBe(2);
  });

  // Mutación que la mata: poner onDelete Restrict en la asignación. Con Cascade,
  // borrar la asignación se lleva la nota — y por eso la Task 4 impide borrarla.
  it("borrar la asignación se lleva el intento entero", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
    await prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 1, letra: "A" } });
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 1, trozo: 1 } });
    await prisma.asignacion.delete({ where: { id: asignacion.id } });
    expect(await prisma.intento.count()).toBe(0);
    expect(await prisma.respuestaDeIntento.count()).toBe(0);
    expect(await prisma.trozoOido.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

```bash
npm run test:base -- tests/base/intentos.test.ts
```

Esperado: rojo, `prisma.intento` no existe.

- [ ] **Step 3: Escribir el esquema**

En `prisma/schema.prisma`, los tres modelos de la sección 2 de la spec, copiados tal cual. Y en `model Asignacion`, la relación inversa:

```prisma
  intentos Intento[]
```

- [ ] **Step 4: Crear la migración con un Postgres de usar y tirar**

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
PUERTO=55433; DATOS="$(pwd)/.tmp/pg-migrar"
rm -rf "$DATOS" && initdb -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DATOS" -o "-p $PUERTO -k $DATOS" -l "$DATOS/servidor.log" start
psql -h 127.0.0.1 -p $PUERTO -U postgres -c "create database migrar"
export DATABASE_URL="postgresql://postgres@127.0.0.1:$PUERTO/migrar"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate dev --name intentos
pg_ctl -D "$DATOS" stop -m fast; rm -rf "$DATOS"
```

Leer el `migration.sql` que sale y comprobar a ojo que trae **tres tablas, tres índices únicos y un índice normal**, y **ninguna columna borrada**. Si toca algo de lo que ya había, el esquema se ha desviado: parar y avisar.

- [ ] **Step 5: Correr la prueba y verla pasar**

```bash
npm run test:base -- tests/base/intentos.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/base/intentos.test.ts
git commit -m "Las tres tablas de lo que hace el estudiante: intento, respuesta y trozo oido"
```

---

## Task 2: El motor, en piezas puras

**Files:**
- Create: `lib/examen/motor.ts`
- Modify: `lib/dele/estructura.ts`
- Test: `tests/examen-motor.test.ts`

**Interfaces:**
- Consumes: `Nivel` y `Prueba` de Prisma.
- Produces, y todo lo demás cuelga de aquí:

```ts
// lib/dele/estructura.ts
export const MINUTOS_DE_PRUEBA: Readonly<Record<Nivel, Readonly<Record<Prueba, number | null>>>>;
export function minutosDePrueba(nivel: Nivel, prueba: Prueba): number | null;

// lib/examen/motor.ts
export const SEGUNDOS_DE_GRACIA = 10;
export type Fallo = { numero: number; marcada: string | null };
export type Nota = { aciertos: number; total: number; fallos: Fallo[] };
export type EstadoDePrueba = {
  estado: "SIN_EMPEZAR" | "HACIENDO" | "ENTREGADA";
  aciertos: number | null;
  total: number | null;
  porTiempo: boolean;
};
export function notaDePrueba(clave: Record<string, string>, respuestas: Record<string, string>): Nota;
export function segundosQueQuedan(empezadaEn: Date, minutos: number | null, ahora: Date): number | null;
export function seAcaboElTiempo(empezadaEn: Date, minutos: number | null, ahora: Date): boolean;
export function siguienteTrozo(oidos: readonly number[], trozos: number): number | null;
export function estadoDePrueba(intento: { entregadaEn: Date | null; aciertos: number | null; total: number | null; porTiempo: boolean } | null): EstadoDePrueba;
export function textoDelEstado(e: EstadoDePrueba): string;
```

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/examen-motor.test.ts`. **Las claves son inventadas**: el repositorio es público.

```ts
import { describe, it, expect } from "vitest";
import { minutosDePrueba } from "@/lib/dele/estructura";
import {
  estadoDePrueba,
  notaDePrueba,
  seAcaboElTiempo,
  segundosQueQuedan,
  siguienteTrozo,
  textoDelEstado,
} from "@/lib/examen/motor";

// Clave inventada de seis preguntas: el cuadernillo real no entra en el repo.
const CLAVE = { "1": "A", "2": "B", "3": "C", "4": "A", "5": "B", "6": "C" };

describe("la nota", () => {
  // Mutación que la mata: contar como acierto lo no marcado, o devolver un total fijo.
  it("cuenta aciertos, dice los fallos y no regala las no marcadas", () => {
    const nota = notaDePrueba(CLAVE, { "1": "A", "2": "C", "3": "C", "5": "A" });
    expect(nota.aciertos).toBe(2);
    expect(nota.total).toBe(6);
    expect(nota.fallos).toEqual([
      { numero: 2, marcada: "C" },
      { numero: 4, marcada: null },
      { numero: 5, marcada: "A" },
      { numero: 6, marcada: null },
    ]);
  });

  // Mutación que la mata: comparar sin normalizar. El desplegable manda "a"
  // minúscula en algún navegador y el estudiante perdería la pregunta.
  it("la letra vale igual en minúscula y con espacios", () => {
    expect(notaDePrueba(CLAVE, { "1": " a " }).aciertos).toBe(1);
  });

  // Mutación que la mata: puntuar por lo que mandó el estudiante en vez de por la
  // clave. Una respuesta a una pregunta que no existe no puede sumar.
  it("una respuesta de más ni suma ni cuenta", () => {
    const nota = notaDePrueba(CLAVE, { "1": "A", "99": "A" });
    expect(nota.aciertos).toBe(1);
    expect(nota.total).toBe(6);
    expect(nota.fallos.some((f) => f.numero === 99)).toBe(false);
  });

  // Mutación que la mata: sacar el total de las respuestas del estudiante en vez de la clave: sin clave daría total 1.
  it("sin clave no hay nota que dar", () => {
    expect(notaDePrueba({}, { "1": "A" })).toEqual({ aciertos: 0, total: 0, fallos: [] });
  });
});

const EMPEZO = new Date("2026-09-20T09:00:00Z");
const ENTREGADA = new Date("2026-09-20T09:40:00Z");
const en = (minutos: number, segundos = 0) => new Date(EMPEZO.getTime() + minutos * 60_000 + segundos * 1_000);

describe("el reloj", () => {
  // Mutación que la mata: redondear hacia arriba, o contar desde «ahora».
  it("descuenta desde que empezó", () => {
    expect(segundosQueQuedan(EMPEZO, 50, EMPEZO)).toBe(3000);
    expect(segundosQueQuedan(EMPEZO, 50, en(49))).toBe(60);
    expect(segundosQueQuedan(EMPEZO, 50, en(51))).toBe(0);
    // Medio segundo: con Math.ceil esto daría 60, y por eso la mutación muere aquí.
    expect(segundosQueQuedan(EMPEZO, 50, new Date(EMPEZO.getTime() + 2_940_500))).toBe(59);
  });

  // Mutación que la mata: devolver 0 en vez de null; la auditiva pintaría un
  // reloj parado en cero y parecería que se acabó el tiempo.
  it("sin minutos no hay reloj", () => {
    expect(segundosQueQuedan(EMPEZO, null, en(600))).toBeNull();
    expect(seAcaboElTiempo(EMPEZO, null, en(600))).toBe(false);
  });

  // Mutación que la mata: quitar los diez segundos de gracia, o comparar con >.
  it("los diez segundos de gracia son diez, no cero y no veinte", () => {
    expect(seAcaboElTiempo(EMPEZO, 50, en(49, 59))).toBe(false);
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 5))).toBe(false);
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 11))).toBe(true);
    // Justo en el límite: con >= esto daría true, y por eso la mutación muere aquí.
    expect(seAcaboElTiempo(EMPEZO, 50, en(50, 10))).toBe(false);
  });
});

describe("qué trozo toca", () => {
  // Mutación que la mata: devolver oidos.length + 1, que parece lo mismo y
  // falla en cuanto hay un hueco.
  it("el menor que no ha sonado, aunque haya huecos", () => {
    expect(siguienteTrozo([], 8)).toBe(1);
    expect(siguienteTrozo([1, 2], 8)).toBe(3);
    expect(siguienteTrozo([1, 3], 8)).toBe(2);
    expect(siguienteTrozo([1, 2, 3, 4, 5, 6, 7, 8], 8)).toBeNull();
  });

  // Mutación que la mata: tratar trozos = 1 como «sin trozos» y devolver siempre null: la auditiva 3 no sonaría nunca.
  it("una tarea que no se corta es un solo trozo", () => {
    expect(siguienteTrozo([], 1)).toBe(1);
    expect(siguienteTrozo([1], 1)).toBeNull();
  });
});

describe("cómo se llama lo que ha hecho", () => {
  // Mutación que la mata: llamar «Entregada» a un intento sin entregar.
  it("sin empezar, a medias y entregada", () => {
    expect(textoDelEstado(estadoDePrueba(null))).toBe("Sin empezar");
    expect(textoDelEstado(estadoDePrueba({ entregadaEn: null, aciertos: null, total: null, porTiempo: false }))).toBe("A medias");
    expect(
      textoDelEstado(estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: 19, total: 25, porTiempo: false })),
    ).toBe("Entregada, 19 de 25");
  });

  // Mutación que la mata: no distinguir la que entregó el reloj. El profesor
  // tiene que poder ver que ese 12 de 25 es de alguien a quien se le acabó.
  it("dice cuándo la entregó el reloj", () => {
    expect(
      textoDelEstado(estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: 12, total: 25, porTiempo: true })),
    ).toBe("Entregada por tiempo, 12 de 25");
  });
});

describe("los minutos de cada prueba", () => {
  // Mutación que la mata: poner 30 minutos en la auditiva. Las cuatro pistas del
  // libro duran más que eso y el estudiante se quedaría cortado sin culpa suya.
  it("la lectura lleva reloj y la auditiva no", () => {
    expect(minutosDePrueba("A2_B1_ESCOLAR", "CE")).toBe(50);
    expect(minutosDePrueba("A2_B1_ESCOLAR", "CO")).toBeNull();
  });

  // Mutación que la mata: devolver 50 por defecto para cualquier nivel: un examen de B2 saldría con reloj sin que nadie lo haya decidido.
  it("un nivel sin números no inventa minutos", () => {
    expect(minutosDePrueba("B2", "CE")).toBeNull();
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

```bash
npx vitest run tests/examen-motor.test.ts
```

Esperado: rojo, no existe `@/lib/examen/motor`.

- [ ] **Step 3: Escribir los minutos**

Al final de `lib/dele/estructura.ts`:

```ts
/**
 * Minutos de cada prueba. null = no lleva reloj. La auditiva no lo lleva a
 * propósito: la marca el audio, y las pistas del libro traen dentro las dos
 * audiciones, así que juntas pasan de los 30 minutos del papel oficial.
 * La escrita llega con la 3d.
 */
export const MINUTOS_DE_PRUEBA: Readonly<Record<Nivel, Readonly<Record<Prueba, number | null>>>> = {
  A2_B1_ESCOLAR: { CE: 50, CO: null, EE: null, EO: null },
  A1: { CE: null, CO: null, EE: null, EO: null },
  A2: { CE: null, CO: null, EE: null, EO: null },
  B1: { CE: null, CO: null, EE: null, EO: null },
  B2: { CE: null, CO: null, EE: null, EO: null },
};

export function minutosDePrueba(nivel: Nivel, prueba: Prueba): number | null {
  return MINUTOS_DE_PRUEBA[nivel][prueba];
}
```

- [ ] **Step 4: Escribir el motor**

Crear `lib/examen/motor.ts`:

```ts
/**
 * La aritmética del examen del estudiante. Aquí no hay base de datos ni
 * `new Date()`: el «ahora» entra por argumento en todas las funciones que lo
 * necesitan. Es lo que permite probar el reloj sin esperar cincuenta minutos y
 * sin que el color de la suite dependa del huso del portátil.
 */

/** Lo que se le perdona a la red para que la última respuesta no se pierda por el viaje. */
export const SEGUNDOS_DE_GRACIA = 10;

export type Fallo = { numero: number; marcada: string | null };
export type Nota = { aciertos: number; total: number; fallos: Fallo[] };

export type EstadoDePrueba = {
  estado: "SIN_EMPEZAR" | "HACIENDO" | "ENTREGADA";
  aciertos: number | null;
  total: number | null;
  porTiempo: boolean;
};

const limpia = (letra: string | undefined): string | null => {
  const s = (letra ?? "").trim().toUpperCase();
  return s === "" ? null : s;
};

/**
 * La nota manda la CLAVE, no lo que mandó el navegador: se recorre la clave, y
 * una respuesta a una pregunta que no existe ni suma ni aparece en los fallos.
 * Lo no marcado es un fallo, no un regalo.
 */
export function notaDePrueba(clave: Record<string, string>, respuestas: Record<string, string>): Nota {
  const numeros = Object.keys(clave).sort((a, b) => Number(a) - Number(b));
  let aciertos = 0;
  const fallos: Fallo[] = [];
  for (const n of numeros) {
    const marcada = limpia(respuestas[n]);
    if (marcada !== null && marcada === limpia(clave[n])) aciertos++;
    else fallos.push({ numero: Number(n), marcada });
  }
  return { aciertos, total: numeros.length, fallos };
}

export function segundosQueQuedan(empezadaEn: Date, minutos: number | null, ahora: Date): number | null {
  if (minutos === null) return null;
  const pasados = (ahora.getTime() - empezadaEn.getTime()) / 1000;
  return Math.max(0, Math.floor(minutos * 60 - pasados));
}

export function seAcaboElTiempo(empezadaEn: Date, minutos: number | null, ahora: Date): boolean {
  if (minutos === null) return false;
  const pasados = (ahora.getTime() - empezadaEn.getTime()) / 1000;
  return pasados > minutos * 60 + SEGUNDOS_DE_GRACIA;
}

/** El menor trozo que todavía no ha sonado. Con huecos también: no vale contar cuántos van. */
export function siguienteTrozo(oidos: readonly number[], trozos: number): number | null {
  for (let n = 1; n <= trozos; n++) if (!oidos.includes(n)) return n;
  return null;
}

export function estadoDePrueba(
  intento: { entregadaEn: Date | null; aciertos: number | null; total: number | null; porTiempo: boolean } | null,
): EstadoDePrueba {
  if (!intento) return { estado: "SIN_EMPEZAR", aciertos: null, total: null, porTiempo: false };
  return {
    estado: intento.entregadaEn ? "ENTREGADA" : "HACIENDO",
    aciertos: intento.aciertos,
    total: intento.total,
    porTiempo: intento.porTiempo,
  };
}

export function textoDelEstado(e: EstadoDePrueba): string {
  if (e.estado === "SIN_EMPEZAR") return "Sin empezar";
  if (e.estado === "HACIENDO") return "A medias";
  const nota = e.total === null ? "" : `, ${e.aciertos} de ${e.total}`;
  return `${e.porTiempo ? "Entregada por tiempo" : "Entregada"}${nota}`;
}
```

- [ ] **Step 5: Correr la prueba y verla pasar**

```bash
npx vitest run tests/examen-motor.test.ts
```

- [ ] **Step 6: Mutar a mano una de las tres comprobaciones finas y ver rojo**

Cambiar `pasados > minutos * 60 + SEGUNDOS_DE_GRACIA` por `pasados > minutos * 60`, correr, **ver rojo**, y deshacer. Un comentario de mutación sin comprobar no vale.

- [ ] **Step 7: Commit**

```bash
git add lib/examen/motor.ts lib/dele/estructura.ts tests/examen-motor.test.ts
git commit -m "El motor del examen: nota, reloj, que trozo toca y como se llama cada estado"
```

---

## Task 3: Leer la prueba para hacerla, sin que la clave se cuele

**Files:**
- Create: `lib/examen/paraHacer.ts`
- Test: `tests/base/examen-para-hacer.test.ts`

**Interfaces:**
- Consumes: `formularioDePiezas` (`lib/taller/piezas.ts`), `reglaDe` y `minutosDePrueba` (`lib/dele/estructura.ts`), `segundosQueQuedan` y `estadoDePrueba` (`lib/examen/motor.ts`).
- Produces:

```ts
export type TareaParaHacer = {
  numero: number;
  regla: ReglaTarea;
  formulario: Formulario;   // lleva las fotos y la pista en `medios`; nunca la clave
  trozos: number;           // 0 si la tarea no lleva audio
  oidos: number[];
};
export type PruebaParaHacer = {
  examen: { id: string; titulo: string; nivel: Nivel };
  prueba: Prueba;
  modo: ModoDeExamen;
  fechaTope: Date;
  minutos: number | null;
  tareas: TareaParaHacer[];
  estado: EstadoDePrueba;
  segundosQueQuedan: number | null;
  respuestas: Record<string, string>;
  fallos: number[];
};
export async function pruebaParaHacer(
  examenId: string, prueba: Prueba, personaId: string, ahora: Date,
): Promise<PruebaParaHacer | null>;
```

Devuelve `null` —y la pantalla contesta 404— si el examen no existe, si no está PUBLICADO, si esa persona no lo tiene asignado, o si la prueba no es CE ni CO.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/base/examen-para-hacer.test.ts`. Hace falta un examen con una tarea guardada de verdad; se monta con `guardarTarea`, que es lo que usa el taller.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { guardarTarea } from "@/lib/taller/examenes";
import { pruebaParaHacer } from "@/lib/examen/paraHacer";

const TOPE = finDelDiaEnMadrid("2026-10-20")!;
const AHORA = new Date("2026-09-20T09:00:00Z");

// Clave INVENTADA de la lectura 2 (preguntas 7-12). El repositorio es público:
// la del libro no entra aquí, se contrasta a mano en la aceptación.
export const CLAVE_INVENTADA: Record<string, string> = {
  "7": "A", "8": "B", "9": "C", "10": "A", "11": "B", "12": "C",
};

let ana: Persona;
let luis: Persona;
let examen: Examen;

/** Una tarea de lectura 2 con sus seis preguntas y su clave inventada. */
async function guardarLectura2() {
  const regla = reglaDe("A2_B1_ESCOLAR", "CE", 2)!;
  const f = formularioVacio(regla);
  if (f.forma !== "LISTA_COMUN") throw new Error("la lectura 2 es LISTA_COMUN");
  f.consigna = "Lee los textos.";
  f.textos = f.textos.map((t, i) => ({ etiqueta: `Persona ${i + 1}`, texto: `Texto ${i + 1}` }));
  f.actividad.comunes = f.actividad.comunes.map((c) => ({ ...c, texto: `Persona ${c.letra}` }));
  f.actividad.preguntas = f.actividad.preguntas.map((p) => ({ ...p, enunciado: `Pregunta ${p.numero}` }));
  await guardarTarea(examen.id, "CE", 2, f);
}

beforeEach(async () => {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  luis = await prisma.persona.create({ data: { correo: "luis@ejemplo.com", nombre: "Luis", papel: "ESTUDIANTE" } });
  // Sin cuadernillo y sin número, `guardarTarea` guarda la tarea SIN clave: la
  // clave se copia del cuadernillo en ese momento (Entrega 1). Sin estas dos
  // líneas, la comprobación de más abajo («la clave existe de verdad») es
  // imposible de poner en verde, y la nota de la Task 4 saldría siempre 0 de 0.
  await prisma.cuadernillo.deleteMany();
  const cuadernillo = await prisma.cuadernillo.create({
    data: { titulo: "Cuadernillo inventado", texto: "", soluciones: { "1": { CE: CLAVE_INVENTADA, CO: {} } } },
  });
  examen = await prisma.examen.create({
    data: { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", cuadernilloId: cuadernillo.id, numeroEnCuadernillo: 1 },
  });
  await guardarLectura2();
  await prisma.examen.update({ where: { id: examen.id }, data: { estado: "PUBLICADO" } });
  await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
});

describe("leer una prueba para hacerla", () => {
  // Mutación que la mata: devolver la tarea leída de la base tal cual, con su
  // `clave` incluida. Es LA prueba de esta entrega: la respuesta correcta no
  // puede llegar al navegador de quien está haciendo el examen.
  it("no devuelve ni un solo campo con las respuestas correctas", async () => {
    const leido = await pruebaParaHacer(examen.id, "CE", ana.id, AHORA);
    expect(leido).not.toBeNull();
    const prohibidos: string[] = [];
    const mirar = (valor: unknown, camino: string) => {
      if (Array.isArray(valor)) return valor.forEach((v, i) => mirar(v, `${camino}[${i}]`));
      if (valor && typeof valor === "object") {
        for (const [k, v] of Object.entries(valor)) {
          if (k === "clave" || k === "respuestasCorrectas" || k === "soluciones") prohibidos.push(`${camino}.${k}`);
          mirar(v, `${camino}.${k}`);
        }
      }
    };
    mirar(leido, "prueba");
    expect(prohibidos).toEqual([]);
    // Y la clave existe de verdad en la base: si no, esta prueba no probaría nada.
    expect(await prisma.clave.count()).toBe(1);
  });

  // Mutación que la mata: dejar de filtrar por asignación. Cualquiera con sesión
  // podría abrir el examen de otro escribiendo su identificador.
  it("solo lo lee quien lo tiene asignado, y solo si está publicado", async () => {
    expect(await pruebaParaHacer(examen.id, "CE", luis.id, AHORA)).toBeNull();
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "EN_CONSTRUCCION" } });
    expect(await pruebaParaHacer(examen.id, "CE", ana.id, AHORA)).toBeNull();
  });

  // Mutación que la mata: aceptar cualquier prueba. La escrita y la oral no
  // tienen pantalla hasta la 3d y la 3e.
  it("la escrita y la oral todavía no", async () => {
    expect(await pruebaParaHacer(examen.id, "EE", ana.id, AHORA)).toBeNull();
    expect(await pruebaParaHacer(examen.id, "EO", ana.id, AHORA)).toBeNull();
  });

  // Mutación que la mata: devolver las tareas en el orden que las dé la base.
  it("trae las tareas guardadas, en orden, con su regla y sus minutos", async () => {
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, AHORA))!;
    expect(leido.minutos).toBe(50);
    expect(leido.modo).toBe("COMPLETO");
    expect(leido.tareas.map((t) => t.numero)).toEqual([2]);
    expect(leido.tareas[0]!.formulario.consigna).toBe("Lee los textos.");
    expect(leido.tareas[0]!.trozos).toBe(0);
    expect(leido.estado.estado).toBe("SIN_EMPEZAR");
    expect(leido.segundosQueQuedan).toBeNull();
  });

  // Mutación que la mata: calcular los segundos desde «ahora» en vez de desde
  // que empezó, o no devolver lo que ya lleva marcado.
  it("con la prueba empezada trae el reloj y lo que lleva marcado", async () => {
    const asignacion = await prisma.asignacion.findFirstOrThrow();
    const intento = await prisma.intento.create({
      data: { asignacionId: asignacion.id, prueba: "CE", empezadaEn: AHORA },
    });
    await prisma.respuestaDeIntento.create({ data: { intentoId: intento.id, numero: 8, letra: "B" } });

    const diezMinutosDespues = new Date(AHORA.getTime() + 10 * 60_000);
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, diezMinutosDespues))!;
    expect(leido.estado.estado).toBe("HACIENDO");
    expect(leido.segundosQueQuedan).toBe(40 * 60);
    expect(leido.respuestas).toEqual({ "8": "B" });
  });

  // Mutación que la mata: no leer los trozos oídos; la cinta los volvería a poner.
  it("trae los trozos que ya han sonado", async () => {
    const asignacion = await prisma.asignacion.findFirstOrThrow();
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE", empezadaEn: AHORA } });
    await prisma.trozoOido.create({ data: { intentoId: intento.id, tarea: 2, trozo: 1 } });
    const leido = (await pruebaParaHacer(examen.id, "CE", ana.id, AHORA))!;
    expect(leido.tareas[0]!.oidos).toEqual([1]);
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

```bash
npm run test:base -- tests/base/examen-para-hacer.test.ts
```

- [ ] **Step 3: Escribir `lib/examen/paraHacer.ts`**

```ts
import { prisma } from "@/lib/db";
import type { ModoDeExamen, Nivel, Prueba } from "@/lib/generated/prisma";
import { minutosDePrueba, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { formularioDePiezas } from "@/lib/taller/piezas";
import type { Formulario } from "@/lib/taller/formas";
import { estadoDePrueba, segundosQueQuedan, type EstadoDePrueba } from "./motor";

export type TareaParaHacer = {
  numero: number;
  regla: ReglaTarea;
  formulario: Formulario;
  trozos: number;
  oidos: number[];
};

export type PruebaParaHacer = {
  examen: { id: string; titulo: string; nivel: Nivel };
  prueba: Prueba;
  modo: ModoDeExamen;
  fechaTope: Date;
  minutos: number | null;
  tareas: TareaParaHacer[];
  estado: EstadoDePrueba;
  segundosQueQuedan: number | null;
  respuestas: Record<string, string>;
  fallos: number[];
};

/** Las únicas dos pruebas que el estudiante puede hacer hoy. La 3d y la 3e traerán las otras. */
export const PRUEBAS_QUE_SE_HACEN: readonly Prueba[] = ["CE", "CO"];

/**
 * La única puerta por la que una prueba sale hacia el navegador del estudiante.
 * Se construye campo a campo, como `actividadParaElEstudiante`: la consulta ni
 * siquiera selecciona la tabla `Clave`, y aunque mañana alguien la incluyera,
 * este objeto no tiene dónde meterla.
 */
export async function pruebaParaHacer(
  examenId: string,
  prueba: Prueba,
  personaId: string,
  ahora: Date,
): Promise<PruebaParaHacer | null> {
  if (!PRUEBAS_QUE_SE_HACEN.includes(prueba)) return null;

  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    include: {
      examen: {
        select: {
          id: true,
          titulo: true,
          nivel: true,
          estado: true,
          tareas: {
            where: { prueba },
            orderBy: { numero: "asc" },
            select: {
              numero: true,
              // Sin `clave`: la respuesta correcta no sale de su tabla.
              piezas: { select: { orden: true, tipo: true, texto: true, etiqueta: true, ficheroId: true, cortes: true, actividad: { select: { datos: true } } } },
            },
          },
        },
      },
      intentos: { where: { prueba }, include: { respuestas: true, trozosOidos: true } },
    },
  });
  if (!asignacion || asignacion.examen.estado !== "PUBLICADO") return null;

  const intento = asignacion.intentos[0] ?? null;
  const oidosDe = (numero: number) =>
    (intento?.trozosOidos ?? []).filter((t) => t.tarea === numero).map((t) => t.trozo).sort((a, b) => a - b);

  const tareas = asignacion.examen.tareas.flatMap((t): TareaParaHacer[] => {
    const regla = reglaDe(asignacion.examen.nivel, prueba, t.numero);
    const formulario = formularioDePiezas(t.piezas);
    if (!regla || !formulario) return [];
    return [{ numero: t.numero, regla, formulario, trozos: regla.trozos ?? 0, oidos: oidosDe(t.numero) }];
  });

  const minutos = minutosDePrueba(asignacion.examen.nivel, prueba);
  return {
    examen: { id: asignacion.examen.id, titulo: asignacion.examen.titulo, nivel: asignacion.examen.nivel },
    prueba,
    modo: asignacion.modo,
    fechaTope: asignacion.fechaTope,
    minutos,
    tareas,
    estado: estadoDePrueba(intento),
    segundosQueQuedan: intento && !intento.entregadaEn ? segundosQueQuedan(intento.empezadaEn, minutos, ahora) : null,
    respuestas: Object.fromEntries((intento?.respuestas ?? []).map((r) => [String(r.numero), r.letra])),
    fallos: intento?.fallos ?? [],
  };
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

```bash
npm run test:base -- tests/base/examen-para-hacer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/examen/paraHacer.ts tests/base/examen-para-hacer.test.ts
git commit -m "Leer una prueba para hacerla, con la clave fuera de la consulta"
```

---

## Task 4: Las seis escrituras

**Files:**
- Create: `lib/examen/hacer.ts`
- Modify: `lib/examen/asignar.ts` (quitar una asignación con intento no deja)
- Test: `tests/base/intentos.test.ts` (ampliando), `tests/base/asignaciones.test.ts` (ampliando)

**Interfaces:**
- Consumes: `notaDePrueba`, `seAcaboElTiempo` (`lib/examen/motor.ts`).
- Produces:

```ts
export async function empezarPrueba(examenId: string, prueba: Prueba, personaId: string, ahora: Date): Promise<{ error?: string }>;
export async function guardarRespuesta(examenId: string, prueba: Prueba, personaId: string, numero: number, letra: string, ahora: Date): Promise<{ error?: string }>;
export async function marcarTrozo(examenId: string, prueba: Prueba, personaId: string, tarea: number, trozo: number, ahora: Date): Promise<{ error?: string }>;
export async function entregarPrueba(examenId: string, prueba: Prueba, personaId: string, ahora: Date, porTiempo: boolean): Promise<{ error?: string }>;
export async function cerrarLasQueSePasaron(donde: { personaId: string } | { examenId: string }, ahora: Date): Promise<void>;
export async function corregirEnLibre(examenId: string, prueba: Prueba, personaId: string, respuestas: Record<string, string>): Promise<Nota | { error: string }>;
```

Los mensajes de error son los de la sección 9 de la spec, **literales**: «Esta prueba ya está entregada.», «Se acabó el tiempo.», «Este examen ya no está disponible.», «Este examen no es tuyo.», «Esa prueba todavía no se puede hacer.»

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/base/intentos.test.ts`. Su `beforeEach` tiene que montar lo mismo que el de la Task 3 —cuadernillo inventado, examen con `numeroEnCuadernillo: 1`, `guardarLectura2()`, publicar y asignar—, así que **ese montaje se saca a `tests/ayudas/examen-de-pruebas.ts`** y lo importan las dos, junto con `CLAVE_INVENTADA`. Copiarlo dos veces es lo que hace que una de las dos se quede vieja:

```ts
describe("hacer la prueba", () => {
  // Mutación que la mata: cambiar el upsert por un create, o no comprobar el
  // intento que ya existe: el reloj arrancaría de nuevo y regalaría 50 minutos.
  it("empezar dos veces no reinicia el reloj", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await empezarPrueba(examen.id, "CE", ana.id, new Date(AHORA.getTime() + 20 * 60_000));
    const intentos = await prisma.intento.findMany();
    expect(intentos).toHaveLength(1);
    expect(intentos[0]!.empezadaEn.toISOString()).toBe(AHORA.toISOString());
  });

  // Mutación que la mata: dejar de comprobar la asignación.
  it("no empieza quien no lo tiene asignado", async () => {
    expect(await empezarPrueba(examen.id, "CE", luis.id, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    expect(await prisma.intento.count()).toBe(0);
  });

  // Mutación que la mata: guardar sin mirar el reloj del servidor. El navegador
  // no es de fiar: es el sitio donde el estudiante puede tocar la hora.
  it("una respuesta tardía no se guarda y cierra la prueba", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    expect(await guardarRespuesta(examen.id, "CE", ana.id, 8, "B", tarde)).toEqual({ error: "Se acabó el tiempo." });
    expect(await prisma.respuestaDeIntento.count()).toBe(0);
    const intento = await prisma.intento.findFirstOrThrow();
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.porTiempo).toBe(true);
  });

  // Mutación que la mata: quitar los diez segundos de gracia.
  it("dentro de la gracia todavía entra", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    const justo = new Date(AHORA.getTime() + 50 * 60_000 + 5_000);
    expect(await guardarRespuesta(examen.id, "CE", ana.id, 8, "B", justo)).toEqual({});
    expect(await prisma.respuestaDeIntento.count()).toBe(1);
  });

  // Mutación que la mata: dejar escribir sobre una prueba entregada.
  it("una prueba entregada no admite ni una letra más", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await entregarPrueba(examen.id, "CE", ana.id, AHORA, false);
    expect(await guardarRespuesta(examen.id, "CE", ana.id, 8, "B", AHORA)).toEqual({ error: "Esta prueba ya está entregada." });
    expect(await empezarPrueba(examen.id, "CE", ana.id, AHORA)).toEqual({ error: "Esta prueba ya está entregada." });
  });

  // Mutación que la mata: borrar y reescribir el trozo en vez de no tocarlo.
  it("marcar un trozo dos veces no lo devuelve", async () => {
    await empezarPrueba(examen.id, "CO", ana.id, AHORA);
    expect(await marcarTrozo(examen.id, "CO", ana.id, 1, 1, AHORA)).toEqual({});
    expect(await marcarTrozo(examen.id, "CO", ana.id, 1, 1, AHORA)).toEqual({});
    const oidos = await prisma.trozoOido.findMany();
    expect(oidos).toHaveLength(1);
  });

  // Mutación que la mata: calcular la nota al leer el resultado en vez de al
  // entregar. Corregir una tarea después no puede cambiarle la nota a nadie.
  it("la nota y los fallos se congelan al entregar", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await guardarRespuesta(examen.id, "CE", ana.id, 7, CLAVE_INVENTADA["7"], AHORA);
    await guardarRespuesta(examen.id, "CE", ana.id, 8, "Z", AHORA);
    await entregarPrueba(examen.id, "CE", ana.id, AHORA, false);

    const antes = await prisma.intento.findFirstOrThrow();
    expect(antes.aciertos).toBe(1);
    expect(antes.total).toBe(6);
    expect(antes.fallos).toEqual([8, 9, 10, 11, 12]);

    await prisma.clave.deleteMany();
    const despues = await prisma.intento.findFirstOrThrow();
    expect(despues.aciertos).toBe(1);
    expect(despues.fallos).toEqual([8, 9, 10, 11, 12]);
  });

  // Mutación que la mata: no cerrar las pasadas de hora al mirar. Quien cierre el
  // portátil a mitad se quedaría «a medias» para siempre y sin nota.
  it("al mirar, la que se pasó de hora queda entregada por tiempo", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await cerrarLasQueSePasaron({ personaId: ana.id }, new Date(AHORA.getTime() + 51 * 60_000));
    const intento = await prisma.intento.findFirstOrThrow();
    expect(intento.porTiempo).toBe(true);
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.total).toBe(6);
  });

  // Mutación que la mata: cerrar también las que van en hora.
  it("al mirar, la que va en hora no se toca", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await cerrarLasQueSePasaron({ personaId: ana.id }, new Date(AHORA.getTime() + 10 * 60_000));
    expect((await prisma.intento.findFirstOrThrow()).entregadaEn).toBeNull();
  });

  // Mutación que la mata: guardar algo en modo libre, o devolver la letra buena.
  it("corregir en libre no guarda nada y no dice la buena", async () => {
    await prisma.asignacion.updateMany({ where: { personaId: ana.id }, data: { modo: "LIBRE" } });
    const nota = await corregirEnLibre(examen.id, "CE", ana.id, { "7": CLAVE_INVENTADA["7"], "8": "Z" });
    expect(nota).toMatchObject({ aciertos: 1, total: 6 });
    expect(JSON.stringify(nota)).not.toContain(CLAVE_INVENTADA["8"]);
    expect(await prisma.intento.count()).toBe(0);
  });
});
```

Y en `tests/base/asignaciones.test.ts`:

```ts
// Mutación que la mata: quitar la comprobación del intento. La asignación cae en
// cascada sobre el intento: quitar a alguien de la lista le borraría la nota.
it("no se quita una asignación con un examen empezado", async () => {
  const asignacion = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
  await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "CE" } });
  expect(await quitarAsignacion(examen.id, ana.id)).toEqual({ error: "Ana ya ha empezado este examen: no se le puede quitar." });
  expect(await prisma.asignacion.count()).toBe(1);
  expect(await prisma.intento.count()).toBe(1);
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

```bash
npm run test:base -- tests/base/intentos.test.ts tests/base/asignaciones.test.ts
```

- [ ] **Step 3: Escribir `lib/examen/hacer.ts`**

Puntos que no se pueden negociar al escribirlo:

1. **Una sola guarda compartida**, `abrirLaPrueba(examenId, prueba, personaId, ahora, { exigirEmpezada })`, que devuelve `{ asignacion, intento }` o `{ error }`, y que comprueba **en este orden**: la prueba es CE o CO; hay asignación; el examen está PUBLICADO; el intento no está entregado; no se acabó el tiempo. Si se acabó, **cierra la prueba** (la entrega con `porTiempo`) antes de devolver el error, porque el error y el cierre son la misma noticia.
2. **La clave sale de las `Clave` guardadas de las tareas de esa prueba**, no del cuadernillo: es la que se congeló al guardar la tarea. Función privada `claveDeLaPrueba(examenId, prueba)`, que **no se exporta**.
3. `entregarPrueba` calcula `notaDePrueba` y guarda `aciertos`, `total` y `fallos` (los números, de `nota.fallos.map(f => f.numero)`) en la misma escritura que `entregadaEn`.
4. `cerrarLasQueSePasaron` busca los intentos sin entregar de ese ámbito, y entrega los que `seAcaboElTiempo` diga. Es idempotente: llamarla dos veces no cambia nada.
5. `marcarTrozo` usa `upsert` con la clave `[intentoId, tarea, trozo]` y no toca `oidoEn` si ya estaba: el trozo se apunta una vez.
6. `corregirEnLibre` exige que la asignación sea de modo LIBRE, **no escribe nada** y devuelve solo `{ aciertos, total, fallos }` — y `fallos` lleva lo que marcó el estudiante, nunca la letra buena.

- [ ] **Step 4: Cerrar la puerta de `quitarAsignacion`**

En `lib/examen/asignar.ts`, antes de borrar: si esa asignación tiene algún `Intento`, devolver `{ error: "<nombre> ya ha empezado este examen: no se le puede quitar." }`.

- [ ] **Step 5: Correr las pruebas y verlas pasar**

```bash
npm run test:base
```

- [ ] **Step 6: Commit**

```bash
git add lib/examen/hacer.ts lib/examen/asignar.ts tests/base/intentos.test.ts tests/base/asignaciones.test.ts
git commit -m "Empezar, guardar, marcar trozo, entregar, cerrar las pasadas de hora y corregir en libre"
```

---

## Task 5: La tercera rama del candado, y el audio que dura lo que dura la pista

**Files:**
- Modify: `lib/ficheros/permisos.ts`, `app/api/ficheros/[id]/route.ts`, `lib/ficheros/vercel.ts`
- Test: `tests/ficheros-permisos.test.ts`, `tests/ficheros-rutas.test.ts` (los dos ampliando)

**Interfaces:**
- Produces:

```ts
// lib/ficheros/permisos.ts — la firma CAMBIA, y todas las llamadas con ella
export type PiezaDelFichero = { tarea: { examenId: string; prueba: Prueba } };
export type PruebaAbierta = { examenId: string; prueba: Prueba };
export function puedeVerFichero(
  persona: { id: string; papel: Papel },
  fichero: { subidoPorId: string | null; piezas: PiezaDelFichero[] },
  abiertas: readonly PruebaAbierta[],
): boolean;

// lib/ficheros/vercel.ts
export const MINUTOS_DE_LECTURA_DE_AUDIO = 60;
export async function enlaceDeLectura(ruta: string, ahora: Date, minutos?: number): Promise<string>;
```

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/ficheros-permisos.test.ts`, la regla suelta:

```ts
const PISTA = { subidoPorId: "profesor", piezas: [{ tarea: { examenId: "ex1", prueba: "CO" as const } }] };
const PAGINA = { subidoPorId: "profesor", piezas: [] };
const ANA = { id: "ana", papel: "ESTUDIANTE" as const };

// Mutación que la mata: dar por buena cualquier pieza sin mirar si la prueba está
// abierta. El estudiante se bajaría la pista antes de empezar y la oiría entera.
it("el estudiante ve la pista solo con su prueba abierta", () => {
  expect(puedeVerFichero(ANA, PISTA, [])).toBe(false);
  expect(puedeVerFichero(ANA, PISTA, [{ examenId: "ex1", prueba: "CE" }])).toBe(false);
  expect(puedeVerFichero(ANA, PISTA, [{ examenId: "otro", prueba: "CO" }])).toBe(false);
  expect(puedeVerFichero(ANA, PISTA, [{ examenId: "ex1", prueba: "CO" }])).toBe(true);
});

// Mutación que la mata: meter las páginas en la lista blanca. Una hoja escaneada
// no cuelga de ninguna pieza, y es el examen entero en PDF.
it("una página escaneada no la ve ningún estudiante, nunca", () => {
  expect(puedeVerFichero(ANA, PAGINA, [{ examenId: "ex1", prueba: "CO" }])).toBe(false);
  expect(puedeVerFichero({ id: "p", papel: "PROFESOR" }, PAGINA, [])).toBe(true);
});
```

En `tests/ficheros-rutas.test.ts`, la ruta entera con la red doblada: con la auditiva **sin empezar**, pedir la pista da **404** y `enlaceDeLectura` **no llega a llamarse**; con la asignación en modo **libre**, 307 sin haber empezado nada; y el enlace de un fichero `audio/mpeg` se pide con **60 minutos** y el de una foto con los 5 de siempre.

- [ ] **Step 2: Correrlas y verlas fallar**

```bash
npx vitest run tests/ficheros-permisos.test.ts tests/ficheros-rutas.test.ts
```

- [ ] **Step 3: Escribir la rama nueva**

`puedeVerFichero` sigue siendo pura y lista blanca: profesor todo; dueño de lo que subió; y **alguna de sus piezas pertenece a una tarea de un examen y una prueba que están en `abiertas`**. Nada más.

- [ ] **Step 4: Darle a la ruta lo que la función necesita**

En `app/api/ficheros/[id]/route.ts`: cargar el fichero con `include: { piezas: { select: { tarea: { select: { examenId: true, prueba: true } } } } }`, y calcular `abiertas` con **una** consulta a `asignacion` de esa persona: las de modo LIBRE abren las cuatro pruebas de su examen; las de modo COMPLETO abren las pruebas con intento empezado (entregado incluido: la pantalla de resultados enseña las fotos de lo que falló). Al profesor no se le pide nada de esto.

Y el plazo del enlace:

```ts
const minutos = fichero.tipoMime.startsWith("audio/") ? MINUTOS_DE_LECTURA_DE_AUDIO : MINUTOS_DE_LECTURA;
const url = await enlaceDeLectura(fichero.ruta, new Date(), minutos);
```

Con su comentario al lado, que es el que explica por qué se rompe la regla de «pocos minutos»: una pista de once minutos que el navegador vuelve a pedir a mitad se encontraría el enlace muerto y la cinta se quedaría muda.

- [ ] **Step 5: Correr toda la suite sin base y verla pasar**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add lib/ficheros/permisos.ts lib/ficheros/vercel.ts app/api/ficheros tests/ficheros-permisos.test.ts tests/ficheros-rutas.test.ts
git commit -m "El candado deja ver las fotos y la pista de la prueba abierta, y el audio vive una hora"
```

---

## Task 6: Las acciones de servidor del estudiante

**Files:**
- Create: `app/examen/acciones.ts`
- Test: `tests/examen-acciones.test.ts`

**Interfaces:**
- Consumes: todo lo de `lib/examen/hacer.ts`, y `exigirPersona` de `lib/puerta/sesion-http.ts`.
- Produces:

```ts
export async function empezarPruebaAccion(examenId: string, prueba: Prueba): Promise<{ error?: string }>;
export async function guardarRespuestaAccion(examenId: string, prueba: Prueba, numero: number, letra: string): Promise<{ error?: string }>;
export async function marcarTrozoAccion(examenId: string, prueba: Prueba, tarea: number, trozo: number): Promise<{ error?: string }>;
export async function entregarPruebaAccion(examenId: string, prueba: Prueba, porTiempo: boolean): Promise<{ error?: string }>;
export async function corregirEnLibreAccion(examenId: string, prueba: Prueba, respuestas: Record<string, string>): Promise<Nota | { error: string }>;
```

**Ninguna de las cinco recibe un identificador de persona.** Sale siempre de la sesión. Es la regla que impide que un estudiante conteste el examen de otro llamando a la acción a mano, y está escrita como comentario en la cabecera del fichero.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/examen-acciones.test.ts`, con los mismos dobles de `tests/taller-acciones.test.ts` (cookies, `personaDeLaCookie`, `next/navigation`, `next/cache`) y doblando `@/lib/examen/hacer`:

```ts
// Una acción de servidor es una dirección pública: quien la conozca la llama sin
// pasar por la pantalla. Se llama a CADA una directamente, una por una.
describe("las acciones del estudiante", () => {
  // Mutación que la mata: borrar el `await exigirPersona()` de cualquiera de las cinco.
  it("sin sesión no entra ninguna", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(null);
    await expect(empezarPruebaAccion("ex1", "CE")).rejects.toThrow("REDIRECT:/entrar");
    await expect(guardarRespuestaAccion("ex1", "CE", 8, "B")).rejects.toThrow("REDIRECT:/entrar");
    await expect(marcarTrozoAccion("ex1", "CO", 1, 1)).rejects.toThrow("REDIRECT:/entrar");
    await expect(entregarPruebaAccion("ex1", "CE", false)).rejects.toThrow("REDIRECT:/entrar");
    await expect(corregirEnLibreAccion("ex1", "CE", {})).rejects.toThrow("REDIRECT:/entrar");
    expect(dobles.empezarPrueba).not.toHaveBeenCalled();
  });

  // Mutación que la mata: coger la persona de un argumento en vez de de la sesión.
  // Con eso, un estudiante contestaría el examen de otro desde la consola.
  it("la persona sale de la sesión, y con ella se llama al motor", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ANA);
    dobles.empezarPrueba.mockResolvedValue({});
    await empezarPruebaAccion("ex1", "CE");
    expect(dobles.empezarPrueba).toHaveBeenCalledWith("ex1", "CE", ANA.id, expect.any(Date));
  });

  // Mutación que la mata: dejar pasar cualquier texto como prueba. `esPrueba` ya
  // existe y hay que usarlo: una prueba inventada no puede llegar a la base.
  it("una prueba que no existe rebota antes de tocar nada", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ANA);
    expect(await empezarPruebaAccion("ex1", "XX" as Prueba)).toEqual({ error: "Esa prueba todavía no se puede hacer." });
    expect(dobles.empezarPrueba).not.toHaveBeenCalled();
  });

  // Mutación que la mata: no revalidar. La pantalla del estudiante se quedaría
  // enseñando «a medias» después de entregar.
  it("entregar refresca la pantalla del examen", async () => {
    dobles.personaDeLaCookie.mockResolvedValue(ANA);
    dobles.entregarPrueba.mockResolvedValue({});
    await entregarPruebaAccion("ex1", "CE", false);
    expect(dobles.revalidatePath).toHaveBeenCalledWith("/examen/ex1/CE");
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

```bash
npx vitest run tests/examen-acciones.test.ts
```

- [ ] **Step 3: Escribir `app/examen/acciones.ts`**

`"use server"` arriba. Cada acción: `const persona = await exigirPersona();`, comprobar la prueba con `esPrueba` y `PRUEBAS_QUE_SE_HACEN`, llamar a su función de `lib/examen/hacer.ts` con `persona.id` y `new Date()`, y `revalidatePath(`/examen/${examenId}/${prueba}`)` en las que cambian lo que se ve.

- [ ] **Step 4: Correr la prueba y verla pasar**

```bash
npx vitest run tests/examen-acciones.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/examen/acciones.ts tests/examen-acciones.test.ts
git commit -m "Las cinco acciones del estudiante, con la persona siempre sacada de la sesion"
```

---

## Task 7: Las cuatro formas, como las ve el estudiante

**Files:**
- Create: `components/examen/tarea-del-estudiante.tsx`
- Test: `tests/examen-pantallas.test.tsx`

**Interfaces:**
- Consumes: `TareaParaHacer` (`lib/examen/paraHacer.ts`), `letrasPosibles` (`lib/taller/estado.ts`).
- Produces:

```tsx
export function TareaDelEstudiante({
  tarea, marcadas, fallos, bloqueada, alMarcar,
}: {
  tarea: TareaParaHacer;
  marcadas: Record<string, string>;
  /** Los números fallados. null mientras no esté corregida. */
  fallos: number[] | null;
  /** Entregada: se ve, no se toca. */
  bloqueada: boolean;
  alMarcar: (numero: number, letra: string) => void;
}): React.JSX.Element;
```

No sabe nada del audio: la cinta la pone quien la use (Task 9), encima de la actividad.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `tests/examen-pantallas.test.tsx`. Se pinta con `renderToStaticMarkup` y se monta cada forma con `formularioVacio(reglaDe(...))` relleno a mano, como hace `tests/taller-pantallas.test.ts`.

```tsx
// Mutación que la mata: pintar `datos` tal cual sin el estado marcado. El
// estudiante recargaría y se encontraría el examen en blanco.
it("enseña marcada la letra que ya eligió", () => {
  const html = pintar(lecturaDos(), { marcadas: { "8": "B" } });
  expect(html).toContain('value="B" checked');
});

// Mutación que la mata: dejar los radios vivos en una prueba entregada.
it("entregada se ve pero no se toca", () => {
  const html = pintar(lecturaDos(), { marcadas: { "8": "B" }, bloqueada: true });
  expect(html).toContain("disabled");
  expect(html).toContain("Pregunta 8");
});

// Mutación que la mata: enseñar la letra correcta al corregir. Es la decisión
// del profesor: ve su fallo, no la solución.
it("al corregir marca el fallo y NO dice cuál era la buena", () => {
  const tarea = lecturaDos();
  const html = pintar(tarea, { marcadas: { "8": "B" }, fallos: [8] });
  expect(html).not.toBe("");
  expect(html).toContain("data-fallo=\"8\"");
  expect(html).not.toContain("La respuesta correcta");
});

// Mutación que la mata: ofrecer en relacionar también la letra del ejemplo, que
// ya está gastada.
it("relacionar no ofrece la letra del ejemplo", () => {
  const html = pintar(lecturaUnoConEjemploEnB(), {});
  expect(html).not.toBe("");
  expect(html).not.toContain('value="B"');
  expect(html).toContain('value="A"');
});

// Mutación que la mata: no pintar las fotos de las opciones con imagen. La
// auditiva 1 son cuatro preguntas donde la respuesta ES la foto.
it("las opciones con foto salen por la ruta de ficheros", () => {
  const html = pintar(auditivaUnoConFotos(), {});
  expect(html).toContain('src="/api/ficheros/foto-1-A"');
});

// Mutación que la mata: dejar de pintar los textos sueltos (las tres personas de
// la lectura 2, el texto largo de la 3). Sin ellos no se puede contestar.
it("los textos sueltos se pintan enteros", () => {
  const html = pintar(lecturaDos(), {});
  expect(html).toContain("Texto 1");
  expect(html).toContain("Texto 3");
});
```

- [ ] **Step 2: Correrla y verla fallar**

```bash
npx vitest run tests/examen-pantallas.test.tsx
```

- [ ] **Step 3: Escribir el componente**

`"use client"` arriba. Estructura, de fuera adentro:

1. La **consigna** en negrita.
2. Los **textos sueltos** (`tarea.formulario.textos`): cada uno con su etiqueta. En las formas con texto largo (`HUECOS` y la `OPCIONES` de lectura 3) van en una columna con `md:grid-cols-2` y `md:overflow-y-auto md:max-h-[70vh]`, y las preguntas al lado; en pantalla estrecha, uno debajo de otro. **A 400 px nunca hay dos columnas.**
3. La **actividad**, con un `switch (tarea.formulario.forma)`:
   - `RELACIONAR`: los destinos A-J con su título y su texto arriba; debajo, cada elemento con un `<select>` de `letrasPosibles(formulario, numero)`.
   - `LISTA_COMUN`: los comunes arriba; cada pregunta con sus radios.
   - `OPCIONES`: cada pregunta con su enunciado y sus tres opciones; si `opcion.conImagen`, el texto se sustituye por `<img src={`/api/ficheros/${formulario.medios.imagenes[`${numero}-${letra}`]}`} />`. El **ejemplo**, si lo hay, se pinta aparte y con su letra ya marcada, sin poder tocarlo.
   - `HUECOS`: el título, el texto y la fuente; debajo, los siete huecos con sus tres opciones.
4. Cada pregunta lleva `data-pregunta={numero}` y, si está en `fallos`, `data-fallo={numero}` y el borde en rojo (`border-error-600`). **Nunca** se pinta la letra correcta: no está en los datos, y no tiene que estarlo.
5. `bloqueada` pone `disabled` en todos los campos.

- [ ] **Step 4: Correr la prueba y verla pasar**

```bash
npx vitest run tests/examen-pantallas.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/examen/tarea-del-estudiante.tsx tests/examen-pantallas.test.tsx
git commit -m "Las cuatro formas cerradas, como las ve quien hace el examen"
```

---

## Task 8: El reloj, el armazón y la pantalla

**Files:**
- Create: `components/examen/reloj.tsx`, `components/examen/hacer-prueba.tsx`, `app/examen/[id]/[prueba]/page.tsx`
- Test: `tests/examen-pantallas.test.tsx` (ampliando)

**Interfaces:**
- Consumes: `TareaDelEstudiante` (Task 7), las acciones (Task 6), `pruebaParaHacer` (Task 3), `cerrarLasQueSePasaron` (Task 4).
- Produces:

```tsx
export function Reloj({ segundos, alAcabarse }: { segundos: number; alAcabarse: () => void }): React.JSX.Element;
export function HacerPrueba({ prueba }: { prueba: PruebaParaHacer }): React.JSX.Element;
```

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `tests/examen-pantallas.test.tsx`, doblando `@/lib/examen/paraHacer` y `@/lib/examen/hacer` como hace `tests/taller-pantallas.test.ts` con las suyas:

```tsx
// Mutación que la mata: enseñar el examen sin avisar. El aviso es lo que hace
// honesto el «no se puede repetir»: se dice ANTES, no después.
it("sin empezar enseña el aviso, no las preguntas", async () => {
  const html = await pintarPagina(sinEmpezar());
  expect(html).toContain("50 minutos");
  expect(html).toContain("no se puede repetir");
  expect(html).toContain("Empezar");
  expect(html).not.toContain("Pregunta 8");
});

// Mutación que la mata: pintar el reloj también en la auditiva, que no lo lleva.
it("la auditiva avisa de que cada audio suena una vez, y no lleva reloj", async () => {
  const html = await pintarPagina(sinEmpezarAuditiva());
  expect(html).toContain("una sola vez");
  expect(html).not.toContain("Te quedan");
});

// Mutación que la mata: no pintar el resultado, o pintar la letra buena.
it("entregada enseña la nota y los fallos", async () => {
  const html = await pintarPagina(entregadaCon19De25());
  expect(html).toContain("19 de 25");
  expect(html).not.toContain("La respuesta correcta");
});

// Mutación que la mata: dejar el reloj en la pantalla del modo libre.
it("en libre no hay reloj ni entregar, y sí corregir", async () => {
  const html = await pintarPagina(enLibre());
  expect(html).not.toBe("");
  expect(html).toContain("Corregir");
  expect(html).not.toContain("Te quedan");
  expect(html).not.toContain("Entregar");
});

// Mutación que la mata: quitar el `notFound()`. Sería una pantalla a medias de
// una prueba que no existe todavía.
it("la escrita y la oral contestan 404", async () => {
  dobles.pruebaParaHacer.mockResolvedValue(null);
  await expect(pintarPaginaDe("EE")).rejects.toThrow("NOT_FOUND");
});

// Mutación que la mata: no cerrar las pasadas de hora antes de pintar. Quien
// cerró el portátil vería «a medias» para siempre.
it("al abrir la pantalla se cierran las que se pasaron de hora", async () => {
  await pintarPagina(sinEmpezar());
  expect(dobles.cerrarLasQueSePasaron).toHaveBeenCalled();
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

```bash
npx vitest run tests/examen-pantallas.test.tsx
```

- [ ] **Step 3: Escribir el reloj**

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * La cuenta atrás. Solo pinta: los segundos de verdad los da el servidor al
 * cargar la pantalla, y este componente los va restando. Si el estudiante le
 * cambia la hora al móvil no pasa nada, porque cada escritura vuelve a
 * comprobar el tiempo contra el reloj del servidor.
 */
export function Reloj({ segundos, alAcabarse }: { segundos: number; alAcabarse: () => void }) {
  const [quedan, setQuedan] = useState(segundos);

  useEffect(() => {
    if (quedan <= 0) { alAcabarse(); return; }
    const t = setTimeout(() => setQuedan((q) => q - 1), 1000);
    return () => clearTimeout(t);
  }, [quedan, alAcabarse]);

  const minutos = Math.floor(quedan / 60);
  const resto = quedan % 60;
  return (
    <p data-reloj={quedan} className={`font-bold ${quedan <= 300 ? "text-error-600" : ""}`}>
      {`Te quedan ${minutos}:${String(resto).padStart(2, "0")}`}
    </p>
  );
}
```

- [ ] **Step 4: Escribir el armazón**

`components/examen/hacer-prueba.tsx`, de cliente. Lo que hace:

- Guarda en `useState` las respuestas marcadas, que nacen de `prueba.respuestas`.
- Pestañas «Tarea 1 · 2 · 3 · 4», con la tarea abierta en el estado. Cambiar de pestaña **no** va al servidor.
- Al marcar una letra: pinta el cambio en el acto y llama a `guardarRespuestaAccion`. Si devuelve error, lo enseña arriba en rojo y deja de aceptar respuestas.
- El `Reloj`, solo si `prueba.minutos !== null` y la prueba está a medias. Su `alAcabarse` llama a `entregarPruebaAccion(..., true)` y refresca.
- «Entregar», que pregunta una vez cuántas quedan sin marcar. En modo libre no existe: en su lugar, «Corregir» por tarea con `corregirEnLibreAccion`.
- Si está entregada: los fallos de `prueba.fallos`, la nota arriba, y todo `bloqueada`.

- [ ] **Step 5: Escribir la pantalla**

`app/examen/[id]/[prueba]/page.tsx`, de servidor:

```tsx
export default async function PantallaDelExamen({ params }: { params: Promise<{ id: string; prueba: string }> }) {
  const persona = await exigirPersona();
  const { id, prueba } = await params;
  if (!esPrueba(prueba)) notFound();
  // Primero se cierran las que se pasaron de hora: si no, quien cerró el
  // portátil vería «a medias» para siempre y no tendría nota nunca.
  await cerrarLasQueSePasaron({ personaId: persona.id }, new Date());
  const leida = await pruebaParaHacer(id, prueba, persona.id, new Date());
  if (!leida) notFound();
  return <HacerPrueba prueba={leida} />;
}
```

El aviso previo (cuando `estado.estado === "SIN_EMPEZAR"`) se pinta aquí o dentro de `HacerPrueba`, pero **el texto es el de la spec**: en la lectura, los 50 minutos, que se entrega sola y que no se puede repetir; en la auditiva, que **cada audio suena una sola vez** y que un corte de red cuesta ese trozo.

- [ ] **Step 6: Correr la suite entera y verla pasar**

```bash
npm test && npx tsc --noEmit && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add components/examen app/examen tests/examen-pantallas.test.tsx
git commit -m "El reloj, el armazon de la prueba y la pantalla con sus tres estados"
```

---

## Task 9: La cinta

**Files:**
- Create: `components/examen/cinta.tsx`
- Modify: `lib/examen/motor.ts` (los límites de un trozo), `components/examen/hacer-prueba.tsx` (colgarla de la tarea con audio)
- Test: `tests/examen-motor.test.ts` (ampliando)

**Interfaces:**
- Produces:

```ts
// lib/examen/motor.ts
/** De dónde a dónde suena un trozo. `hasta: null` = hasta el final del fichero. */
export function limitesDelTrozo(cortes: readonly number[], trozo: number): { desde: number; hasta: number | null };

// components/examen/cinta.tsx
export const SEGUNDOS_DE_PAUSA = 10;
export function Cinta({
  ficheroId, cortes, trozos, oidos, bloqueada, alSonar,
}: {
  ficheroId: string;
  cortes: number[];
  trozos: number;
  oidos: number[];
  bloqueada: boolean;
  /** Apunta el trozo en el servidor ANTES de que suene. Si falla, no suena. */
  alSonar: (trozo: number) => Promise<{ error?: string }>;
}): React.JSX.Element;
```

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `tests/examen-motor.test.ts`:

```ts
describe("de dónde a dónde suena un trozo", () => {
  // Mutación que la mata: cortar el último trozo en `duracion`. La duración que
  // declara el <audio> de un MP3 del libro sobra unos segundos (cabecera sin Xing
  // fiable), así que cortar por ahí se comería el final de la última noticia.
  it("el último suena hasta el final del fichero", () => {
    expect(limitesDelTrozo([113, 195], 3)).toEqual({ desde: 195, hasta: null });
  });

  it("el primero empieza en cero", () => {
    expect(limitesDelTrozo([113, 195], 1)).toEqual({ desde: 0, hasta: 113 });
  });

  // Mutación que la mata: confundir el índice con el número de trozo (el clásico
  // fallo de uno): el trozo 2 sonaría desde el principio.
  it("los de en medio van de marca a marca", () => {
    expect(limitesDelTrozo([113, 195], 2)).toEqual({ desde: 113, hasta: 195 });
  });

  it("una tarea sin marcas es un solo trozo, la pista entera", () => {
    expect(limitesDelTrozo([], 1)).toEqual({ desde: 0, hasta: null });
  });
});
```

- [ ] **Step 2: Correrla y verla fallar, escribir `limitesDelTrozo`, verla pasar**

```bash
npx vitest run tests/examen-motor.test.ts
```

- [ ] **Step 3: Escribir la cinta**

`"use client"`. Calca el `<audio>` de `components/taller/bloque-de-audio.tsx` (el mismo `useRef`, el mismo `onTimeUpdate` comparando con un `hasta.current`), con estas diferencias, que son el motivo de la entrega:

1. **Sin `controls`.** Nada de barra de arrastre: los botones son los nuestros.
2. `preload="auto"`, para que el navegador se traiga la pista de una vez y no dependa de pedir trozos sueltos más tarde.
3. Un solo botón visible según el estado: «Escuchar el audio» / «Sonando…» / «Sigue (7)» / «Este audio ya ha sonado».
4. Al pulsar: `await alSonar(n)`. **Si devuelve error, no suena** y se enseña «No se pudo preparar el audio. Vuelve a entrar.». Solo si va bien se pone `currentTime = desde`, `hasta.current = hasta` y `play()`.
5. En `onTimeUpdate`, al pasar de `hasta.current`: `pause()` y arranca la pausa de `SEGUNDOS_DE_PAUSA` con cuenta atrás visible; al acabarse (o al pulsar «Sigue»), suena el trozo siguiente, que se calcula con `siguienteTrozo`.
6. Cuando `siguienteTrozo` da `null`: «Este audio ya ha sonado.» y nada más.
7. En **modo libre** (`bloqueada === false` y sin racionamiento, que llega por props desde el armazón): el botón vuelve a poner el trozo cuantas veces quiera y no llama a `alSonar`.

Y un comentario arriba del fichero con lo que no se puede olvidar: **el trozo se apunta antes de sonar** —recargar no puede devolverlo— y **el navegador no deja sonar audio sin un gesto previo**, que es el botón «Empezar» del aviso.

- [ ] **Step 4: Colgarla del armazón**

En `hacer-prueba.tsx`, encima de la actividad, cuando `tarea.trozos > 0` y `tarea.formulario.medios.audio !== null`. `alSonar` es `marcarTrozoAccion.bind(null, examenId, prueba, tarea.numero)`.

- [ ] **Step 5: Correr todo**

```bash
npm test && npx tsc --noEmit && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/examen/motor.ts components/examen tests/examen-motor.test.ts
git commit -m "La cinta: un trozo cada vez, apuntado antes de sonar, y pausa para contestar"
```

---

## Task 10: Inicio del estudiante y la lista del profesor

**Files:**
- Modify: `lib/examen/asignar.ts`, `app/page.tsx`, `app/examenes/[id]/page.tsx`, `components/taller/quien-lo-hace.tsx`
- Test: `tests/portada.test.ts` (ampliando), `tests/taller-pantallas.test.ts` (ampliando), `tests/base/asignaciones.test.ts` (ampliando)

**Interfaces:**
- Produces:

```ts
export type EstadoDeUnaPrueba = { prueba: Prueba; estado: EstadoDePrueba; texto: string };
// AsignacionDelEstudiante gana: pruebas: EstadoDeUnaPrueba[]
// asignacionesDelExamen gana lo mismo por persona
```

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/portada.test.ts`:

```ts
// Mutación que la mata: dejar la línea «Todavía no puedes empezarlo» de la 3b.
// Es la frase que esta entrega viene a borrar.
it("el estudiante ve un botón por prueba, no la promesa de la 3b", async () => {
  dobles.asignacionesDe.mockResolvedValue([asignacionConLasDosSinEmpezar()]);
  const h = await html();
  expect(h).toContain("Lectura");
  expect(h).toContain("Auditiva");
  expect(h).toContain("/examen/ex1/CE");
  expect(h).not.toContain("Todavía no puedes empezarlo");
});

// Mutación que la mata: no pintar el estado. El estudiante no sabría si ya la hizo.
it("dice el estado de cada prueba", async () => {
  dobles.asignacionesDe.mockResolvedValue([asignacionConLectura19De25()]);
  const h = await html();
  expect(h).toContain("Entregada, 19 de 25");
});
```

En `tests/taller-pantallas.test.ts`, la caja «Quién lo hace»: junto a cada nombre salen los dos estados y la nota, y quien entregó fuera de plazo lo lleva escrito. Y en `tests/base/asignaciones.test.ts`, que `asignacionesDe` y `asignacionesDelExamen` traen los estados leídos de la base.

- [ ] **Step 2: Correrlas y verlas fallar**

```bash
npx vitest run tests/portada.test.ts tests/taller-pantallas.test.ts
```

- [ ] **Step 3: Los estados, en las dos listas**

En `lib/examen/asignar.ts`, las dos funciones incluyen `intentos` y devuelven, por prueba de `PRUEBAS_QUE_SE_HACEN`, `estadoDePrueba` y su `textoDelEstado`. Se siguen construyendo **campo a campo**: el comentario que ya está escrito ahí lo dice y ahora importa más, porque el intento sí trae la nota.

- [ ] **Step 4: Las dos pantallas**

- `app/page.tsx`: `await cerrarLasQueSePasaron({ personaId: persona.id }, new Date())` antes de leer; la tarjeta, con una fila por prueba, su estado y su botón, que es un **enlace** a `/examen/<id>/<prueba>` (no cambia nada, así que enlace está bien). En modo libre, «Practicar» y sin estado.
- `app/examenes/[id]/page.tsx`: `await cerrarLasQueSePasaron({ examenId: id }, new Date())` antes de leer, y pasar los estados a `<QuienLoHace>`, que los pinta junto a cada nombre con «2 días tarde» cuando `estaFueraDePlazo` diga.

- [ ] **Step 5: Correr todo**

```bash
npm test && npm run test:base && npx tsc --noEmit && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/examen/asignar.ts app/page.tsx app/examenes components/taller/quien-lo-hace.tsx tests/
git commit -m "Inicio con un boton por prueba, y la lista del profesor con estado y nota"
```

---

## Task 11 (del controlador): revisión, fusión y aceptación

No la hace un subagente de tarea: la hace quien dirige.

- [ ] **Step 1: Revisión final de toda la rama**

Con la skill `superpowers:requesting-code-review`, un revisor de opus sobre el diff entero contra `main`. Lo que tiene que mirar con lupa, porque son los sitios donde esta entrega se puede romper en silencio:

1. Que **ninguna** consulta que va hacia el navegador del estudiante seleccione `Clave`.
2. Que **todas** las escrituras pasen por la guarda de `hacer.ts`, y ninguna acción acepte un identificador de persona.
3. Que el candado de ficheros no tenga un camino que devuelva un enlace firmado sin pasar por `puedeVerFichero` (la revisión de la 3b rastreó todos: repetirlo).
4. Que los comentarios de mutación digan la verdad: coger tres al azar, mutar a mano y ver rojo.

- [ ] **Step 2: Las cuatro medidas, sobre el commit que se va a fusionar**

```bash
npm test && npm run test:base && npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Fusionar con el sí del profesor, y empujar el commit medido**

Con la skill `abrir-rama-en-worktree`: mirar `git status` del checkout principal antes de fusionar, fusionar, y `git push origin <sha>:main` **inmediatamente**, con el sha que se midió, no con la punta.

- [ ] **Step 4: Comprobar la migración contra Neon**

Igual que la 3b: que las tres tablas existan de verdad en producción después del despliegue.

- [ ] **Step 5: La aceptación, los diez pasos de la sección 11 de la spec**

Empezando por el paso 1, que es **arrastrar la marca de 4:35 de la auditiva 4** a 5:54 desde el taller. Lo que falle se apunta y se arregla antes de dar la entrega por cerrada.

- [ ] **Step 6: Salvar el ledger antes de retirar el worktree**

`.superpowers` está en `.gitignore` y `git worktree remove` lo borra sin aviso: copiar `.superpowers/sdd/<carpeta>` a `~/.claude/projects/-Users-FLE/ledgers-preservados/hispaprofe-dele-2026-09-16-taller-entrega-3c/`.

---

## Notas del repaso del plan contra la spec

- **La sección 2 de la spec ganó una columna al escribir este plan**: `Intento.fallos Int[]`. Sin ella, la pantalla de resultados tendría que volver a mirar la `Clave` para saber qué preguntas marcar en rojo, y eso es justo lo que la Task 3 prohíbe. Con la columna, los fallos se congelan con la nota y la clave no vuelve a salir de su tabla.
- **La prueba que la spec llamaba `tests/examen-para-hacer.test.ts` vive en `tests/base/`**, porque necesita Postgres de verdad: leer una prueba sin base no prueba nada.
- **El montaje del examen de pruebas (cuadernillo inventado + lectura 2 guardada + publicado + asignado) vive en `tests/ayudas/examen-de-pruebas.ts`** y lo comparten las Tasks 3 y 4. La Task 3 lo crea; la Task 4 lo usa.
- **Las claves de todas las pruebas son inventadas.** La spec pedía contrastar con «la clave del examen 1 de verdad»; eso se hace en la aceptación, a mano y en producción, nunca en una prueba de un repositorio público.
- Cobertura de la spec, sección por sección: 2 → Task 1; 3 → Tasks 2 y 4; 4 → Tasks 2, 3 y 4; 5 → Tasks 7 y 8; 6 → Task 9; 7 → Task 5; 8 → Task 10; 9 → Tasks 4 y 6; 10 → repartida en las pruebas de cada tarea; 11 → Task 11.
