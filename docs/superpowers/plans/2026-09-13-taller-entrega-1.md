# El taller, Entrega 1: cargar un examen a mano · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el profesor cree un examen, suba su PDF, etiquete las páginas, elija el cuadernillo de soluciones y rellene a mano las catorce tareas, con las respuestas correctas sacadas del cuadernillo y sin IA.

**Architecture:** Reglas puras en `lib/dele/estructura.ts` (una forma por tarea y por nivel) y en `lib/taller/*` (esquemas estrictos del formulario, estado de la tarea, lector de soluciones, paso de formulario a piezas). Una capa fina de base en `lib/taller/examenes.ts`, `paginas.ts` y `cuadernillos.ts`. Acciones de servidor con candado en `app/examenes/acciones.ts`. El PDF nunca pasa por el servidor: el navegador lo parte en imágenes que suben directas al almacén, y del cuadernillo solo manda trozos de texto con su posición.

**Tech Stack:** Next 16 (App Router, acciones de servidor), React 19, Prisma 7 con `@prisma/adapter-pg`, Zod 4, Vitest 3, Tailwind 4, `@vercel/blob` 2.8, `pdfjs-dist` 5.7.284.

**Spec:** `docs/superpowers/specs/2026-09-13-taller-entrega-1-design.md`

## Global Constraints

- Todo texto que ve una persona, en español. Los motivos dicen qué falta y dónde.
- **El repositorio es PÚBLICO.** Ni el cuadernillo, ni sus textos, ni las páginas del libro, ni letras reales de sus soluciones entran en el repo. Los datos de prueba son inventados.
- **Ninguna respuesta correcta en `Actividad.datos`.** Las respuestas van en `Clave.respuestas` como `{ "13": "B" }`.
- Esquemas con `z.strictObject` (Zod 4): un campo que el esquema no conoce hace rebotar.
- Toda pantalla y toda acción del taller empiezan por `await exigirProfesor()`. Un estudiante recibe el 404.
- Nada que cambie datos es un GET.
- Prisma 7: la conexión no va en `schema.prisma`; las migraciones se generan contra un Postgres de usar y tirar (Tarea 1).
- Pruebas: `npm test` (sin base) y `npm run test:base` (contra Postgres). Tipos: `npx tsc --noEmit`. Hoy pasan 133 pruebas en 22 ficheros.
- Cada prueba nueva lleva un comentario «Mutación que la mata: …». Comprobar a mano al menos una por tarea.
- `pdfjs-dist` fijado a `5.7.284` exacto.
- Mensajes de commit con heredoc de comillas simples (`git commit -F - <<'EOF'`): zsh se come los acentos graves dentro de comillas dobles. Cada commit termina con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
  ```
- Se trabaja en un worktree propio (skill `abrir-rama-en-worktree`), rama `taller-1`. No se fusiona ni se empuja sin el «sí» del profesor.

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | `Nivel.A2_B1_ESCOLAR`, `TipoActividad.CONVERSACION`, `Cuadernillo`, `PaginaDeExamen`, campos nuevos de `Examen` |
| `lib/dele/estructura.ts` | Reglas por nivel: ítems, primer número, forma, letras, ejemplo; nombres y etiquetas |
| `lib/examen/publicar.ts` | `motivosParaNoPublicar(nivel, tareas)` |
| `lib/taller/formas.ts` | Esquemas del formulario por forma, `fallosDeForma`, `formularioVacio`, `TIPO_DE_ACTIVIDAD` |
| `lib/taller/trozos.ts` | `Trozo` y `trozosDeDocumento` (sirve en navegador y en Node) |
| `lib/taller/soluciones.ts` | `leerSoluciones`, `resumenDeSoluciones`, `textoDeTrozos`, `trozosSchema` |
| `lib/taller/estado.ts` | Motivos, estado de la tarea, clave a partir del cuadernillo |
| `lib/taller/piezas.ts` | Formulario ⇄ piezas de la base |
| `lib/taller/examenes.ts` | Crear examen, leer examen y tarea para el taller, guardar tarea |
| `lib/taller/paginas.ts` | Registrar, etiquetar y borrar páginas |
| `lib/taller/cuadernillos.ts` | Guardar, listar y elegir cuadernillo |
| `lib/ficheros/vercel.ts` | + `borrarDeVercel` |
| `lib/ficheros/subir-desde-navegador.ts` | Permiso → PUT → confirmar, sacado de `/pruebas/subir` |
| `lib/taller/pdf-en-navegador.ts` | PDF → imágenes y PDF → trozos, solo navegador |
| `lib/taller/lista-de-subida.ts`, `etiquetas.ts`, `editar.ts` | Ayudas puras de los componentes |
| `app/examenes/acciones.ts` | Las siete acciones con candado |
| `app/examenes/page.tsx`, `[id]/page.tsx`, `[id]/[prueba]/[numero]/page.tsx` | Pantallas |
| `components/taller/*` | Componentes de cliente |
| `tests/ayudas/cuadernillo-inventado.ts` | Tabla de soluciones inventada con la forma de la real |

---

### Task 1: El modelo del taller

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<fecha>_taller_entrega_1/migration.sql` (la genera Prisma)
- Test: `tests/base/modelo-taller.test.ts`

**Interfaces:**
- Produces: modelos `Cuadernillo { id, titulo, texto, soluciones: Json, createdAt, examenes }`, `PaginaDeExamen { id, examenId, ficheroId, orden, etiquetas: String[] }`; `Examen.cuadernilloId?`, `Examen.numeroEnCuadernillo?`, `Examen.paginas`; `Fichero.paginas`; `Nivel.A2_B1_ESCOLAR`; `TipoActividad.CONVERSACION`.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/base/modelo-taller.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

// Orden de limpieza: las páginas apuntan a ficheros con Restrict, y el
// examen se lleva por cascada tareas, piezas y actividades.
beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

function unFichero(ruta = "material/pagina-1.jpg") {
  return prisma.fichero.create({
    data: { almacen: "VERCEL", ruta, tipoMime: "image/jpeg", bytes: 10 },
  });
}

function unExamen() {
  return prisma.examen.create({ data: { titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" } });
}

describe("el modelo del taller", () => {
  // Mutación que la mata: quitar A2_B1_ESCOLAR del enum Nivel.
  it("un examen del A2/B1 escolar se guarda", async () => {
    const examen = await unExamen();
    expect(examen.nivel).toBe("A2_B1_ESCOLAR");
  });

  // Mutación que la mata: onDelete Restrict o SetNull en PaginaDeExamen.examen.
  it("borrar el examen se lleva sus páginas", async () => {
    const examen = await unExamen();
    const fichero = await unFichero();
    await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: fichero.id, orden: 1 } });
    await prisma.examen.delete({ where: { id: examen.id } });
    expect(await prisma.paginaDeExamen.count()).toBe(0);
  });

  // Mutación que la mata: quitar @@unique([examenId, orden]).
  it("dos páginas con el mismo orden en un examen rebotan", async () => {
    const examen = await unExamen();
    const a = await unFichero("material/a.jpg");
    const b = await unFichero("material/b.jpg");
    await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: a.id, orden: 1 } });
    await expect(
      prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: b.id, orden: 1 } }),
    ).rejects.toThrow();
  });

  // Mutación que la mata: onDelete Cascade en PaginaDeExamen.fichero.
  it("no se puede borrar un fichero que es página de un examen", async () => {
    const examen = await unExamen();
    const fichero = await unFichero();
    await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: fichero.id, orden: 1 } });
    await expect(prisma.fichero.delete({ where: { id: fichero.id } })).rejects.toThrow();
  });

  // Mutación que la mata: onDelete SetNull en Examen.cuadernillo.
  it("no se puede borrar un cuadernillo que usa un examen", async () => {
    const cuadernillo = await prisma.cuadernillo.create({
      data: { titulo: "Inventado", texto: "SOLUCIONES", soluciones: {} },
    });
    await prisma.examen.create({
      data: { titulo: "Con cuadernillo", nivel: "A2_B1_ESCOLAR", cuadernilloId: cuadernillo.id, numeroEnCuadernillo: 1 },
    });
    await expect(prisma.cuadernillo.delete({ where: { id: cuadernillo.id } })).rejects.toThrow();
  });

  // Mutación que la mata: quitar CONVERSACION del enum TipoActividad.
  it("una actividad puede ser una conversación en directo", async () => {
    const examen = await unExamen();
    const tarea = await prisma.tarea.create({ data: { examenId: examen.id, prueba: "EO", numero: 2 } });
    const pieza = await prisma.pieza.create({ data: { tareaId: tarea.id, orden: 0, tipo: "ACTIVIDAD" } });
    const actividad = await prisma.actividad.create({
      data: { piezaId: pieza.id, tipo: "CONVERSACION", datos: { forma: "ORAL_DIRECTO" } },
    });
    expect(actividad.tipo).toBe("CONVERSACION");
  });

  it("las etiquetas de una página nacen vacías", async () => {
    const examen = await unExamen();
    const fichero = await unFichero();
    const pagina = await prisma.paginaDeExamen.create({ data: { examenId: examen.id, ficheroId: fichero.id, orden: 1 } });
    expect(pagina.etiquetas).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm run test:base -- tests/base/modelo-taller.test.ts`
Expected: FAIL (errores de tipos o `prisma.paginaDeExamen` inexistente).

- [ ] **Step 3: Cambiar el esquema**

En `prisma/schema.prisma`:

```prisma
enum Nivel {
  /// El DELE A2/B1 para escolares: un examen único con sus propios números.
  A2_B1_ESCOLAR
  A1
  A2
  B1
  B2
}
```

```prisma
enum TipoActividad {
  OPCION
  HUECOS
  ORDENAR
  RELACIONAR
  REDACCION
  GRABACION
  /// Oral en directo con el profesor (tareas 2 y 4): no hay nada que grabar.
  CONVERSACION
}
```

Sustituir `model Examen` por:

```prisma
model Examen {
  id        String       @id @default(cuid())
  titulo    String
  nivel     Nivel
  estado    EstadoExamen @default(EN_CONSTRUCCION)
  tareas    Tarea[]
  paginas   PaginaDeExamen[]

  /// De dónde salen las respuestas correctas, y qué examen del libro es.
  cuadernillo         Cuadernillo? @relation(fields: [cuadernilloId], references: [id], onDelete: Restrict)
  cuadernilloId       String?
  numeroEnCuadernillo Int?

  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([estado])
}

/// El cuadernillo de soluciones de un libro. Uno por libro, lo usan sus seis
/// exámenes. El PDF no se guarda: solo su texto y la tabla de soluciones.
model Cuadernillo {
  id         String   @id @default(cuid())
  titulo     String
  texto      String
  /// { "1": { "CE": { "13": "B" }, "CO": { ... } } }
  soluciones Json
  createdAt  DateTime @default(now())

  examenes Examen[]
}

/// Una hoja del PDF de un examen, con las tareas que contiene.
model PaginaDeExamen {
  id        String   @id @default(cuid())
  examen    Examen   @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId  String
  fichero   Fichero  @relation(fields: [ficheroId], references: [id], onDelete: Restrict)
  ficheroId String
  orden     Int
  /// "CE-1" … "EO-4". Una hoja puede llevar el final de una tarea y el principio de otra.
  etiquetas String[] @default([])

  @@unique([examenId, orden])
  @@index([examenId])
}
```

En `model Fichero`, debajo de `piezas Pieza[]`:

```prisma
  paginas PaginaDeExamen[]
```

- [ ] **Step 4: Generar la migración contra un Postgres de usar y tirar**

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
D="$PWD/.tmp/pg-migrar"
rm -rf "$D" && initdb -D "$D" -U postgres --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$D" -o "-p 55433 -k $D" -l "$D/log" start && sleep 2
psql -h 127.0.0.1 -p 55433 -U postgres -c "create database migrar"
DATABASE_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
DIRECT_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
  npx prisma migrate dev --name taller_entrega_1 --create-only
pg_ctl -D "$D" stop -m fast; rm -rf "$D"
```

Revisar el `migration.sql`: tiene que traer `ALTER TYPE "Nivel" ADD VALUE`, `ALTER TYPE "TipoActividad" ADD VALUE`, las dos tablas nuevas y las dos columnas de `Examen`. Nada de `DROP`.

- [ ] **Step 5: Correr y ver que pasa**

Run: `npm run test:base`
Expected: PASS, las de antes más las 7 nuevas.

Run: `npx prisma generate && npm test`
Expected: PASS, 133.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/base/modelo-taller.test.ts
git commit -q -F - <<'EOF'
Modelo del taller: cuadernillo, páginas de examen y nivel escolar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 2: La estructura, por nivel

**Files:**
- Modify: `lib/dele/estructura.ts` (reescrito entero)
- Modify: `lib/examen/publicar.ts`
- Test: `tests/estructura.test.ts` (reescrito), `tests/publicar.test.ts`

**Interfaces:**
- Consumes: `Nivel`, `Prueba` del cliente generado (Tarea 1).
- Produces:
  - `type Forma = "RELACIONAR" | "LISTA_COMUN" | "OPCIONES" | "HUECOS" | "REDACCION_UNA" | "REDACCION_DOS" | "ORAL_SOLO" | "ORAL_DIRECTO"`
  - `type ReglaTarea = { numero; items: number|null; primero: number|null; forma: Forma; ejemplo: boolean; letras: number; textos: number; elementosConTexto?: boolean; itemsConImagen?: number; grupos?: number; opcionesConImagen?: boolean; hermana?: number }`
  - `type EstructuraDeNivel = Readonly<Record<Prueba, ReadonlyArray<Readonly<ReglaTarea>>>>`
  - `ESTRUCTURAS: Record<Nivel, EstructuraDeNivel | null>`, `nivelesConReglas(): Nivel[]`
  - `reglaDe(nivel, prueba, numero): ReglaTarea | null`
  - `PRUEBAS`, `esPrueba(v: string): v is Prueba`, `NOMBRE_DE_PRUEBA`, `NOMBRE_DE_NIVEL`
  - `letrasHasta(n): string[]`, `etiquetaDeTarea(prueba, numero): string`, `etiquetasDeNivel(nivel): string[]`, `nombreCortoDeTarea(prueba, numero): string`, `nombreDeEtiqueta(etiqueta): string`
  - `motivosParaNoPublicar(nivel: Nivel, tareas: TareaParaRevisar[]): string[]`

- [ ] **Step 1: Reescribir la prueba de la estructura**

```ts
// tests/estructura.test.ts
import { describe, it, expect } from "vitest";
import {
  ESTRUCTURAS,
  PRUEBAS,
  esPrueba,
  etiquetasDeNivel,
  letrasHasta,
  nivelesConReglas,
  nombreDeEtiqueta,
  reglaDe,
} from "@/lib/dele/estructura";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

describe("la estructura del A2/B1 escolar", () => {
  it("la comprensión de lectura son 4 tareas de 6, 6, 6 y 7 ítems", () => {
    expect(ESCOLAR.CE.map((r) => r.items)).toEqual([6, 6, 6, 7]);
  });

  it("la comprensión auditiva son 4 tareas de 7, 6, 6 y 6 ítems", () => {
    expect(ESCOLAR.CO.map((r) => r.items)).toEqual([7, 6, 6, 6]);
  });

  // La numeración del libro va seguida dentro de cada prueba: es lo que
  // permite casar cada ítem con su respuesta del cuadernillo.
  // Mutación que la mata: cambiar el primero de CE3 a 12.
  it("el primer número de cada tarea sigue a la anterior", () => {
    for (const prueba of ["CE", "CO"] as const) {
      let siguiente = 1;
      for (const regla of ESCOLAR[prueba]) {
        expect(regla.primero).toBe(siguiente);
        siguiente += regla.items!;
      }
      expect(siguiente).toBe(26);
    }
  });

  it("escrita y oral son de respuesta abierta, sin números ni letras", () => {
    for (const regla of [...ESCOLAR.EE, ...ESCOLAR.EO]) {
      expect(regla.items).toBeNull();
      expect(regla.primero).toBeNull();
      expect(regla.letras).toBe(0);
    }
    expect(ESCOLAR.EE).toHaveLength(2);
    expect(ESCOLAR.EO).toHaveLength(4);
  });

  // Comprobado contra las páginas: diez destinos A-J y un ejemplo resuelto.
  it("Lectura 1 y Auditiva 2 relacionan con diez letras y traen ejemplo", () => {
    for (const regla of [reglaDe("A2_B1_ESCOLAR", "CE", 1)!, reglaDe("A2_B1_ESCOLAR", "CO", 2)!]) {
      expect(regla.forma).toBe("RELACIONAR");
      expect(regla.letras).toBe(10);
      expect(regla.ejemplo).toBe(true);
    }
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 1)!.elementosConTexto).toBe(true);
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 2)!.elementosConTexto).toBe(false);
  });

  it("llevan ejemplo exactamente CE1, CO1, CO2 y CO3", () => {
    const conEjemplo = PRUEBAS.flatMap((p) => ESCOLAR[p].filter((r) => r.ejemplo).map((r) => `${p}-${r.numero}`));
    expect(conEjemplo).toEqual(["CE-1", "CO-1", "CO-2", "CO-3"]);
  });

  it("las orales en directo van con su oral en solitario", () => {
    const eo = (n: number) => reglaDe("A2_B1_ESCOLAR", "EO", n)!;
    expect(eo(2)).toMatchObject({ forma: "ORAL_DIRECTO", hermana: 1 });
    expect(eo(4)).toMatchObject({ forma: "ORAL_DIRECTO", hermana: 3 });
    expect(eo(1)).toMatchObject({ forma: "ORAL_SOLO", opcionesConImagen: true });
    expect(eo(3)).toMatchObject({ forma: "ORAL_SOLO", opcionesConImagen: false });
  });

  it("Auditiva 1 tiene imágenes en las cuatro primeras y Auditiva 4 tres noticias", () => {
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 1)!.itemsConImagen).toBe(4);
    expect(reglaDe("A2_B1_ESCOLAR", "CO", 4)!.grupos).toBe(3);
  });
});

describe("los niveles", () => {
  // Mutación que la mata: poner las reglas del escolar también en B1.
  it("solo el escolar tiene reglas hoy", () => {
    expect(nivelesConReglas()).toEqual(["A2_B1_ESCOLAR"]);
    expect(reglaDe("B1", "CE", 1)).toBeNull();
  });

  it("reglaDe devuelve null para una tarea que no existe", () => {
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 5)).toBeNull();
    expect(reglaDe("A2_B1_ESCOLAR", "CE", 0)).toBeNull();
  });
});

describe("nombres y etiquetas", () => {
  it("letrasHasta da las letras en orden", () => {
    expect(letrasHasta(3)).toEqual(["A", "B", "C"]);
    expect(letrasHasta(10).at(-1)).toBe("J");
  });

  it("las etiquetas del escolar son las catorce, en orden de prueba", () => {
    expect(etiquetasDeNivel("A2_B1_ESCOLAR")).toEqual([
      "CE-1", "CE-2", "CE-3", "CE-4", "CO-1", "CO-2", "CO-3", "CO-4",
      "EE-1", "EE-2", "EO-1", "EO-2", "EO-3", "EO-4",
    ]);
    expect(etiquetasDeNivel("B2")).toEqual([]);
  });

  it("una etiqueta se lee sin jerga", () => {
    expect(nombreDeEtiqueta("CE-3")).toBe("Lectura 3");
    expect(nombreDeEtiqueta("EO-2")).toBe("Oral 2");
  });

  it("esPrueba solo acepta las cuatro", () => {
    expect(esPrueba("CO")).toBe(true);
    expect(esPrueba("XX")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/estructura.test.ts`
Expected: FAIL («ESTRUCTURAS is not exported» o similar).

- [ ] **Step 3: Reescribir `lib/dele/estructura.ts`**

```ts
import type { Nivel, Prueba } from "@/lib/generated/prisma";

/** Cómo es el formulario de una tarea. Una por formato del DELE. */
export type Forma =
  | "RELACIONAR"
  | "LISTA_COMUN"
  | "OPCIONES"
  | "HUECOS"
  | "REDACCION_UNA"
  | "REDACCION_DOS"
  | "ORAL_SOLO"
  | "ORAL_DIRECTO";

export type ReglaTarea = {
  numero: number;
  /** Ítems que cuentan. null = respuesta abierta. El ejemplo no cuenta. */
  items: number | null;
  /** Número del libro del primer ítem. null en las abiertas. */
  primero: number | null;
  forma: Forma;
  /** Si la tarea trae un ejemplo resuelto (el «0»). */
  ejemplo: boolean;
  /** Letras entre las que se elige: 3 (A-C) o, en relacionar, los destinos (10, A-J). 0 en las abiertas. */
  letras: number;
  /** Textos sueltos que se copian además de la actividad (CE2: 3 personas; CE3: el texto largo). */
  textos: number;
  /** RELACIONAR: si cada elemento y el ejemplo llevan texto (CE1 sí; CO2 son «Mensaje 1-6»). */
  elementosConTexto?: boolean;
  /** OPCIONES: cuántos ítems, desde el primero, tienen las opciones en imagen. El ejemplo, si lo hay, también. */
  itemsConImagen?: number;
  /** OPCIONES: en cuántos grupos iguales se reparten los ítems (CO4: tres noticias). */
  grupos?: number;
  /** ORAL_SOLO: si cada opción lleva foto. */
  opcionesConImagen?: boolean;
  /** ORAL_DIRECTO: el número de la tarea con la que va emparejada por tema. */
  hermana?: number;
};

export type EstructuraDeNivel = Readonly<Record<Prueba, ReadonlyArray<Readonly<ReglaTarea>>>>;

/**
 * Contrastado contra las páginas de los exámenes 1 y 2 del libro y contra el
 * Modelo 0 y mayo 2015 del Cervantes. Los números viven aquí y no en el
 * modelo: el modelo tiene que servir mañana a un examen armado a mano.
 */
const ESCOLAR: EstructuraDeNivel = {
  CE: [
    { numero: 1, items: 6, primero: 1, forma: "RELACIONAR", ejemplo: true, letras: 10, textos: 0, elementosConTexto: true },
    { numero: 2, items: 6, primero: 7, forma: "LISTA_COMUN", ejemplo: false, letras: 3, textos: 3 },
    { numero: 3, items: 6, primero: 13, forma: "OPCIONES", ejemplo: false, letras: 3, textos: 1 },
    { numero: 4, items: 7, primero: 19, forma: "HUECOS", ejemplo: false, letras: 3, textos: 0 },
  ],
  CO: [
    { numero: 1, items: 7, primero: 1, forma: "OPCIONES", ejemplo: true, letras: 3, textos: 0, itemsConImagen: 4 },
    { numero: 2, items: 6, primero: 8, forma: "RELACIONAR", ejemplo: true, letras: 10, textos: 0, elementosConTexto: false },
    { numero: 3, items: 6, primero: 14, forma: "LISTA_COMUN", ejemplo: true, letras: 3, textos: 0 },
    { numero: 4, items: 6, primero: 20, forma: "OPCIONES", ejemplo: false, letras: 3, textos: 0, grupos: 3 },
  ],
  EE: [
    { numero: 1, items: null, primero: null, forma: "REDACCION_UNA", ejemplo: false, letras: 0, textos: 0 },
    { numero: 2, items: null, primero: null, forma: "REDACCION_DOS", ejemplo: false, letras: 0, textos: 0 },
  ],
  EO: [
    { numero: 1, items: null, primero: null, forma: "ORAL_SOLO", ejemplo: false, letras: 0, textos: 0, opcionesConImagen: true },
    { numero: 2, items: null, primero: null, forma: "ORAL_DIRECTO", ejemplo: false, letras: 0, textos: 0, hermana: 1 },
    { numero: 3, items: null, primero: null, forma: "ORAL_SOLO", ejemplo: false, letras: 0, textos: 0, opcionesConImagen: false },
    { numero: 4, items: null, primero: null, forma: "ORAL_DIRECTO", ejemplo: false, letras: 0, textos: 0, hermana: 3 },
  ],
};

/** null = ese nivel todavía no tiene sus números: no se carga en el taller ni se publica. */
export const ESTRUCTURAS: Readonly<Record<Nivel, EstructuraDeNivel | null>> = {
  A2_B1_ESCOLAR: ESCOLAR,
  A1: null,
  A2: null,
  B1: null,
  B2: null,
};

export const PRUEBAS: readonly Prueba[] = ["CE", "CO", "EE", "EO"];

export function esPrueba(valor: string): valor is Prueba {
  return (PRUEBAS as readonly string[]).includes(valor);
}

export function nivelesConReglas(): Nivel[] {
  return (Object.keys(ESTRUCTURAS) as Nivel[]).filter((n) => ESTRUCTURAS[n] !== null);
}

export function reglaDe(nivel: Nivel, prueba: Prueba, numero: number): Readonly<ReglaTarea> | null {
  return ESTRUCTURAS[nivel]?.[prueba].find((r) => r.numero === numero) ?? null;
}

export const NOMBRE_DE_PRUEBA: Record<Prueba, string> = {
  CE: "comprensión de lectura",
  CO: "comprensión auditiva",
  EE: "expresión escrita",
  EO: "expresión oral",
};

const NOMBRE_CORTO: Record<Prueba, string> = { CE: "Lectura", CO: "Auditiva", EE: "Escrita", EO: "Oral" };

export const NOMBRE_DE_NIVEL: Record<Nivel, string> = {
  A2_B1_ESCOLAR: "A2/B1 escolar",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
};

export function letrasHasta(n: number): string[] {
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
}

export function etiquetaDeTarea(prueba: Prueba, numero: number): string {
  return `${prueba}-${numero}`;
}

export function etiquetasDeNivel(nivel: Nivel): string[] {
  const estructura = ESTRUCTURAS[nivel];
  if (!estructura) return [];
  return PRUEBAS.flatMap((p) => estructura[p].map((r) => etiquetaDeTarea(p, r.numero)));
}

export function nombreCortoDeTarea(prueba: Prueba, numero: number): string {
  return `${NOMBRE_CORTO[prueba]} ${numero}`;
}

export function nombreDeEtiqueta(etiqueta: string): string {
  const [prueba, numero] = etiqueta.split("-");
  return esPrueba(prueba) ? nombreCortoDeTarea(prueba, Number(numero)) : etiqueta;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/estructura.test.ts`
Expected: PASS.

- [ ] **Step 5: Adaptar la prueba de publicar**

En `tests/publicar.test.ts`, cambiar cada `motivosParaNoPublicar(` por `motivosParaNoPublicar("A2_B1_ESCOLAR", ` (ocho sitios) y añadir al final del `describe`:

```ts
  // Mutación que la mata: no mirar si el nivel tiene reglas (un examen de B2
  // se publicaría con las reglas de nadie, o reventaría).
  it("un nivel sin números no se publica", () => {
    const motivos = motivosParaNoPublicar("B2", examenCompleto());
    expect(motivos).toEqual(["Este nivel (B2) todavía no tiene sus números: no se puede publicar."]);
  });
```

Run: `npx vitest run tests/publicar.test.ts`
Expected: FAIL (firma vieja).

- [ ] **Step 6: Adaptar `lib/examen/publicar.ts`**

Sustituir la cabecera y el principio de la función:

```ts
import type { Nivel, Prueba } from "@/lib/generated/prisma";
import { ESTRUCTURAS, NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, PRUEBAS } from "@/lib/dele/estructura";

export type TareaParaRevisar = { prueba: Prueba; numero: number; items: number };

const NOMBRE = NOMBRE_DE_PRUEBA;

/**
 * Por qué este examen no se puede publicar todavía. Lista vacía = se puede.
 *
 * Es la red que caza los errores de la IA al transcribir: una tarea a la que le
 * falta un ítem, o que se coló dos veces, no llega nunca al estudiante.
 */
export function motivosParaNoPublicar(nivel: Nivel, tareas: TareaParaRevisar[]): string[] {
  const estructura = ESTRUCTURAS[nivel];
  if (!estructura) {
    return [`Este nivel (${NOMBRE_DE_NIVEL[nivel]}) todavía no tiene sus números: no se puede publicar.`];
  }
  const motivos: string[] = [];

  for (const prueba of PRUEBAS) {
    for (const regla of estructura[prueba]) {
```

y en el segundo bucle cambiar `reglaDe(tarea.prueba, tarea.numero) === null` por:

```ts
    if (!estructura[tarea.prueba].some((r) => r.numero === tarea.numero)) {
```

Borrar la constante `NOMBRE` vieja (ya viene de la estructura) y el import de `reglaDe`.

- [ ] **Step 7: Correr todo**

Run: `npx vitest run tests/publicar.test.ts tests/estructura.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 8: Commit**

```bash
git add lib/dele/estructura.ts lib/examen/publicar.ts tests/estructura.test.ts tests/publicar.test.ts
git commit -q -F - <<'EOF'
Estructura por nivel: forma, primer número y letras de cada tarea

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 3: Las formas del formulario

**Files:**
- Create: `lib/taller/formas.ts`
- Test: `tests/taller-formas.test.ts`

**Interfaces:**
- Consumes: `Forma`, `ReglaTarea`, `letrasHasta` (Tarea 2); `TipoActividad` (Tarea 1).
- Produces:
  - `formularioBase` (unión discriminada por `forma`), `type Formulario`, `type FormularioDe<F extends Forma>`
  - Todo formulario es `{ forma, consigna: string, textos: { etiqueta: string; texto: string }[], actividad }`
  - `fallosDeForma(regla, f): string[]`, `esquemaDelFormulario(regla)`, `formularioVacio(regla): Formulario`
  - `TIPO_DE_ACTIVIDAD: Record<Forma, TipoActividad>`

Forma de `actividad` por forma:
- `RELACIONAR`: `{ ejemplo: { texto, letra }, elementos: { numero, texto }[], destinos: { letra, titulo, texto }[] }`
- `LISTA_COMUN`: `{ comunes: { letra, texto }[], ejemplo: { enunciado, letra } | null, preguntas: { numero, enunciado }[] }`
- `OPCIONES`: `{ ejemplo: { enunciado, opciones: Opcion[], letra } | null, preguntas: { numero, enunciado, opciones: Opcion[], grupo: number | null }[] }` con `Opcion = { letra, texto, conImagen }`
- `HUECOS`: `{ titulo, texto, fuente, huecos: { numero, opciones: { letra, texto }[] }[] }`
- `REDACCION_UNA`: `{ situacion, textoRecibido, pautas: string[], palabras: { min: number|null, max: number|null } }`
- `REDACCION_DOS`: `{ opciones: { titulo, contexto, pautas }[], palabras }`
- `ORAL_SOLO`: `{ opciones: { tema, pautas, conImagen }[], minutos: { min, max }, preparacion: number | null }`
- `ORAL_DIRECTO`: `{ opciones: { tema, situacion, papelExaminador, pautas }[], minutos }`

`letra` en el ejemplo es la solución del ejemplo, que se enseña resuelto: no es un ítem.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-formas.test.ts
import { describe, it, expect } from "vitest";
import { ESTRUCTURAS, PRUEBAS, reglaDe, type ReglaTarea } from "@/lib/dele/estructura";
import {
  TIPO_DE_ACTIVIDAD,
  esquemaDelFormulario,
  formularioVacio,
  type Formulario,
} from "@/lib/taller/formas";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;
const regla = (prueba: "CE" | "CO" | "EE" | "EO", numero: number) => reglaDe("A2_B1_ESCOLAR", prueba, numero)!;
const TODAS = PRUEBAS.flatMap((prueba) => ESCOLAR[prueba].map((r) => ({ nombre: `${prueba}-${r.numero}`, regla: r })));
const CERRADAS = TODAS.filter((t) => t.regla.items !== null);

function pasa(r: ReglaTarea, f: unknown): boolean {
  return esquemaDelFormulario(r).safeParse(f).success;
}

/** El primer ítem de un formulario cerrado, para meterle un campo que no debe existir. */
function primerItem(f: Formulario): Record<string, unknown> {
  switch (f.forma) {
    case "RELACIONAR": return f.actividad.elementos[0];
    case "LISTA_COMUN":
    case "OPCIONES": return f.actividad.preguntas[0];
    case "HUECOS": return f.actividad.huecos[0];
    default: throw new Error("no es una tarea cerrada");
  }
}

describe("las formas del formulario", () => {
  // Mutación que la mata: que formularioVacio de alguna forma no cuadre con
  // fallosDeForma (una letra de menos, un número mal empezado).
  it.each(TODAS)("el formulario vacío de $nombre cumple su forma", ({ regla: r }) => {
    expect(pasa(r, formularioVacio(r))).toBe(true);
  });

  // El candado de la sección 3 del diseño: la solución no viaja en los datos.
  // Mutación que la mata: cambiar z.strictObject por z.object en el ítem.
  it.each(["respuesta", "respuestas", "correcta", "correctas", "clave", "solucion"])(
    "ningún ítem de ninguna tarea cerrada admite el campo «%s»",
    (campo) => {
      for (const { regla: r } of CERRADAS) {
        const f = structuredClone(formularioVacio(r));
        primerItem(f)[campo] = "B";
        expect(pasa(r, f)).toBe(false);
      }
    },
  );

  it("un campo desconocido en la raíz también rebota", () => {
    const r = regla("EE", 1);
    expect(pasa(r, { ...formularioVacio(r), extra: 1 })).toBe(false);
  });

  // Mutación que la mata: no comparar la longitud de preguntas con items.
  it("Lectura 3 con una pregunta de menos rebota", () => {
    const r = regla("CE", 3);
    const f = formularioVacio(r);
    if (f.forma !== "OPCIONES") throw new Error();
    f.actividad.preguntas.pop();
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: comprobar solo cuántos elementos hay, no sus números.
  it("Lectura 1 con los números corridos rebota", () => {
    const r = regla("CE", 1);
    const f = formularioVacio(r);
    if (f.forma !== "RELACIONAR") throw new Error();
    f.actividad.elementos = f.actividad.elementos.map((e) => ({ ...e, numero: e.numero + 1 }));
    expect(pasa(r, f)).toBe(false);
  });

  it("Lectura 1 tiene seis elementos del 1 al 6 y diez destinos de la A a la J", () => {
    const f = formularioVacio(regla("CE", 1));
    if (f.forma !== "RELACIONAR") throw new Error();
    expect(f.actividad.elementos.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(f.actividad.destinos.map((d) => d.letra).join("")).toBe("ABCDEFGHIJ");
  });

  // Mutación que la mata: no mirar conImagen en fallosDeForma.
  it("Auditiva 1: las opciones de las cuatro primeras son imagen y las demás no", () => {
    const r = regla("CO", 1);
    const f = formularioVacio(r);
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.actividad.preguntas.map((p) => p.opciones.every((o) => o.conImagen))).toEqual([
      true, true, true, true, false, false, false,
    ]);
    expect(f.actividad.ejemplo?.opciones.every((o) => o.conImagen)).toBe(true);
    f.actividad.preguntas[4].opciones[0].conImagen = true;
    expect(pasa(r, f)).toBe(false);
  });

  it("Auditiva 4 reparte las seis preguntas en tres noticias de dos", () => {
    const f = formularioVacio(regla("CO", 4));
    if (f.forma !== "OPCIONES") throw new Error();
    expect(f.actividad.preguntas.map((p) => p.grupo)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  // Mutación que la mata: no comprobar que la forma que llega es la de la regla.
  it("un formulario de otra forma rebota", () => {
    expect(pasa(regla("CE", 3), formularioVacio(regla("CE", 1)))).toBe(false);
  });

  it("una tarea sin ejemplo no admite ejemplo, y una con ejemplo lo exige", () => {
    const ce2 = regla("CE", 2);
    const f = formularioVacio(ce2);
    if (f.forma !== "LISTA_COMUN") throw new Error();
    f.actividad.ejemplo = { enunciado: "", letra: "" };
    expect(pasa(ce2, f)).toBe(false);

    const co3 = regla("CO", 3);
    const g = formularioVacio(co3);
    if (g.forma !== "LISTA_COMUN") throw new Error();
    g.actividad.ejemplo = null;
    expect(pasa(co3, g)).toBe(false);
  });

  it("Oral 1 lleva foto en sus dos opciones; Oral 3 no", () => {
    const eo1 = formularioVacio(regla("EO", 1));
    const eo3 = formularioVacio(regla("EO", 3));
    if (eo1.forma !== "ORAL_SOLO" || eo3.forma !== "ORAL_SOLO") throw new Error();
    expect(eo1.actividad.opciones.map((o) => o.conImagen)).toEqual([true, true]);
    expect(eo3.actividad.opciones.map((o) => o.conImagen)).toEqual([false, false]);
  });

  it("Lectura 2 pide tres textos y Lectura 3 uno", () => {
    expect(formularioVacio(regla("CE", 2)).textos).toHaveLength(3);
    expect(formularioVacio(regla("CE", 3)).textos).toHaveLength(1);
    const r = regla("CE", 2);
    const f = formularioVacio(r);
    f.textos.pop();
    expect(pasa(r, f)).toBe(false);
  });

  it("las orales en directo se guardan como conversación, no como grabación", () => {
    expect(TIPO_DE_ACTIVIDAD.ORAL_DIRECTO).toBe("CONVERSACION");
    expect(TIPO_DE_ACTIVIDAD.ORAL_SOLO).toBe("GRABACION");
    expect(TIPO_DE_ACTIVIDAD.HUECOS).toBe("HUECOS");
    expect(TIPO_DE_ACTIVIDAD.LISTA_COMUN).toBe("OPCION");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/taller-formas.test.ts`
Expected: FAIL («Cannot find module '@/lib/taller/formas'»).

- [ ] **Step 3: Escribir `lib/taller/formas.ts`**

```ts
import { z } from "zod";
import type { TipoActividad } from "@/lib/generated/prisma";
import { letrasHasta, type Forma, type ReglaTarea } from "@/lib/dele/estructura";

// Los textos pueden llegar vacíos: guardar a medias es legal. Lo que falta lo
// dice el estado de la tarea (lib/taller/estado.ts), no el esquema. El esquema
// solo garantiza la FORMA, y es estricto: un campo que no conoce, rebota.
const texto = z.string().max(20_000);
const letra = z.string().max(1);
const numeroDelLibro = z.number().int().min(1).max(99);
const pautas = z.array(texto).max(12);
const rango = z.strictObject({
  min: z.number().int().min(0).nullable(),
  max: z.number().int().min(0).nullable(),
});
const textoSuelto = z.strictObject({ etiqueta: texto, texto });
const textos = z.array(textoSuelto).max(5);
const opcion = z.strictObject({ letra, texto, conImagen: z.boolean() });
const letraConTexto = z.strictObject({ letra, texto });

const relacionar = z.strictObject({
  forma: z.literal("RELACIONAR"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    ejemplo: z.strictObject({ texto, letra }),
    elementos: z.array(z.strictObject({ numero: numeroDelLibro, texto })).max(20),
    destinos: z.array(z.strictObject({ letra, titulo: texto, texto })).max(20),
  }),
});

const listaComun = z.strictObject({
  forma: z.literal("LISTA_COMUN"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    comunes: z.array(letraConTexto).max(10),
    ejemplo: z.strictObject({ enunciado: texto, letra }).nullable(),
    preguntas: z.array(z.strictObject({ numero: numeroDelLibro, enunciado: texto })).max(20),
  }),
});

const opciones = z.strictObject({
  forma: z.literal("OPCIONES"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    ejemplo: z.strictObject({ enunciado: texto, opciones: z.array(opcion).max(10), letra }).nullable(),
    preguntas: z
      .array(
        z.strictObject({
          numero: numeroDelLibro,
          enunciado: texto,
          opciones: z.array(opcion).max(10),
          grupo: z.number().int().min(1).nullable(),
        }),
      )
      .max(20),
  }),
});

const huecos = z.strictObject({
  forma: z.literal("HUECOS"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    titulo: texto,
    texto,
    fuente: texto,
    huecos: z.array(z.strictObject({ numero: numeroDelLibro, opciones: z.array(letraConTexto).max(10) })).max(20),
  }),
});

const redaccionUna = z.strictObject({
  forma: z.literal("REDACCION_UNA"),
  consigna: texto,
  textos,
  actividad: z.strictObject({ situacion: texto, textoRecibido: texto, pautas, palabras: rango }),
});

const redaccionDos = z.strictObject({
  forma: z.literal("REDACCION_DOS"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    opciones: z.array(z.strictObject({ titulo: texto, contexto: texto, pautas })).max(4),
    palabras: rango,
  }),
});

const oralSolo = z.strictObject({
  forma: z.literal("ORAL_SOLO"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    opciones: z.array(z.strictObject({ tema: texto, pautas, conImagen: z.boolean() })).max(4),
    minutos: rango,
    preparacion: z.number().int().min(0).nullable(),
  }),
});

const oralDirecto = z.strictObject({
  forma: z.literal("ORAL_DIRECTO"),
  consigna: texto,
  textos,
  actividad: z.strictObject({
    opciones: z.array(z.strictObject({ tema: texto, situacion: texto, papelExaminador: texto, pautas })).max(4),
    minutos: rango,
  }),
});

export const formularioBase = z.discriminatedUnion("forma", [
  relacionar,
  listaComun,
  opciones,
  huecos,
  redaccionUna,
  redaccionDos,
  oralSolo,
  oralDirecto,
]);

export type Formulario = z.infer<typeof formularioBase>;
export type FormularioDe<F extends Forma> = Extract<Formulario, { forma: F }>;

export const TIPO_DE_ACTIVIDAD: Record<Forma, TipoActividad> = {
  RELACIONAR: "RELACIONAR",
  LISTA_COMUN: "OPCION",
  OPCIONES: "OPCION",
  HUECOS: "HUECOS",
  REDACCION_UNA: "REDACCION",
  REDACCION_DOS: "REDACCION",
  ORAL_SOLO: "GRABACION",
  ORAL_DIRECTO: "CONVERSACION",
};

const OPCIONES_ABIERTAS = 2;

function numerosDe(regla: ReglaTarea): number[] {
  if (regla.items === null || regla.primero === null) return [];
  return Array.from({ length: regla.items }, (_, i) => regla.primero! + i);
}

function grupoDe(regla: ReglaTarea, indice: number): number | null {
  if (!regla.grupos || regla.items === null) return null;
  return Math.floor(indice / (regla.items / regla.grupos)) + 1;
}

function iguales(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Lo que no cuadra entre un formulario y la forma que manda su regla: cuántos
 * ítems, qué números, qué letras, qué opciones son imagen, qué grupos. No
 * mira si faltan textos: eso no impide guardar.
 */
export function fallosDeForma(regla: ReglaTarea, f: Formulario): string[] {
  if (f.forma !== regla.forma) return [`Esta tarea es de forma ${regla.forma} y ha llegado ${f.forma}.`];
  const fallos: string[] = [];
  const numeros = numerosDe(regla);
  const abc = letrasHasta(regla.letras);
  if (f.textos.length !== regla.textos) {
    fallos.push(`Tiene que llevar ${regla.textos} textos sueltos y lleva ${f.textos.length}.`);
  }
  const ejemploCuadra = (hay: boolean) => {
    if (hay !== regla.ejemplo) fallos.push(regla.ejemplo ? "Falta el hueco del ejemplo." : "Esta tarea no lleva ejemplo.");
  };

  switch (f.forma) {
    case "RELACIONAR": {
      const a = f.actividad;
      if (!iguales(a.elementos.map((e) => e.numero), numeros)) fallos.push(`Los elementos tienen que ser ${numeros.join(", ")}.`);
      if (!iguales(a.destinos.map((d) => d.letra), abc)) fallos.push(`Los destinos tienen que ser ${abc.join(", ")}.`);
      break;
    }
    case "LISTA_COMUN": {
      const a = f.actividad;
      if (!iguales(a.preguntas.map((p) => p.numero), numeros)) fallos.push(`Las preguntas tienen que ser ${numeros.join(", ")}.`);
      if (!iguales(a.comunes.map((c) => c.letra), abc)) fallos.push(`La lista común tiene que ser ${abc.join(", ")}.`);
      ejemploCuadra(a.ejemplo !== null);
      break;
    }
    case "OPCIONES": {
      const a = f.actividad;
      const conImagen = regla.itemsConImagen ?? 0;
      if (!iguales(a.preguntas.map((p) => p.numero), numeros)) fallos.push(`Las preguntas tienen que ser ${numeros.join(", ")}.`);
      a.preguntas.forEach((p, i) => {
        if (!iguales(p.opciones.map((o) => o.letra), abc)) fallos.push(`La pregunta ${p.numero} tiene que tener las opciones ${abc.join(", ")}.`);
        if (p.opciones.some((o) => o.conImagen !== i < conImagen)) fallos.push(`La pregunta ${p.numero} no tiene las imágenes que le tocan.`);
        if (p.grupo !== grupoDe(regla, i)) fallos.push(`La pregunta ${p.numero} no está en su grupo.`);
      });
      ejemploCuadra(a.ejemplo !== null);
      if (a.ejemplo) {
        if (!iguales(a.ejemplo.opciones.map((o) => o.letra), abc)) fallos.push(`El ejemplo tiene que tener las opciones ${abc.join(", ")}.`);
        if (a.ejemplo.opciones.some((o) => o.conImagen !== conImagen > 0)) fallos.push("El ejemplo no tiene las imágenes que le tocan.");
      }
      break;
    }
    case "HUECOS": {
      const a = f.actividad;
      if (!iguales(a.huecos.map((h) => h.numero), numeros)) fallos.push(`Los huecos tienen que ser ${numeros.join(", ")}.`);
      for (const h of a.huecos) {
        if (!iguales(h.opciones.map((o) => o.letra), abc)) fallos.push(`El hueco ${h.numero} tiene que tener las opciones ${abc.join(", ")}.`);
      }
      break;
    }
    case "REDACCION_UNA":
      break;
    case "REDACCION_DOS":
      if (f.actividad.opciones.length !== OPCIONES_ABIERTAS) fallos.push("Tiene que llevar dos opciones.");
      break;
    case "ORAL_SOLO":
      if (f.actividad.opciones.length !== OPCIONES_ABIERTAS) fallos.push("Tiene que llevar dos opciones.");
      if (f.actividad.opciones.some((o) => o.conImagen !== Boolean(regla.opcionesConImagen))) fallos.push("Las opciones no tienen las fotos que les tocan.");
      break;
    case "ORAL_DIRECTO":
      if (f.actividad.opciones.length !== OPCIONES_ABIERTAS) fallos.push("Tiene que llevar dos opciones.");
      break;
  }
  return fallos;
}

export function esquemaDelFormulario(regla: ReglaTarea) {
  return formularioBase.superRefine((f, ctx) => {
    for (const message of fallosDeForma(regla, f)) ctx.addIssue({ code: "custom", message });
  });
}

/** El formulario de una tarea sin guardar: la forma entera, con todos los textos vacíos. */
export function formularioVacio(regla: ReglaTarea): Formulario {
  const numeros = numerosDe(regla);
  const abc = letrasHasta(regla.letras);
  const consigna = "";
  const textos = Array.from({ length: regla.textos }, () => ({ etiqueta: "", texto: "" }));
  const opcionesVacias = (conImagen: boolean) => abc.map((l) => ({ letra: l, texto: "", conImagen }));
  const sinRango = { min: null, max: null };
  const dos = <T,>(hacer: () => T): T[] => Array.from({ length: OPCIONES_ABIERTAS }, hacer);

  switch (regla.forma) {
    case "RELACIONAR":
      return {
        forma: "RELACIONAR", consigna, textos,
        actividad: {
          ejemplo: { texto: "", letra: "" },
          elementos: numeros.map((numero) => ({ numero, texto: "" })),
          destinos: abc.map((l) => ({ letra: l, titulo: "", texto: "" })),
        },
      };
    case "LISTA_COMUN":
      return {
        forma: "LISTA_COMUN", consigna, textos,
        actividad: {
          comunes: abc.map((l) => ({ letra: l, texto: "" })),
          ejemplo: regla.ejemplo ? { enunciado: "", letra: "" } : null,
          preguntas: numeros.map((numero) => ({ numero, enunciado: "" })),
        },
      };
    case "OPCIONES": {
      const conImagen = regla.itemsConImagen ?? 0;
      return {
        forma: "OPCIONES", consigna, textos,
        actividad: {
          ejemplo: regla.ejemplo ? { enunciado: "", opciones: opcionesVacias(conImagen > 0), letra: "" } : null,
          preguntas: numeros.map((numero, i) => ({
            numero, enunciado: "", opciones: opcionesVacias(i < conImagen), grupo: grupoDe(regla, i),
          })),
        },
      };
    }
    case "HUECOS":
      return {
        forma: "HUECOS", consigna, textos,
        actividad: {
          titulo: "", texto: "", fuente: "",
          huecos: numeros.map((numero) => ({ numero, opciones: abc.map((l) => ({ letra: l, texto: "" })) })),
        },
      };
    case "REDACCION_UNA":
      return { forma: "REDACCION_UNA", consigna, textos, actividad: { situacion: "", textoRecibido: "", pautas: [""], palabras: sinRango } };
    case "REDACCION_DOS":
      return {
        forma: "REDACCION_DOS", consigna, textos,
        actividad: { opciones: dos(() => ({ titulo: "", contexto: "", pautas: [""] })), palabras: sinRango },
      };
    case "ORAL_SOLO":
      return {
        forma: "ORAL_SOLO", consigna, textos,
        actividad: {
          opciones: dos(() => ({ tema: "", pautas: [""], conImagen: Boolean(regla.opcionesConImagen) })),
          minutos: sinRango, preparacion: null,
        },
      };
    case "ORAL_DIRECTO":
      return {
        forma: "ORAL_DIRECTO", consigna, textos,
        actividad: { opciones: dos(() => ({ tema: "", situacion: "", papelExaminador: "", pautas: [""] })), minutos: sinRango },
      };
  }
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/taller-formas.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Comprobar una mutación a mano**

Cambiar en `opcion` `z.strictObject` por `z.object`, correr la prueba y ver que NO se pone roja (el campo prohibido va en la pregunta, no en la opción). Deshacer. Cambiar después el `z.strictObject` de la pregunta de `opciones` por `z.object`: tiene que ponerse roja. Deshacer.

- [ ] **Step 6: Commit**

```bash
git add lib/taller/formas.ts tests/taller-formas.test.ts
git commit -q -F - <<'EOF'
Formas del taller: esquema estricto y formulario vacío de cada tarea

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 4: El lector de soluciones del cuadernillo

**Files:**
- Modify: `package.json` (dependencia `pdfjs-dist`)
- Create: `lib/taller/trozos.ts`, `lib/taller/soluciones.ts`, `tests/ayudas/cuadernillo-inventado.ts`
- Test: `tests/taller-soluciones.test.ts`, `tests/taller-soluciones-real.test.ts`

**Interfaces:**
- Consumes: `ESTRUCTURAS`, `EstructuraDeNivel`, `letrasHasta` (Tarea 2).
- Produces:
  - `type Trozo = { pagina: number; x: number; y: number; texto: string; anchoPagina: number }`
  - `type DocumentoPdf` (lo mínimo de pdf.js) y `trozosDeDocumento(doc): Promise<Trozo[]>`
  - `type RespuestasDeUnaPrueba = Record<string, string>`, `type Soluciones = Record<string, { CE: RespuestasDeUnaPrueba; CO: RespuestasDeUnaPrueba }>`
  - `TOPE_DE_TROZOS = 10_000`, `trozosSchema`
  - `leerSoluciones(trozos): Soluciones`
  - `type FilaDelResumen = { tarea; primero; items; encontradas }`, `type ResumenDeExamen = { examen: string; pruebas: { prueba: "CE" | "CO"; filas: FilaDelResumen[]; fuera: string[] }[]; bien: boolean }`
  - `resumenDeSoluciones(soluciones, estructura): ResumenDeExamen[]`
  - `textoDeTrozos(trozos): string`
  - Ayuda de pruebas: `ANCHO`, `letraInventada(examen, prueba, n)`, `lineasDeExamen(examen, quitar?)`, `paginaDeSoluciones(pagina, izquierda, derecha)`

Cómo es el cuadernillo real (medido el 13 sept con pdf.js 5.7.284): cada par `13-B` es un trozo suelto; la página mide 595 de ancho; la columna izquierda va en x≈51 y 159, la derecha en x≈304 y 412; solo las páginas con el trozo `SOLUCIONES` traen la tabla; dentro de cada columna, de arriba abajo: `EXAMEN N`, `PRUEBA DE COMPRENSIÓN DE LECTURA`, `TAREA 1`, pares…, `PRUEBA DE COMPRENSIÓN AUDITIVA`, … Las páginas de transcripciones también dicen «EXAMEN 1 – PRUEBA DE COMPRENSIÓN AUDITIVA – TAREA 1» y no deben leerse.

- [ ] **Step 1: Instalar pdf.js**

Run: `npm install --save-exact pdfjs-dist@5.7.284`
Expected: `package.json` gana `"pdfjs-dist": "5.7.284"`.

- [ ] **Step 2: Escribir la ayuda inventada**

```ts
// tests/ayudas/cuadernillo-inventado.ts
// Una tabla de SOLUCIONES con la misma forma que la del libro (dos exámenes
// por página, dos columnas de pares por examen) pero con letras INVENTADAS.
// El repo es público: nada del cuadernillo real puede entrar aquí.
import { ESTRUCTURAS, letrasHasta } from "@/lib/dele/estructura";
import type { Trozo } from "@/lib/taller/trozos";

export const ANCHO = 600;
const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

/** Da vueltas por las letras de la tarea; cambia con el examen para que dos exámenes no coincidan. */
export function letraInventada(examen: number, prueba: "CE" | "CO", n: number): string {
  const regla = ESCOLAR[prueba].find((r) => n >= r.primero! && n < r.primero! + r.items!)!;
  const letras = letrasHasta(regla.letras);
  return letras[(n * 7 + examen + (prueba === "CO" ? 1 : 0)) % letras.length];
}

/** Las líneas de un examen en su columna. `quitar` lleva «CE-19» y similares. */
export function lineasDeExamen(examen: number, quitar: string[] = []): string[][] {
  const lineas: string[][] = [[`EXAMEN ${examen}`]];
  const pruebas = [
    ["CE", "PRUEBA DE COMPRENSIÓN DE LECTURA"],
    ["CO", "PRUEBA DE COMPRENSIÓN AUDITIVA"],
  ] as const;
  for (const [prueba, rotulo] of pruebas) {
    lineas.push([rotulo]);
    for (const r of ESCOLAR[prueba]) {
      lineas.push([`TAREA ${r.numero}`]);
      const pares = Array.from({ length: r.items! }, (_, i) => r.primero! + i)
        .filter((n) => !quitar.includes(`${prueba}-${n}`))
        .map((n) => `${n}-${letraInventada(examen, prueba, n)}`);
      const mitad = Math.ceil(pares.length / 2);
      for (let i = 0; i < mitad; i++) lineas.push(pares[i + mitad] ? [pares[i], pares[i + mitad]] : [pares[i]]);
    }
  }
  return lineas;
}

/** Una página de soluciones: SOLUCIONES arriba y dos exámenes lado a lado, a la misma altura. */
export function paginaDeSoluciones(pagina: number, izquierda: string[][], derecha: string[][]): Trozo[] {
  const trozos: Trozo[] = [{ pagina, x: 50, y: 800, texto: "SOLUCIONES", anchoPagina: ANCHO }];
  const poner = (lineas: string[][], x0: number) =>
    lineas.forEach((linea, i) =>
      linea.forEach((texto, j) => trozos.push({ pagina, x: x0 + j * 108, y: 786 - i * 14, texto, anchoPagina: ANCHO })),
    );
  poner(izquierda, 50);
  poner(derecha, 304);
  return trozos;
}
```

- [ ] **Step 3: Escribir la prueba que falla**

```ts
// tests/taller-soluciones.test.ts
import { describe, it, expect } from "vitest";
import { ESTRUCTURAS } from "@/lib/dele/estructura";
import {
  TOPE_DE_TROZOS,
  leerSoluciones,
  resumenDeSoluciones,
  textoDeTrozos,
  trozosSchema,
} from "@/lib/taller/soluciones";
import type { Trozo } from "@/lib/taller/trozos";
import { ANCHO, letraInventada, lineasDeExamen, paginaDeSoluciones } from "./ayudas/cuadernillo-inventado";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

function libroDeDosPaginas(): Trozo[] {
  return [
    ...paginaDeSoluciones(21, lineasDeExamen(1), lineasDeExamen(2)),
    ...paginaDeSoluciones(22, lineasDeExamen(3), lineasDeExamen(4)),
  ];
}

describe("leer la tabla de soluciones", () => {
  it("lee cuatro exámenes con 25 respuestas de lectura y 25 de auditiva", () => {
    const soluciones = leerSoluciones(libroDeDosPaginas());
    expect(Object.keys(soluciones).sort()).toEqual(["1", "2", "3", "4"]);
    for (const examen of ["1", "2", "3", "4"]) {
      expect(Object.keys(soluciones[examen].CE)).toHaveLength(25);
      expect(Object.keys(soluciones[examen].CO)).toHaveLength(25);
    }
  });

  // Mutación que la mata: no separar por la mitad de la página (las dos
  // columnas se leen como una y el examen 1 se queda sin nada).
  it("las dos columnas de una página no se mezclan", () => {
    const soluciones = leerSoluciones(libroDeDosPaginas());
    for (const n of [1, 4, 13, 19, 25]) {
      expect(soluciones["1"].CE[String(n)]).toBe(letraInventada(1, "CE", n));
      expect(soluciones["2"].CE[String(n)]).toBe(letraInventada(2, "CE", n));
    }
    expect(soluciones["2"].CO["8"]).toBe(letraInventada(2, "CO", 8));
  });

  // Mutación que la mata: quitar el filtro de páginas con SOLUCIONES.
  it("no lee pares de páginas sin SOLUCIONES", () => {
    const transcripcion: Trozo[] = [
      { pagina: 3, x: 50, y: 700, texto: "EXAMEN 9", anchoPagina: ANCHO },
      { pagina: 3, x: 50, y: 680, texto: "PRUEBA DE COMPRENSIÓN AUDITIVA", anchoPagina: ANCHO },
      { pagina: 3, x: 50, y: 660, texto: "3-B", anchoPagina: ANCHO },
    ];
    expect(leerSoluciones(transcripcion)).toEqual({});
  });

  // Mutación que la mata: no ordenar por altura (se leería en el orden de llegada).
  it("el orden en que llegan los trozos no importa", () => {
    const trozos = libroDeDosPaginas();
    const barajados = trozos.map((t, i) => ({ t, k: (i * 7919) % trozos.length })).sort((a, b) => a.k - b.k).map((x) => x.t);
    expect(leerSoluciones(barajados)).toEqual(leerSoluciones(trozos));
  });

  it("un rótulo de auditiva cambia de prueba sin cambiar de examen", () => {
    const soluciones = leerSoluciones(libroDeDosPaginas());
    expect(soluciones["3"].CO["20"]).toBe(letraInventada(3, "CO", 20));
    expect(soluciones["3"].CE["20"]).toBe(letraInventada(3, "CE", 20));
  });
});

describe("el resumen de lo entendido", () => {
  it("un examen completo sale bien", () => {
    const resumen = resumenDeSoluciones(leerSoluciones(libroDeDosPaginas()), ESCOLAR);
    expect(resumen.map((r) => r.examen)).toEqual(["1", "2", "3", "4"]);
    expect(resumen.every((r) => r.bien)).toBe(true);
    expect(resumen[0].pruebas[0].filas.map((f) => f.encontradas)).toEqual([6, 6, 6, 7]);
  });

  // Mutación que la mata: calcular `bien` sin mirar las filas.
  it("una respuesta que falta marca su tarea y el examen", () => {
    const trozos = paginaDeSoluciones(21, lineasDeExamen(1, ["CE-19"]), lineasDeExamen(2));
    const [uno, dos] = resumenDeSoluciones(leerSoluciones(trozos), ESCOLAR);
    expect(uno.bien).toBe(false);
    expect(uno.pruebas[0].filas[3]).toEqual({ tarea: 4, primero: 19, items: 7, encontradas: 6 });
    expect(dos.bien).toBe(true);
  });

  // Mutación que la mata: no calcular `fuera`.
  it("un número que no es de ninguna tarea sale aparte", () => {
    const trozos = paginaDeSoluciones(21, [...lineasDeExamen(1), ["26-A"]], []);
    const [uno] = resumenDeSoluciones(leerSoluciones(trozos), ESCOLAR);
    expect(uno.pruebas[1].fuera).toEqual(["26"]);
    expect(uno.bien).toBe(false);
  });
});

describe("el texto y el tope", () => {
  it("el texto va por páginas, de arriba abajo y de izquierda a derecha", () => {
    const trozos: Trozo[] = [
      { pagina: 2, x: 50, y: 700, texto: "segunda", anchoPagina: ANCHO },
      { pagina: 1, x: 200, y: 700, texto: "mundo", anchoPagina: ANCHO },
      { pagina: 1, x: 50, y: 700, texto: "Hola", anchoPagina: ANCHO },
      { pagina: 1, x: 50, y: 650, texto: "abajo", anchoPagina: ANCHO },
    ];
    expect(textoDeTrozos(trozos)).toBe("Hola mundo\nabajo\n\nsegunda");
  });

  it("más trozos que el tope, rebota", () => {
    const uno = { pagina: 1, x: 0, y: 0, texto: "x", anchoPagina: ANCHO };
    expect(trozosSchema.safeParse(Array(TOPE_DE_TROZOS + 1).fill(uno)).success).toBe(false);
    expect(trozosSchema.safeParse([uno]).success).toBe(true);
  });
});
```

- [ ] **Step 4: Correr y ver que falla**

Run: `npx vitest run tests/taller-soluciones.test.ts`
Expected: FAIL («Cannot find module '@/lib/taller/soluciones'»).

- [ ] **Step 5: Escribir `lib/taller/trozos.ts`**

```ts
export type Trozo = { pagina: number; x: number; y: number; texto: string; anchoPagina: number };

/**
 * Lo mínimo de un documento de pdf.js. Así la misma función sirve en el
 * navegador (pdfjs-dist) y en la prueba de Node (pdfjs-dist/legacy).
 */
export type DocumentoPdf = {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(opciones: { scale: number }): { width: number };
    getTextContent(): Promise<{ items: ReadonlyArray<unknown> }>;
  }>;
};

/** Cada trozo de texto del PDF con su página y su posición. Los vacíos no cuentan. */
export async function trozosDeDocumento(doc: DocumentoPdf): Promise<Trozo[]> {
  const trozos: Trozo[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const anchoPagina = pagina.getViewport({ scale: 1 }).width;
    const { items } = await pagina.getTextContent();
    for (const item of items) {
      if (!item || typeof item !== "object" || !("str" in item) || !("transform" in item)) continue;
      const { str, transform } = item as { str: string; transform: number[] };
      if (!str.trim()) continue;
      trozos.push({ pagina: n, x: transform[4], y: transform[5], texto: str, anchoPagina });
    }
  }
  return trozos;
}
```

- [ ] **Step 6: Escribir `lib/taller/soluciones.ts`**

```ts
import { z } from "zod";
import type { EstructuraDeNivel } from "@/lib/dele/estructura";
import type { Trozo } from "./trozos";

export type RespuestasDeUnaPrueba = Record<string, string>;
/** { "1": { CE: { "13": "B" }, CO: { ... } } } */
export type Soluciones = Record<string, { CE: RespuestasDeUnaPrueba; CO: RespuestasDeUnaPrueba }>;

/** Una acción de servidor corta a 1 MB; el cuadernillo del libro son unos 2.300 trozos. */
export const TOPE_DE_TROZOS = 10_000;

export const trozosSchema = z
  .array(
    z.strictObject({
      pagina: z.number().int().min(1),
      x: z.number(),
      y: z.number(),
      texto: z.string().max(2_000),
      anchoPagina: z.number().positive(),
    }),
  )
  .max(TOPE_DE_TROZOS);

/**
 * La tabla de SOLUCIONES del cuadernillo. Solo mira páginas con el trozo
 * «SOLUCIONES». Cada página lleva dos exámenes lado a lado: se parte por la
 * mitad del ancho y cada columna se lee de arriba abajo. La tarea de cada par
 * la dará su número (estructura del nivel), no el rótulo «TAREA N».
 */
export function leerSoluciones(trozos: readonly Trozo[]): Soluciones {
  const soluciones: Soluciones = {};
  const paginas = [...new Set(trozos.map((t) => t.pagina))].sort((a, b) => a - b);
  for (const pagina of paginas) {
    const suyos = trozos.filter((t) => t.pagina === pagina);
    if (!suyos.some((t) => t.texto.trim().toUpperCase() === "SOLUCIONES")) continue;
    for (const derecha of [false, true]) {
      const columna = suyos
        .filter((t) => t.x >= t.anchoPagina / 2 === derecha)
        .sort((a, b) => b.y - a.y || a.x - b.x);
      let examen: string | null = null;
      let prueba: "CE" | "CO" | null = null;
      for (const t of columna) {
        const s = t.texto.trim();
        const rotulo = s.match(/^EXAMEN\s+(\d+)$/i);
        if (rotulo) {
          examen = String(Number(rotulo[1]));
          soluciones[examen] ??= { CE: {}, CO: {} };
          prueba = null;
          continue;
        }
        if (/LECTURA$/i.test(s)) { prueba = "CE"; continue; }
        if (/AUDITIVA$/i.test(s)) { prueba = "CO"; continue; }
        const par = s.match(/^(\d+)\s*-\s*([A-J])$/i);
        if (par && examen && prueba) soluciones[examen][prueba][String(Number(par[1]))] = par[2].toUpperCase();
      }
    }
  }
  return soluciones;
}

export type FilaDelResumen = { tarea: number; primero: number; items: number; encontradas: number };
export type ResumenDeExamen = {
  examen: string;
  pruebas: { prueba: "CE" | "CO"; filas: FilaDelResumen[]; fuera: string[] }[];
  bien: boolean;
};

/** Lo que el taller enseña al subir el cuadernillo: cuántas respuestas de cada tarea ha encontrado. */
export function resumenDeSoluciones(soluciones: Soluciones, estructura: EstructuraDeNivel): ResumenDeExamen[] {
  const porNumero = (a: string, b: string) => Number(a) - Number(b);
  return Object.keys(soluciones).sort(porNumero).map((examen) => {
    const pruebas = (["CE", "CO"] as const).map((prueba) => {
      const respuestas = soluciones[examen][prueba];
      const dentro = new Set<string>();
      const filas = estructura[prueba]
        .filter((r) => r.items !== null && r.primero !== null)
        .map((r) => {
          let encontradas = 0;
          for (let n = r.primero!; n < r.primero! + r.items!; n++) {
            if (String(n) in respuestas) { encontradas++; dentro.add(String(n)); }
          }
          return { tarea: r.numero, primero: r.primero!, items: r.items!, encontradas };
        });
      const fuera = Object.keys(respuestas).filter((n) => !dentro.has(n)).sort(porNumero);
      return { prueba, filas, fuera };
    });
    const bien = pruebas.every((p) => p.fuera.length === 0 && p.filas.every((f) => f.encontradas === f.items));
    return { examen, pruebas, bien };
  });
}

/** El texto entero, por páginas y líneas. Lo usará la IA en la Entrega 2 (transcripciones). */
export function textoDeTrozos(trozos: readonly Trozo[]): string {
  const paginas = [...new Set(trozos.map((t) => t.pagina))].sort((a, b) => a - b);
  return paginas
    .map((pagina) => {
      const lineas = new Map<number, Trozo[]>();
      for (const t of trozos.filter((t) => t.pagina === pagina)) {
        const y = Math.round(t.y);
        lineas.set(y, [...(lineas.get(y) ?? []), t]);
      }
      return [...lineas.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, suyos]) => suyos.sort((a, b) => a.x - b.x).map((t) => t.texto.trim()).join(" "))
        .join("\n");
    })
    .join("\n\n")
    .trim();
}
```

- [ ] **Step 7: Correr y ver que pasa**

Run: `npx vitest run tests/taller-soluciones.test.ts`
Expected: PASS.

- [ ] **Step 8: La prueba contra el cuadernillo real, solo en este Mac**

```ts
// tests/taller-soluciones-real.test.ts
// Se salta sola si no se pasa CUADERNILLO_REAL. El PDF no entra en el repo
// (es público): la variable apunta a la copia del Mac del proyecto. Solo se
// comprueban cuentas, nunca letras reales.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { ESTRUCTURAS } from "@/lib/dele/estructura";
import { leerSoluciones, resumenDeSoluciones } from "@/lib/taller/soluciones";
import { trozosDeDocumento } from "@/lib/taller/trozos";

const RUTA = process.env.CUADERNILLO_REAL;

describe.skipIf(!RUTA)("el cuadernillo real", () => {
  it("da seis exámenes con 25 + 25 respuestas, todas en su tarea", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const datos = new Uint8Array(readFileSync(RUTA!));
    const doc = await pdfjs.getDocument({ data: datos, useSystemFonts: true }).promise;
    const resumen = resumenDeSoluciones(leerSoluciones(await trozosDeDocumento(doc)), ESTRUCTURAS.A2_B1_ESCOLAR!);
    expect(resumen.map((r) => r.examen)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(resumen.filter((r) => !r.bien)).toEqual([]);
  }, 30_000);
});
```

Run: `CUADERNILLO_REAL="$HOME/Downloads/A2B1 examenes/claves_dele_escolar_sol_trans (2).pdf" npx vitest run tests/taller-soluciones-real.test.ts`
Expected: PASS, 1 prueba.

Run: `npx vitest run tests/taller-soluciones-real.test.ts`
Expected: 1 prueba saltada.

Si `~/Downloads` diera «Operation not permitted», es el TCC de Terminal: skill `diagnosticar-documents-bloqueada`.

- [ ] **Step 9: Tipos y commit**

Run: `npx tsc --noEmit`
Expected: sin errores. Si TypeScript no encuentra tipos para `pdfjs-dist/legacy/build/pdf.mjs`, crear `tests/pdfjs-legacy.d.ts` con `declare module "pdfjs-dist/legacy/build/pdf.mjs" { export * from "pdfjs-dist"; }` y añadirlo al `git add`.

```bash
git add package.json package-lock.json lib/taller/trozos.ts lib/taller/soluciones.ts tests/ayudas tests/taller-soluciones.test.ts tests/taller-soluciones-real.test.ts
git commit -q -F - <<'EOF'
Lector de soluciones del cuadernillo, probado con una tabla inventada

La prueba contra el cuadernillo real se salta si no se pasa
CUADERNILLO_REAL: el PDF no puede entrar en un repo público.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 5: El estado de una tarea

**Files:**
- Create: `lib/taller/estado.ts`
- Test: `tests/taller-estado.test.ts`

**Interfaces:**
- Consumes: `ReglaTarea` (Tarea 2); `Formulario`, `FormularioDe`, `formularioVacio` (Tarea 3); `RespuestasDeUnaPrueba` (Tarea 4).
- Produces:
  - `type EstadoDeTarea = { estado: "VACIA" | "A_MEDIAS" | "COMPLETA"; motivos: string[]; imagenesPendientes: number }`
  - `itemsDelFormulario(f): number[]`, `letrasPosibles(f, numero): string[]`, `imagenesPendientes(f): number`
  - `claveDelFormulario(f, respuestas | null): Record<string, string> | null` (solo los números de la tarea que trae el cuadernillo; null si la tarea es abierta o no hay respuestas)
  - `motivosDeTarea(regla, f, respuestas | null, claveGuardada | null): string[]` (`claveGuardada` null = no comparar; `{}` = guardada sin clave)
  - `estadoDeTarea(regla, f | null, respuestas | null, claveGuardada | null): EstadoDeTarea`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-estado.test.ts
import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import {
  claveDelFormulario,
  estadoDeTarea,
  imagenesPendientes,
  motivosDeTarea,
} from "@/lib/taller/estado";

const regla = (prueba: "CE" | "CO" | "EE" | "EO", numero: number) => reglaDe("A2_B1_ESCOLAR", prueba, numero)!;

/** Rellena todos los textos vacíos con «algo», menos las letras. */
function rellenar<T>(valor: T, clave = ""): T {
  if (typeof valor === "string") return (valor === "" && clave !== "letra" ? "algo" : valor) as T;
  if (Array.isArray(valor)) return valor.map((v) => rellenar(v)) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, rellenar(v, k)])) as T;
  }
  return valor;
}

function lleno(prueba: "CE" | "CO" | "EE" | "EO", numero: number): Formulario {
  const f = rellenar(formularioVacio(regla(prueba, numero)));
  if (f.forma === "RELACIONAR") f.actividad.ejemplo.letra = "D";
  if ((f.forma === "LISTA_COMUN" || f.forma === "OPCIONES") && f.actividad.ejemplo) f.actividad.ejemplo.letra = "B";
  if (f.forma === "HUECOS") f.actividad.texto = "Uno [19] dos [20] tres [21] cuatro [22] cinco [23] seis [24] siete [25].";
  return f;
}

const CE3 = { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" };
const CE1 = { "1": "A", "2": "B", "3": "C", "4": "E", "5": "F", "6": "G" };

describe("una tarea completa", () => {
  // Mutación que la mata: devolver A_MEDIAS siempre.
  it("Lectura 3 llena y con su cuadernillo está completa", () => {
    expect(estadoDeTarea(regla("CE", 3), lleno("CE", 3), CE3, null)).toEqual({
      estado: "COMPLETA", motivos: [], imagenesPendientes: 0,
    });
  });

  it("una escrita llena está completa sin cuadernillo", () => {
    expect(estadoDeTarea(regla("EE", 1), lleno("EE", 1), null, null).estado).toBe("COMPLETA");
  });

  it("sin guardar, la tarea está vacía", () => {
    expect(estadoDeTarea(regla("CE", 3), null, CE3, null).estado).toBe("VACIA");
  });
});

describe("lo que falta", () => {
  it("la consigna vacía es un motivo", () => {
    const f = lleno("CE", 3);
    f.consigna = "  ";
    expect(motivosDeTarea(regla("CE", 3), f, CE3, null)).toEqual(["Falta la consigna."]);
  });

  it("un enunciado vacío dice de qué pregunta es", () => {
    const f = lleno("CE", 3);
    if (f.forma !== "OPCIONES") throw new Error();
    f.actividad.preguntas[2].enunciado = "";
    expect(motivosDeTarea(regla("CE", 3), f, CE3, null)).toEqual(["Falta el enunciado de la 15."]);
  });

  // Mutación que la mata: exigir texto a las opciones con imagen.
  it("una opción con imagen no necesita texto, y cuenta como imagen pendiente", () => {
    const f = lleno("CO", 1);
    if (f.forma !== "OPCIONES") throw new Error();
    for (const p of f.actividad.preguntas) for (const o of p.opciones) if (o.conImagen) o.texto = "";
    const respuestas = { "1": "A", "2": "B", "3": "C", "4": "A", "5": "B", "6": "C", "7": "A" };
    expect(motivosDeTarea(regla("CO", 1), f, respuestas, null)).toEqual([]);
    expect(imagenesPendientes(f)).toBe(15);
  });

  // Mutación que la mata: exigir texto a los elementos de Auditiva 2.
  it("en Auditiva 2 los mensajes no llevan texto", () => {
    const f = formularioVacio(regla("CO", 2));
    if (f.forma !== "RELACIONAR") throw new Error();
    f.consigna = "algo";
    f.actividad.ejemplo.letra = "D";
    f.actividad.destinos = f.actividad.destinos.map((d) => ({ ...d, texto: "algo" }));
    const respuestas = { "8": "A", "9": "B", "10": "C", "11": "E", "12": "F", "13": "G" };
    expect(motivosDeTarea(regla("CO", 2), f, respuestas, null)).toEqual([]);
  });

  it("una pauta vacía es un motivo", () => {
    const f = lleno("EO", 3);
    if (f.forma !== "ORAL_SOLO") throw new Error();
    f.actividad.opciones[1].pautas.push("");
    expect(motivosDeTarea(regla("EO", 3), f, null, null)).toEqual(["Hay una pauta vacía en la opción 2."]);
  });
});

describe("las respuestas del cuadernillo", () => {
  it("sin cuadernillo, una tarea cerrada no está completa", () => {
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), null, null)).toEqual([
      "Falta el cuadernillo, o no trae las respuestas de este examen.",
    ]);
  });

  // Mutación que la mata: no mirar si cada número tiene respuesta.
  it("una respuesta que no está se dice por su número", () => {
    const { "16": _, ...sinLa16 } = CE3;
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), sinLa16, null)).toEqual([
      "El cuadernillo no trae la respuesta de la 16.",
    ]);
  });

  // Mutación que la mata: quitar la comprobación de letras posibles.
  it("una letra que la pregunta no tiene", () => {
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), { ...CE3, "13": "D" }, null)).toEqual([
      "La respuesta de la 13 es «D», y esa pregunta solo tiene A, B y C.",
    ]);
  });

  // Mutación que la mata: no quitar la letra del ejemplo de las posibles.
  it("en relacionar, la letra del ejemplo no puede ser respuesta", () => {
    expect(motivosDeTarea(regla("CE", 1), lleno("CE", 1), { ...CE1, "3": "D" }, null)).toEqual([
      "La respuesta de la 3 es «D», que es la del ejemplo.",
    ]);
  });

  // Mutación que la mata: no buscar letras repetidas en relacionar.
  it("en relacionar, dos preguntas con la misma letra", () => {
    expect(motivosDeTarea(regla("CE", 1), lleno("CE", 1), { ...CE1, "5": "B" }, null)).toEqual([
      "Las preguntas 2 y 5 tienen la misma respuesta, «B».",
    ]);
  });

  it("la clave solo lleva los números de la tarea", () => {
    const todas = { ...CE1, ...CE3, "19": "A" };
    expect(claveDelFormulario(lleno("CE", 3), todas)).toEqual(CE3);
    expect(claveDelFormulario(lleno("EE", 1), todas)).toBeNull();
    expect(claveDelFormulario(lleno("CE", 3), null)).toBeNull();
  });

  // Mutación que la mata: no comparar la clave guardada.
  it("una clave guardada que ya no coincide pide volver a guardar", () => {
    const aviso = "La clave guardada no coincide con el cuadernillo: vuelve a guardar la tarea.";
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, CE3)).toEqual([]);
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, { ...CE3, "13": "A" })).toEqual([aviso]);
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, {})).toEqual([aviso]);
  });
});

describe("las marcas de los huecos", () => {
  const CE4 = { "19": "A", "20": "B", "21": "C", "22": "A", "23": "B", "24": "C", "25": "A" };

  // Mutación que la mata: quitar motivosDeMarcas.
  it("una marca que falta, una repetida y una que sobra", () => {
    const f = lleno("CE", 4);
    if (f.forma !== "HUECOS") throw new Error();
    f.actividad.texto = "Uno [19] dos [19] tres [21] cuatro [22] cinco [23] seis [24] siete [25] ocho [26].";
    expect(motivosDeTarea(regla("CE", 4), f, CE4, null)).toEqual([
      "La marca [19] aparece 2 veces en el texto.",
      "Falta la marca [20] en el texto.",
      "El texto tiene una marca [26] que no es de ningún hueco.",
    ]);
  });

  it("con el texto vacío solo se dice que falta el texto", () => {
    const f = lleno("CE", 4);
    if (f.forma !== "HUECOS") throw new Error();
    f.actividad.texto = "";
    expect(motivosDeTarea(regla("CE", 4), f, CE4, null)).toEqual(["Falta el texto con los huecos."]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/taller-estado.test.ts`
Expected: FAIL («Cannot find module '@/lib/taller/estado'»).

- [ ] **Step 3: Escribir `lib/taller/estado.ts`**

```ts
import type { ReglaTarea } from "@/lib/dele/estructura";
import type { Formulario, FormularioDe } from "./formas";
import type { RespuestasDeUnaPrueba } from "./soluciones";

export type EstadoDeTarea = {
  estado: "VACIA" | "A_MEDIAS" | "COMPLETA";
  motivos: string[];
  /** Imágenes que la tarea necesita y que se suben en la Entrega 3. No bloquean todavía. */
  imagenesPendientes: number;
};

const vacio = (s: string) => s.trim() === "";

function enumerar(cosas: readonly string[]): string {
  return cosas.length <= 1 ? cosas.join("") : `${cosas.slice(0, -1).join(", ")} y ${cosas.at(-1)}`;
}

export function itemsDelFormulario(f: Formulario): number[] {
  switch (f.forma) {
    case "RELACIONAR": return f.actividad.elementos.map((e) => e.numero);
    case "LISTA_COMUN":
    case "OPCIONES": return f.actividad.preguntas.map((p) => p.numero);
    case "HUECOS": return f.actividad.huecos.map((h) => h.numero);
    default: return [];
  }
}

/** Las letras que puede tener la respuesta de un ítem. En relacionar, la del ejemplo ya está gastada. */
export function letrasPosibles(f: Formulario, numero: number): string[] {
  switch (f.forma) {
    case "RELACIONAR": return f.actividad.destinos.map((d) => d.letra).filter((l) => l !== f.actividad.ejemplo.letra);
    case "LISTA_COMUN": return f.actividad.comunes.map((c) => c.letra);
    case "OPCIONES": return f.actividad.preguntas.find((p) => p.numero === numero)?.opciones.map((o) => o.letra) ?? [];
    case "HUECOS": return f.actividad.huecos.find((h) => h.numero === numero)?.opciones.map((o) => o.letra) ?? [];
    default: return [];
  }
}

export function imagenesPendientes(f: Formulario): number {
  switch (f.forma) {
    case "OPCIONES": {
      const delEjemplo = f.actividad.ejemplo?.opciones.filter((o) => o.conImagen).length ?? 0;
      return delEjemplo + f.actividad.preguntas.reduce((t, p) => t + p.opciones.filter((o) => o.conImagen).length, 0);
    }
    case "ORAL_SOLO": return f.actividad.opciones.filter((o) => o.conImagen).length;
    default: return 0;
  }
}

export function claveDelFormulario(f: Formulario, respuestas: RespuestasDeUnaPrueba | null): Record<string, string> | null {
  const numeros = itemsDelFormulario(f);
  if (numeros.length === 0 || !respuestas) return null;
  const clave: Record<string, string> = {};
  for (const n of numeros) {
    const letra = respuestas[String(n)];
    if (letra) clave[String(n)] = letra;
  }
  return clave;
}

function mismaClave(a: Record<string, string>, b: Record<string, string> | null): boolean {
  const otra = b ?? {};
  const ka = Object.keys(a).sort();
  const kb = Object.keys(otra).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === otra[k]);
}

function textosQueFaltan(regla: ReglaTarea, f: Formulario): string[] {
  const m: string[] = [];
  const falta = (valor: string, motivo: string) => { if (vacio(valor)) m.push(motivo); };
  const pautasVacias = (pautas: string[], donde: string) => {
    if (pautas.length === 0 || pautas.some(vacio)) m.push(`Hay una pauta vacía en ${donde}.`);
  };

  falta(f.consigna, "Falta la consigna.");
  f.textos.forEach((t, i) => falta(t.texto, `Falta el texto ${i + 1}.`));

  switch (f.forma) {
    case "RELACIONAR": {
      const a = f.actividad;
      falta(a.ejemplo.letra, "Falta la letra del ejemplo.");
      if (regla.elementosConTexto) {
        falta(a.ejemplo.texto, "Falta el texto del ejemplo.");
        for (const e of a.elementos) falta(e.texto, `Falta el texto de la ${e.numero}.`);
      }
      for (const d of a.destinos) falta(d.texto, `Falta el texto ${d.letra}.`);
      break;
    }
    case "LISTA_COMUN": {
      const a = f.actividad;
      for (const c of a.comunes) falta(c.texto, `Falta el texto de la opción ${c.letra}.`);
      if (a.ejemplo) {
        falta(a.ejemplo.enunciado, "Falta el enunciado del ejemplo.");
        falta(a.ejemplo.letra, "Falta la letra del ejemplo.");
      }
      for (const p of a.preguntas) falta(p.enunciado, `Falta el enunciado de la ${p.numero}.`);
      break;
    }
    case "OPCIONES": {
      const a = f.actividad;
      if (a.ejemplo) {
        falta(a.ejemplo.enunciado, "Falta el enunciado del ejemplo.");
        falta(a.ejemplo.letra, "Falta la letra del ejemplo.");
        for (const o of a.ejemplo.opciones) if (!o.conImagen) falta(o.texto, `Falta el texto de la opción ${o.letra} del ejemplo.`);
      }
      for (const p of a.preguntas) {
        falta(p.enunciado, `Falta el enunciado de la ${p.numero}.`);
        for (const o of p.opciones) if (!o.conImagen) falta(o.texto, `Falta el texto de la opción ${o.letra} de la ${p.numero}.`);
      }
      break;
    }
    case "HUECOS": {
      const a = f.actividad;
      falta(a.texto, "Falta el texto con los huecos.");
      for (const h of a.huecos) for (const o of h.opciones) falta(o.texto, `Falta la opción ${o.letra} del hueco ${h.numero}.`);
      break;
    }
    case "REDACCION_UNA":
      falta(f.actividad.situacion, "Falta la situación.");
      pautasVacias(f.actividad.pautas, "la tarea");
      break;
    case "REDACCION_DOS":
      f.actividad.opciones.forEach((o, i) => {
        falta(o.contexto, `Falta el contexto de la opción ${i + 1}.`);
        pautasVacias(o.pautas, `la opción ${i + 1}`);
      });
      break;
    case "ORAL_SOLO":
      f.actividad.opciones.forEach((o, i) => {
        falta(o.tema, `Falta el tema de la opción ${i + 1}.`);
        pautasVacias(o.pautas, `la opción ${i + 1}`);
      });
      break;
    case "ORAL_DIRECTO":
      f.actividad.opciones.forEach((o, i) => {
        falta(o.tema, `Falta el tema de la opción ${i + 1}.`);
        falta(o.situacion, `Falta la situación de la opción ${i + 1}.`);
        pautasVacias(o.pautas, `la opción ${i + 1}`);
      });
      break;
  }
  return m;
}

function motivosDeMarcas(f: FormularioDe<"HUECOS">): string[] {
  if (vacio(f.actividad.texto)) return [];
  const m: string[] = [];
  const marcas = [...f.actividad.texto.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]));
  for (const h of f.actividad.huecos) {
    const veces = marcas.filter((n) => n === h.numero).length;
    if (veces === 0) m.push(`Falta la marca [${h.numero}] en el texto.`);
    if (veces > 1) m.push(`La marca [${h.numero}] aparece ${veces} veces en el texto.`);
  }
  const conocidos = new Set(f.actividad.huecos.map((h) => h.numero));
  for (const n of new Set(marcas)) if (!conocidos.has(n)) m.push(`El texto tiene una marca [${n}] que no es de ningún hueco.`);
  return m;
}

export function motivosDeTarea(
  regla: ReglaTarea,
  f: Formulario,
  respuestas: RespuestasDeUnaPrueba | null,
  claveGuardada: Record<string, string> | null,
): string[] {
  const motivos = textosQueFaltan(regla, f);
  if (f.forma === "HUECOS") motivos.push(...motivosDeMarcas(f));

  const numeros = itemsDelFormulario(f);
  if (numeros.length === 0) return motivos;
  if (!respuestas) return [...motivos, "Falta el cuadernillo, o no trae las respuestas de este examen."];

  const porLetra = new Map<string, number[]>();
  for (const n of numeros) {
    const letra = respuestas[String(n)];
    if (!letra) { motivos.push(`El cuadernillo no trae la respuesta de la ${n}.`); continue; }
    if (f.forma === "RELACIONAR" && letra === f.actividad.ejemplo.letra) {
      motivos.push(`La respuesta de la ${n} es «${letra}», que es la del ejemplo.`);
      continue;
    }
    const posibles = letrasPosibles(f, n);
    if (!posibles.includes(letra)) {
      motivos.push(`La respuesta de la ${n} es «${letra}», y esa pregunta solo tiene ${enumerar(posibles)}.`);
      continue;
    }
    porLetra.set(letra, [...(porLetra.get(letra) ?? []), n]);
  }
  if (f.forma === "RELACIONAR") {
    for (const [letra, ns] of porLetra) {
      if (ns.length > 1) motivos.push(`Las preguntas ${enumerar(ns.map(String))} tienen la misma respuesta, «${letra}».`);
    }
  }
  if (claveGuardada && !mismaClave(claveGuardada, claveDelFormulario(f, respuestas))) {
    motivos.push("La clave guardada no coincide con el cuadernillo: vuelve a guardar la tarea.");
  }
  return motivos;
}

export function estadoDeTarea(
  regla: ReglaTarea,
  f: Formulario | null,
  respuestas: RespuestasDeUnaPrueba | null,
  claveGuardada: Record<string, string> | null,
): EstadoDeTarea {
  if (!f) return { estado: "VACIA", motivos: ["Sin guardar todavía."], imagenesPendientes: 0 };
  const motivos = motivosDeTarea(regla, f, respuestas, claveGuardada);
  return { estado: motivos.length === 0 ? "COMPLETA" : "A_MEDIAS", motivos, imagenesPendientes: imagenesPendientes(f) };
}
```

Nota: `lleno("CE", 1)` pone la letra del ejemplo en «D»; `CE1` usa A, B, C, E, F y G para no chocar con ella. El caso de «clave guardada `{}`» es el de una tarea guardada antes de elegir cuadernillo.

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/taller-estado.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add lib/taller/estado.ts tests/taller-estado.test.ts
git commit -q -F - <<'EOF'
Estado de la tarea: lo que falta, las letras imposibles y la clave

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 6: Del formulario a las piezas y vuelta

**Files:**
- Create: `lib/taller/piezas.ts`
- Test: `tests/taller-piezas.test.ts`

**Interfaces:**
- Consumes: `formularioBase`, `formularioVacio`, `TIPO_DE_ACTIVIDAD`, `Formulario` (Tarea 3).
- Produces:
  - `type PiezaParaGuardar = { orden: number; tipo: "TEXTO" | "ACTIVIDAD"; texto: string | null; etiqueta: string | null; actividad: { tipo: TipoActividad; datos: Record<string, unknown> } | null }`
  - `piezasDelFormulario(f): PiezaParaGuardar[]`: orden 0 = consigna (TEXTO, etiqueta `"consigna"`), 1..n = textos sueltos (TEXTO), último = ACTIVIDAD con `datos = { forma, ...actividad }`
  - `type PiezaLeida = { orden: number; tipo: TipoPieza; texto: string | null; etiqueta: string | null; actividad: { datos: unknown } | null }`
  - `formularioDePiezas(piezas): Formulario | null`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-piezas.test.ts
import { describe, it, expect } from "vitest";
import { ESTRUCTURAS, PRUEBAS, reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { formularioDePiezas, piezasDelFormulario, type PiezaLeida } from "@/lib/taller/piezas";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;
const TODAS = PRUEBAS.flatMap((p) => ESCOLAR[p].map((r) => ({ nombre: `${p}-${r.numero}`, regla: r })));

/** Lo que devolvería Prisma al leer las piezas guardadas. */
function comoLeidas(f: Parameters<typeof piezasDelFormulario>[0]): PiezaLeida[] {
  return piezasDelFormulario(f).map((p) => ({
    orden: p.orden,
    tipo: p.tipo,
    texto: p.texto,
    etiqueta: p.etiqueta,
    actividad: p.actividad ? { datos: JSON.parse(JSON.stringify(p.actividad.datos)) } : null,
  }));
}

describe("formulario y piezas", () => {
  // Mutación que la mata: olvidar los textos sueltos al leer.
  it.each(TODAS)("$nombre va y vuelve igual", ({ regla }) => {
    const f = formularioVacio(regla);
    f.consigna = "Lee y responde.";
    f.textos = f.textos.map((t, i) => ({ etiqueta: `Persona ${i + 1}`, texto: `Texto ${i + 1}` }));
    expect(formularioDePiezas(comoLeidas(f))).toEqual(f);
  });

  it("Lectura 2 son cinco piezas en orden seguido: consigna, tres textos y la actividad", () => {
    const piezas = piezasDelFormulario(formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 2)!));
    expect(piezas.map((p) => [p.orden, p.tipo])).toEqual([
      [0, "TEXTO"], [1, "TEXTO"], [2, "TEXTO"], [3, "TEXTO"], [4, "ACTIVIDAD"],
    ]);
    expect(piezas[0].etiqueta).toBe("consigna");
  });

  it("la actividad lleva el tipo que toca", () => {
    const tipo = (prueba: "CE" | "EO", n: number) =>
      piezasDelFormulario(formularioVacio(reglaDe("A2_B1_ESCOLAR", prueba, n)!)).at(-1)!.actividad!.tipo;
    expect(tipo("CE", 4)).toBe("HUECOS");
    expect(tipo("EO", 2)).toBe("CONVERSACION");
  });

  // Aunque se lea en otro orden, la consigna es la pieza 0.
  it("el orden de lectura no importa", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
    f.consigna = "Consigna";
    f.textos[0].texto = "El texto";
    expect(formularioDePiezas(comoLeidas(f).reverse())).toEqual(f);
  });

  it("sin actividad, o con datos que ya no casan, no hay formulario", () => {
    expect(formularioDePiezas([])).toBeNull();
    const piezas = comoLeidas(formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!));
    piezas.at(-1)!.actividad = { datos: { forma: "OPCIONES", correcta: "B" } };
    expect(formularioDePiezas(piezas)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/taller-piezas.test.ts`
Expected: FAIL («Cannot find module '@/lib/taller/piezas'»).

- [ ] **Step 3: Escribir `lib/taller/piezas.ts`**

```ts
import type { TipoActividad, TipoPieza } from "@/lib/generated/prisma";
import { TIPO_DE_ACTIVIDAD, formularioBase, type Formulario } from "./formas";

export const ETIQUETA_DE_CONSIGNA = "consigna";

export type PiezaParaGuardar = {
  orden: number;
  tipo: Extract<TipoPieza, "TEXTO" | "ACTIVIDAD">;
  texto: string | null;
  etiqueta: string | null;
  actividad: { tipo: TipoActividad; datos: Record<string, unknown> } | null;
};

export type PiezaLeida = {
  orden: number;
  tipo: TipoPieza;
  texto: string | null;
  etiqueta: string | null;
  actividad: { datos: unknown } | null;
};

/**
 * Una tarea del taller en la lista de piezas del modelo: la consigna, los
 * textos sueltos y una actividad. Las respuestas NO van aquí: van en Clave.
 */
export function piezasDelFormulario(f: Formulario): PiezaParaGuardar[] {
  return [
    { orden: 0, tipo: "TEXTO", texto: f.consigna, etiqueta: ETIQUETA_DE_CONSIGNA, actividad: null },
    ...f.textos.map((t, i) => ({
      orden: i + 1,
      tipo: "TEXTO" as const,
      texto: t.texto,
      etiqueta: t.etiqueta,
      actividad: null,
    })),
    {
      orden: f.textos.length + 1,
      tipo: "ACTIVIDAD",
      texto: null,
      etiqueta: null,
      actividad: { tipo: TIPO_DE_ACTIVIDAD[f.forma], datos: { forma: f.forma, ...f.actividad } },
    },
  ];
}

/** Lo contrario. null si la tarea no se guardó nunca o si lo guardado ya no casa con ninguna forma. */
export function formularioDePiezas(piezas: readonly PiezaLeida[]): Formulario | null {
  const ordenadas = [...piezas].sort((a, b) => a.orden - b.orden);
  const datos = ordenadas.find((p) => p.tipo === "ACTIVIDAD")?.actividad?.datos;
  if (!datos || typeof datos !== "object") return null;
  const { forma, ...actividad } = datos as Record<string, unknown>;
  const textos = ordenadas.filter((p) => p.tipo === "TEXTO");
  const leido = formularioBase.safeParse({
    forma,
    consigna: textos[0]?.orden === 0 ? (textos[0].texto ?? "") : "",
    textos: textos.filter((p) => p.orden > 0).map((p) => ({ etiqueta: p.etiqueta ?? "", texto: p.texto ?? "" })),
    actividad,
  });
  return leido.success ? leido.data : null;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/taller-piezas.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add lib/taller/piezas.ts tests/taller-piezas.test.ts
git commit -q -F - <<'EOF'
Formulario del taller a piezas y de vuelta

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 7: Examen y tareas en la base

**Files:**
- Create: `lib/taller/examenes.ts`
- Test: `tests/base/taller-examenes.test.ts`

**Interfaces:**
- Consumes: Tareas 1-6.
- Produces:
  - `crearExamen({ titulo: string; nivel: string }): Promise<{ id: string } | { error: string }>`
  - `listarExamenes(): Promise<{ id; titulo; nivel; estado }[]>`
  - `respuestasDe(examen: { numeroEnCuadernillo: number | null; cuadernillo: { soluciones: unknown } | null }, prueba): RespuestasDeUnaPrueba | null`
  - `type ExamenDelTaller = { id; titulo; nivel: Nivel; numeroEnCuadernillo: number | null; cuadernillo: { id: string; titulo: string; resumen: ResumenDeExamen[] } | null; paginas: { id; ficheroId; orden; etiquetas: string[] }[]; tareas: { prueba: Prueba; numero: number; estado: EstadoDeTarea }[] }`
  - `examenParaElTaller(id): Promise<ExamenDelTaller | null>`
  - `type TareaDelTaller = { examen: { id; titulo }; prueba; numero; regla: ReglaTarea; formulario: Formulario; guardada: boolean; estado: EstadoDeTarea; respuestas: Record<string, string> | null; paginas: { ficheroId: string; orden: number }[]; temasDeLaHermana: string[] | null }`
  - `tareaParaElTaller(examenId, prueba: Prueba, numero: number): Promise<TareaDelTaller | null>`
  - `guardarTarea(examenId, prueba: Prueba, numero: number, bruto: unknown): Promise<{ estado: EstadoDeTarea } | { error: string }>`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/base/taller-examenes.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { reglaDe } from "@/lib/dele/estructura";
import { actividadParaElEstudiante } from "@/lib/examen/paraElEstudiante";
import { formularioVacio } from "@/lib/taller/formas";
import {
  crearExamen,
  examenParaElTaller,
  guardarTarea,
  tareaParaElTaller,
} from "@/lib/taller/examenes";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

// Letras inventadas: el repo es público.
const SOLUCIONES = {
  "1": { CE: { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" }, CO: {} },
  "2": { CE: { "13": "C", "14": "C", "15": "C", "16": "C", "17": "C", "18": "C" }, CO: {} },
};

async function examenConCuadernillo(numero: number | null = 1) {
  const cuadernillo = await prisma.cuadernillo.create({ data: { titulo: "Inventado", texto: "SOLUCIONES", soluciones: SOLUCIONES } });
  const creado = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  await prisma.examen.update({ where: { id: creado.id }, data: { cuadernilloId: cuadernillo.id, numeroEnCuadernillo: numero } });
  return creado.id;
}

function ce3Lleno() {
  const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
  if (f.forma !== "OPCIONES") throw new Error();
  f.consigna = "Lee el texto.";
  f.textos[0] = { etiqueta: "", texto: "Un texto inventado." };
  for (const p of f.actividad.preguntas) {
    p.enunciado = `Pregunta ${p.numero}`;
    for (const o of p.opciones) o.texto = `Opción ${o.letra}`;
  }
  return f;
}

describe("crear un examen", () => {
  // Mutación que la mata: no crear las tareas al crear el examen.
  it("el escolar nace con sus catorce tareas", async () => {
    const r = await crearExamen({ titulo: "  Libro, examen 1 ", nivel: "A2_B1_ESCOLAR" });
    if ("error" in r) throw new Error(r.error);
    const examen = await prisma.examen.findUniqueOrThrow({ where: { id: r.id }, include: { tareas: true } });
    expect(examen.titulo).toBe("Libro, examen 1");
    expect(examen.tareas).toHaveLength(14);
  });

  // Mutación que la mata: aceptar cualquier valor del enum Nivel.
  it("un nivel sin números no se crea", async () => {
    expect(await crearExamen({ titulo: "B2", nivel: "B2" })).toEqual({ error: "Ese nivel todavía no tiene sus números en el taller." });
    expect(await crearExamen({ titulo: "Nada", nivel: "Z9" })).toHaveProperty("error");
    expect(await prisma.examen.count()).toBe(0);
  });

  it("sin título no se crea", async () => {
    expect(await crearExamen({ titulo: "   ", nivel: "A2_B1_ESCOLAR" })).toEqual({ error: "El examen necesita un título." });
  });
});

describe("guardar una tarea", () => {
  it("guarda consigna, texto y actividad, y la clave del cuadernillo aparte", async () => {
    const id = await examenConCuadernillo();
    const r = await guardarTarea(id, "CE", 3, ce3Lleno());
    expect(r).toEqual({ estado: { estado: "COMPLETA", motivos: [], imagenesPendientes: 0 } });

    const piezas = await prisma.pieza.findMany({
      where: { tarea: { examenId: id, prueba: "CE", numero: 3 } },
      include: { actividad: { include: { clave: true } } },
      orderBy: { orden: "asc" },
    });
    expect(piezas.map((p) => p.tipo)).toEqual(["TEXTO", "TEXTO", "ACTIVIDAD"]);
    const actividad = piezas[2].actividad!;
    expect(actividad.tipo).toBe("OPCION");
    expect(actividad.clave?.respuestas).toEqual(SOLUCIONES["1"].CE);
    // Lo que sale hacia el estudiante no lleva la clave por ningún lado.
    expect(JSON.stringify(actividadParaElEstudiante(actividad))).not.toContain('"respuestas"');
  });

  // Mutación que la mata: no borrar las piezas viejas antes de escribir.
  it("guardar dos veces sustituye, no duplica", async () => {
    const id = await examenConCuadernillo();
    await guardarTarea(id, "CE", 3, ce3Lleno());
    await guardarTarea(id, "CE", 3, ce3Lleno());
    expect(await prisma.pieza.count({ where: { tarea: { examenId: id } } })).toBe(3);
    expect(await prisma.clave.count()).toBe(1);
  });

  // Mutación que la mata: escribir sin validar con esquemaDelFormulario.
  it("unos datos que no casan no escriben nada", async () => {
    const id = await examenConCuadernillo();
    const malo = { ...ce3Lleno(), extra: true };
    expect(await guardarTarea(id, "CE", 3, malo)).toEqual({
      error: "Los datos no casan con la forma de la tarea. No se ha guardado nada.",
    });
    expect(await prisma.pieza.count()).toBe(0);
  });

  it("una tarea a medias se guarda igual y dice qué falta", async () => {
    const id = await examenConCuadernillo();
    const f = ce3Lleno();
    f.consigna = "";
    const r = await guardarTarea(id, "CE", 3, f);
    expect(r).toMatchObject({ estado: { estado: "A_MEDIAS", motivos: ["Falta la consigna."] } });
    expect(await prisma.pieza.count()).toBe(3);
  });

  it("sin cuadernillo se guarda sin clave", async () => {
    const creado = await crearExamen({ titulo: "Sin cuadernillo", nivel: "A2_B1_ESCOLAR" });
    if ("error" in creado) throw new Error();
    await guardarTarea(creado.id, "CE", 3, ce3Lleno());
    expect(await prisma.clave.count()).toBe(0);
  });

  it("una tarea que no existe", async () => {
    const id = await examenConCuadernillo();
    expect(await guardarTarea(id, "CE", 9, ce3Lleno())).toEqual({ error: "Esa tarea no existe." });
    expect(await guardarTarea("no-existe", "CE", 3, ce3Lleno())).toEqual({ error: "Esa tarea no existe." });
  });
});

describe("leer para el taller", () => {
  it("el examen trae sus catorce tareas en orden, con su estado", async () => {
    const id = await examenConCuadernillo();
    await guardarTarea(id, "CE", 3, ce3Lleno());
    const examen = (await examenParaElTaller(id))!;
    expect(examen.tareas.map((t) => `${t.prueba}-${t.numero}`)).toEqual([
      "CE-1", "CE-2", "CE-3", "CE-4", "CO-1", "CO-2", "CO-3", "CO-4",
      "EE-1", "EE-2", "EO-1", "EO-2", "EO-3", "EO-4",
    ]);
    expect(examen.tareas[2].estado.estado).toBe("COMPLETA");
    expect(examen.tareas[0].estado.estado).toBe("VACIA");
    expect(examen.cuadernillo?.resumen.map((r) => r.examen)).toEqual(["1", "2"]);
  });

  // Mutación que la mata: no pasar la clave guardada a estadoDeTarea.
  it("si se cambia el número de examen del cuadernillo, la tarea pide volver a guardar", async () => {
    const id = await examenConCuadernillo(1);
    await guardarTarea(id, "CE", 3, ce3Lleno());
    await prisma.examen.update({ where: { id }, data: { numeroEnCuadernillo: 2 } });
    const examen = (await examenParaElTaller(id))!;
    expect(examen.tareas[2].estado.motivos).toContain(
      "La clave guardada no coincide con el cuadernillo: vuelve a guardar la tarea.",
    );
  });

  // Mutación que la mata: no filtrar las páginas por la etiqueta de la tarea.
  it("la tarea trae solo sus páginas, en orden", async () => {
    const id = await examenConCuadernillo();
    const ficheros = await Promise.all(
      [1, 2, 3].map((n) => prisma.fichero.create({ data: { almacen: "VERCEL", ruta: `material/p${n}.jpg`, tipoMime: "image/jpeg", bytes: 1 } })),
    );
    await prisma.paginaDeExamen.createMany({
      data: [
        { examenId: id, ficheroId: ficheros[0].id, orden: 1, etiquetas: ["CE-2"] },
        { examenId: id, ficheroId: ficheros[1].id, orden: 2, etiquetas: ["CE-2", "CE-3"] },
        { examenId: id, ficheroId: ficheros[2].id, orden: 3, etiquetas: ["CE-3"] },
      ],
    });
    const tarea = (await tareaParaElTaller(id, "CE", 3))!;
    expect(tarea.paginas).toEqual([
      { ficheroId: ficheros[1].id, orden: 2 },
      { ficheroId: ficheros[2].id, orden: 3 },
    ]);
    expect(tarea.guardada).toBe(false);
    expect(tarea.respuestas).toEqual(SOLUCIONES["1"].CE);
  });

  it("una oral en directo trae los temas de su hermana", async () => {
    const id = await examenConCuadernillo();
    const eo1 = formularioVacio(reglaDe("A2_B1_ESCOLAR", "EO", 1)!);
    if (eo1.forma !== "ORAL_SOLO") throw new Error();
    eo1.actividad.opciones[0].tema = "Las vacaciones";
    eo1.actividad.opciones[1].tema = "El deporte";
    await guardarTarea(id, "EO", 1, eo1);
    expect((await tareaParaElTaller(id, "EO", 2))!.temasDeLaHermana).toEqual(["Las vacaciones", "El deporte"]);
    expect((await tareaParaElTaller(id, "EO", 1))!.temasDeLaHermana).toBeNull();
  });

  it("una tarea o un examen que no existen", async () => {
    const id = await examenConCuadernillo();
    expect(await tareaParaElTaller(id, "CE", 7)).toBeNull();
    expect(await examenParaElTaller("no-existe")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npm run test:base -- tests/base/taller-examenes.test.ts`
Expected: FAIL («Cannot find module '@/lib/taller/examenes'»).

- [ ] **Step 3: Escribir `lib/taller/examenes.ts`**

```ts
import type { Nivel, Prisma, Prueba } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import {
  ESTRUCTURAS,
  PRUEBAS,
  etiquetaDeTarea,
  nivelesConReglas,
  reglaDe,
  type ReglaTarea,
} from "@/lib/dele/estructura";
import { esquemaDelFormulario, formularioVacio, type Formulario } from "./formas";
import { formularioDePiezas, piezasDelFormulario, type PiezaLeida } from "./piezas";
import { claveDelFormulario, estadoDeTarea, type EstadoDeTarea } from "./estado";
import { resumenDeSoluciones, type RespuestasDeUnaPrueba, type ResumenDeExamen, type Soluciones } from "./soluciones";

export async function crearExamen(datos: { titulo: string; nivel: string }): Promise<{ id: string } | { error: string }> {
  const titulo = datos.titulo.trim();
  if (!titulo) return { error: "El examen necesita un título." };
  if (titulo.length > 200) return { error: "El título es demasiado largo." };
  const nivel = nivelesConReglas().find((n) => n === datos.nivel);
  if (!nivel) return { error: "Ese nivel todavía no tiene sus números en el taller." };
  const estructura = ESTRUCTURAS[nivel]!;
  const examen = await prisma.examen.create({
    data: {
      titulo,
      nivel,
      tareas: { create: PRUEBAS.flatMap((prueba) => estructura[prueba].map((r) => ({ prueba, numero: r.numero }))) },
    },
  });
  return { id: examen.id };
}

export function listarExamenes() {
  return prisma.examen.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, titulo: true, nivel: true, estado: true },
  });
}

/** Las respuestas del cuadernillo para una prueba de este examen, o null si no hay de dónde sacarlas. */
export function respuestasDe(
  examen: { numeroEnCuadernillo: number | null; cuadernillo: { soluciones: unknown } | null },
  prueba: Prueba,
): RespuestasDeUnaPrueba | null {
  if (prueba !== "CE" && prueba !== "CO") return null;
  if (!examen.cuadernillo || examen.numeroEnCuadernillo === null) return null;
  const soluciones = examen.cuadernillo.soluciones as Soluciones;
  return soluciones[String(examen.numeroEnCuadernillo)]?.[prueba] ?? null;
}

const CON_PIEZAS = { piezas: { include: { actividad: { include: { clave: true } } } } } as const;

type TareaConPiezas = {
  piezas: (PiezaLeida & { actividad: { datos: unknown; clave: { respuestas: unknown } | null } | null })[];
};

/** El formulario guardado y su clave. `claveGuardada` es {} si se guardó sin cuadernillo, null si nunca se guardó. */
function leerTarea(tarea: TareaConPiezas): { formulario: Formulario | null; claveGuardada: Record<string, string> | null } {
  const formulario = formularioDePiezas(tarea.piezas);
  if (!formulario) return { formulario: null, claveGuardada: null };
  const clave = tarea.piezas.find((p) => p.tipo === "ACTIVIDAD")?.actividad?.clave?.respuestas;
  return { formulario, claveGuardada: (clave as Record<string, string> | undefined) ?? {} };
}

export type ExamenDelTaller = {
  id: string;
  titulo: string;
  nivel: Nivel;
  numeroEnCuadernillo: number | null;
  cuadernillo: { id: string; titulo: string; resumen: ResumenDeExamen[] } | null;
  paginas: { id: string; ficheroId: string; orden: number; etiquetas: string[] }[];
  tareas: { prueba: Prueba; numero: number; estado: EstadoDeTarea }[];
};

export async function examenParaElTaller(id: string): Promise<ExamenDelTaller | null> {
  const examen = await prisma.examen.findUnique({
    where: { id },
    include: { cuadernillo: true, paginas: { orderBy: { orden: "asc" } }, tareas: { include: CON_PIEZAS } },
  });
  if (!examen) return null;
  const estructura = ESTRUCTURAS[examen.nivel];

  const tareas = PRUEBAS.flatMap((prueba) =>
    examen.tareas
      .filter((t) => t.prueba === prueba)
      .sort((a, b) => a.numero - b.numero)
      .flatMap((t) => {
        const regla = reglaDe(examen.nivel, t.prueba, t.numero);
        if (!regla) return [];
        const { formulario, claveGuardada } = leerTarea(t);
        return [{ prueba: t.prueba, numero: t.numero, estado: estadoDeTarea(regla, formulario, respuestasDe(examen, t.prueba), claveGuardada) }];
      }),
  );

  return {
    id: examen.id,
    titulo: examen.titulo,
    nivel: examen.nivel,
    numeroEnCuadernillo: examen.numeroEnCuadernillo,
    cuadernillo:
      examen.cuadernillo && estructura
        ? {
            id: examen.cuadernillo.id,
            titulo: examen.cuadernillo.titulo,
            resumen: resumenDeSoluciones(examen.cuadernillo.soluciones as Soluciones, estructura),
          }
        : null,
    paginas: examen.paginas.map((p) => ({ id: p.id, ficheroId: p.ficheroId, orden: p.orden, etiquetas: p.etiquetas })),
    tareas,
  };
}

export type TareaDelTaller = {
  examen: { id: string; titulo: string };
  prueba: Prueba;
  numero: number;
  regla: ReglaTarea;
  formulario: Formulario;
  guardada: boolean;
  estado: EstadoDeTarea;
  /** Las respuestas del cuadernillo para los números de esta tarea, para enseñarlas sin editar. */
  respuestas: Record<string, string> | null;
  paginas: { ficheroId: string; orden: number }[];
  /** En las orales en directo, los temas de la tarea con la que van, para emparejar por tema. */
  temasDeLaHermana: string[] | null;
};

export async function tareaParaElTaller(examenId: string, prueba: Prueba, numero: number): Promise<TareaDelTaller | null> {
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { cuadernillo: true, paginas: { orderBy: { orden: "asc" } }, tareas: { where: { prueba }, include: CON_PIEZAS } },
  });
  if (!examen) return null;
  const regla = reglaDe(examen.nivel, prueba, numero);
  const tarea = examen.tareas.find((t) => t.numero === numero);
  if (!regla || !tarea) return null;

  const { formulario, claveGuardada } = leerTarea(tarea);
  const respuestas = respuestasDe(examen, prueba);
  const mostrado = formulario ?? formularioVacio(regla);

  let temasDeLaHermana: string[] | null = null;
  if (regla.hermana) {
    const hermana = examen.tareas.find((t) => t.numero === regla.hermana);
    const suyo = hermana ? leerTarea(hermana).formulario : null;
    temasDeLaHermana = suyo?.forma === "ORAL_SOLO" ? suyo.actividad.opciones.map((o) => o.tema) : ["", ""];
  }

  const etiqueta = etiquetaDeTarea(prueba, numero);
  return {
    examen: { id: examen.id, titulo: examen.titulo },
    prueba,
    numero,
    regla,
    formulario: mostrado,
    guardada: formulario !== null,
    estado: estadoDeTarea(regla, formulario, respuestas, claveGuardada),
    respuestas: claveDelFormulario(mostrado, respuestas),
    paginas: examen.paginas.filter((p) => p.etiquetas.includes(etiqueta)).map((p) => ({ ficheroId: p.ficheroId, orden: p.orden })),
    temasDeLaHermana,
  };
}

/**
 * Valida contra la forma de la tarea y reescribe sus piezas en una
 * transacción. La clave se COPIA del cuadernillo en este momento; si luego
 * cambia el cuadernillo, el estado lo avisa hasta que se vuelva a guardar.
 */
export async function guardarTarea(
  examenId: string,
  prueba: Prueba,
  numero: number,
  bruto: unknown,
): Promise<{ estado: EstadoDeTarea } | { error: string }> {
  const examen = await prisma.examen.findUnique({
    where: { id: examenId },
    include: { cuadernillo: true, tareas: { where: { prueba, numero } } },
  });
  const tarea = examen?.tareas[0];
  const regla = examen ? reglaDe(examen.nivel, prueba, numero) : null;
  if (!examen || !tarea || !regla) return { error: "Esa tarea no existe." };

  const leido = esquemaDelFormulario(regla).safeParse(bruto);
  if (!leido.success) return { error: "Los datos no casan con la forma de la tarea. No se ha guardado nada." };
  const formulario = leido.data;
  const respuestas = respuestasDe(examen, prueba);
  const clave = claveDelFormulario(formulario, respuestas);

  await prisma.$transaction(async (tx) => {
    await tx.pieza.deleteMany({ where: { tareaId: tarea.id } });
    for (const p of piezasDelFormulario(formulario)) {
      await tx.pieza.create({
        data: {
          tareaId: tarea.id,
          orden: p.orden,
          tipo: p.tipo,
          texto: p.texto,
          etiqueta: p.etiqueta,
          actividad: p.actividad
            ? {
                create: {
                  tipo: p.actividad.tipo,
                  datos: p.actividad.datos as Prisma.InputJsonValue,
                  clave: clave ? { create: { respuestas: clave } } : undefined,
                },
              }
            : undefined,
        },
      });
    }
  });

  return { estado: estadoDeTarea(regla, formulario, respuestas, clave ?? {}) };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npm run test:base -- tests/base/taller-examenes.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores de tipos. Si `Prisma` no se deja importar como tipo desde el cliente generado, importarlo como valor: `import { Prisma } from "@/lib/generated/prisma"` (así lo hace `app/api/ficheros/confirmar/route.ts`).

- [ ] **Step 5: Commit**

```bash
git add lib/taller/examenes.ts tests/base/taller-examenes.test.ts
git commit -q -F - <<'EOF'
Taller en la base: crear examen, leer para el taller y guardar tarea

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 8: Páginas y cuadernillos en la base

**Files:**
- Modify: `lib/ficheros/vercel.ts` (+ `borrarDeVercel`)
- Create: `lib/taller/paginas.ts`, `lib/taller/cuadernillos.ts`
- Test: `tests/base/taller-paginas.test.ts`, `tests/base/taller-cuadernillos.test.ts`

**Interfaces:**
- Consumes: `CARPETA_DE_MATERIAL` (ya existe), `etiquetasDeNivel` (Tarea 2), `leerSoluciones`, `textoDeTrozos`, `trozosSchema`, `TOPE_DE_TROZOS`, `Soluciones` (Tarea 4), ayudas de `tests/ayudas/cuadernillo-inventado.ts`.
- Produces:
  - `borrarDeVercel(ruta: string): Promise<void>`
  - `registrarPaginas(examenId, ficheroIds: string[]): Promise<{ error?: string }>`
  - `etiquetarPagina(examenId, paginaId, etiquetas: string[]): Promise<{ error?: string }>`
  - `borrarPaginas(examenId): Promise<void>`
  - `guardarCuadernillo({ titulo: string; trozos: unknown }): Promise<{ id: string } | { error: string }>`
  - `listarCuadernillos(): Promise<{ id: string; titulo: string; examenes: string[] }[]>`
  - `elegirCuadernillo(examenId, cuadernilloId: string | null, numero: number | null): Promise<{ error?: string }>`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/base/taller-paginas.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { borrarDeVercel } = vi.hoisted(() => ({ borrarDeVercel: vi.fn() }));
vi.mock("@/lib/ficheros/vercel", async (original) => ({
  ...(await original<typeof import("@/lib/ficheros/vercel")>()),
  borrarDeVercel,
}));

import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas } from "@/lib/taller/paginas";

beforeEach(async () => {
  borrarDeVercel.mockReset();
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

async function unExamen(): Promise<string> {
  const r = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in r) throw new Error(r.error);
  return r.id;
}

function unFichero(datos: { ruta?: string; tipoMime?: string; almacen?: "VERCEL" | "DRIVE" } = {}) {
  return prisma.fichero.create({
    data: {
      almacen: datos.almacen ?? "VERCEL",
      ruta: datos.ruta ?? `material/${Math.random().toString(36).slice(2)}.jpg`,
      tipoMime: datos.tipoMime ?? "image/jpeg",
      bytes: 1,
    },
  });
}

describe("registrar páginas", () => {
  // Mutación que la mata: ordenar los ficheros por id o por fecha en vez de por su posición.
  it("se guardan en el orden en que llegan, que es el del PDF", async () => {
    const id = await unExamen();
    const [a, b, c] = [await unFichero(), await unFichero(), await unFichero()];
    expect(await registrarPaginas(id, [c.id, a.id, b.id])).toEqual({});
    const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId: id }, orderBy: { orden: "asc" } });
    expect(paginas.map((p) => p.ficheroId)).toEqual([c.id, a.id, b.id]);
  });

  // Mutación que la mata: quitar cualquiera de las tres condiciones del filtro de ficheros.
  it.each([
    ["de Drive", { almacen: "DRIVE" as const }],
    ["un audio", { tipoMime: "audio/mpeg" }],
    ["fuera de la carpeta de material", { ruta: "grabaciones/x.jpg" }],
  ])("un fichero %s no puede ser página, y no se escribe nada", async (_, datos) => {
    const id = await unExamen();
    const bueno = await unFichero();
    const malo = await unFichero(datos);
    expect(await registrarPaginas(id, [bueno.id, malo.id])).toEqual({
      error: "Alguna página no es una imagen subida al almacén de material.",
    });
    expect(await prisma.paginaDeExamen.count()).toBe(0);
  });

  it("un examen que ya tiene páginas no admite otras encima", async () => {
    const id = await unExamen();
    await registrarPaginas(id, [(await unFichero()).id]);
    expect(await registrarPaginas(id, [(await unFichero()).id])).toEqual({
      error: "Este examen ya tiene páginas. Bórralas antes de subir otras.",
    });
  });

  it("una página repetida o una lista vacía", async () => {
    const id = await unExamen();
    const f = await unFichero();
    expect(await registrarPaginas(id, [f.id, f.id])).toEqual({ error: "Una página viene repetida." });
    expect(await registrarPaginas(id, [])).toEqual({ error: "No hay páginas que registrar." });
  });
});

describe("etiquetar una página", () => {
  it("guarda las etiquetas en el orden del examen y sin repetir", async () => {
    const id = await unExamen();
    await registrarPaginas(id, [(await unFichero()).id]);
    const pagina = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: id } });
    expect(await etiquetarPagina(id, pagina.id, ["CE-3", "CE-2", "CE-3"])).toEqual({});
    expect((await prisma.paginaDeExamen.findUniqueOrThrow({ where: { id: pagina.id } })).etiquetas).toEqual(["CE-2", "CE-3"]);
  });

  // Mutación que la mata: no comprobar las etiquetas contra el nivel.
  it("una tarea que el examen no tiene rebota", async () => {
    const id = await unExamen();
    await registrarPaginas(id, [(await unFichero()).id]);
    const pagina = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: id } });
    expect(await etiquetarPagina(id, pagina.id, ["CE-5"])).toEqual({ error: "Esa tarea no existe en este examen." });
  });

  // Mutación que la mata: no comprobar que la página es de ese examen.
  it("la página de otro examen no se toca desde este", async () => {
    const uno = await unExamen();
    const otro = await unExamen();
    await registrarPaginas(otro, [(await unFichero()).id]);
    const ajena = await prisma.paginaDeExamen.findFirstOrThrow({ where: { examenId: otro } });
    expect(await etiquetarPagina(uno, ajena.id, ["CE-1"])).toEqual({ error: "Esa página no existe." });
  });
});

describe("borrar las páginas", () => {
  // Mutación que la mata: no llamar a borrarDeVercel, o llamarlo antes de mirar si se usa.
  it("borra filas y ficheros, y los quita del almacén, salvo lo que use otro examen", async () => {
    const uno = await unExamen();
    const otro = await unFichero();
    const propio = await unFichero();
    const compartido = await unFichero();
    await registrarPaginas(uno, [propio.id, compartido.id]);
    const dos = await unExamen();
    await registrarPaginas(dos, [compartido.id, otro.id]);

    await borrarPaginas(uno);

    expect(await prisma.paginaDeExamen.count({ where: { examenId: uno } })).toBe(0);
    expect(await prisma.fichero.findUnique({ where: { id: propio.id } })).toBeNull();
    expect(await prisma.fichero.findUnique({ where: { id: compartido.id } })).not.toBeNull();
    expect(borrarDeVercel).toHaveBeenCalledTimes(1);
    expect(borrarDeVercel).toHaveBeenCalledWith(propio.ruta);
  });
});
```

```ts
// tests/base/taller-cuadernillos.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { crearExamen } from "@/lib/taller/examenes";
import { elegirCuadernillo, guardarCuadernillo, listarCuadernillos } from "@/lib/taller/cuadernillos";
import { ANCHO, lineasDeExamen, paginaDeSoluciones } from "../ayudas/cuadernillo-inventado";

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
});

const TROZOS = paginaDeSoluciones(21, lineasDeExamen(1), lineasDeExamen(2));

describe("guardar un cuadernillo", () => {
  it("guarda el texto y las soluciones, y se lista con sus exámenes", async () => {
    const r = await guardarCuadernillo({ titulo: " Libro inventado ", trozos: TROZOS });
    if ("error" in r) throw new Error(r.error);
    const guardado = await prisma.cuadernillo.findUniqueOrThrow({ where: { id: r.id } });
    expect(guardado.titulo).toBe("Libro inventado");
    expect(guardado.texto).toContain("SOLUCIONES");
    expect(await listarCuadernillos()).toEqual([{ id: r.id, titulo: "Libro inventado", examenes: ["1", "2"] }]);
  });

  // Mutación que la mata: guardar aunque leerSoluciones no encuentre nada.
  it("un PDF sin tabla de soluciones no se guarda", async () => {
    const trozos = [{ pagina: 1, x: 50, y: 700, texto: "Transcripciones", anchoPagina: ANCHO }];
    expect(await guardarCuadernillo({ titulo: "X", trozos })).toEqual({ error: "No encuentro la tabla de SOLUCIONES en ese PDF." });
    expect(await prisma.cuadernillo.count()).toBe(0);
  });

  it("un PDF sin texto, un título vacío y unos trozos manipulados", async () => {
    expect(await guardarCuadernillo({ titulo: "X", trozos: [] })).toEqual({ error: "Ese PDF no tiene texto: parece un escaneo." });
    expect(await guardarCuadernillo({ titulo: " ", trozos: TROZOS })).toEqual({ error: "El cuadernillo necesita un título." });
    expect(await guardarCuadernillo({ titulo: "X", trozos: [{ pagina: 1 }] })).toHaveProperty("error");
    expect(await prisma.cuadernillo.count()).toBe(0);
  });
});

describe("elegir el cuadernillo de un examen", () => {
  async function preparar() {
    const c = await guardarCuadernillo({ titulo: "Libro", trozos: TROZOS });
    const e = await crearExamen({ titulo: "Examen", nivel: "A2_B1_ESCOLAR" });
    if ("error" in c || "error" in e) throw new Error();
    return { cuadernilloId: c.id, examenId: e.id };
  }

  it("elige cuadernillo y número", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo(examenId, cuadernilloId, 2)).toEqual({});
    expect(await prisma.examen.findUniqueOrThrow({ where: { id: examenId } })).toMatchObject({ cuadernilloId, numeroEnCuadernillo: 2 });
  });

  // Mutación que la mata: no comprobar que el número existe en las soluciones.
  it("un número que el cuadernillo no trae rebota", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo(examenId, cuadernilloId, 7)).toEqual({ error: "El cuadernillo no trae el examen 7." });
    expect((await prisma.examen.findUniqueOrThrow({ where: { id: examenId } })).cuadernilloId).toBeNull();
  });

  it("sin número todavía vale, y quitar el cuadernillo quita también el número", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo(examenId, cuadernilloId, null)).toEqual({});
    await elegirCuadernillo(examenId, cuadernilloId, 1);
    expect(await elegirCuadernillo(examenId, null, 1)).toEqual({});
    expect(await prisma.examen.findUniqueOrThrow({ where: { id: examenId } })).toMatchObject({ cuadernilloId: null, numeroEnCuadernillo: null });
  });

  it("un examen o un cuadernillo que no existen", async () => {
    const { cuadernilloId, examenId } = await preparar();
    expect(await elegirCuadernillo("no-existe", cuadernilloId, 1)).toEqual({ error: "Ese examen no existe." });
    expect(await elegirCuadernillo(examenId, "no-existe", 1)).toEqual({ error: "Ese cuadernillo no existe." });
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npm run test:base -- tests/base/taller-paginas.test.ts tests/base/taller-cuadernillos.test.ts`
Expected: FAIL (módulos que no existen).

- [ ] **Step 3: Añadir `borrarDeVercel` a `lib/ficheros/vercel.ts`**

Añadir `del` al import de `@vercel/blob` y, debajo de `enlaceDeLectura`:

```ts
/** Borra un fichero del almacén. Solo lo llama quien ya ha borrado su fila y ha visto que nadie más lo usa. */
export async function borrarDeVercel(ruta: string): Promise<void> {
  await del(ruta);
}
```

- [ ] **Step 4: Escribir `lib/taller/paginas.ts`**

```ts
import { prisma } from "@/lib/db";
import { CARPETA_DE_MATERIAL, borrarDeVercel } from "@/lib/ficheros/vercel";
import { etiquetasDeNivel } from "@/lib/dele/estructura";

const MAXIMO_DE_PAGINAS = 200;

/**
 * Registra de una vez todas las páginas de un examen, en el orden del PDF.
 * Solo acepta imágenes del almacén de material: sin este filtro, un
 * identificador cualquiera (una grabación de un estudiante, por ejemplo)
 * podría acabar enseñándose como página.
 */
export async function registrarPaginas(examenId: string, ficheroIds: string[]): Promise<{ error?: string }> {
  if (ficheroIds.length === 0 || ficheroIds.length > MAXIMO_DE_PAGINAS) return { error: "No hay páginas que registrar." };
  if (new Set(ficheroIds).size !== ficheroIds.length) return { error: "Una página viene repetida." };

  const examen = await prisma.examen.findUnique({ where: { id: examenId }, include: { _count: { select: { paginas: true } } } });
  if (!examen) return { error: "Ese examen no existe." };
  if (examen._count.paginas > 0) return { error: "Este examen ya tiene páginas. Bórralas antes de subir otras." };

  const ficheros = await prisma.fichero.findMany({ where: { id: { in: ficheroIds } } });
  const validos = new Set(
    ficheros
      .filter((f) => f.almacen === "VERCEL" && f.tipoMime.startsWith("image/") && f.ruta.startsWith(`${CARPETA_DE_MATERIAL}/`))
      .map((f) => f.id),
  );
  if (ficheroIds.some((id) => !validos.has(id))) {
    return { error: "Alguna página no es una imagen subida al almacén de material." };
  }

  await prisma.paginaDeExamen.createMany({
    data: ficheroIds.map((ficheroId, i) => ({ examenId, ficheroId, orden: i + 1 })),
  });
  return {};
}

export async function etiquetarPagina(examenId: string, paginaId: string, etiquetas: string[]): Promise<{ error?: string }> {
  const pagina = await prisma.paginaDeExamen.findUnique({ where: { id: paginaId }, include: { examen: true } });
  if (!pagina || pagina.examenId !== examenId) return { error: "Esa página no existe." };
  const validas = etiquetasDeNivel(pagina.examen.nivel);
  if (etiquetas.some((e) => !validas.includes(e))) return { error: "Esa tarea no existe en este examen." };
  await prisma.paginaDeExamen.update({
    where: { id: paginaId },
    data: { etiquetas: validas.filter((v) => etiquetas.includes(v)) },
  });
  return {};
}

/**
 * Borra las páginas del examen y, de sus ficheros, los que ya no usa nadie
 * (ni otra página ni una pieza). Primero la fila y luego el almacén: si el
 * almacén falla, queda un fichero huérfano allí, que no rompe nada.
 */
export async function borrarPaginas(examenId: string): Promise<void> {
  const paginas = await prisma.paginaDeExamen.findMany({ where: { examenId }, include: { fichero: true } });
  await prisma.paginaDeExamen.deleteMany({ where: { examenId } });
  for (const { fichero } of paginas) {
    const enUso =
      (await prisma.paginaDeExamen.count({ where: { ficheroId: fichero.id } })) +
      (await prisma.pieza.count({ where: { ficheroId: fichero.id } }));
    if (enUso > 0) continue;
    await prisma.fichero.delete({ where: { id: fichero.id } });
    await borrarDeVercel(fichero.ruta);
  }
}
```

- [ ] **Step 5: Escribir `lib/taller/cuadernillos.ts`**

```ts
import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { TOPE_DE_TROZOS, leerSoluciones, textoDeTrozos, trozosSchema, type Soluciones } from "./soluciones";

export async function guardarCuadernillo(datos: { titulo: string; trozos: unknown }): Promise<{ id: string } | { error: string }> {
  const titulo = datos.titulo.trim();
  if (!titulo) return { error: "El cuadernillo necesita un título." };
  const trozos = trozosSchema.safeParse(datos.trozos);
  if (!trozos.success) return { error: `No se ha podido leer el PDF (como mucho ${TOPE_DE_TROZOS} trozos de texto).` };
  const texto = textoDeTrozos(trozos.data);
  if (!texto) return { error: "Ese PDF no tiene texto: parece un escaneo." };
  const soluciones = leerSoluciones(trozos.data);
  if (Object.keys(soluciones).length === 0) return { error: "No encuentro la tabla de SOLUCIONES en ese PDF." };
  const cuadernillo = await prisma.cuadernillo.create({
    data: { titulo, texto, soluciones: soluciones as Prisma.InputJsonValue },
  });
  return { id: cuadernillo.id };
}

export async function listarCuadernillos(): Promise<{ id: string; titulo: string; examenes: string[] }[]> {
  const cuadernillos = await prisma.cuadernillo.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, titulo: true, soluciones: true },
  });
  return cuadernillos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    examenes: Object.keys(c.soluciones as Soluciones).sort((a, b) => Number(a) - Number(b)),
  }));
}

/** `cuadernilloId` null quita el cuadernillo y el número. `numero` null deja el cuadernillo elegido sin número todavía. */
export async function elegirCuadernillo(
  examenId: string,
  cuadernilloId: string | null,
  numero: number | null,
): Promise<{ error?: string }> {
  const examen = await prisma.examen.findUnique({ where: { id: examenId } });
  if (!examen) return { error: "Ese examen no existe." };
  if (cuadernilloId === null) {
    await prisma.examen.update({ where: { id: examenId }, data: { cuadernilloId: null, numeroEnCuadernillo: null } });
    return {};
  }
  const cuadernillo = await prisma.cuadernillo.findUnique({ where: { id: cuadernilloId } });
  if (!cuadernillo) return { error: "Ese cuadernillo no existe." };
  if (numero !== null && !(String(numero) in (cuadernillo.soluciones as Soluciones))) {
    return { error: `El cuadernillo no trae el examen ${numero}.` };
  }
  await prisma.examen.update({ where: { id: examenId }, data: { cuadernilloId, numeroEnCuadernillo: numero } });
  return {};
}
```

- [ ] **Step 6: Correr y ver que pasan**

Run: `npm run test:base && npx tsc --noEmit`
Expected: PASS entera y sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add lib/ficheros/vercel.ts lib/taller/paginas.ts lib/taller/cuadernillos.ts tests/base/taller-paginas.test.ts tests/base/taller-cuadernillos.test.ts
git commit -q -F - <<'EOF'
Páginas y cuadernillos del taller en la base

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 9: Las acciones del taller, con candado

**Files:**
- Create: `app/examenes/acciones.ts`
- Test: `tests/taller-acciones.test.ts`

**Interfaces:**
- Consumes: `exigirProfesor` (ya existe), `esPrueba` (Tarea 2), `crearExamen`, `guardarTarea` (Tarea 7), `registrarPaginas`, `etiquetarPagina`, `borrarPaginas`, `guardarCuadernillo`, `elegirCuadernillo` (Tarea 8), `EstadoDeTarea` (Tarea 5).
- Produces (todas `"use server"`):
  - `crearExamenAccion(formulario: FormData): Promise<void>` → redirige a `/examenes/<id>` o a `/examenes?error=…`
  - `registrarPaginasAccion(examenId: string, ficheroIds: string[]): Promise<{ error?: string }>`
  - `borrarPaginasAccion(examenId: string): Promise<void>`
  - `etiquetarPaginaAccion(examenId: string, paginaId: string, etiquetas: string[]): Promise<{ error?: string }>`
  - `guardarCuadernilloAccion(examenId: string, titulo: string, trozos: unknown): Promise<{ error?: string }>` (guarda y lo deja elegido para el examen, sin número)
  - `elegirCuadernilloAccion(examenId: string, formulario: FormData): Promise<void>` → campos `cuadernilloId` y `numero`; redirige a `/examenes/<id>` o con `?error=`
  - `guardarTareaAccion(examenId: string, prueba: string, numero: number, formulario: unknown): Promise<{ estado: EstadoDeTarea } | { error: string }>`

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-acciones.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Persona } from "@/lib/generated/prisma";

// Una acción de servidor es una dirección pública: quien la conozca la llama
// sin pasar por la pantalla. Aquí se llama a CADA acción directamente, una por
// una, para que quitar el candado de cualquiera de ellas ponga esto en rojo
// (probar la regla y no el sitio donde se aplica ya nos pilló tres veces).
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); }),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  revalidatePath: vi.fn(),
  crearExamen: vi.fn(),
  guardarTarea: vi.fn(),
  registrarPaginas: vi.fn(),
  etiquetarPagina: vi.fn(),
  borrarPaginas: vi.fn(),
  guardarCuadernillo: vi.fn(),
  elegirCuadernillo: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect: dobles.redirect, notFound: dobles.notFound }));
vi.mock("next/cache", () => ({ revalidatePath: dobles.revalidatePath }));
vi.mock("@/lib/taller/examenes", () => ({ crearExamen: dobles.crearExamen, guardarTarea: dobles.guardarTarea }));
vi.mock("@/lib/taller/paginas", () => ({
  registrarPaginas: dobles.registrarPaginas,
  etiquetarPagina: dobles.etiquetarPagina,
  borrarPaginas: dobles.borrarPaginas,
}));
vi.mock("@/lib/taller/cuadernillos", () => ({
  guardarCuadernillo: dobles.guardarCuadernillo,
  elegirCuadernillo: dobles.elegirCuadernillo,
}));

import {
  borrarPaginasAccion,
  crearExamenAccion,
  elegirCuadernilloAccion,
  etiquetarPaginaAccion,
  guardarCuadernilloAccion,
  guardarTareaAccion,
  registrarPaginasAccion,
} from "@/app/examenes/acciones";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

function como(persona: Persona | null) {
  if (!persona) { dobles.cookiesGet.mockReturnValue(undefined); return; }
  dobles.cookiesGet.mockReturnValue({ value: `cookie-de-${persona.id}` });
  dobles.personaDeLaCookie.mockResolvedValue(persona);
}

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

// toThrow(cadena) compara por subcadena; esto captura el mensaje exacto.
async function mensajeDelRechazo(promesa: Promise<unknown>): Promise<string> {
  try { await promesa; } catch (error) { return error instanceof Error ? error.message : String(error); }
  throw new Error("se esperaba que la promesa rechazara, y no lo hizo");
}

const ACCIONES = [
  { nombre: "crearExamenAccion", llamar: () => crearExamenAccion(formulario({ titulo: "X", nivel: "A2_B1_ESCOLAR" })), tocan: [dobles.crearExamen] },
  { nombre: "registrarPaginasAccion", llamar: () => registrarPaginasAccion("x1", ["f1"]), tocan: [dobles.registrarPaginas] },
  { nombre: "borrarPaginasAccion", llamar: () => borrarPaginasAccion("x1"), tocan: [dobles.borrarPaginas] },
  { nombre: "etiquetarPaginaAccion", llamar: () => etiquetarPaginaAccion("x1", "p1", ["CE-1"]), tocan: [dobles.etiquetarPagina] },
  { nombre: "guardarCuadernilloAccion", llamar: () => guardarCuadernilloAccion("x1", "Libro", []), tocan: [dobles.guardarCuadernillo, dobles.elegirCuadernillo] },
  { nombre: "elegirCuadernilloAccion", llamar: () => elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "c1", numero: "1" })), tocan: [dobles.elegirCuadernillo] },
  { nombre: "guardarTareaAccion", llamar: () => guardarTareaAccion("x1", "CE", 3, {}), tocan: [dobles.guardarTarea] },
];

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
});

describe("cada acción del taller exige al profesor", () => {
  // Mutación que la mata: quitar `await exigirProfesor()` de cualquier acción,
  // o cambiarlo por exigirPersona.
  it.each(ACCIONES)("$nombre: un estudiante topa con el no encontrado y no toca nada", async ({ llamar, tocan }) => {
    como(ESTUDIANTE);
    expect(await mensajeDelRechazo(llamar())).toBe("NOT_FOUND");
    for (const f of tocan) expect(f).not.toHaveBeenCalled();
  });

  it.each(ACCIONES)("$nombre: sin sesión, a entrar", async ({ llamar, tocan }) => {
    como(null);
    expect(await mensajeDelRechazo(llamar())).toBe("REDIRECT:/entrar");
    for (const f of tocan) expect(f).not.toHaveBeenCalled();
  });
});

describe("lo que hace cada acción con el profesor", () => {
  beforeEach(() => como(PROFESOR));

  it("crear un examen lleva a su pantalla, o vuelve con el error exacto", async () => {
    dobles.crearExamen.mockResolvedValue({ id: "e9" });
    expect(await mensajeDelRechazo(crearExamenAccion(formulario({ titulo: "Uno", nivel: "A2_B1_ESCOLAR" })))).toBe("REDIRECT:/examenes/e9");
    expect(dobles.crearExamen).toHaveBeenCalledWith({ titulo: "Uno", nivel: "A2_B1_ESCOLAR" });

    dobles.crearExamen.mockResolvedValue({ error: "El examen necesita un título." });
    expect(await mensajeDelRechazo(crearExamenAccion(formulario({ titulo: "", nivel: "A2_B1_ESCOLAR" })))).toBe(
      `REDIRECT:/examenes?error=${encodeURIComponent("El examen necesita un título.")}`,
    );
  });

  // Mutación que la mata: no comprobar esPrueba antes de llamar a guardarTarea.
  it("guardar una tarea de una prueba inventada no llega a la base", async () => {
    expect(await guardarTareaAccion("x1", "XX", 3, {})).toEqual({ error: "Esa tarea no existe." });
    expect(await guardarTareaAccion("x1", "CE", 2.5, {})).toEqual({ error: "Esa tarea no existe." });
    expect(dobles.guardarTarea).not.toHaveBeenCalled();
  });

  it("guardar una tarea devuelve lo que diga la base", async () => {
    dobles.guardarTarea.mockResolvedValue({ estado: { estado: "COMPLETA", motivos: [], imagenesPendientes: 0 } });
    expect(await guardarTareaAccion("x1", "CE", 3, { forma: "OPCIONES" })).toMatchObject({ estado: { estado: "COMPLETA" } });
    expect(dobles.guardarTarea).toHaveBeenCalledWith("x1", "CE", 3, { forma: "OPCIONES" });
  });

  // Mutación que la mata: elegir el cuadernillo aunque guardarlo haya fallado.
  it("un cuadernillo que no se guarda no se elige", async () => {
    dobles.guardarCuadernillo.mockResolvedValue({ error: "No encuentro la tabla de SOLUCIONES en ese PDF." });
    expect(await guardarCuadernilloAccion("x1", "Libro", [])).toEqual({ error: "No encuentro la tabla de SOLUCIONES en ese PDF." });
    expect(dobles.elegirCuadernillo).not.toHaveBeenCalled();
  });

  it("un cuadernillo guardado queda elegido para el examen, sin número", async () => {
    dobles.guardarCuadernillo.mockResolvedValue({ id: "c1" });
    dobles.elegirCuadernillo.mockResolvedValue({});
    expect(await guardarCuadernilloAccion("x1", "Libro", [])).toEqual({});
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", "c1", null);
  });

  // Mutación que la mata: pasar Number("abc") (NaN) a elegirCuadernillo.
  it("elegir con un número que no es número vuelve con error y no toca la base", async () => {
    expect(await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "c1", numero: "abc" })))).toBe(
      `REDIRECT:/examenes/x1?error=${encodeURIComponent("Ese número de examen no vale.")}`,
    );
    expect(dobles.elegirCuadernillo).not.toHaveBeenCalled();
  });

  it("elegir cuadernillo y número", async () => {
    dobles.elegirCuadernillo.mockResolvedValue({});
    expect(await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "c1", numero: "3" })))).toBe("REDIRECT:/examenes/x1");
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", "c1", 3);
  });

  it("elegir sin cuadernillo lo quita", async () => {
    dobles.elegirCuadernillo.mockResolvedValue({});
    await mensajeDelRechazo(elegirCuadernilloAccion("x1", formulario({ cuadernilloId: "", numero: "" })));
    expect(dobles.elegirCuadernillo).toHaveBeenCalledWith("x1", null, null);
  });

  it("etiquetar y registrar pasan sus datos tal cual", async () => {
    dobles.etiquetarPagina.mockResolvedValue({});
    dobles.registrarPaginas.mockResolvedValue({});
    await etiquetarPaginaAccion("x1", "p1", ["CE-2", "CE-3"]);
    await registrarPaginasAccion("x1", ["f2", "f1"]);
    expect(dobles.etiquetarPagina).toHaveBeenCalledWith("x1", "p1", ["CE-2", "CE-3"]);
    expect(dobles.registrarPaginas).toHaveBeenCalledWith("x1", ["f2", "f1"]);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/taller-acciones.test.ts`
Expected: FAIL («Cannot find module '@/app/examenes/acciones'»).

- [ ] **Step 3: Escribir `app/examenes/acciones.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { esPrueba } from "@/lib/dele/estructura";
import { crearExamen, guardarTarea } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas } from "@/lib/taller/paginas";
import { elegirCuadernillo, guardarCuadernillo } from "@/lib/taller/cuadernillos";
import type { EstadoDeTarea } from "@/lib/taller/estado";

// Las pantallas ya exigen al profesor, pero una acción de servidor es una
// dirección pública: cada una vuelve a comprobarlo, la primera línea.

const pantallaDelExamen = (examenId: string) => `/examenes/${examenId}`;

export async function crearExamenAccion(formulario: FormData): Promise<void> {
  await exigirProfesor();
  const r = await crearExamen({
    titulo: String(formulario.get("titulo") ?? ""),
    nivel: String(formulario.get("nivel") ?? ""),
  });
  if ("error" in r) redirect(`/examenes?error=${encodeURIComponent(r.error)}`);
  redirect(pantallaDelExamen(r.id));
}

export async function registrarPaginasAccion(examenId: string, ficheroIds: string[]): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await registrarPaginas(examenId, ficheroIds);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

export async function borrarPaginasAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await borrarPaginas(examenId);
  revalidatePath(pantallaDelExamen(examenId));
}

export async function etiquetarPaginaAccion(examenId: string, paginaId: string, etiquetas: string[]): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await etiquetarPagina(examenId, paginaId, etiquetas);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}

export async function guardarCuadernilloAccion(examenId: string, titulo: string, trozos: unknown): Promise<{ error?: string }> {
  await exigirProfesor();
  const guardado = await guardarCuadernillo({ titulo, trozos });
  if ("error" in guardado) return { error: guardado.error };
  const elegido = await elegirCuadernillo(examenId, guardado.id, null);
  revalidatePath(pantallaDelExamen(examenId));
  return elegido;
}

export async function elegirCuadernilloAccion(examenId: string, formulario: FormData): Promise<void> {
  await exigirProfesor();
  const cuadernilloId = String(formulario.get("cuadernilloId") ?? "") || null;
  const numeroEscrito = String(formulario.get("numero") ?? "");
  const numero = numeroEscrito === "" ? null : Number(numeroEscrito);
  const r =
    numero !== null && !Number.isInteger(numero)
      ? { error: "Ese número de examen no vale." }
      : await elegirCuadernillo(examenId, cuadernilloId, cuadernilloId ? numero : null);
  revalidatePath(pantallaDelExamen(examenId));
  if (r.error) redirect(`${pantallaDelExamen(examenId)}?error=${encodeURIComponent(r.error)}`);
  redirect(pantallaDelExamen(examenId));
}

export async function guardarTareaAccion(
  examenId: string,
  prueba: string,
  numero: number,
  formulario: unknown,
): Promise<{ estado: EstadoDeTarea } | { error: string }> {
  await exigirProfesor();
  if (!esPrueba(prueba) || !Number.isInteger(numero)) return { error: "Esa tarea no existe." };
  const r = await guardarTarea(examenId, prueba, numero, formulario);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `npx vitest run tests/taller-acciones.test.ts && npx tsc --noEmit`
Expected: PASS (7 + 7 del candado y 8 más) y sin errores de tipos.

- [ ] **Step 5: Comprobar la mutación del candado**

Borrar `await exigirProfesor();` de `borrarPaginasAccion`, correr la prueba: tienen que caer exactamente las dos filas de `borrarPaginasAccion`. Deshacer.

- [ ] **Step 6: Commit**

```bash
git add app/examenes/acciones.ts tests/taller-acciones.test.ts
git commit -q -F - <<'EOF'
Acciones del taller, cada una con su candado de profesor

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 10: Subir páginas y cuadernillo desde el navegador

**Files:**
- Create: `lib/ficheros/subir-desde-navegador.ts`, `lib/taller/pdf-en-navegador.ts`, `lib/taller/lista-de-subida.ts`, `lib/taller/etiquetas.ts`
- Create: `components/taller/subir-paginas.tsx`, `components/taller/etiquetas-de-pagina.tsx`, `components/taller/subir-cuadernillo.tsx`
- Modify: `app/pruebas/subir/formulario.tsx` (usa la función sacada), `package.json` (`postinstall`), `.gitignore`
- Test: `tests/subir-desde-navegador.test.ts`, `tests/taller-ayudas-de-cliente.test.ts`

**Interfaces:**
- Consumes: acciones de la Tarea 9; `trozosDeDocumento`, `Trozo` (Tarea 4); `nombreDeEtiqueta` (Tarea 2).
- Produces:
  - `subirAlAlmacen(fichero: File, llamar?: typeof fetch): Promise<string>` (id del `Fichero`)
  - `paginasDePdf(fichero: File): Promise<File[]>`, `trozosDePdf(fichero: File): Promise<Trozo[]>` (solo navegador)
  - `type EstadoDePagina = { nombre: string; estado: "PENDIENTE" | "SUBIENDO" | "SUBIDA" | "FALLIDA"; ficheroId: string | null; error: string | null }`, `idsEnOrden(paginas): string[] | null`
  - `alternarEtiqueta(todas, marcadas, etiqueta): string[]`
  - `<SubirPaginas examenId hayPaginas />`, `<EtiquetasDePagina examenId pagina todas />`, `<SubirCuadernillo examenId />`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/subir-desde-navegador.test.ts
import { describe, it, expect, vi } from "vitest";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

function fichero() {
  return new File([new Uint8Array([1, 2, 3])], "pagina-1.jpg", { type: "image/jpeg" });
}

describe("subir un fichero al almacén desde el navegador", () => {
  // Mutación que la mata: devolver la ruta en vez del id de la confirmación.
  it("pide permiso, sube al almacén y confirma, y devuelve el id", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json({ url: "https://almacen/firmada", ruta: "material/pagina-1-ab.jpg" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json({ id: "f1" }));
    expect(await subirAlAlmacen(fichero(), llamar)).toBe("f1");
    expect(llamar.mock.calls.map((c) => c[0])).toEqual(["/api/ficheros/permiso", "https://almacen/firmada", "/api/ficheros/confirmar"]);
    expect(JSON.parse(llamar.mock.calls[0][1].body)).toEqual({ nombre: "pagina-1.jpg", tipoMime: "image/jpeg", bytes: 3 });
    expect(JSON.parse(llamar.mock.calls[2][1].body)).toEqual({ ruta: "material/pagina-1-ab.jpg", nombreOriginal: "pagina-1.jpg" });
  });

  it("si el permiso falla, el mensaje del servidor llega tal cual", async () => {
    const llamar = vi.fn().mockResolvedValueOnce(json({ error: "Solo se admiten imágenes o audio." }, 400));
    await expect(subirAlAlmacen(fichero(), llamar)).rejects.toThrow("Solo se admiten imágenes o audio.");
    expect(llamar).toHaveBeenCalledTimes(1);
  });

  it("si el almacén rechaza la subida, no se confirma", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json({ url: "https://almacen/firmada", ruta: "material/x.jpg" }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(subirAlAlmacen(fichero(), llamar)).rejects.toThrow("El almacén rechazó la subida.");
    expect(llamar).toHaveBeenCalledTimes(2);
  });

  it("si la confirmación falla sin JSON, sale el mensaje por defecto", async () => {
    const llamar = vi
      .fn()
      .mockResolvedValueOnce(json({ url: "https://almacen/firmada", ruta: "material/x.jpg" }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response("caído", { status: 500 }));
    await expect(subirAlAlmacen(fichero(), llamar)).rejects.toThrow("No se pudo confirmar la subida.");
  });
});
```

```ts
// tests/taller-ayudas-de-cliente.test.ts
import { describe, it, expect } from "vitest";
import { alternarEtiqueta } from "@/lib/taller/etiquetas";
import { idsEnOrden, type EstadoDePagina } from "@/lib/taller/lista-de-subida";

const subida = (ficheroId: string): EstadoDePagina => ({ nombre: ficheroId, estado: "SUBIDA", ficheroId, error: null });

describe("la lista de subida", () => {
  // Mutación que la mata: ordenar por id o por llegada.
  it("da los ids en el orden de la lista, que es el del PDF", () => {
    expect(idsEnOrden([subida("f3"), subida("f1"), subida("f2")])).toEqual(["f3", "f1", "f2"]);
  });

  // Mutación que la mata: saltarse las que no han llegado en vez de devolver null.
  it("mientras falte una, no hay lista", () => {
    const fallida: EstadoDePagina = { nombre: "p2", estado: "FALLIDA", ficheroId: null, error: "Cortado" };
    expect(idsEnOrden([subida("f1"), fallida, subida("f3")])).toBeNull();
    expect(idsEnOrden([])).toBeNull();
  });
});

describe("alternar una etiqueta", () => {
  const TODAS = ["CE-1", "CE-2", "CE-3", "CE-4"];

  it("pone y quita, y deja las etiquetas en el orden del examen", () => {
    expect(alternarEtiqueta(TODAS, ["CE-3"], "CE-2")).toEqual(["CE-2", "CE-3"]);
    expect(alternarEtiqueta(TODAS, ["CE-2", "CE-3"], "CE-2")).toEqual(["CE-3"]);
  });

  it("una etiqueta que el examen no tiene no entra", () => {
    expect(alternarEtiqueta(TODAS, [], "EO-9")).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/subir-desde-navegador.test.ts tests/taller-ayudas-de-cliente.test.ts`
Expected: FAIL (módulos que no existen).

- [ ] **Step 3: Escribir las ayudas puras**

```ts
// lib/ficheros/subir-desde-navegador.ts
async function mensajeDelError(respuesta: Response, porDefecto: string): Promise<string> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (cuerpo && typeof cuerpo === "object" && "error" in cuerpo && typeof cuerpo.error === "string") {
      return cuerpo.error;
    }
  } catch {
    // el cuerpo no era JSON; se usa el mensaje por defecto
  }
  return porDefecto;
}

/**
 * Sube un fichero directamente al almacén de Vercel: pide permiso a nuestro
 * servidor, sube los bytes a la URL firmada (sin pasar por Vercel, que corta a
 * 4,5 MB) y confirma para que se cree la fila. Devuelve el id del Fichero.
 */
export async function subirAlAlmacen(fichero: File, llamar: typeof fetch = fetch): Promise<string> {
  const permiso = await llamar("/api/ficheros/permiso", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: fichero.name, tipoMime: fichero.type, bytes: fichero.size }),
  });
  if (!permiso.ok) throw new Error(await mensajeDelError(permiso, "No se pudo pedir permiso de subida."));
  const { url, ruta } = (await permiso.json()) as { url: string; ruta: string };

  const subida = await llamar(url, { method: "PUT", body: fichero });
  if (!subida.ok) throw new Error("El almacén rechazó la subida.");

  const confirmacion = await llamar("/api/ficheros/confirmar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ruta, nombreOriginal: fichero.name }),
  });
  if (!confirmacion.ok) throw new Error(await mensajeDelError(confirmacion, "No se pudo confirmar la subida."));
  const { id } = (await confirmacion.json()) as { id: string };
  return id;
}
```

```ts
// lib/taller/lista-de-subida.ts
export type EstadoDePagina = {
  nombre: string;
  estado: "PENDIENTE" | "SUBIENDO" | "SUBIDA" | "FALLIDA";
  ficheroId: string | null;
  error: string | null;
};

/** Los ids en el orden del PDF, o null si alguna página no ha llegado. El orden es la posición, nunca la llegada. */
export function idsEnOrden(paginas: readonly EstadoDePagina[]): string[] | null {
  if (paginas.length === 0) return null;
  const ids: string[] = [];
  for (const p of paginas) {
    if (p.estado !== "SUBIDA" || !p.ficheroId) return null;
    ids.push(p.ficheroId);
  }
  return ids;
}
```

```ts
// lib/taller/etiquetas.ts
/** Pone o quita una etiqueta y devuelve las marcadas en el orden del examen. */
export function alternarEtiqueta(todas: readonly string[], marcadas: readonly string[], etiqueta: string): string[] {
  const nuevas = marcadas.includes(etiqueta) ? marcadas.filter((e) => e !== etiqueta) : [...marcadas, etiqueta];
  return todas.filter((e) => nuevas.includes(e));
}
```

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run tests/subir-desde-navegador.test.ts tests/taller-ayudas-de-cliente.test.ts`
Expected: PASS.

- [ ] **Step 5: La pantalla de prueba usa la función sacada**

Sustituir `app/pruebas/subir/formulario.tsx` entero por:

```tsx
"use client";

import { useState } from "react";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";

type Estado =
  | { paso: "listo" }
  | { paso: "subiendo" }
  | { paso: "hecho"; id: string }
  | { paso: "error"; mensaje: string };

export function FormularioDeSubida() {
  const [estado, setEstado] = useState<Estado>({ paso: "listo" });

  async function subir(fichero: File) {
    setEstado({ paso: "subiendo" });
    try {
      setEstado({ paso: "hecho", id: await subirAlAlmacen(fichero) });
    } catch (error) {
      setEstado({ paso: "error", mensaje: error instanceof Error ? error.message : "Fallo desconocido." });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        accept="image/*,audio/*"
        disabled={estado.paso === "subiendo"}
        onChange={(evento) => {
          const fichero = evento.target.files?.[0];
          if (fichero) void subir(fichero);
        }}
        className="rounded-2xl border border-tinta-suave/30 p-4"
      />
      {estado.paso === "subiendo" && <p className="text-tinta-suave">Subiendo…</p>}
      {estado.paso === "hecho" && (
        <p className="rounded-2xl bg-hp-50 p-4 text-tinta">Fichero guardado con id: {estado.id}</p>
      )}
      {estado.paso === "error" && (
        <p className="rounded-2xl bg-hp-50 p-4 text-tinta">{estado.mensaje}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: El worker de pdf.js**

En `package.json`, cambiar el `postinstall` por:

```json
"postinstall": "prisma generate && mkdir -p public && cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs"
```

Añadir a `.gitignore`:

```
/public/pdf.worker.min.mjs
```

Run: `npm run postinstall && test -f public/pdf.worker.min.mjs && echo worker-listo`
Expected: `worker-listo`.

- [ ] **Step 7: `lib/taller/pdf-en-navegador.ts`**

```ts
// Solo navegador: usa document y canvas. Nunca se importa desde el servidor.
import { trozosDeDocumento, type Trozo } from "./trozos";

async function abrir(fichero: File) {
  const pdfjs = await import("pdfjs-dist");
  // No `new URL(..., import.meta.url)`: Turbopack no sabe externalizar el
  // paquete. El worker lo copia a public/ el postinstall.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ data: await fichero.arrayBuffer() }).promise;
}

/** Un PDF, a una imagen JPEG por hoja (escala 2, calidad 0,85). */
export async function paginasDePdf(fichero: File): Promise<File[]> {
  const doc = await abrir(fichero);
  const base = fichero.name.replace(/\.pdf$/i, "");
  const salida: File[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 2 });
    const lienzo = document.createElement("canvas");
    lienzo.width = vista.width;
    lienzo.height = vista.height;
    await pagina.render({ canvasContext: lienzo.getContext("2d")!, viewport: vista, canvas: lienzo }).promise;
    const blob = await new Promise<Blob>((listo, fallo) =>
      lienzo.toBlob((b) => (b ? listo(b) : fallo(new Error(`No se pudo convertir la hoja ${n}.`))), "image/jpeg", 0.85),
    );
    salida.push(new File([blob], `${base}-${String(n).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
  }
  return salida;
}

/** Los trozos de texto del PDF con su posición. El PDF no sale del navegador. */
export async function trozosDePdf(fichero: File): Promise<Trozo[]> {
  return trozosDeDocumento(await abrir(fichero));
}
```

- [ ] **Step 8: `components/taller/subir-paginas.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { borrarPaginasAccion, registrarPaginasAccion } from "@/app/examenes/acciones";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";
import { paginasDePdf } from "@/lib/taller/pdf-en-navegador";
import { idsEnOrden, type EstadoDePagina } from "@/lib/taller/lista-de-subida";

const NOMBRE_DEL_ESTADO: Record<EstadoDePagina["estado"], string> = {
  PENDIENTE: "En espera",
  SUBIENDO: "Subiendo…",
  SUBIDA: "Subida",
  FALLIDA: "Falló",
};

export function SubirPaginas({ examenId, hayPaginas }: { examenId: string; hayPaginas: boolean }) {
  const router = useRouter();
  const ficheros = useRef<File[]>([]);
  const lista = useRef<EstadoDePagina[]>([]);
  const [paginas, setPaginas] = useState<EstadoDePagina[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const pintar = () => setPaginas([...lista.current]);

  async function subirUna(i: number) {
    lista.current[i] = { ...lista.current[i], estado: "SUBIENDO", error: null };
    pintar();
    try {
      const id = await subirAlAlmacen(ficheros.current[i]);
      lista.current[i] = { ...lista.current[i], estado: "SUBIDA", ficheroId: id };
    } catch (e) {
      lista.current[i] = { ...lista.current[i], estado: "FALLIDA", error: e instanceof Error ? e.message : "Fallo desconocido." };
    }
    pintar();
  }

  async function registrarSiEstanTodas() {
    const ids = idsEnOrden(lista.current);
    if (!ids) {
      setAviso("Hay páginas sin subir: pulsa «Reintentar» en las marcadas.");
      return;
    }
    const r = await registrarPaginasAccion(examenId, ids);
    if (r.error) {
      setAviso(r.error);
      return;
    }
    lista.current = [];
    ficheros.current = [];
    pintar();
    setAviso(null);
    router.refresh();
  }

  async function alElegir(fichero: File | undefined) {
    if (!fichero) return;
    setOcupado(true);
    setAviso("Partiendo el PDF en páginas…");
    try {
      if (hayPaginas) await borrarPaginasAccion(examenId);
      ficheros.current = await paginasDePdf(fichero);
      lista.current = ficheros.current.map((f) => ({ nombre: f.name, estado: "PENDIENTE", ficheroId: null, error: null }));
      pintar();
      setAviso(null);
      for (let i = 0; i < ficheros.current.length; i++) await subirUna(i);
      await registrarSiEstanTodas();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido leer el PDF.");
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  async function reintentar(i: number) {
    setOcupado(true);
    await subirUna(i);
    await registrarSiEstanTodas();
    setOcupado(false);
  }

  const puedeElegir = !hayPaginas || confirmando;

  return (
    <div className="flex flex-col gap-3">
      {hayPaginas && !confirmando && (
        <button type="button" onClick={() => setConfirmando(true)} className="self-start rounded-2xl border border-tinta-suave/30 px-4 py-2">
          Sustituir las páginas
        </button>
      )}
      {hayPaginas && confirmando && (
        <p className="rounded-2xl bg-sol-100 p-4">
          Al subir otro PDF se borran las páginas de ahora <strong>y sus etiquetas</strong>. Las tareas guardadas no se tocan.
        </p>
      )}
      {puedeElegir && (
        <label className="flex flex-col gap-2">
          <span className="font-bold">PDF del examen</span>
          <input
            type="file"
            accept="application/pdf"
            disabled={ocupado}
            onChange={(e) => void alElegir(e.target.files?.[0])}
            className="rounded-2xl border border-tinta-suave/30 bg-white p-4"
          />
        </label>
      )}
      {aviso && <p role="status" className="rounded-2xl bg-hp-50 p-4">{aviso}</p>}
      {paginas.length > 0 && (
        <ol className="flex flex-col gap-1">
          {paginas.map((p, i) => (
            <li key={p.nombre} className="flex flex-wrap items-center gap-3">
              <span className="w-40 truncate">{p.nombre}</span>
              <span className={p.estado === "FALLIDA" ? "text-error-600" : "text-tinta-suave"}>
                {NOMBRE_DEL_ESTADO[p.estado]}{p.error ? `: ${p.error}` : ""}
              </span>
              {p.estado === "FALLIDA" && (
                <button type="button" disabled={ocupado} onClick={() => void reintentar(i)} className="rounded-xl border border-tinta-suave/30 px-3 py-1">
                  Reintentar
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

- [ ] **Step 9: `components/taller/etiquetas-de-pagina.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { etiquetarPaginaAccion } from "@/app/examenes/acciones";
import { nombreDeEtiqueta } from "@/lib/dele/estructura";
import { alternarEtiqueta } from "@/lib/taller/etiquetas";

type Pagina = { id: string; ficheroId: string; orden: number; etiquetas: string[] };

export function EtiquetasDePagina({ examenId, pagina, todas }: { examenId: string; pagina: Pagina; todas: string[] }) {
  const [marcadas, setMarcadas] = useState(pagina.etiquetas);
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();

  function pulsar(etiqueta: string) {
    const antes = marcadas;
    const nuevas = alternarEtiqueta(todas, marcadas, etiqueta);
    setMarcadas(nuevas);
    setError(null);
    empezar(async () => {
      const r = await etiquetarPaginaAccion(examenId, pagina.id, nuevas);
      if (r.error) {
        setMarcadas(antes);
        setError(r.error);
      }
    });
  }

  return (
    <figure className={`flex min-w-0 flex-col gap-2 rounded-2xl border bg-white p-3 ${marcadas.length === 0 ? "border-sol-400" : "border-tinta-suave/20"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos; next/image lo cachearía */}
      <img src={`/api/ficheros/${pagina.ficheroId}`} alt={`Hoja ${pagina.orden}`} loading="lazy" className="w-full rounded-xl border border-tinta-suave/10" />
      <figcaption className="flex flex-col gap-2">
        <span className="font-bold">Hoja {pagina.orden}{marcadas.length === 0 ? " · sin etiquetar" : ""}</span>
        <div className="flex flex-wrap gap-1">
          {todas.map((etiqueta) => {
            const puesta = marcadas.includes(etiqueta);
            return (
              <button
                key={etiqueta}
                type="button"
                aria-pressed={puesta}
                onClick={() => pulsar(etiqueta)}
                className={`rounded-full px-2 py-1 text-sm ${puesta ? "bg-hp-400 font-bold text-white" : "border border-tinta-suave/30"}`}
              >
                {nombreDeEtiqueta(etiqueta)}
              </button>
            );
          })}
        </div>
        {error && <span role="alert" className="text-error-600">{error}</span>}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 10: `components/taller/subir-cuadernillo.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarCuadernilloAccion } from "@/app/examenes/acciones";
import { trozosDePdf } from "@/lib/taller/pdf-en-navegador";

export function SubirCuadernillo({ examenId }: { examenId: string }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function alElegir(fichero: File | undefined) {
    if (!fichero) return;
    if (!titulo.trim()) {
      setAviso("Pon antes un título al cuadernillo.");
      return;
    }
    setOcupado(true);
    setAviso("Leyendo el PDF…");
    try {
      const r = await guardarCuadernilloAccion(examenId, titulo, await trozosDePdf(fichero));
      if (r.error) setAviso(r.error);
      else {
        setAviso(null);
        router.refresh();
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido leer el PDF.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-bold">Título del cuadernillo</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Libro de preparación, soluciones" className="rounded-2xl border border-tinta-suave/30 bg-white p-3" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-bold">PDF del cuadernillo (con texto, no escaneado)</span>
        <input type="file" accept="application/pdf" disabled={ocupado} onChange={(e) => void alElegir(e.target.files?.[0])} className="rounded-2xl border border-tinta-suave/30 bg-white p-3" />
      </label>
      {aviso && <p role="status" className="rounded-2xl bg-hp-50 p-4">{aviso}</p>}
    </div>
  );
}
```

- [ ] **Step 11: Tipos, pruebas y commit**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores de tipos; todas en verde (las 133 de antes siguen pasando: `/pruebas/subir` no cambia de comportamiento).

```bash
git add lib/ficheros/subir-desde-navegador.ts lib/taller/pdf-en-navegador.ts lib/taller/lista-de-subida.ts lib/taller/etiquetas.ts components/taller app/pruebas/subir/formulario.tsx package.json .gitignore tests/subir-desde-navegador.test.ts tests/taller-ayudas-de-cliente.test.ts
git commit -q -F - <<'EOF'
Subir páginas, etiquetarlas y subir el cuadernillo desde el navegador

El PDF no pasa nunca por el servidor: las hojas suben directas al
almacén y del cuadernillo solo viajan los trozos de texto.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 11: El formulario de una tarea

**Files:**
- Create: `lib/taller/editar.ts`
- Create: `components/taller/campo.tsx`, `components/taller/estado-de-la-tarea.tsx`, `components/taller/formas-cerradas.tsx`, `components/taller/formas-abiertas.tsx`, `components/taller/formulario-de-tarea.tsx`
- Test: `tests/taller-editar.test.ts`, `tests/taller-formulario.test.tsx`

**Interfaces:**
- Consumes: `Formulario`, `FormularioDe` (Tarea 3); `EstadoDeTarea` (Tarea 5); `ReglaTarea` (Tarea 2); `guardarTareaAccion` (Tarea 9).
- Produces:
  - `type Ruta = ReadonlyArray<string | number>`, `type Cambiar = (ruta: Ruta, valor: unknown) => void`, `cambiar<T>(objeto: T, ruta: Ruta, valor: unknown): T` (inmutable)
  - `<EstadoDeLaTarea estado={EstadoDeTarea} />`, `NOMBRE_DEL_ESTADO`
  - `<FormularioDeTarea examenId prueba numero regla inicial respuestas temasDeLaHermana estadoInicial />`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/taller-editar.test.ts
import { describe, it, expect } from "vitest";
import { cambiar } from "@/lib/taller/editar";

describe("cambiar un valor dentro del formulario", () => {
  const original = { consigna: "a", actividad: { preguntas: [{ enunciado: "uno" }, { enunciado: "dos" }] } };

  // Mutación que la mata: modificar el objeto en sitio (React no repintaría).
  it("devuelve una copia y deja el original como estaba", () => {
    const nuevo = cambiar(original, ["actividad", "preguntas", 1, "enunciado"], "DOS");
    expect(nuevo.actividad.preguntas[1].enunciado).toBe("DOS");
    expect(original.actividad.preguntas[1].enunciado).toBe("dos");
  });

  it("lo que no se toca sigue siendo el mismo objeto", () => {
    const nuevo = cambiar(original, ["actividad", "preguntas", 1, "enunciado"], "DOS");
    expect(nuevo.actividad.preguntas[0]).toBe(original.actividad.preguntas[0]);
    expect(nuevo.consigna).toBe("a");
  });

  it("una ruta que no casa con la forma avisa", () => {
    expect(() => cambiar(original, ["actividad", "preguntas", "primera"], "x")).toThrow("se esperaba un índice");
    expect(() => cambiar(original, ["consigna", "letra"], "x")).toThrow("no hay nada que cambiar");
  });
});
```

```ts
// tests/taller-formulario.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// El formulario importa la acción, y la acción la base: aquí no hay base.
vi.mock("@/app/examenes/acciones", () => ({ guardarTareaAccion: vi.fn() }));

import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { FormularioDeTarea } from "@/components/taller/formulario-de-tarea";

const VACIA = { estado: "VACIA" as const, motivos: ["Sin guardar todavía."], imagenesPendientes: 0 };

function pintar(prueba: "CE" | "CO" | "EO", numero: number, respuestas: Record<string, string> | null, temas: string[] | null = null) {
  const regla = reglaDe("A2_B1_ESCOLAR", prueba, numero)!;
  return renderToStaticMarkup(
    <FormularioDeTarea
      examenId="x1"
      prueba={prueba}
      numero={numero}
      regla={regla}
      inicial={formularioVacio(regla)}
      respuestas={respuestas}
      temasDeLaHermana={temas}
      estadoInicial={VACIA}
    />,
  );
}

describe("el formulario de una tarea", () => {
  // La respuesta del cuadernillo se enseña, pero no se edita: va en un <span>.
  // Mutación que la mata: pintar la respuesta en un <input>.
  it("Lectura 3 enseña la respuesta de cada pregunta, sin campo para editarla", () => {
    const html = pintar("CE", 3, { "13": "B", "14": "A", "15": "C", "16": "A", "17": "B", "18": "C" });
    for (const n of [13, 14, 15, 16, 17, 18]) expect(html).toContain(`<span data-respuesta="${n}"`);
    expect(html).toContain("Respuesta del cuadernillo: B");
    expect(html).not.toMatch(/<input[^>]*value="B"/);
  });

  it("sin cuadernillo lo dice en cada pregunta", () => {
    expect(pintar("CE", 3, null)).toContain("Sin respuesta en el cuadernillo");
  });

  // Mutación que la mata: pintar un campo de texto también para las opciones con imagen.
  it("en Auditiva 1 las opciones con imagen dicen que se suben después", () => {
    const html = pintar("CO", 1, null);
    expect(html.match(/imagen: se sube en la Entrega 3/g)).toHaveLength(15);
  });

  it("una oral en directo enseña el tema de su hermana al lado de cada opción", () => {
    const html = pintar("EO", 2, null, ["Las vacaciones", "El deporte"]);
    expect(html).toContain("Va con: Las vacaciones");
    expect(html).toContain("Va con: El deporte");
  });

  it("Lectura 1 tiene los diez textos de la A a la J", () => {
    const html = pintar("CE", 1, null);
    for (const letra of "ABCDEFGHIJ") expect(html).toContain(`Texto ${letra}`);
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run tests/taller-editar.test.ts tests/taller-formulario.test.tsx`
Expected: FAIL (módulos que no existen).

Antes de correrla: la prueba del formulario usa JSX y por eso es `.tsx`, que hoy Vitest no recoge. En `vitest.config.ts` cambiar el `include` a `["tests/**/*.test.ts", "tests/**/*.test.tsx"]`. Si al correrla no aparece en la lista de ficheros, es que falta este cambio (una prueba que no se corre pasa en verde sin comprobar nada).

- [ ] **Step 3: `lib/taller/editar.ts`**

```ts
export type Ruta = ReadonlyArray<string | number>;
export type Cambiar = (ruta: Ruta, valor: unknown) => void;

/** Una copia de `objeto` con `valor` puesto en `ruta`. Lo que no está en la ruta se comparte, no se copia. */
export function cambiar<T>(objeto: T, ruta: Ruta, valor: unknown): T {
  if (ruta.length === 0) return valor as T;
  const [paso, ...resto] = ruta;
  if (Array.isArray(objeto)) {
    if (typeof paso !== "number") throw new Error(`Ruta inválida: se esperaba un índice y ha llegado «${String(paso)}».`);
    return objeto.map((x, i) => (i === paso ? cambiar(x, resto, valor) : x)) as T;
  }
  if (objeto === null || typeof objeto !== "object") throw new Error("Ruta inválida: no hay nada que cambiar ahí.");
  const registro = objeto as Record<string, unknown>;
  return { ...registro, [String(paso)]: cambiar(registro[String(paso)], resto, valor) } as T;
}
```

- [ ] **Step 4: `components/taller/campo.tsx`**

```tsx
"use client";

const ENTRADA = "w-full rounded-xl border p-3";

/** Un campo del taller. Vacío y obligatorio se pinta en amarillo: se ve qué falta sin leer los motivos. */
export function Campo({
  etiqueta,
  valor,
  alCambiar,
  largo = false,
  opcional = false,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  largo?: boolean;
  opcional?: boolean;
}) {
  const falta = !opcional && valor.trim() === "";
  const clases = `${ENTRADA} ${falta ? "border-sol-400 bg-sol-100" : "border-tinta-suave/30 bg-white"}`;
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
    </label>
  );
}

/** Una letra sola: la del ejemplo. */
export function Letra({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return <Campo etiqueta={etiqueta} valor={valor} alCambiar={(v) => alCambiar(v.trim().toUpperCase().slice(-1))} />;
}

/** La respuesta del cuadernillo: se enseña y no se edita. */
export function Respuesta({ numero, respuestas }: { numero: number; respuestas: Record<string, string> | null }) {
  const letra = respuestas?.[String(numero)];
  return (
    <span
      data-respuesta={numero}
      className={`rounded-full px-3 py-1 text-sm font-bold ${letra ? "bg-verde-100 text-verde-600" : "bg-error-100 text-error-600"}`}
    >
      {letra ? `Respuesta del cuadernillo: ${letra}` : "Sin respuesta en el cuadernillo"}
    </span>
  );
}

export function Pautas({ etiqueta, pautas, alCambiar }: { etiqueta: string; pautas: string[]; alCambiar: (p: string[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-bold text-tinta-suave">{etiqueta}</legend>
      {pautas.map((pauta, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Campo etiqueta={`Pauta ${i + 1}`} valor={pauta} alCambiar={(v) => alCambiar(pautas.map((p, j) => (j === i ? v : p)))} />
          </div>
          <button type="button" onClick={() => alCambiar(pautas.filter((_, j) => j !== i))} className="rounded-xl border border-tinta-suave/30 px-3 py-2">
            Quitar
          </button>
        </div>
      ))}
      {pautas.length < 12 && (
        <button type="button" onClick={() => alCambiar([...pautas, ""])} className="self-start rounded-xl border border-tinta-suave/30 px-3 py-2">
          Añadir pauta
        </button>
      )}
    </fieldset>
  );
}

export function Numero({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: number | null; alCambiar: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-bold text-tinta-suave">{etiqueta} (opcional)</span>
      <input
        type="number"
        min={0}
        value={valor ?? ""}
        onChange={(e) => alCambiar(e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))))}
        className={`${ENTRADA} w-28 border-tinta-suave/30 bg-white`}
      />
    </label>
  );
}

export const CAJA = "flex min-w-0 flex-col gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-4";
```

- [ ] **Step 5: `components/taller/estado-de-la-tarea.tsx`**

```tsx
import type { EstadoDeTarea } from "@/lib/taller/estado";

export const NOMBRE_DEL_ESTADO: Record<EstadoDeTarea["estado"], string> = {
  VACIA: "Vacía",
  A_MEDIAS: "A medias",
  COMPLETA: "Completa",
};

const COLOR: Record<EstadoDeTarea["estado"], string> = {
  VACIA: "bg-tinta-suave/10 text-tinta-suave",
  A_MEDIAS: "bg-sol-100 text-tinta",
  COMPLETA: "bg-verde-100 text-verde-600",
};

export function InsigniaDeEstado({ estado }: { estado: EstadoDeTarea["estado"] }) {
  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${COLOR[estado]}`}>{NOMBRE_DEL_ESTADO[estado]}</span>;
}

export function EstadoDeLaTarea({ estado }: { estado: EstadoDeTarea }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-tinta-suave/20 bg-white p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <InsigniaDeEstado estado={estado.estado} />
        {estado.imagenesPendientes > 0 && (
          <span className="text-sm text-tinta-suave">Faltan {estado.imagenesPendientes} imágenes (se suben en la Entrega 3).</span>
        )}
      </div>
      {estado.estado !== "COMPLETA" && estado.motivos.length > 0 && (
        <ul className="list-disc pl-5 text-tinta">
          {estado.motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: `components/taller/formas-cerradas.tsx`**

```tsx
"use client";

import type { ReglaTarea } from "@/lib/dele/estructura";
import type { Cambiar } from "@/lib/taller/editar";
import type { FormularioDe } from "@/lib/taller/formas";
import { CAJA, Campo, Letra, Respuesta } from "./campo";

type Respuestas = Record<string, string> | null;
type Opcion = { letra: string; texto: string; conImagen?: boolean };

function Opciones({ opciones, ruta, cambiar }: { opciones: Opcion[]; ruta: (string | number)[]; cambiar: Cambiar }) {
  return (
    <div className="flex flex-col gap-2">
      {opciones.map((o, i) =>
        o.conImagen ? (
          <p key={o.letra} className="rounded-xl bg-hp-50 p-3 text-tinta-suave">
            Opción {o.letra}: imagen: se sube en la Entrega 3
          </p>
        ) : (
          <Campo key={o.letra} etiqueta={`Opción ${o.letra}`} valor={o.texto} alCambiar={(v) => cambiar([...ruta, i, "texto"], v)} />
        ),
      )}
    </div>
  );
}

function Cabecera({ titulo, numero, respuestas }: { titulo: string; numero: number; respuestas: Respuestas }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">{titulo}</h3>
      <Respuesta numero={numero} respuestas={respuestas} />
    </div>
  );
}

export function FormaRelacionar({ f, regla, cambiar, respuestas }: { f: FormularioDe<"RELACIONAR">; regla: ReglaTarea; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  const conTexto = Boolean(regla.elementosConTexto);
  return (
    <>
      <section className={CAJA}>
        <h3 className="font-bold">Ejemplo (0)</h3>
        {conTexto && <Campo etiqueta="Texto del ejemplo" valor={a.ejemplo.texto} alCambiar={(v) => cambiar(["actividad", "ejemplo", "texto"], v)} largo />}
        <Letra etiqueta="Letra del ejemplo" valor={a.ejemplo.letra} alCambiar={(v) => cambiar(["actividad", "ejemplo", "letra"], v)} />
      </section>
      {a.elementos.map((e, i) => (
        <section key={e.numero} className={CAJA}>
          <Cabecera titulo={conTexto ? `${e.numero}` : `Mensaje ${i + 1} (${e.numero})`} numero={e.numero} respuestas={respuestas} />
          {conTexto && <Campo etiqueta={`Texto de la ${e.numero}`} valor={e.texto} alCambiar={(v) => cambiar(["actividad", "elementos", i, "texto"], v)} largo />}
        </section>
      ))}
      {a.destinos.map((d, i) => (
        <section key={d.letra} className={CAJA}>
          <h3 className="font-bold">Texto {d.letra}</h3>
          <Campo etiqueta="Título" valor={d.titulo} alCambiar={(v) => cambiar(["actividad", "destinos", i, "titulo"], v)} opcional />
          <Campo etiqueta="Texto" valor={d.texto} alCambiar={(v) => cambiar(["actividad", "destinos", i, "texto"], v)} largo />
        </section>
      ))}
    </>
  );
}

export function FormaListaComun({ f, cambiar, respuestas }: { f: FormularioDe<"LISTA_COMUN">; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  return (
    <>
      <section className={CAJA}>
        <h3 className="font-bold">Lista común</h3>
        {a.comunes.map((c, i) => (
          <Campo key={c.letra} etiqueta={`Opción ${c.letra}`} valor={c.texto} alCambiar={(v) => cambiar(["actividad", "comunes", i, "texto"], v)} />
        ))}
      </section>
      {a.ejemplo && (
        <section className={CAJA}>
          <h3 className="font-bold">Ejemplo (0)</h3>
          <Campo etiqueta="Enunciado del ejemplo" valor={a.ejemplo.enunciado} alCambiar={(v) => cambiar(["actividad", "ejemplo", "enunciado"], v)} />
          <Letra etiqueta="Letra del ejemplo" valor={a.ejemplo.letra} alCambiar={(v) => cambiar(["actividad", "ejemplo", "letra"], v)} />
        </section>
      )}
      {a.preguntas.map((p, i) => (
        <section key={p.numero} className={CAJA}>
          <Cabecera titulo={`${p.numero}`} numero={p.numero} respuestas={respuestas} />
          <Campo etiqueta="Enunciado" valor={p.enunciado} alCambiar={(v) => cambiar(["actividad", "preguntas", i, "enunciado"], v)} />
        </section>
      ))}
    </>
  );
}

export function FormaOpciones({ f, cambiar, respuestas }: { f: FormularioDe<"OPCIONES">; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  return (
    <>
      {a.ejemplo && (
        <section className={CAJA}>
          <h3 className="font-bold">Ejemplo (0)</h3>
          <Campo etiqueta="Enunciado del ejemplo" valor={a.ejemplo.enunciado} alCambiar={(v) => cambiar(["actividad", "ejemplo", "enunciado"], v)} />
          <Opciones opciones={a.ejemplo.opciones} ruta={["actividad", "ejemplo", "opciones"]} cambiar={cambiar} />
          <Letra etiqueta="Letra del ejemplo" valor={a.ejemplo.letra} alCambiar={(v) => cambiar(["actividad", "ejemplo", "letra"], v)} />
        </section>
      )}
      {a.preguntas.map((p, i) => (
        <section key={p.numero} className={CAJA}>
          {p.grupo !== null && (i === 0 || a.preguntas[i - 1].grupo !== p.grupo) && (
            <p className="text-sm font-bold uppercase text-hp-600">Noticia {p.grupo}</p>
          )}
          <Cabecera titulo={`${p.numero}`} numero={p.numero} respuestas={respuestas} />
          <Campo etiqueta="Enunciado" valor={p.enunciado} alCambiar={(v) => cambiar(["actividad", "preguntas", i, "enunciado"], v)} />
          <Opciones opciones={p.opciones} ruta={["actividad", "preguntas", i, "opciones"]} cambiar={cambiar} />
        </section>
      ))}
    </>
  );
}

export function FormaHuecos({ f, cambiar, respuestas }: { f: FormularioDe<"HUECOS">; cambiar: Cambiar; respuestas: Respuestas }) {
  const a = f.actividad;
  return (
    <>
      <section className={CAJA}>
        <Campo etiqueta="Título" valor={a.titulo} alCambiar={(v) => cambiar(["actividad", "titulo"], v)} opcional />
        <Campo etiqueta="Texto, con cada hueco marcado así: [19]" valor={a.texto} alCambiar={(v) => cambiar(["actividad", "texto"], v)} largo />
        <Campo etiqueta="Autor o fuente" valor={a.fuente} alCambiar={(v) => cambiar(["actividad", "fuente"], v)} opcional />
      </section>
      {a.huecos.map((h, i) => (
        <section key={h.numero} className={CAJA}>
          <Cabecera titulo={`Hueco ${h.numero}`} numero={h.numero} respuestas={respuestas} />
          <Opciones opciones={h.opciones} ruta={["actividad", "huecos", i, "opciones"]} cambiar={cambiar} />
        </section>
      ))}
    </>
  );
}
```

- [ ] **Step 7: `components/taller/formas-abiertas.tsx`**

```tsx
"use client";

import type { Cambiar } from "@/lib/taller/editar";
import type { FormularioDe } from "@/lib/taller/formas";
import { CAJA, Campo, Numero, Pautas } from "./campo";

type Rango = { min: number | null; max: number | null };

function RangoDe({ etiqueta, valor, ruta, cambiar }: { etiqueta: string; valor: Rango; ruta: string[]; cambiar: Cambiar }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Numero etiqueta={`${etiqueta}: mínimo`} valor={valor.min} alCambiar={(v) => cambiar([...ruta, "min"], v)} />
      <Numero etiqueta={`${etiqueta}: máximo`} valor={valor.max} alCambiar={(v) => cambiar([...ruta, "max"], v)} />
    </div>
  );
}

export function FormaRedaccionUna({ f, cambiar }: { f: FormularioDe<"REDACCION_UNA">; cambiar: Cambiar }) {
  const a = f.actividad;
  return (
    <section className={CAJA}>
      <Campo etiqueta="Situación" valor={a.situacion} alCambiar={(v) => cambiar(["actividad", "situacion"], v)} largo />
      <Campo etiqueta="Texto recibido (el correo, la nota…)" valor={a.textoRecibido} alCambiar={(v) => cambiar(["actividad", "textoRecibido"], v)} largo opcional />
      <Pautas etiqueta="En tu respuesta, no olvides:" pautas={a.pautas} alCambiar={(v) => cambiar(["actividad", "pautas"], v)} />
      <RangoDe etiqueta="Palabras" valor={a.palabras} ruta={["actividad", "palabras"]} cambiar={cambiar} />
    </section>
  );
}

export function FormaRedaccionDos({ f, cambiar }: { f: FormularioDe<"REDACCION_DOS">; cambiar: Cambiar }) {
  const a = f.actividad;
  return (
    <>
      {a.opciones.map((o, i) => (
        <section key={i} className={CAJA}>
          <h3 className="font-bold">Opción {i + 1}</h3>
          <Campo etiqueta="Título" valor={o.titulo} alCambiar={(v) => cambiar(["actividad", "opciones", i, "titulo"], v)} opcional />
          <Campo etiqueta="Contexto" valor={o.contexto} alCambiar={(v) => cambiar(["actividad", "opciones", i, "contexto"], v)} largo />
          <Pautas etiqueta="Pautas" pautas={o.pautas} alCambiar={(v) => cambiar(["actividad", "opciones", i, "pautas"], v)} />
        </section>
      ))}
      <section className={CAJA}>
        <RangoDe etiqueta="Palabras" valor={a.palabras} ruta={["actividad", "palabras"]} cambiar={cambiar} />
      </section>
    </>
  );
}

export function FormaOralSolo({ f, cambiar }: { f: FormularioDe<"ORAL_SOLO">; cambiar: Cambiar }) {
  const a = f.actividad;
  return (
    <>
      {a.opciones.map((o, i) => (
        <section key={i} className={CAJA}>
          <h3 className="font-bold">Opción {i + 1}</h3>
          <Campo etiqueta="Tema" valor={o.tema} alCambiar={(v) => cambiar(["actividad", "opciones", i, "tema"], v)} />
          {o.conImagen && <p className="rounded-xl bg-hp-50 p-3 text-tinta-suave">Foto: se sube en la Entrega 3</p>}
          <Pautas etiqueta="Pautas" pautas={o.pautas} alCambiar={(v) => cambiar(["actividad", "opciones", i, "pautas"], v)} />
        </section>
      ))}
      <section className={CAJA}>
        <RangoDe etiqueta="Minutos" valor={a.minutos} ruta={["actividad", "minutos"]} cambiar={cambiar} />
        <Numero etiqueta="Minutos de preparación" valor={a.preparacion} alCambiar={(v) => cambiar(["actividad", "preparacion"], v)} />
      </section>
    </>
  );
}

export function FormaOralDirecto({ f, cambiar, temasDeLaHermana }: { f: FormularioDe<"ORAL_DIRECTO">; cambiar: Cambiar; temasDeLaHermana: string[] | null }) {
  const a = f.actividad;
  return (
    <>
      {a.opciones.map((o, i) => (
        <section key={i} className={CAJA}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Opción {i + 1}</h3>
            <span className="rounded-full bg-hp-50 px-3 py-1 text-sm">Va con: {temasDeLaHermana?.[i] || "(la otra tarea aún no tiene tema)"}</span>
          </div>
          <Campo etiqueta="Tema" valor={o.tema} alCambiar={(v) => cambiar(["actividad", "opciones", i, "tema"], v)} />
          <Campo etiqueta="Situación" valor={o.situacion} alCambiar={(v) => cambiar(["actividad", "opciones", i, "situacion"], v)} largo />
          <Campo etiqueta="Papel del examinador" valor={o.papelExaminador} alCambiar={(v) => cambiar(["actividad", "opciones", i, "papelExaminador"], v)} largo opcional />
          <Pautas etiqueta="Pautas" pautas={o.pautas} alCambiar={(v) => cambiar(["actividad", "opciones", i, "pautas"], v)} />
        </section>
      ))}
      <section className={CAJA}>
        <RangoDe etiqueta="Minutos" valor={a.minutos} ruta={["actividad", "minutos"]} cambiar={cambiar} />
      </section>
    </>
  );
}
```

- [ ] **Step 8: `components/taller/formulario-de-tarea.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { guardarTareaAccion } from "@/app/examenes/acciones";
import type { ReglaTarea } from "@/lib/dele/estructura";
import { cambiar as cambiarEn, type Ruta } from "@/lib/taller/editar";
import type { EstadoDeTarea } from "@/lib/taller/estado";
import type { Formulario } from "@/lib/taller/formas";
import { CAJA, Campo } from "./campo";
import { EstadoDeLaTarea } from "./estado-de-la-tarea";
import { FormaHuecos, FormaListaComun, FormaOpciones, FormaRelacionar } from "./formas-cerradas";
import { FormaOralDirecto, FormaOralSolo, FormaRedaccionDos, FormaRedaccionUna } from "./formas-abiertas";

type Props = {
  examenId: string;
  prueba: string;
  numero: number;
  regla: ReglaTarea;
  inicial: Formulario;
  respuestas: Record<string, string> | null;
  temasDeLaHermana: string[] | null;
  estadoInicial: EstadoDeTarea;
};

export function FormularioDeTarea({ examenId, prueba, numero, regla, inicial, respuestas, temasDeLaHermana, estadoInicial }: Props) {
  const [f, setF] = useState<Formulario>(inicial);
  const [estado, setEstado] = useState(estadoInicial);
  const [error, setError] = useState<string | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [guardando, empezar] = useTransition();

  const cambiar = (ruta: Ruta, valor: unknown) => {
    setF((actual) => cambiarEn(actual, ruta, valor));
    setSinGuardar(true);
  };

  function guardar() {
    setError(null);
    empezar(async () => {
      const r = await guardarTareaAccion(examenId, prueba, numero, f);
      if ("error" in r) setError(r.error);
      else {
        setEstado(r.estado);
        setSinGuardar(false);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <EstadoDeLaTarea estado={estado} />
      <section className={CAJA}>
        <Campo etiqueta="Consigna, ya corregida (sin «Hoja de respuestas»)" valor={f.consigna} alCambiar={(v) => cambiar(["consigna"], v)} largo />
      </section>
      {f.textos.map((t, i) => (
        <section key={i} className={CAJA}>
          <h3 className="font-bold">Texto {i + 1}</h3>
          <Campo etiqueta="Nombre o título" valor={t.etiqueta} alCambiar={(v) => cambiar(["textos", i, "etiqueta"], v)} opcional />
          <Campo etiqueta="Texto" valor={t.texto} alCambiar={(v) => cambiar(["textos", i, "texto"], v)} largo />
        </section>
      ))}

      {f.forma === "RELACIONAR" && <FormaRelacionar f={f} regla={regla} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "LISTA_COMUN" && <FormaListaComun f={f} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "OPCIONES" && <FormaOpciones f={f} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "HUECOS" && <FormaHuecos f={f} cambiar={cambiar} respuestas={respuestas} />}
      {f.forma === "REDACCION_UNA" && <FormaRedaccionUna f={f} cambiar={cambiar} />}
      {f.forma === "REDACCION_DOS" && <FormaRedaccionDos f={f} cambiar={cambiar} />}
      {f.forma === "ORAL_SOLO" && <FormaOralSolo f={f} cambiar={cambiar} />}
      {f.forma === "ORAL_DIRECTO" && <FormaOralDirecto f={f} cambiar={cambiar} temasDeLaHermana={temasDeLaHermana} />}

      {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-tinta-suave/20 bg-fondo py-3">
        <button type="button" onClick={guardar} disabled={guardando} className="rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {sinGuardar && <span className="text-tinta-suave">Hay cambios sin guardar.</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Correr y ver que pasan**

Run: `npx vitest run tests/taller-editar.test.ts tests/taller-formulario.test.tsx && npx tsc --noEmit`
Expected: PASS y sin errores de tipos. Cuenta de imágenes de Auditiva 1: 3 opciones × 4 preguntas + 3 del ejemplo = 15.

- [ ] **Step 10: Commit**

```bash
git add lib/taller/editar.ts components/taller tests/taller-editar.test.ts tests/taller-formulario.test.tsx* vitest.config.ts
git commit -q -F - <<'EOF'
Formulario de cada tarea del taller, con la respuesta del cuadernillo al lado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 12: Las pantallas del taller

**Files:**
- Create: `app/examenes/page.tsx`, `app/examenes/[id]/page.tsx`, `app/examenes/[id]/[prueba]/[numero]/page.tsx`
- Modify: `app/page.tsx` (enlace «Exámenes» para el profesor)
- Test: `tests/taller-pantallas.test.ts`, `tests/portada.test.ts`

**Interfaces:**
- Consumes: `exigirProfesor`; `listarExamenes`, `examenParaElTaller`, `tareaParaElTaller` (Tarea 7); `listarCuadernillos` (Tarea 8); `crearExamenAccion`, `elegirCuadernilloAccion` (Tarea 9); componentes de las Tareas 10 y 11; `esPrueba`, `etiquetasDeNivel`, `etiquetaDeTarea`, `nivelesConReglas`, `nombreCortoDeTarea`, `NOMBRE_DE_NIVEL`, `NOMBRE_DE_PRUEBA`, `PRUEBAS` (Tarea 2).
- Produces: las rutas `/examenes`, `/examenes/<id>`, `/examenes/<id>/<prueba>/<numero>`.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
// tests/taller-pantallas.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Persona } from "@/lib/generated/prisma";

// Cada pantalla se importa tal cual (no un resumen de su lógica), para que
// borrar su `await exigirProfesor()` ponga esto en rojo.
const dobles = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  listarExamenes: vi.fn(),
  examenParaElTaller: vi.fn(),
  tareaParaElTaller: vi.fn(),
  listarCuadernillos: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: dobles.cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie: dobles.personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect: dobles.redirect, notFound: dobles.notFound, useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/taller/examenes", () => ({
  listarExamenes: dobles.listarExamenes,
  examenParaElTaller: dobles.examenParaElTaller,
  tareaParaElTaller: dobles.tareaParaElTaller,
}));
vi.mock("@/lib/taller/cuadernillos", () => ({ listarCuadernillos: dobles.listarCuadernillos }));
// Cada acción que importan las pantallas o sus componentes tiene que existir en
// el doble: Vitest revienta al leer una exportación que el doble no define.
vi.mock("@/app/examenes/acciones", () => ({
  crearExamenAccion: vi.fn(),
  elegirCuadernilloAccion: vi.fn(),
  registrarPaginasAccion: vi.fn(),
  borrarPaginasAccion: vi.fn(),
  etiquetarPaginaAccion: vi.fn(),
  guardarCuadernilloAccion: vi.fn(),
  guardarTareaAccion: vi.fn(),
}));

import Examenes from "@/app/examenes/page";
import PantallaDelExamen from "@/app/examenes/[id]/page";
import PantallaDeTarea from "@/app/examenes/[id]/[prueba]/[numero]/page";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

function como(persona: Persona) {
  dobles.cookiesGet.mockReturnValue({ value: `cookie-de-${persona.id}` });
  dobles.personaDeLaCookie.mockResolvedValue(persona);
}

const sinError = () => Promise.resolve({});

beforeEach(() => {
  vi.resetAllMocks();
  dobles.redirect.mockImplementation((ruta: string) => { throw new Error(`REDIRECT:${ruta}`); });
  dobles.notFound.mockImplementation(() => { throw new Error("NOT_FOUND"); });
});

const PANTALLAS = [
  { nombre: "la lista de exámenes", pintar: () => Examenes({ searchParams: sinError() }), lee: dobles.listarExamenes },
  { nombre: "la pantalla del examen", pintar: () => PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }), lee: dobles.examenParaElTaller },
  { nombre: "la pantalla de una tarea", pintar: () => PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "3" }) }), lee: dobles.tareaParaElTaller },
];

describe("las pantallas del taller exigen al profesor", () => {
  // Mutación que la mata: quitar `await exigirProfesor()` de cualquiera de las tres.
  it.each(PANTALLAS)("$nombre: un estudiante topa con el no encontrado y no se lee nada", async ({ pintar, lee }) => {
    como(ESTUDIANTE);
    await expect(pintar()).rejects.toThrow("NOT_FOUND");
    expect(lee).not.toHaveBeenCalled();
  });
});

describe("lo que no existe da el no encontrado", () => {
  beforeEach(() => como(PROFESOR));

  it("un examen que no existe", async () => {
    dobles.examenParaElTaller.mockResolvedValue(null);
    await expect(PantallaDelExamen({ params: Promise.resolve({ id: "nada" }), searchParams: sinError() })).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: no comprobar esPrueba antes de ir a la base.
  it("una prueba inventada o un número que no es número no llegan a la base", async () => {
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "XX", numero: "3" }) })).rejects.toThrow("NOT_FOUND");
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "tres" }) })).rejects.toThrow("NOT_FOUND");
    expect(dobles.tareaParaElTaller).not.toHaveBeenCalled();
  });

  it("una tarea que no existe", async () => {
    dobles.tareaParaElTaller.mockResolvedValue(null);
    await expect(PantallaDeTarea({ params: Promise.resolve({ id: "x1", prueba: "CE", numero: "9" }) })).rejects.toThrow("NOT_FOUND");
  });

  it("el profesor ve la lista", async () => {
    dobles.listarExamenes.mockResolvedValue([]);
    await expect(Examenes({ searchParams: sinError() })).resolves.toBeDefined();
  });
});
```

En `tests/portada.test.ts`, añadir al final del `describe`:

```ts
  // Mutación que la mata: enseñar «Exámenes» sin mirar el papel.
  it("solo el profesor ve el enlace al taller", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    expect(await html()).not.toContain('href="/examenes"');

    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    expect(await html()).toContain('href="/examenes"');
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run tests/taller-pantallas.test.ts tests/portada.test.ts`
Expected: FAIL (pantallas que no existen; la portada sin enlace).

- [ ] **Step 3: `app/examenes/page.tsx`**

```tsx
import Link from "next/link";
import type { EstadoExamen } from "@/lib/generated/prisma";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { NOMBRE_DE_NIVEL, nivelesConReglas } from "@/lib/dele/estructura";
import { listarExamenes } from "@/lib/taller/examenes";
import { crearExamenAccion } from "./acciones";

const NOMBRE_DEL_ESTADO: Record<EstadoExamen, string> = {
  EN_CONSTRUCCION: "En construcción",
  PUBLICADO: "Publicado",
  ARCHIVADO: "Archivado",
};

export default async function Examenes({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await exigirProfesor();
  const [examenes, { error }] = await Promise.all([listarExamenes(), searchParams]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-bold">Exámenes</h1>

      {examenes.length === 0 ? (
        <p className="text-tinta-suave">Todavía no hay ningún examen.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {examenes.map((e) => (
            <li key={e.id}>
              <Link href={`/examenes/${e.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-tinta-suave/20 bg-white p-4">
                <span className="font-bold">{e.titulo}</span>
                <span className="text-tinta-suave">{NOMBRE_DE_NIVEL[e.nivel]} · {NOMBRE_DEL_ESTADO[e.estado]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Nuevo examen</h2>
        {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}
        <form action={crearExamenAccion} className="flex flex-col gap-4">
          <input name="titulo" required placeholder="Libro de preparación, examen 1" className="rounded-2xl border border-tinta-suave/30 bg-white p-4" />
          <select name="nivel" className="rounded-2xl border border-tinta-suave/30 bg-white p-4">
            {nivelesConReglas().map((n) => (
              <option key={n} value={n}>{NOMBRE_DE_NIVEL[n]}</option>
            ))}
          </select>
          <button type="submit" className="rounded-2xl bg-hp-400 p-4 font-bold text-white">Crear el examen</button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: `app/examenes/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { NOMBRE_DE_NIVEL, NOMBRE_DE_PRUEBA, PRUEBAS, etiquetasDeNivel, nombreCortoDeTarea } from "@/lib/dele/estructura";
import { examenParaElTaller } from "@/lib/taller/examenes";
import { listarCuadernillos } from "@/lib/taller/cuadernillos";
import { EtiquetasDePagina } from "@/components/taller/etiquetas-de-pagina";
import { InsigniaDeEstado } from "@/components/taller/estado-de-la-tarea";
import { SubirCuadernillo } from "@/components/taller/subir-cuadernillo";
import { SubirPaginas } from "@/components/taller/subir-paginas";
import { elegirCuadernilloAccion } from "../acciones";

const CAJA = "flex min-w-0 flex-col gap-4 rounded-2xl border border-tinta-suave/20 bg-white p-5";

export default async function PantallaDelExamen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await exigirProfesor();
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const examen = await examenParaElTaller(id);
  if (!examen) notFound();
  const cuadernillos = await listarCuadernillos();
  const todas = etiquetasDeNivel(examen.nivel);
  const sinEtiqueta = examen.paginas.filter((p) => p.etiquetas.length === 0).length;
  const elegido = examen.cuadernillo;
  const resumenDelNumero = elegido?.resumen.find((r) => r.examen === String(examen.numeroEnCuadernillo));

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-6">
      <nav><Link href="/examenes" className="text-hp-600 underline">← Exámenes</Link></nav>
      <header>
        <h1 className="text-2xl font-bold">{examen.titulo}</h1>
        <p className="text-tinta-suave">{NOMBRE_DE_NIVEL[examen.nivel]}</p>
      </header>
      {error && <p role="alert" className="rounded-2xl bg-error-100 p-4 text-error-600">{error}</p>}

      <section className={CAJA}>
        <h2 className="text-xl font-bold">Tareas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {PRUEBAS.map((prueba) => (
            <div key={prueba} className="flex min-w-0 flex-col gap-2">
              <h3 className="font-bold capitalize">{NOMBRE_DE_PRUEBA[prueba]}</h3>
              {examen.tareas.filter((t) => t.prueba === prueba).map((t) => (
                <Link
                  key={t.numero}
                  href={`/examenes/${examen.id}/${t.prueba}/${t.numero}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tinta-suave/20 p-3"
                >
                  <span className="font-bold">{nombreCortoDeTarea(t.prueba, t.numero)}</span>
                  <span className="flex items-center gap-2">
                    {t.estado.estado === "A_MEDIAS" && <span className="text-sm text-tinta-suave">{t.estado.motivos.length} por resolver</span>}
                    <InsigniaDeEstado estado={t.estado.estado} />
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className={CAJA}>
        <h2 className="text-xl font-bold">Cuadernillo de soluciones</h2>
        <form action={elegirCuadernilloAccion.bind(null, examen.id)} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold text-tinta-suave">Cuadernillo</span>
            <select name="cuadernilloId" defaultValue={elegido?.id ?? ""} className="rounded-xl border border-tinta-suave/30 bg-white p-3">
              <option value="">Ninguno</option>
              {cuadernillos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold text-tinta-suave">Qué examen del libro es</span>
            <select name="numero" defaultValue={examen.numeroEnCuadernillo ?? ""} className="rounded-xl border border-tinta-suave/30 bg-white p-3">
              <option value="">Sin elegir</option>
              {(elegido?.resumen ?? []).map((r) => <option key={r.examen} value={r.examen}>Examen {r.examen}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-xl bg-hp-400 px-4 py-3 font-bold text-white">Guardar</button>
        </form>

        {elegido && (
          <div className="overflow-x-auto">
            <table className="text-sm">
              <caption className="pb-2 text-left font-bold">Lo que el taller ha entendido de «{elegido.titulo}»</caption>
              <thead>
                <tr className="text-left">
                  <th className="pr-4">Examen</th>
                  <th className="pr-4">Lectura (6, 6, 6, 7)</th>
                  <th className="pr-4">Auditiva (7, 6, 6, 6)</th>
                  <th>¿Cuadra?</th>
                </tr>
              </thead>
              <tbody>
                {elegido.resumen.map((r) => (
                  <tr key={r.examen} className={r === resumenDelNumero ? "bg-hp-50 font-bold" : ""}>
                    <td className="pr-4">{r.examen}</td>
                    {r.pruebas.map((p) => (
                      <td key={p.prueba} className="pr-4">
                        {p.filas.map((f) => f.encontradas).join(", ")}
                        {p.fuera.length > 0 ? ` · sobran ${p.fuera.join(", ")}` : ""}
                      </td>
                    ))}
                    <td className={r.bien ? "text-verde-600" : "text-error-600"}>{r.bien ? "Sí" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details>
          <summary className="cursor-pointer font-bold">Subir un cuadernillo nuevo</summary>
          <div className="pt-3"><SubirCuadernillo examenId={examen.id} /></div>
        </details>
      </section>

      <section className={CAJA}>
        <h2 className="text-xl font-bold">Páginas</h2>
        {examen.paginas.length > 0 && sinEtiqueta > 0 && (
          <p className="rounded-2xl bg-sol-100 p-4">{sinEtiqueta === 1 ? "Hay 1 hoja sin etiquetar." : `Hay ${sinEtiqueta} hojas sin etiquetar.`}</p>
        )}
        {examen.paginas.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {examen.paginas.map((p) => <EtiquetasDePagina key={p.id} examenId={examen.id} pagina={p} todas={todas} />)}
          </div>
        )}
        <SubirPaginas examenId={examen.id} hayPaginas={examen.paginas.length > 0} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: `app/examenes/[id]/[prueba]/[numero]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { esPrueba, nombreCortoDeTarea } from "@/lib/dele/estructura";
import { tareaParaElTaller } from "@/lib/taller/examenes";
import { FormularioDeTarea } from "@/components/taller/formulario-de-tarea";

export default async function PantallaDeTarea({ params }: { params: Promise<{ id: string; prueba: string; numero: string }> }) {
  await exigirProfesor();
  const { id, prueba, numero } = await params;
  const n = Number(numero);
  if (!esPrueba(prueba) || !Number.isInteger(n)) notFound();
  const tarea = await tareaParaElTaller(id, prueba, n);
  if (!tarea) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6">
      <nav><Link href={`/examenes/${id}`} className="text-hp-600 underline">← {tarea.examen.titulo}</Link></nav>
      <h1 className="text-2xl font-bold">{nombreCortoDeTarea(prueba, n)}</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Columna con scroll propio y alto de ventana: una columna sticky más alta que la ventana no deja ver su final. */}
        <section className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          {tarea.paginas.length === 0 ? (
            <p className="rounded-2xl bg-sol-100 p-4">Ninguna hoja lleva esta tarea. Etiquétala en la pantalla del examen.</p>
          ) : (
            tarea.paginas.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos
              <img key={p.ficheroId} src={`/api/ficheros/${p.ficheroId}`} alt={`Hoja ${p.orden}`} className="w-full rounded-2xl border border-tinta-suave/20" />
            ))
          )}
        </section>
        <FormularioDeTarea
          examenId={id}
          prueba={prueba}
          numero={n}
          regla={tarea.regla}
          inicial={tarea.formulario}
          respuestas={tarea.respuestas}
          temasDeLaHermana={tarea.temasDeLaHermana}
          estadoInicial={tarea.estado}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 6: El enlace en la portada**

En `app/page.tsx`, debajo de la línea del enlace a personas:

```tsx
            {persona.papel === "PROFESOR" && <Link href="/examenes">Exámenes</Link>}
```

- [ ] **Step 7: Correr y ver que pasa**

Run: `npx vitest run tests/taller-pantallas.test.ts tests/portada.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, sin errores de tipos ni de lint.

- [ ] **Step 8: Commit**

```bash
git add app/examenes app/page.tsx tests/taller-pantallas.test.ts tests/portada.test.ts
git commit -q -F - <<'EOF'
Pantallas del taller: lista de exámenes, examen y tarea

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01QAxKoMyGubTW95FBVCHikF
EOF
```

---

### Task 13: Cierre y prueba de verdad

**Files:** ninguno nuevo, salvo lo que haga falta arreglar.

- [ ] **Step 1: Todo en verde de una vez**

```bash
npm test
npm run test:base
CUADERNILLO_REAL="$HOME/Downloads/A2B1 examenes/claves_dele_escolar_sol_trans (2).pdf" npx vitest run tests/taller-soluciones-real.test.ts
npx tsc --noEmit
npm run lint
```

Expected: todo pasa. Anotar las cuentas de pruebas en el informe.

- [ ] **Step 2: Tres mutaciones a mano, una a una, deshaciendo cada una**

1. Quitar `await exigirProfesor();` de `guardarTareaAccion` → tiene que caer `tests/taller-acciones.test.ts`.
2. En `leerSoluciones`, cambiar `t.x >= t.anchoPagina / 2 === derecha` por `derecha === false` → tiene que caer «las dos columnas de una página no se mezclan».
3. En `motivosDeTarea`, borrar el bloque de `letrasPosibles` → tiene que caer «una letra que la pregunta no tiene».

Si alguna no pone nada en rojo, la prueba es ciega: arreglarla antes de seguir.

- [ ] **Step 3: Revisar que nada del libro entró en el repo**

Run: `git diff --stat main...HEAD && git diff main...HEAD | grep -n -i -E 'claves_dele|A2B1 examenes|\.pdf"' | head`
Expected: la única mención es la ruta de `CUADERNILLO_REAL` en el plan y en el comentario de la prueba real; ningún PDF, imagen ni texto del libro.

- [ ] **Step 4: Fusionar y desplegar, solo con el «sí» del profesor**

Skill `superpowers:finishing-a-development-branch`. El despliegue de Vercel corre `prisma migrate deploy`, que aplica `taller_entrega_1` contra Neon. Si el despliegue da P1001, es Neon dormida: volver a desplegar.

Tras el despliegue, por curl contra `https://hispaprofe-dele.vercel.app`:
- `/examenes` sin sesión → 307 a `/entrar`.
- `/pdf.worker.min.mjs` → 200 (si no, el `postinstall` no corrió en Vercel).

- [ ] **Step 5: Aceptación en Chrome contra producción, con el examen 1 del libro**

Entrar como profesor (sin tocar la cuenta de Pablo: insertar un `EnlaceDeEntrada` con huella conocida para una persona de prueba PROFESOR y visitar `/entrar/<secreto>`). Luego:

1. Crear «Libro, examen 1» (A2/B1 escolar).
2. Subir `examen 1.pdf`: 14 hojas, todas «Subida», miniaturas visibles.
3. Etiquetar las 14 hojas; el aviso de hojas sin etiquetar desaparece.
4. Subir el cuadernillo: la tabla dice seis exámenes, todos «Sí». Elegir «Examen 1».
5. Rellenar Lectura 3 entera y guardar: «Completa». Cambiar a «Examen 2» en el cuadernillo: Lectura 3 pide volver a guardar. Volver a «Examen 1».
6. Abrir Auditiva 1: las opciones de las cuatro primeras dicen que la imagen se sube después.
7. Abrir Oral 2 después de poner los temas en Oral 1: «Va con: …» enseña los temas.
8. Crear «Libro, examen 2» y subir su PDF de hojas dobles: 7 hojas.
9. Entrar como una persona de prueba ESTUDIANTE: `/examenes` y `/examenes/<id>` dan el 404.
10. Borrar las dos personas de prueba y sus enlaces al terminar.

Anotar en la memoria del proyecto lo que haya fallado solo en el navegador, que es lo único que ninguna prueba de esta entrega toca.

