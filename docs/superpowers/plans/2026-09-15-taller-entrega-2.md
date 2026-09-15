# El taller, Entrega 2: rellenar una tarea con IA · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón «Rellenar con IA» en la pantalla de una tarea que lee sus hojas con Claude Opus 5 y llena el formulario en pantalla, sin guardar nada, con las dudas marcadas y cada llamada apuntada con su coste.

**Architecture:** Lógica pura en `lib/taller/ia/` (coste, imponer la estructura, dudas, encargo, interpretar la respuesta), una capa fina de red (`llamar.ts` con el SDK, `hojas.ts` con el almacén) y un orquestador (`rellenar.ts`) que recibe sus dependencias inyectadas para probarlo sin red. Una acción de servidor con candado. En el cliente, un contexto de dudas que lee cada `Campo` por su ruta.

**Tech Stack:** Next 16 (App Router, acciones de servidor), React 19, Prisma 7 con `@prisma/adapter-pg`, Zod 4, Vitest, `@anthropic-ai/sdk` 0.125.0, `@vercel/blob` 2.8.

**Spec:** `docs/superpowers/specs/2026-09-15-taller-entrega-2-design.md`

## Global Constraints

- Todo texto que ve una persona, en español.
- **El repositorio es PÚBLICO.** Ni hojas del libro, ni sus textos, ni letras reales entran en el repo. Los datos de prueba son inventados.
- **Ninguna prueba llama a la API de Anthropic de verdad.** La IA se inyecta falsa. La única llamada real es la de la aceptación (Tarea 9), a mano.
- **Rellenar NO escribe en `Tarea`, `Pieza`, `Actividad` ni `Clave`.** Solo escribe en `LlamadaDeIA`.
- Modelo `claude-opus-5` exacto. `@anthropic-ai/sdk` fijado a `0.125.0` exacto (sin `^`). Beta `server-side-fallback-2026-07-01` con `fallbacks: "default"`. Razonamiento `{ type: "adaptive" }`, `effort: "high"`. Nunca `thinking: { type: "disabled" }`, nunca `budget_tokens`, nunca herramienta forzada.
- Los errores del SDK se distinguen por clase (`Anthropic.AuthenticationError`…), nunca por el texto.
- Esquemas con `z.strictObject` (Zod 4).
- Toda pantalla y toda acción del taller empiezan por `await exigirProfesor()`.
- Nada que cambie datos es un GET.
- Next 16 no es el Next que conoces: antes de tocar `maxDuration` o acciones de servidor, leer la guía que toque en `node_modules/next/dist/docs/`.
- Prisma 7: la migración se genera contra un Postgres de usar y tirar (Tarea 2).
- Pruebas: `npm test` (sin base) y `npm run test:base` (contra Postgres). Tipos: `npx tsc --noEmit`. Lint: `npm run lint`. Correr acotado: `npx vitest run tests/<fichero>`.
- Cada prueba nueva lleva un comentario «Mutación que la mata: …». Comprobar a mano al menos una por tarea (aplicar la mutación, ver rojo, deshacer).
- Mensajes de commit con heredoc de comillas simples (`git commit -F - <<'EOF'`). Cada commit termina con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
  ```
- Worktree `/Users/FLE/Projects/hispaprofe-dele-taller-2`, rama `taller-2` (sin upstream a propósito). `git branch --show-current` antes de cada commit. Nunca `git add -A`: rutas concretas. No se fusiona ni se empuja sin el «sí» del profesor.

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `lib/taller/ia/coste.ts` | Tokens → milésimas de dólar; texto del gasto de un examen |
| `prisma/schema.prisma` + migración `taller_entrega_2` | `LlamadaDeIA`, `ResultadoDeLlamada` |
| `lib/taller/ia/registro.ts` | Apuntar una llamada; sumar el gasto de un examen |
| `lib/taller/ia/estructura.ts` | `imponerEstructura(vacio, leido)` |
| `lib/taller/ia/dudas.ts` | Tipo `Duda`, rutas ↔ claves, filtrar y quitar dudas, `tieneAlgoEscrito` |
| `lib/taller/formas.ts` | Gana `ESQUEMA_DE_FORMA` (el esquema de cada forma suelto) |
| `lib/taller/ia/encargo.ts` | Instrucciones fijas, descripción de cada forma, esquema de respuesta, encargo de una tarea |
| `lib/taller/ia/hojas.ts` | Descargar una hoja del almacén en base64 |
| `lib/taller/ia/llamar.ts` | La llamada real con el SDK; `hayClaveDeIA` |
| `lib/taller/ia/errores.ts` | Error del SDK → mensaje |
| `lib/taller/ia/rellenar.ts` | `interpretar` (puro) y `rellenarTarea` (orquestador) |
| `app/examenes/acciones.ts` | `rellenarTareaConIAAccion` |
| `lib/taller/examenes.ts` | `examenParaElTaller` gana `gasto` |
| `app/examenes/[id]/page.tsx` | La línea del gasto |
| `app/examenes/[id]/[prueba]/[numero]/page.tsx` | `maxDuration`, `hayClave`, `hayHojas` |
| `components/taller/dudas.tsx` | `DudasContext`, `useDuda` |
| `components/taller/campo.tsx`, `formas-cerradas.tsx`, `formas-abiertas.tsx` | Cada campo recibe su `ruta` y pinta su duda |
| `components/taller/formulario-de-tarea.tsx` | Botón, estado de dudas, sustituir el formulario |

---

### Task 1: El coste de una llamada y el texto del gasto

**Files:**
- Create: `lib/taller/ia/coste.ts`
- Test: `tests/taller-ia-coste.test.ts`

**Interfaces:**
- Produces: `type Uso = { entrada: number; cacheLeidos: number; cacheEscritos: number; salida: number }`, `SIN_USO: Uso`, `costeEnMilesimas(uso: Uso): number`, `textoDelGasto(gasto: { llamadas: number; milesimas: number }): string | null`

- [ ] **Step 0: Preparar el worktree**

```bash
cd /Users/FLE/Projects/hispaprofe-dele-taller-2
git branch --show-current   # taller-2
npm ci
```
Si `npm ci` muere en `prisma generate` por falta de `DIRECT_URL` (Prisma 7 la exige al cargar `prisma.config.ts`, aunque `generate` no conecta):
```bash
DIRECT_URL=postgresql://x@127.0.0.1:1/x DATABASE_URL=postgresql://x@127.0.0.1:1/x npm ci
```
Luego `npm test 2>&1 | tail -n 5` y **apuntar en el ledger cuántas pruebas y ficheros pasan hoy**: es la cifra de partida.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-ia-coste.test.ts
import { describe, it, expect } from "vitest";
import { costeEnMilesimas, SIN_USO, textoDelGasto } from "@/lib/taller/ia/coste";

describe("el coste de una llamada a la IA", () => {
  // 10.000 × 0,005 + 20.000 × 0,0005 + 4.000 × 0,00625 + 3.000 × 0,025 = 50 + 10 + 25 + 75
  // Mutación que la mata: cobrar la caché leída a precio de entrada (0,005).
  it("suma entrada, caché leída, caché escrita y salida con sus tarifas", () => {
    expect(costeEnMilesimas({ entrada: 10_000, cacheLeidos: 20_000, cacheEscritos: 4_000, salida: 3_000 })).toBe(160);
  });

  // Mutación que la mata: cobrar la salida a 0,005 como la entrada.
  it("la salida cuesta cinco veces la entrada", () => {
    expect(costeEnMilesimas({ ...SIN_USO, salida: 1_000 })).toBe(25);
    expect(costeEnMilesimas({ ...SIN_USO, entrada: 1_000 })).toBe(5);
  });

  // Mutación que la mata: devolver milésimas con decimales (quitar Math.round).
  it("redondea a milésimas enteras", () => {
    expect(Number.isInteger(costeEnMilesimas({ ...SIN_USO, entrada: 333 }))).toBe(true);
  });
});

describe("el texto del gasto de un examen", () => {
  // Mutación que la mata: formatear con punto decimal ("1.84").
  it("dice dólares con coma y cuántas llamadas", () => {
    expect(textoDelGasto({ llamadas: 14, milesimas: 1_840 })).toBe("IA: 1,84 $ en 14 llamadas");
  });

  // Mutación que la mata: quitar el singular.
  it("una llamada va en singular", () => {
    expect(textoDelGasto({ llamadas: 1, milesimas: 90 })).toBe("IA: 0,09 $ en 1 llamada");
  });

  // Mutación que la mata: devolver "IA: 0,00 $ en 0 llamadas" en vez de null.
  it("sin llamadas no dice nada", () => {
    expect(textoDelGasto({ llamadas: 0, milesimas: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/taller-ia-coste.test.ts`
Expected: FAIL, no se encuentra `@/lib/taller/ia/coste`.

- [ ] **Step 3: Implementar**

```ts
// lib/taller/ia/coste.ts
export type Uso = { entrada: number; cacheLeidos: number; cacheEscritos: number; salida: number };

export const SIN_USO: Uso = { entrada: 0, cacheLeidos: 0, cacheEscritos: 0, salida: 0 };

// Tarifas de claude-opus-5 en milésimas de dólar POR TOKEN: 5 $ el millón de
// entrada son 0,005 milésimas por token. Leer caché va al 10 % de la entrada y
// escribirla al 125 %. Es una estimación: si responde el modelo de respaldo, la
// factura manda.
const TARIFA = { entrada: 0.005, cacheLeidos: 0.0005, cacheEscritos: 0.00625, salida: 0.025 } as const;

export function costeEnMilesimas(uso: Uso): number {
  return Math.round(
    uso.entrada * TARIFA.entrada +
      uso.cacheLeidos * TARIFA.cacheLeidos +
      uso.cacheEscritos * TARIFA.cacheEscritos +
      uso.salida * TARIFA.salida,
  );
}

export function textoDelGasto(gasto: { llamadas: number; milesimas: number }): string | null {
  if (gasto.llamadas === 0) return null;
  const dolares = (gasto.milesimas / 1000).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `IA: ${dolares} $ en ${gasto.llamadas} ${gasto.llamadas === 1 ? "llamada" : "llamadas"}`;
}
```

- [ ] **Step 4: Correrla y ver que pasa**

Run: `npx vitest run tests/taller-ia-coste.test.ts`
Expected: PASS (6 pruebas).

- [ ] **Step 5: Comprobar una mutación a mano** (cambiar `cacheLeidos: 0.0005` por `0.005`, ver rojo, deshacer).

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add lib/taller/ia/coste.ts tests/taller-ia-coste.test.ts
git commit -F - <<'EOF'
Coste de una llamada a la IA y texto del gasto de un examen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 2: La tabla `LlamadaDeIA` y el registro

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Examen` y final del fichero)
- Create: `prisma/migrations/<fecha>_taller_entrega_2/migration.sql` (generada)
- Create: `lib/taller/ia/registro.ts`
- Test: `tests/base/taller-ia-registro.test.ts`

**Interfaces:**
- Consumes: `Uso`, `costeEnMilesimas` (Task 1)
- Produces: `apuntarLlamada(datos: { examenId: string; prueba: Prueba; numero: number; modelo: string; uso: Uso; milisegundos: number; error: string | null }): Promise<void>`, `gastoDelExamen(examenId: string): Promise<{ llamadas: number; milesimas: number }>`

- [ ] **Step 1: Cambiar el esquema**

En `model Examen`, junto a `paginas PaginaDeExamen[]`:
```prisma
  llamadasDeIA LlamadaDeIA[]
```
Al final de `prisma/schema.prisma`:
```prisma
enum ResultadoDeLlamada {
  OK
  ERROR
}

/// Cada vez que el taller llamó a la API de Anthropic, también si falló: se paga igual.
model LlamadaDeIA {
  id                    String             @id @default(cuid())
  examen                Examen             @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId              String
  prueba                Prueba
  numero                Int
  /// El modelo que respondió de verdad: con el respaldo puede no ser el pedido.
  modelo                String
  tokensEntrada         Int
  tokensCacheLeidos     Int
  tokensCacheEscritos   Int
  tokensSalida          Int
  costeMilesimasDeDolar Int
  milisegundos          Int
  resultado             ResultadoDeLlamada
  error                 String?
  createdAt             DateTime           @default(now())

  @@index([examenId])
}
```

- [ ] **Step 2: Generar la migración contra un Postgres de usar y tirar**

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
D="$(pwd)/.tmp/migrar"
rm -rf "$D" && initdb -D "$D" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$D" -o "-p 55433 -k $D" -l "$D/log" start && sleep 2
psql -h 127.0.0.1 -p 55433 -U postgres -c "create database migrar"
DATABASE_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
DIRECT_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
  npx prisma migrate dev --name taller_entrega_2 --create-only
DATABASE_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
DIRECT_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
  npx prisma migrate deploy
pg_ctl -D "$D" stop -m fast; rm -rf "$D"
npx prisma generate
```
Expected: una carpeta nueva `prisma/migrations/2026…_taller_entrega_2/` con `CREATE TYPE "ResultadoDeLlamada"`, `CREATE TABLE "LlamadaDeIA"`, el índice y la clave foránea con `ON DELETE CASCADE`. Leer el SQL: no debe tocar ninguna otra tabla.

- [ ] **Step 3: Escribir la prueba que falla**

```ts
// tests/base/taller-ia-registro.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { apuntarLlamada, gastoDelExamen } from "@/lib/taller/ia/registro";
import { SIN_USO } from "@/lib/taller/ia/coste";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

async function unExamen() {
  const r = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in r) throw new Error(r.error);
  return r.id;
}

const USO = { entrada: 10_000, cacheLeidos: 20_000, cacheEscritos: 4_000, salida: 3_000 };

describe("el registro de llamadas a la IA", () => {
  // Mutación que la mata: no guardar costeMilesimasDeDolar (poner 0).
  it("apunta una llamada buena con sus tokens y su coste", async () => {
    const examenId = await unExamen();
    await apuntarLlamada({ examenId, prueba: "CE", numero: 3, modelo: "claude-opus-5", uso: USO, milisegundos: 1234, error: null });
    const [fila] = await prisma.llamadaDeIA.findMany();
    expect(fila).toMatchObject({
      prueba: "CE", numero: 3, modelo: "claude-opus-5", resultado: "OK", error: null,
      tokensEntrada: 10_000, tokensCacheLeidos: 20_000, tokensCacheEscritos: 4_000, tokensSalida: 3_000,
      costeMilesimasDeDolar: 160, milisegundos: 1234,
    });
  });

  // Mutación que la mata: poner resultado "OK" siempre.
  it("una llamada con error queda como ERROR con su mensaje", async () => {
    const examenId = await unExamen();
    await apuntarLlamada({ examenId, prueba: "CO", numero: 1, modelo: "claude-opus-5", uso: SIN_USO, milisegundos: 5, error: "La IA no responde ahora." });
    const [fila] = await prisma.llamadaDeIA.findMany();
    expect(fila.resultado).toBe("ERROR");
    expect(fila.error).toBe("La IA no responde ahora.");
  });

  // Mutación que la mata: sumar las llamadas de todos los exámenes (quitar el where).
  it("el gasto suma solo las llamadas de ese examen", async () => {
    const a = await unExamen();
    const b = await unExamen();
    await apuntarLlamada({ examenId: a, prueba: "CE", numero: 1, modelo: "m", uso: USO, milisegundos: 1, error: null });
    await apuntarLlamada({ examenId: a, prueba: "CE", numero: 2, modelo: "m", uso: USO, milisegundos: 1, error: "x" });
    await apuntarLlamada({ examenId: b, prueba: "CE", numero: 1, modelo: "m", uso: USO, milisegundos: 1, error: null });
    expect(await gastoDelExamen(a)).toEqual({ llamadas: 2, milesimas: 320 });
  });

  // Mutación que la mata: devolver milesimas null cuando no hay filas.
  it("sin llamadas el gasto es cero", async () => {
    expect(await gastoDelExamen(await unExamen())).toEqual({ llamadas: 0, milesimas: 0 });
  });

  // Mutación que la mata: onDelete Restrict en LlamadaDeIA.examen.
  it("borrar el examen se lleva sus llamadas", async () => {
    const examenId = await unExamen();
    await apuntarLlamada({ examenId, prueba: "CE", numero: 1, modelo: "m", uso: USO, milisegundos: 1, error: null });
    await prisma.examen.delete({ where: { id: examenId } });
    expect(await prisma.llamadaDeIA.count()).toBe(0);
  });
});
```

- [ ] **Step 4: Correrla y ver que falla**

Run: `npm run test:base -- tests/base/taller-ia-registro.test.ts`
Expected: FAIL, no se encuentra `@/lib/taller/ia/registro`.

- [ ] **Step 5: Implementar**

```ts
// lib/taller/ia/registro.ts
import type { Prueba } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { costeEnMilesimas, type Uso } from "./coste";

export async function apuntarLlamada(datos: {
  examenId: string;
  prueba: Prueba;
  numero: number;
  modelo: string;
  uso: Uso;
  milisegundos: number;
  error: string | null;
}): Promise<void> {
  await prisma.llamadaDeIA.create({
    data: {
      examenId: datos.examenId,
      prueba: datos.prueba,
      numero: datos.numero,
      modelo: datos.modelo,
      tokensEntrada: datos.uso.entrada,
      tokensCacheLeidos: datos.uso.cacheLeidos,
      tokensCacheEscritos: datos.uso.cacheEscritos,
      tokensSalida: datos.uso.salida,
      costeMilesimasDeDolar: costeEnMilesimas(datos.uso),
      milisegundos: Math.round(datos.milisegundos),
      resultado: datos.error === null ? "OK" : "ERROR",
      error: datos.error,
    },
  });
}

export async function gastoDelExamen(examenId: string): Promise<{ llamadas: number; milesimas: number }> {
  const r = await prisma.llamadaDeIA.aggregate({
    where: { examenId },
    _count: { _all: true },
    _sum: { costeMilesimasDeDolar: true },
  });
  return { llamadas: r._count._all, milesimas: r._sum.costeMilesimasDeDolar ?? 0 };
}
```

- [ ] **Step 6: Correrla y ver que pasa**

Run: `npm run test:base -- tests/base/taller-ia-registro.test.ts`
Expected: PASS (5 pruebas). Después `npm run test:base 2>&1 | tail -n 5`: las de base anteriores siguen en verde.

- [ ] **Step 7: Comprobar una mutación a mano** (quitar `where: { examenId }`, ver rojo, deshacer).

- [ ] **Step 8: Commit**

```bash
git branch --show-current
git add prisma/schema.prisma prisma/migrations lib/taller/ia/registro.ts tests/base/taller-ia-registro.test.ts
git commit -F - <<'EOF'
Tabla LlamadaDeIA: cada llamada a la IA con sus tokens y su coste

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 3: Imponer la estructura y las dudas

**Files:**
- Create: `lib/taller/ia/estructura.ts`, `lib/taller/ia/dudas.ts`
- Test: `tests/taller-ia-estructura.test.ts`, `tests/taller-ia-dudas.test.ts`

**Interfaces:**
- Consumes: `Formulario`, `formularioVacio` (`lib/taller/formas.ts`), `Ruta` (`lib/taller/editar.ts`), `reglaDe` (`lib/dele/estructura.ts`)
- Produces:
  - `imponerEstructura(vacio: Formulario, leido: Formulario): { formulario: Formulario } | { error: string }`
  - `type Duda = { clave: string; nota: string }`, `DUDA_DE_LA_CONSIGNA: Duda`, `claveDeRuta(ruta: Ruta): string`, `rutaDeClave(clave: string): Ruta`, `dudasDelFormulario(f: Formulario, leidas: { campo: string; nota: string }[]): Duda[]`, `quitarDudasDe(dudas: Duda[], ruta: Ruta): Duda[]`, `tieneAlgoEscrito(f: Formulario, vacio: Formulario): boolean`

**Reglas de `imponerEstructura`** (la IA ya ha pasado el esquema de su forma, así que los tipos cuadran):
- Claves `forma`, `numero`, `conImagen`, `grupo`: siempre las del formulario vacío.
- Clave `letra`: si en el vacío no está vacía (opciones, destinos, lista común), la del vacío. Si está vacía (la letra del ejemplo), la leída, en mayúscula y una sola letra (`trim().toUpperCase().slice(-1)`).
- Listas: si la clave es `pautas`, se acepta la leída tal cual. Si no, **la cantidad tiene que ser igual** o se rechaza con «La IA leyó N <nombre> y la tarea tiene M.» (y ` (en <ruta>)` si la lista está anidada más allá de `actividad.<lista>`).
- Clave `ejemplo`: si en el vacío es `null` (la tarea no lleva), `null`. Si en el vacío es un objeto y la IA devolvió `null`, se rechaza con «La IA no leyó el ejemplo.».
- Cualquier otro `null` del vacío (rangos, preparación): el valor leído.
- Textos: el leído.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/taller-ia-estructura.test.ts
import { describe, it, expect } from "vitest";
import { reglaDe, type Forma } from "@/lib/dele/estructura";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { imponerEstructura } from "@/lib/taller/ia/estructura";

type P = "CE" | "CO" | "EE" | "EO";
const vacio = (p: P, n: number) => formularioVacio(reglaDe("A2_B1_ESCOLAR", p, n)!);
const copia = <T,>(x: T): T => structuredClone(x);

/** Rellena cada texto vacío con "leído": lo que haría la IA en el caso feliz. */
function lleno(f: Formulario): Formulario {
  const rellenar = (x: unknown): unknown => {
    if (typeof x === "string") return x === "" ? "leído" : x;
    if (Array.isArray(x)) return x.map(rellenar);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "letra" ? v : rellenar(v)]));
    return x;
  };
  return rellenar(f) as Formulario;
}

const TAREAS: [P, number, Forma][] = [
  ["CE", 1, "RELACIONAR"], ["CE", 2, "LISTA_COMUN"], ["CE", 3, "OPCIONES"], ["CE", 4, "HUECOS"],
  ["EE", 1, "REDACCION_UNA"], ["EE", 2, "REDACCION_DOS"], ["EO", 1, "ORAL_SOLO"], ["EO", 2, "ORAL_DIRECTO"],
];

describe("imponer la estructura a lo que lee la IA", () => {
  // Mutación que la mata: devolver el vacío en vez de mezclar (los textos se pierden).
  it.each(TAREAS)("%s %i (%s): el caso feliz conserva los textos y cumple su forma", (p, n) => {
    const v = vacio(p, n);
    const r = imponerEstructura(v, lleno(v));
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("leído");
    expect(fallosDeForma(reglaDe("A2_B1_ESCOLAR", p, n)!, r.formulario)).toEqual([]);
  });

  // Mutación que la mata: quitar "numero" de las claves fijas.
  it("un número del libro cambiado por la IA vuelve al suyo", () => {
    const v = vacio("CE", 3);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[0].numero = 14;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "OPCIONES") throw new Error();
    expect(r.formulario.actividad.preguntas.map((q) => q.numero)).toEqual([13, 14, 15, 16, 17, 18]);
  });

  // Mutación que la mata: tomar la letra leída también cuando el vacío la trae puesta.
  it("una letra de opción cambiada vuelve a la suya", () => {
    const v = vacio("CE", 4);
    const leido = lleno(v);
    if (leido.forma !== "HUECOS") throw new Error();
    leido.actividad.huecos[0].opciones[2].letra = "D";
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "HUECOS") throw new Error();
    expect(r.formulario.actividad.huecos[0].opciones.map((o) => o.letra)).toEqual(["A", "B", "C"]);
  });

  // Mutación que la mata: quitar "conImagen" de las claves fijas.
  it("Auditiva 1: conImagen vuelve al del vacío", () => {
    const v = vacio("CO", 1);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[0].opciones[0].conImagen = false;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "OPCIONES") throw new Error();
    expect(r.formulario.actividad.preguntas[0].opciones[0].conImagen).toBe(true);
  });

  // Mutación que la mata: quitar "grupo" de las claves fijas.
  it("Auditiva 4: el grupo vuelve al del vacío", () => {
    const v = vacio("CO", 4);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[5].grupo = 1;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "OPCIONES") throw new Error();
    expect(r.formulario.actividad.preguntas[5].grupo).toBe(3);
  });

  // Mutación que la mata: recortar o rellenar la lista en vez de rechazar.
  it("una pregunta de menos se rechaza entera", () => {
    const v = vacio("CE", 3);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas.pop();
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA leyó 5 preguntas y la tarea tiene 6." });
  });

  // Mutación que la mata: comparar solo "menos" (leido.length < vacio.length).
  it("un texto suelto de más se rechaza entero", () => {
    const v = vacio("CE", 2);
    const leido = lleno(v);
    leido.textos.push({ etiqueta: "x", texto: "x" });
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA leyó 4 textos sueltos y la tarea tiene 3." });
  });

  // Mutación que la mata: no mirar las listas anidadas (opciones dentro de preguntas).
  it("una opción de menos en una pregunta se rechaza y dice dónde", () => {
    const v = vacio("CE", 3);
    const leido = lleno(v);
    if (leido.forma !== "OPCIONES") throw new Error();
    leido.actividad.preguntas[2].opciones.pop();
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA leyó 2 opciones y la tarea tiene 3 (en actividad.preguntas.2)." });
  });

  // Mutación que la mata: quitar "pautas" de las listas libres.
  it("las pautas de más se aceptan", () => {
    const v = vacio("EE", 1);
    const leido = lleno(v);
    if (leido.forma !== "REDACCION_UNA") throw new Error();
    leido.actividad.pautas = ["uno", "dos", "tres", "cuatro"];
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "REDACCION_UNA") throw new Error();
    expect(r.formulario.actividad.pautas).toEqual(["uno", "dos", "tres", "cuatro"]);
  });

  // Mutación que la mata: imponer siempre la letra del vacío (la del ejemplo quedaría "").
  it("la letra del ejemplo se toma de la IA, en mayúscula y sola", () => {
    const v = vacio("CE", 1);
    const leido = lleno(v);
    if (leido.forma !== "RELACIONAR") throw new Error();
    leido.actividad.ejemplo.letra = " f ";
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "RELACIONAR") throw new Error();
    expect(r.formulario.actividad.ejemplo.letra).toBe("F");
  });

  // Mutación que la mata: tratar el ejemplo null como un null cualquiera (tomar el leído).
  it("si la tarea lleva ejemplo y la IA no lo leyó, se rechaza", () => {
    const v = vacio("CO", 3);
    const leido = lleno(v);
    if (leido.forma !== "LISTA_COMUN") throw new Error();
    leido.actividad.ejemplo = null;
    expect(imponerEstructura(v, leido)).toEqual({ error: "La IA no leyó el ejemplo." });
  });

  // Mutación que la mata: tomar siempre el null del vacío (los rangos quedarían vacíos).
  it("los rangos y la preparación se toman de la IA", () => {
    const v = vacio("EO", 1);
    const leido = lleno(v);
    if (leido.forma !== "ORAL_SOLO") throw new Error();
    leido.actividad.minutos = { min: 2, max: 3 };
    leido.actividad.preparacion = 15;
    const r = imponerEstructura(v, leido);
    if ("error" in r || r.formulario.forma !== "ORAL_SOLO") throw new Error();
    expect(r.formulario.actividad.minutos).toEqual({ min: 2, max: 3 });
    expect(r.formulario.actividad.preparacion).toBe(15);
  });

  // Mutación que la mata: modificar `vacio` en sitio.
  it("no toca los objetos que recibe", () => {
    const v = vacio("CE", 3);
    const antes = copia(v);
    imponerEstructura(v, lleno(v));
    expect(v).toEqual(antes);
  });
});
```

```ts
// tests/taller-ia-dudas.test.ts
import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import {
  DUDA_DE_LA_CONSIGNA, claveDeRuta, dudasDelFormulario, quitarDudasDe, rutaDeClave, tieneAlgoEscrito,
} from "@/lib/taller/ia/dudas";

const ce3 = () => formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);

describe("las dudas de la IA", () => {
  // Mutación que la mata: dejar los índices como texto ("2" en vez de 2).
  it("una clave con índices se convierte en ruta con números", () => {
    expect(rutaDeClave("actividad.preguntas.2.enunciado")).toEqual(["actividad", "preguntas", 2, "enunciado"]);
    expect(claveDeRuta(["actividad", "preguntas", 2, "enunciado"])).toBe("actividad.preguntas.2.enunciado");
  });

  // Mutación que la mata: no filtrar (devolver todas las leídas).
  it("tira las dudas de campos que no existen y conserva las que sí", () => {
    const dudas = dudasDelFormulario(ce3(), [
      { campo: "actividad.preguntas.2.enunciado", nota: "borroso" },
      { campo: "actividad.preguntas.9.enunciado", nota: "no existe" },
      { campo: "actividad.preguntas", nota: "no es un campo" },
    ]);
    expect(dudas.map((d) => d.clave)).toEqual(["consigna", "actividad.preguntas.2.enunciado"]);
  });

  // Mutación que la mata: no añadir la duda fija de la consigna.
  it("la consigna va siempre, una sola vez, con su nota fija", () => {
    const dudas = dudasDelFormulario(ce3(), [{ campo: "consigna", nota: "de la IA" }]);
    expect(dudas).toEqual([DUDA_DE_LA_CONSIGNA]);
  });

  // Mutación que la mata: comparar solo la clave exacta (las pautas se editan como lista entera).
  it("editar un campo quita su duda y las de dentro, y deja las demás", () => {
    const dudas = [
      { clave: "actividad.pautas.1", nota: "a" },
      { clave: "actividad.pautasExtra", nota: "b" },
      { clave: "consigna", nota: "c" },
    ];
    expect(quitarDudasDe(dudas, ["actividad", "pautas"]).map((d) => d.clave)).toEqual(["actividad.pautasExtra", "consigna"]);
  });

  // Mutación que la mata: comparar con JSON.stringify (el orden de las claves daría "algo escrito").
  it("un formulario vacío con las claves en otro orden no tiene nada escrito", () => {
    const v = ce3();
    const reordenado = JSON.parse(JSON.stringify({ textos: v.textos, actividad: v.actividad, consigna: v.consigna, forma: v.forma }));
    expect(tieneAlgoEscrito(reordenado, v)).toBe(false);
  });

  // Mutación que la mata: devolver siempre false.
  it("con un texto puesto sí tiene algo escrito", () => {
    const v = ce3();
    expect(tieneAlgoEscrito({ ...v, consigna: "Lee." }, v)).toBe(true);
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-ia-estructura.test.ts tests/taller-ia-dudas.test.ts`
Expected: FAIL, no se encuentran los módulos.

- [ ] **Step 3: Implementar**

```ts
// lib/taller/ia/estructura.ts
import type { Ruta } from "@/lib/taller/editar";
import type { Formulario } from "@/lib/taller/formas";

/** Las que manda el formulario vacío, diga lo que diga la IA. */
const FIJAS = new Set(["forma", "numero", "conImagen", "grupo"]);
/** Listas cuya cantidad no fija la forma. */
const LIBRES = new Set(["pautas"]);
const NOMBRE_DE_LISTA: Record<string, string> = {
  textos: "textos sueltos",
  elementos: "elementos",
  destinos: "textos con letra",
  comunes: "opciones de la lista común",
  preguntas: "preguntas",
  opciones: "opciones",
  huecos: "huecos",
};

class Descuadre extends Error {}

function donde(ruta: Ruta): string {
  // actividad.preguntas es el primer nivel: no hace falta decir dónde.
  return ruta.length > 2 ? ` (en ${ruta.slice(0, -1).join(".")})` : "";
}

function mezclar(vacio: unknown, leido: unknown, ruta: Ruta): unknown {
  const clave = String(ruta[ruta.length - 1] ?? "");
  if (Array.isArray(vacio)) {
    const lista = Array.isArray(leido) ? leido : [];
    if (LIBRES.has(clave)) return lista;
    if (lista.length !== vacio.length) {
      throw new Descuadre(`La IA leyó ${lista.length} ${NOMBRE_DE_LISTA[clave] ?? clave} y la tarea tiene ${vacio.length}${donde(ruta)}.`);
    }
    return vacio.map((v, i) => mezclar(v, lista[i], [...ruta, i]));
  }
  if (vacio === null) return clave === "ejemplo" ? null : leido;
  if (typeof vacio === "object") {
    if (leido === null || typeof leido !== "object") {
      if (clave === "ejemplo") throw new Descuadre("La IA no leyó el ejemplo.");
      throw new Descuadre(`La IA no leyó ${ruta.join(".")}.`);
    }
    const de = vacio as Record<string, unknown>;
    const la = leido as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(de).map((k) => {
        if (FIJAS.has(k)) return [k, de[k]];
        if (k === "letra") return [k, de[k] !== "" ? de[k] : String(la[k] ?? "").trim().toUpperCase().slice(-1)];
        return [k, mezclar(de[k], la[k], [...ruta, k])];
      }),
    );
  }
  return leido;
}

/**
 * Pone los textos que leyó la IA sobre la forma del formulario vacío. Números,
 * letras, grupos e imágenes mandan los del vacío; una lista con otra cantidad se
 * rechaza entera, porque recolocarla a ojo es el error que no se ve.
 */
export function imponerEstructura(vacio: Formulario, leido: Formulario): { formulario: Formulario } | { error: string } {
  try {
    return { formulario: mezclar(vacio, leido, []) as Formulario };
  } catch (e) {
    if (e instanceof Descuadre) return { error: e.message };
    throw e;
  }
}
```

```ts
// lib/taller/ia/dudas.ts
import type { Ruta } from "@/lib/taller/editar";
import type { Formulario } from "@/lib/taller/formas";

export type Duda = { clave: string; nota: string };

export const DUDA_DE_LA_CONSIGNA: Duda = { clave: "consigna", nota: "Consigna retocada: compárala con la hoja." };

export function claveDeRuta(ruta: Ruta): string {
  return ruta.join(".");
}

export function rutaDeClave(clave: string): Ruta {
  return clave.split(".").map((paso) => (/^\d+$/.test(paso) ? Number(paso) : paso));
}

/** Si la ruta llega a un valor suelto (texto, número o null), no a una lista ni a un objeto. */
function esCampo(f: unknown, ruta: Ruta): boolean {
  let aqui: unknown = f;
  for (const paso of ruta) {
    if (aqui === null || typeof aqui !== "object") return false;
    if (Array.isArray(aqui) !== (typeof paso === "number")) return false;
    if (!(paso in (aqui as object))) return false;
    aqui = (aqui as Record<string | number, unknown>)[paso];
  }
  return aqui === null || typeof aqui !== "object";
}

export function dudasDelFormulario(f: Formulario, leidas: { campo: string; nota: string }[]): Duda[] {
  const validas = leidas
    .filter((d) => d.campo !== DUDA_DE_LA_CONSIGNA.clave && esCampo(f, rutaDeClave(d.campo)))
    .map((d) => ({ clave: d.campo, nota: d.nota }));
  return [DUDA_DE_LA_CONSIGNA, ...validas];
}

/** Al editar un campo (o una lista entera, como las pautas) se van sus dudas. */
export function quitarDudasDe(dudas: Duda[], ruta: Ruta): Duda[] {
  const clave = claveDeRuta(ruta);
  return dudas.filter((d) => d.clave !== clave && !d.clave.startsWith(`${clave}.`));
}

function iguales(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => iguales(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => iguales((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
}

export function tieneAlgoEscrito(f: Formulario, vacio: Formulario): boolean {
  return !iguales(f, vacio);
}
```

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npx vitest run tests/taller-ia-estructura.test.ts tests/taller-ia-dudas.test.ts`
Expected: PASS.

- [ ] **Step 5: Comprobar dos mutaciones a mano** (quitar `"numero"` de `FIJAS`; quitar `"pautas"` de `LIBRES`), ver rojo, deshacer.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add lib/taller/ia/estructura.ts lib/taller/ia/dudas.ts tests/taller-ia-estructura.test.ts tests/taller-ia-dudas.test.ts
git commit -F - <<'EOF'
Imponer la forma del formulario vacío a lo que lee la IA, y sus dudas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 4: El encargo de una tarea

**Files:**
- Modify: `lib/taller/formas.ts` (tras `formularioBase`)
- Create: `lib/taller/ia/encargo.ts`
- Test: `tests/taller-ia-encargo.test.ts`

**Interfaces:**
- Consumes: `formularioVacio`, `Forma`, `ReglaTarea`, `NOMBRE_DE_PRUEBA`, `NOMBRE_DE_NIVEL`, `letrasHasta`
- Produces:
  - En `formas.ts`: `ESQUEMA_DE_FORMA: { [F in Forma]: z.ZodType<FormularioDe<F>> }`
  - `type TipoDeHoja = "image/jpeg" | "image/png" | "image/webp" | "image/gif"`, `type Hoja = { datos: string; tipo: TipoDeHoja }`
  - `INSTRUCCIONES: string`, `descripcionDeLaForma(regla: ReglaTarea): string`, `esquemaDeRespuesta(forma: Forma)` (Zod `{ formulario, dudas: { campo, nota }[] }`)
  - `type Encargo = { system: string; hojas: Hoja[]; texto: string; forma: Forma }`, `encargoDeTarea(nivel: Nivel, prueba: Prueba, regla: ReglaTarea, hojas: Hoja[]): Encargo`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-ia-encargo.test.ts
import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { descripcionDeLaForma, encargoDeTarea, esquemaDeRespuesta, type Hoja } from "@/lib/taller/ia/encargo";

const HOJA_A: Hoja = { datos: "AAAA", tipo: "image/jpeg" };
const HOJA_B: Hoja = { datos: "BBBB", tipo: "image/png" };
const regla = (p: "CE" | "CO" | "EE" | "EO", n: number) => reglaDe("A2_B1_ESCOLAR", p, n)!;

describe("el encargo que se manda a la IA", () => {
  // Si el bloque fijo cambia entre tareas, la caché de la API no acierta nunca.
  // Mutación que la mata: meter el nombre de la tarea en las instrucciones fijas.
  it("las instrucciones fijas son idénticas byte a byte entre dos tareas distintas", () => {
    const a = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 1), [HOJA_A]);
    const b = encargoDeTarea("A2_B1_ESCOLAR", "EO", regla("EO", 2), [HOJA_B]);
    expect(a.system).toBe(b.system);
  });

  // Mutación que la mata: no incluir el formulario vacío en el texto.
  it("el texto lleva qué tarea es y su formulario vacío en JSON", () => {
    const e = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 3), [HOJA_A]);
    expect(e.texto).toContain("comprensión de lectura, tarea 3, A2/B1 escolar");
    expect(e.texto).toContain(JSON.stringify(formularioVacio(regla("CE", 3)), null, 2));
    expect(e.forma).toBe("OPCIONES");
  });

  // Mutación que la mata: ordenar las hojas o quedarse solo con la primera.
  it("las hojas van en el orden en que llegan", () => {
    expect(encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 3), [HOJA_B, HOJA_A]).hojas).toEqual([HOJA_B, HOJA_A]);
  });

  // Mutación que la mata: quitar la regla de no poner respuestas de las instrucciones.
  it("las instrucciones prohíben poner respuestas y explican las dudas", () => {
    const { system } = encargoDeTarea("A2_B1_ESCOLAR", "CE", regla("CE", 3), []);
    expect(system).toContain("No marques ni deduzcas respuestas correctas");
    expect(system).toContain("actividad.preguntas.2.enunciado");
  });

  // Mutación que la mata: devolver la misma descripción para todas las formas.
  it("cada forma se describe con sus números", () => {
    expect(descripcionDeLaForma(regla("CE", 1))).toBe("un ejemplo, 6 elementos (del 1 al 6) con su texto y 10 textos con letra (A-J), de los que sobran 4");
    expect(descripcionDeLaForma(regla("CO", 2))).toBe("un ejemplo, 6 elementos (del 8 al 13) sin texto, que son «Mensaje 1» a «Mensaje 6», y 10 textos con letra (A-J), que son los enunciados, de los que sobran 4");
    expect(descripcionDeLaForma(regla("CE", 2))).toBe("3 textos sueltos, uno por persona con su nombre en «etiqueta»; una lista común de 3 opciones (A-C); 6 preguntas (del 7 al 12)");
    expect(descripcionDeLaForma(regla("CO", 3))).toBe("una lista común de 3 opciones (A-C); un ejemplo; 6 preguntas (del 14 al 19)");
    expect(descripcionDeLaForma(regla("CE", 3))).toBe("un texto largo; 6 preguntas (del 13 al 18) con 3 opciones cada una (A-C)");
    expect(descripcionDeLaForma(regla("CO", 1))).toBe("un ejemplo; 7 preguntas (del 1 al 7) con 3 opciones cada una (A-C); las opciones del ejemplo y de las 4 primeras preguntas son dibujos");
    expect(descripcionDeLaForma(regla("CO", 4))).toBe("6 preguntas (del 20 al 25) con 3 opciones cada una (A-C); en 3 grupos de 2 preguntas");
    expect(descripcionDeLaForma(regla("CE", 4))).toBe("un texto con 7 huecos (del 19 al 25), cada uno con 3 opciones (A-C)");
    expect(descripcionDeLaForma(regla("EE", 1))).toBe("una situación, el texto recibido si lo hay, las pautas y el número de palabras");
    expect(descripcionDeLaForma(regla("EE", 2))).toBe("dos opciones, cada una con título, contexto y pautas, y el número de palabras");
    expect(descripcionDeLaForma(regla("EO", 1))).toBe("dos opciones, cada una con su tema y sus pautas, y cada una lleva una foto; los minutos y la preparación");
    expect(descripcionDeLaForma(regla("EO", 3))).toBe("dos opciones, cada una con su tema y sus pautas; los minutos y la preparación");
    expect(descripcionDeLaForma(regla("EO", 2))).toBe("dos opciones de conversación con el examinador, cada una con tema, situación, papel del examinador y pautas; los minutos");
  });

  // Mutación que la mata: usar la unión entera en vez del esquema de la forma.
  it("el esquema de respuesta es el de la forma y rechaza otra forma", () => {
    const esquema = esquemaDeRespuesta("HUECOS");
    const huecos = formularioVacio(regla("CE", 4));
    const otra = formularioVacio(regla("CE", 3));
    expect(esquema.safeParse({ formulario: huecos, dudas: [] }).success).toBe(true);
    expect(esquema.safeParse({ formulario: otra, dudas: [] }).success).toBe(false);
  });

  // Mutación que la mata: z.object en vez de z.strictObject en las dudas.
  it("una duda con un campo de más rebota", () => {
    const esquema = esquemaDeRespuesta("HUECOS");
    const huecos = formularioVacio(regla("CE", 4));
    expect(esquema.safeParse({ formulario: huecos, dudas: [{ campo: "consigna", nota: "x", seguro: false }] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/taller-ia-encargo.test.ts`
Expected: FAIL, no se encuentra `@/lib/taller/ia/encargo`.

- [ ] **Step 3: Exportar el esquema de cada forma en `lib/taller/formas.ts`**

Justo después de `export type FormularioDe<F extends Forma> = …`:
```ts
/** El esquema de UNA forma, para pedirle a la IA exactamente esa y no la unión entera. */
export const ESQUEMA_DE_FORMA = {
  RELACIONAR: relacionar,
  LISTA_COMUN: listaComun,
  OPCIONES: opciones,
  HUECOS: huecos,
  REDACCION_UNA: redaccionUna,
  REDACCION_DOS: redaccionDos,
  ORAL_SOLO: oralSolo,
  ORAL_DIRECTO: oralDirecto,
} as const satisfies Record<Forma, z.ZodType>;
```

- [ ] **Step 4: Implementar el encargo**

```ts
// lib/taller/ia/encargo.ts
import { z } from "zod";
import type { Nivel, Prueba } from "@/lib/generated/prisma";
import { NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, letrasHasta, type Forma, type ReglaTarea } from "@/lib/dele/estructura";
import { ESQUEMA_DE_FORMA, formularioVacio } from "@/lib/taller/formas";

export type TipoDeHoja = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export type Hoja = { datos: string; tipo: TipoDeHoja };
export type Encargo = { system: string; hojas: Hoja[]; texto: string; forma: Forma };

/**
 * Igual en todas las llamadas, letra a letra: es el bloque que la API
 * reaprovecha de una tarea a la siguiente. Nada que dependa de la tarea va aquí.
 */
export const INSTRUCCIONES = `Transcribes tareas de exámenes del DELE A2/B1 para escolares a partir de las fotos de sus hojas. Lo que devuelvas lo verá un estudiante tal cual, en una web.

Recibirás las hojas de UNA tarea y su formulario vacío en JSON. Devuelve ese mismo formulario con los textos rellenados.

- Copia los textos literalmente, con sus tildes, su puntuación y sus párrafos. No resumas, no corrijas, no traduzcas.
- No cambies números, letras, grupos ni el campo conImagen: vienen puestos y mandan.
- No marques ni deduzcas respuestas correctas: no hay ningún campo para ellas. La letra del ejemplo resuelto sí se copia si la hoja la muestra.
- La consigna va corregida para la web: quita lo que solo existe en papel, como la «Hoja de respuestas» o marcar con lápiz. El resto de la consigna, literal.
- Si una opción es un dibujo o una foto (conImagen: true), deja su texto vacío y no la describas.
- Las letras, en mayúscula, sin paréntesis ni punto.
- En los huecos, el texto va con cada hueco marcado con su número entre corchetes, así: [19]. Cada marca, una sola vez.
- En la expresión oral, copia las opciones en el orden en que aparecen en las hojas.
- Rangos (palabras, minutos) y minutos de preparación: los números que diga la hoja; si no los dice, null.
- Un texto que no está en las hojas se deja vacío y se apunta en dudas.

Dudas: por cada campo que no hayas podido leer con seguridad, añade a dudas un objeto con campo y nota. campo es la ruta del campo en el formulario, con puntos e índices desde cero, por ejemplo actividad.preguntas.2.enunciado. nota dice en pocas palabras qué no se lee o qué has supuesto.`;

function del(regla: ReglaTarea): string {
  const primero = regla.primero ?? 0;
  const items = regla.items ?? 0;
  return `del ${primero} al ${primero + items - 1}`;
}

function rangoDeLetras(n: number): string {
  const abc = letrasHasta(n);
  return `${abc[0]}-${abc[abc.length - 1]}`;
}

export function descripcionDeLaForma(regla: ReglaTarea): string {
  const items = regla.items ?? 0;
  switch (regla.forma) {
    case "RELACIONAR": {
      const elementos = regla.elementosConTexto
        ? `${items} elementos (${del(regla)}) con su texto`
        : `${items} elementos (${del(regla)}) sin texto, que son «Mensaje 1» a «Mensaje ${items}»`;
      const destinos = `${regla.letras} textos con letra (${rangoDeLetras(regla.letras)})${regla.elementosConTexto ? "" : ", que son los enunciados"}`;
      // Sin texto, los elementos acaban en «Mensaje 6»: la coma antes de «y» separa las dos listas.
      const y = regla.elementosConTexto ? " y " : ", y ";
      return `un ejemplo, ${elementos}${y}${destinos}, de los que sobran ${regla.letras - items}`;
    }
    case "LISTA_COMUN": {
      const partes = [];
      if (regla.textos > 0) partes.push(`${regla.textos} textos sueltos, uno por persona con su nombre en «etiqueta»`);
      partes.push(`una lista común de ${regla.letras} opciones (${rangoDeLetras(regla.letras)})`);
      if (regla.ejemplo) partes.push("un ejemplo");
      partes.push(`${items} preguntas (${del(regla)})`);
      return partes.join("; ");
    }
    case "OPCIONES": {
      const partes = [];
      if (regla.textos > 0) partes.push("un texto largo");
      if (regla.ejemplo) partes.push("un ejemplo");
      partes.push(`${items} preguntas (${del(regla)}) con ${regla.letras} opciones cada una (${rangoDeLetras(regla.letras)})`);
      if (regla.itemsConImagen) partes.push(`las opciones ${regla.ejemplo ? "del ejemplo y " : ""}de las ${regla.itemsConImagen} primeras preguntas son dibujos`);
      if (regla.grupos) partes.push(`en ${regla.grupos} grupos de ${items / regla.grupos} preguntas`);
      return partes.join("; ");
    }
    case "HUECOS":
      return `un texto con ${items} huecos (${del(regla)}), cada uno con ${regla.letras} opciones (${rangoDeLetras(regla.letras)})`;
    case "REDACCION_UNA":
      return "una situación, el texto recibido si lo hay, las pautas y el número de palabras";
    case "REDACCION_DOS":
      return "dos opciones, cada una con título, contexto y pautas, y el número de palabras";
    case "ORAL_SOLO":
      return `dos opciones, cada una con su tema y sus pautas${regla.opcionesConImagen ? ", y cada una lleva una foto" : ""}; los minutos y la preparación`;
    case "ORAL_DIRECTO":
      return "dos opciones de conversación con el examinador, cada una con tema, situación, papel del examinador y pautas; los minutos";
  }
}

export function esquemaDeRespuesta(forma: Forma) {
  return z.strictObject({
    formulario: ESQUEMA_DE_FORMA[forma],
    dudas: z.array(z.strictObject({ campo: z.string(), nota: z.string() })),
  });
}

export function encargoDeTarea(nivel: Nivel, prueba: Prueba, regla: ReglaTarea, hojas: Hoja[]): Encargo {
  const texto = [
    `Tarea: ${NOMBRE_DE_PRUEBA[prueba]}, tarea ${regla.numero}, ${NOMBRE_DE_NIVEL[nivel]}.`,
    `Qué tiene: ${descripcionDeLaForma(regla)}.`,
    "Formulario vacío:",
    JSON.stringify(formularioVacio(regla), null, 2),
  ].join("\n");
  return { system: INSTRUCCIONES, hojas, texto, forma: regla.forma };
}
```

- [ ] **Step 5: Correrla y ver que pasa**

Run: `npx vitest run tests/taller-ia-encargo.test.ts tests/taller-formas.test.ts`
Expected: PASS. Si una frase de `descripcionDeLaForma` no coincide con la prueba, **manda la prueba**; se arregla el código, no la prueba.

- [ ] **Step 6: Comprobar una mutación a mano** (añadir `${regla.numero}` a `INSTRUCCIONES` convirtiéndola en función, ver rojo la de «idénticas byte a byte», deshacer).

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add lib/taller/formas.ts lib/taller/ia/encargo.ts tests/taller-ia-encargo.test.ts
git commit -F - <<'EOF'
Encargo de una tarea para la IA: instrucciones fijas, forma y formulario vacío

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 5: La red: descargar hojas, llamar a Claude y traducir errores

**Files:**
- Modify: `package.json` (dependencia)
- Create: `lib/taller/ia/hojas.ts`, `lib/taller/ia/llamar.ts`, `lib/taller/ia/errores.ts`
- Test: `tests/taller-ia-hojas.test.ts`, `tests/taller-ia-errores.test.ts`

**Interfaces:**
- Consumes: `Hoja`, `TipoDeHoja`, `Encargo`, `esquemaDeRespuesta` (Task 4); `Uso` (Task 1); `enlaceDeLectura(ruta, ahora)` (`lib/ficheros/vercel.ts`)
- Produces:
  - `descargarHoja(ruta: string, tipoMime: string, llamar?: typeof fetch): Promise<Hoja>`
  - `MODELO = "claude-opus-5"`, `hayClaveDeIA(): boolean`, `type RespuestaDeLaIA = { salida: unknown; stopReason: string | null; modelo: string; uso: Uso }`, `type LeerHojas = (encargo: Encargo) => Promise<RespuestaDeLaIA>`, `leerConClaude: LeerHojas`
  - `mensajeDeError(e: unknown): string`

- [ ] **Step 1: Instalar el SDK fijado**

```bash
npm install --save-exact @anthropic-ai/sdk@0.125.0
grep -n '"@anthropic-ai/sdk"' package.json   # "0.125.0", sin ^
```

- [ ] **Step 2: Escribir las pruebas que fallan**

```ts
// tests/taller-ia-hojas.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/ficheros/vercel", () => ({ enlaceDeLectura: vi.fn(async () => "https://almacen.invalid/firmado") }));

import { descargarHoja } from "@/lib/taller/ia/hojas";

describe("descargar una hoja del almacén", () => {
  // Mutación que la mata: devolver los bytes sin pasar a base64.
  it("devuelve los bytes en base64 con su tipo", async () => {
    const llamar = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    expect(await descargarHoja("material/h.jpg", "image/jpeg", llamar as unknown as typeof fetch)).toEqual({ datos: "AQID", tipo: "image/jpeg" });
    expect(llamar).toHaveBeenCalledWith("https://almacen.invalid/firmado");
  });

  // Mutación que la mata: no mirar r.ok.
  it("si el almacén no la da, lanza", async () => {
    const llamar = vi.fn(async () => new Response("no", { status: 404 }));
    await expect(descargarHoja("material/h.jpg", "image/jpeg", llamar as unknown as typeof fetch)).rejects.toThrow();
  });

  // Mutación que la mata: aceptar cualquier tipo.
  it("un tipo que la API no admite lanza sin descargar", async () => {
    const llamar = vi.fn();
    await expect(descargarHoja("material/h.pdf", "application/pdf", llamar as unknown as typeof fetch)).rejects.toThrow();
    expect(llamar).not.toHaveBeenCalled();
  });
});
```

```ts
// tests/taller-ia-errores.test.ts
import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { mensajeDeError } from "@/lib/taller/ia/errores";

const cabeceras = new Headers();

describe("traducir los errores de la IA", () => {
  // Mutación que la mata: tratar el 401 como «no responde».
  it("una clave mala lo dice", () => {
    expect(mensajeDeError(new Anthropic.AuthenticationError(401, undefined, "x", cabeceras))).toBe("La clave de la IA no es válida. Revísala en Vercel.");
  });

  // Mutación que la mata: quitar RateLimitError de los «no responde».
  it("demasiadas llamadas, un fallo de Anthropic o sin conexión: prueba en un minuto", () => {
    const NO_RESPONDE = "La IA no responde ahora. Prueba en un minuto.";
    expect(mensajeDeError(new Anthropic.RateLimitError(429, undefined, "x", cabeceras))).toBe(NO_RESPONDE);
    expect(mensajeDeError(new Anthropic.InternalServerError(500, undefined, "x", cabeceras))).toBe(NO_RESPONDE);
    expect(mensajeDeError(new Anthropic.APIConnectionError({ message: "x" }))).toBe(NO_RESPONDE);
  });

  // Mutación que la mata: mensaje genérico para cualquier APIError.
  it("otro rechazo de la API dice su código", () => {
    expect(mensajeDeError(new Anthropic.BadRequestError(400, undefined, "x", cabeceras))).toBe("La IA rechazó la petición (400).");
  });

  // Mutación que la mata: relanzar lo que no es del SDK.
  it("lo que no es del SDK es una respuesta que no se entiende", () => {
    expect(mensajeDeError(new SyntaxError("Unexpected end of JSON"))).toBe("La IA devolvió algo que no es esta tarea.");
  });
});
```

- [ ] **Step 3: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-ia-hojas.test.ts tests/taller-ia-errores.test.ts`
Expected: FAIL, no se encuentran los módulos.

- [ ] **Step 4: Implementar**

```ts
// lib/taller/ia/hojas.ts
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
```

```ts
// lib/taller/ia/errores.ts
import Anthropic from "@anthropic-ai/sdk";

export function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "La clave de la IA no es válida. Revísala en Vercel.";
  if (
    e instanceof Anthropic.RateLimitError ||
    e instanceof Anthropic.InternalServerError ||
    e instanceof Anthropic.APIConnectionError
  ) {
    return "La IA no responde ahora. Prueba en un minuto.";
  }
  if (e instanceof Anthropic.APIError) return `La IA rechazó la petición (${e.status}).`;
  return "La IA devolvió algo que no es esta tarea.";
}
```

```ts
// lib/taller/ia/llamar.ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Uso } from "./coste";
import { esquemaDeRespuesta, type Encargo } from "./encargo";

export const MODELO = "claude-opus-5";

export type RespuestaDeLaIA = { salida: unknown; stopReason: string | null; modelo: string; uso: Uso };
export type LeerHojas = (encargo: Encargo) => Promise<RespuestaDeLaIA>;

export function hayClaveDeIA(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Una tarea, una llamada. Razonamiento adaptativo encendido y salida con
 * esquema obligatorio: Opus 5 con el razonamiento apagado a veces escribe la
 * llamada en el texto en vez de devolverla. En flujo, para que no la corte un
 * tiempo de espera; `finalMessage()` junta el mensaje entero. El respaldo del
 * servidor termina la llamada con otro modelo si Opus 5 la rechaza.
 */
export const leerConClaude: LeerHojas = async (encargo) => {
  const cliente = new Anthropic();
  const flujo = cliente.beta.messages.stream({
    model: MODELO,
    max_tokens: 32_000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(esquemaDeRespuesta(encargo.forma)) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: encargo.system, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...encargo.hojas.map((h) => ({ type: "image" as const, source: { type: "base64" as const, media_type: h.tipo, data: h.datos } })),
          { type: "text" as const, text: encargo.texto },
        ],
      },
    ],
  });
  const mensaje = await flujo.finalMessage();
  return {
    salida: mensaje.parsed_output ?? null,
    stopReason: mensaje.stop_reason,
    modelo: mensaje.model,
    uso: {
      entrada: mensaje.usage.input_tokens,
      cacheLeidos: mensaje.usage.cache_read_input_tokens ?? 0,
      cacheEscritos: mensaje.usage.cache_creation_input_tokens ?? 0,
      salida: mensaje.usage.output_tokens,
    },
  };
};
```

- [ ] **Step 5: Correr las pruebas y los tipos**

Run: `npx vitest run tests/taller-ia-hojas.test.ts tests/taller-ia-errores.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` limpio. `leerConClaude` no tiene prueba sin red a propósito: se prueba en la aceptación. **Si `tsc` protesta** por un nombre del SDK (un constructor de error con otra firma, `parsed_output` con otro nombre, `fallbacks` fuera de los parámetros de `stream`), buscar el nombre correcto en `node_modules/@anthropic-ai/sdk/` con `grep -rn` en los `.d.ts` y arreglar el código o la construcción del error en la prueba. **No** cambiar a herramienta forzada, **no** apagar el razonamiento y **no** quitar `fallbacks`.

- [ ] **Step 6: Comprobar una mutación a mano** (en `errores.ts`, quitar `Anthropic.RateLimitError`, ver rojo, deshacer).

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add package.json package-lock.json lib/taller/ia/hojas.ts lib/taller/ia/llamar.ts lib/taller/ia/errores.ts tests/taller-ia-hojas.test.ts tests/taller-ia-errores.test.ts
git commit -F - <<'EOF'
La red de la IA: hojas del almacén, llamada a Claude Opus 5 y sus errores

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 6: Interpretar la respuesta y el orquestador

**Files:**
- Create: `lib/taller/ia/rellenar.ts`
- Test: `tests/taller-ia-interpretar.test.ts`, `tests/base/taller-ia-rellenar.test.ts`

**Interfaces:**
- Consumes: todo lo de las Tasks 1-5; `reglaDe`, `etiquetaDeTarea`; `fallosDeForma`, `formularioVacio`; `prisma`
- Produces:
  - `type ResultadoDeRelleno = { formulario: Formulario; dudas: Duda[] } | { error: string }`
  - `interpretar(regla: ReglaTarea, respuesta: RespuestaDeLaIA): ResultadoDeRelleno`
  - `type Dependencias = { leer: LeerHojas; descargar: (ruta: string, tipoMime: string) => Promise<Hoja>; hayClave: () => boolean; reloj: () => number }`
  - `rellenarTarea(examenId: string, prueba: Prueba, numero: number, deps?: Dependencias): Promise<ResultadoDeRelleno>`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/taller-ia-interpretar.test.ts
import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { interpretar } from "@/lib/taller/ia/rellenar";
import { SIN_USO } from "@/lib/taller/ia/coste";

const ce3 = reglaDe("A2_B1_ESCOLAR", "CE", 3)!;
const respuesta = (salida: unknown, stopReason: string | null = "end_turn") => ({ salida, stopReason, modelo: "claude-opus-5", uso: SIN_USO });
const bueno = () => {
  const f = formularioVacio(ce3);
  return { ...f, consigna: "Lee el texto." };
};

describe("interpretar lo que devuelve la IA", () => {
  // Mutación que la mata: no mirar stop_reason (la salida cortada validaría igual).
  it("cortada por largo es error aunque la salida valga", () => {
    expect(interpretar(ce3, respuesta({ formulario: bueno(), dudas: [] }, "max_tokens"))).toEqual({ error: "La IA se quedó sin espacio y la respuesta está a medias." });
  });

  // Mutación que la mata: quitar la rama de refusal.
  it("rechazada es error", () => {
    expect(interpretar(ce3, respuesta(null, "refusal"))).toEqual({ error: "La IA no quiso leer estas hojas." });
  });

  // Mutación que la mata: no validar con el esquema (aceptar cualquier objeto).
  it("una salida de otra forma es error", () => {
    const otra = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 4)!);
    expect(interpretar(ce3, respuesta({ formulario: otra, dudas: [] }))).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
  });

  // Mutación que la mata: no llamar a imponerEstructura.
  it("una pregunta de menos es error", () => {
    const f = bueno();
    if (f.forma !== "OPCIONES") throw new Error();
    f.actividad.preguntas.pop();
    expect(interpretar(ce3, respuesta({ formulario: f, dudas: [] }))).toEqual({ error: "La IA leyó 5 preguntas y la tarea tiene 6." });
  });

  // Mutación que la mata: devolver las dudas crudas sin filtrar.
  it("el caso bueno devuelve el formulario y las dudas filtradas con la de la consigna", () => {
    const r = interpretar(ce3, respuesta({ formulario: bueno(), dudas: [{ campo: "actividad.preguntas.0.enunciado", nota: "borroso" }, { campo: "nada", nota: "x" }] }));
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("Lee el texto.");
    expect(r.dudas.map((d) => d.clave)).toEqual(["consigna", "actividad.preguntas.0.enunciado"]);
  });
});
```

```ts
// tests/base/taller-ia-rellenar.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { crearExamen, guardarTarea } from "@/lib/taller/examenes";
import { rellenarTarea, type Dependencias } from "@/lib/taller/ia/rellenar";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

const ce3 = reglaDe("A2_B1_ESCOLAR", "CE", 3)!;
const USO = { entrada: 1000, cacheLeidos: 0, cacheEscritos: 0, salida: 100 };

async function examenConHoja(etiquetas: string[]) {
  const creado = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  const fichero = await prisma.fichero.create({ data: { almacen: "VERCEL", ruta: "material/hoja-1.jpg", tipoMime: "image/jpeg", bytes: 10 } });
  await prisma.paginaDeExamen.create({ data: { examenId: creado.id, ficheroId: fichero.id, orden: 1, etiquetas } });
  return creado.id;
}

function dobles(salida: unknown, extra: Partial<Dependencias> = {}): Dependencias {
  return {
    leer: vi.fn(async () => ({ salida, stopReason: "end_turn", modelo: "claude-opus-5", uso: USO })),
    descargar: vi.fn(async () => ({ datos: "AAAA", tipo: "image/jpeg" as const })),
    hayClave: () => true,
    reloj: () => 0,
    ...extra,
  };
}

const leido = () => ({ formulario: { ...formularioVacio(ce3), consigna: "Lee el texto." }, dudas: [] });

/** Todo lo que guarda una tarea, para comparar antes y después. */
async function fotoDeLaTarea() {
  return {
    tareas: await prisma.tarea.findMany({ orderBy: { id: "asc" } }),
    piezas: await prisma.pieza.findMany({ orderBy: { id: "asc" } }),
    actividades: await prisma.actividad.findMany({ orderBy: { id: "asc" } }),
    claves: await prisma.clave.findMany({ orderBy: { id: "asc" } }),
  };
}

describe("rellenar una tarea con IA", () => {
  // Mutación que la mata: no pasar las hojas a leer (encargo con hojas []).
  it("lee las hojas de la tarea y devuelve el formulario", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido());
    const r = await rellenarTarea(examenId, "CE", 3, d);
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.consigna).toBe("Lee el texto.");
    expect(d.descargar).toHaveBeenCalledWith("material/hoja-1.jpg", "image/jpeg");
    expect(vi.mocked(d.leer).mock.calls[0][0].hojas).toEqual([{ datos: "AAAA", tipo: "image/jpeg" }]);
  });

  // LA garantía de la entrega: nada entra sin que el profesor lo vea.
  // Mutación que la mata: llamar a guardarTarea dentro de rellenarTarea.
  it("no cambia ninguna fila de Tarea, Pieza, Actividad ni Clave", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const guardado = await guardarTarea(examenId, "CE", 3, { ...formularioVacio(ce3), consigna: "Lo que había." });
    if ("error" in guardado) throw new Error(guardado.error);
    const antes = await fotoDeLaTarea();
    const r = await rellenarTarea(examenId, "CE", 3, dobles(leido()));
    expect("error" in r).toBe(false);
    expect(await fotoDeLaTarea()).toEqual(antes);
  });

  // Mutación que la mata: apuntar la llamada solo cuando sale bien.
  it("una respuesta que no vale devuelve error y apunta la llamada como ERROR", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const r = await rellenarTarea(examenId, "CE", 3, dobles({ formulario: { forma: "HUECOS" }, dudas: [] }));
    expect(r).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
    const filas = await prisma.llamadaDeIA.findMany();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ resultado: "ERROR", tokensEntrada: 1000, examenId, prueba: "CE", numero: 3 });
  });

  // Mutación que la mata: no apuntar cuando leer lanza.
  it("si la llamada revienta, apunta la llamada con el mensaje traducido", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const r = await rellenarTarea(examenId, "CE", 3, dobles(null, { leer: vi.fn(async () => { throw new SyntaxError("x"); }) }));
    expect(r).toEqual({ error: "La IA devolvió algo que no es esta tarea." });
    expect(await prisma.llamadaDeIA.count()).toBe(1);
  });

  // Mutación que la mata: quitar la comprobación de hojas.
  it("sin hojas etiquetadas no llama a la IA ni apunta nada", async () => {
    const examenId = await examenConHoja(["CE-4"]);
    const d = dobles(leido());
    expect(await rellenarTarea(examenId, "CE", 3, d)).toEqual({ error: "Etiqueta primero las hojas de esta tarea." });
    expect(d.leer).not.toHaveBeenCalled();
    expect(await prisma.llamadaDeIA.count()).toBe(0);
  });

  // Mutación que la mata: quitar la comprobación de la clave.
  it("sin clave no llama a la IA", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido(), { hayClave: () => false });
    expect(await rellenarTarea(examenId, "CE", 3, d)).toEqual({ error: "Falta la clave de la IA." });
    expect(d.leer).not.toHaveBeenCalled();
  });

  // Mutación que la mata: seguir con las hojas que sí se descargaron.
  it("una hoja que no se descarga para todo, sin llamar ni apuntar", async () => {
    const examenId = await examenConHoja(["CE-3"]);
    const d = dobles(leido(), { descargar: vi.fn(async () => { throw new Error("404"); }) });
    expect(await rellenarTarea(examenId, "CE", 3, d)).toEqual({ error: "No se pudo leer la hoja 1 del almacén." });
    expect(d.leer).not.toHaveBeenCalled();
    expect(await prisma.llamadaDeIA.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-ia-interpretar.test.ts` y `npm run test:base -- tests/base/taller-ia-rellenar.test.ts`
Expected: FAIL, no se encuentra `@/lib/taller/ia/rellenar`.

- [ ] **Step 3: Implementar**

```ts
// lib/taller/ia/rellenar.ts
import type { Prueba } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { etiquetaDeTarea, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import { fallosDeForma, formularioVacio, type Formulario } from "@/lib/taller/formas";
import { SIN_USO } from "./coste";
import { dudasDelFormulario, type Duda } from "./dudas";
import { encargoDeTarea, esquemaDeRespuesta, type Hoja } from "./encargo";
import { mensajeDeError } from "./errores";
import { imponerEstructura } from "./estructura";
import { descargarHoja } from "./hojas";
import { MODELO, hayClaveDeIA, leerConClaude, type LeerHojas, type RespuestaDeLaIA } from "./llamar";
import { apuntarLlamada } from "./registro";

export type ResultadoDeRelleno = { formulario: Formulario; dudas: Duda[] } | { error: string };

export type Dependencias = {
  leer: LeerHojas;
  descargar: (ruta: string, tipoMime: string) => Promise<Hoja>;
  hayClave: () => boolean;
  reloj: () => number;
};

const REALES: Dependencias = {
  leer: leerConClaude,
  descargar: (ruta, tipoMime) => descargarHoja(ruta, tipoMime),
  hayClave: hayClaveDeIA,
  reloj: () => Date.now(),
};

export function interpretar(regla: ReglaTarea, respuesta: RespuestaDeLaIA): ResultadoDeRelleno {
  if (respuesta.stopReason === "max_tokens") return { error: "La IA se quedó sin espacio y la respuesta está a medias." };
  if (respuesta.stopReason === "refusal") return { error: "La IA no quiso leer estas hojas." };
  const leida = esquemaDeRespuesta(regla.forma).safeParse(respuesta.salida);
  if (!leida.success) return { error: "La IA devolvió algo que no es esta tarea." };
  const impuesta = imponerEstructura(formularioVacio(regla), leida.data.formulario);
  if ("error" in impuesta) return impuesta;
  const fallos = fallosDeForma(regla, impuesta.formulario);
  if (fallos.length > 0) return { error: `Fallo del taller al ordenar lo leído: ${fallos[0]}` };
  return { formulario: impuesta.formulario, dudas: dudasDelFormulario(impuesta.formulario, leida.data.dudas) };
}

/**
 * Lee las hojas de una tarea con la IA y devuelve el formulario para la
 * pantalla. NO guarda nada de la tarea: solo apunta la llamada, que se paga
 * aunque falle.
 */
export async function rellenarTarea(examenId: string, prueba: Prueba, numero: number, deps: Dependencias = REALES): Promise<ResultadoDeRelleno> {
  if (!deps.hayClave()) return { error: "Falta la clave de la IA." };
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { paginas: { orderBy: { orden: "asc" }, include: { fichero: true } } },
  });
  const regla = examen ? reglaDe(examen.nivel, prueba, numero) : null;
  if (!examen || !regla) return { error: "Esa tarea no existe." };

  const etiqueta = etiquetaDeTarea(prueba, numero);
  const paginas = examen.paginas.filter((p) => p.etiquetas.includes(etiqueta));
  if (paginas.length === 0) return { error: "Etiqueta primero las hojas de esta tarea." };

  const hojas: Hoja[] = [];
  for (const p of paginas) {
    try {
      hojas.push(await deps.descargar(p.fichero.ruta, p.fichero.tipoMime));
    } catch {
      return { error: `No se pudo leer la hoja ${p.orden} del almacén.` };
    }
  }

  const encargo = encargoDeTarea(examen.nivel, prueba, regla, hojas);
  const inicio = deps.reloj();
  let respuesta: RespuestaDeLaIA;
  try {
    respuesta = await deps.leer(encargo);
  } catch (e) {
    const error = mensajeDeError(e);
    await apuntarLlamada({ examenId, prueba, numero, modelo: MODELO, uso: SIN_USO, milisegundos: deps.reloj() - inicio, error });
    return { error };
  }

  const resultado = interpretar(regla, respuesta);
  await apuntarLlamada({
    examenId, prueba, numero,
    modelo: respuesta.modelo,
    uso: respuesta.uso,
    milisegundos: deps.reloj() - inicio,
    error: "error" in resultado ? resultado.error : null,
  });
  return resultado;
}
```

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npx vitest run tests/taller-ia-interpretar.test.ts && npm run test:base -- tests/base/taller-ia-rellenar.test.ts`
Expected: PASS (5 + 7). Si el `import` de `@anthropic-ai/sdk` en la prueba de base da guerra al cargar, no es de esta tarea: `rellenar.ts` lo importa vía `llamar.ts`, que no llama a nada al importarse.

- [ ] **Step 5: Comprobar la mutación que más importa a mano** (añadir `await guardarTarea(examenId, prueba, numero, resultado.formulario)` antes del `return resultado` final, importándolo de `@/lib/taller/examenes`; ver rojo «no cambia ninguna fila»; deshacer).

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add lib/taller/ia/rellenar.ts tests/taller-ia-interpretar.test.ts tests/base/taller-ia-rellenar.test.ts
git commit -F - <<'EOF'
Rellenar una tarea con IA: interpretar la respuesta y orquestar sin guardar la tarea

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 7: La acción y el gasto en la pantalla del examen

**Files:**
- Modify: `app/examenes/acciones.ts`, `lib/taller/examenes.ts` (`ExamenDelTaller` y `examenParaElTaller`), `app/examenes/[id]/page.tsx` (tras el `<header>`)
- Test: `tests/taller-acciones.test.ts` (añadir), `tests/base/taller-examenes.test.ts` (añadir)

**Interfaces:**
- Consumes: `rellenarTarea`, `ResultadoDeRelleno` (Task 6); `gastoDelExamen` (Task 2); `textoDelGasto` (Task 1)
- Produces: `rellenarTareaConIAAccion(examenId: string, prueba: string, numero: number): Promise<ResultadoDeRelleno>`; `ExamenDelTaller.gasto: { llamadas: number; milesimas: number }`

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/taller-acciones.test.ts`: añadir `rellenarTarea: vi.fn(),` dentro de `vi.hoisted`, el mock
```ts
vi.mock("@/lib/taller/ia/rellenar", () => ({ rellenarTarea: dobles.rellenarTarea }));
```
junto a los demás `vi.mock`, `rellenarTareaConIAAccion` en el `import` de `@/app/examenes/acciones`, y al final del fichero:
```ts
describe("rellenar con IA", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // Mutación que la mata: quitar `await exigirProfesor()` de rellenarTareaConIAAccion.
  it("un estudiante no puede rellenar: no se llama a la IA", async () => {
    como(ESTUDIANTE);
    await expect(rellenarTareaConIAAccion("x1", "CE", 3)).rejects.toThrow("NOT_FOUND");
    expect(dobles.rellenarTarea).not.toHaveBeenCalled();
  });

  // Mutación que la mata: quitar la comprobación de esPrueba.
  it("una prueba inventada no llega a la IA", async () => {
    como(PROFESOR);
    expect(await rellenarTareaConIAAccion("x1", "XX", 3)).toEqual({ error: "Esa tarea no existe." });
    expect(dobles.rellenarTarea).not.toHaveBeenCalled();
  });

  // Mutación que la mata: no devolver lo que devuelve rellenarTarea.
  it("el profesor recibe lo que devuelve rellenarTarea, sin revalidar la pantalla", async () => {
    como(PROFESOR);
    dobles.rellenarTarea.mockResolvedValue({ error: "La IA no responde ahora. Prueba en un minuto." });
    expect(await rellenarTareaConIAAccion("x1", "CE", 3)).toEqual({ error: "La IA no responde ahora. Prueba en un minuto." });
    expect(dobles.rellenarTarea).toHaveBeenCalledWith("x1", "CE", 3);
    expect(dobles.revalidatePath).not.toHaveBeenCalled();
  });
});
```
Si el fichero ya define un `beforeEach` global que limpia los dobles, quitar el de este `describe`.

En `tests/base/taller-examenes.test.ts`, añadir el import `import { apuntarLlamada } from "@/lib/taller/ia/registro";` y:
```ts
// Mutación que la mata: no rellenar `gasto` en examenParaElTaller (dejarlo a cero).
it("el examen del taller trae el gasto de sus llamadas a la IA", async () => {
  const id = await examenConCuadernillo();
  await apuntarLlamada({ examenId: id, prueba: "CE", numero: 3, modelo: "claude-opus-5", uso: { entrada: 10_000, cacheLeidos: 0, cacheEscritos: 0, salida: 0 }, milisegundos: 1, error: null });
  expect((await examenParaElTaller(id))!.gasto).toEqual({ llamadas: 1, milesimas: 50 });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-acciones.test.ts` y `npm run test:base -- tests/base/taller-examenes.test.ts`
Expected: FAIL (`rellenarTareaConIAAccion` no existe; `gasto` undefined).

- [ ] **Step 3: Implementar la acción**

En `app/examenes/acciones.ts`, añadir el import `import { rellenarTarea, type ResultadoDeRelleno } from "@/lib/taller/ia/rellenar";` y al final:
```ts
/** Devuelve el formulario para la pantalla. No guarda la tarea, así que no hay nada que revalidar. */
export async function rellenarTareaConIAAccion(examenId: string, prueba: string, numero: number): Promise<ResultadoDeRelleno> {
  await exigirProfesor();
  if (!esPrueba(prueba) || !Number.isInteger(numero)) return { error: "Esa tarea no existe." };
  return rellenarTarea(examenId, prueba, numero);
}
```

- [ ] **Step 4: Implementar el gasto**

En `lib/taller/examenes.ts`: import `import { gastoDelExamen } from "./ia/registro";`; en `ExamenDelTaller` añadir
```ts
  /** Lo que ha costado la IA en este examen (estimación). */
  gasto: { llamadas: number; milesimas: number };
```
y en el `return` de `examenParaElTaller`, tras `tareas,`:
```ts
    gasto: await gastoDelExamen(examen.id),
```

En `app/examenes/[id]/page.tsx`: import `import { textoDelGasto } from "@/lib/taller/ia/coste";`, y dentro del `<header>`, tras el `<p>` del nivel:
```tsx
        {textoDelGasto(examen.gasto) && <p className="text-sm text-tinta-suave">{textoDelGasto(examen.gasto)}</p>}
```

- [ ] **Step 5: Correr pruebas y tipos**

Run: `npx vitest run tests/taller-acciones.test.ts tests/taller-pantallas.test.ts && npm run test:base -- tests/base/taller-examenes.test.ts && npx tsc --noEmit`
Expected: PASS y `tsc` limpio. Si `tsc` señala un objeto `ExamenDelTaller` inventado en una prueba (p. ej. `tests/taller-pantallas.test.ts`), añadirle `gasto: { llamadas: 0, milesimas: 0 }`.

- [ ] **Step 6: Comprobar una mutación a mano** (quitar `await exigirProfesor();` de `rellenarTareaConIAAccion`, ver rojo, deshacer).

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add app/examenes/acciones.ts lib/taller/examenes.ts 'app/examenes/[id]/page.tsx' tests/taller-acciones.test.ts tests/base/taller-examenes.test.ts
git commit -F - <<'EOF'
Acción de rellenar con IA con su candado, y el gasto en la pantalla del examen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```
(Añadir también cualquier prueba tocada en el Step 5.)

---

### Task 8: El botón, las dudas en pantalla y la pantalla de la tarea

**Files:**
- Create: `components/taller/dudas.tsx`
- Modify: `components/taller/campo.tsx`, `components/taller/formas-cerradas.tsx`, `components/taller/formas-abiertas.tsx`, `components/taller/formulario-de-tarea.tsx`, `app/examenes/[id]/[prueba]/[numero]/page.tsx`
- Test: `tests/taller-formulario.test.tsx` (añadir), `tests/taller-ia-campo.test.tsx`

**Interfaces:**
- Consumes: `Duda`, `claveDeRuta`, `quitarDudasDe`, `tieneAlgoEscrito` (Task 3); `rellenarTareaConIAAccion` (Task 7); `hayClaveDeIA` (Task 5); `formularioVacio`
- Produces: `DudasContext: React.Context<ReadonlyMap<string, string>>`, `useDuda(ruta: Ruta): string | undefined`; `Campo`, `Letra`, `Numero` ganan `ruta: Ruta` obligatoria; `Pautas` gana `ruta: Ruta`; `FormularioDeTarea` gana `hayClave: boolean` y `hayHojas: boolean`

- [ ] **Step 1: Escribir las pruebas que fallan**

```tsx
// tests/taller-ia-campo.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Campo, Pautas } from "@/components/taller/campo";
import { DudasContext } from "@/components/taller/dudas";

const nada = () => {};

describe("un campo con duda de la IA", () => {
  // Mutación que la mata: no leer el contexto en Campo.
  it("pinta la nota de su duda", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["actividad.titulo", "no se lee la tilde"]])}>
        <Campo etiqueta="Título" valor="Canción" alCambiar={nada} ruta={["actividad", "titulo"]} opcional />
      </DudasContext.Provider>,
    );
    expect(html).toContain('data-duda="actividad.titulo"');
    expect(html).toContain("La IA duda: no se lee la tilde");
    expect(html).toContain("bg-sol-100");
  });

  // Mutación que la mata: pintar la duda de cualquier campo (no comparar la clave).
  it("un campo sin duda no pinta ninguna, aunque otro la tenga", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["consigna", "retocada"]])}>
        <Campo etiqueta="Título" valor="Canción" alCambiar={nada} ruta={["actividad", "titulo"]} opcional />
      </DudasContext.Provider>,
    );
    expect(html).not.toContain("data-duda");
    expect(html).not.toContain("bg-sol-100");
  });

  // Mutación que la mata: pasar a cada pauta la ruta de la lista y no [...ruta, i].
  it("cada pauta mira su propia duda", () => {
    const html = renderToStaticMarkup(
      <DudasContext.Provider value={new Map([["actividad.pautas.1", "cortada"]])}>
        <Pautas etiqueta="Pautas" pautas={["una", "dos"]} alCambiar={nada} ruta={["actividad", "pautas"]} />
      </DudasContext.Provider>,
    );
    expect(html.match(/data-duda=/g)).toHaveLength(1);
    expect(html).toContain('data-duda="actividad.pautas.1"');
  });
});
```

En `tests/taller-formulario.test.tsx`: cambiar el mock a
```tsx
vi.mock("@/app/examenes/acciones", () => ({ guardarTareaAccion: vi.fn(), rellenarTareaConIAAccion: vi.fn() }));
```
añadir a `pintar` dos parámetros finales `hayClave = true, hayHojas = true` y pasarlos como props `hayClave={hayClave} hayHojas={hayHojas}`, y añadir:
```tsx
describe("el botón de rellenar con IA", () => {
  // Mutación que la mata: no apagar el botón sin hojas.
  it("sin hojas etiquetadas sale apagado y dice por qué", () => {
    const html = pintar("CE", 3, null, null, true, false);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Rellenar con IA<\/button>/);
    expect(html).toContain("Etiqueta primero las hojas de esta tarea.");
  });

  // Mutación que la mata: no apagar el botón sin clave.
  it("sin clave sale apagado y dice por qué", () => {
    const html = pintar("CE", 3, null, null, false, true);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Rellenar con IA<\/button>/);
    expect(html).toContain("Falta la clave de la IA.");
  });

  // Mutación que la mata: dejarlo apagado siempre.
  it("con hojas y clave sale encendido y sin avisos", () => {
    const html = pintar("CE", 3, null, null, true, true);
    expect(html).toMatch(/<button[^>]*>Rellenar con IA<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Rellenar con IA/);
    expect(html).not.toContain("Falta la clave de la IA.");
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-ia-campo.test.tsx tests/taller-formulario.test.tsx`
Expected: FAIL (no existe `components/taller/dudas`; no hay botón).

- [ ] **Step 3: El contexto de dudas**

```tsx
// components/taller/dudas.tsx
"use client";

import { createContext, useContext } from "react";
import type { Ruta } from "@/lib/taller/editar";
import { claveDeRuta } from "@/lib/taller/ia/dudas";

/** Las dudas de la IA por clave de campo («actividad.preguntas.2.enunciado» → nota). Vacío si no se ha rellenado con IA. */
export const DudasContext = createContext<ReadonlyMap<string, string>>(new Map());

export function useDuda(ruta: Ruta): string | undefined {
  return useContext(DudasContext).get(claveDeRuta(ruta));
}
```

- [ ] **Step 4: Cada campo, con su ruta y su duda** (`components/taller/campo.tsx`)

Imports nuevos al principio (tras `"use client";`):
```tsx
import type { Ruta } from "@/lib/taller/editar";
import { claveDeRuta } from "@/lib/taller/ia/dudas";
import { useDuda } from "./dudas";
```
Sustituir `Campo` por:
```tsx
/** Un campo del taller. Vacío y obligatorio, o con duda de la IA, se pinta en amarillo. */
export function Campo({
  etiqueta,
  valor,
  alCambiar,
  ruta,
  largo = false,
  opcional = false,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  /** La misma ruta que se pasa a `cambiar`: con ella se encuentra su duda. */
  ruta: Ruta;
  largo?: boolean;
  opcional?: boolean;
}) {
  const duda = useDuda(ruta);
  const falta = !opcional && valor.trim() === "";
  const clases = `${ENTRADA} ${falta || duda ? "border-sol-400 bg-sol-100" : "border-tinta-suave/30 bg-white"}`;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-tinta-suave">
        {etiqueta}
        {opcional ? " (opcional)" : ""}
      </span>
      {largo ? (
        <textarea value={valor} onChange={(e) => alCambiar(e.target.value)} rows={5} className={clases} />
      ) : (
        <input type="text" value={valor} onChange={(e) => alCambiar(e.target.value)} className={clases} />
      )}
      {duda && <span data-duda={claveDeRuta(ruta)} className="text-sm text-tinta-suave">La IA duda: {duda}</span>}
    </label>
  );
}
```
`Letra`: añadir `ruta` a sus props (`{ etiqueta, valor, alCambiar, ruta }: { …; ruta: Ruta }`) y pasarla: `<Campo … ruta={ruta} />`.
`Pautas`: añadir `ruta: Ruta` a sus props y en cada pauta `ruta={[...ruta, i]}`.
`Numero`: añadir `ruta: Ruta` a sus props, `const duda = useDuda(ruta);` al principio, y antes de cerrar el `<label>`:
```tsx
      {duda && <span data-duda={claveDeRuta(ruta)} className="text-sm text-tinta-suave">La IA duda: {duda}</span>}
```

- [ ] **Step 5: Pasar la ruta en cada llamada**

**Regla: `ruta={X}` donde `X` es exactamente el array que esa misma línea pasa a `cambiar` en `alCambiar`.** `tsc` marcará cualquiera que falte, porque `ruta` es obligatoria. Las llamadas son:

| Fichero | Llamada | `ruta` |
|---|---|---|
| `formulario-de-tarea.tsx` | Consigna | `["consigna"]` |
| `formulario-de-tarea.tsx` | Nombre o título del texto `i` | `["textos", i, "etiqueta"]` |
| `formulario-de-tarea.tsx` | Texto del texto `i` | `["textos", i, "texto"]` |
| `formas-cerradas.tsx:20` | Opción dentro de `Opciones` | `[...ruta, i, "texto"]` |
| `formas-cerradas.tsx:43` | Texto del ejemplo | `["actividad", "ejemplo", "texto"]` |
| `formas-cerradas.tsx:44, 77, 99` | Letra del ejemplo | `["actividad", "ejemplo", "letra"]` |
| `formas-cerradas.tsx:49` | Texto del elemento | `["actividad", "elementos", i, "texto"]` |
| `formas-cerradas.tsx:55` | Título del destino | `["actividad", "destinos", i, "titulo"]` |
| `formas-cerradas.tsx:56` | Texto del destino | `["actividad", "destinos", i, "texto"]` |
| `formas-cerradas.tsx:70` | Opción de la lista común | `["actividad", "comunes", i, "texto"]` |
| `formas-cerradas.tsx:76, 97` | Enunciado del ejemplo | `["actividad", "ejemplo", "enunciado"]` |
| `formas-cerradas.tsx:83, 108` | Enunciado de la pregunta | `["actividad", "preguntas", i, "enunciado"]` |
| `formas-cerradas.tsx:121` | Título (huecos) | `["actividad", "titulo"]` |
| `formas-cerradas.tsx:122` | Texto con huecos | `["actividad", "texto"]` |
| `formas-cerradas.tsx:123` | Autor o fuente | `["actividad", "fuente"]` |
| `formas-abiertas.tsx:12` | Rango mínimo | `[...ruta, "min"]` |
| `formas-abiertas.tsx:13` | Rango máximo | `[...ruta, "max"]` |
| `formas-abiertas.tsx:22` | Situación | `["actividad", "situacion"]` |
| `formas-abiertas.tsx:23` | Texto recibido | `["actividad", "textoRecibido"]` |
| `formas-abiertas.tsx:24` | Pautas (redacción una) | `["actividad", "pautas"]` |
| `formas-abiertas.tsx:37` | Título de la opción | `["actividad", "opciones", i, "titulo"]` |
| `formas-abiertas.tsx:38` | Contexto | `["actividad", "opciones", i, "contexto"]` |
| `formas-abiertas.tsx:39, 58, 82` | Pautas de la opción | `["actividad", "opciones", i, "pautas"]` |
| `formas-abiertas.tsx:56, 79` | Tema | `["actividad", "opciones", i, "tema"]` |
| `formas-abiertas.tsx:63` | Minutos de preparación | `["actividad", "preparacion"]` |
| `formas-abiertas.tsx:80` | Situación de la opción | `["actividad", "opciones", i, "situacion"]` |
| `formas-abiertas.tsx:81` | Papel del examinador | `["actividad", "opciones", i, "papelExaminador"]` |

Run: `npx tsc --noEmit` → limpio. Si `tsc` marca un `Campo`, `Letra`, `Numero` o `Pautas` que no está en la tabla (las líneas pueden haberse movido, o haber otro uso fuera de estos ficheros), se aplica la misma regla: la ruta que esa línea pasa a `cambiar`. Si un uso no tiene `cambiar` con ruta, no es un campo del formulario de tarea: pararse y preguntar.

- [ ] **Step 6: El botón y el estado de dudas** (`components/taller/formulario-de-tarea.tsx`)

Imports: cambiar el de acciones a `import { guardarTareaAccion, rellenarTareaConIAAccion } from "@/app/examenes/acciones";`, `useState, useTransition` pasa a `useMemo, useState, useTransition`, y añadir:
```tsx
import { formularioVacio } from "@/lib/taller/formas";
import { quitarDudasDe, tieneAlgoEscrito, type Duda } from "@/lib/taller/ia/dudas";
import { DudasContext } from "./dudas";
```
(`Formulario` sigue importándose como tipo de `@/lib/taller/formas`: juntar ambos en un solo import.)

En `Props` añadir `hayClave: boolean;` y `hayHojas: boolean;`, y en la desestructuración de la función.

Tras los `useState` existentes:
```tsx
  const [dudas, setDudas] = useState<Duda[]>([]);
  const [rellenando, empezarRelleno] = useTransition();
  const mapaDeDudas = useMemo(() => new Map(dudas.map((d) => [d.clave, d.nota])), [dudas]);
```
`cambiar` pasa a:
```tsx
  const cambiar = (ruta: Ruta, valor: unknown) => {
    setF((actual) => cambiarEn(actual, ruta, valor));
    setDudas((actuales) => quitarDudasDe(actuales, ruta));
    setSinGuardar(true);
  };
```
En `guardar`, dentro de la rama buena, tras `setSinGuardar(false);`: `setDudas([]);`.

Nueva función, tras `guardar`:
```tsx
  function rellenar() {
    if (tieneAlgoEscrito(f, formularioVacio(regla)) && !window.confirm("Se sustituirá lo escrito por lo que lea la IA. ¿Seguir?")) return;
    setError(null);
    empezarRelleno(async () => {
      try {
        const r = await rellenarTareaConIAAccion(examenId, prueba, numero);
        if ("error" in r) setError(r.error);
        else {
          setF(r.formulario);
          setDudas(r.dudas);
          setSinGuardar(true);
        }
      } catch {
        setError("No se ha podido rellenar. Revisa la conexión y vuelve a pulsar Rellenar con IA.");
      }
    });
  }
```
En el JSX, envolver todo el contenido del `<div className="flex min-w-0 flex-col gap-4">` en `<DudasContext.Provider value={mapaDeDudas}>…</DudasContext.Provider>` y, justo antes de `<EstadoDeLaTarea … />`:
```tsx
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={rellenar}
            disabled={!hayClave || !hayHojas || rellenando || guardando}
            className="rounded-2xl border border-hp-400 px-5 py-2 font-bold text-hp-600 disabled:opacity-50"
          >
            {rellenando ? "Leyendo las hojas…" : "Rellenar con IA"}
          </button>
          {!hayHojas && <span className="text-tinta-suave">Etiqueta primero las hojas de esta tarea.</span>}
          {hayHojas && !hayClave && <span className="text-tinta-suave">Falta la clave de la IA.</span>}
        </div>
        {dudas.length > 0 && (
          <section className={CAJA} data-lista-de-dudas>
            <h3 className="font-bold">La IA duda en {dudas.length} {dudas.length === 1 ? "sitio" : "sitios"} (marcados en amarillo)</h3>
            <ul className="list-disc pl-5">
              {dudas.map((d) => <li key={d.clave}>{d.nota}</li>)}
            </ul>
          </section>
        )}
```
El botón de Guardar gana `|| rellenando` en su `disabled`.

- [ ] **Step 7: La pantalla de la tarea** (`app/examenes/[id]/[prueba]/[numero]/page.tsx`)

Leer antes la guía de configuración de segmentos de ruta en `node_modules/next/dist/docs/` (buscar `maxDuration` con `grep -rln maxDuration node_modules/next/dist/docs | head`) y comprobar que en Next 16 sigue siendo `export const maxDuration`. Luego: import `import { hayClaveDeIA } from "@/lib/taller/ia/llamar";`, tras los imports:
```tsx
// Rellenar con IA puede tardar: una tarea con varias hojas y razonamiento, en torno al minuto.
export const maxDuration = 300;
```
y en `<FormularioDeTarea … />` añadir:
```tsx
          hayClave={hayClaveDeIA()}
          hayHojas={tarea.paginas.length > 0}
```

- [ ] **Step 8: Correr pruebas, tipos y lint**

Run: `npx vitest run tests/taller-ia-campo.test.tsx tests/taller-formulario.test.tsx tests/taller-pantallas.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, `tsc` y lint limpios.

- [ ] **Step 9: Comprobar dos mutaciones a mano** (en `Pautas`, pasar `ruta={ruta}` en vez de `[...ruta, i]`; quitar `!hayHojas ||` del `disabled`), ver rojo, deshacer.

- [ ] **Step 10: Commit**

```bash
git branch --show-current
git add components/taller/dudas.tsx components/taller/campo.tsx components/taller/formas-cerradas.tsx components/taller/formas-abiertas.tsx components/taller/formulario-de-tarea.tsx 'app/examenes/[id]/[prueba]/[numero]/page.tsx' tests/taller-ia-campo.test.tsx tests/taller-formulario.test.tsx
git commit -F - <<'EOF'
Botón Rellenar con IA y dudas marcadas en cada campo del formulario

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XKnWnE9jQuSmzZxvpoWBWz
EOF
```

---

### Task 9: Cierre y aceptación (la hace el controlador, no un subagente)

- [ ] **Step 1: Suites completas, una vez**

```bash
npm test 2>&1 | tail -n 5
npm run test:base 2>&1 | tail -n 5
npx tsc --noEmit && npm run lint
```
Expected: todo verde; el número de pruebas es el de partida (Task 1, Step 0) más las nuevas, y **no es cero**.

- [ ] **Step 2: Revisión final** del diff completo de la rama (`git diff --stat 2be23d5..HEAD` primero) contra la spec, sección por sección.

- [ ] **Step 3: En navegador, en local, sin IA real**: arrancar con `npm run dev`, entrar como profesor, abrir una tarea sin hojas (botón apagado con su aviso) y una con hojas y sin `ANTHROPIC_API_KEY` (apagado con «Falta la clave de la IA»). Comprobar a 400 px de ancho que el botón y la lista de dudas no desbordan.

- [ ] **Step 4: Fusionar y empujar SOLO con el «sí» del profesor** (skill `abrir-rama-en-worktree`, sección «Al fusionar»). El despliegue aplica la migración `taller_entrega_2`.

- [ ] **Step 5: Aceptación con la API de verdad, en producción** (requisitos de la sección 8 de la spec: clave pegada en Vercel y examen 1 con hojas etiquetadas). Rellenar **una tarea de cada forma**: CE1 (relacionar), CE2 (lista común), CE3 (opciones), CE4 (huecos), EE1, EE2, EO1, EO2. En cada una: el formulario se llena, la consigna sale como duda, «Guardar» sigue funcionando. Después, contra la base de producción:
```sql
select prueba, numero, modelo, resultado, error, "tokensEntrada", "tokensCacheLeidos", "tokensCacheEscritos", "tokensSalida", "costeMilesimasDeDolar", milisegundos
from "LlamadaDeIA" order by "createdAt";
```
Expected: 8 filas `OK`; se observa `tokensCacheLeidos`, sin exigir que sea mayor que 0 desde la segunda: las instrucciones fijas rondan el mínimo cacheable de Opus 5 y el ahorro posible es de céntimos; coste total en torno a 1 $; `modelo` = `claude-opus-5` en todas (otro modelo = respondió el respaldo: apuntarlo). Usar CE1, la tarea más larga, para medir cuánto tarda y cuántos tokens de salida gasta.

- [ ] **Step 6: Memoria.** Actualizar `hispaprofe-dele-taller-entrega-2.md` con el resultado real (coste por tarea, segundos, qué acertó y qué no la IA) y la línea de `MEMORY.md`.
