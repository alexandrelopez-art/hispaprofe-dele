# La puerta y el almacén · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las trece personas puedan entrar al sitio con un enlace que les llega
al correo, y que un fichero grande pueda subirse y verse sin pasar por nuestro
servidor.

**Architecture:** Las reglas de la entrada (caducidad, un solo uso, freno al abuso)
son funciones puras que reciben la hora como argumento y no tocan la base. Encima de
ellas hay una capa fina que lee y escribe en Postgres, y encima las pantallas. Los
ficheros no atraviesan nunca el servidor: el navegador recibe un permiso de subida
con fecha de caducidad y habla directo con el almacén. Hay dos almacenes por una
razón de coste, no de gusto: las grabaciones van a una unidad compartida de Drive y
el material de los exámenes al almacén privado de Vercel.

**Tech Stack:** Next.js 16.2.6, React 19.2.4, TypeScript 5, Prisma 7.10 con Postgres,
Tailwind 4, Zod 4, Vitest 3. Se añaden `nodemailer`, `@vercel/blob` (2.4 o superior,
que es donde aparecen los enlaces firmados) y `google-auth-library`.

**Spec:** `docs/superpowers/specs/2026-09-10-la-puerta-y-el-almacen-design.md`

## Global Constraints

- **Todo el texto de cara al usuario, en español**, incluidos los mensajes de error.
- **Nada de jerga en nombres visibles ni en rutas.** Aquí se llaman `Persona`,
  `EnlaceDeEntrada`, `Sesion`, `Fichero`.
- **Cada prueba escrita declara qué mutación la mataría, y se comprueba.** Sin la
  mutación comprobada, la prueba no cuenta como verificada.
- **Antes de leer un resultado de pruebas, comprobar que el número recogido no es
  cero.** Cero pruebas recogidas se lee como «ningún fallo» y no lo es.
- **Ninguna función que dependa del tiempo puede llamar a `new Date()` por dentro.**
  La hora entra siempre como argumento. Una prueba que dependa del reloj real se pone
  roja de madrugada y nadie sabe por qué.
- **Ningún secreto se guarda en claro:** ni el del enlace de entrada, ni el de la
  cookie de sesión.
- **La respuesta de `/entrar` es idéntica** exista el correo o no exista.
- **Ningún fichero es público** y ningún enlace de lectura dura más de cinco minutos.
- Paleta y tipografía de la casa: azul `#04a1f1` / `#0b8ad1` / `#0f6fa8`, fondo
  `#f4f9fc`, tinta `#143a4f`, tinta suave `#5a7a8c`, tarjetas de 16 px de radio,
  tipografía Nunito.

---

## File Structure

| Fichero | Responsabilidad |
|---|---|
| `scripts/postgres-de-pruebas.sh` | Levanta un Postgres de usar y tirar, aplica las migraciones y corre las pruebas que necesitan base |
| `vitest.base.config.ts` | Configuración de las pruebas contra base de datos |
| `prisma/schema.prisma` | Se le añaden `Persona`, `EnlaceDeEntrada`, `Sesion`, `Fichero` |
| `lib/puerta/secretos.ts` | Crear y comprobar secretos sin guardarlos en claro |
| `lib/puerta/reglas.ts` | Caducidad, un solo uso y freno al abuso. Funciones puras |
| `lib/puerta/entrada.ts` | Las mismas reglas, ya contra la base |
| `lib/puerta/sesion-http.ts` | Poner, leer y borrar la cookie |
| `lib/puerta/rutas.ts` | Qué ruta exige sesión y cuál no |
| `lib/correo/mensaje.ts` | El asunto y el cuerpo del correo de entrada |
| `lib/correo/transporte.ts` | El envío real por el SMTP de Gmail |
| `lib/ficheros/vercel.ts` | Permisos de subida y de lectura del almacén privado |
| `lib/ficheros/drive.ts` | Sesión de subida en la unidad compartida |
| `proxy.ts` | El guardián: sin cookie no se pasa |
| `app/entrar/*`, `app/salir/*` | Las pantallas de entrar y salir |
| `app/personas/*` | La lista de personas y el alta, solo para el profesor |
| `app/pruebas/*` | Las dos pantallas mínimas de subida, que se tiran con el taller |
| `tests/*.test.ts` | Pruebas que no necesitan base |
| `tests/base/*.test.ts` | Pruebas contra Postgres de verdad |

---

### Task 1: Un Postgres de verdad para las pruebas

Sin esto, todo lo que sigue se probaría contra un doble, y un doble de una base de
datos no caza ni una clave ajena ni una restricción de unicidad. El plan entero se
apoya en esta tarea.

**Files:**
- Create: `scripts/postgres-de-pruebas.sh`
- Create: `vitest.base.config.ts`
- Create: `tests/base/cimientos.test.ts`
- Modify: `package.json` (scripts), `vitest.config.ts` (excluir `tests/base`), `.gitignore`

**Interfaces:**
- Produces: `npm run test:base` deja una base con todas las migraciones aplicadas y
  corre `tests/base/**`. Las pruebas leen `process.env.DATABASE_URL`.

- [ ] **Step 1: Escribir la prueba que falla**

`tests/base/cimientos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("la base de pruebas", () => {
  it("tiene las tablas de los cimientos", async () => {
    const filas = await prisma.$queryRaw<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public' order by tablename
    `;
    const nombres = filas.map((f) => f.tablename);
    expect(nombres).toContain("Examen");
    expect(nombres).toContain("Tarea");
    expect(nombres).toContain("Pieza");
    expect(nombres).toContain("Actividad");
    expect(nombres).toContain("Clave");
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npm run test:base`
Expected: FAIL, porque el script no existe todavía (`npm error Missing script`).

- [ ] **Step 3: Escribir el script y la configuración**

`scripts/postgres-de-pruebas.sh`:

```bash
#!/usr/bin/env bash
# Levanta un Postgres de usar y tirar, aplica las migraciones y corre las pruebas
# que necesitan base. Al terminar lo para y borra los datos.
set -euo pipefail

PUERTO=55432
DATOS="$(pwd)/.tmp/pg"
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

if ! command -v initdb >/dev/null; then
  echo "Falta Postgres. Instálalo con: brew install postgresql@17" >&2
  exit 1
fi

limpiar() {
  pg_ctl -D "$DATOS" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATOS"
}
trap limpiar EXIT

rm -rf "$DATOS"
initdb -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DATOS" -o "-p $PUERTO -k $DATOS" -l "$DATOS/servidor.log" start >/dev/null
for _ in $(seq 1 20); do
  psql -h 127.0.0.1 -p "$PUERTO" -U postgres -c "select 1" >/dev/null 2>&1 && break
  sleep 0.5
done
psql -h 127.0.0.1 -p "$PUERTO" -U postgres -c "create database pruebas" >/dev/null

export DATABASE_URL="postgresql://postgres@127.0.0.1:$PUERTO/pruebas"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate deploy
npx vitest run --config vitest.base.config.ts "$@"
```

`vitest.base.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { include: ["tests/base/**/*.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
```

En `vitest.config.ts`, dejar fuera las que necesitan base:

```ts
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/base/**"] },
```

En `package.json`, añadir el script:

```json
    "test:base": "bash scripts/postgres-de-pruebas.sh",
```

Y en `.gitignore`, añadir una línea con `.tmp/`.

- [ ] **Step 4: Correrla y ver que pasa**

Run: `chmod +x scripts/postgres-de-pruebas.sh && npm run test:base`
Expected: PASS, 1 prueba. **Comprobar que el número recogido es 1 y no 0.**

Mutación que la mata: cambiar `prisma migrate deploy` por `true` en el script. Sin
migraciones no hay tablas y la prueba tiene que ponerse roja.

- [ ] **Step 5: Comprobar que `npm test` sigue verde y no arrastra las de base**

Run: `npm test`
Expected: PASS, 24 pruebas, ninguna de `tests/base`.

- [ ] **Step 6: Commit**

```bash
git add scripts vitest.base.config.ts vitest.config.ts tests/base package.json .gitignore
git commit -m "Un Postgres de usar y tirar para probar contra una base de verdad"
```

---

### Task 2: El modelo de la puerta y de los ficheros

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<fecha>_puerta_y_ficheros/migration.sql` (la genera Prisma)
- Create: `tests/base/modelo-puerta.test.ts`

**Interfaces:**
- Produces: modelos `Persona`, `EnlaceDeEntrada`, `Sesion`, `Fichero`; enums `Papel`
  (`PROFESOR` | `ESTUDIANTE`) y `Almacen` (`VERCEL` | `DRIVE`). `Pieza.ficheroId`
  pasa a ser clave ajena a `Fichero`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/base/modelo-puerta.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

const CORREO = "prueba@hispaprofe.com";

beforeEach(async () => {
  // El orden importa: una pieza sujeta a su fichero con Restrict, así que primero
  // se va el examen (que se lleva tareas y piezas en cascada) y después el fichero.
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.fichero.deleteMany();
});

describe("el modelo de la puerta", () => {
  it("no admite dos personas con el mismo correo", async () => {
    await prisma.persona.create({ data: { correo: CORREO, nombre: "Ana", papel: "ESTUDIANTE" } });
    await expect(
      prisma.persona.create({ data: { correo: CORREO, nombre: "Otra", papel: "ESTUDIANTE" } }),
    ).rejects.toThrow();
  });

  it("borrar a una persona se lleva sus enlaces y sus sesiones", async () => {
    const persona = await prisma.persona.create({
      data: { correo: CORREO, nombre: "Ana", papel: "ESTUDIANTE" },
    });
    await prisma.enlaceDeEntrada.create({
      data: { personaId: persona.id, secretoHuella: "a".repeat(64), expiraEn: new Date() },
    });
    await prisma.sesion.create({
      data: { personaId: persona.id, cookieHuella: "b".repeat(64), expiraEn: new Date() },
    });

    await prisma.persona.delete({ where: { id: persona.id } });

    expect(await prisma.enlaceDeEntrada.count()).toBe(0);
    expect(await prisma.sesion.count()).toBe(0);
  });

  it("no deja borrar un fichero que una pieza está usando", async () => {
    const fichero = await prisma.fichero.create({
      data: { almacen: "VERCEL", ruta: "examenes/1/pagina-1.jpg", tipoMime: "image/jpeg", bytes: 10 },
    });
    const examen = await prisma.examen.create({
      data: { titulo: "Modelo 0", nivel: "A2" },
    });
    const tarea = await prisma.tarea.create({
      data: { examenId: examen.id, prueba: "CE", numero: 1 },
    });
    await prisma.pieza.create({
      data: { tareaId: tarea.id, orden: 1, tipo: "IMAGEN", ficheroId: fichero.id },
    });

    await expect(prisma.fichero.delete({ where: { id: fichero.id } })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base`
Expected: FAIL, `prisma.persona` no existe.

- [ ] **Step 3: Escribir el modelo**

En `prisma/schema.prisma`, añadir al final:

```prisma
enum Papel {
  PROFESOR
  ESTUDIANTE
}

enum Almacen {
  VERCEL
  DRIVE
}

/// La lista blanca: si un correo no está aquí, no entra nadie. Nadie se registra solo.
model Persona {
  id        String   @id @default(cuid())
  correo    String   @unique
  nombre    String
  papel     Papel    @default(ESTUDIANTE)
  activa    Boolean  @default(true)
  createdAt DateTime @default(now())

  enlaces  EnlaceDeEntrada[]
  sesiones Sesion[]
  ficheros Fichero[]
}

/// El enlace que llega al correo. Del secreto se guarda solo la huella.
model EnlaceDeEntrada {
  id            String    @id @default(cuid())
  persona       Persona   @relation(fields: [personaId], references: [id], onDelete: Cascade)
  personaId     String
  secretoHuella String    @unique
  expiraEn      DateTime
  usadoEn       DateTime?
  createdAt     DateTime  @default(now())

  @@index([personaId, createdAt])
}

model Sesion {
  id           String   @id @default(cuid())
  persona      Persona  @relation(fields: [personaId], references: [id], onDelete: Cascade)
  personaId    String
  cookieHuella String   @unique
  expiraEn     DateTime
  ultimaVezEn  DateTime @default(now())
  createdAt    DateTime @default(now())

  @@index([personaId])
}

/// Dónde está un fichero, nunca el fichero. La base no guarda bytes.
model Fichero {
  id            String   @id @default(cuid())
  almacen       Almacen
  ruta          String
  nombreOriginal String?
  tipoMime      String
  bytes         Int
  subidoPor     Persona? @relation(fields: [subidoPorId], references: [id], onDelete: SetNull)
  subidoPorId   String?
  createdAt     DateTime @default(now())

  piezas Pieza[]

  @@unique([almacen, ruta])
}
```

Y en el modelo `Pieza`, sustituir la línea del comentario y el campo suelto por la
relación (el campo `ficheroId` ya existe y se queda con el mismo nombre):

```prisma
  /// Para IMAGEN, AUDIO y VIDEO. En las demás va a null.
  fichero   Fichero? @relation(fields: [ficheroId], references: [id], onDelete: Restrict)
  ficheroId String?
```

- [ ] **Step 4: Generar la migración y correr las pruebas**

```bash
DIRECT_URL="postgresql://postgres@127.0.0.1:55432/pruebas" \
  npx prisma migrate dev --name puerta_y_ficheros --create-only
```

Si el cluster de pruebas no está levantado, generarla en seco no vale: levantarlo con
el script de la Tarea 1 en otra terminal, o correr `npm run test:base`, que aplica lo
que haya en `prisma/migrations`.

Run: `npm run test:base`
Expected: PASS, 4 pruebas (la de cimientos y las tres nuevas).

Mutaciones que las matan: quitar `@unique` de `correo` mata la primera; cambiar
`onDelete: Cascade` por `SetNull` en `Sesion` mata la segunda; cambiar
`onDelete: Restrict` por `SetNull` en `Pieza.fichero` mata la tercera. **Comprobar
las tres, una a una.**

- [ ] **Step 5: Commit**

```bash
git add prisma tests/base
git commit -m "El modelo de la puerta: personas, enlaces, sesiones y ficheros"
```

---

### Task 3: Las reglas de la entrada, sin base y sin reloj

**Files:**
- Create: `lib/puerta/secretos.ts`, `lib/puerta/reglas.ts`
- Create: `tests/puerta-secretos.test.ts`, `tests/puerta-reglas.test.ts`

**Interfaces:**
- Produces:
  - `crearSecreto(): { secreto: string; huella: string }`
  - `huellaDe(secreto: string): string`
  - `MINUTOS_DE_ENLACE = 15`, `DIAS_DE_SESION = 30`, `PETICIONES_MAX = 5`, `MINUTOS_DE_VENTANA = 15`
  - `motivoParaRechazar(enlace: { expiraEn: Date; usadoEn: Date | null }, ahora: Date): "caducado" | "usado" | null`
  - `sesionCaducada(sesion: { expiraEn: Date }, ahora: Date): boolean`
  - `hayQueFrenar(peticiones: Date[], ahora: Date): boolean`
  - `caducidadDelEnlace(ahora: Date): Date`, `caducidadDeLaSesion(ahora: Date): Date`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/puerta-secretos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearSecreto, huellaDe } from "@/lib/puerta/secretos";

describe("los secretos", () => {
  it("nunca da dos veces el mismo", () => {
    const vistos = new Set(Array.from({ length: 200 }, () => crearSecreto().secreto));
    expect(vistos.size).toBe(200);
  });

  it("la huella no contiene el secreto", () => {
    const { secreto, huella } = crearSecreto();
    expect(huella).not.toContain(secreto);
    expect(huella).toHaveLength(64);
  });

  it("la huella del mismo secreto siempre es la misma", () => {
    const { secreto, huella } = crearSecreto();
    expect(huellaDe(secreto)).toBe(huella);
  });
});
```

`tests/puerta-reglas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  motivoParaRechazar,
  sesionCaducada,
  hayQueFrenar,
  caducidadDelEnlace,
} from "@/lib/puerta/reglas";

const AHORA = new Date("2026-09-10T12:00:00Z");
const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);

describe("las reglas de la entrada", () => {
  it("acepta un enlace vivo y sin usar", () => {
    expect(motivoParaRechazar({ expiraEn: minutos(5), usadoEn: null }, AHORA)).toBeNull();
  });

  it("rechaza un enlace caducado", () => {
    expect(motivoParaRechazar({ expiraEn: minutos(-1), usadoEn: null }, AHORA)).toBe("caducado");
  });

  it("rechaza un enlace ya usado, aunque siga vivo", () => {
    expect(motivoParaRechazar({ expiraEn: minutos(5), usadoEn: minutos(-2) }, AHORA)).toBe("usado");
  });

  it("el enlace caduca a los quince minutos", () => {
    expect(caducidadDelEnlace(AHORA).toISOString()).toBe(minutos(15).toISOString());
  });

  it("una sesión caducada no vale", () => {
    expect(sesionCaducada({ expiraEn: minutos(-1) }, AHORA)).toBe(true);
    expect(sesionCaducada({ expiraEn: minutos(1) }, AHORA)).toBe(false);
  });

  it("frena a la sexta petición dentro de la ventana", () => {
    const cinco = [1, 2, 3, 4, 5].map((n) => minutos(-n));
    expect(hayQueFrenar(cinco, AHORA)).toBe(true);
    expect(hayQueFrenar(cinco.slice(1), AHORA)).toBe(false);
  });

  it("no cuenta las peticiones de fuera de la ventana", () => {
    const viejas = [16, 17, 18, 19, 20].map((n) => minutos(-n));
    expect(hayQueFrenar(viejas, AHORA)).toBe(false);
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/puerta-secretos.test.ts tests/puerta-reglas.test.ts`
Expected: FAIL, no existen los módulos.

- [ ] **Step 3: Escribir las dos piezas**

`lib/puerta/secretos.ts`:

```ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** El secreto viaja en el enlace; de él solo se guarda la huella, como una contraseña. */
export function crearSecreto(): { secreto: string; huella: string } {
  const secreto = randomBytes(32).toString("base64url");
  return { secreto, huella: huellaDe(secreto) };
}

export function huellaDe(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex");
}

/** Comparación en tiempo constante, para no filtrar el secreto por lo que tarda. */
export function huellasIguales(a: string, b: string): boolean {
  const uno = Buffer.from(a, "utf8");
  const otro = Buffer.from(b, "utf8");
  return uno.length === otro.length && timingSafeEqual(uno, otro);
}
```

`lib/puerta/reglas.ts`:

```ts
export const MINUTOS_DE_ENLACE = 15;
export const DIAS_DE_SESION = 30;
export const PETICIONES_MAX = 5;
export const MINUTOS_DE_VENTANA = 15;

const MINUTO = 60_000;

export function caducidadDelEnlace(ahora: Date): Date {
  return new Date(ahora.getTime() + MINUTOS_DE_ENLACE * MINUTO);
}

export function caducidadDeLaSesion(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_DE_SESION * 24 * 60 * MINUTO);
}

export type MotivoDeRechazo = "caducado" | "usado";

/** Por qué este enlace no sirve. null = sirve. */
export function motivoParaRechazar(
  enlace: { expiraEn: Date; usadoEn: Date | null },
  ahora: Date,
): MotivoDeRechazo | null {
  if (enlace.usadoEn !== null) return "usado";
  if (enlace.expiraEn.getTime() <= ahora.getTime()) return "caducado";
  return null;
}

export function sesionCaducada(sesion: { expiraEn: Date }, ahora: Date): boolean {
  return sesion.expiraEn.getTime() <= ahora.getTime();
}

/** Cinco peticiones en un cuarto de hora es el tope; la sexta se frena. */
export function hayQueFrenar(peticiones: Date[], ahora: Date): boolean {
  const desde = ahora.getTime() - MINUTOS_DE_VENTANA * MINUTO;
  return peticiones.filter((p) => p.getTime() > desde).length >= PETICIONES_MAX;
}
```

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npm test`
Expected: PASS, 34 pruebas. **Comprobar que el número no es cero.**

Mutaciones que las matan: en `motivoParaRechazar`, invertir el orden de las dos
comprobaciones no mata ninguna, así que añadir la prueba del enlace usado Y caducado
si el orden importase; cambiar `<=` por `<` en `sesionCaducada` mata la prueba del
borde; cambiar `>=` por `>` en `hayQueFrenar` mata la de la sexta petición.
**Comprobar las dos últimas.**

- [ ] **Step 5: Commit**

```bash
git add lib/puerta tests/puerta-*.test.ts
git commit -m "Las reglas de la entrada: caducar, gastarse y frenar"
```

---

### Task 4: El correo de entrada

**Files:**
- Create: `lib/correo/mensaje.ts`, `lib/correo/transporte.ts`
- Create: `tests/correo-mensaje.test.ts`
- Modify: `package.json` (dependencia `nodemailer`), `.env.example`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `type Mensaje = { a: string; asunto: string; texto: string; html: string }`
  - `mensajeDeEntrada(a: string, url: string): Mensaje`
  - `type Mandar = (mensaje: Mensaje) => Promise<void>`
  - `mandarPorSmtp: Mandar` (lee `CORREO_USUARIO`, `CORREO_CONTRASENA`, `CORREO_REMITENTE`)

- [ ] **Step 1: Escribir la prueba que falla**

`tests/correo-mensaje.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mensajeDeEntrada } from "@/lib/correo/mensaje";

const URL_DE_ENTRADA = "https://hispaprofe.com/entrar/abc123";

describe("el correo de entrada", () => {
  it("lleva el enlace entero, en el texto y en el html", () => {
    const mensaje = mensajeDeEntrada("ana@ejemplo.com", URL_DE_ENTRADA);
    expect(mensaje.texto).toContain(URL_DE_ENTRADA);
    expect(mensaje.html).toContain(URL_DE_ENTRADA);
  });

  it("dice cuánto dura, porque quince minutos sorprenden a cualquiera", () => {
    const mensaje = mensajeDeEntrada("ana@ejemplo.com", URL_DE_ENTRADA);
    expect(mensaje.texto).toContain("quince minutos");
  });

  it("va dirigido a quien lo pidió y en español", () => {
    const mensaje = mensajeDeEntrada("ana@ejemplo.com", URL_DE_ENTRADA);
    expect(mensaje.a).toBe("ana@ejemplo.com");
    expect(mensaje.asunto).toBe("Tu entrada a HispaProfe");
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/correo-mensaje.test.ts`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Escribir el mensaje y el transporte**

```bash
npm install nodemailer && npm install -D @types/nodemailer
```

`lib/correo/mensaje.ts`:

```ts
export type Mensaje = { a: string; asunto: string; texto: string; html: string };
export type Mandar = (mensaje: Mensaje) => Promise<void>;

export function mensajeDeEntrada(a: string, url: string): Mensaje {
  const texto = [
    "Hola,",
    "",
    "Pulsa este enlace para entrar en HispaProfe:",
    url,
    "",
    "El enlace vale quince minutos y una sola vez. Si caduca, pide otro.",
    "Si no has sido tú, no hagas nada: sin pulsar el enlace no entra nadie.",
  ].join("\n");

  const html = `<p>Hola,</p>
<p><a href="${url}">Entrar en HispaProfe</a></p>
<p>El enlace vale quince minutos y una sola vez. Si caduca, pide otro.</p>
<p>Si no has sido tú, no hagas nada: sin pulsar el enlace no entra nadie.</p>
<p style="color:#5a7a8c;font-size:12px">${url}</p>`;

  return { a, asunto: "Tu entrada a HispaProfe", texto, html };
}
```

`lib/correo/transporte.ts`:

```ts
import nodemailer from "nodemailer";
import type { Mandar } from "@/lib/correo/mensaje";

function exigir(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Sin ella no se pueden mandar los ` +
        "enlaces de entrada y nadie puede entrar al sitio.",
    );
  }
  return valor;
}

/**
 * Manda por el SMTP de Gmail de ips@ips-hyl.com, poniendo como remitente el alias
 * contacto@hispaprofe.com. El alias tiene que estar dado de alta en «Enviar como»
 * de esa cuenta, y la contraseña es una de aplicación, distinta de la de la clínica.
 */
export const mandarPorSmtp: Mandar = async (mensaje) => {
  const transporte = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: exigir("CORREO_USUARIO"), pass: exigir("CORREO_CONTRASENA") },
  });
  await transporte.sendMail({
    from: `HispaProfe <${exigir("CORREO_REMITENTE")}>`,
    to: mensaje.a,
    subject: mensaje.asunto,
    text: mensaje.texto,
    html: mensaje.html,
  });
};
```

En `.env.example`, añadir:

```
# El correo que manda los enlaces de entrada.
CORREO_USUARIO="ips@ips-hyl.com"
CORREO_CONTRASENA="contraseña de aplicación, distinta de la de la clínica"
CORREO_REMITENTE="contacto@hispaprofe.com"
```

- [ ] **Step 4: Correrla y ver que pasa**

Run: `npm test`
Expected: PASS, 37 pruebas.

Mutación que las mata: quitar la línea del enlace del texto. La primera prueba tiene
que ponerse roja. **Comprobarlo.**

- [ ] **Step 5: Commit**

```bash
git add lib/correo tests/correo-mensaje.test.ts package.json package-lock.json .env.example
git commit -m "El correo que lleva el enlace de entrada"
```

---

### Task 5: La entrada contra la base

**Files:**
- Create: `lib/puerta/entrada.ts`
- Create: `tests/base/entrada.test.ts`

**Interfaces:**
- Consumes: `crearSecreto`, `huellaDe` (Tarea 3); `motivoParaRechazar`,
  `caducidadDelEnlace`, `caducidadDeLaSesion`, `hayQueFrenar`, `sesionCaducada`
  (Tarea 3); `Mandar`, `mensajeDeEntrada` (Tarea 4).
- Produces:
  - `pedirEnlace(correo: string, ahora: Date, mandar: Mandar, base: string): Promise<void>`
  - `usarEnlace(secreto: string, ahora: Date): Promise<{ cookie: string } | { error: MotivoDeRechazo | "desconocido" }>`
  - `personaDeLaCookie(cookie: string, ahora: Date): Promise<Persona | null>`
  - `cerrarSesion(cookie: string): Promise<void>`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/base/entrada.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { pedirEnlace, usarEnlace, personaDeLaCookie, cerrarSesion } from "@/lib/puerta/entrada";
import type { Mensaje } from "@/lib/correo/mensaje";

const AHORA = new Date("2026-09-10T12:00:00Z");
const minutos = (n: number) => new Date(AHORA.getTime() + n * 60_000);
const BASE = "https://hispaprofe.com";

let buzon: Mensaje[] = [];
const mandar = async (mensaje: Mensaje) => {
  buzon.push(mensaje);
};
const secretoDelUltimo = () => buzon.at(-1)!.texto.split(`${BASE}/entrar/`)[1].split("\n")[0];

beforeEach(async () => {
  buzon = [];
  await prisma.persona.deleteMany();
  await prisma.persona.create({
    data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" },
  });
});

describe("pedir un enlace", () => {
  it("manda un correo con un enlace que sirve", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(1);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    expect(resultado).toHaveProperty("cookie");
  });

  it("con un correo que no existe no manda nada y no deja rastro", async () => {
    await pedirEnlace("nadie@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(0);
    expect(await prisma.enlaceDeEntrada.count()).toBe(0);
  });

  it("con una persona dada de baja no manda nada", async () => {
    await prisma.persona.update({ where: { correo: "ana@ejemplo.com" }, data: { activa: false } });
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(0);
  });

  it("no distingue mayúsculas ni espacios al final", async () => {
    await pedirEnlace("  Ana@Ejemplo.com ", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(1);
  });

  it("frena a la sexta petición seguida", async () => {
    for (let i = 0; i < 5; i++) await pedirEnlace("ana@ejemplo.com", minutos(-i), mandar, BASE);
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(buzon).toHaveLength(5);
  });
});

describe("usar un enlace", () => {
  it("no se puede usar dos veces", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const secreto = secretoDelUltimo();
    await usarEnlace(secreto, minutos(1));
    expect(await usarEnlace(secreto, minutos(2))).toEqual({ error: "usado" });
  });

  it("no vale pasados quince minutos", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    expect(await usarEnlace(secretoDelUltimo(), minutos(16))).toEqual({ error: "caducado" });
  });

  it("un secreto inventado no abre nada", async () => {
    expect(await usarEnlace("inventado", AHORA)).toEqual({ error: "desconocido" });
    expect(await prisma.sesion.count()).toBe(0);
  });
});

describe("la sesión", () => {
  it("reconoce a la persona mientras dura, y deja de hacerlo al caducar", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    const cookie = (resultado as { cookie: string }).cookie;

    expect((await personaDeLaCookie(cookie, minutos(2)))?.correo).toBe("ana@ejemplo.com");
    expect(await personaDeLaCookie(cookie, minutos(60 * 24 * 31))).toBeNull();
  });

  it("al salir, la cookie deja de valer y la fila desaparece", async () => {
    await pedirEnlace("ana@ejemplo.com", AHORA, mandar, BASE);
    const resultado = await usarEnlace(secretoDelUltimo(), minutos(1));
    const cookie = (resultado as { cookie: string }).cookie;

    await cerrarSesion(cookie);

    expect(await personaDeLaCookie(cookie, minutos(2))).toBeNull();
    expect(await prisma.sesion.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base`
Expected: FAIL, no existe `lib/puerta/entrada.ts`.

- [ ] **Step 3: Escribir la capa contra la base**

`lib/puerta/entrada.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Persona } from "@/lib/generated/prisma";
import { crearSecreto, huellaDe } from "@/lib/puerta/secretos";
import {
  caducidadDelEnlace,
  caducidadDeLaSesion,
  hayQueFrenar,
  motivoParaRechazar,
  sesionCaducada,
  type MotivoDeRechazo,
} from "@/lib/puerta/reglas";
import { mensajeDeEntrada, type Mandar } from "@/lib/correo/mensaje";

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/**
 * Pide un enlace de entrada. No devuelve nada a propósito: quien llama no puede
 * saber si el correo existe, y así la pantalla es idéntica en los dos casos.
 */
export async function pedirEnlace(
  correo: string,
  ahora: Date,
  mandar: Mandar,
  base: string,
): Promise<void> {
  const persona = await prisma.persona.findUnique({ where: { correo: normalizarCorreo(correo) } });
  if (!persona || !persona.activa) return;

  const recientes = await prisma.enlaceDeEntrada.findMany({
    where: { personaId: persona.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (hayQueFrenar(recientes.map((r) => r.createdAt), ahora)) return;

  const { secreto, huella } = crearSecreto();
  await prisma.enlaceDeEntrada.create({
    data: {
      personaId: persona.id,
      secretoHuella: huella,
      expiraEn: caducidadDelEnlace(ahora),
      createdAt: ahora,
    },
  });
  await mandar(mensajeDeEntrada(persona.correo, `${base}/entrar/${secreto}`));
}

export type ResultadoDeEntrada =
  | { cookie: string }
  | { error: MotivoDeRechazo | "desconocido" };

export async function usarEnlace(secreto: string, ahora: Date): Promise<ResultadoDeEntrada> {
  const enlace = await prisma.enlaceDeEntrada.findUnique({
    where: { secretoHuella: huellaDe(secreto) },
  });
  if (!enlace) return { error: "desconocido" };

  const motivo = motivoParaRechazar(enlace, ahora);
  if (motivo) return { error: motivo };

  await prisma.enlaceDeEntrada.update({ where: { id: enlace.id }, data: { usadoEn: ahora } });

  const cookie = crearSecreto();
  await prisma.sesion.create({
    data: {
      personaId: enlace.personaId,
      cookieHuella: cookie.huella,
      expiraEn: caducidadDeLaSesion(ahora),
      ultimaVezEn: ahora,
      createdAt: ahora,
    },
  });
  return { cookie: cookie.secreto };
}

export async function personaDeLaCookie(cookie: string, ahora: Date): Promise<Persona | null> {
  const sesion = await prisma.sesion.findUnique({
    where: { cookieHuella: huellaDe(cookie) },
    include: { persona: true },
  });
  if (!sesion) return null;
  if (sesionCaducada(sesion, ahora)) return null;
  if (!sesion.persona.activa) return null;
  return sesion.persona;
}

export async function cerrarSesion(cookie: string): Promise<void> {
  await prisma.sesion.deleteMany({ where: { cookieHuella: huellaDe(cookie) } });
}
```

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npm run test:base`
Expected: PASS, 14 pruebas. **Comprobar que el número no es cero.**

Mutaciones que las matan: quitar la línea que marca `usadoEn` mata la del doble uso;
quitar la comprobación de `activa` mata la de la persona dada de baja; quitar el
`normalizarCorreo` mata la de las mayúsculas; quitar el freno mata la de la sexta
petición. **Comprobar las cuatro.**

- [ ] **Step 5: Commit**

```bash
git add lib/puerta/entrada.ts tests/base/entrada.test.ts
git commit -m "Pedir enlace, gastarlo una vez y abrir sesión"
```

---

### Task 6: El guardián y las pantallas de entrar y salir

**Files:**
- Create: `lib/puerta/rutas.ts`, `lib/puerta/sesion-http.ts`, `proxy.ts`
- Create: `app/entrar/page.tsx`, `app/entrar/acciones.ts`, `app/entrar/enviado/page.tsx`,
  `app/entrar/[secreto]/route.ts`, `app/salir/route.ts`
- Create: `tests/puerta-rutas.test.ts`

**Interfaces:**
- Consumes: `pedirEnlace`, `usarEnlace`, `cerrarSesion`, `personaDeLaCookie` (Tarea 5);
  `mandarPorSmtp` (Tarea 4).
- Produces:
  - `NOMBRE_DE_COOKIE = "hp_sesion"`
  - `exigeSesion(ruta: string): boolean`
  - `personaActual(): Promise<Persona | null>` (lee la cookie con `next/headers`)

En Next 16 el guardián se llama `proxy.ts`, no `middleware.ts`.

- [ ] **Step 1: Escribir la prueba que falla**

`tests/puerta-rutas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { exigeSesion } from "@/lib/puerta/rutas";

describe("qué rutas exigen sesión", () => {
  it("deja pasar la portada y todo lo de entrar", () => {
    expect(exigeSesion("/")).toBe(false);
    expect(exigeSesion("/entrar")).toBe(false);
    expect(exigeSesion("/entrar/abc123")).toBe(false);
    expect(exigeSesion("/entrar/enviado")).toBe(false);
  });

  it("cierra todo lo demás", () => {
    expect(exigeSesion("/personas")).toBe(true);
    expect(exigeSesion("/examenes")).toBe(true);
    expect(exigeSesion("/pruebas/subir")).toBe(true);
  });

  it("no se abre por parecerse: /entrarme no es /entrar", () => {
    expect(exigeSesion("/entrarme")).toBe(true);
    expect(exigeSesion("/entrar-por-detras")).toBe(true);
  });
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/puerta-rutas.test.ts`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Escribir el guardián y las pantallas**

`lib/puerta/rutas.ts`:

```ts
export const NOMBRE_DE_COOKIE = "hp_sesion";

const ABIERTAS = ["/", "/entrar"];

/** Todo está cerrado menos la portada y las pantallas de entrar. */
export function exigeSesion(ruta: string): boolean {
  return !ABIERTAS.some((abierta) => ruta === abierta || ruta.startsWith(`${abierta}/`));
}
```

`lib/puerta/sesion-http.ts`:

```ts
import { cookies } from "next/headers";
import type { Persona } from "@/lib/generated/prisma";
import { NOMBRE_DE_COOKIE } from "@/lib/puerta/rutas";
import { personaDeLaCookie } from "@/lib/puerta/entrada";
import { DIAS_DE_SESION } from "@/lib/puerta/reglas";

export async function personaActual(): Promise<Persona | null> {
  const cookie = (await cookies()).get(NOMBRE_DE_COOKIE)?.value;
  return cookie ? personaDeLaCookie(cookie, new Date()) : null;
}

export async function ponerCookie(valor: string): Promise<void> {
  (await cookies()).set(NOMBRE_DE_COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_DE_SESION * 24 * 60 * 60,
  });
}

export async function borrarCookie(): Promise<void> {
  (await cookies()).delete(NOMBRE_DE_COOKIE);
}
```

`proxy.ts` (en la raíz del proyecto):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { NOMBRE_DE_COOKIE, exigeSesion } from "@/lib/puerta/rutas";

export function proxy(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  if (!exigeSesion(ruta)) return NextResponse.next();
  if (request.cookies.has(NOMBRE_DE_COOKIE)) return NextResponse.next();

  const destino = new URL("/entrar", request.url);
  destino.searchParams.set("volver", ruta);
  return NextResponse.redirect(destino, 307);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

El guardián solo mira que haya cookie, no si vale: comprobar la sesión contra la base
en cada petición saldría caro y la pantalla lo comprueba igualmente con
`personaActual()`. Una cookie inventada pasa el guardián y se estrella contra la
pantalla, que la manda a `/entrar`.

`app/entrar/acciones.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { pedirEnlace } from "@/lib/puerta/entrada";
import { mandarPorSmtp } from "@/lib/correo/transporte";

export async function pedirEntrada(formulario: FormData): Promise<void> {
  const correo = String(formulario.get("correo") ?? "");
  const cabeceras = await headers();
  const base = process.env.SITIO_URL ?? `https://${cabeceras.get("host")}`;
  await pedirEnlace(correo, new Date(), mandarPorSmtp, base);
  redirect("/entrar/enviado");
}
```

`app/entrar/page.tsx`:

```tsx
import { pedirEntrada } from "./acciones";

const AVISOS: Record<string, string> = {
  caducado: "Ese enlace ya no vale. Pide otro y te lo mandamos.",
  usado: "Ese enlace ya se usó. Pide otro y te lo mandamos.",
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ fallo?: string; volver?: string }>;
}) {
  const { fallo, volver } = await searchParams;
  const aviso = fallo ? AVISOS[fallo] : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-tinta">Entrar en HispaProfe</h1>
      <p className="text-tinta-suave">
        Escribe tu correo y te mandamos un enlace para entrar. No hace falta contraseña.
      </p>
      {aviso && <p className="rounded-2xl bg-hp-50 p-4 text-tinta">{aviso}</p>}
      <form action={pedirEntrada} className="flex flex-col gap-4">
        <input type="hidden" name="volver" value={volver ?? ""} />
        <input
          type="email"
          name="correo"
          required
          autoComplete="email"
          placeholder="tu@correo.com"
          className="rounded-2xl border border-tinta-suave/30 p-4"
        />
        <button type="submit" className="rounded-2xl bg-hp-400 p-4 font-bold text-white">
          Mandarme el enlace
        </button>
      </form>
    </main>
  );
}
```

`app/entrar/enviado/page.tsx`:

```tsx
import Link from "next/link";

export default function Enviado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-bold text-tinta">Mira tu correo</h1>
      <p className="text-tinta-suave">
        Si esa dirección está dada de alta, te hemos mandado un enlace para entrar. Vale
        quince minutos y una sola vez.
      </p>
      <Link href="/entrar" className="font-bold text-hp-600">
        Pedir otro enlace
      </Link>
    </main>
  );
}
```

`app/entrar/[secreto]/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { usarEnlace } from "@/lib/puerta/entrada";
import { ponerCookie } from "@/lib/puerta/sesion-http";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ secreto: string }> },
) {
  const { secreto } = await params;
  const resultado = await usarEnlace(secreto, new Date());

  if ("error" in resultado) {
    const destino = new URL("/entrar", request.url);
    destino.searchParams.set("fallo", resultado.error === "desconocido" ? "caducado" : resultado.error);
    return NextResponse.redirect(destino, 307);
  }

  await ponerCookie(resultado.cookie);
  const volver = request.nextUrl.searchParams.get("volver");
  return NextResponse.redirect(new URL(volver ?? "/", request.url), 307);
}
```

Un enlace desconocido y uno caducado dan el mismo aviso a propósito: quien prueba
secretos a ciegas no aprende nada por la respuesta.

`app/salir/route.ts`: lee la cookie, llama a `cerrarSesion`, borra la cookie y manda
a `/entrar`.

En `/entrar`, si llega `?fallo=caducado` o `?fallo=usado`, mostrar el aviso
correspondiente encima del formulario: «Ese enlace ya no vale. Pide otro.»

- [ ] **Step 4: Correr las pruebas y el compilador**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS las 40 pruebas, `tsc` sin quejas y el build en verde.

Mutación que mata la prueba de rutas: cambiar el `startsWith` por `includes`. La
prueba de `/entrar-por-detras` tiene que ponerse roja. **Comprobarlo.**

- [ ] **Step 5: El paseo a mano, con el servidor levantado**

```bash
npm run dev
```

Comprobar, con el Postgres de pruebas levantado y una persona dada de alta a mano:
pedir el enlace, verlo en la consola si aún no hay correo configurado, pulsarlo,
llegar dentro, recargar y seguir dentro, salir y que `/personas` rebote a `/entrar`.

- [ ] **Step 6: Commit**

```bash
git add lib/puerta proxy.ts app/entrar app/salir tests/puerta-rutas.test.ts
git commit -m "El guardián y las pantallas de entrar y salir"
```

---

### Task 7: Las personas, y quién puede darlas de alta

**Files:**
- Create: `lib/puerta/personas.ts`, `app/personas/page.tsx`, `app/personas/acciones.ts`
- Create: `tests/base/personas.test.ts`

**Interfaces:**
- Consumes: `personaActual` (Tarea 6).
- Produces:
  - `darDeAlta(quien: Persona, datos: { correo: string; nombre: string; papel: Papel }): Promise<{ error: string } | { persona: Persona }>`
  - `listarPersonas(): Promise<Persona[]>`

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests/base/personas.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { darDeAlta } from "@/lib/puerta/personas";
import type { Persona } from "@/lib/generated/prisma";

let profesor: Persona;
let estudiante: Persona;

beforeEach(async () => {
  await prisma.persona.deleteMany();
  profesor = await prisma.persona.create({
    data: { correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR" },
  });
  estudiante = await prisma.persona.create({
    data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" },
  });
});

describe("dar de alta a una persona", () => {
  it("el profesor puede", async () => {
    const resultado = await darDeAlta(profesor, {
      correo: "Nuevo@Ejemplo.com",
      nombre: "Nuevo",
      papel: "ESTUDIANTE",
    });
    expect(resultado).toHaveProperty("persona");
    expect(await prisma.persona.count()).toBe(3);
  });

  it("guarda el correo en minúsculas, para que no entren dos veces la misma persona", async () => {
    await darDeAlta(profesor, { correo: "Nuevo@Ejemplo.com", nombre: "Nuevo", papel: "ESTUDIANTE" });
    expect(await prisma.persona.findUnique({ where: { correo: "nuevo@ejemplo.com" } })).not.toBeNull();
  });

  it("un estudiante no puede, y no crea nada", async () => {
    const resultado = await darDeAlta(estudiante, {
      correo: "otro@ejemplo.com",
      nombre: "Otro",
      papel: "ESTUDIANTE",
    });
    expect(resultado).toEqual({ error: "Solo el profesor puede dar de alta a alguien." });
    expect(await prisma.persona.count()).toBe(2);
  });

  it("no admite un correo repetido", async () => {
    const resultado = await darDeAlta(profesor, {
      correo: "ana@ejemplo.com",
      nombre: "Ana otra vez",
      papel: "ESTUDIANTE",
    });
    expect(resultado).toEqual({ error: "Ese correo ya está dado de alta." });
  });

  it("no admite un correo sin arroba", async () => {
    const resultado = await darDeAlta(profesor, { correo: "ana", nombre: "Ana", papel: "ESTUDIANTE" });
    expect(resultado).toEqual({ error: "Eso no parece una dirección de correo." });
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npm run test:base`
Expected: FAIL, no existe `lib/puerta/personas.ts`.

- [ ] **Step 3: Escribir la pieza y la pantalla**

`lib/puerta/personas.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Papel, Persona } from "@/lib/generated/prisma";
import { normalizarCorreo } from "@/lib/puerta/entrada";

export type Alta = { correo: string; nombre: string; papel: Papel };

export async function darDeAlta(
  quien: Persona,
  datos: Alta,
): Promise<{ persona: Persona } | { error: string }> {
  if (quien.papel !== "PROFESOR") {
    return { error: "Solo el profesor puede dar de alta a alguien." };
  }
  const correo = normalizarCorreo(datos.correo);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return { error: "Eso no parece una dirección de correo." };
  }
  if (await prisma.persona.findUnique({ where: { correo } })) {
    return { error: "Ese correo ya está dado de alta." };
  }
  const persona = await prisma.persona.create({
    data: { correo, nombre: datos.nombre.trim(), papel: datos.papel },
  });
  return { persona };
}

export function listarPersonas(): Promise<Persona[]> {
  return prisma.persona.findMany({ orderBy: [{ papel: "asc" }, { nombre: "asc" }] });
}
```

`app/personas/page.tsx`: si `personaActual()` no es profesor, `notFound()`. Si lo es,
la lista con nombre, correo y papel, y debajo el formulario de alta con los tres
campos. El error se enseña encima del formulario, con el texto tal cual lo devuelve
`darDeAlta`.

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npm run test:base && npx tsc --noEmit`
Expected: PASS, 19 pruebas contra base.

Mutaciones que las matan: quitar la comprobación del papel mata la del estudiante;
quitar `normalizarCorreo` mata la de las minúsculas. **Comprobar las dos.**

- [ ] **Step 5: Commit**

```bash
git add lib/puerta/personas.ts app/personas tests/base/personas.test.ts
git commit -m "La lista de personas y el alta, solo para el profesor"
```

---

### Task 8: El almacén privado de Vercel

**Files:**
- Create: `lib/ficheros/vercel.ts`, `app/api/ficheros/permiso/route.ts`,
  `app/api/ficheros/[id]/route.ts`, `app/pruebas/subir/page.tsx`
- Create: `tests/ficheros-vercel.test.ts`
- Modify: `package.json` (`@vercel/blob`), `.env.example`

**Interfaces:**
- Consumes: `personaActual` (Tarea 6).
- Produces:
  - `rutaDelFichero(carpeta: string, nombre: string, aleatorio: string): string`
  - `permisoDeSubida(ruta: string, tipos: string[], maxBytes: number, ahora: Date): Promise<{ url: string; validoHasta: Date }>`
  - `enlaceDeLectura(ruta: string, ahora: Date): Promise<string>`
  - `comprobarQueLlego(ruta: string): Promise<{ bytes: number; tipoMime: string } | null>`
  - `puedeSubirMaterial(papel: Papel): boolean`
  - `filaParaGuardar(datos, confirmado): { almacen: "VERCEL"; ruta: string; bytes: number; tipoMime: string; subidoPorId: string } | null`

- [ ] **Step 1: Escribir la prueba que falla**

Lo que se puede probar sin red es la ruta y las caducidades. La subida de verdad se
comprueba a mano en la Tarea 10.

`tests/ficheros-vercel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  rutaDelFichero,
  puedeSubirMaterial,
  filaParaGuardar,
  MINUTOS_DE_SUBIDA,
  MINUTOS_DE_LECTURA,
} from "@/lib/ficheros/vercel";

describe("las rutas del almacén", () => {
  it("cuelga el fichero de su carpeta y le pega un sufijo, para que dos iguales no choquen", () => {
    expect(rutaDelFichero("examenes/1", "pagina 1.JPG", "xyz")).toBe("examenes/1/pagina-1-xyz.jpg");
  });

  it("no deja escapar de su carpeta con puntos ni barras", () => {
    expect(rutaDelFichero("examenes/1", "../../secreto.jpg", "xyz")).toBe("examenes/1/secreto-xyz.jpg");
  });

  it("el permiso de lectura dura mucho menos que el de subida", () => {
    expect(MINUTOS_DE_LECTURA).toBeLessThan(MINUTOS_DE_SUBIDA);
    expect(MINUTOS_DE_LECTURA).toBeLessThanOrEqual(5);
  });
});

describe("quién puede subir material del examen", () => {
  it("el profesor sí, el estudiante no", () => {
    expect(puedeSubirMaterial("PROFESOR")).toBe(true);
    expect(puedeSubirMaterial("ESTUDIANTE")).toBe(false);
  });
});

describe("lo que se guarda después de subir", () => {
  it("sin confirmación del almacén no se guarda ninguna fila", () => {
    expect(filaParaGuardar({ ruta: "examenes/1/a-x.jpg", subidoPorId: "p1" }, null)).toBeNull();
  });

  it("se fía del almacén, no de lo que diga el navegador", () => {
    const fila = filaParaGuardar(
      { ruta: "examenes/1/a-x.jpg", subidoPorId: "p1", bytesSegunElNavegador: 10 },
      { bytes: 4_812_345, tipoMime: "image/jpeg" },
    );
    expect(fila).toEqual({
      almacen: "VERCEL",
      ruta: "examenes/1/a-x.jpg",
      bytes: 4_812_345,
      tipoMime: "image/jpeg",
      subidoPorId: "p1",
    });
  });
});
```

La segunda es la trampa que importa: un navegador puede decir que subió un fichero de
diez bytes y haber subido otra cosa. Los números salen siempre de la respuesta del
almacén.

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/ficheros-vercel.test.ts`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Escribir la pieza**

```bash
npm install @vercel/blob
```

`lib/ficheros/vercel.ts`:

```ts
import { head, issueSignedToken, presignUrl } from "@vercel/blob";

export const MINUTOS_DE_SUBIDA = 15;
export const MINUTOS_DE_LECTURA = 5;

const MINUTO = 60_000;

/** Un nombre de fichero limpio, dentro de su carpeta y sin forma de salirse de ella. */
export function rutaDelFichero(carpeta: string, nombre: string, aleatorio: string): string {
  const punto = nombre.lastIndexOf(".");
  const extension = punto > 0 ? nombre.slice(punto + 1).toLowerCase() : "bin";
  const base = (punto > 0 ? nombre.slice(0, punto) : nombre)
    .split(/[\\/]/)
    .pop()!
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${carpeta}/${base}-${aleatorio}.${extension}`;
}

export async function permisoDeSubida(
  ruta: string,
  tipos: string[],
  maxBytes: number,
  ahora: Date,
): Promise<{ url: string; validoHasta: Date }> {
  const validoHasta = new Date(ahora.getTime() + MINUTOS_DE_SUBIDA * MINUTO);
  const { clientSigningToken } = await issueSignedToken({
    pathname: ruta,
    operations: ["put"],
    validUntil: validoHasta,
    allowedContentTypes: tipos,
    maximumSizeInBytes: maxBytes,
  });
  return { url: presignUrl(clientSigningToken, { pathname: ruta, operation: "put" }), validoHasta };
}

export async function enlaceDeLectura(ruta: string, ahora: Date): Promise<string> {
  const { clientSigningToken } = await issueSignedToken({
    pathname: ruta,
    operations: ["get"],
    validUntil: new Date(ahora.getTime() + MINUTOS_DE_LECTURA * MINUTO),
  });
  return presignUrl(clientSigningToken, { pathname: ruta, operation: "get" });
}

export function puedeSubirMaterial(papel: "PROFESOR" | "ESTUDIANTE"): boolean {
  return papel === "PROFESOR";
}

/**
 * Qué fila escribir después de una subida. Si el almacén no confirma, no hay fila:
 * una subida cortada no puede dejar un fichero fantasma en la base.
 */
export function filaParaGuardar(
  datos: { ruta: string; subidoPorId: string; bytesSegunElNavegador?: number },
  confirmado: { bytes: number; tipoMime: string } | null,
) {
  if (!confirmado) return null;
  return {
    almacen: "VERCEL" as const,
    ruta: datos.ruta,
    bytes: confirmado.bytes,
    tipoMime: confirmado.tipoMime,
    subidoPorId: datos.subidoPorId,
  };
}

/** Nunca se escribe la fila sin preguntar antes al almacén si el fichero está de verdad. */
export async function comprobarQueLlego(
  ruta: string,
): Promise<{ bytes: number; tipoMime: string } | null> {
  try {
    const datos = await head(ruta);
    return { bytes: datos.size, tipoMime: datos.contentType };
  } catch {
    return null;
  }
}
```

`app/api/ficheros/permiso/route.ts`: POST. Comprueba que `personaActual()` es el
profesor, valida con Zod `{ nombre, tipoMime, bytes }`, rechaza lo que no sea imagen
o audio y lo que pase de 50 MB, y devuelve `permisoDeSubida(...)` más la ruta.

`app/api/ficheros/[id]/route.ts`: GET. Comprueba que hay sesión, busca el `Fichero`,
y responde con un 307 al `enlaceDeLectura`. Si el fichero es de Drive, 404: los de
Drive no se sirven por aquí.

`app/api/ficheros/confirmar/route.ts`: POST. Llama a `comprobarQueLlego` y solo
entonces crea la fila `Fichero` con los bytes y el tipo que dice el almacén, no los
que diga el navegador.

`app/pruebas/subir/page.tsx`: pantalla mínima, sin diseño, con un `input` de fichero
que pide permiso, sube con `fetch(url, { method: "PUT", body: fichero })`, confirma y
enseña el identificador. Un aviso arriba: «Pantalla de comprobación. Se tira cuando
llegue el taller.»

En `.env.example`, añadir `BLOB_READ_WRITE_TOKEN` con el comentario de que en Vercel
llega solo al conectar el almacén, y que en local se baja con `vercel env pull`.

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, 46 pruebas.

Mutaciones que las matan: quitar el `.split(/[\\/]/).pop()` de `rutaDelFichero` mata la
de los dos puntos; devolver `datos.bytesSegunElNavegador` en vez de `confirmado.bytes`
mata la de fiarse del almacén; quitar el `if (!confirmado) return null` mata la otra.
**Comprobar las tres.** La primera: La
prueba de los dos puntos tiene que ponerse roja. **Comprobarlo.**

- [ ] **Step 5: Commit**

```bash
git add lib/ficheros app/api/ficheros app/pruebas tests/ficheros-vercel.test.ts package.json package-lock.json .env.example
git commit -m "El almacén privado: permiso de subida, enlace de lectura y confirmación"
```

---

### Task 9: La unidad compartida de Drive

**Files:**
- Create: `lib/ficheros/drive.ts`, `app/api/grabaciones/permiso/route.ts`,
  `app/pruebas/grabar/page.tsx`
- Create: `tests/ficheros-drive.test.ts`
- Modify: `package.json` (`google-auth-library`), `.env.example`

**Interfaces:**
- Produces:
  - `peticionDeSesion(datos: { nombre: string; tipoMime: string; carpeta: string }): { url: string; cuerpo: string }`
  - `abrirSesionDeSubida(datos: { nombre: string; tipoMime: string }): Promise<string>` (devuelve la dirección de sesión)

- [ ] **Step 0: Comprobar primero que esto es posible**

**Antes de escribir nada**, comprobar a mano que un navegador puede subir a una
dirección de sesión de Drive. Es el único supuesto de todo el plan que puede caerse:
si Google no admite la petición desde otro sitio web, el camino directo no existe.

Con la cuenta robot ya creada y la unidad compartida hecha, abrir una sesión desde la
terminal y probar la subida desde la consola del navegador en `http://localhost:3000`:

```bash
# Devuelve la dirección de sesión en la cabecera Location
curl -i -X POST \
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"prueba.webm","parents":["<id de la carpeta>"]}'
```

```js
// En la consola del navegador, con esa dirección:
await fetch(SESION, { method: "PUT", body: new Blob(["hola"]) })
```

Si eso da error de origen cruzado, **parar y decirlo**: el plan de reserva es subir en
trozos a través de nuestro servidor, que sirve igual porque cada trozo va por debajo
del límite de 4,5 MB, pero cambia esta tarea entera y hay que replantearla.

- [ ] **Step 1: Escribir la prueba que falla**

`tests/ficheros-drive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { peticionDeSesion } from "@/lib/ficheros/drive";

describe("la petición de subida a Drive", () => {
  it("pide una sesión reanudable y avisa de que la carpeta es una unidad compartida", () => {
    const { url } = peticionDeSesion({ nombre: "a.webm", tipoMime: "video/webm", carpeta: "C1" });
    expect(url).toContain("uploadType=resumable");
    expect(url).toContain("supportsAllDrives=true");
  });

  it("cuelga el fichero de la carpeta que se le dice", () => {
    const { cuerpo } = peticionDeSesion({ nombre: "a.webm", tipoMime: "video/webm", carpeta: "C1" });
    expect(JSON.parse(cuerpo)).toEqual({ name: "a.webm", parents: ["C1"], mimeType: "video/webm" });
  });
});
```

Sin `supportsAllDrives` la subida falla con un 404 que no explica nada. Ya pasó en la
plataforma de la clínica.

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/ficheros-drive.test.ts`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Escribir la pieza**

```bash
npm install google-auth-library
```

`lib/ficheros/drive.ts`:

```ts
import { JWT } from "google-auth-library";

const RAIZ = "https://www.googleapis.com/upload/drive/v3/files";

export function peticionDeSesion(datos: {
  nombre: string;
  tipoMime: string;
  carpeta: string;
}): { url: string; cuerpo: string } {
  return {
    url: `${RAIZ}?uploadType=resumable&supportsAllDrives=true`,
    cuerpo: JSON.stringify({
      name: datos.nombre,
      parents: [datos.carpeta],
      mimeType: datos.tipoMime,
    }),
  };
}

function cuentaDeServicio(): JWT {
  const json = process.env.GOOGLE_CUENTA_DE_SERVICIO;
  if (!json) {
    throw new Error(
      "Falta GOOGLE_CUENTA_DE_SERVICIO. Es el JSON de la cuenta robot que escribe " +
        "en la unidad compartida de las grabaciones.",
    );
  }
  const credenciales = JSON.parse(json);
  return new JWT({
    email: credenciales.client_email,
    key: credenciales.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
}

/**
 * Abre la sesión de subida y devuelve su dirección. El navegador del estudiante sube
 * directo ahí; el fichero no pasa nunca por nuestro servidor.
 */
export async function abrirSesionDeSubida(datos: {
  nombre: string;
  tipoMime: string;
}): Promise<string> {
  const carpeta = process.env.DRIVE_CARPETA_GRABACIONES;
  if (!carpeta) throw new Error("Falta DRIVE_CARPETA_GRABACIONES, el id de la unidad compartida.");

  const { url, cuerpo } = peticionDeSesion({ ...datos, carpeta });
  const cliente = cuentaDeServicio();
  const { token } = await cliente.getAccessToken();

  const respuesta = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: cuerpo,
  });
  const sesion = respuesta.headers.get("location");
  if (!respuesta.ok || !sesion) {
    throw new Error(
      `Google no abrió la sesión de subida (${respuesta.status}). Comprueba que la ` +
        "carpeta es una unidad compartida y que la cuenta robot escribe en ella.",
    );
  }
  return sesion;
}
```

`app/api/grabaciones/permiso/route.ts`: POST con sesión abierta. Valida el tipo
(`audio/*` o `video/*`) y devuelve la dirección de sesión. El estudiante nunca recibe
el identificador de la carpeta.

`app/pruebas/grabar/page.tsx`: pantalla mínima con un `input` de fichero que pide la
sesión, sube con `PUT` y guarda la fila `Fichero` con `almacen: "DRIVE"`.

- [ ] **Step 4: Correrlas y ver que pasan**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, 48 pruebas.

Mutación que las mata: quitar `supportsAllDrives=true` de la dirección. **Comprobarlo.**

- [ ] **Step 5: Commit**

```bash
git add lib/ficheros/drive.ts app/api/grabaciones app/pruebas tests/ficheros-drive.test.ts package.json package-lock.json .env.example
git commit -m "Subir una grabación directo a la unidad compartida"
```

---

### Task 10: Lo que ninguna prueba automática puede comprobar

Esta tarea no escribe código. Es la lista de comprobaciones que hay que hacer contra
el mundo real antes de dar la entrega por buena, y **ninguna se puede saltar**.

**Files:**
- Modify: `docs/superpowers/plans/2026-09-10-la-puerta-y-el-almacen.md` (marcar aquí
  lo comprobado, con la fecha)

- [ ] **Step 1: El correo llega a la bandeja, no a no deseado**

Mandar un enlace de entrada de verdad a una dirección de Gmail y a otra de Hotmail.
Comprobar en las dos que llega a la bandeja principal, que el remitente se ve como
`contacto@hispaprofe.com` y que el enlace funciona. **Este es el riesgo mayor de toda
la entrega:** se manda desde una cuenta de otro dominio y la firma puede no cuadrar.

- [ ] **Step 2: El paseo entero desde un móvil**

Pedir el enlace en el móvil, abrirlo desde la aplicación de correo, comprobar que se
entra, que al volver más tarde se sigue dentro y que «Salir» deja fuera.

- [ ] **Step 3: Un enlace usado dos veces, de verdad**

Pulsar el mismo enlace dos veces desde dos navegadores. El segundo tiene que dar el
aviso, no entrar.

- [ ] **Step 4: Una subida grande a cada almacén**

Subir un audio de unos 8 MB al almacén de Vercel y un vídeo de unos 60 MB a Drive,
desde el navegador. Comprobar que el vídeo aparece en la unidad compartida y que el
audio se puede volver a ver con su enlace de lectura.

- [ ] **Step 5: Que un estudiante no pueda pedir lo que no le toca**

Entrando como estudiante, pedir a mano el permiso de subida del profesor y comprobar
que responde que no. Y abrir un enlace de lectura caducado, para ver que el almacén
lo rechaza.

- [ ] **Step 6: Anotar lo comprobado y commitear**

```bash
git add docs/superpowers/plans/2026-09-10-la-puerta-y-el-almacen.md
git commit -m "Comprobado a mano: correo, entrada desde móvil y las dos subidas"
```

---

## Lo que este plan NO hace

- No construye el taller, ni la biblioteca, ni el reproductor del estudiante, ni la
  portada comercial.
- No siembra ninguna persona: el profesor se da de alta a sí mismo con una orden a
  mano contra la base, y a partir de ahí da de alta a los demás desde la pantalla.
- No pone integración continua. Sigue pendiente de los cimientos.
- No borra sesiones caducadas: caducan solas y con trece personas no sobra ni una fila.
