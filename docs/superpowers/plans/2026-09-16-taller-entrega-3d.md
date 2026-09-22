# Entrega 3d: la escrita y la cola de corrección — plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que un estudiante asignado escriba las dos tareas de expresión escrita con su reloj de 50 minutos, las mande, y el profesor las corrija desde una cola con las cuatro bandas del DELE; y que la nota de la lectura y la auditiva se pueda abrir pregunta a pregunta.

**Architecture:** se apoya entero en lo que ya hay de la 3c. El `Intento` sigue siendo la fila que manda (una por asignación y prueba) y gana dos columnas de corrección; lo escrito vive en una tabla nueva, `EscritoDeIntento`, una fila por tarea. El reloj, el cierre automático «al mirar» y las cinco comprobaciones de las escrituras son los mismos: lo único que cambia por dentro es que **entregar una escrita no calcula nota**, y que la nota aparece más tarde, cuando el profesor firma. La pantalla del estudiante es una familia de componentes aparte (`hacer-escrita.tsx`), porque el modelo «una letra por pregunta» de la lectura no sirve para un folio en blanco.

**Tech Stack:** Next 16 (App Router, Server Actions), React 19, Prisma 7 sobre Postgres, Zod 4, Tailwind 4, Vitest (dos configuraciones: `npm test` sin base, `npm run test:base` con un Postgres de usar y tirar).

**Spec:** `docs/superpowers/specs/2026-09-16-taller-entrega-3d-design.md` — se lee entera antes de empezar. El plan discute el CÓMO; el porqué de cada decisión está allí.

## Global Constraints

- **El repositorio es PÚBLICO.** Ninguna clave real del libro, ningún texto real de un alumno y ninguna credencial entra en una prueba ni en un comentario.
- **Todo el código, los comentarios, los identificadores y los textos de pantalla, en español.** Es la norma de este repo: `guardarEscrito`, no `saveDraft`.
- **Ninguna función de dominio llama a `new Date()` por dentro:** el «ahora» entra como argumento. Es lo que hace que el reloj se pueda probar.
- **Cada prueba lleva escrita al lado, en un comentario, la mutación que tiene que matar.** Una prueba que no mata ninguna mutación no se escribe.
- **Ninguna prueba toca la red.** Ni Blob, ni Drive, ni la API de Anthropic, ni correo.
- **Una acción de servidor es una dirección pública.** Ninguna recibe `personaId`: la persona sale siempre de `exigirPersona()` / `exigirProfesor()`.
- **El worktree no trae `lib/generated/prisma` ni `.env`.** Antes de nada, y cada vez que cambie el esquema: `DATABASE_URL=postgresql://x@127.0.0.1:1/x DIRECT_URL=postgresql://x@127.0.0.1:1/x npx prisma generate`. Sin eso, `tsc` y las pruebas de base fallan por un cliente viejo, y no es un fallo del código.
- **Suites, siempre acotadas:** `npx vitest run <fichero>` para una; `npm run test:base -- tests/base/<fichero>` para una de base. Las dos enteras, solo al cerrar cada tarea.
- **Rama `taller-3d`**, worktree `/Users/FLE/Projects/hispaprofe-dele-taller-3d`. Commit al cerrar cada tarea, con el mensaje que dice cada una. Nunca `git add -A`: rutas concretas.
- **Los mensajes de error son literales compartidos** (`lib/examen/hacer.ts`): cambiar una coma rompe las pruebas que los comparan por texto. Los nuevos se añaden al mismo bloque de arriba del fichero.

---

### Task 1: La tabla, los criterios y los 50 minutos

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Intento`, modelo `Persona`, modelo nuevo `EscritoDeIntento`)
- Create: `prisma/migrations/<sello>_escritos/migration.sql` (la genera Prisma, no se escribe a mano)
- Modify: `lib/dele/estructura.ts:142-152` (`MINUTOS_DE_PRUEBA`) y final del fichero
- Create: `tests/base/escritos.test.ts`
- Modify: `tests/estructura.test.ts`

**Interfaces:**
- Consumes: nada (es la primera).
- Produces: el modelo `EscritoDeIntento { id, intentoId, tarea, opcion, texto, palabras, guardadoEn, bandas, comentario }`; `Intento.corregidaEn: Date | null`, `Intento.corregidaPorId: string | null`, `Intento.escritos`; y de `lib/dele/estructura.ts`: `BANDA_MAXIMA: 3`, `CRITERIOS_EE: readonly { clave, nombre, ayuda }[]`, `puntosDeEscrita(nivel: Nivel): number`, `MINUTOS_DE_PRUEBA[...].EE = 50`.

- [ ] **Step 1: Escribir la prueba de base que falla**

Crear `tests/base/escritos.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Asignacion, Examen, Persona } from "@/lib/generated/prisma";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";

let ana: Persona;
let examen: Examen;
let asignacion: Asignacion;

beforeEach(async () => {
  ({ ana, examen } = await crearExamenDePruebas());
  asignacion = await prisma.asignacion.findFirstOrThrow();
});

describe("la tabla de escritos", () => {
  // Mutación que la mata: quitar @@unique([intentoId, tarea]). Sin ella, cada
  // guardado automático del borrador dejaría una fila nueva y la corrección no
  // sabría cuál es el texto bueno.
  it("una sola fila por tarea, y el texto se reescribe", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "EE" } });
    await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Hola", palabras: 1 } });
    await expect(
      prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Otra vez", palabras: 2 } }),
    ).rejects.toThrow();
    await prisma.escritoDeIntento.update({
      where: { intentoId_tarea: { intentoId: intento.id, tarea: 1 } },
      data: { texto: "Hola, qué tal", palabras: 3 },
    });
    // La tarea 2 del mismo intento sí, que es otra tarea.
    await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 2, texto: "", palabras: 0 } });
    expect(await prisma.escritoDeIntento.count()).toBe(2);
  });

  // Mutación que la mata: dar valor por defecto a `bandas` (por ejemplo [0,0,0,0])
  // o hacer `corregidaEn` no nulo. Un escrito recién guardado parecería corregido
  // con un cero, y saldría de la cola sin que nadie lo hubiera mirado.
  it("nace sin corregir", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "EE" } });
    const escrito = await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Hola", palabras: 1 } });
    expect(escrito.bandas).toEqual([]);
    expect(escrito.comentario).toBe("");
    expect(escrito.opcion).toBeNull();
    const leido = await prisma.intento.findUniqueOrThrow({ where: { id: intento.id } });
    expect(leido.corregidaEn).toBeNull();
    expect(leido.corregidaPorId).toBeNull();
  });

  // Mutación que la mata: poner onDelete: Restrict (o SetNull) en la relación con
  // Intento. Quitar una asignación dejaría escritos huérfanos apuntando a nada.
  it("los escritos se van con el intento", async () => {
    const intento = await prisma.intento.create({ data: { asignacionId: asignacion.id, prueba: "EE" } });
    await prisma.escritoDeIntento.create({ data: { intentoId: intento.id, tarea: 1, texto: "Hola", palabras: 1 } });
    await prisma.intento.delete({ where: { id: intento.id } });
    expect(await prisma.escritoDeIntento.count()).toBe(0);
  });

  // Mutación que la mata: poner onDelete: Cascade en corregidaPor. Borrar al
  // profesor se llevaría por delante intentos y notas de los alumnos.
  it("borrar a quien corrigió no borra la corrección", async () => {
    const profe = await prisma.persona.create({ data: { correo: "profe@ejemplo.com", nombre: "Profe", papel: "PROFESOR" } });
    const intento = await prisma.intento.create({
      data: { asignacionId: asignacion.id, prueba: "EE", corregidaEn: new Date(), corregidaPorId: profe.id },
    });
    await prisma.persona.delete({ where: { id: profe.id } });
    const leido = await prisma.intento.findUniqueOrThrow({ where: { id: intento.id } });
    expect(leido.corregidaPorId).toBeNull();
    expect(leido.corregidaEn).not.toBeNull();
    expect(examen.id).toBe(leido.asignacionId ? examen.id : examen.id); // el examen sigue en pie
    expect(ana.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npm run test:base -- tests/base/escritos.test.ts`
Expected: FAIL — `prisma.escritoDeIntento is not a function` / la propiedad no existe en el cliente.

- [ ] **Step 3: Escribir el esquema**

En `prisma/schema.prisma`, dentro de `model Intento`, añadir junto a los demás campos:

```prisma
  /// Cuándo firmó el profesor la corrección de la escrita. null = esperando.
  /// Lo que dice si una escrita está corregida es ESTE campo, no `bandas`:
  /// una corrección legítima puede ser cuatro ceros.
  corregidaEn    DateTime?
  corregidaPor   Persona?  @relation("correcciones", fields: [corregidaPorId], references: [id], onDelete: SetNull)
  corregidaPorId String?
  escritos       EscritoDeIntento[]
```

En `model Persona`, junto a las demás relaciones:

```prisma
  correcciones Intento[] @relation("correcciones")
```

Y el modelo nuevo, debajo de `RespuestaDeIntento`:

```prisma
/// Lo que el estudiante escribió en una tarea de la escrita, y su corrección.
/// Una fila por tarea (la 1 y la 2): nace en cuanto se guarda el primer
/// borrador y se reescribe en cada guardado automático.
model EscritoDeIntento {
  id        String  @id @default(cuid())
  intento   Intento @relation(fields: [intentoId], references: [id], onDelete: Cascade)
  intentoId String
  tarea     Int
  /// Solo la tarea 2: cuál de las opciones eligió (1..n). null mientras no elige.
  opcion    Int?
  texto     String
  /// Las cuenta el SERVIDOR sobre el texto que llegó, nunca el navegador.
  palabras  Int      @default(0)
  guardadoEn DateTime @updatedAt

  /// La corrección: cuatro valores 0-3, en el orden de CRITERIOS_EE. Vacío
  /// mientras no se ha corregido, pero quien manda es Intento.corregidaEn.
  bandas     Int[]  @default([])
  comentario String @default("")

  @@unique([intentoId, tarea])
  @@index([intentoId])
}
```

- [ ] **Step 4: Generar la migración**

El worktree no tiene base ni `.env`. Se levanta una de usar y tirar solo para esto:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
DATOS="$(pwd)/.tmp/pg-migrar"
rm -rf "$DATOS" && initdb -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DATOS" -o "-p 55433 -k $DATOS" -l "$DATOS/log" start
sleep 2 && psql -h 127.0.0.1 -p 55433 -U postgres -c "create database migrar"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55433/migrar" DIRECT_URL="$DATABASE_URL"
npx prisma migrate dev --name escritos
pg_ctl -D "$DATOS" stop -m fast && rm -rf "$DATOS"
```

Comprobar a ojo el `migration.sql` generado: tiene que crear `EscritoDeIntento`, añadir `corregidaEn`/`corregidaPorId` a `Intento` y **ningún `DROP`**. Si aparece un `DROP TABLE` o un `DROP COLUMN`, parar y avisar: el esquema del worktree se ha desincronizado.

- [ ] **Step 5: Los números del DELE**

En `lib/dele/estructura.ts`, `MINUTOS_DE_PRUEBA`, la línea del nivel escolar:

```ts
  A2_B1_ESCOLAR: { CE: 50, CO: null, EE: 50, EO: null },
```

Y al final del fichero:

```ts
/**
 * Los cuatro criterios con que se corrige la expresión escrita, en el orden en
 * que se guardan en `EscritoDeIntento.bandas`. Cambiar el orden cambiaría el
 * significado de las correcciones ya firmadas: no se toca.
 *
 * `ayuda` es la línea que el profesor ve al lado de la casilla para no dudar
 * entre un 2 y un 3. La dicta él; hasta entonces va vacía y la pantalla
 * simplemente no la pinta.
 */
export const CRITERIOS_EE = [
  { clave: "adecuacion", nombre: "Adecuación al género discursivo", ayuda: "" },
  { clave: "coherencia", nombre: "Coherencia textual", ayuda: "" },
  { clave: "correccion", nombre: "Corrección", ayuda: "" },
  { clave: "alcance", nombre: "Alcance", ayuda: "" },
] as const;

/** La banda va de 0 a BANDA_MAXIMA. */
export const BANDA_MAXIMA = 3;

/**
 * Sobre cuántos puntos se corrige la escrita de un nivel: sus tareas por sus
 * cuatro criterios por la banda máxima. NO es un 24 escrito a mano — un nivel
 * con tres tareas de escrita daría 36 sin tocar nada.
 */
export function puntosDeEscrita(nivel: Nivel): number {
  const tareas = ESTRUCTURAS[nivel]?.EE.length ?? 0;
  return tareas * CRITERIOS_EE.length * BANDA_MAXIMA;
}
```

- [ ] **Step 6: La prueba pura de los números**

Añadir a `tests/estructura.test.ts`:

```ts
// Mutación que la mata: escribir `return 24` en puntosDeEscrita. El 24 tiene
// que salir de la estructura, o el día que un nivel tenga otra escrita mentirá.
it("la escrita se corrige sobre las tareas que tiene el nivel", () => {
  expect(puntosDeEscrita("A2_B1_ESCOLAR")).toBe(24);
  expect(puntosDeEscrita("B2")).toBe(0); // sin reglas todavía
  expect(CRITERIOS_EE).toHaveLength(4);
  expect(CRITERIOS_EE.map((c) => c.clave)).toEqual(["adecuacion", "coherencia", "correccion", "alcance"]);
});

// Mutación que la mata: dejar EE en null. El reloj de la escrita es de 50
// minutos, y sin esto la prueba saldría sin reloj y no se entregaría sola.
it("la escrita lleva 50 minutos y la auditiva sigue sin reloj", () => {
  expect(minutosDePrueba("A2_B1_ESCOLAR", "EE")).toBe(50);
  expect(minutosDePrueba("A2_B1_ESCOLAR", "CO")).toBeNull();
});
```

(Comprobar los `import` de cabecera del fichero: añadir `CRITERIOS_EE`, `puntosDeEscrita` y `minutosDePrueba` si no están.)

- [ ] **Step 7: Correr las dos y ver que pasan**

Run: `npx vitest run tests/estructura.test.ts && npm run test:base -- tests/base/escritos.test.ts`
Expected: PASS las dos.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/dele/estructura.ts tests/base/escritos.test.ts tests/estructura.test.ts
git commit -m "La tabla de escritos, los cuatro criterios y los 50 minutos de la escrita"
```

---

### Task 2: El motor: las palabras, la suma y el estado nuevo

**Files:**
- Modify: `lib/examen/motor.ts`
- Modify: `components/examen/hacer-prueba.tsx:314` y `:462`
- Modify: `tests/examen-motor.test.ts`
- Modify: `tests/examen-pantallas.test.tsx`

**Interfaces:**
- Consumes: `CRITERIOS_EE`, `BANDA_MAXIMA` (Task 1).
- Produces: `palabras(texto: string): number`; `sumaDeBandas(escritos: readonly { bandas: readonly number[] }[]): number`; `EstadoDePrueba.estado` gana `"ESPERANDO"`; `estaEntregada(e: EstadoDePrueba): boolean`.

- [ ] **Step 1: Escribir las pruebas puras que fallan**

Añadir a `tests/examen-motor.test.ts`:

```ts
describe("contar palabras", () => {
  // Mutación que la mata: `texto.split(" ").length`. Con dos espacios seguidos,
  // con un salto de línea o con el texto vacío, esa cuenta miente — y es el
  // número que el estudiante ve mientras escribe y el que se guarda.
  it("cuenta lo que cuenta una persona", () => {
    expect(palabras("")).toBe(0);
    expect(palabras("   ")).toBe(0);
    expect(palabras("Hola")).toBe(1);
    expect(palabras("Hola,  qué   tal")).toBe(3);
    expect(palabras("Hola\nqué tal\n\nadiós")).toBe(4);
    expect(palabras("  Hola qué tal  ")).toBe(3);
    // Una palabra con guion es una palabra, y un signo pegado no suma.
    expect(palabras("teórico-práctico ¿sí?")).toBe(2);
  });
});

describe("la suma de las bandas", () => {
  // Mutación que la mata: sumar solo el primer escrito, o dar por hecho que
  // siempre hay cuatro bandas. La escrita son DOS tareas: sumar una sola
  // dejaría a todo el mundo con la mitad de su nota.
  it("suma las bandas de todas las tareas", () => {
    expect(sumaDeBandas([{ bandas: [3, 2, 1, 0] }, { bandas: [3, 3, 2, 2] }])).toBe(16);
    expect(sumaDeBandas([])).toBe(0);
    expect(sumaDeBandas([{ bandas: [] }, { bandas: [1, 1, 1, 1] }])).toBe(4);
  });
});

describe("el estado de una escrita", () => {
  // Mutación que la mata: devolver "ENTREGADA" cuando no hay nota. Entonces la
  // pantalla del profesor diría «Entregada,» a secas y la del estudiante
  // intentaría pintarle una nota que todavía no existe.
  it("entregada y sin nota es esperando corrección", () => {
    const e = estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: null, total: null, porTiempo: false });
    expect(e.estado).toBe("ESPERANDO");
    expect(textoDelEstado(e)).toBe("Entregada, esperando corrección");
    expect(estaEntregada(e)).toBe(true);
  });

  // Mutación que la mata: quitar `porTiempo` del texto de ESPERANDO. Es la
  // única señal que tiene el profesor de a quién se le acabó el tiempo, y en la
  // escrita importa más que en ninguna: explica un texto a medias.
  it("dice si la entregó el reloj", () => {
    const e = estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: null, total: null, porTiempo: true });
    expect(textoDelEstado(e)).toBe("Entregada por tiempo, esperando corrección");
  });

  // Mutación que la mata: dejar ESPERANDO cuando ya hay nota. Una escrita
  // corregida se quedaría para siempre en la cola.
  it("corregida ya tiene nota y sale de la espera", () => {
    const e = estadoDePrueba({ entregadaEn: ENTREGADA, aciertos: 18, total: 24, porTiempo: false });
    expect(e.estado).toBe("ENTREGADA");
    expect(textoDelEstado(e)).toBe("Entregada, 18 de 24");
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/examen-motor.test.ts`
Expected: FAIL — `palabras is not a function`, `sumaDeBandas is not a function`, `estaEntregada is not a function`.

- [ ] **Step 3: Escribir el motor**

En `lib/examen/motor.ts`:

```ts
export type EstadoDePrueba = {
  /** ESPERANDO: entregada y sin nota. Hoy solo le pasa a la escrita, pero se
   *  deduce de la fila, no de qué prueba sea: una lectura entregada SIEMPRE
   *  tiene nota, porque se congela en la misma llamada que la entrega. */
  estado: "SIN_EMPEZAR" | "HACIENDO" | "ESPERANDO" | "ENTREGADA";
  aciertos: number | null;
  total: number | null;
  porTiempo: boolean;
};

/**
 * Las palabras que contaría una persona: trozos separados por cualquier hueco
 * (espacios, tabuladores, saltos de línea), sin contar los huecos de los
 * extremos. Un texto vacío o solo de espacios son cero palabras.
 */
export function palabras(texto: string): number {
  const limpio = texto.trim();
  return limpio === "" ? 0 : limpio.split(/\s+/u).length;
}

/** La nota de la escrita: todas las bandas de todas sus tareas. */
export function sumaDeBandas(escritos: readonly { bandas: readonly number[] }[]): number {
  return escritos.reduce((total, e) => total + e.bandas.reduce((s, b) => s + b, 0), 0);
}

/** Entregada, esté corregida o no. Las pantallas casi siempre quieren esto. */
export function estaEntregada(e: EstadoDePrueba): boolean {
  return e.estado === "ENTREGADA" || e.estado === "ESPERANDO";
}
```

Y dentro de `estadoDePrueba`, la línea del estado:

```ts
    estado: !intento.entregadaEn ? "HACIENDO" : intento.aciertos === null ? "ESPERANDO" : "ENTREGADA",
```

Y en `textoDelEstado`, antes del `return` final:

```ts
  const entregada = e.porTiempo ? "Entregada por tiempo" : "Entregada";
  if (e.estado === "ESPERANDO") return `${entregada}, esperando corrección`;
```

- [ ] **Step 4: Tapar los dos sitios que comparan con "ENTREGADA"**

Son los únicos dos de producción (`grep -rn '"ENTREGADA"' lib app components` lo confirma). Sin esto, una escrita esperando corrección **caería en la cara de «haciendo»** y le reabriría la prueba al estudiante: es la peor regresión posible de esta tarea.

En `components/examen/hacer-prueba.tsx:314`:

```ts
  const queda = prueba.otras.filter((o) => !estaEntregada(o.estado));
```

En `components/examen/hacer-prueba.tsx:462`:

```ts
    : estaEntregada(prueba.estado) ? <PruebaEntregada prueba={prueba} />
```

(y añadir `estaEntregada` al `import` de `@/lib/examen/motor`).

- [ ] **Step 5: La prueba de que la pantalla no reabre una prueba entregada**

Añadir a `tests/examen-pantallas.test.tsx`, junto a las demás de `HacerPrueba`:

```ts
// Mutación que la mata: volver a `prueba.estado.estado === "ENTREGADA"` en el
// encaminado de HacerPrueba. Con el estado ESPERANDO, la prueba entregada
// caería en la cara de «haciendo»: el estudiante vería otra vez sus preguntas
// abiertas y un botón de entregar que ya no puede funcionar.
it("una prueba entregada y sin corregir no se reabre", () => {
  const html = renderToStaticMarkup(
    <HacerPrueba prueba={entregadaCon19De25({ estado: { estado: "ESPERANDO", aciertos: null, total: null, porTiempo: false } })} />,
  );
  expect(html).not.toContain("Entregar");
});
```

- [ ] **Step 6: Correr las dos y ver que pasan**

Run: `npx vitest run tests/examen-motor.test.ts tests/examen-pantallas.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/examen/motor.ts components/examen/hacer-prueba.tsx tests/examen-motor.test.ts tests/examen-pantallas.test.tsx
git commit -m "El motor cuenta palabras, suma bandas y sabe que hay algo entregado sin nota"
```

---

### Task 3: Guardar el borrador

**Files:**
- Modify: `lib/examen/hacer.ts` (mensajes, `abrirLaPrueba`, función nueva `guardarEscrito`)
- Modify: `tests/base/escritos.test.ts`

**Interfaces:**
- Consumes: `palabras` (Task 2), `EscritoDeIntento` (Task 1).
- Produces: `guardarEscrito(examenId: string, personaId: string, tarea: number, texto: string, opcion: number | null, ahora: Date): Promise<{ error?: string }>`; `LETRAS_TOPE = 10_000`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/base/escritos.test.ts`:

```ts
describe("guardar el borrador", () => {
  async function empezada(): Promise<void> {
    const r = await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    expect(r.error).toBeUndefined();
  }

  // Mutación que la mata: quitar "EE" de la lista de pruebas que abren en
  // abrirLaPrueba. La escrita no se podría ni empezar.
  it("guarda el texto, las palabras y la opción", async () => {
    await empezada();
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA)).toEqual({});
    expect(await guardarEscrito(examen.id, ana.id, 2, "Elijo la dos", 2, AHORA)).toEqual({});
    const escritos = await prisma.escritoDeIntento.findMany({ orderBy: { tarea: "asc" } });
    expect(escritos.map((e) => [e.tarea, e.texto, e.palabras, e.opcion])).toEqual([
      [1, "Hola, qué tal", 3, null],
      [2, "Elijo la dos", 3, 2],
    ]);
  });

  // Mutación que la mata: fiarse de las palabras que mande el navegador. Se
  // cuentan aquí, sobre el texto que llegó.
  it("reescribe el mismo borrador, no acumula filas", async () => {
    await empezada();
    await guardarEscrito(examen.id, ana.id, 1, "Uno", null, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Uno dos tres", null, AHORA);
    const escritos = await prisma.escritoDeIntento.findMany();
    expect(escritos).toHaveLength(1);
    expect(escritos[0]!.palabras).toBe(3);
  });

  // Mutación que la mata: quitar CUALQUIERA de las cinco comprobaciones de
  // abrirLaPrueba. Son las mismas que guardan una letra en la lectura.
  it("rebota sin empezar, con el examen retirado, entregada y sin tiempo", async () => {
    // Sin empezar.
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", null, AHORA)).toEqual({ error: "Todavía no has empezado esta prueba." });
    await empezada();
    // No es suyo.
    expect(await guardarEscrito(examen.id, luis.id, 1, "Hola", null, AHORA)).toEqual({ error: "Este examen no es tuyo." });
    // Sin tiempo: 50 minutos y diez segundos de gracia.
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", null, tarde)).toEqual({ error: "Se acabó el tiempo." });
    // Y al rebotar por tiempo, la prueba queda entregada.
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.porTiempo).toBe(true);
    // Ya entregada.
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", null, tarde)).toEqual({ error: "Esta prueba ya está entregada." });
  });

  // Mutación que la mata: no mirar el tope. Una columna de texto sin límite es
  // una invitación a pegar un libro entero desde una dirección pública.
  it("rebota un texto imposible y una tarea que no existe", async () => {
    await empezada();
    expect(await guardarEscrito(examen.id, ana.id, 1, "x".repeat(10_001), null, AHORA)).toEqual({
      error: "Ese texto es demasiado largo.",
    });
    expect(await guardarEscrito(examen.id, ana.id, 7, "Hola", null, AHORA)).toEqual({ error: "Esa tarea no existe." });
    expect(await prisma.escritoDeIntento.count()).toBe(0);
  });

  // Mutación que la mata: no validar la opción contra las que tiene la tarea.
  // Una acción de servidor es pública: cualquiera puede mandar la opción 99.
  it("rebota una opción que la tarea no tiene", async () => {
    await empezada();
    expect(await guardarEscrito(examen.id, ana.id, 2, "Hola", 99, AHORA)).toEqual({ error: "Esa opción no existe." });
    // Y en la tarea 1, que no tiene opciones, elegir una también rebota.
    expect(await guardarEscrito(examen.id, ana.id, 1, "Hola", 1, AHORA)).toEqual({ error: "Esa opción no existe." });
  });
});
```

Añadir al montaje compartido (`tests/ayudas/examen-de-pruebas.ts`) las dos tareas de escrita, porque sin ellas no hay opciones que validar ni tarea que abrir:

```ts
/** Las dos tareas de la escrita, guardadas como las guarda el taller. */
async function guardarEscritas(examenId: string): Promise<void> {
  const regla1 = reglaDe("A2_B1_ESCOLAR", "EE", 1)!;
  const f1 = formularioVacio(regla1);
  if (f1.forma !== "REDACCION_UNA") throw new Error("la escrita 1 es REDACCION_UNA");
  f1.consigna = "Escribe un correo.";
  f1.actividad.situacion = "Un amigo te escribe.";
  f1.actividad.textoRecibido = "¡Hola! ¿Vienes el sábado?";
  f1.actividad.pautas = ["Salúdale", "Dile si vas"];
  f1.actividad.palabras = { min: 60, max: 70 };
  await guardarTarea(examenId, "EE", 1, f1);

  const regla2 = reglaDe("A2_B1_ESCOLAR", "EE", 2)!;
  const f2 = formularioVacio(regla2);
  if (f2.forma !== "REDACCION_DOS") throw new Error("la escrita 2 es REDACCION_DOS");
  f2.consigna = "Elige una opción.";
  f2.actividad.opciones = [
    { titulo: "Opción 1", contexto: "Tu instituto", pautas: ["Cuenta un día"] },
    { titulo: "Opción 2", contexto: "Tus vacaciones", pautas: ["Cuenta un viaje"] },
  ];
  f2.actividad.palabras = { min: 70, max: 80 };
  await guardarTarea(examenId, "EE", 2, f2);
}
```

y llamarla desde `crearExamenDePruebas`, junto a `guardarLectura2` y `guardarAuditiva3`.

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base -- tests/base/escritos.test.ts`
Expected: FAIL — `guardarEscrito is not a function`, y antes incluso `empezarPrueba` devuelve «Esa prueba todavía no se puede hacer.»

- [ ] **Step 3: Abrir la escrita en `abrirLaPrueba`**

En `lib/examen/hacer.ts`, los mensajes nuevos junto a los siete de arriba:

```ts
// Los tres de la escrita. El tope no es para corregir a nadie: es para que una
// dirección pública no pueda meter un libro entero en una columna de la base.
const TEXTO_LARGO = "Ese texto es demasiado largo.";
const TAREA_MALA = "Esa tarea no existe.";
const OPCION_MALA = "Esa opción no existe.";
/** Unas 1.500 palabras: siete veces lo más largo que pide el examen. */
export const LETRAS_TOPE = 10_000;
```

Y la primera línea de `abrirLaPrueba`:

```ts
  // La oral (EO) sigue fuera hasta la 3e: su pantalla no existe.
  if (prueba !== "CE" && prueba !== "CO" && prueba !== "EE") return { error: NO_SE_HACE };
```

- [ ] **Step 4: Escribir `guardarEscrito`**

En `lib/examen/hacer.ts`, detrás de `guardarRespuesta`:

```ts
/**
 * Cuántas opciones tiene una tarea de la escrita, para poder rechazar una que
 * no existe. Sale del formulario guardado, no de la regla del nivel: la regla
 * dice que la tarea 2 es de opciones, pero no cuántas puso el profesor.
 * Devuelve 0 en una tarea sin opciones (la 1), y eso hace que elegir una allí
 * rebote, que es lo que tiene que pasar.
 */
async function opcionesDeLaTarea(examenId: string, tarea: number): Promise<number | null> {
  const fila = await prisma.tarea.findUnique({
    where: { examenId_prueba_numero: { examenId, prueba: "EE", numero: tarea } },
    select: { piezas: { select: { orden: true, tipo: true, texto: true, etiqueta: true, ficheroId: true, cortes: true, actividad: { select: { datos: true } } } } },
  });
  if (!fila) return null;
  const formulario = formularioDePiezas(fila.piezas);
  if (!formulario) return null;
  return formulario.forma === "REDACCION_DOS" ? formulario.actividad.opciones.length : 0;
}

/**
 * El borrador. Pasa por la misma guarda que marcar una letra —las cinco
 * comprobaciones, en el mismo orden— y escribe una sola fila por tarea con un
 * `upsert`: el navegador guarda cada pocos segundos mientras se escribe, y
 * cada guardado es el texto ENTERO, no un trozo.
 *
 * Las palabras se cuentan AQUÍ. El navegador también las cuenta para pintarlas
 * en vivo, pero lo que se guarda es lo que cuenta el servidor sobre el texto
 * que llegó: la cuenta del navegador es un adorno, no un dato.
 */
export async function guardarEscrito(
  examenId: string,
  personaId: string,
  tarea: number,
  texto: string,
  opcion: number | null,
  ahora: Date,
): Promise<{ error?: string }> {
  if (texto.length > LETRAS_TOPE) return { error: TEXTO_LARGO };

  const abierta = await abrirLaPrueba(examenId, "EE", personaId, ahora, { exigirEmpezada: true });
  if ("error" in abierta) return abierta;

  const opciones = await opcionesDeLaTarea(examenId, tarea);
  if (opciones === null) return { error: TAREA_MALA };
  if (opcion !== null && (!Number.isInteger(opcion) || opcion < 1 || opcion > opciones)) return { error: OPCION_MALA };

  await prisma.escritoDeIntento.upsert({
    where: { intentoId_tarea: { intentoId: abierta.intento!.id, tarea } },
    create: { intentoId: abierta.intento!.id, tarea, texto, palabras: palabras(texto), opcion },
    update: { texto, palabras: palabras(texto), opcion },
  });
  return {};
}
```

(Añadir a los `import` de cabecera: `palabras` de `./motor` y `formularioDePiezas` de `@/lib/taller/piezas`.)

- [ ] **Step 5: Correr y ver que pasan**

Run: `npm run test:base -- tests/base/escritos.test.ts`
Expected: PASS.

- [ ] **Step 6: Que no se haya roto lo de la 3c**

Run: `npm run test:base -- tests/base/intentos.test.ts tests/base/examen-para-hacer.test.ts`
Expected: PASS. (El montaje compartido ha cambiado: ahora el examen tiene también las dos tareas de escrita.)

- [ ] **Step 7: Commit**

```bash
git add lib/examen/hacer.ts tests/base/escritos.test.ts tests/ayudas/examen-de-pruebas.ts
git commit -m "El borrador de la escrita se guarda, con las mismas cinco comprobaciones"
```

---

### Task 4: Entregar la escrita sin inventarse una nota

**Files:**
- Modify: `lib/examen/hacer.ts` (`congelarNota` → `cerrarIntento`, `entregarPrueba`, `cerrarLasQueSePasaron`)
- Modify: `tests/base/escritos.test.ts`

**Interfaces:**
- Consumes: `guardarEscrito` (Task 3).
- Produces: `entregarPrueba` y `cerrarLasQueSePasaron` aceptan EE; una escrita entregada queda con `aciertos = null` y `total = null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/base/escritos.test.ts`:

```ts
describe("entregar la escrita", () => {
  // Mutación que la mata: dejar que congelarNota corra también para la escrita.
  // Buscaría una clave que no existe, la nota saldría 0 de 0, y el estado diría
  // «Entregada, 0 de 0» en vez de «esperando corrección»: el chico vería un cero
  // que no es suyo y la escrita no entraría nunca en la cola.
  it("no calcula nota: queda esperando corrección", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA);
    expect(await entregarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).not.toBeNull();
    expect(intento.aciertos).toBeNull();
    expect(intento.total).toBeNull();
    expect(intento.fallos).toEqual([]);
    expect(intento.porTiempo).toBe(false);
  });

  // Mutación que la mata: borrar o ignorar los escritos al cerrar por tiempo.
  // Lo que escribió hasta ese momento es justo lo que hay que corregir.
  it("el reloj la cierra y conserva lo escrito", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Iba por aquí", null, AHORA);
    const tarde = new Date(AHORA.getTime() + 51 * 60_000);
    await cerrarLasQueSePasaron({ personaId: ana.id }, tarde);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.porTiempo).toBe(true);
    expect(intento.aciertos).toBeNull();
    const escrito = await prisma.escritoDeIntento.findFirstOrThrow();
    expect(escrito.texto).toBe("Iba por aquí");
  });

  // Mutación que la mata: quitar el `entregadaEn: null` del where del updateMany.
  // Dos entregas a la vez (doble clic, o el reloj a la vez que el botón)
  // pisarían la primera.
  it("entregar dos veces no cambia la primera entrega", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    const primera = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    const despues = new Date(AHORA.getTime() + 60_000);
    expect(await entregarPrueba(examen.id, "EE", ana.id, despues)).toEqual({ error: "Esta prueba ya está entregada." });
    const segunda = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(segunda.entregadaEn).toEqual(primera.entregadaEn);
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base -- tests/base/escritos.test.ts -t "entregar la escrita"`
Expected: FAIL — la escrita sale con `aciertos: 0` y `total: 0`.

- [ ] **Step 3: Partir el cierre en dos caminos**

En `lib/examen/hacer.ts`, renombrar `congelarNota` a `cerrarIntento` y meterle la bifurcación. El `updateMany` condicionado es el mismo para los dos caminos: es lo que hace que dos entregas a la vez no se pisen.

```ts
/**
 * Cierra un intento. Dos caminos, y la diferencia es de fondo:
 *
 * - Lectura y auditiva: se calcula la nota con la clave y se congela aquí, en
 *   la misma escritura que la entrega. Es la única vez que se mira la `Clave`.
 * - Escrita: NO hay nota que calcular. Se cierra sin `aciertos` ni `total`, y
 *   eso es exactamente lo que la deja «esperando corrección» (motor.ts) y lo
 *   que la mete en la cola del profesor. La nota llegará cuando él firme.
 */
async function cerrarIntento(
  examenId: string,
  prueba: Prueba,
  intentoId: string,
  respuestas: readonly { numero: number; letra: string }[],
  ahora: Date,
  porTiempo: boolean,
): Promise<void> {
  const nota =
    prueba === "EE"
      ? null
      : notaDePrueba(
          await claveDeLaPrueba(examenId, prueba),
          Object.fromEntries(respuestas.map((r) => [String(r.numero), r.letra])),
        );
  await prisma.intento.updateMany({
    where: { id: intentoId, entregadaEn: null },
    data: {
      entregadaEn: ahora,
      porTiempo,
      aciertos: nota?.aciertos ?? null,
      total: nota?.total ?? null,
      fallos: nota ? nota.fallos.map((f) => f.numero) : [],
    },
  });
}
```

Cambiar las tres llamadas a `congelarNota` (en `abrirLaPrueba`, en `entregarPrueba` y en `cerrarLasQueSePasaron`) por `cerrarIntento`. No hay que tocar nada más: las tres ya le pasan la prueba.

- [ ] **Step 4: Correr y ver que pasan**

Run: `npm run test:base -- tests/base/escritos.test.ts tests/base/intentos.test.ts`
Expected: PASS las dos (las de la 3c comprueban que la lectura SIGUE congelando su nota: son la red que impide que esta bifurcación se lleve por delante lo que ya funcionaba).

- [ ] **Step 5: Commit**

```bash
git add lib/examen/hacer.ts tests/base/escritos.test.ts
git commit -m "Entregar una escrita la cierra sin nota: la nota la pone el profesor"
```

---

### Task 5: Lo que viaja al navegador, y el candado

**Files:**
- Modify: `lib/examen/paraHacer.ts`
- Modify: `tests/base/examen-para-hacer.test.ts`
- Modify: `tests/base/ficheros-del-estudiante.test.ts`

**Interfaces:**
- Consumes: `EscritoDeIntento` (Task 1), `estadoDePrueba` con ESPERANDO (Task 2).
- Produces: `type EscritoParaHacer = { tarea: number; opcion: number | null; texto: string; palabras: number; correccion: { bandas: number[]; comentario: string } | null }`; `PruebaParaHacer` gana `escritos: EscritoParaHacer[]` y `corregidaEn: Date | null`; `PRUEBAS_QUE_SE_HACEN = ["CE", "CO", "EE"]`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/base/examen-para-hacer.test.ts`:

```ts
describe("la escrita para hacer", () => {
  // LA PRUEBA IMPORTANTE DE LA ENTREGA. Mutación que la mata: devolver la fila
  // entera de EscritoDeIntento (con `bandas` y `comentario`) en vez de
  // construir el objeto campo a campo. El estudiante recibiría su corrección en
  // el HTML antes de que el profesor la hubiera firmado, y ni siquiera haría
  // falta mirar: está en la fuente de la página.
  it("no enseña las bandas antes de que el profesor firme", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    // El profesor escribe la corrección pero NO la firma (corregidaEn sigue null).
    await prisma.escritoDeIntento.updateMany({
      where: { intentoId: intento.id, tarea: 1 },
      data: { bandas: [3, 2, 2, 1], comentario: "Muy bien" },
    });

    const sinFirmar = await pruebaParaHacer(examen.id, "EE", ana.id, AHORA);
    expect(sinFirmar!.estado.estado).toBe("ESPERANDO");
    expect(sinFirmar!.escritos[0]!.correccion).toBeNull();
    expect(JSON.stringify(sinFirmar)).not.toContain("Muy bien");

    await prisma.intento.update({
      where: { id: intento.id },
      data: { corregidaEn: AHORA, aciertos: 8, total: 24 },
    });
    const firmada = await pruebaParaHacer(examen.id, "EE", ana.id, AHORA);
    expect(firmada!.escritos[0]!.correccion).toEqual({ bandas: [3, 2, 2, 1], comentario: "Muy bien" });
    expect(firmada!.estado).toEqual({ estado: "ENTREGADA", aciertos: 8, total: 24, porTiempo: false });
  });

  // Mutación que la mata: no devolver los escritos. Al volver de un corte, el
  // estudiante encontraría el folio en blanco y el reloj corriendo.
  it("devuelve el borrador tal como se guardó", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 2, "Elijo la dos", 2, AHORA);
    const leida = await pruebaParaHacer(examen.id, "EE", ana.id, AHORA);
    expect(leida!.escritos).toEqual([{ tarea: 2, opcion: 2, texto: "Elijo la dos", palabras: 3, correccion: null }]);
    expect(leida!.minutos).toBe(50);
    expect(leida!.tareas.map((t) => t.numero)).toEqual([1, 2]);
  });

  // Mutación que la mata: dejar "EO" dentro de PRUEBAS_QUE_SE_HACEN. La oral no
  // tiene pantalla hasta la 3e, y media pantalla es peor que ninguna.
  it("la oral sigue sin poderse hacer", async () => {
    expect(await pruebaParaHacer(examen.id, "EO", ana.id, AHORA)).toBeNull();
  });
});
```

Y añadir a `tests/base/ficheros-del-estudiante.test.ts`:

```ts
// Mutación que la mata: volver a escribir a mano la lista de pruebas dentro de
// ficherosDeLasPruebasAbiertas (por ejemplo, ["CE","CO"]). Las fotos de la
// escrita darían 404 en cuanto la tarea las llevara — que es exactamente el
// fallo que el profesor encontró en la aceptación de la 3c con la auditiva 1.
it("la foto de la escrita se abre al empezarla, y no antes", async () => {
  const fichero = await prisma.fichero.create({
    data: { almacen: "VERCEL", ruta: `escrita-${Date.now()}.jpg`, tipo: "image/jpeg", bytes: 10 },
  });
  const regla = reglaDe("A2_B1_ESCOLAR", "EE", 1)!;
  const f = formularioVacio(regla);
  if (f.forma !== "REDACCION_UNA") throw new Error("la escrita 1 es REDACCION_UNA");
  f.actividad.situacion = "Un amigo te escribe.";
  f.medios.imagenes = { situacion: fichero.id };
  await guardarTarea(examen.id, "EE", 1, f);

  expect((await ficherosDeLasPruebasAbiertas(ana.id)).has(fichero.id)).toBe(false);
  await empezarPrueba(examen.id, "EE", ana.id, AHORA);
  expect((await ficherosDeLasPruebasAbiertas(ana.id)).has(fichero.id)).toBe(true);
});
```

(Si `huecosDeImagen` no da la clave `situacion` para REDACCION_UNA, usar la que dé: lo que importa es que el id del fichero acabe dentro de `datos.imagenes`. Mirar `lib/taller/medios.ts` antes de escribirla, y ajustar la clave, no la prueba.)

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base -- tests/base/examen-para-hacer.test.ts tests/base/ficheros-del-estudiante.test.ts`
Expected: FAIL — `pruebaParaHacer` devuelve `null` para EE (no está en `PRUEBAS_QUE_SE_HACEN`).

- [ ] **Step 3: Abrir la escrita y construir los escritos campo a campo**

En `lib/examen/paraHacer.ts`:

```ts
/** Lo poco que el navegador necesita de un escrito. La corrección va aparte y
 *  solo cuando está FIRMADA: ver `pruebaParaHacer`. */
export type EscritoParaHacer = {
  tarea: number;
  opcion: number | null;
  texto: string;
  palabras: number;
  correccion: { bandas: number[]; comentario: string } | null;
};
```

`PruebaParaHacer` gana dos campos:

```ts
  escritos: EscritoParaHacer[];
  /** Cuándo firmó el profesor. null = sin corregir (o no es la escrita). */
  corregidaEn: Date | null;
```

La lista de pruebas:

```ts
/** Las tres pruebas que el estudiante puede hacer hoy. La oral llega con la 3e. */
export const PRUEBAS_QUE_SE_HACEN: readonly Prueba[] = ["CE", "CO", "EE"];
```

En la consulta, añadir `escritos: true` al `include` del intento. Y al construir el objeto que se devuelve:

```ts
  // Campo a campo, como las respuestas: la fila de EscritoDeIntento lleva
  // `bandas` y `comentario` dentro, y mientras no esté FIRMADA no pueden salir
  // de aquí. Lo que decide es `corregidaEn`, no que las bandas estén puestas:
  // el profesor puede haber guardado y no haber firmado.
  const firmada = intento?.corregidaEn ?? null;
  const escritos: EscritoParaHacer[] = (intento?.escritos ?? [])
    .sort((a, b) => a.tarea - b.tarea)
    .map((e) => ({
      tarea: e.tarea,
      opcion: e.opcion,
      texto: e.texto,
      palabras: e.palabras,
      correccion: firmada ? { bandas: e.bandas, comentario: e.comentario } : null,
    }));
```

y devolver `escritos` y `corregidaEn: firmada`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `npm run test:base -- tests/base/examen-para-hacer.test.ts tests/base/ficheros-del-estudiante.test.ts`
Expected: PASS.

- [ ] **Step 5: Mirar qué más se ha encendido**

`PRUEBAS_QUE_SE_HACEN` la usan también `app/page.tsx` (las filas del Inicio del estudiante) y `pruebaValida` en `app/examen/acciones.ts`. Con este cambio, el Inicio ya pinta la fila de la Escrita y sus acciones ya la admiten: es lo que queremos, pero hay que verlo.

Run: `npx vitest run tests/portada.test.ts tests/examen-acciones.test.ts`
Expected: PASS. Si alguna prueba daba por hecho que el Inicio tiene DOS filas, se corrige a tres — el cambio es intencionado y la prueba estaba escrita sobre lo que había.

- [ ] **Step 6: Commit**

```bash
git add lib/examen/paraHacer.ts tests/base/examen-para-hacer.test.ts tests/base/ficheros-del-estudiante.test.ts tests/portada.test.ts tests/examen-acciones.test.ts
git commit -m "La escrita ya viaja al navegador, y su correccion solo cuando esta firmada"
```

---

### Task 6: La acción de guardar el borrador

**Files:**
- Modify: `app/examen/acciones.ts`
- Modify: `tests/examen-acciones.test.ts`

**Interfaces:**
- Consumes: `guardarEscrito` (Task 3).
- Produces: `guardarEscritoAccion(examenId: string, tarea: number, texto: string, opcion: number | null): Promise<{ error?: string }>`.

- [ ] **Step 1: Escribir la prueba que falla**

Añadir a `tests/examen-acciones.test.ts` (con `guardarEscrito: vi.fn()` en los dobles y en el `vi.mock` de `@/lib/examen/hacer`):

```ts
// Mutación que la mata: pasarle un personaId que venga de fuera en vez de la
// sesión. Es la regla de las seis acciones: una dirección pública no puede
// decir por quién escribe.
it("guardarEscritoAccion escribe por quien tiene la sesión", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(ana);
  dobles.guardarEscrito.mockResolvedValue({});
  const { guardarEscritoAccion } = await import("@/app/examen/acciones");
  expect(await guardarEscritoAccion("ex1", 1, "Hola", null)).toEqual({});
  expect(dobles.guardarEscrito).toHaveBeenCalledWith("ex1", ana.id, 1, "Hola", null, expect.any(Date));
});

// Mutación que la mata: quitar exigirPersona. Sin sesión, cualquiera escribiría
// en el examen de otro con solo conocer la dirección.
it("guardarEscritoAccion sin sesión no escribe nada", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(null);
  const { guardarEscritoAccion } = await import("@/app/examen/acciones");
  await expect(guardarEscritoAccion("ex1", 1, "Hola", null)).rejects.toThrow();
  expect(dobles.guardarEscrito).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/examen-acciones.test.ts`
Expected: FAIL — `guardarEscritoAccion` no existe.

- [ ] **Step 3: Escribir la acción**

En `app/examen/acciones.ts`:

```ts
/**
 * El borrador. NO revalida la pantalla: se llama cada pocos segundos mientras
 * el estudiante escribe, y revalidar aquí sería volver a pintar el servidor
 * doscientas veces por redacción para nada — el texto que se ve ya es el del
 * navegador. La pantalla se revalida al entregar, que es cuando cambia de cara.
 *
 * Sin `prueba` en la firma: el borrador es de la escrita y de ninguna otra.
 */
export async function guardarEscritoAccion(
  examenId: string,
  tarea: number,
  texto: string,
  opcion: number | null,
): Promise<{ error?: string }> {
  const persona = await exigirPersona();
  return guardarEscrito(examenId, persona.id, tarea, texto, opcion, new Date());
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/examen-acciones.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/examen/acciones.ts tests/examen-acciones.test.ts
git commit -m "La accion que guarda el borrador, sin revalidar la pantalla en cada tecla"
```

---

### Task 7: El enunciado y el folio

**Files:**
- Create: `components/examen/enunciado-de-escrita.tsx`
- Create: `components/examen/folio.tsx`
- Modify: `tests/examen-pantallas.test.tsx`

**Interfaces:**
- Consumes: `Formulario` (`lib/taller/formas`), `palabras` (Task 2).
- Produces: `<EnunciadoDeEscrita formulario opcionElegida alElegir? bloqueado? />`; `<Folio texto rango bloqueado alEscribir />`; `export function avisoDePalabras(cuantas, rango): { texto: string; pasada: boolean }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/examen-pantallas.test.tsx`:

```ts
describe("el aviso de palabras", () => {
  // Mutación que la mata: comparar solo con el máximo. Quedarse corto también
  // es un fallo del examen, y es el más común.
  it("avisa por arriba y por abajo, y calla si no hay rango", () => {
    expect(avisoDePalabras(90, { min: 80, max: 100 })).toEqual({ texto: "90 palabras (te piden entre 80 y 100)", pasada: false });
    expect(avisoDePalabras(120, { min: 80, max: 100 }).pasada).toBe(true);
    expect(avisoDePalabras(12, { min: 80, max: 100 }).pasada).toBe(true);
    expect(avisoDePalabras(1, { min: null, max: null })).toEqual({ texto: "1 palabra", pasada: false });
  });
});

describe("el folio", () => {
  // Mutación que la mata: pintar el textarea sin `defaultValue`/`value`. Al
  // volver de un corte, el folio saldría en blanco con el reloj corriendo.
  it("trae lo ya escrito y su cuenta", () => {
    const html = renderToStaticMarkup(
      <Folio texto="Hola qué tal" rango={{ min: 80, max: 100 }} bloqueado={false} alEscribir={() => {}} />,
    );
    expect(html).toContain("Hola qué tal");
    expect(html).toContain("3 palabras (te piden entre 80 y 100)");
  });

  // Mutación que la mata: ignorar `bloqueado`. En la prueba entregada el folio
  // tiene que estar apagado de verdad, no solo parecerlo.
  it("bloqueado no se puede escribir", () => {
    const html = renderToStaticMarkup(
      <Folio texto="Ya está" rango={{ min: null, max: null }} bloqueado alEscribir={() => {}} />,
    );
    expect(html).toContain("disabled");
  });
});

describe("el enunciado de la escrita", () => {
  // Mutación que la mata: pintar todas las opciones como si estuvieran
  // elegidas, o no marcar la elegida. El estudiante no sabría sobre cuál
  // escribe, y es lo único que distingue su tarea 2 de la del de al lado.
  it("la tarea 2 marca la opción elegida", () => {
    const html = renderToStaticMarkup(
      <EnunciadoDeEscrita formulario={escritaDos()} opcionElegida={2} alElegir={() => {}} />,
    );
    expect(html).toContain("Opción 1");
    expect(html).toContain("Opción 2");
    expect(html).toContain('checked=""');
  });

  // Mutación que la mata: no pintar el texto recibido. En la tarea 1 es el
  // correo al que hay que contestar: sin él no hay tarea.
  it("la tarea 1 pinta la situación, el correo y las pautas", () => {
    const html = renderToStaticMarkup(<EnunciadoDeEscrita formulario={escritaUna()} opcionElegida={null} />);
    expect(html).toContain("Un amigo te escribe");
    expect(html).toContain("¿Vienes el sábado?");
    expect(html).toContain("Salúdale");
  });
});
```

(`escritaUna()` y `escritaDos()` son dos ayudas locales del fichero de pruebas, construidas con `formularioVacio(reglaDe("A2_B1_ESCOLAR", "EE", 1)!)` y rellenadas a mano, como ya se hace con `formularioDeLectura` en ese mismo fichero.)

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/examen-pantallas.test.tsx`
Expected: FAIL — no existen ni `Folio` ni `EnunciadoDeEscrita` ni `avisoDePalabras`.

- [ ] **Step 3: Escribir el folio**

`components/examen/folio.tsx`:

```tsx
"use client";

import { palabras } from "@/lib/examen/motor";

export type Rango = { min: number | null; max: number | null };

/**
 * El aviso de debajo del folio. Avisa por arriba Y por abajo: quedarse corto
 * es el fallo más común del examen. Es un aviso, no un candado — pasarse de
 * palabras lo penaliza el examen, no la máquina.
 */
export function avisoDePalabras(cuantas: number, rango: Rango): { texto: string; pasada: boolean } {
  const cuenta = `${cuantas} ${cuantas === 1 ? "palabra" : "palabras"}`;
  if (rango.min === null && rango.max === null) return { texto: cuenta, pasada: false };
  const piden =
    rango.min !== null && rango.max !== null ? `entre ${rango.min} y ${rango.max}`
    : rango.min !== null ? `al menos ${rango.min}`
    : `como mucho ${rango.max}`;
  const pasada = (rango.max !== null && cuantas > rango.max) || (rango.min !== null && cuantas < rango.min);
  return { texto: `${cuenta} (te piden ${piden})`, pasada };
}

export function Folio({
  texto, rango, bloqueado, alEscribir,
}: {
  texto: string;
  rango: Rango;
  bloqueado: boolean;
  alEscribir: (texto: string) => void;
}) {
  const aviso = avisoDePalabras(palabras(texto), rango);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <textarea
        value={texto}
        disabled={bloqueado}
        onChange={(e) => alEscribir(e.target.value)}
        rows={16}
        className="w-full rounded-2xl border border-tinta-suave/30 p-4 leading-relaxed disabled:bg-tinta-suave/5"
        placeholder="Escribe aquí."
      />
      <p className={aviso.pasada ? "text-sm font-bold text-error-600" : "text-sm text-tinta-suave"}>{aviso.texto}</p>
    </div>
  );
}
```

- [ ] **Step 4: Escribir el enunciado**

`components/examen/enunciado-de-escrita.tsx`: un componente de lectura que reparte por forma. Pinta la consigna, los textos sueltos y, según la forma:

```tsx
"use client";

import type { Formulario } from "@/lib/taller/formas";

const PAUTAS = "list-disc pl-6";

/**
 * El enunciado de una tarea de escrita, como lo ve el estudiante. Es de
 * LECTURA: no edita nada (eso es el taller). Lo único que se toca aquí es
 * elegir opción en la tarea 2, y solo si llega `alElegir`.
 */
export function EnunciadoDeEscrita({
  formulario, opcionElegida, alElegir, bloqueado = false,
}: {
  formulario: Formulario;
  opcionElegida: number | null;
  alElegir?: (opcion: number) => void;
  bloqueado?: boolean;
}) {
  if (formulario.forma === "REDACCION_UNA") {
    const a = formulario.actividad;
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <p>{formulario.consigna}</p>
        {a.situacion && <p>{a.situacion}</p>}
        {a.textoRecibido && (
          <blockquote className="rounded-2xl border border-tinta-suave/20 bg-tinta-suave/5 p-4 whitespace-pre-line">
            {a.textoRecibido}
          </blockquote>
        )}
        <ul className={PAUTAS}>
          {a.pautas.filter((p) => p.trim() !== "").map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      </section>
    );
  }
  if (formulario.forma === "REDACCION_DOS") {
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <p>{formulario.consigna}</p>
        {formulario.actividad.opciones.map((o, i) => {
          const numero = i + 1;
          return (
            <label key={numero} className="flex gap-3 rounded-2xl border border-tinta-suave/20 p-4">
              <input
                type="radio"
                name="opcion-de-la-escrita"
                checked={opcionElegida === numero}
                disabled={bloqueado || !alElegir}
                onChange={() => alElegir?.(numero)}
                className="mt-1"
              />
              <span className="flex flex-col gap-2">
                <span className="font-bold">{o.titulo || `Opción ${numero}`}</span>
                {o.contexto && <span className="whitespace-pre-line">{o.contexto}</span>}
                <ul className={PAUTAS}>
                  {o.pautas.filter((p) => p.trim() !== "").map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              </span>
            </label>
          );
        })}
      </section>
    );
  }
  // Ninguna otra forma llega aquí: la escrita solo tiene estas dos. Si algún
  // día llega otra, mejor no pintar nada que pintar algo a medias.
  return null;
}
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npx vitest run tests/examen-pantallas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/examen/folio.tsx components/examen/enunciado-de-escrita.tsx tests/examen-pantallas.test.tsx
git commit -m "El folio con su cuenta de palabras y el enunciado de las dos escritas"
```

---

### Task 8: Las cuatro caras de la escrita

**Files:**
- Create: `components/examen/hacer-escrita.tsx`
- Modify: `components/examen/hacer-prueba.tsx` (el encaminado de `HacerPrueba`)
- Modify: `tests/examen-pantallas.test.tsx`

**Interfaces:**
- Consumes: `Folio`, `EnunciadoDeEscrita` (Task 7); `guardarEscritoAccion` (Task 6); `empezarPruebaAccion`, `entregarPruebaAccion` (ya existían); `PruebaParaHacer.escritos` (Task 5).
- Produces: `<HacerEscrita prueba />`; `export function hayQueGuardar(guardado, actual): boolean`; `export function loQueFalta(prueba, borradores): string[]`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/examen-pantallas.test.tsx`:

```ts
describe("la escrita", () => {
  // Mutación que la mata: guardar siempre que salte el temporizador, haya
  // cambiado algo o no. Serían cientos de escrituras por redacción, y cada una
  // reescribiendo la misma fila con lo mismo.
  it("solo guarda lo que ha cambiado", () => {
    expect(hayQueGuardar({ texto: "Hola", opcion: null }, { texto: "Hola", opcion: null })).toBe(false);
    expect(hayQueGuardar({ texto: "Hola", opcion: null }, { texto: "Hola ", opcion: null })).toBe(true);
    expect(hayQueGuardar({ texto: "Hola", opcion: null }, { texto: "Hola", opcion: 2 })).toBe(true);
  });

  // Mutación que la mata: avisar solo del folio vacío y olvidar la opción sin
  // elegir. Se puede entregar una tarea 2 escrita sobre ninguna opción.
  it("dice lo que falta antes de entregar", () => {
    expect(loQueFalta(escritaParaHacer(), { 1: { texto: "", opcion: null }, 2: { texto: "Algo", opcion: 1 } })).toEqual([
      "la tarea 1 está en blanco",
    ]);
    expect(loQueFalta(escritaParaHacer(), { 1: { texto: "Algo", opcion: null }, 2: { texto: "Algo", opcion: null } })).toEqual([
      "no has elegido opción en la tarea 2",
    ]);
    expect(loQueFalta(escritaParaHacer(), { 1: { texto: "A", opcion: null }, 2: { texto: "B", opcion: 1 } })).toEqual([]);
  });

  // Mutación que la mata: usar la cara de la lectura para la escrita. La
  // pantalla pediría letras sobre preguntas que no existen.
  it("la escrita entregada y sin corregir dice que espera", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaEsperando()} />);
    expect(html).toContain("Esperando corrección");
    expect(html).not.toContain("Entregar");
  });

  // Mutación que la mata: pintar la nota sin mirar `correccion`. Diría «null de
  // 24» a quien todavía no ha sido corregido.
  it("la escrita corregida enseña las bandas, los comentarios y la suma", () => {
    const html = renderToStaticMarkup(<HacerPrueba prueba={escritaCorregida()} />);
    expect(html).toContain("18 de 24");
    expect(html).toContain("Adecuación al género discursivo");
    expect(html).toContain("Muy bien el saludo");
  });
});
```

`escritaParaHacer()`, `escritaEsperando()`, `escritaCorregida()` y `escritaLibre()` son ayudas locales del fichero de pruebas: parten de un `PruebaParaHacer` de mentira con `prueba: "EE"`, las dos tareas de escrita y el `estado` que toque, como ya hace `entregadaCon19De25` para la lectura. `escritaCorregida()` lleva `escritos: [{ tarea: 1, ..., correccion: { bandas: [3,2,2,1], comentario: "Muy bien el saludo" } }, ...]` y `estado: { estado: "ENTREGADA", aciertos: 18, total: 24, porTiempo: false }`.

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/examen-pantallas.test.tsx`
Expected: FAIL — no existe `hacer-escrita.tsx`.

- [ ] **Step 3: Escribir las dos funciones puras y las cuatro caras**

`components/examen/hacer-escrita.tsx`. Las dos funciones van fuera de React, exportadas, para poder probarlas sin pintar nada:

```tsx
export type Borrador = { texto: string; opcion: number | null };

/** Nada que mandar si no ha cambiado nada desde el último guardado. */
export function hayQueGuardar(guardado: Borrador, actual: Borrador): boolean {
  return guardado.texto !== actual.texto || guardado.opcion !== actual.opcion;
}

/**
 * Lo que le falta antes de entregar, en palabras suyas. Mira las dos cosas que
 * se pueden quedar a medias: el folio en blanco y, en una tarea con opciones,
 * no haber elegido ninguna.
 */
export function loQueFalta(prueba: PruebaParaHacer, borradores: Record<number, Borrador>): string[] {
  const falta: string[] = [];
  for (const tarea of prueba.tareas) {
    const b = borradores[tarea.numero] ?? { texto: "", opcion: null };
    if (b.texto.trim() === "") falta.push(`la tarea ${tarea.numero} está en blanco`);
    else if (tarea.formulario.forma === "REDACCION_DOS" && b.opcion === null) {
      falta.push(`no has elegido opción en la tarea ${tarea.numero}`);
    }
  }
  return falta;
}
```

Las caras, con la misma forma que `hacer-prueba.tsx`:

- **`AvisoDeLaEscrita`**: «Tienes 50 minutos. Cuando se acaben, la prueba se entrega ella sola: no se puede repetir.» y «Empezar» (llama a `empezarPruebaAccion`).
- **`EscritaHaciendo`**: `<Reloj>` arriba (el que ya existe, con `alAcabarse` → `entregarPruebaAccion`, y la misma bandera de una sola entrega automática que `PruebaHaciendo`), `<PestanasDeTarea>` (reutilizada de `hacer-prueba.tsx`), y para la tarea abierta: `<EnunciadoDeEscrita>` y `<Folio>` en dos columnas en ordenador (`md:grid-cols-2`) y una debajo de otra en el móvil. El guardado automático:

```tsx
  // El borrador viaja al servidor dos segundos después de dejar de teclear, al
  // cambiar de pestaña y antes de entregar. No en cada tecla: serían cientos de
  // escrituras por redacción. El temporizador se limpia al desmontar.
  useEffect(() => {
    if (!hayQueGuardar(guardadoRef.current, borradorAbierto)) return;
    const t = setTimeout(() => { guardar(tareaAbierta); }, 2000);
    return () => clearTimeout(t);
  }, [borradorAbierto, tareaAbierta]);
```

  donde `guardar` llama a `guardarEscritoAccion`, y si contesta error lo enseña y apaga los folios (`bloqueadaPorError`), igual que hace `PruebaHaciendo` al guardar una letra. Un cartelito «Guardando…» / «Guardado» al lado del reloj.

  «Entregar» pregunta primero lo que dice `loQueFalta` (con un `confirm` nativo NO: un `<p>` con «Te falta … ¿Entregar de todas formas?» y dos botones), y al confirmar guarda lo pendiente y llama a `entregarPruebaAccion`.

- **`EscritaEsperando`**: «Entregada. Esperando corrección», la fecha, y las dos tareas con su enunciado y su folio **bloqueado**, con lo que mandó.
- **`EscritaCorregida`**: la suma grande («18 de 24», de `prueba.estado`), y por tarea: el texto, las cuatro bandas con `CRITERIOS_EE[i].nombre` y su `ayuda` si la tiene, y el comentario. Más `VolverAInicio`, que ya existe.

- [ ] **Step 4: Encaminar la escrita en `HacerPrueba`**

En `components/examen/hacer-prueba.tsx`, dentro de `HacerPrueba`, ANTES del reparto actual:

```tsx
  // La escrita tiene sus propias caras: un folio no se parece en nada a
  // veinticinco letras marcadas, y meterla en PruebaHaciendo obligaría a que
  // cada rama de allí preguntara de qué prueba se trata.
  if (prueba.prueba === "EE") return <HacerEscrita prueba={prueba} />;
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npx vitest run tests/examen-pantallas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Mirarlo de verdad, con `tsc` y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errores. (`useEffect` con dependencias, `key` en las listas y los `"use client"` en su sitio son justo lo que aquí se escapa.)

- [ ] **Step 7: Commit**

```bash
git add components/examen/hacer-escrita.tsx components/examen/hacer-prueba.tsx tests/examen-pantallas.test.tsx
git commit -m "Las cuatro caras de la escrita: aviso, folio con reloj, esperando y corregida"
```

---

### Task 9: El modo libre, la única excepción

**Files:**
- Modify: `lib/examen/hacer.ts` (`abrirLaPrueba`: los minutos)
- Modify: `components/examen/hacer-escrita.tsx` (el aviso y el reloj)
- Modify: `tests/base/escritos.test.ts`, `tests/examen-pantallas.test.tsx`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: en una asignación `LIBRE`, `minutos` vale `null` y la escrita no se cierra nunca sola.

Por qué esta tarea existe, y no es un detalle: en modo libre la lectura y la auditiva no crean intento, así que nada del reloj les afecta. **La escrita sí crea intento** —es la excepción decidida en la spec §9—, y `abrirLaPrueba` saca los minutos del NIVEL sin mirar el modo. Tal como está después de la Task 4, una escrita de práctica se cerraría sola a los cincuenta minutos y entraría en la cola sin que nadie hubiera pulsado nada.

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/base/escritos.test.ts`:

```ts
describe("la escrita en modo libre", () => {
  beforeEach(async () => {
    await prisma.asignacion.updateMany({ where: { personaId: ana.id }, data: { modo: "LIBRE" } });
  });

  // Mutación que la mata: sacar los minutos del nivel sin mirar el modo. Una
  // escrita de práctica se cerraría sola a los 50 minutos, entraría en la cola
  // sin que nadie la mandara, y no habría forma de seguir escribiéndola.
  it("no lleva reloj: no se cierra sola ni rebota por tiempo", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    const mucho_despues = new Date(AHORA.getTime() + 5 * 60 * 60_000);
    expect(await guardarEscrito(examen.id, ana.id, 1, "Sigo escribiendo", null, mucho_despues)).toEqual({});
    await cerrarLasQueSePasaron({ personaId: ana.id }, mucho_despues);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(intento.entregadaEn).toBeNull();
  });

  // Mutación que la mata: prohibir entregar en libre. Practicar a escribir sin
  // que nadie lo lea no sirve de nada: es justo lo que decidió el profesor.
  it("se manda a corregir igual, y entra en la cola", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await guardarEscrito(examen.id, ana.id, 1, "Para que me la mires", null, AHORA);
    expect(await entregarPrueba(examen.id, "EE", ana.id, AHORA)).toEqual({});
    expect(await escritosPorCorregir(AHORA)).toHaveLength(1);
  });

  // Mutación que la mata: dejar reabrir una escrita ya mandada en libre. El
  // «repitiendo» del modo libre es de la lectura y la auditiva, que se
  // corrigen solas; aquí hay una persona al otro lado.
  it("una escrita mandada no se reescribe, tampoco en libre", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    expect(await guardarEscrito(examen.id, ana.id, 1, "Otra vez", null, AHORA)).toEqual({
      error: "Esta prueba ya está entregada.",
    });
  });
});
```

Y a `tests/examen-pantallas.test.tsx`:

```ts
// Mutación que la mata: pintar el reloj también en libre. Le pondría una cuenta
// atrás de cincuenta minutos a algo que no se cierra nunca: pura mentira.
it("la escrita libre no enseña reloj y lo dice en el aviso", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={escritaLibre()} />);
  expect(html).not.toContain("50 minutos");
  expect(html).toContain("sin reloj");
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base -- tests/base/escritos.test.ts -t "modo libre"` y `npx vitest run tests/examen-pantallas.test.tsx`
Expected: FAIL — la escrita libre se cierra por tiempo y la pantalla pinta el reloj.

- [ ] **Step 3: Los minutos miran el modo**

En `lib/examen/hacer.ts`, dentro de `abrirLaPrueba`, donde hoy se calculan los minutos:

```ts
  // En modo libre no hay reloj: se practica sin cronómetro. Importa solo en la
  // escrita, que es la única prueba que crea intento en libre (la lectura y la
  // auditiva se corrigen al vuelo y no guardan nada); sin esto, una redacción
  // de práctica se cerraría sola a los cincuenta minutos.
  const minutos = asignacion.modo === "LIBRE" ? null : minutosDePrueba(asignacion.examen.nivel, prueba);
```

(hay que añadir `modo: true` al `select`/`include` de la consulta de la asignación si no viene ya).

- [ ] **Step 4: La pantalla, sin reloj y con otro aviso**

En `components/examen/hacer-escrita.tsx`:

```tsx
  // El reloj es del examen de verdad. En libre no hay ninguno que enseñar.
  const conReloj = prueba.modo === "COMPLETO" && prueba.minutos !== null;
```

y el aviso previo, en libre: «Esto es práctica: escribes **sin reloj** y lo mandas cuando quieras. Cuando lo mandes, ya no se puede cambiar.»

- [ ] **Step 5: Correr y ver que pasan**

Run: `npm run test:base -- tests/base/escritos.test.ts && npx vitest run tests/examen-pantallas.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/examen/hacer.ts components/examen/hacer-escrita.tsx tests/base/escritos.test.ts tests/examen-pantallas.test.tsx
git commit -m "En libre la escrita se guarda y se manda, pero sin reloj"
```

---

### Task 10: La cola y la corrección, por dentro

**Files:**
- Create: `lib/examen/corregir.ts`
- Modify: `lib/tiempo/madrid.ts` (`diasEntre`)
- Create: `tests/base/corregir.test.ts`
- Modify: `tests/tiempo-madrid.test.ts`

**Interfaces:**
- Consumes: `CRITERIOS_EE`, `BANDA_MAXIMA`, `puntosDeEscrita` (Task 1); `sumaDeBandas` (Task 2).
- Produces:
```ts
export type EnLaCola = { intentoId: string; examenId: string; titulo: string; persona: { id: string; nombre: string }; entregadaEn: Date; porTiempo: boolean; diasEsperando: number };
export function escritosPorCorregir(ahora: Date): Promise<EnLaCola[]>;
export type TareaParaCorregir = { numero: number; formulario: Formulario; opcion: number | null; texto: string; palabras: number; bandas: number[]; comentario: string };
export type ParaCorregir = { intentoId: string; examen: { id: string; titulo: string; nivel: Nivel }; persona: { id: string; nombre: string }; entregadaEn: Date; porTiempo: boolean; corregidaEn: Date | null; puntos: number; tareas: TareaParaCorregir[]; siguiente: string | null };
export function escritoParaCorregir(intentoId: string, ahora: Date): Promise<ParaCorregir | null>;
export function guardarCorreccion(intentoId: string, tareas: { tarea: number; bandas: number[]; comentario: string }[], profesorId: string, ahora: Date): Promise<{ error?: string }>;
```

- [ ] **Step 1: La prueba pura de los días**

Añadir a `tests/tiempo-madrid.test.ts`:

```ts
// Mutación que la mata: dividir milisegundos entre 86.400.000. El último
// domingo de octubre tiene 25 horas, y la cola diría «3 días» de dos.
it("los días de espera se cuentan por calendario", () => {
  expect(diasEntre(new Date("2026-10-23T22:00:00Z"), new Date("2026-10-26T08:00:00Z"))).toBe(3);
  expect(diasEntre(new Date("2026-09-20T10:00:00Z"), new Date("2026-09-20T23:00:00Z"))).toBe(0);
});
```

Y en `lib/tiempo/madrid.ts`:

```ts
/** Días de calendario de Madrid entre dos instantes. Ver diasDeRetraso. */
export function diasEntre(desde: Date, hasta: Date): number {
  const a = diaEnMadrid(desde);
  const b = diaEnMadrid(hasta);
  return Math.round((Date.UTC(b.anio, b.mes - 1, b.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / 86_400_000);
}
```

y `diasDeRetraso` pasa a ser `Math.max(1, diasEntre(fechaTope, entregadaEn))`, que es lo mismo que hacía. Correr `npx vitest run tests/tiempo-madrid.test.ts` y ver las dos en verde.

- [ ] **Step 2: Escribir las pruebas de base que fallan**

Crear `tests/base/corregir.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { empezarPrueba, entregarPrueba, guardarEscrito } from "@/lib/examen/hacer";
import { escritosPorCorregir, escritoParaCorregir, guardarCorreccion } from "@/lib/examen/corregir";
import { crearExamenDePruebas } from "../ayudas/examen-de-pruebas";

const AHORA = new Date("2026-09-20T09:00:00Z");
const DESPUES = new Date("2026-09-23T09:00:00Z");

let ana: Persona;
let examen: Examen;
let profe: Persona;

beforeEach(async () => {
  ({ ana, examen } = await crearExamenDePruebas());
  profe = await prisma.persona.create({ data: { correo: "profe@ejemplo.com", nombre: "Profe", papel: "PROFESOR" } });
});

async function anaEntrega(): Promise<string> {
  await empezarPrueba(examen.id, "EE", ana.id, AHORA);
  await guardarEscrito(examen.id, ana.id, 1, "Hola, qué tal", null, AHORA);
  await guardarEscrito(examen.id, ana.id, 2, "Cuento un viaje", 2, AHORA);
  await entregarPrueba(examen.id, "EE", ana.id, AHORA);
  const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
  return intento.id;
}

describe("la cola", () => {
  // Mutación que la mata: no filtrar por corregidaEn. Lo ya corregido se
  // quedaría en la cola para siempre y el profesor lo corregiría dos veces.
  it("solo trae escritas entregadas y sin corregir, lo más viejo arriba", async () => {
    const id = await anaEntrega();
    const cola = await escritosPorCorregir(DESPUES);
    expect(cola).toHaveLength(1);
    expect(cola[0]!.intentoId).toBe(id);
    expect(cola[0]!.persona.nombre).toBe("Ana");
    expect(cola[0]!.diasEsperando).toBe(3);
    await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 2, 2, 1], comentario: "Muy bien el saludo" },
      { tarea: 2, bandas: [3, 3, 1, 1], comentario: "Cuidado con los tiempos" },
    ], profe.id, DESPUES);
    expect(await escritosPorCorregir(DESPUES)).toHaveLength(0);
  });

  // Mutación que la mata: meter en la cola las lecturas entregadas. Se corrigen
  // solas: no hay nada que mirar, y taparían lo que sí espera.
  it("no trae la lectura", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await entregarPrueba(examen.id, "CE", ana.id, AHORA);
    expect(await escritosPorCorregir(DESPUES)).toHaveLength(0);
  });

  // Mutación que la mata: no traer una escrita sin empezar a escribir. Quien
  // entrega en blanco (o a quien cierra el reloj) también hay que corregirlo.
  it("trae también la entregada en blanco", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    await entregarPrueba(examen.id, "EE", ana.id, AHORA);
    expect(await escritosPorCorregir(DESPUES)).toHaveLength(1);
  });
});

describe("corregir", () => {
  // Mutación que la mata: no congelar la suma en `aciertos`/`total`. «Quién lo
  // hace» tendría que volver a sumar bandas cada vez que se pinta, y la nota
  // cambiaría sola el día que el profesor cambiara de criterio.
  it("firma, congela la suma y deja la fecha", async () => {
    const id = await anaEntrega();
    expect(await guardarCorreccion(id, [
      { tarea: 1, bandas: [3, 2, 2, 1], comentario: "Muy bien el saludo" },
      { tarea: 2, bandas: [3, 3, 1, 1], comentario: "Cuidado con los tiempos" },
    ], profe.id, DESPUES)).toEqual({});
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.aciertos).toBe(16);
    expect(intento.total).toBe(24);
    expect(intento.corregidaEn).toEqual(DESPUES);
    expect(intento.corregidaPorId).toBe(profe.id);
  });

  // Mutación que la mata: no validar las bandas. Una dirección pública podría
  // dejar un 99 o un -1 y la suma se iría por el techo.
  it("rebota bandas imposibles y tareas que no son suyas", async () => {
    const id = await anaEntrega();
    expect(await guardarCorreccion(id, [{ tarea: 1, bandas: [9, 0, 0, 0], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa nota no vale." });
    expect(await guardarCorreccion(id, [{ tarea: 1, bandas: [1, 1, 1], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa nota no vale." });
    expect(await guardarCorreccion(id, [{ tarea: 7, bandas: [1, 1, 1, 1], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa tarea no existe." });
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.corregidaEn).toBeNull();
  });

  // Mutación que la mata: dejar corregir una prueba sin entregar. Se le pondría
  // nota a un folio que el chico todavía está escribiendo.
  it("no se corrige lo que no está entregado", async () => {
    await empezarPrueba(examen.id, "EE", ana.id, AHORA);
    const intento = await prisma.intento.findFirstOrThrow({ where: { prueba: "EE" } });
    expect(await guardarCorreccion(intento.id, [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: "" }], profe.id, DESPUES))
      .toEqual({ error: "Esa prueba todavía no está entregada." });
  });

  // Mutación que la mata: no dejar volver a corregir. El profesor tiene derecho
  // a cambiar de opinión, y la fecha tiene que ser la de la última vez.
  it("se puede volver a corregir", async () => {
    const id = await anaEntrega();
    await guardarCorreccion(id, [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: "" }], profe.id, DESPUES);
    const masTarde = new Date("2026-09-24T09:00:00Z");
    await guardarCorreccion(id, [{ tarea: 1, bandas: [3, 3, 3, 3], comentario: "Mejor de lo que me pareció" }], profe.id, masTarde);
    const intento = await prisma.intento.findUniqueOrThrow({ where: { id } });
    expect(intento.aciertos).toBe(12);
    expect(intento.corregidaEn).toEqual(masTarde);
  });

  // Mutación que la mata: no traer el enunciado. El profesor corregiría un
  // texto sin ver a qué contestaba, y en la tarea 2 sin saber qué opción eligió.
  it("para corregir se ve el enunciado, la opción y lo escrito", async () => {
    const id = await anaEntrega();
    const para = await escritoParaCorregir(id, DESPUES);
    expect(para!.tareas.map((t) => t.numero)).toEqual([1, 2]);
    expect(para!.tareas[1]!.opcion).toBe(2);
    expect(para!.tareas[1]!.texto).toBe("Cuento un viaje");
    expect(para!.tareas[0]!.formulario.forma).toBe("REDACCION_UNA");
    expect(para!.puntos).toBe(24);
    expect(para!.persona.nombre).toBe("Ana");
  });
});
```

- [ ] **Step 3: Correrlas y ver que fallan**

Run: `npm run test:base -- tests/base/corregir.test.ts`
Expected: FAIL — el módulo `lib/examen/corregir.ts` no existe.

- [ ] **Step 4: Escribir `lib/examen/corregir.ts`**

```ts
import { prisma } from "@/lib/db";
import type { Nivel } from "@/lib/generated/prisma";
import { BANDA_MAXIMA, CRITERIOS_EE, puntosDeEscrita } from "@/lib/dele/estructura";
import { sumaDeBandas } from "./motor";
import { formularioDePiezas } from "@/lib/taller/piezas";
import type { Formulario } from "@/lib/taller/formas";
import { diasEntre } from "@/lib/tiempo/madrid";

// Literales, como los de lib/examen/hacer.ts: las pruebas los comparan por texto.
const NOTA_MALA = "Esa nota no vale.";
const TAREA_MALA = "Esa tarea no existe.";
const SIN_ENTREGAR = "Esa prueba todavía no está entregada.";

export type EnLaCola = {
  intentoId: string;
  examenId: string;
  titulo: string;
  persona: { id: string; nombre: string };
  entregadaEn: Date;
  porTiempo: boolean;
  diasEsperando: number;
};

/**
 * Las escritas que esperan: entregadas y sin firmar. Lo más viejo arriba, que
 * es el orden en que hay que corregir.
 *
 * `corregidaEn: null` es lo que decide, NO que las bandas estén vacías: el
 * profesor puede haber guardado a medias sin firmar, y eso sigue esperando.
 *
 * No cierra las que se pasaron de hora: esta función solo lee. Las cierra quien
 * tiene ámbito para hacerlo (el Inicio del estudiante y la lista del examen),
 * como se decidió en la 3c.
 */
export async function escritosPorCorregir(ahora: Date): Promise<EnLaCola[]> {
  const intentos = await prisma.intento.findMany({
    where: { prueba: "EE", entregadaEn: { not: null }, corregidaEn: null },
    orderBy: { entregadaEn: "asc" },
    select: {
      id: true,
      entregadaEn: true,
      porTiempo: true,
      asignacion: {
        select: {
          examenId: true,
          examen: { select: { titulo: true } },
          persona: { select: { id: true, nombre: true } },
        },
      },
    },
  });
  return intentos.map((i) => ({
    intentoId: i.id,
    examenId: i.asignacion.examenId,
    titulo: i.asignacion.examen.titulo,
    persona: i.asignacion.persona,
    entregadaEn: i.entregadaEn!,
    porTiempo: i.porTiempo,
    diasEsperando: diasEntre(i.entregadaEn!, ahora),
  }));
}

export type TareaParaCorregir = {
  numero: number;
  formulario: Formulario;
  opcion: number | null;
  texto: string;
  palabras: number;
  bandas: number[];
  comentario: string;
};

export type ParaCorregir = {
  intentoId: string;
  examen: { id: string; titulo: string; nivel: Nivel };
  persona: { id: string; nombre: string };
  entregadaEn: Date;
  porTiempo: boolean;
  corregidaEn: Date | null;
  puntos: number;
  tareas: TareaParaCorregir[];
  /** El siguiente de la cola, para «Guardar y seguir». null si no queda nadie. */
  siguiente: string | null;
};

/**
 * Todo lo que hace falta para corregir una: el enunciado de cada tarea (sin él,
 * el profesor lee un texto sin saber a qué contestaba), la opción elegida en la
 * tarea 2, lo escrito, y lo que ya hubiera puesto si vuelve a entrar.
 *
 * Las tareas salen de las del EXAMEN, no de los escritos: quien entregó en
 * blanco no tiene fila de escrito, y a ese también hay que poder corregirlo.
 */
export async function escritoParaCorregir(intentoId: string, ahora: Date): Promise<ParaCorregir | null> {
  const intento = await prisma.intento.findUnique({
    where: { id: intentoId },
    select: {
      id: true, prueba: true, entregadaEn: true, porTiempo: true, corregidaEn: true,
      escritos: { select: { tarea: true, opcion: true, texto: true, palabras: true, bandas: true, comentario: true } },
      asignacion: {
        select: {
          persona: { select: { id: true, nombre: true } },
          examen: {
            select: {
              id: true, titulo: true, nivel: true,
              tareas: {
                where: { prueba: "EE" },
                orderBy: { numero: "asc" },
                select: {
                  numero: true,
                  piezas: { select: { orden: true, tipo: true, texto: true, etiqueta: true, ficheroId: true, cortes: true, actividad: { select: { datos: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!intento || intento.prueba !== "EE" || !intento.entregadaEn) return null;

  const examen = intento.asignacion.examen;
  const tareas = examen.tareas.flatMap((t): TareaParaCorregir[] => {
    const formulario = formularioDePiezas(t.piezas);
    if (!formulario) return [];
    const escrito = intento.escritos.find((e) => e.tarea === t.numero);
    return [{
      numero: t.numero,
      formulario,
      opcion: escrito?.opcion ?? null,
      texto: escrito?.texto ?? "",
      palabras: escrito?.palabras ?? 0,
      bandas: escrito?.bandas ?? [],
      comentario: escrito?.comentario ?? "",
    }];
  });

  const cola = await escritosPorCorregir(ahora);
  const siguiente = cola.find((c) => c.intentoId !== intentoId)?.intentoId ?? null;

  return {
    intentoId: intento.id,
    examen: { id: examen.id, titulo: examen.titulo, nivel: examen.nivel },
    persona: intento.asignacion.persona,
    entregadaEn: intento.entregadaEn,
    porTiempo: intento.porTiempo,
    corregidaEn: intento.corregidaEn,
    puntos: puntosDeEscrita(examen.nivel),
    tareas,
    siguiente,
  };
}

/**
 * Firmar la corrección. Valida TODO antes de escribir NADA: si una banda de la
 * tarea 2 no vale, la 1 tampoco se guarda. Una corrección a medias sería peor
 * que ninguna, porque la suma congelada saldría de un trozo.
 *
 * `upsert` y no `update`: quien entregó en blanco no tiene fila de escrito.
 *
 * La suma se hace sobre TODOS los escritos del intento después de aplicar lo
 * que llega, no solo sobre lo que llega: corregir solo la tarea 2 no puede
 * borrar la nota de la 1.
 */
export async function guardarCorreccion(
  intentoId: string,
  tareas: { tarea: number; bandas: number[]; comentario: string }[],
  profesorId: string,
  ahora: Date,
): Promise<{ error?: string }> {
  const intento = await prisma.intento.findUnique({
    where: { id: intentoId },
    select: {
      id: true, prueba: true, entregadaEn: true,
      escritos: { select: { tarea: true, bandas: true } },
      asignacion: {
        select: {
          examenId: true,
          examen: { select: { nivel: true, tareas: { where: { prueba: "EE" }, select: { numero: true } } } },
        },
      },
    },
  });
  if (!intento || intento.prueba !== "EE") return { error: TAREA_MALA };
  if (!intento.entregadaEn) return { error: SIN_ENTREGAR };

  const numerosDelExamen = new Set(intento.asignacion.examen.tareas.map((t) => t.numero));
  for (const t of tareas) {
    if (!numerosDelExamen.has(t.tarea)) return { error: TAREA_MALA };
    if (t.bandas.length !== CRITERIOS_EE.length) return { error: NOTA_MALA };
    if (t.bandas.some((b) => !Number.isInteger(b) || b < 0 || b > BANDA_MAXIMA)) return { error: NOTA_MALA };
  }

  // Cómo quedan TODOS los escritos después de esta corrección.
  const despues = new Map(intento.escritos.map((e) => [e.tarea, e.bandas as number[]]));
  for (const t of tareas) despues.set(t.tarea, t.bandas);
  const total = puntosDeEscrita(intento.asignacion.examen.nivel);
  const aciertos = sumaDeBandas([...despues.values()].map((bandas) => ({ bandas })));

  await prisma.$transaction([
    ...tareas.map((t) =>
      prisma.escritoDeIntento.upsert({
        where: { intentoId_tarea: { intentoId, tarea: t.tarea } },
        create: { intentoId, tarea: t.tarea, texto: "", palabras: 0, bandas: t.bandas, comentario: t.comentario },
        update: { bandas: t.bandas, comentario: t.comentario },
      }),
    ),
    prisma.intento.update({
      where: { id: intentoId },
      data: { aciertos, total, corregidaEn: ahora, corregidaPorId: profesorId },
    }),
  ]);
  return {};
}
```

- [ ] **Step 5: Correr y ver que pasan**

Run: `npm run test:base -- tests/base/corregir.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/examen/corregir.ts lib/tiempo/madrid.ts tests/base/corregir.test.ts tests/tiempo-madrid.test.ts
git commit -m "La cola de escritas por corregir y la firma del profesor"
```

---

### Task 11: Las pantallas del profesor

**Files:**
- Create: `app/corregir/page.tsx`
- Create: `app/corregir/[intentoId]/page.tsx`
- Create: `app/corregir/acciones.ts`
- Create: `components/examen/corregir-escrita.tsx`
- Modify: `app/page.tsx` (el enlace «Por corregir» en la navegación del profesor)
- Modify: `tests/examen-pantallas.test.tsx`, `tests/portada.test.ts`, `tests/examen-acciones.test.ts`

**Interfaces:**
- Consumes: `escritosPorCorregir`, `escritoParaCorregir`, `guardarCorreccion` (Task 10); `CRITERIOS_EE`, `BANDA_MAXIMA` (Task 1).
- Produces: `guardarCorreccionAccion(intentoId: string, tareas: { tarea: number; bandas: number[]; comentario: string }[]): Promise<{ error?: string }>`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/examen-pantallas.test.tsx` (mismo estilo que las pantallas del taller: se importa la página y se doblan la sesión y la base):

```ts
// Mutación que la mata: quitar exigirProfesor de la página. Un estudiante
// vería los textos y las notas de todos sus compañeros con solo escribir la
// dirección.
it("la cola no se le enseña a un estudiante", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(ana); // ESTUDIANTE
  const { default: Cola } = await import("@/app/corregir/page");
  await expect(Cola()).rejects.toThrow();
});

// Mutación que la mata: pintar la cola sin los días de espera. Es el único dato
// que dice por dónde empezar.
it("la cola dice quién, qué examen y cuántos días lleva", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(profe);
  dobles.escritosPorCorregir.mockResolvedValue([
    { intentoId: "i1", examenId: "ex1", titulo: "Libro, examen 1", persona: { id: "p1", nombre: "Ana" }, entregadaEn: new Date("2026-09-20T09:00:00Z"), porTiempo: true, diasEsperando: 3 },
  ]);
  const html = renderToStaticMarkup(await Cola());
  expect(html).toContain("Ana");
  expect(html).toContain("Libro, examen 1");
  expect(html).toContain("3 días");
  expect(html).toContain("por tiempo");
});

// Mutación que la mata: pintar las bandas sin `max` (o con uno distinto de
// BANDA_MAXIMA). Se podría firmar un 7 en un criterio que llega hasta 3.
it("la pantalla de corregir trae las ocho casillas y los dos textos", () => {
  const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
  expect(html).toContain("Adecuación al género discursivo");
  expect(html).toContain('max="3"');
  expect((html.match(/type="number"/g) ?? []).length).toBe(8);
  expect(html).toContain("Hola, qué tal");
});
```

Y en `tests/examen-acciones.test.ts`:

```ts
// Mutación que la mata: usar exigirPersona en vez de exigirProfesor. Un
// estudiante se pondría nota a sí mismo llamando a la dirección.
it("guardarCorreccionAccion es solo del profesor", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(ana); // ESTUDIANTE
  const { guardarCorreccionAccion } = await import("@/app/corregir/acciones");
  await expect(guardarCorreccionAccion("i1", [{ tarea: 1, bandas: [1, 1, 1, 1], comentario: "" }])).rejects.toThrow();
  expect(dobles.guardarCorreccion).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/examen-pantallas.test.tsx tests/examen-acciones.test.ts`
Expected: FAIL — las páginas y la acción no existen.

- [ ] **Step 3: Escribir la acción**

`app/corregir/acciones.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { guardarCorreccion } from "@/lib/examen/corregir";

/**
 * Firmar una corrección. `exigirProfesor`, no `exigirPersona`: es la única
 * puerta por la que se pone una nota, y una acción de servidor es una
 * dirección pública. Tampoco recibe quién corrige: sale de la sesión.
 */
export async function guardarCorreccionAccion(
  intentoId: string,
  tareas: { tarea: number; bandas: number[]; comentario: string }[],
): Promise<{ error?: string }> {
  const profesor = await exigirProfesor();
  const r = await guardarCorreccion(intentoId, tareas, profesor.id, new Date());
  revalidatePath("/corregir");
  revalidatePath(`/corregir/${intentoId}`);
  return r;
}
```

- [ ] **Step 4: Escribir las dos páginas y el componente**

`app/corregir/page.tsx` (servidor): `await exigirProfesor()`, `await cerrarLasQueSePasaron(...)` **no** — aquí no hay ámbito de una persona ni de un examen; la cola solo lee, y las que se pasaron ya las cierra el Inicio del estudiante o la lista del profesor. Luego `escritosPorCorregir(new Date())` y una lista con nombre, examen, «entregada el …», «por tiempo» si lo fue, «3 días esperando» y un enlace a `/corregir/<intentoId>`. Si está vacía: «No hay nada esperando.»

`app/corregir/[intentoId]/page.tsx`: `await exigirProfesor()`, `escritoParaCorregir(intentoId, new Date())`, `notFound()` si no hay, y `<CorregirEscrita para={...} />`.

`components/examen/corregir-escrita.tsx` (cliente): por cada tarea, `<EnunciadoDeEscrita formulario={t.formulario} opcionElegida={t.opcion} bloqueado />`, el texto del estudiante en un bloque de solo lectura con su cuenta de palabras, las cuatro casillas (`<input type="number" min={0} max={BANDA_MAXIMA} step={1}>` con `CRITERIOS_EE[i].nombre` de etiqueta y su `ayuda` debajo si no está vacía) y un `<textarea>` de comentario. Abajo: «Guardar» y «Guardar y seguir» (esta última navega a `/corregir/${para.siguiente}` si lo hay, y si no a `/corregir`). Los dos botones se apagan mientras se manda. Si `para.corregidaEn` no es null, un aviso arriba: «Ya la corregiste el …; si guardas, se cambia.»

- [ ] **Step 5: El enlace en Inicio**

En `app/page.tsx`, dentro del bloque `esProfesor`, encima de «Exámenes»:

```tsx
            {esProfesor && (
              <Link href="/corregir" className="text-hp-600 underline">
                Por corregir{porCorregir > 0 ? ` (${porCorregir})` : ""}
              </Link>
            )}
```

con `const porCorregir = esProfesor ? (await escritosPorCorregir(ahora)).length : 0;` junto a las demás lecturas de arriba (solo si es profesor: al estudiante no se le pide).

- [ ] **Step 6: Correr y ver que pasan**

Run: `npx vitest run tests/examen-pantallas.test.tsx tests/examen-acciones.test.ts tests/portada.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS y 0 errores.

- [ ] **Step 7: Commit**

```bash
git add app/corregir components/examen/corregir-escrita.tsx app/page.tsx tests/examen-pantallas.test.tsx tests/examen-acciones.test.ts tests/portada.test.ts
git commit -m "Por corregir: la cola en la cabecera y la pantalla de las ocho bandas"
```

---

### Task 12: La ficha pregunta a pregunta

**Files:**
- Create: `app/examenes/[id]/hoja/[personaId]/[prueba]/page.tsx`
- Modify: `lib/examen/corregir.ts` (o crear `lib/examen/hoja.ts` si aquel pasa de 250 líneas)
- Modify: `components/taller/quien-lo-hace.tsx` (el estado, en enlace)
- Modify: `tests/base/corregir.test.ts`, `tests/examen-pantallas.test.tsx`

**Interfaces:**
- Consumes: `notaDePrueba` no: la ficha NO recalcula. Lee `Clave`, `RespuestaDeIntento` y `Intento.fallos`.
- Produces: `hojaDeRespuestas(examenId: string, personaId: string, prueba: Prueba): Promise<{ persona: { nombre: string }; titulo: string; prueba: Prueba; aciertos: number | null; total: number | null; filas: { numero: number; marcada: string | null; correcta: string }[] } | null>`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/base/corregir.test.ts`:

```ts
describe("la ficha pregunta a pregunta", () => {
  // Mutación que la mata: no devolver la letra correcta. La ficha existe justo
  // para eso: ver que marcó B donde iba A.
  it("dice lo que marcó y lo que era, pregunta a pregunta", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    await guardarRespuesta(examen.id, "CE", ana.id, 7, "A", AHORA);
    await guardarRespuesta(examen.id, "CE", ana.id, 8, "C", AHORA); // la buena es B
    await entregarPrueba(examen.id, "CE", ana.id, AHORA);
    const hoja = await hojaDeRespuestas(examen.id, ana.id, "CE");
    expect(hoja!.filas).toContainEqual({ numero: 7, marcada: "A", correcta: "A" });
    expect(hoja!.filas).toContainEqual({ numero: 8, marcada: "C", correcta: "B" });
    // Las que no contestó salen como no contestadas, no como fallo mudo.
    expect(hoja!.filas.find((f) => f.numero === 9)!.marcada).toBeNull();
    expect(hoja!.filas.map((f) => f.numero)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  // Mutación que la mata: devolver la ficha de una prueba sin entregar. La
  // clave bajaría a una pantalla mientras el chico todavía la está haciendo.
  it("no hay ficha de lo que no está entregado", async () => {
    await empezarPrueba(examen.id, "CE", ana.id, AHORA);
    expect(await hojaDeRespuestas(examen.id, ana.id, "CE")).toBeNull();
  });
});
```

En `tests/examen-pantallas.test.tsx`:

```ts
// Mutación que la mata: quitar exigirProfesor de la página de la ficha. Sería
// la puerta por la que la clave del examen sale hacia un estudiante.
it("la ficha no se le enseña a un estudiante", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(ana);
  const { default: Hoja } = await import("@/app/examenes/[id]/hoja/[personaId]/[prueba]/page");
  await expect(Hoja({ params: Promise.resolve({ id: "ex1", personaId: "p1", prueba: "CE" }) })).rejects.toThrow();
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base -- tests/base/corregir.test.ts` y `npx vitest run tests/examen-pantallas.test.tsx`
Expected: FAIL — `hojaDeRespuestas` no existe.

- [ ] **Step 3: Escribir `hojaDeRespuestas` y la pantalla**

```ts
export type FilaDeHoja = { numero: number; marcada: string | null; correcta: string };
export type HojaDeRespuestas = {
  persona: { nombre: string };
  titulo: string;
  prueba: Prueba;
  aciertos: number | null;
  total: number | null;
  filas: FilaDeHoja[];
};

/**
 * La ficha del profesor: qué marcó esta persona en cada pregunta y qué era.
 *
 * Es la ÚNICA pantalla fuera del taller que lee la tabla `Clave`, y por eso su
 * página exige PROFESOR. Tres cosas que no son obvias:
 *
 * - Devuelve null si la prueba no está entregada. Mientras se hace, la clave no
 *   sale de su tabla ni para el profesor: una pestaña abierta en su portátil no
 *   puede ser la vía por la que se filtre.
 * - Las filas salen de recorrer la CLAVE, no las respuestas. Una pregunta sin
 *   contestar tiene que aparecer, y aparece con `marcada: null`; si se
 *   recorrieran las respuestas, las que dejó en blanco desaparecerían.
 * - No recalcula la nota: enseña la congelada en el intento. Si el profesor
 *   corrigiera hoy una tarea del examen, el 19 de 25 de aquel día sigue siendo
 *   el de aquel día.
 */
export async function hojaDeRespuestas(
  examenId: string,
  personaId: string,
  prueba: Prueba,
): Promise<HojaDeRespuestas | null> {
  const asignacion = await prisma.asignacion.findUnique({
    where: { examenId_personaId: { examenId, personaId } },
    select: {
      persona: { select: { nombre: true } },
      examen: { select: { titulo: true } },
      intentos: {
        where: { prueba },
        select: { entregadaEn: true, aciertos: true, total: true, respuestas: { select: { numero: true, letra: true } } },
      },
    },
  });
  const intento = asignacion?.intentos[0];
  if (!asignacion || !intento || !intento.entregadaEn) return null;

  // La misma unión de claves que usa la nota (lib/examen/hacer.ts), por tarea.
  const tareas = await prisma.tarea.findMany({
    where: { examenId, prueba },
    select: { piezas: { select: { actividad: { select: { clave: { select: { respuestas: true } } } } } } },
  });
  const clave: Record<string, string> = {};
  for (const tarea of tareas) {
    for (const pieza of tarea.piezas) {
      const respuestas = pieza.actividad?.clave?.respuestas;
      if (respuestas && typeof respuestas === "object" && !Array.isArray(respuestas)) {
        Object.assign(clave, respuestas as Record<string, string>);
      }
    }
  }

  const marcadas = new Map(intento.respuestas.map((r) => [String(r.numero), r.letra]));
  const filas = Object.entries(clave)
    .map(([numero, correcta]) => ({
      numero: Number(numero),
      marcada: (marcadas.get(numero) ?? "").trim() === "" ? null : marcadas.get(numero)!,
      correcta,
    }))
    .sort((a, b) => a.numero - b.numero);

  return {
    persona: asignacion.persona,
    titulo: asignacion.examen.titulo,
    prueba,
    aciertos: intento.aciertos,
    total: intento.total,
    filas,
  };
}
```

La página `app/examenes/[id]/hoja/[personaId]/[prueba]/page.tsx`: `await exigirProfesor()`, `esPrueba(prueba)` o `notFound()`, `hojaDeRespuestas(...)` o `notFound()`, y una tabla de cuatro columnas —número, lo que marcó (o «sin contestar», en cursiva), lo que era, y una marca de fallo— con la fila en rojo (`bg-error-100`) cuando `marcada !== correcta`. Arriba: el nombre, el examen, el nombre de la prueba y la nota congelada. Abajo, un enlace de vuelta a `/examenes/<id>`.

- [ ] **Step 4: El enlace en «Quién lo hace»**

En `components/taller/quien-lo-hace.tsx`, donde hoy se pinta `p.texto` de cada prueba, envolverlo en un `<Link>` a `/examenes/${examenId}/hoja/${personaId}/${p.prueba}` **solo cuando** `p.estado.estado === "ENTREGADA"` y la prueba es CE o CO (la escrita se corrige en `/corregir`, que es otra pantalla). Para una escrita esperando, el texto se queda sin enlace.

- [ ] **Step 5: Correr y ver que pasan**

Run: `npm run test:base -- tests/base/corregir.test.ts && npx vitest run tests/examen-pantallas.test.tsx tests/taller-pantallas.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/examenes lib/examen components/taller/quien-lo-hace.tsx tests/base/corregir.test.ts tests/examen-pantallas.test.tsx
git commit -m "La ficha pregunta a pregunta, colgada del estado en Quien lo hace"
```

---

### Task 13: Las suites enteras, el repaso y la aceptación

**Files:** ninguno nuevo. Es la tarea de cerrar.

- [ ] **Step 1: Las dos suites enteras, una sola vez**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run test:base`
Expected: todo en verde, 0 errores de lint. Apuntar los números (cuántas pruebas en cada una) en el commit de cierre.

- [ ] **Step 2: Los cuatro registros que nadie recuerda**

Módulo nuevo = sitios que hay que tocar y que ninguna prueba del módulo caza. Repasar uno por uno y arreglar lo que falte:

1. `PRUEBAS_QUE_SE_HACEN` — hecho en la Task 5.
2. La navegación del Inicio del profesor — hecha en la Task 10.
3. `lib/examen/motor.ts` `textoDelEstado` para el estado nuevo — hecho en la Task 2.
4. Que `quitarAsignacion` siga negándose con un intento de escrita empezado (la regla de la 3c): comprobarlo a mano con `grep -n "quitarAsignacion" -A 15 lib/examen/asignar.ts`. Si mira solo `intentos` sin filtrar por prueba, ya vale.

- [ ] **Step 3: El repaso de toda la rama**

Pedir una revisión de código de la rama entera con el modelo grande (`/code-review high` o un subagente con el diff de `main..taller-3d`). Lo que se busca, por orden: una vía por la que la corrección sin firmar llegue al navegador del estudiante; una escritura sin las cinco comprobaciones; y un `estado.estado === "ENTREGADA"` que se haya quedado suelto.

- [ ] **Step 4: Los diez pasos de la aceptación**

Los de la sección 12 de la spec, en producción y con el examen 1, con el profesor delante. **Antes de nada, el paso que arrastra la 3c:** arrastrar la marca de 4:35 de la auditiva 4 al silencio de 5:54-6:04.

- [ ] **Step 5: Fusionar, con el sí del profesor**

```bash
git -C /Users/FLE/Projects/hispaprofe-dele status --short   # tiene que estar limpio
git -C /Users/FLE/Projects/hispaprofe-dele merge --no-ff taller-3d
git -C /Users/FLE/Projects/hispaprofe-dele push origin <sha probado>:main
```

Empujar INMEDIATAMENTE después de fusionar, y empujar el commit que se probó, no la punta. Después, salvar el ledger (`.superpowers`) antes de retirar el worktree.
