# Entrega 3b · Asignar, candado de ficheros e Inicio del estudiante

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor asigne un examen publicado a estudiantes con una fecha, que el estudiante lo vea en su Inicio, y que nadie que no sea el profesor pueda abrir un fichero de examen.

**Architecture:** Una tabla `Asignacion` (examen + persona + modo + fecha tope, única por pareja). Las fechas son días sueltos interpretados en Europe/Madrid por funciones puras sin dependencias. El correo se manda fuera de la transacción, inyectado como argumento igual que en la puerta. El candado es una lista blanca: `puedeVerFichero`, aplicada en la ruta que sirve ficheros, que contesta 404 —no 403— cuando dice que no.

**Tech Stack:** Next 15 (App Router, acciones de servidor), React 19, Prisma 7 sobre Postgres (Neon en producción), Zod, Vitest, Tailwind, nodemailer. **Ninguna dependencia nueva.**

**Spec:** `docs/superpowers/specs/2026-09-16-taller-entrega-3b-design.md` — se lee entera antes de empezar; este plan argumenta desde ella.

## Global Constraints

- **Ninguna dependencia nueva.** Las fechas se calculan con `Intl`, que ya trae Node.
- **Todo en español**: nombres de funciones, variables, ficheros, mensajes y comentarios. Es la convención del repo entero.
- **Los mensajes al profesor son los de la sección 9 de la spec, copiados letra a letra.** Las pruebas los comparan enteros con `toEqual`, no por subcadena: comparar por subcadena da por buena la pantalla de error equivocada, y ya nos pasó.
- **El «ahora» se pasa siempre como argumento**, nunca se lee dentro de una función. Es la única forma de que la suite no cambie de color según la hora a la que corra.
- **Cada prueba lleva encima, en un comentario, la mutación que tiene que matar.** Una prueba que no mata ninguna mutación no cuenta como hecha.
- **Un enlace que cambia algo es siempre un formulario POST**, nunca un `<Link>`: la precarga de Next lo dispara sola (así se borró la sesión de Pablo el 12 sept).
- **Nada que salga hacia el navegador del estudiante lleva claves ni identificadores de fichero.**
- `npm test` (suite normal), `npm run test:base` (contra Postgres de verdad), `npx tsc --noEmit` y `npm run lint` tienen que estar en verde al cerrar cada tarea.
- **Nunca `git add -A`**: solo las rutas de la tarea. El árbol puede tener trabajo de otra sesión.
- Fin de mensaje de commit: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 0: Preparar la carpeta

El worktree nace sin `node_modules` y sin `.env`: sin esto no corre ni una prueba.

**Files:**
- Ninguno que se commitee.

- [ ] **Step 1: Instalar**

```bash
cd /Users/FLE/Projects/hispaprofe-dele-taller-3b
npm install
```

`postinstall` corre `prisma generate` solo. Si se queja por falta de `DIRECT_URL` (Prisma 7 carga `prisma.config.ts` hasta para `--help`), repetir con una cadena falsa, que para generar el cliente no se conecta a nada:

```bash
DATABASE_URL=postgresql://x@127.0.0.1:1/x DIRECT_URL=postgresql://x@127.0.0.1:1/x npx prisma generate
```

- [ ] **Step 2: Comprobar que la base de partida está verde**

```bash
npm test
npm run test:base
```

Esperado: `npm test` 424 pruebas y 1 omitida; `test:base` 99. Si no cuadra, **parar y decirlo**: la cifra de partida es la referencia de todo lo demás.

---

### Task 1: Las fechas de Madrid

**Files:**
- Create: `lib/tiempo/madrid.ts`
- Test: `tests/tiempo-madrid.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `finDelDiaEnMadrid(dia: string): Date | null` — de `"2026-10-20"` al instante de las 23:59:59.999 de ese día en Madrid. `null` si la cadena no es un día real.
  - `diaEnMadrid(instante: Date): string` — el camino de vuelta, `"2026-10-20"`.
  - `fechaEnPalabras(instante: Date): string` — `"martes, 20 de octubre de 2026"`.
  - `estaFueraDePlazo(fechaTope: Date, ahora: Date): boolean`.

- [ ] **Step 1: Escribir la prueba que falla**

Los instantes están comprobados con Node contra la base de datos de husos del sistema, no calculados a ojo.

```ts
// tests/tiempo-madrid.test.ts
import { describe, it, expect } from "vitest";
import { diaEnMadrid, estaFueraDePlazo, fechaEnPalabras, finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

describe("el fin del día en Madrid", () => {
  // Mutación que la mata: calcular en UTC (devolver Date.UTC(...23:59:59.999) sin
  // restar el desfase). En verano el examen caducaría dos horas antes de tiempo.
  it("en verano son las 21:59:59.999 UTC y en invierno las 22:59:59.999", () => {
    expect(finDelDiaEnMadrid("2026-06-20")!.toISOString()).toBe("2026-06-20T21:59:59.999Z");
    expect(finDelDiaEnMadrid("2026-12-20")!.toISOString()).toBe("2026-12-20T22:59:59.999Z");
  });

  // Mutación que la mata: pedir el desfase a medianoche en vez de a mediodía. El
  // 25 de octubre de 2026 el reloj se atrasa a las 03:00: a medianoche todavía es
  // +02:00 y a las 23:59 ya es +01:00, así que preguntar a medianoche da una hora
  // de más justo el día del cambio.
  it("acierta el día en que cambia la hora", () => {
    expect(finDelDiaEnMadrid("2026-10-25")!.toISOString()).toBe("2026-10-25T22:59:59.999Z");
  });

  // Mutación que la mata: quitar la comprobación de que el día existe. Date.UTC
  // convierte el 30 de febrero en el 2 de marzo sin protestar, y el profesor
  // recibiría una fecha que no escribió.
  it("un día que no existe no vale", () => {
    expect(finDelDiaEnMadrid("2026-02-30")).toBeNull();
    expect(finDelDiaEnMadrid("20 de octubre")).toBeNull();
    expect(finDelDiaEnMadrid("")).toBeNull();
  });
});

describe("pintar la fecha", () => {
  // Mutación que la mata: pintar sin timeZone (el servidor de Vercel va en UTC:
  // las 23:59:59.999 de Madrid caen en el día anterior, y la tarjeta enseñaría
  // el 19 en vez del 20).
  it("el día de vuelta y en palabras salen en hora de Madrid", () => {
    const tope = finDelDiaEnMadrid("2026-10-20")!;
    expect(diaEnMadrid(tope)).toBe("2026-10-20");
    expect(fechaEnPalabras(tope)).toBe("martes, 20 de octubre de 2026");
  });
});

describe("fuera de plazo", () => {
  // Mutación que la mata: usar >= en vez de >, o leer la hora dentro de la
  // función en vez de recibirla.
  it("un milisegundo antes no, un milisegundo después sí", () => {
    const tope = finDelDiaEnMadrid("2026-10-20")!;
    expect(estaFueraDePlazo(tope, new Date(tope.getTime()))).toBe(false);
    expect(estaFueraDePlazo(tope, new Date(tope.getTime() + 1))).toBe(true);
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

Run: `npx vitest run tests/tiempo-madrid.test.ts`
Expected: FAIL, «Cannot find module '@/lib/tiempo/madrid'».

- [ ] **Step 3: Escribir la implementación**

```ts
// lib/tiempo/madrid.ts
const HUSO = "Europe/Madrid";

/**
 * El desfase de Madrid, en minutos, en un instante concreto. Sale de la base de
 * husos del sistema (Intl), no de una tabla nuestra: los cambios de hora los
 * decide la Unión Europea y no se codifican a mano.
 */
function desfaseEnMinutos(instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: HUSO, timeZoneName: "longOffset" }).formatToParts(instante);
  const texto = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const leido = /GMT([+-])(\d{2}):(\d{2})/.exec(texto);
  if (!leido) return 0;
  return (leido[1] === "-" ? -1 : 1) * (Number(leido[2]) * 60 + Number(leido[3]));
}

/**
 * El instante en que acaba ese día en Madrid. El desfase se pide al MEDIODÍA
 * UTC del día pedido, que cae siempre dentro de ese día en Madrid se sume o se
 * reste una hora, y además ya está del lado bueno del cambio de hora, que
 * ocurre de madrugada. Preguntarlo a medianoche falla el día del cambio.
 */
export function finDelDiaEnMadrid(dia: string): Date | null {
  const leido = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!leido) return null;
  const [anio, mes, numero] = [Number(leido[1]), Number(leido[2]), Number(leido[3])];
  const mediodia = new Date(Date.UTC(anio, mes - 1, numero, 12));
  // Date.UTC estira los meses sin protestar: el 30 de febrero se vuelve 2 de
  // marzo. Si al leerlo de vuelta no es el mismo día, el día no existía.
  if (mediodia.getUTCFullYear() !== anio || mediodia.getUTCMonth() !== mes - 1 || mediodia.getUTCDate() !== numero) return null;
  return new Date(Date.UTC(anio, mes - 1, numero, 23, 59, 59, 999) - desfaseEnMinutos(mediodia) * 60_000);
}

/** El día al que pertenece ese instante en Madrid, en forma AAAA-MM-DD. */
export function diaEnMadrid(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante);
}

/** «martes, 20 de octubre de 2026». */
export function fechaEnPalabras(instante: Date): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: HUSO, dateStyle: "full" }).format(instante);
}

/** El «ahora» se recibe: si se leyera aquí dentro, la prueba cambiaría de color según la hora. */
export function estaFueraDePlazo(fechaTope: Date, ahora: Date): boolean {
  return ahora.getTime() > fechaTope.getTime();
}
```

- [ ] **Step 4: Correrla y verla pasar**

Run: `npx vitest run tests/tiempo-madrid.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Commit**

```bash
git add lib/tiempo/madrid.ts tests/tiempo-madrid.test.ts
git commit -m "Las fechas tope, en hora de Madrid

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: El correo de aviso

**Files:**
- Modify: `lib/correo/mensaje.ts`
- Test: `tests/correo-mensaje.test.ts` (añadir al final, no tocar lo que hay)

**Interfaces:**
- Consumes: el tipo `Mensaje` que ya existe en ese fichero.
- Produces: `mensajeDeAsignacion(a: string, datos: { nombre: string; titulo: string; nivel: string; fechaEnPalabras: string; url: string }): Mensaje`.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// al final de tests/correo-mensaje.test.ts
import { mensajeDeAsignacion } from "@/lib/correo/mensaje";

describe("el aviso de examen asignado", () => {
  const datos = {
    nombre: "Ana",
    titulo: "Examen 1",
    nivel: "A2/B1 escolar",
    fechaEnPalabras: "martes, 20 de octubre de 2026",
    url: "https://hispaprofe-dele.vercel.app",
  };

  // Mutación que la mata: dejar de interpolar el título o la fecha. Un aviso sin
  // fecha obliga a preguntar por WhatsApp, que es justo lo que evita el correo.
  it("dice de qué examen y para cuándo, en el asunto y en el cuerpo", () => {
    const mensaje = mensajeDeAsignacion("ana@ejemplo.com", datos);

    expect(mensaje.a).toBe("ana@ejemplo.com");
    expect(mensaje.asunto).toBe("Tienes un examen: Examen 1");
    for (const parte of [mensaje.texto, mensaje.html]) {
      expect(parte).toContain("Ana");
      expect(parte).toContain("Examen 1");
      expect(parte).toContain("martes, 20 de octubre de 2026");
      expect(parte).toContain("https://hispaprofe-dele.vercel.app");
    }
  });

  // Mutación que la mata: reutilizar aquí el enlace de un solo uso de
  // mensajeDeEntrada. Ese caduca a los quince minutos y se gasta al primer clic
  // (hasta el antivirus del correo lo gasta), así que el aviso llegaría roto.
  it("el enlace es la portada, no un enlace de entrada", () => {
    const mensaje = mensajeDeAsignacion("ana@ejemplo.com", datos);

    expect(mensaje.texto).not.toContain("/entrar/");
    expect(mensaje.texto).not.toContain("quince minutos");
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

Run: `npx vitest run tests/correo-mensaje.test.ts`
Expected: FAIL, «mensajeDeAsignacion is not a function».

- [ ] **Step 3: Escribir la implementación**

```ts
// al final de lib/correo/mensaje.ts
export type DatosDeAsignacion = {
  nombre: string;
  titulo: string;
  nivel: string;
  fechaEnPalabras: string;
  url: string;
};

/**
 * El enlace es la portada, NO un enlace de entrada: los de entrada caducan a los
 * quince minutos y se gastan al primer clic, así que un aviso que lo llevara
 * llegaría roto casi siempre. Quien pulse, si no tiene la sesión abierta, pasará
 * por la puerta como cualquier otro día.
 */
export function mensajeDeAsignacion(a: string, datos: DatosDeAsignacion): Mensaje {
  const { nombre, titulo, nivel, fechaEnPalabras, url } = datos;
  const texto = [
    `Hola, ${nombre}.`,
    "",
    `Tienes un examen para hacer: ${titulo} (${nivel}).`,
    `Fecha tope: ${fechaEnPalabras}.`,
    "",
    "Entra aquí cuando quieras:",
    url,
  ].join("\n");

  const html = `<p>Hola, ${nombre}.</p>
<p>Tienes un examen para hacer: <strong>${titulo}</strong> (${nivel}).</p>
<p>Fecha tope: ${fechaEnPalabras}.</p>
<p><a href="${url}">Entrar en HispaProfe</a></p>`;

  return { a, asunto: `Tienes un examen: ${titulo}`, texto, html };
}
```

- [ ] **Step 4: Correrla y verla pasar**

Run: `npx vitest run tests/correo-mensaje.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/correo/mensaje.ts tests/correo-mensaje.test.ts
git commit -m "El correo que avisa de un examen asignado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: La tabla `Asignacion`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<marca>_asignaciones/migration.sql` (lo escribe Prisma)
- Test: `tests/base/asignaciones.test.ts`

**Interfaces:**
- Consumes: los modelos `Examen` y `Persona` que ya existen.
- Produces: el modelo `Asignacion` y el enum `ModoDeExamen` en `@/lib/generated/prisma`, con los campos de la sección 2 de la spec.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/base/asignaciones.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import type { Examen, Persona } from "@/lib/generated/prisma";
import { finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

const TOPE = finDelDiaEnMadrid("2026-10-20")!;

let profesor: Persona;
let ana: Persona;
let examen: Examen;

beforeEach(async () => {
  await prisma.asignacion.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.persona.deleteMany();
  profesor = await prisma.persona.create({ data: { correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR" } });
  ana = await prisma.persona.create({ data: { correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE" } });
  examen = await prisma.examen.create({ data: { titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
});

describe("la tabla de asignaciones", () => {
  // Mutación que la mata: quitar @@unique([examenId, personaId]). Sin ella, dos
  // clics seguidos en Asignar dejan dos filas y el estudiante recibe dos avisos.
  it("no admite dos veces el mismo examen a la misma persona", async () => {
    await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE, asignadaPorId: profesor.id } });
    await expect(
      prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE, asignadaPorId: profesor.id } }),
    ).rejects.toThrow();
    expect(await prisma.asignacion.count()).toBe(1);
  });

  // Mutación que la mata: poner el modo sin valor por defecto, o por defecto LIBRE.
  it("el modo nace en completo", async () => {
    const creada = await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    expect(creada.modo).toBe("COMPLETO");
    expect(creada.asignadaPorId).toBeNull();
  });

  // Mutación que la mata: cambiar el onDelete de Cascade a Restrict en examen o
  // persona; borrar un examen dejaría asignaciones apuntando al vacío.
  it("borrar el examen se lleva sus asignaciones", async () => {
    await prisma.asignacion.create({ data: { examenId: examen.id, personaId: ana.id, fechaTope: TOPE } });
    await prisma.examen.delete({ where: { id: examen.id } });
    expect(await prisma.asignacion.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Correrla y verla fallar**

Run: `npm run test:base -- tests/base/asignaciones.test.ts`
Expected: FAIL, `prisma.asignacion` no existe.

- [ ] **Step 3: Escribir el modelo**

```prisma
// prisma/schema.prisma, junto a los demás enums
enum ModoDeExamen {
  COMPLETO
  LIBRE
}

// al final del fichero
/// Un examen puesto a una persona, con su fecha tope. Una sola por pareja:
/// volver a asignarlo cambia la fecha, no crea otra fila. El estado de lo que
/// el estudiante haga (empezada, entregada, la nota) llega con la 3c.
model Asignacion {
  id            String       @id @default(cuid())
  examen        Examen       @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId      String
  persona       Persona      @relation("recibidas", fields: [personaId], references: [id], onDelete: Cascade)
  personaId     String
  modo          ModoDeExamen @default(COMPLETO)
  fechaTope     DateTime
  asignadaEn    DateTime     @default(now())
  asignadaPor   Persona?     @relation("hechas", fields: [asignadaPorId], references: [id], onDelete: SetNull)
  asignadaPorId String?

  @@unique([examenId, personaId])
  @@index([personaId])
}
```

Y las dos relaciones del otro lado:

```prisma
// en model Examen
  asignaciones Asignacion[]

// en model Persona
  asignaciones       Asignacion[] @relation("recibidas")
  asignacionesHechas Asignacion[] @relation("hechas")
```

- [ ] **Step 4: Crear la migración**

El worktree no tiene base ni `.env`, así que se levanta un Postgres de usar y tirar (puerto distinto del de las pruebas, para no pisarlas si corren a la vez):

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
PUERTO=55433; DATOS="$(pwd)/.tmp/pg-migrar"
rm -rf "$DATOS" && initdb -D "$DATOS" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$DATOS" -o "-p $PUERTO -k $DATOS" -l "$DATOS/servidor.log" start
psql -h 127.0.0.1 -p $PUERTO -U postgres -c "create database migrar"
export DATABASE_URL="postgresql://postgres@127.0.0.1:$PUERTO/migrar"
export DIRECT_URL="$DATABASE_URL"
npx prisma migrate dev --name asignaciones
pg_ctl -D "$DATOS" stop -m fast; rm -rf "$DATOS"
```

Leer el `migration.sql` que ha salido y comprobar a ojo que trae **una tabla, un enum y un índice único**, y ninguna columna borrada. Si trae más, el esquema se ha desviado y hay que parar.

- [ ] **Step 5: Correr la prueba y verla pasar**

Run: `npm run test:base -- tests/base/asignaciones.test.ts`
Expected: PASS, 3 pruebas.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/base/asignaciones.test.ts
git commit -m "La tabla de asignaciones: un examen, una persona, una fecha

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Asignar, quitar y listar

**Files:**
- Create: `lib/examen/asignar.ts`
- Create: `tests/asignar-nombres.test.ts`
- Test: `tests/base/asignaciones.test.ts` (añadir al final)

**Interfaces:**
- Consumes: `finDelDiaEnMadrid`, `fechaEnPalabras` (Task 1); `mensajeDeAsignacion` (Task 2); el modelo `Asignacion` (Task 3); el tipo `Mandar` de `@/lib/correo/mensaje`.
- Produces:
  - `asignarExamen(examenId: string, personaIds: string[], dia: string, profesorId: string, mandar: Mandar, base: string, ahora: Date): Promise<{ asignados: number; sinAviso: string[] } | { error: string }>`
  - `quitarAsignacion(examenId: string, personaId: string): Promise<{ error?: string }>`
  - `asignacionesDelExamen(examenId: string): Promise<{ personaId: string; nombre: string; fechaTope: Date }[]>`
  - `asignacionesDe(personaId: string): Promise<{ examenId: string; titulo: string; nivel: Nivel; modo: ModoDeExamen; fechaTope: Date }[]>`
  - `estudiantesParaAsignar(): Promise<{ id: string; nombre: string; correo: string }[]>`
  - `listaDeNombres(nombres: string[]): string` — «Ana, Luis, Marta y 5 más».

- [ ] **Step 1: Escribir la prueba pura de los nombres**

```ts
// tests/asignar-nombres.test.ts
import { describe, it, expect } from "vitest";
import { listaDeNombres } from "@/lib/examen/asignar";

describe("la lista de nombres del aviso", () => {
  // Mutación que la mata: pegar todos los nombres. Con doce estudiantes el
  // mensaje de error no cabría en la pantalla.
  it("dice tres y cuenta el resto", () => {
    expect(listaDeNombres(["Ana"])).toBe("Ana");
    expect(listaDeNombres(["Ana", "Luis"])).toBe("Ana y Luis");
    expect(listaDeNombres(["Ana", "Luis", "Marta"])).toBe("Ana, Luis y Marta");
    expect(listaDeNombres(["Ana", "Luis", "Marta", "Eva"])).toBe("Ana, Luis, Marta y 1 más");
    expect(listaDeNombres(["Ana", "Luis", "Marta", "Eva", "Juan"])).toBe("Ana, Luis, Marta y 2 más");
  });
});
```

- [ ] **Step 2: Escribir las pruebas de base**

```ts
// al final de tests/base/asignaciones.test.ts
import { asignacionesDe, asignacionesDelExamen, asignarExamen, estudiantesParaAsignar, quitarAsignacion } from "@/lib/examen/asignar";
import type { Mensaje } from "@/lib/correo/mensaje";

const ANTES = new Date("2026-09-16T10:00:00Z");

describe("asignar un examen", () => {
  // Mutación que la mata: no llamar a finDelDiaEnMadrid y guardar la medianoche
  // UTC, o no mandar el correo.
  it("guarda la fecha tope de Madrid y avisa a cada uno", async () => {
    const enviados: Mensaje[] = [];
    const r = await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async (m) => { enviados.push(m); }, "https://sitio", ANTES);

    expect(r).toEqual({ asignados: 1, sinAviso: [] });
    const guardada = await prisma.asignacion.findFirstOrThrow();
    expect(guardada.fechaTope.toISOString()).toBe("2026-10-20T21:59:59.999Z");
    expect(guardada.asignadaPorId).toBe(profesor.id);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.a).toBe("ana@ejemplo.com");
    expect(enviados[0]!.texto).toContain("martes, 20 de octubre de 2026");
  });

  // Mutación que la mata: usar create en vez de upsert.
  it("asignárselo otra vez le cambia la fecha y no duplica", async () => {
    const nada = async () => {};
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, nada, "https://sitio", ANTES);
    await asignarExamen(examen.id, [ana.id], "2026-11-05", profesor.id, nada, "https://sitio", ANTES);

    expect(await prisma.asignacion.count()).toBe(1);
    expect((await prisma.asignacion.findFirstOrThrow()).fechaTope.toISOString()).toBe("2026-11-05T22:59:59.999Z");
  });

  // Mutación que la mata: mandar el correo DENTRO de la transacción, o deshacerla
  // si falla. Un correo que rebota dejaría a los otros once sin examen.
  it("si el correo falla, la asignación se queda y dice a quién no le llegó", async () => {
    const r = await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => { throw new Error("SMTP caído"); }, "https://sitio", ANTES);

    expect(r).toEqual({ asignados: 1, sinAviso: ["Ana"] });
    expect(await prisma.asignacion.count()).toBe(1);
  });

  // Mutación que la mata: quitar la comprobación de estado. Asignar un examen en
  // construcción manda a doce personas a un examen que aún cambia.
  it("un examen que no está publicado no se asigna", async () => {
    await prisma.examen.update({ where: { id: examen.id }, data: { estado: "EN_CONSTRUCCION" } });
    const r = await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(r).toEqual({ error: "Solo se asigna un examen publicado." });
    expect(await prisma.asignacion.count()).toBe(0);
  });

  // Mutación que la mata: quitar cualquiera de las tres comprobaciones de entrada.
  it("sin nadie, sin fecha o con una fecha pasada no hace nada", async () => {
    const llamar = (ids: string[], dia: string) => asignarExamen(examen.id, ids, dia, profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await llamar([], "2026-10-20")).toEqual({ error: "Marca al menos un estudiante." });
    expect(await llamar([ana.id], "")).toEqual({ error: "Falta la fecha, o no es una fecha." });
    expect(await llamar([ana.id], "2026-09-01")).toEqual({ error: "Esa fecha ya pasó." });
    expect(await prisma.asignacion.count()).toBe(0);
  });

  // Mutación que la mata: no filtrar por papel ni por activa. El profesor se
  // asignaría el examen a sí mismo sin querer al pulsar «marcar todos».
  it("solo se asigna a estudiantes activos, y si uno no vale no se asigna ninguno", async () => {
    const r = await asignarExamen(examen.id, [ana.id, profesor.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(r).toEqual({ error: "Esa lista de estudiantes no vale." });
    expect(await prisma.asignacion.count()).toBe(0);
    expect((await estudiantesParaAsignar()).map((e) => e.nombre)).toEqual(["Ana"]);
  });
});

describe("quitar y listar", () => {
  // Mutación que la mata: que quitarAsignacion borre por personaId sin mirar el
  // examen, y se lleve por delante los demás exámenes de esa persona.
  it("quitar borra solo esa pareja", async () => {
    const otro = await prisma.examen.create({ data: { titulo: "Examen 2", nivel: "A2_B1_ESCOLAR", estado: "PUBLICADO" } });
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);
    await asignarExamen(otro.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await quitarAsignacion(examen.id, ana.id)).toEqual({});
    expect((await asignacionesDe(ana.id)).map((a) => a.examenId)).toEqual([otro.id]);
    expect(await quitarAsignacion(examen.id, ana.id)).toEqual({ error: "Esa asignación ya no existe." });
  });

  // Mutación que la mata: devolver la fila entera de la base en asignacionesDe.
  // Lo que viaja al navegador del estudiante se construye campo a campo.
  it("lo del estudiante trae lo justo para pintar", async () => {
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await asignacionesDe(ana.id)).toEqual([
      { examenId: examen.id, titulo: "Examen 1", nivel: "A2_B1_ESCOLAR", modo: "COMPLETO", fechaTope: new Date("2026-10-20T21:59:59.999Z") },
    ]);
    expect(await asignacionesDelExamen(examen.id)).toEqual([
      { personaId: ana.id, nombre: "Ana", fechaTope: new Date("2026-10-20T21:59:59.999Z") },
    ]);
  });
});
```

- [ ] **Step 3: Correrlas y verlas fallar**

Run: `npx vitest run tests/asignar-nombres.test.ts` y `npm run test:base -- tests/base/asignaciones.test.ts`
Expected: FAIL, «Cannot find module '@/lib/examen/asignar'».

- [ ] **Step 4: Escribir la implementación**

```ts
// lib/examen/asignar.ts
import { prisma } from "@/lib/db";
import type { Mandar } from "@/lib/correo/mensaje";
import { mensajeDeAsignacion } from "@/lib/correo/mensaje";
import type { ModoDeExamen, Nivel } from "@/lib/generated/prisma";
import { NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { bloquearExamen } from "@/lib/taller/publicado";
import { fechaEnPalabras, finDelDiaEnMadrid } from "@/lib/tiempo/madrid";

export type ResultadoDeAsignar = { asignados: number; sinAviso: string[] } | { error: string };

/** «Ana, Luis, Marta y 5 más»: con doce estudiantes, la lista entera no cabe en el aviso. */
export function listaDeNombres(nombres: string[]): string {
  if (nombres.length <= 3) {
    if (nombres.length <= 1) return nombres[0] ?? "";
    return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  }
  return `${nombres.slice(0, 3).join(", ")} y ${nombres.length - 3} más`;
}

export function estudiantesParaAsignar(): Promise<{ id: string; nombre: string; correo: string }[]> {
  return prisma.persona.findMany({
    where: { papel: "ESTUDIANTE", activa: true },
    select: { id: true, nombre: true, correo: true },
    orderBy: { nombre: "asc" },
  });
}

/**
 * Guarda las asignaciones y luego avisa. El correo va FUERA de la transacción a
 * propósito: si el buzón de un menor rebota, los otros once tienen que quedarse
 * con su examen igual. Los que no reciben aviso vuelven por nombre para que el
 * profesor se lo diga a mano.
 */
export async function asignarExamen(
  examenId: string,
  personaIds: string[],
  dia: string,
  profesorId: string,
  mandar: Mandar,
  base: string,
  ahora: Date,
): Promise<ResultadoDeAsignar> {
  if (personaIds.length === 0) return { error: "Marca al menos un estudiante." };
  const fechaTope = finDelDiaEnMadrid(dia);
  if (!fechaTope) return { error: "Falta la fecha, o no es una fecha." };
  if (fechaTope.getTime() < ahora.getTime()) return { error: "Esa fecha ya pasó." };

  const guardado = await prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado === null) return { error: "Ese examen no existe." };
    if (estado !== "PUBLICADO") return { error: "Solo se asigna un examen publicado." };

    const examen = await tx.examen.findUniqueOrThrow({ where: { id: examenId }, select: { titulo: true, nivel: true } });
    const personas = await tx.persona.findMany({
      where: { id: { in: personaIds }, papel: "ESTUDIANTE", activa: true },
      select: { id: true, nombre: true, correo: true },
    });
    // O valen todos o no vale ninguno: media tanda asignada es peor que ninguna,
    // porque el profesor no sabe a quién le faltó.
    if (personas.length !== personaIds.length) return { error: "Esa lista de estudiantes no vale." };

    for (const persona of personas) {
      await tx.asignacion.upsert({
        where: { examenId_personaId: { examenId, personaId: persona.id } },
        create: { examenId, personaId: persona.id, fechaTope, asignadaPorId: profesorId },
        update: { fechaTope, asignadaPorId: profesorId },
      });
    }
    return { examen, personas };
  });
  if ("error" in guardado) return guardado;

  const sinAviso: string[] = [];
  for (const persona of guardado.personas) {
    try {
      await mandar(
        mensajeDeAsignacion(persona.correo, {
          nombre: persona.nombre,
          titulo: guardado.examen.titulo,
          nivel: NOMBRE_DE_NIVEL[guardado.examen.nivel],
          fechaEnPalabras: fechaEnPalabras(fechaTope),
          url: base,
        }),
      );
    } catch {
      sinAviso.push(persona.nombre);
    }
  }
  return { asignados: guardado.personas.length, sinAviso };
}

export async function quitarAsignacion(examenId: string, personaId: string): Promise<{ error?: string }> {
  const r = await prisma.asignacion.deleteMany({ where: { examenId, personaId } });
  return r.count === 1 ? {} : { error: "Esa asignación ya no existe." };
}

export async function asignacionesDelExamen(examenId: string): Promise<{ personaId: string; nombre: string; fechaTope: Date }[]> {
  const filas = await prisma.asignacion.findMany({
    where: { examenId },
    include: { persona: { select: { nombre: true } } },
    orderBy: { persona: { nombre: "asc" } },
  });
  return filas.map((f) => ({ personaId: f.personaId, nombre: f.persona.nombre, fechaTope: f.fechaTope }));
}

export type AsignacionDelEstudiante = {
  examenId: string;
  titulo: string;
  nivel: Nivel;
  modo: ModoDeExamen;
  fechaTope: Date;
};

/**
 * Lo único que sale hacia el navegador del estudiante. Se construye campo a
 * campo, como actividadParaElEstudiante: si mañana la asignación gana un campo
 * con la nota o con las respuestas, no se cuela solo por existir.
 */
export async function asignacionesDe(personaId: string): Promise<AsignacionDelEstudiante[]> {
  const filas = await prisma.asignacion.findMany({
    where: { personaId },
    include: { examen: { select: { id: true, titulo: true, nivel: true } } },
    orderBy: { fechaTope: "asc" },
  });
  return filas.map((f) => ({
    examenId: f.examen.id,
    titulo: f.examen.titulo,
    nivel: f.examen.nivel,
    modo: f.modo,
    fechaTope: f.fechaTope,
  }));
}
```

- [ ] **Step 5: Correrlas y verlas pasar**

Run: `npx vitest run tests/asignar-nombres.test.ts` y `npm run test:base -- tests/base/asignaciones.test.ts`
Expected: PASS las dos.

- [ ] **Step 6: Commit**

```bash
git add lib/examen/asignar.ts tests/asignar-nombres.test.ts tests/base/asignaciones.test.ts
git commit -m "Asignar un examen, quitarlo y listarlo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Retirar con gente dentro, Archivar y el guardián de edición

**Files:**
- Modify: `lib/taller/publicado.ts`
- Modify: `lib/taller/examenes.ts` (`retirarExamen`, línea ~291; el `catch` de la línea ~268; añadir `archivarExamen` y `recuperarExamen`)
- Modify: `lib/taller/paginas.ts:45,69,111,163`
- Modify: `lib/taller/cuadernillos.ts:41`
- Modify: `lib/taller/ia/rellenar.ts:95`
- Test: `tests/base/taller-publicar.test.ts` (añadir), `tests/base/asignaciones.test.ts` (añadir)

**Interfaces:**
- Consumes: `asignacionesDelExamen` y `listaDeNombres` (Task 4).
- Produces:
  - `MENSAJE_ARCHIVADO = "El examen está archivado: recupéralo para editarlo."`
  - `class ExamenNoEditable extends Error` (sustituye a `ExamenPublicado`), construido con el estado.
  - `archivarExamen(examenId: string): Promise<{ error?: string }>`
  - `recuperarExamen(examenId: string): Promise<{ error?: string }>`
  - `retirarExamen` mantiene su firma y gana la comprobación de asignaciones.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// al final de tests/base/asignaciones.test.ts
import { archivarExamen, recuperarExamen, retirarExamen } from "@/lib/taller/examenes";

describe("retirar un examen que tiene gente dentro", () => {
  // Mutación que la mata: dejar retirarExamen como estaba (un updateMany sin
  // mirar asignaciones). El estudiante se quedaría mirando un examen que cambia
  // debajo.
  it("no deja, dice los nombres, y el examen sigue publicado", async () => {
    await asignarExamen(examen.id, [ana.id], "2026-10-20", profesor.id, async () => {}, "https://sitio", ANTES);

    expect(await retirarExamen(examen.id)).toEqual({
      error: "No se puede retirar: lo tienen asignado Ana. Quítaselo antes.",
    });
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("PUBLICADO");
  });

  // Mutación que la mata: comprobar las asignaciones fuera de la transacción que
  // bloquea el examen.
  it("sin nadie dentro retira como siempre", async () => {
    expect(await retirarExamen(examen.id)).toEqual({});
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("EN_CONSTRUCCION");
  });
});

describe("archivar", () => {
  // Mutación que la mata: dejar archivar desde publicado. Se saltaría la
  // comprobación de asignaciones, que solo vive en retirar.
  it("un examen publicado hay que retirarlo primero", async () => {
    expect(await archivarExamen(examen.id)).toEqual({ error: "Retíralo antes de archivarlo." });
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("PUBLICADO");
  });

  // Mutación que la mata: que archivar dos veces dé error (publicar lo ya
  // publicado tampoco lo da) o que recuperar no vuelva a construcción.
  it("desde construcción archiva, y recuperar lo devuelve", async () => {
    await retirarExamen(examen.id);
    expect(await archivarExamen(examen.id)).toEqual({});
    expect(await archivarExamen(examen.id)).toEqual({});
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("ARCHIVADO");
    expect(await recuperarExamen(examen.id)).toEqual({});
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examen.id } })).estado).toBe("EN_CONSTRUCCION");
  });
});
```

```ts
// al final de tests/base/taller-publicar.test.ts, dentro de un describe nuevo
import { archivarExamen } from "@/lib/taller/examenes";
import { MENSAJE_ARCHIVADO } from "@/lib/taller/publicado";

describe("un examen archivado tampoco se escribe", () => {
  // Mutación que la mata: dejar exigirEditable mirando solo PUBLICADO. Es el
  // agujero que abre Archivar: un examen fuera de circulación se podría seguir
  // editando, y al recuperarlo nadie sabría qué cambió.
  it("guardar una tarea o tocar las páginas se rechaza con el mensaje de archivado", async () => {
    const id = await examenCompleto();
    expect(await archivarExamen(id)).toEqual({});
    const hoja = await fichero("image/jpeg");

    const co1 = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    expect(await guardarTarea(id, "CO", 1, co1)).toEqual({ error: MENSAJE_ARCHIVADO });
    expect(await registrarPaginas(id, [hoja.id])).toEqual({ error: MENSAJE_ARCHIVADO });
    expect(await elegirCuadernillo(id, null, null)).toEqual({ error: MENSAJE_ARCHIVADO });
    expect(await rellenarTarea(id, "CO", 1)).toEqual({ error: MENSAJE_ARCHIVADO });
  });

  // Mutación que la mata: dejar que publicarExamen publique un archivado.
  it("y no se publica", async () => {
    const id = await examenCompleto();
    await archivarExamen(id);
    expect(await publicarExamen(id)).toEqual({ error: "Un examen archivado no se publica." });
  });
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npm run test:base`
Expected: FAIL en las cuatro nuevas («archivarExamen is not a function» y el mensaje de retirar).

- [ ] **Step 3: Escribir la implementación**

```ts
// lib/taller/publicado.ts — sustituye a MENSAJE_PUBLICADO/ExamenPublicado/exigirEditable
export const MENSAJE_PUBLICADO = "El examen está publicado: retíralo para editarlo.";
export const MENSAJE_ARCHIVADO = "El examen está archivado: recupéralo para editarlo.";

/** Se lanza dentro de una transacción para deshacerla; quien la abrió devuelve su mensaje. */
export class ExamenNoEditable extends Error {
  constructor(estado: EstadoExamen) {
    super(estado === "ARCHIVADO" ? MENSAJE_ARCHIVADO : MENSAJE_PUBLICADO);
  }
}

/** Para las escrituras: bloquea y, si no se puede editar, deshace la transacción. */
export async function exigirEditable(tx: Prisma.TransactionClient, examenId: string): Promise<void> {
  const estado = await bloquearExamen(tx, examenId);
  if (estado === "PUBLICADO" || estado === "ARCHIVADO") throw new ExamenNoEditable(estado);
}
```

Los seis sitios que capturaban la excepción (cuatro en `paginas.ts`, uno en `examenes.ts`, uno en `cuadernillos.ts`) pasan de

```ts
if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };
```

a

```ts
if (error instanceof ExamenNoEditable) return { error: error.message };
```

y sus `import` cambian de `ExamenPublicado, MENSAJE_PUBLICADO` a `ExamenNoEditable` (si `MENSAJE_PUBLICADO` ya no se usa en ese fichero, se quita del import: el lint avisa).

`lib/taller/ia/rellenar.ts:95` no pasa por `exigirEditable`, mira el estado a mano:

```ts
if (examen.estado === "PUBLICADO") return { error: MENSAJE_PUBLICADO };
if (examen.estado === "ARCHIVADO") return { error: MENSAJE_ARCHIVADO };
```

Y en `lib/taller/examenes.ts`:

```ts
/** Devuelve un examen publicado a construcción. No deja si alguien lo tiene asignado. */
export async function retirarExamen(examenId: string): Promise<{ error?: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado !== "PUBLICADO") return { error: "Ese examen no está publicado." };
    // Dentro de la transacción que bloquea el examen: si no, una asignación que
    // entra a la vez se quedaría apuntando a un examen en construcción.
    const asignadas = await tx.asignacion.findMany({
      where: { examenId },
      include: { persona: { select: { nombre: true } } },
      orderBy: { persona: { nombre: "asc" } },
    });
    if (asignadas.length > 0) {
      return { error: `No se puede retirar: lo tienen asignado ${listaDeNombres(asignadas.map((a) => a.persona.nombre))}. Quítaselo antes.` };
    }
    await tx.examen.update({ where: { id: examenId }, data: { estado: "EN_CONSTRUCCION" } });
    return {};
  });
}

/**
 * Saca un examen de circulación. Solo desde construcción: así la comprobación de
 * asignaciones vive en un único sitio (retirar) y no hay que repetirla aquí.
 */
export async function archivarExamen(examenId: string): Promise<{ error?: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado === null) return { error: "Ese examen no existe." };
    if (estado === "ARCHIVADO") return {};
    if (estado === "PUBLICADO") return { error: "Retíralo antes de archivarlo." };
    await tx.examen.update({ where: { id: examenId }, data: { estado: "ARCHIVADO" } });
    return {};
  });
}

export async function recuperarExamen(examenId: string): Promise<{ error?: string }> {
  const r = await prisma.examen.updateMany({ where: { id: examenId, estado: "ARCHIVADO" }, data: { estado: "EN_CONSTRUCCION" } });
  return r.count === 1 ? {} : { error: "Ese examen no está archivado." };
}
```

`listaDeNombres` se importa de `@/lib/examen/asignar`.

- [ ] **Step 4: Correr las suites de base enteras**

Run: `npm run test:base`
Expected: PASS todo, incluidas las 99 de antes. Si alguna de las viejas se pone roja por el mensaje, **no cambiar la prueba vieja sin leerla**: `MENSAJE_PUBLICADO` no ha cambiado de texto.

- [ ] **Step 5: Correr también la suite normal**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: verde. `tsc` es quien caza los seis `catch` que se hayan quedado con el nombre viejo.

- [ ] **Step 6: Commit**

```bash
git add lib/taller/publicado.ts lib/taller/examenes.ts lib/taller/paginas.ts lib/taller/cuadernillos.ts lib/taller/ia/rellenar.ts tests/base
git commit -m "Retirar no deja con gente dentro; Archivar y Recuperar

El guardián de edición pasa a cubrir los dos estados: un archivado tampoco
se escribe, que era el agujero que abría Archivar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: La caja «Quién lo hace»

**Files:**
- Modify: `app/examenes/acciones.ts`
- Modify: `app/examenes/[id]/page.tsx` (la caja `data-publicacion`, línea 47, y una sección nueva detrás)
- Create: `components/taller/quien-lo-hace.tsx`
- Test: `tests/taller-acciones.test.ts` (añadir), `tests/taller-pantallas.test.ts` (añadir)

**Interfaces:**
- Consumes: `asignarExamen`, `quitarAsignacion`, `asignacionesDelExamen`, `estudiantesParaAsignar` (Task 4); `archivarExamen`, `recuperarExamen` (Task 5); `diaEnMadrid`, `fechaEnPalabras` (Task 1); `mandarPorSmtp`, `direccionDelSitio`, `exigirProfesor`, que ya existen.
- Produces:
  - `asignarExamenAccion(examenId: string, formulario: FormData): Promise<void>`
  - `quitarAsignacionAccion(examenId: string, personaId: string): Promise<void>`
  - `archivarExamenAccion(examenId: string): Promise<void>`
  - `recuperarExamenAccion(examenId: string): Promise<void>`
  - `<QuienLoHace examenId estudiantes asignaciones />`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// en tests/taller-acciones.test.ts: añadir los dobles nuevos al objeto `dobles`
//   asignarExamen: vi.fn(), quitarAsignacion: vi.fn(), archivarExamen: vi.fn(), recuperarExamen: vi.fn(),
// y los mocks:
// vi.mock("@/lib/examen/asignar", () => ({ asignarExamen: dobles.asignarExamen, quitarAsignacion: dobles.quitarAsignacion }));
// (archivarExamen y recuperarExamen van dentro del mock de "@/lib/taller/examenes" que ya existe)
// vi.mock("@/lib/correo/transporte", () => ({ mandarPorSmtp: vi.fn() }));

describe("las acciones de asignar exigen profesor", () => {
  // Mutación que la mata: borrar el `await exigirProfesor()` de cualquiera de las
  // cuatro. Una acción de servidor es una dirección pública: un estudiante que
  // sepa el nombre la llama sin pasar por la pantalla.
  it("un estudiante no asigna, no quita, no archiva y no recupera", async () => {
    dobles.cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    dobles.personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    const formulario = new FormData();
    formulario.append("estudiante", "e1");
    formulario.set("dia", "2026-10-20");

    await expect(asignarExamenAccion("x1", formulario)).rejects.toThrow("REDIRECT:/entrar");
    await expect(quitarAsignacionAccion("x1", "e1")).rejects.toThrow("REDIRECT:/entrar");
    await expect(archivarExamenAccion("x1")).rejects.toThrow("REDIRECT:/entrar");
    await expect(recuperarExamenAccion("x1")).rejects.toThrow("REDIRECT:/entrar");
    expect(dobles.asignarExamen).not.toHaveBeenCalled();
    expect(dobles.quitarAsignacion).not.toHaveBeenCalled();
  });

  // Mutación que la mata: leer formulario.get("estudiante") en vez de getAll, que
  // se quedaría con uno solo y dejaría sin examen a los otros once.
  it("el profesor asigna a todos los marcados y vuelve con el aviso", async () => {
    dobles.cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    dobles.personaDeLaCookie.mockResolvedValue(PROFESOR);
    dobles.asignarExamen.mockResolvedValue({ asignados: 2, sinAviso: ["Ana"] });
    const formulario = new FormData();
    formulario.append("estudiante", "e1");
    formulario.append("estudiante", "e2");
    formulario.set("dia", "2026-10-20");

    await expect(asignarExamenAccion("x1", formulario)).rejects.toThrow("REDIRECT:");
    expect(dobles.asignarExamen.mock.calls[0]!.slice(0, 4)).toEqual(["x1", ["e1", "e2"], "2026-10-20", PROFESOR.id]);
    expect(dobles.redirect.mock.calls[0]![0]).toContain("aviso=");
  });
});
```

```ts
// al final de tests/taller-pantallas.test.ts
// Añadir al mock de "@/app/examenes/acciones": asignarExamenAccion, quitarAsignacionAccion,
// archivarExamenAccion, recuperarExamenAccion (vi.fn() cada una: Vitest revienta si el
// componente importa una exportación que el doble no define).
// Añadir: vi.mock("@/lib/examen/asignar", () => ({ asignacionesDelExamen: dobles.asignacionesDelExamen, estudiantesParaAsignar: dobles.estudiantesParaAsignar }));

describe("la caja de quién hace el examen", () => {
  // `examenDePrueba()` y `sinError()` son los ayudantes que ese fichero ya usa
  // para todas las pruebas de esta pantalla; se reutilizan tal cual.
  const pintar = async (estado: string) => {
    dobles.cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    dobles.personaDeLaCookie.mockResolvedValue(PROFESOR);
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ estado }));
    return renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
  };

  beforeEach(() => {
    dobles.estudiantesParaAsignar.mockResolvedValue([{ id: "e1", nombre: "Ana", correo: "ana@ejemplo.com" }]);
    dobles.asignacionesDelExamen.mockResolvedValue([{ personaId: "e1", nombre: "Ana", fechaTope: new Date("2026-10-20T21:59:59.999Z") }]);
  });

  // Mutación que la mata: enseñar la caja también en construcción. El profesor
  // rellenaría un formulario que no puede funcionar.
  it("no sale si el examen no está publicado", async () => {
    const marcado = await pintar("EN_CONSTRUCCION");

    expect(marcado.length).toBeGreaterThan(200); // que no esté vacío: si no, cualquier ausencia pasa
    expect(marcado).not.toContain("Quién lo hace");
    expect(marcado).toContain("Archivar");
  });

  // Mutación que la mata: no pintar la fecha de quien ya lo tiene, o pintarla en
  // UTC (el 19 en vez del 20).
  it("publicado, lista a los estudiantes y a quien ya lo tiene con su fecha", async () => {
    const marcado = await pintar("PUBLICADO");

    expect(marcado).toContain("Quién lo hace");
    expect(marcado).toContain("Ana");
    expect(marcado).toContain("martes, 20 de octubre de 2026");
    // Quitárselo cambia algo: formulario POST, nunca un enlace.
    expect(marcado).not.toContain('href="/examenes/x1/quitar');
  });

  // Mutación que la mata: dejar las casillas marcadas de quien ya lo tiene.
  // Asignárselo a uno nuevo le cambiaría la fecha a los demás sin pedirlo.
  it("las casillas nacen vacías aunque ya lo tengan", async () => {
    expect(await pintar("PUBLICADO")).not.toContain("checked");
  });
});
```

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/taller-acciones.test.ts tests/taller-pantallas.test.ts`
Expected: FAIL, las acciones y la caja no existen.

- [ ] **Step 3: Escribir las acciones**

```ts
// app/examenes/acciones.ts
import { headers } from "next/headers";
import { mandarPorSmtp } from "@/lib/correo/transporte";
import { direccionDelSitio } from "@/lib/puerta/sitio";
import { asignarExamen, listaDeNombres, quitarAsignacion } from "@/lib/examen/asignar";
import { archivarExamen, recuperarExamen } from "@/lib/taller/examenes";

export async function asignarExamenAccion(examenId: string, formulario: FormData): Promise<void> {
  const profesor = await exigirProfesor();
  const personaIds = formulario.getAll("estudiante").map(String);
  const dia = String(formulario.get("dia") ?? "");
  const base = direccionDelSitio(await headers());
  const r = await asignarExamen(examenId, personaIds, dia, profesor.id, mandarPorSmtp, base, new Date());
  revalidatePath(pantallaDelExamen(examenId));
  if ("error" in r) redirect(`${pantallaDelExamen(examenId)}?error=${encodeURIComponent(r.error)}`);
  const aviso =
    r.sinAviso.length === 0
      ? `Asignado a ${r.asignados}.`
      : `Asignado a ${r.asignados}. No salió el aviso a ${listaDeNombres(r.sinAviso)}: díselo tú.`;
  redirect(`${pantallaDelExamen(examenId)}?aviso=${encodeURIComponent(aviso)}`);
}

export async function quitarAsignacionAccion(examenId: string, personaId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await quitarAsignacion(examenId, personaId));
}

export async function archivarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await archivarExamen(examenId));
}

export async function recuperarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await recuperarExamen(examenId));
}
```

- [ ] **Step 4: Escribir el componente**

```tsx
// components/taller/quien-lo-hace.tsx
"use client";

import { useState } from "react";
import { asignarExamenAccion, quitarAsignacionAccion } from "@/app/examenes/acciones";
import { fechaEnPalabras } from "@/lib/tiempo/madrid";

type Estudiante = { id: string; nombre: string };
type Asignada = { personaId: string; nombre: string; fechaTope: Date };

export function QuienLoHace({
  examenId,
  estudiantes,
  asignaciones,
}: {
  examenId: string;
  estudiantes: Estudiante[];
  asignaciones: Asignada[];
}) {
  // Nacen vacías a propósito, también las de quien ya lo tiene: si nacieran
  // marcadas, asignárselo a uno nuevo le cambiaría la fecha a los demás.
  const [marcados, setMarcados] = useState<string[]>([]);
  const fechaDe = new Map(asignaciones.map((a) => [a.personaId, a.fechaTope]));

  return (
    <div className="flex flex-col gap-4">
      <form action={asignarExamenAccion.bind(null, examenId)} className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setMarcados(marcados.length === estudiantes.length ? [] : estudiantes.map((e) => e.id))}
          className="self-start text-hp-600 underline"
        >
          {marcados.length === estudiantes.length ? "Desmarcar todos" : "Marcar todos"}
        </button>
        <ul className="flex flex-col gap-1">
          {estudiantes.map((e) => (
            <li key={e.id}>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="estudiante"
                  value={e.id}
                  checked={marcados.includes(e.id)}
                  onChange={() => setMarcados(marcados.includes(e.id) ? marcados.filter((x) => x !== e.id) : [...marcados, e.id])}
                />
                <span>{e.nombre}</span>
                {fechaDe.has(e.id) && <span className="text-sm text-tinta-suave">ya lo tiene para el {fechaEnPalabras(fechaDe.get(e.id)!)}</span>}
              </label>
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2">
          <span>Fecha tope</span>
          <input type="date" name="dia" required className="rounded-2xl border border-tinta-suave/30 px-3 py-2" />
        </label>
        <button type="submit" className="self-start rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white">Asignar</button>
      </form>

      {asignaciones.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-tinta-suave/20 pt-3">
          {asignaciones.map((a) => (
            <li key={a.personaId} className="flex items-center gap-3">
              <span>{a.nombre} — {fechaEnPalabras(a.fechaTope)}</span>
              {/* Formulario POST, nunca un enlace: la precarga de Next dispara sola los enlaces. */}
              <form action={quitarAsignacionAccion.bind(null, examenId, a.personaId)}>
                <button type="submit" className="text-hp-600 underline">Quitárselo</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Engancharlo en la pantalla**

En `app/examenes/[id]/page.tsx`:

1. leer también `aviso` de `searchParams` y pintarlo como el error, pero en verde (`bg-verde-100 text-verde-600`), con `role="status"`;
2. cargar los datos junto a los demás: `const [estudiantes, asignaciones] = await Promise.all([estudiantesParaAsignar(), asignacionesDelExamen(id)]);`
3. dentro de la caja «Publicación», añadir el botón de **Archivar** cuando el examen está en construcción (`archivarExamenAccion.bind(null, examen.id)`), y el de **Recuperar** cuando está archivado, con la frase «Archivado: fuera de circulación.»;
4. detrás de esa caja, la sección nueva:

```tsx
{publicado && (
  <section className={CAJA} data-asignacion>
    <h2 className="text-xl font-bold">Quién lo hace</h2>
    <QuienLoHace examenId={examen.id} estudiantes={estudiantes} asignaciones={asignaciones} />
  </section>
)}
```

- [ ] **Step 6: Correr las pruebas y verlas pasar**

Run: `npx vitest run tests/taller-acciones.test.ts tests/taller-pantallas.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/examenes/acciones.ts "app/examenes/[id]/page.tsx" components/taller/quien-lo-hace.tsx tests/taller-acciones.test.ts tests/taller-pantallas.test.ts
git commit -m "La caja «Quién lo hace», con Archivar y Recuperar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: El candado de los ficheros

**Files:**
- Create: `lib/ficheros/permisos.ts`
- Modify: `app/api/ficheros/[id]/route.ts`
- Create: `tests/ficheros-permisos.test.ts`
- Test: `tests/ficheros-rutas.test.ts` (añadir)

**Interfaces:**
- Consumes: el tipo `Papel` de `@/lib/generated/prisma`.
- Produces: `puedeVerFichero(persona: { id: string; papel: Papel }, fichero: { subidoPorId: string | null }): boolean`.

- [ ] **Step 1: Escribir la prueba de la regla**

```ts
// tests/ficheros-permisos.test.ts
import { describe, it, expect } from "vitest";
import { puedeVerFichero } from "@/lib/ficheros/permisos";

const PROFESOR = { id: "p1", papel: "PROFESOR" } as const;
const ANA = { id: "e1", papel: "ESTUDIANTE" } as const;

describe("quién puede abrir un fichero", () => {
  // Mutación que la mata: devolver true por defecto, que es como estaba la ruta
  // antes (cualquiera con sesión abría cualquier fichero por su id).
  it("el profesor sí, y un estudiante solo lo suyo", () => {
    expect(puedeVerFichero(PROFESOR, { subidoPorId: null })).toBe(true);
    expect(puedeVerFichero(PROFESOR, { subidoPorId: "e1" })).toBe(true);
    expect(puedeVerFichero(ANA, { subidoPorId: "e1" })).toBe(true);
  });

  // Mutación que la mata: comparar con !== , o dar por bueno el fichero sin dueño
  // (las páginas del examen tienen subidoPorId del profesor, pero las viejas
  // pueden tenerlo en nulo: un nulo NO es «de todos»).
  it("lo de otro y lo que no tiene dueño, no", () => {
    expect(puedeVerFichero(ANA, { subidoPorId: "e2" })).toBe(false);
    expect(puedeVerFichero(ANA, { subidoPorId: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Escribir la prueba de la ruta**

```ts
// al final del describe "GET /api/ficheros/[id]" de tests/ficheros-rutas.test.ts.
// Ese fichero ya tiene el doble `fichero` (con findUnique), la ayuda
// peticionDeLectura(id), y las personas ESTUDIANTE y PROFESOR: se usan tal cual.

// Mutación que la mata: quitar el `puedeVerFichero(...)` del `if` de la ruta. La
// regla suelta seguiría probada en tests/ficheros-permisos.test.ts y todo estaría
// verde con el candado en el suelo: probar la regla y no el sitio donde se aplica
// ya nos pilló tres veces.
it("un estudiante que pide una página de examen recibe el MISMO 404 que si no existiera", async () => {
  personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
  fichero.findUnique.mockResolvedValue({ id: "f4", almacen: "VERCEL", ruta: "material/examen-1-01.jpg", subidoPorId: PROFESOR.id });

  const respuesta = await peticionDeLectura("f4");

  expect(respuesta.status).toBe(404);
  // Un 403 confirmaría que ese id existe: el cuerpo tiene que ser idéntico al de
  // «no existe», que es el de la prueba de arriba.
  expect(await respuesta.json()).toEqual({ error: "No encontrado." });
  expect(enlaceDeLectura).not.toHaveBeenCalled();
});

// Mutación que la mata: invertir la comparación de papel.
it("el profesor sí recibe el enlace de esa misma página", async () => {
  personaDeLaPeticion.mockResolvedValue(PROFESOR);
  fichero.findUnique.mockResolvedValue({ id: "f4", almacen: "VERCEL", ruta: "material/examen-1-01.jpg", subidoPorId: PROFESOR.id });
  enlaceDeLectura.mockResolvedValue("https://blob.vercel-storage.com/lectura");

  expect((await peticionDeLectura("f4")).status).toBe(307);
});

// Mutación que la mata: mirar el dueño solo cuando es profesor, o no mirarlo.
it("un estudiante sí abre lo que subió él", async () => {
  personaDeLaPeticion.mockResolvedValue(ESTUDIANTE);
  fichero.findUnique.mockResolvedValue({ id: "f5", almacen: "VERCEL", ruta: "material/suyo.jpg", subidoPorId: ESTUDIANTE.id });
  enlaceDeLectura.mockResolvedValue("https://blob.vercel-storage.com/lectura");

  expect((await peticionDeLectura("f5")).status).toBe(307);
});
```

**Una prueba vieja de ese mismo fichero se pondrá roja, y es correcto:** «un fichero de
Vercel, 307 al enlace de lectura, sin caché» (línea ~285) usa a ESTUDIANTE con un fichero
sin dueño, que es justo lo que el candado prohíbe. Se cambia a PROFESOR, se deja su
comentario de mutación intacto, y **no se toca nada más**: si se pusiera roja otra, hay
que leerla antes de tocarla.

- [ ] **Step 3: Correrlas y verlas fallar**

Run: `npx vitest run tests/ficheros-permisos.test.ts tests/ficheros-rutas.test.ts`
Expected: FAIL; la de la ruta falla con 307 donde se espera 404, que es exactamente el agujero.

- [ ] **Step 4: Escribir la implementación**

```ts
// lib/ficheros/permisos.ts
import type { Papel } from "@/lib/generated/prisma";

/**
 * Lista blanca: lo que no está dicho aquí, NO se puede ver. Un fichero de un
 * tipo nuevo que nadie haya pensado queda fuera por defecto, que es el lado
 * seguro del error.
 *
 * Hoy el estudiante no abre nada del examen: la pantalla de hacerlo llega con la
 * 3c, y es ahí donde esta función ganará una rama más («esta pieza es de la
 * tarea que está haciendo ahora»).
 */
export function puedeVerFichero(
  persona: { id: string; papel: Papel },
  fichero: { subidoPorId: string | null },
): boolean {
  if (persona.papel === "PROFESOR") return true;
  return fichero.subidoPorId !== null && fichero.subidoPorId === persona.id;
}
```

Y en `app/api/ficheros/[id]/route.ts`, justo después de cargar el fichero:

```ts
const fichero = await prisma.fichero.findUnique({ where: { id } });
// El mismo 404, con el mismo cuerpo, para «no existe» y para «no es tuyo»: un
// 403 le confirmaría a quien prueba identificadores que ese existe.
if (!fichero || fichero.almacen !== "VERCEL" || !puedeVerFichero(persona, fichero)) {
  return NextResponse.json({ error: "No encontrado." }, { status: 404 });
}
```

- [ ] **Step 5: Correrlas y verlas pasar**

Run: `npx vitest run tests/ficheros-permisos.test.ts tests/ficheros-rutas.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/ficheros/permisos.ts "app/api/ficheros/[id]/route.ts" tests/ficheros-permisos.test.ts tests/ficheros-rutas.test.ts
git commit -m "El candado de los ficheros: lista blanca y 404, no 403

Cierra el agujero que la puerta dejó abierto a propósito: cualquiera con
sesión abría cualquier fichero de examen por su identificador.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Inicio del estudiante

**Files:**
- Modify: `app/page.tsx`
- Test: `tests/portada.test.ts`

**Interfaces:**
- Consumes: `asignacionesDe` (Task 4); `fechaEnPalabras`, `estaFueraDePlazo` (Task 1).
- Produces: nada que use otra tarea.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// en tests/portada.test.ts: añadir el doble
// const { ..., asignacionesDe } = vi.hoisted(() => ({ ..., asignacionesDe: vi.fn() }));
// vi.mock("@/lib/examen/asignar", () => ({ asignacionesDe }));
// y en beforeEach: asignacionesDe.mockResolvedValue([]);

const ASIGNADO = {
  examenId: "x1",
  titulo: "Examen 1",
  nivel: "A2_B1_ESCOLAR" as const,
  modo: "COMPLETO" as const,
  fechaTope: new Date("2026-10-20T21:59:59.999Z"),
};

describe("Inicio del estudiante", () => {
  // Mutación que la mata: no pintar la fecha, o pintarla sin huso (el servidor de
  // Vercel va en UTC y saldría el 19 de octubre).
  it("enseña el examen asignado con su fecha en palabras", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([ASIGNADO]);

    const marcado = await html();

    expect(marcado).toContain("Examen 1");
    expect(marcado).toContain("martes, 20 de octubre de 2026");
  });

  // Mutación que la mata: quitar la línea de «nada pendiente» y dejar la lista
  // vacía, que no dice si es que no hay nada o si es que falló.
  it("sin nada asignado lo dice en una línea", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([]);

    expect(await html()).toContain("No tienes nada pendiente");
  });

  // Mutación que la mata: no llamar a estaFueraDePlazo, o compararlo al revés.
  it("marca el que se pasó de plazo", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([{ ...ASIGNADO, fechaTope: new Date("2020-01-01T00:00:00Z") }]);

    expect(await html()).toContain("Se pasó el plazo");
  });

  // Mutación que la mata: dejar de mirar el papel para las pantallas de prueba.
  // Un estudiante no tiene nada que hacer en ellas.
  it("un estudiante no ve las pantallas de prueba y el profesor sí", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    const deAna = await html();
    expect(deAna.length).toBeGreaterThan(200); // que no esté vacío antes de creerse una ausencia
    expect(deAna).not.toContain('href="/pruebas/subir"');

    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    expect(await html()).toContain('href="/pruebas/subir"');
  });

  // Mutación que la mata: pedir las asignaciones también para el profesor y
  // pintarle tarjetas vacías en su portada.
  it("al profesor no se le piden asignaciones", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);

    await html();

    expect(asignacionesDe).not.toHaveBeenCalled();
  });
});
```

La prueba vieja «con sesión, saluda por su nombre y ofrece salir» espera `href="/pruebas/grabar"` con un ESTUDIANTE: hay que cambiarla para que use al PROFESOR, porque el comportamiento cambia a propósito. **Se cambia la prueba vieja solo en eso**, dejando su comentario de mutación.

- [ ] **Step 2: Correrlas y verlas fallar**

Run: `npx vitest run tests/portada.test.ts`
Expected: FAIL, no se pinta nada de las asignaciones.

- [ ] **Step 3: Escribir la pantalla**

```tsx
// app/page.tsx
import Link from "next/link";
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { asignacionesDe } from "@/lib/examen/asignar";
import { NOMBRE_DE_NIVEL } from "@/lib/dele/estructura";
import { estaFueraDePlazo, fechaEnPalabras } from "@/lib/tiempo/madrid";

export default async function Portada() {
  const persona = await personaDeLaPeticion();
  const esProfesor = persona?.papel === "PROFESOR";
  // Solo se piden si hacen falta: al profesor no se le pinta ninguna tarjeta.
  const asignaciones = persona && !esProfesor ? await asignacionesDe(persona.id) : [];
  const ahora = new Date();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-3xl font-extrabold">HispaProfe</h1>
      {!persona ? (
        <p><Link href="/entrar" className="text-hp-600 underline">Entrar</Link></p>
      ) : (
        <>
          <p>Hola, {persona.nombre}.</p>

          {!esProfesor &&
            (asignaciones.length === 0 ? (
              <p className="text-tinta-suave">No tienes nada pendiente.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {asignaciones.map((a) => (
                  <li key={a.examenId} className="rounded-2xl border border-tinta-suave/20 bg-white p-5">
                    <h2 className="text-xl font-bold">{a.titulo}</h2>
                    <p className="text-tinta-suave">{NOMBRE_DE_NIVEL[a.nivel]}</p>
                    <p>
                      {estaFueraDePlazo(a.fechaTope, ahora)
                        ? `Se pasó el plazo el ${fechaEnPalabras(a.fechaTope)}.`
                        : `Para el ${fechaEnPalabras(a.fechaTope)}.`}
                    </p>
                    {/* El botón de empezar llega con la 3c: hasta entonces se dice, no se
                        enseña un botón que no lleva a ninguna parte. */}
                    <p className="text-sm text-tinta-suave">Todavía no puedes empezarlo. Te avisaré cuando se abra.</p>
                  </li>
                ))}
              </ul>
            ))}

          <nav className="flex flex-col gap-1">
            {esProfesor && <Link href="/personas" className="text-hp-600 underline">Personas</Link>}
            {esProfesor && <Link href="/examenes" className="text-hp-600 underline">Exámenes</Link>}
            {esProfesor && <Link href="/pruebas/grabar" className="text-hp-600 underline">Prueba: grabar</Link>}
            {esProfesor && <Link href="/pruebas/subir" className="text-hp-600 underline">Prueba: subir</Link>}
            <form action="/salir" method="post">
              <button type="submit" className="underline">Salir</button>
            </form>
          </nav>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Correrlas y verlas pasar**

Run: `npx vitest run tests/portada.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx tests/portada.test.ts
git commit -m "Inicio del estudiante: qué tengo que hacer y para cuándo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Cierre (la hace el controlador, no un subagente)

**Files:** ninguno nuevo.

- [ ] **Step 1: Las cuatro medidas, enteras**

```bash
npm test
npm run test:base
npx tsc --noEmit
npm run lint
```

Esperado: `npm test` por encima de 424 + 1 omitida, `test:base` por encima de 99, `tsc` sin salida, lint 0 errores. **Apuntar las cifras**: son las que van al mensaje de fusión y a la memoria.

- [ ] **Step 2: Revisión de toda la rama**

Usar `superpowers:requesting-code-review` sobre el diff completo contra `main`. Atención especial a: que ninguna prueba compare mensajes por subcadena, que ninguna dé por buena una ausencia sin comprobar antes que lo pintado no está vacío, y que el candado de la ruta muera al mutarlo.

- [ ] **Step 3: Enseñárselo al profesor y fusionar con su sí**

Fusionar en `main`, empujar **el commit medido** (`git push origin <sha>:main`), y comprobar que Vercel despliega en verde: el build es `prisma migrate deploy && next build`, así que la migración de asignaciones se aplica sola contra Neon.

- [ ] **Step 4: La aceptación en producción (sección 11 de la spec)**

1. Dar de alta un estudiante de prueba con un correo del profesor distinto del suyo de entrar.
2. Asignarle el examen 1 con fecha; ver el aviso «Asignado a 1.»
3. Que el correo llegue de verdad y que el enlace lleve a la portada.
4. Entrar con esa cuenta: la tarjeta, con la fecha en palabras.
5. Desde esa cuenta, pedir a mano `/api/ficheros/<id de una página del examen 1>` → **404**.
6. Intentar Retirar: no deja, y dice el nombre.
7. Quitar la asignación, retirar, archivar, recuperar.

- [ ] **Step 5: Cerrar la carpeta**

Copiar `.superpowers/sdd/<carpeta>` a `~/.claude/projects/-Users-FLE/ledgers-preservados/` **antes** de `git worktree remove` (`remove` lo borra sin aviso y sin Papelera), y actualizar la memoria `hispaprofe-dele-taller-entrega-3` con lo que haya salido.

---

## Repaso del plan contra la spec

| Sección de la spec | Tarea |
|---|---|
| 2. La asignación (tabla, unicidad) | Task 3 |
| 3. La fecha tope y el huso de Madrid | Task 1 |
| 4. La pantalla «Quién lo hace» | Task 6 |
| 5. El correo de aviso | Tasks 2 y 4 |
| 6. Retirar, Archivar y el guardián de edición | Task 5 |
| 7. Inicio del estudiante | Task 8 |
| 8. El candado de los ficheros | Task 7 |
| 9. Errores (los ocho mensajes) | Tasks 4, 5 y 6 |
| 10. Cómo se prueba (las nueve) | Repartidas: 1→T7, 2→T7, 3→T1, 4→T5, 5→T3/T4, 6→T5, 7→T8, 8→T2/T4, 9→T6 |
| 11. Aceptación en producción | Task 9 |
