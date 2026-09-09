# Cimientos de HispaProfe DELE · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el proyecto nuevo con el modelo de datos de la sección 3 de la
spec y la guarda que impide publicar un examen que no cumple sus números.

**Architecture:** Una tarea es una lista ordenada de piezas, y una pieza puede
ser una actividad. Las reglas del DELE viven en una capa por encima
(`lib/dele/estructura.ts`) y no dentro del modelo, para que el mismo modelo sirva
mañana al editor libre. Las respuestas correctas viven en una tabla aparte
(`Clave`), de modo que enseñar una tarea nunca pueda arrastrar la solución.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript 5, Prisma 7.8 con
Postgres, Tailwind 4, Zod 4, Vitest. Node 24.15, npm 11.12. Mismas versiones que
el repositorio viejo, para que lo que se mude no pelee.

**Spec:** `docs/superpowers/specs/2026-09-09-hispaprofe-dele-design.md`

## Global Constraints

- **Nada de jerga en nombres visibles ni en rutas:** ni `recorrido`, ni `paso`,
  ni `secuencia`, ni `puerta`, ni `sujeto`. En el código y en la base se llaman
  `Examen`, `Tarea`, `Pieza`, `Actividad`, `Clave`.
- **Todo el texto de cara al usuario, en español**, incluidos los mensajes de
  error que pueda leer el profesor.
- **Cada prueba escrita declara qué mutación la mataría, y se comprueba.** Sin la
  mutación comprobada, la prueba no cuenta como verificada.
- **Antes de leer un resultado de pruebas, comprobar que el número recogido no es
  cero.** Cero pruebas recogidas se lee como «ningún fallo» y no lo es.
- **Ninguna respuesta correcta puede salir del servidor hacia el estudiante.**
- Paleta y tipografía de la casa: azul `#04a1f1` / `#0b8ad1` / `#0f6fa8`, fondo
  `#f4f9fc`, tinta `#143a4f`, tinta suave `#5a7a8c`, tarjetas de 16 px de radio,
  tipografía Nunito.

---

## File Structure

| Fichero | Responsabilidad |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` | Esqueleto del proyecto |
| `vitest.config.ts` | Configuración de las pruebas |
| `app/globals.css` | La paleta como variables de tema |
| `app/layout.tsx` | El envoltorio mínimo con la tipografía |
| `prisma/schema.prisma` | El modelo: Examen, Tarea, Pieza, Actividad, Clave |
| `lib/dele/estructura.ts` | Las reglas del A2/B1 escolar: cuántas tareas y cuántos ítems |
| `lib/examen/publicar.ts` | La guarda: por qué un examen no se puede publicar |
| `lib/examen/paraElEstudiante.ts` | Lo que se le manda al estudiante, sin claves |
| `tests/*.test.ts` | Las pruebas de cada pieza de lo anterior |

---

### Task 1: El esqueleto del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
- Test: `tests/humo.test.ts`

**Interfaces:**
- Consumes: nada, es el primero.
- Produces: un proyecto que arranca, y `npm test` que ejecuta Vitest.

- [ ] **Step 1: Crear el proyecto y las dependencias**

```bash
cd /Users/FLE/Projects/hispaprofe-dele
npm init -y
npm install next@16.2.6 react@19.2.4 react-dom@19.2.4 @prisma/client@^7.8.0 @prisma/adapter-pg@^7.9.0 pg@^8.22.0 zod@^4.4.3
npm install -D typescript@^5 @types/node@^20 @types/react@^19 @types/react-dom@^19 prisma@^7.8.0 tailwindcss@^4 @tailwindcss/postcss@^4 vitest@^3 tsx@^4.23.1 eslint@^9 eslint-config-next@16.2.6
```

- [ ] **Step 2: Escribir los ficheros de configuración**

`package.json` — reemplazar el bloque `scripts` por:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma migrate deploy && next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "postinstall": "prisma generate"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
```

- [ ] **Step 3: La paleta y el envoltorio**

`app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-hp-50: #eaf7fe;
  --color-hp-100: #c9ebfc;
  --color-hp-200: #93d8f9;
  --color-hp-300: #4fbff5;
  --color-hp-400: #04a1f1;
  --color-hp-500: #0b8ad1;
  --color-hp-600: #0f6fa8;
  --color-hp-700: #0f567f;

  --color-sol-100: #fff8d6;
  --color-sol-400: #f5ce3d;
  --color-coral-100: #fdeaef;
  --color-coral-500: #e0566e;
  --color-coral-600: #c53a55;
  --color-verde-100: #e4f5ef;
  --color-verde-500: #18988a;
  --color-verde-600: #147a70;
  --color-error-100: #fde8e8;
  --color-error-500: #d93a3a;
  --color-error-600: #b42b2b;

  --color-fondo: #f4f9fc;
  --color-tinta: #143a4f;
  --color-tinta-suave: #5a7a8c;

  --shadow-suave: 0 4px 16px -4px rgba(4, 161, 241, 0.18);
  --shadow-tarjeta: 0 10px 30px -12px rgba(4, 161, 241, 0.25);
  --radius-tarjeta: 16px;
}

body {
  background: var(--color-fondo);
  color: var(--color-tinta);
}
```

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "HispaProfe",
  description: "Preparación del DELE A2/B1 escolar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} font-sans`}>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
export default function Portada() {
  return <main className="p-8"><h1 className="text-3xl font-extrabold">HispaProfe</h1></main>;
}
```

- [ ] **Step 4: Escribir la prueba de humo**

`tests/humo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("el esqueleto", () => {
  it("define la paleta de la casa en globals.css", () => {
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("--color-hp-400: #04a1f1;");
    expect(css).toContain("--color-tinta: #143a4f;");
  });
});
```

- [ ] **Step 5: Correr las pruebas y comprobar el recuento**

Run: `npm test`
Expected: `1 passed`. **Si dice 0 recogidas, no es un éxito**: revisar el `include` de `vitest.config.ts` antes de seguir.

*Mutación que debe matarla:* cambiar `--color-hp-400` a otro valor en `globals.css` pone la prueba en rojo. Comprobarlo.

- [ ] **Step 6: Comprobar que el proyecto compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "El esqueleto del proyecto, con la paleta de la casa y Vitest"
```

---

### Task 2: El modelo de datos

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `.env.example`
- Test: `tests/modelo.test.ts`

**Interfaces:**
- Consumes: el esqueleto de la tarea 1.
- Produces: los tipos generados de Prisma (`Examen`, `Tarea`, `Pieza`, `Actividad`, `Clave`) y los enums `Prueba`, `EstadoExamen`, `TipoPieza`, `TipoActividad`, `Nivel`. `lib/db.ts` exporta `prisma`.

- [ ] **Step 1: Escribir el esquema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../lib/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Nivel {
  A1
  A2
  B1
  B2
}

/// Las cuatro pruebas del DELE.
enum Prueba {
  CE
  CO
  EE
  EO
}

enum EstadoExamen {
  EN_CONSTRUCCION
  PUBLICADO
  ARCHIVADO
}

/// Lo que puede ser una pieza dentro de una tarea.
enum TipoPieza {
  TEXTO
  IMAGEN
  AUDIO
  VIDEO
  ACTIVIDAD
}

enum TipoActividad {
  OPCION
  HUECOS
  ORDENAR
  RELACIONAR
  REDACCION
  GRABACION
}

model Examen {
  id        String       @id @default(cuid())
  titulo    String
  nivel     Nivel
  estado    EstadoExamen @default(EN_CONSTRUCCION)
  tareas    Tarea[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([estado])
}

model Tarea {
  id       String @id @default(cuid())
  examen   Examen @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId String
  prueba   Prueba
  numero   Int
  piezas   Pieza[]

  /// Un examen no puede tener dos «tarea 2 de lectura».
  @@unique([examenId, prueba, numero])
  @@index([examenId])
}

/// El cambio de fondo respecto al sitio viejo: una tarea tiene TANTAS piezas
/// como haga falta, en el orden que sea. No hay ninguna regla que limite a una
/// actividad por tarea.
model Pieza {
  id     String    @id @default(cuid())
  tarea  Tarea     @relation(fields: [tareaId], references: [id], onDelete: Cascade)
  tareaId String
  orden  Int
  tipo   TipoPieza

  /// Para TEXTO. En las demás va a null.
  texto String?
  /// Para IMAGEN, AUDIO y VIDEO: el identificador en el almacén de ficheros.
  ficheroId String?
  /// Pie de foto, título del audio o etiqueta del vídeo.
  etiqueta String?

  actividad Actividad?

  @@unique([tareaId, orden])
  @@index([tareaId])
}

model Actividad {
  id      String        @id @default(cuid())
  pieza   Pieza         @relation(fields: [piezaId], references: [id], onDelete: Cascade)
  piezaId String        @unique
  tipo    TipoActividad
  /// Enunciados, opciones y textos. NUNCA las respuestas correctas.
  datos   Json
  clave   Clave?
}

/// Las respuestas correctas viven en su propia tabla, para que enseñar una
/// actividad no pueda arrastrar la solución por descuido.
model Clave {
  id          String    @id @default(cuid())
  actividad   Actividad @relation(fields: [actividadId], references: [id], onDelete: Cascade)
  actividadId String    @unique
  respuestas  Json
}
```

- [ ] **Step 2: El cliente y el ejemplo de entorno**

`lib/db.ts`:

```ts
import { PrismaClient } from "@/lib/generated/prisma";

const global_ = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = global_.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;
```

`.env.example`:

```
DATABASE_URL="postgresql://usuario:clave@host/base?sslmode=require"
DIRECT_URL="postgresql://usuario:clave@host/base?sslmode=require"
```

- [ ] **Step 3: Generar el cliente y crear la migración**

```bash
npx prisma generate
npx prisma migrate dev --name cimientos
```

Expected: se crea `prisma/migrations/<fecha>_cimientos/migration.sql`.
Si no hay base de datos a mano, usar `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` y guardarlo a mano.

- [ ] **Step 4: Escribir la prueba del esquema**

`tests/modelo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const esquema = readFileSync("prisma/schema.prisma", "utf8");

/** Quita los comentarios para que una prueba no encuentre lo que busca dentro de uno. */
function sinComentarios(texto: string): string {
  return texto
    .split("\n")
    .map((linea) => linea.replace(/\/\/.*$/, "").replace(/^\s*\/\/\/.*$/, ""))
    .join("\n");
}

const limpio = sinComentarios(esquema);

describe("el modelo", () => {
  it("no limita el número de actividades por tarea", () => {
    expect(limpio).not.toContain("@@unique([tareaId])");
    expect(limpio).not.toContain("@@unique([pasoId])");
  });

  it("ordena las piezas dentro de la tarea y no deja dos en el mismo sitio", () => {
    expect(limpio).toContain("@@unique([tareaId, orden])");
  });

  it("guarda las respuestas en una tabla aparte de la actividad", () => {
    expect(limpio).toMatch(/model Clave \{[\s\S]*respuestas\s+Json/);
    const actividad = limpio.match(/model Actividad \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(actividad).not.toContain("respuestas");
  });

  it("no usa la jerga vieja en ningún nombre de modelo", () => {
    for (const palabra of ["model Recorrido", "model Paso", "model Sujeto"]) {
      expect(limpio).not.toContain(palabra);
    }
  });
});
```

- [ ] **Step 5: Correr las pruebas**

Run: `npm test`
Expected: `5 passed` en total con la de humo. Comprobar que el recuento no es cero.

*Mutaciones que deben matarlas, una a una:*
1. Añadir `@@unique([tareaId])` al modelo `Pieza` → muere la primera.
2. Quitar `@@unique([tareaId, orden])` → muere la segunda.
3. Mover el campo `respuestas` de `Clave` a `Actividad` → muere la tercera.
4. Renombrar `Tarea` a `Paso` → muere la cuarta.

Comprobar las cuatro y deshacerlas.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "El modelo: una tarea es una lista de piezas, y las claves viven aparte"
```

---

### Task 3: Las reglas del A2/B1 escolar

**Files:**
- Create: `lib/dele/estructura.ts`
- Test: `tests/estructura.test.ts`

**Interfaces:**
- Consumes: el enum `Prueba` de la tarea 2.
- Produces:
  - `type ReglaTarea = { numero: number; items: number | null }`
  - `const ESTRUCTURA: Record<Prueba, ReglaTarea[]>`
  - `function reglaDe(prueba: Prueba, numero: number): ReglaTarea | null`

- [ ] **Step 1: Escribir la prueba, antes que el código**

`tests/estructura.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ESTRUCTURA, reglaDe } from "@/lib/dele/estructura";

describe("la estructura del A2/B1 escolar", () => {
  it("la comprensión de lectura son 4 tareas de 6, 6, 6 y 7 ítems", () => {
    expect(ESTRUCTURA.CE.map((r) => r.items)).toEqual([6, 6, 6, 7]);
  });

  it("la comprensión auditiva son 4 tareas de 7, 6, 6 y 6 ítems", () => {
    expect(ESTRUCTURA.CO.map((r) => r.items)).toEqual([7, 6, 6, 6]);
  });

  it("las dos pruebas de opciones suman 25 ítems cada una", () => {
    const suma = (p: "CE" | "CO") =>
      ESTRUCTURA[p].reduce((t, r) => t + (r.items ?? 0), 0);
    expect(suma("CE")).toBe(25);
    expect(suma("CO")).toBe(25);
  });

  it("la expresión escrita son 2 tareas de respuesta abierta", () => {
    expect(ESTRUCTURA.EE).toHaveLength(2);
    expect(ESTRUCTURA.EE.every((r) => r.items === null)).toBe(true);
  });

  it("la expresión oral son 4 tareas de respuesta abierta", () => {
    expect(ESTRUCTURA.EO).toHaveLength(4);
    expect(ESTRUCTURA.EO.every((r) => r.items === null)).toBe(true);
  });

  it("reglaDe devuelve null para una tarea que no existe", () => {
    expect(reglaDe("CE", 5)).toBeNull();
    expect(reglaDe("CE", 0)).toBeNull();
  });

  it("reglaDe devuelve la tarea 4 de lectura con sus 7 ítems", () => {
    expect(reglaDe("CE", 4)).toEqual({ numero: 4, items: 7 });
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/estructura.test.ts`
Expected: FAIL, «Failed to resolve import "@/lib/dele/estructura"».

- [ ] **Step 3: Escribir la implementación mínima**

`lib/dele/estructura.ts`:

```ts
import type { Prueba } from "@/lib/generated/prisma";

/** Una tarea del examen. `items` a null es respuesta abierta: no se cuentan. */
export type ReglaTarea = { numero: number; items: number | null };

/**
 * Los números del DELE A2/B1 escolar, verificados contra los cuadernillos.
 * Viven aquí y no en el modelo: el modelo tiene que servir mañana a una
 * secuencia libre, que no cumple ninguna de estas reglas.
 */
export const ESTRUCTURA: Record<Prueba, ReglaTarea[]> = {
  CE: [
    { numero: 1, items: 6 },
    { numero: 2, items: 6 },
    { numero: 3, items: 6 },
    { numero: 4, items: 7 },
  ],
  CO: [
    { numero: 1, items: 7 },
    { numero: 2, items: 6 },
    { numero: 3, items: 6 },
    { numero: 4, items: 6 },
  ],
  EE: [
    { numero: 1, items: null },
    { numero: 2, items: null },
  ],
  EO: [
    { numero: 1, items: null },
    { numero: 2, items: null },
    { numero: 3, items: null },
    { numero: 4, items: null },
  ],
};

export function reglaDe(prueba: Prueba, numero: number): ReglaTarea | null {
  return ESTRUCTURA[prueba].find((r) => r.numero === numero) ?? null;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/estructura.test.ts`
Expected: `7 passed`.

*Mutación que debe matarlas:* cambiar el `items: 7` de la tarea 4 de CE por `6`. Mueren dos pruebas, la primera y la de la suma. Comprobarlo y deshacerlo.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Los números del A2/B1 escolar, en su propia capa"
```

---

### Task 4: La guarda de publicación

**Files:**
- Create: `lib/examen/publicar.ts`
- Test: `tests/publicar.test.ts`

**Interfaces:**
- Consumes: `ESTRUCTURA` y `reglaDe` de la tarea 3; los tipos de la tarea 2.
- Produces:
  - `type TareaParaRevisar = { prueba: Prueba; numero: number; items: number }`
  - `function motivosParaNoPublicar(tareas: TareaParaRevisar[]): string[]` — lista vacía significa que se puede publicar.

- [ ] **Step 1: Escribir la prueba, antes que el código**

`tests/publicar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { motivosParaNoPublicar, type TareaParaRevisar } from "@/lib/examen/publicar";

/** Un examen entero y correcto: 4+4 tareas de opciones y las 6 abiertas. */
function examenCompleto(): TareaParaRevisar[] {
  return [
    { prueba: "CE", numero: 1, items: 6 },
    { prueba: "CE", numero: 2, items: 6 },
    { prueba: "CE", numero: 3, items: 6 },
    { prueba: "CE", numero: 4, items: 7 },
    { prueba: "CO", numero: 1, items: 7 },
    { prueba: "CO", numero: 2, items: 6 },
    { prueba: "CO", numero: 3, items: 6 },
    { prueba: "CO", numero: 4, items: 6 },
    { prueba: "EE", numero: 1, items: 0 },
    { prueba: "EE", numero: 2, items: 0 },
    { prueba: "EO", numero: 1, items: 0 },
    { prueba: "EO", numero: 2, items: 0 },
    { prueba: "EO", numero: 3, items: 0 },
    { prueba: "EO", numero: 4, items: 0 },
  ];
}

describe("la guarda de publicación", () => {
  it("deja publicar un examen completo y con los números buenos", () => {
    expect(motivosParaNoPublicar(examenCompleto())).toEqual([]);
  });

  it("no deja publicar si falta una tarea", () => {
    const tareas = examenCompleto().filter(
      (t) => !(t.prueba === "CO" && t.numero === 3),
    );
    const motivos = motivosParaNoPublicar(tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("CO");
    expect(motivos[0]).toContain("3");
  });

  it("no deja publicar si una tarea tiene los ítems que no son", () => {
    const tareas = examenCompleto().map((t) =>
      t.prueba === "CE" && t.numero === 4 ? { ...t, items: 6 } : t,
    );
    const motivos = motivosParaNoPublicar(tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("7");
    expect(motivos[0]).toContain("6");
  });

  it("no deja publicar un examen vacío, y da un motivo por cada tarea que falta", () => {
    expect(motivosParaNoPublicar([])).toHaveLength(14);
  });

  it("no deja publicar si sobra una tarea que el examen no tiene", () => {
    const tareas = [...examenCompleto(), { prueba: "CE" as const, numero: 5, items: 6 }];
    const motivos = motivosParaNoPublicar(tareas);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]).toContain("no existe");
  });

  it("da los motivos en español, para que los lea el profesor", () => {
    const motivos = motivosParaNoPublicar([]);
    expect(motivos[0]).toMatch(/falta/i);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/publicar.test.ts`
Expected: FAIL, «Failed to resolve import "@/lib/examen/publicar"».

- [ ] **Step 3: Escribir la implementación**

`lib/examen/publicar.ts`:

```ts
import type { Prueba } from "@/lib/generated/prisma";
import { ESTRUCTURA, reglaDe } from "@/lib/dele/estructura";

export type TareaParaRevisar = { prueba: Prueba; numero: number; items: number };

const NOMBRE: Record<Prueba, string> = {
  CE: "comprensión de lectura",
  CO: "comprensión auditiva",
  EE: "expresión escrita",
  EO: "expresión oral",
};

/**
 * Por qué este examen no se puede publicar todavía. Lista vacía = se puede.
 *
 * Es la red que caza los errores de la IA al transcribir: una tarea a la que le
 * falta un ítem, o que se coló dos veces, no llega nunca al estudiante.
 */
export function motivosParaNoPublicar(tareas: TareaParaRevisar[]): string[] {
  const motivos: string[] = [];
  const pruebas = Object.keys(ESTRUCTURA) as Prueba[];

  for (const prueba of pruebas) {
    for (const regla of ESTRUCTURA[prueba]) {
      const tarea = tareas.find((t) => t.prueba === prueba && t.numero === regla.numero);
      if (!tarea) {
        motivos.push(`Falta la tarea ${regla.numero} de ${NOMBRE[prueba]} (${prueba}).`);
        continue;
      }
      if (regla.items !== null && tarea.items !== regla.items) {
        motivos.push(
          `La tarea ${regla.numero} de ${NOMBRE[prueba]} tiene que llevar ${regla.items} ítems y lleva ${tarea.items}.`,
        );
      }
    }
  }

  for (const tarea of tareas) {
    if (reglaDe(tarea.prueba, tarea.numero) === null) {
      motivos.push(
        `La tarea ${tarea.numero} de ${NOMBRE[tarea.prueba]} no existe en este examen.`,
      );
    }
  }

  return motivos;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/publicar.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Comprobar las mutaciones, una a una**

Esta es la guarda que protege al estudiante, así que se comprueba entera:

1. Hacer que `motivosParaNoPublicar` devuelva siempre `[]` → tienen que morir cinco de las seis pruebas.
2. Quitar el bucle de las tareas que sobran → muere la quinta.
3. Cambiar `tarea.items !== regla.items` por `tarea.items < regla.items` → muere la tercera.
4. Saltarse la prueba `EO` en el recorrido → muere la cuarta, que cuenta 14 motivos.

Deshacer las cuatro.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Un examen que no cuadra con sus números no se puede publicar"
```

---

### Task 5: Lo que se le manda al estudiante, sin claves

**Files:**
- Create: `lib/examen/paraElEstudiante.ts`
- Test: `tests/paraElEstudiante.test.ts`

**Interfaces:**
- Consumes: los tipos de la tarea 2.
- Produces:
  - `type ActividadPublica = { id: string; tipo: TipoActividad; datos: unknown }`
  - `function actividadParaElEstudiante(a: { id: string; tipo: TipoActividad; datos: unknown; clave?: unknown }): ActividadPublica`

- [ ] **Step 1: Escribir la prueba, antes que el código**

`tests/paraElEstudiante.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { actividadParaElEstudiante } from "@/lib/examen/paraElEstudiante";

const conClave = {
  id: "act1",
  tipo: "OPCION" as const,
  datos: { preguntas: [{ id: "p1", enunciado: "¿Quién no trabaja todavía?" }] },
  clave: { id: "c1", respuestas: { p1: "B" } },
};

describe("lo que se le manda al estudiante", () => {
  it("conserva el enunciado y las opciones", () => {
    const publica = actividadParaElEstudiante(conClave);
    expect(publica.id).toBe("act1");
    expect(publica.tipo).toBe("OPCION");
    expect(publica.datos).toEqual(conClave.datos);
  });

  it("no lleva la clave por ningún lado", () => {
    const publica = actividadParaElEstudiante(conClave);
    expect("clave" in publica).toBe(false);
    expect(JSON.stringify(publica)).not.toContain("respuestas");
    expect(JSON.stringify(publica)).not.toContain("\"B\"");
  });

  it("funciona igual cuando la actividad todavía no tiene clave", () => {
    const sinClave = { id: "act2", tipo: "REDACCION" as const, datos: { minimo: 60 } };
    const publica = actividadParaElEstudiante(sinClave);
    expect(publica.datos).toEqual({ minimo: 60 });
    expect("clave" in publica).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/paraElEstudiante.test.ts`
Expected: FAIL, «Failed to resolve import».

- [ ] **Step 3: Escribir la implementación**

`lib/examen/paraElEstudiante.ts`:

```ts
import type { TipoActividad } from "@/lib/generated/prisma";

export type ActividadPublica = { id: string; tipo: TipoActividad; datos: unknown };

/**
 * La única puerta por la que una actividad sale hacia el navegador del
 * estudiante. Construye un objeto nuevo campo a campo en vez de borrar la
 * clave de uno existente: así, si mañana la actividad gana un campo nuevo con
 * información sensible, no se cuela solo por haberse añadido al modelo.
 */
export function actividadParaElEstudiante(actividad: {
  id: string;
  tipo: TipoActividad;
  datos: unknown;
  clave?: unknown;
}): ActividadPublica {
  return { id: actividad.id, tipo: actividad.tipo, datos: actividad.datos };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/paraElEstudiante.test.ts`
Expected: `3 passed`.

*Mutación que debe matarla:* cambiar el cuerpo por `const { clave, ...resto } = actividad; return resto as ActividadPublica;` y añadir al objeto de prueba un campo `solucionario: "B"`. La segunda prueba sigue pasando y no debería: eso demuestra por qué se construye campo a campo. Añadir esa comprobación:

```ts
  it("no deja pasar un campo nuevo que nadie previó", () => {
    const conExtra = { ...conClave, solucionario: "B" } as never;
    const publica = actividadParaElEstudiante(conExtra);
    expect(Object.keys(publica).sort()).toEqual(["datos", "id", "tipo"]);
  });
```

Volver a correr: `4 passed`.

- [ ] **Step 5: Correr la suite entera**

Run: `npm test`
Expected: `22 passed` en cinco ficheros (1 de humo, 4 del modelo, 7 de la estructura, 6 de la publicación y 4 de la puerta al estudiante). Comprobar que el recuento no es cero y que los cinco ficheros aparecen.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "La única puerta por la que una actividad sale hacia el estudiante"
```

---

## Lo que este plan NO hace

Para que nadie lo dé por hecho: aquí no hay puerta de entrada, ni pantallas, ni
taller, ni almacén de ficheros, ni biblioteca, ni opiniones. Cada uno de esos es
su propio plan, y todos dependen de este. El orden está en la sección 12 de la
spec.
