# El taller, Entrega 3a: fotos, audio con marcas, publicar y retirar · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada opción «con imagen» recibe su foto. Cada tarea de auditiva recibe su pista y las marcas que la parten en trozos, dibujadas sobre la onda. Lo que falte deja la tarea a medias. La página del examen gana Publicar y Retirar, y un examen publicado no se edita.

**Architecture:** Las fotos y el audio viajan en un apartado nuevo del formulario, `medios`, que se guarda con el «Guardar» de siempre. Las fotos van en los `datos` de la actividad; el audio, en una pieza `AUDIO` con su columna `cortes`. La IA nunca ve `medios`: se quita de su esquema y se repone desde la pantalla. Los cálculos de la onda son puros (`lib/taller/onda.ts`) y la pantalla solo los pinta. Publicar vuelve a calcular el estado dentro de una transacción con la fila del `Examen` bloqueada. Todas las escrituras del taller comprueban, en su propia transacción, que el examen no esté publicado.

**Tech Stack:** Next 16 (App Router, acciones de servidor), React 19, Prisma 7 con `@prisma/adapter-pg`, Zod 4, Vitest, `@vercel/blob` 2.8, Web Audio (`OfflineAudioContext`) y lienzo 2D en el navegador.

**Spec:** `docs/superpowers/specs/2026-09-15-taller-entrega-3a-design.md`

## Enmienda declarada a la spec (de implementación, no de comportamiento)

La spec (§3 y §4.1) pone la foto como un campo `imagen` **dentro de cada opción** y el audio como campo suelto del formulario. Al escribir el plan salió que `esquemaDeRespuesta` (`lib/taller/ia/encargo.ts:84`) le manda a la IA el esquema de la forma **tal cual**, y que `imponerEstructura` recorre las claves del formulario vacío. Con la foto dentro de la opción, la IA recibiría un campo de fichero que rellenar en cada opción, y quitarlo exigiría un segundo juego de esquemas.

Por eso fotos y audio van juntos en **`medios: { imagenes: Record<clave, ficheroId>; audio: { fichero; cortes } | null }`**, en el primer nivel del formulario:

- Se quita del esquema de la IA con `.omit({ medios: true })`.
- Es campo **fijo** en `imponerEstructura`.
- En la pantalla, `conMediosDe(leido, enPantalla)` lo repone.

Las claves de foto son `ejemplo-A`, `3-B` (número de la pregunta y letra) y `opcion-1`. Lo que ve y hace el profesor no cambia en nada.

## Global Constraints

- Todo texto que ve una persona, en español.
- **El repositorio es PÚBLICO.** Ni fotos, ni pistas, ni textos del libro entran en el repo. Las pruebas usan datos inventados y señales sintéticas.
- **Ningún `ffmpeg`** ni dependencia nueva de audio. La onda sale de Web Audio en el navegador.
- **La IA nunca toca `medios`.** Ni en el esquema, ni en el JSON del formulario vacío que se le manda, ni al volver.
- **Un examen publicado no se escribe.** Mensaje exacto: `El examen está publicado: retíralo para editarlo.`
- Trozos por tarea de auditiva, exactos: CO1 = 8, CO2 = 7, CO3 = 1, CO4 = 3.
- Silencios: ventanas de 100 ms, RMS por debajo del 2 % de la ventana más fuerte, al menos 1,5 s. No se proponen marcas en los 3 primeros segundos. Nunca dos marcas a menos de 0,3 s ni a menos de 0,3 s de los extremos.
- Fotos: se reducen en el navegador a 1600 px en el lado largo, JPEG al 0,85.
- Esquemas con `z.strictObject` (Zod 4).
- Toda pantalla y toda acción del taller empiezan por `await exigirProfesor()`.
- Nada que cambie datos es un GET.
- Next 16 no es el Next que conoces. `Read(**/node_modules/**)` está denegado: lo que no se pueda leer se valida con `npx tsc --noEmit`.
- Prisma 7: la migración se genera contra un Postgres de usar y tirar (Tarea 2).
- Pruebas: `npm test` (sin base) y `npm run test:base` (contra Postgres). Tipos: `npx tsc --noEmit`. Lint: `npm run lint`. Correr acotado: `npx vitest run tests/<fichero>`.
- Sin jsdom: las pantallas se prueban con `renderToStaticMarkup`. El apagado de un botón se decide con el atributo `disabled`, nunca con la utilidad `disabled:` de Tailwind en la clase (rompe las pruebas que buscan el atributo).
- Cada prueba nueva lleva un comentario «Mutación que la mata: …». Hay que comprobar a mano al menos una por tarea: aplicar la mutación, ver rojo, deshacer.
- Mensajes de commit con heredoc de comillas simples (`git commit -F - <<'EOF'`), sin acentos graves. Cada commit termina con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
- Worktree `/Users/FLE/Projects/hispaprofe-dele-taller-3a`, rama `taller-3a`, sin upstream a propósito. `git branch --show-current` antes de cada commit. Nunca `git add -A`: rutas concretas. No se fusiona ni se empuja sin el «sí» del profesor.

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `lib/dele/estructura.ts` | `ReglaTarea.trozos` y sus valores en CO |
| `lib/taller/medios.ts` (nuevo) | `huecosDeImagen`, `cortesEnOrden`, `conMediosDe`, `SEPARACION_MINIMA` |
| `lib/taller/formas.ts` | `medios` en las ocho formas, en el vacío y en `fallosDeForma` |
| `prisma/schema.prisma` + migración `taller_entrega_3a` | `Pieza.cortes Float[]` |
| `lib/taller/piezas.ts` | `medios` ↔ `datos.imagenes` + pieza `AUDIO` |
| `lib/taller/examenes.ts` | `guardarTarea` escribe `ficheroId`/`cortes`, valida ficheros y respeta el candado; `publicarExamen`, `retirarExamen`; estado del examen en las lecturas |
| `lib/taller/ia/encargo.ts`, `lib/taller/ia/estructura.ts` | La IA sin `medios` |
| `lib/taller/estado.ts`, `components/taller/estado-de-la-tarea.tsx` | Motivos nuevos; fuera `imagenesPendientes` |
| `lib/taller/publicado.ts` (nuevo) | `MENSAJE_PUBLICADO`, `bloquearExamen(tx, id)` |
| `lib/examen/publicar.ts` | `motivosParaPublicar` (completas + estructura) |
| `lib/taller/paginas.ts`, `lib/taller/cuadernillos.ts`, `lib/taller/ia/rellenar.ts` | El candado de publicado |
| `app/examenes/acciones.ts` | `publicarExamenAccion`, `retirarExamenAccion`; `borrarPaginasAccion` devuelve error |
| `lib/taller/onda.ts` (nuevo) | Picos, silencios, propuesta de marcas, ajustar marca, trozos |
| `lib/taller/medios-en-navegador.ts` (nuevo) | `reducirFoto`, `muestrasDeAudio` (solo navegador) |
| `components/taller/foto-de-opcion.tsx` (nuevo) | El hueco de una foto |
| `components/taller/onda.tsx` (nuevo) | Lienzo con marcas arrastrables |
| `components/taller/bloque-de-audio.tsx` (nuevo) | Subir pista, onda, lista de trozos, contador, campo a mano |
| `components/taller/formas-cerradas.tsx`, `formas-abiertas.tsx`, `formulario-de-tarea.tsx` | Enchufar fotos, audio y el aviso de publicado |
| `app/examenes/[id]/page.tsx`, `app/examenes/[id]/[prueba]/[numero]/page.tsx` | Caja Publicar/Retirar; pantalla de solo lectura si está publicado |

---

### Task 0: Punto de partida y CORS del almacén (la hace el controlador, no un subagente)

- [ ] **Step 1: Cifras de partida**

```bash
cd /Users/FLE/Projects/hispaprofe-dele-taller-3a
npm install >/dev/null
npm test 2>&1 | tail -n 4
npm run test:base 2>&1 | tail -n 4
```
Expected: verde, con 361 + 1 omitida y 90 (cifras de `main` 67d30c4). Apuntar las cifras exactas en el ledger.

- [ ] **Step 2: ¿Da el almacén privado cabeceras CORS a un enlace firmado de lectura?**

Hace falta la llave del almacén de producción, sin escribirla en ningún fichero del repo:
```bash
cd /Users/FLE/Projects/hispaprofe-dele-taller-3a
env -u VERCEL_OIDC_TOKEN vercel env pull /private/tmp/claude-504/entorno-3a --environment=production --yes
set -a; . /private/tmp/claude-504/entorno-3a; set +a
env -u VERCEL_OIDC_TOKEN vercel blob list --rw-token "$BLOB_READ_WRITE_TOKEN" | head -5
```
Con una ruta `material/…` de la lista:
```bash
cat > /private/tmp/claude-504/cors.ts <<'EOF'
import { enlaceDeLectura } from "@/lib/ficheros/vercel";
enlaceDeLectura(process.argv[2]!, new Date()).then((u) => console.log(u));
EOF
URL=$(npx tsx --tsconfig tsconfig.json /private/tmp/claude-504/cors.ts "material/<ruta>")
curl -s -o /dev/null -D - -H "Origin: https://hispaprofe.com" "$URL" | grep -i -E '^HTTP|access-control'
rm /private/tmp/claude-504/entorno-3a /private/tmp/claude-504/cors.ts
```
Expected: se apunta el resultado en el ledger. **No cambia el plan.** `BloqueDeAudio` (Tarea 8) prueba a descodificar y, si falla, cae al campo a mano. Si el almacén no da `access-control-allow-origin`, el paso 3 de la aceptación (Tarea 10) ya sabe que al reabrir una tarea saldrá el campo a mano y no la onda, y eso se le cuenta al profesor antes de la aceptación.

---

### Task 1: Reglas y forma de `medios`

**Files:**
- Modify: `lib/dele/estructura.ts` (tipo `ReglaTarea` y filas `CO` de `ESCOLAR`)
- Create: `lib/taller/medios.ts`
- Modify: `lib/taller/formas.ts`
- Test: `tests/estructura.test.ts`, `tests/taller-medios.test.ts` (nuevo), `tests/taller-formas.test.ts`

**Interfaces:**
- Produces:
  - `ReglaTarea.trozos?: number`
  - `type Medios = { imagenes: Record<string, string>; audio: { fichero: string; cortes: number[] } | null }` (exportado de `formas.ts`)
  - `Formulario` gana `medios: Medios` en todas las formas
  - `huecosDeImagen(f: Formulario): { clave: string; etiqueta: string }[]`
  - `cortesEnOrden(cortes: readonly number[]): boolean`
  - `conMediosDe<F extends Formulario>(leido: F, enPantalla: Formulario): F`
  - `SEPARACION_MINIMA = 0.3`

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir al final del `describe` principal de `tests/estructura.test.ts`:
```ts
  // Mutación que la mata: cambiar CO1.trozos de 8 a 7 (olvidar que el ejemplo suena).
  it("las pistas de auditiva se parten en 8, 7, 1 y 3 trozos, y ninguna otra tarea lleva audio", () => {
    expect(ESCOLAR.CO.map((r) => r.trozos)).toEqual([8, 7, 1, 3]);
    for (const prueba of ["CE", "EE", "EO"] as const) {
      for (const r of ESCOLAR[prueba]) expect(r.trozos).toBeUndefined();
    }
  });
```

Crear `tests/taller-medios.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { reglaDe } from "@/lib/dele/estructura";
import { formularioVacio } from "@/lib/taller/formas";
import { conMediosDe, cortesEnOrden, huecosDeImagen } from "@/lib/taller/medios";

const vacio = (p: "CE" | "CO" | "EO", n: number) => formularioVacio(reglaDe("A2_B1_ESCOLAR", p, n)!);

describe("los huecos de foto de una tarea", () => {
  // Mutación que la mata: olvidar las opciones del ejemplo.
  it("Auditiva 1: las tres del ejemplo y las tres de cada una de las cuatro primeras preguntas", () => {
    const h = huecosDeImagen(vacio("CO", 1));
    expect(h).toHaveLength(15);
    expect(h[0]).toEqual({ clave: "ejemplo-A", etiqueta: "la opción A del ejemplo" });
    expect(h.at(-1)).toEqual({ clave: "4-C", etiqueta: "la opción C de la pregunta 4" });
  });

  // Mutación que la mata: en ORAL_SOLO devolver un hueco por opción aunque no lleve conImagen.
  it("Oral 1 lleva una foto por opción y Oral 3 ninguna", () => {
    expect(huecosDeImagen(vacio("EO", 1))).toEqual([
      { clave: "opcion-1", etiqueta: "la opción 1" },
      { clave: "opcion-2", etiqueta: "la opción 2" },
    ]);
    expect(huecosDeImagen(vacio("EO", 3))).toEqual([]);
  });

  it("una tarea sin imágenes no tiene huecos", () => {
    expect(huecosDeImagen(vacio("CE", 3))).toEqual([]);
  });
});

describe("las marcas del audio", () => {
  // Mutación que la mata: comparar con > en vez de >= contra la separación mínima.
  it("en orden, positivas y a 0,3 s como poco", () => {
    expect(cortesEnOrden([])).toBe(true);
    expect(cortesEnOrden([10, 10.3, 42])).toBe(true);
    expect(cortesEnOrden([10, 10.2])).toBe(false);
    expect(cortesEnOrden([42, 10])).toBe(false);
    expect(cortesEnOrden([0])).toBe(false);
  });
});

describe("lo que la IA no toca", () => {
  // Mutación que la mata: devolver leido.medios en vez de enPantalla.medios.
  it("conMediosDe se queda con las fotos y la pista de la pantalla", () => {
    const pantalla = vacio("CO", 1);
    pantalla.medios = { imagenes: { "ejemplo-A": "f1" }, audio: { fichero: "a1", cortes: [30] } };
    const leido = { ...vacio("CO", 1), consigna: "Escucha." };
    const r = conMediosDe(leido, pantalla);
    expect(r.consigna).toBe("Escucha.");
    expect(r.medios).toEqual(pantalla.medios);
  });
});
```

Añadir al final de `tests/taller-formas.test.ts`, dentro del `describe` principal:
```ts
  // Mutación que la mata: no mirar las claves de medios.imagenes en fallosDeForma.
  it("una foto en una clave que no es de ninguna opción con imagen no pasa", () => {
    const r = regla("CO", 1);
    const f = formularioVacio(r);
    f.medios.imagenes["ejemplo-A"] = "f1";
    expect(pasa(r, f)).toBe(true);
    f.medios.imagenes["5-A"] = "f2";
    expect(pasa(r, f)).toBe(false);
  });

  // Mutación que la mata: no mirar regla.trozos antes de aceptar un audio.
  it("audio solo en las tareas con trozos, y con las marcas en orden", () => {
    const ce3 = regla("CE", 3);
    const conAudio = formularioVacio(ce3);
    conAudio.medios.audio = { fichero: "a1", cortes: [] };
    expect(pasa(ce3, conAudio)).toBe(false);

    const co4 = regla("CO", 4);
    const f = formularioVacio(co4);
    f.medios.audio = { fichero: "a1", cortes: [120, 240] };
    expect(pasa(co4, f)).toBe(true);
    f.medios.audio = { fichero: "a1", cortes: [240, 120] };
    expect(pasa(co4, f)).toBe(false);
  });

  // Mutación que la mata: olvidar medios en el vacío de alguna forma.
  it.each(TODAS)("el vacío de $nombre no trae fotos ni pista", ({ regla: r }) => {
    expect(formularioVacio(r).medios).toEqual({ imagenes: {}, audio: null });
  });
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/estructura.test.ts tests/taller-medios.test.ts tests/taller-formas.test.ts`
Expected: FAIL (no existe `lib/taller/medios`; `trozos` indefinido; `medios` indefinido).

- [ ] **Step 3: `trozos` en las reglas**

En `lib/dele/estructura.ts`, dentro de `ReglaTarea`, después de `hermana?: number;`:
```ts
  /** CO: en cuántos trozos se parte la pista (el ejemplo suena y cuenta). Sin él, la tarea no lleva audio. */
  trozos?: number;
```
En `ESCOLAR.CO`, añadir `trozos` al final de cada fila:
```ts
    { numero: 1, items: 7, primero: 1, forma: "OPCIONES", ejemplo: true, letras: 3, textos: 0, itemsConImagen: 4, trozos: 8 },
    { numero: 2, items: 6, primero: 8, forma: "RELACIONAR", ejemplo: true, letras: 10, textos: 0, elementosConTexto: false, trozos: 7 },
    { numero: 3, items: 6, primero: 14, forma: "LISTA_COMUN", ejemplo: true, letras: 3, textos: 0, trozos: 1 },
    { numero: 4, items: 6, primero: 20, forma: "OPCIONES", ejemplo: false, letras: 3, textos: 0, grupos: 3, trozos: 3 },
```

- [ ] **Step 4: `lib/taller/medios.ts`**

```ts
import type { Formulario } from "./formas";

/** Ni dos marcas del audio ni una marca y un extremo pueden quedar más cerca. */
export const SEPARACION_MINIMA = 0.3;

export type HuecoDeImagen = { clave: string; etiqueta: string };

/** Cada opción que lleva foto, con la clave que usa `medios.imagenes` y cómo se nombra en los motivos. */
export function huecosDeImagen(f: Formulario): HuecoDeImagen[] {
  switch (f.forma) {
    case "OPCIONES": {
      const huecos: HuecoDeImagen[] = [];
      for (const o of f.actividad.ejemplo?.opciones ?? []) {
        if (o.conImagen) huecos.push({ clave: `ejemplo-${o.letra}`, etiqueta: `la opción ${o.letra} del ejemplo` });
      }
      for (const p of f.actividad.preguntas) {
        for (const o of p.opciones) {
          if (o.conImagen) huecos.push({ clave: `${p.numero}-${o.letra}`, etiqueta: `la opción ${o.letra} de la pregunta ${p.numero}` });
        }
      }
      return huecos;
    }
    case "ORAL_SOLO":
      return f.actividad.opciones.flatMap((o, i) => (o.conImagen ? [{ clave: `opcion-${i + 1}`, etiqueta: `la opción ${i + 1}` }] : []));
    default:
      return [];
  }
}

/** Las marcas, en segundos: positivas, crecientes y separadas al menos SEPARACION_MINIMA. */
export function cortesEnOrden(cortes: readonly number[]): boolean {
  // El 1e-9 absorbe el redondeo de coma flotante: 10.3 - 10 no da exactamente 0.3.
  return cortes.every((c, i) => c > 0 && (i === 0 || c - cortes[i - 1] >= SEPARACION_MINIMA - 1e-9));
}

/** Lo que leyó la IA, con las fotos y la pista que ya había en pantalla: la IA nunca las toca. */
export function conMediosDe<F extends Formulario>(leido: F, enPantalla: Formulario): F {
  return { ...leido, medios: enPantalla.medios };
}
```

- [ ] **Step 5: `medios` en `lib/taller/formas.ts`**

Añadir el import al principio (junto a los otros):
```ts
import { cortesEnOrden, huecosDeImagen } from "./medios";
```
Después de `const letraConTexto = …;`:
```ts
const idDeFichero = z.string().min(1).max(40);
const medios = z.strictObject({
  /** Clave de `huecosDeImagen` → id del Fichero. */
  imagenes: z.record(z.string().max(20), idDeFichero),
  audio: z.strictObject({ fichero: idDeFichero, cortes: z.array(z.number()).max(20) }).nullable(),
});
export type Medios = z.infer<typeof medios>;
```
En cada una de las ocho formas (`relacionar`, `listaComun`, `opciones`, `huecos`, `redaccionUna`, `redaccionDos`, `oralSolo`, `oralDirecto`), añadir la línea `medios,` justo después de `textos,`.

En `fallosDeForma`, sustituir la última línea `return fallos;` por:
```ts
  const huecosValidos = new Set(huecosDeImagen(f).map((h) => h.clave));
  for (const clave of Object.keys(f.medios.imagenes)) {
    if (!huecosValidos.has(clave)) fallos.push(`La foto «${clave}» no es de ninguna opción con imagen.`);
  }
  if (f.medios.audio) {
    if (!regla.trozos) fallos.push("Esta tarea no lleva audio.");
    else if (!cortesEnOrden(f.medios.audio.cortes)) fallos.push("Las marcas del audio tienen que ir en orden y separadas al menos 0,3 s.");
  }
  return fallos;
```

En `formularioVacio`, después de `const consigna = "";`:
```ts
  const medios = { imagenes: {}, audio: null };
```
y en **cada** `return` de las ocho ramas del `switch`, cambiar `consigna, textos,` por `consigna, textos, medios,`.

- [ ] **Step 6: Correr las pruebas y ver verde**

Run: `npx vitest run tests/estructura.test.ts tests/taller-medios.test.ts tests/taller-formas.test.ts && npx tsc --noEmit`
Expected: PASS. `tsc` puede quejarse en ficheros de pruebas que construyen un `Formulario` a mano sin `medios`: añadirles `medios: { imagenes: {}, audio: null }`. No toques código de producción fuera de esta tarea. Luego `npm test 2>&1 | tail -n 4`: todo verde menos lo que dependa de las tareas siguientes, que no debería ser nada.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add lib/dele/estructura.ts lib/taller/medios.ts lib/taller/formas.ts tests/estructura.test.ts tests/taller-medios.test.ts tests/taller-formas.test.ts
git commit -F - <<'EOF'
Reglas y forma de medios: trozos por tarea, fotos por clave y audio con marcas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Guardar fotos y pista (piezas, columna `cortes`, ficheros válidos)

**Files:**
- Modify: `prisma/schema.prisma` (modelo `Pieza`)
- Create: `prisma/migrations/<fecha>_taller_entrega_3a/migration.sql` (generada)
- Modify: `lib/taller/piezas.ts`
- Modify: `lib/taller/examenes.ts` (`guardarTarea`)
- Test: `tests/taller-piezas.test.ts`, `tests/base/taller-examenes.test.ts`

**Interfaces:**
- Consumes: `Medios`, `Formulario.medios` (Task 1)
- Produces:
  - `PiezaParaGuardar` y `PiezaLeida` ganan `ficheroId: string | null` y `cortes: number[]`; `tipo` admite `"AUDIO"`
  - `guardarTarea` devuelve `{ error: "Una de las fotos ya no existe: vuelve a subirla." }` o `{ error: "La pista de audio ya no existe: vuelve a subirla." }`

- [ ] **Step 1: Cambiar el esquema**

En `model Pieza`, justo debajo de `ficheroId String?`:
```prisma
  /// Solo AUDIO: los segundos de cada marca, en orden. Parten la pista en trozos.
  cortes    Float[]  @default([])
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
  npx prisma migrate dev --name taller_entrega_3a --create-only
DATABASE_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
DIRECT_URL="postgresql://postgres@127.0.0.1:55433/migrar" \
  npx prisma migrate deploy
pg_ctl -D "$D" stop -m fast; rm -rf "$D"
npx prisma generate
```
Expected: una carpeta `prisma/migrations/2026…_taller_entrega_3a/` cuyo SQL es solo `ALTER TABLE "Pieza" ADD COLUMN "cortes" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];`. Si toca cualquier otra tabla, parar y avisar al controlador.

- [ ] **Step 3: Escribir las pruebas que fallan**

En `tests/taller-piezas.test.ts`, sustituir `comoLeidas` por:
```ts
/** Lo que devolvería Prisma al leer las piezas guardadas. */
function comoLeidas(f: Parameters<typeof piezasDelFormulario>[0]): PiezaLeida[] {
  return piezasDelFormulario(f).map((p) => ({
    orden: p.orden,
    tipo: p.tipo,
    texto: p.texto,
    etiqueta: p.etiqueta,
    ficheroId: p.ficheroId,
    cortes: p.cortes,
    actividad: p.actividad ? { datos: JSON.parse(JSON.stringify(p.actividad.datos)) } : null,
  }));
}
```
y añadir dentro del `describe`:
```ts
  // Mutación que la mata: no leer `imagenes` de los datos, o no leer la pieza AUDIO.
  it("Auditiva 1 con fotos y pista va y vuelve igual", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    f.medios = { imagenes: { "ejemplo-A": "f1", "4-C": "f2" }, audio: { fichero: "a1", cortes: [12.5, 60] } };
    expect(formularioDePiezas(comoLeidas(f))).toEqual(f);
  });

  // Mutación que la mata: dejar la actividad en `f.textos.length + 1` también cuando hay audio (choca con la pieza AUDIO).
  it("con pista: consigna, audio y actividad, en orden seguido", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 3)!);
    f.medios.audio = { fichero: "a1", cortes: [] };
    expect(piezasDelFormulario(f).map((p) => [p.orden, p.tipo, p.ficheroId])).toEqual([
      [0, "TEXTO", null], [1, "AUDIO", "a1"], [2, "ACTIVIDAD", null],
    ]);
  });

  // Mutación que la mata: exigir `imagenes` en los datos (lo guardado antes de la Entrega 3a no lo trae).
  it("lo guardado antes de esta entrega, sin imagenes ni pista, se lee con medios vacíos", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
    const leidas = comoLeidas(f).map((p) => {
      if (!p.actividad) return p;
      const { imagenes: _fuera, ...datos } = p.actividad.datos as Record<string, unknown>;
      return { ...p, actividad: { datos } };
    });
    expect(formularioDePiezas(leidas)?.medios).toEqual({ imagenes: {}, audio: null });
  });
```

En `tests/base/taller-examenes.test.ts`, añadir al final:
```ts
describe("fotos y pista al guardar", () => {
  function fichero(tipoMime: string) {
    return prisma.fichero.create({ data: { almacen: "VERCEL", ruta: `material/${Math.random().toString(36).slice(2)}`, tipoMime, bytes: 1 } });
  }
  const co1 = () => formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);

  // Mutación que la mata: no escribir `cortes` (o `ficheroId`) al crear la pieza.
  it("la foto y la pista con sus marcas van y vuelven", async () => {
    const id = await examenConCuadernillo();
    const [foto, pista] = [await fichero("image/jpeg"), await fichero("audio/mpeg")];
    const f = co1();
    f.medios = { imagenes: { "ejemplo-A": foto.id }, audio: { fichero: pista.id, cortes: [30.5, 75.25] } };
    const r = await guardarTarea(id, "CO", 1, f);
    if ("error" in r) throw new Error(r.error);
    expect((await tareaParaElTaller(id, "CO", 1))!.formulario.medios).toEqual(f.medios);
  });

  // Mutación que la mata: comprobar que el fichero existe sin mirar que sea una imagen.
  it("una foto que no es una imagen no se guarda, y no se escribe nada", async () => {
    const id = await examenConCuadernillo();
    const f = co1();
    f.medios.imagenes["ejemplo-A"] = (await fichero("audio/mpeg")).id;
    expect(await guardarTarea(id, "CO", 1, f)).toEqual({ error: "Una de las fotos ya no existe: vuelve a subirla." });
    expect(await prisma.pieza.count()).toBe(0);
  });

  // Mutación que la mata: no comprobar la pista.
  it("una pista que no existe no se guarda", async () => {
    const id = await examenConCuadernillo();
    const f = co1();
    f.medios.audio = { fichero: "no-existe", cortes: [] };
    expect(await guardarTarea(id, "CO", 1, f)).toEqual({ error: "La pista de audio ya no existe: vuelve a subirla." });
    expect(await prisma.pieza.count()).toBe(0);
  });
});
```

- [ ] **Step 4: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-piezas.test.ts` y `npm run test:base -- tests/base/taller-examenes.test.ts`
Expected: FAIL (`ficheroId` y `cortes` no existen en las piezas; `medios` no vuelve; no hay validación de ficheros).

- [ ] **Step 5: `lib/taller/piezas.ts`**

Sustituir los dos tipos y las dos funciones por:
```ts
export type PiezaParaGuardar = {
  orden: number;
  tipo: Extract<TipoPieza, "TEXTO" | "AUDIO" | "ACTIVIDAD">;
  texto: string | null;
  etiqueta: string | null;
  ficheroId: string | null;
  cortes: number[];
  actividad: { tipo: TipoActividad; datos: Record<string, unknown> } | null;
};

export type PiezaLeida = {
  orden: number;
  tipo: TipoPieza;
  texto: string | null;
  etiqueta: string | null;
  ficheroId: string | null;
  cortes: number[];
  actividad: { datos: unknown } | null;
};

const SIN_FICHERO = { ficheroId: null, cortes: [] };

/**
 * Una tarea del taller en la lista de piezas del modelo: la consigna, los
 * textos sueltos, la pista si la hay y una actividad. Las fotos van en los
 * datos de la actividad, por clave. Las respuestas NO van aquí: van en Clave.
 */
export function piezasDelFormulario(f: Formulario): PiezaParaGuardar[] {
  const audio: PiezaParaGuardar[] = f.medios.audio
    ? [{ orden: f.textos.length + 1, tipo: "AUDIO", texto: null, etiqueta: null, ficheroId: f.medios.audio.fichero, cortes: f.medios.audio.cortes, actividad: null }]
    : [];
  return [
    { orden: 0, tipo: "TEXTO", texto: f.consigna, etiqueta: ETIQUETA_DE_CONSIGNA, ...SIN_FICHERO, actividad: null },
    ...f.textos.map((t, i) => ({
      orden: i + 1,
      tipo: "TEXTO" as const,
      texto: t.texto,
      etiqueta: t.etiqueta,
      ...SIN_FICHERO,
      actividad: null,
    })),
    ...audio,
    {
      orden: f.textos.length + 1 + audio.length,
      tipo: "ACTIVIDAD",
      texto: null,
      etiqueta: null,
      ...SIN_FICHERO,
      actividad: { tipo: TIPO_DE_ACTIVIDAD[f.forma], datos: { forma: f.forma, ...f.actividad, imagenes: f.medios.imagenes } },
    },
  ];
}

/** Lo contrario. null si la tarea no se guardó nunca o si lo guardado ya no casa con ninguna forma. */
export function formularioDePiezas(piezas: readonly PiezaLeida[]): Formulario | null {
  const ordenadas = [...piezas].sort((a, b) => a.orden - b.orden);
  const datos = ordenadas.find((p) => p.tipo === "ACTIVIDAD")?.actividad?.datos;
  if (!datos || typeof datos !== "object") return null;
  // Lo guardado antes de la Entrega 3a no trae `imagenes`: se lee como ninguna foto.
  const { forma, imagenes, ...actividad } = datos as Record<string, unknown>;
  const textos = ordenadas.filter((p) => p.tipo === "TEXTO");
  const pista = ordenadas.find((p) => p.tipo === "AUDIO");
  const leido = formularioBase.safeParse({
    forma,
    consigna: textos[0]?.orden === 0 ? (textos[0].texto ?? "") : "",
    textos: textos.filter((p) => p.orden > 0).map((p) => ({ etiqueta: p.etiqueta ?? "", texto: p.texto ?? "" })),
    medios: {
      imagenes: imagenes ?? {},
      audio: pista?.ficheroId ? { fichero: pista.ficheroId, cortes: pista.cortes } : null,
    },
    actividad,
  });
  return leido.success ? leido.data : null;
}
```

- [ ] **Step 6: `guardarTarea` escribe la pieza de audio y valida los ficheros**

En `lib/taller/examenes.ts`, añadir encima de `guardarTarea`:
```ts
/**
 * Las fotos y la pista tienen que ser ficheros del almacén de material, del
 * tipo que toca. Una subida que se borró, o un id cualquiera, no se guarda.
 */
async function ficherosQueNoValen(f: Formulario): Promise<string | null> {
  const fotos = Object.values(f.medios.imagenes);
  const pista = f.medios.audio?.fichero ?? null;
  const ids = pista ? [...fotos, pista] : fotos;
  if (ids.length === 0) return null;
  const encontrados = new Map((await prisma.fichero.findMany({ where: { id: { in: ids } } })).map((x) => [x.id, x]));
  const vale = (id: string, prefijo: string) => {
    const x = encontrados.get(id);
    return x !== undefined && x.almacen === "VERCEL" && x.tipoMime.startsWith(prefijo);
  };
  if (fotos.some((id) => !vale(id, "image/"))) return "Una de las fotos ya no existe: vuelve a subirla.";
  if (pista && !vale(pista, "audio/")) return "La pista de audio ya no existe: vuelve a subirla.";
  return null;
}
```
En `guardarTarea`, justo después de `const formulario = leido.data;`:
```ts
  const ficherosMalos = await ficherosQueNoValen(formulario);
  if (ficherosMalos) return { error: ficherosMalos };
```
Y en el `tx.pieza.create`, debajo de `etiqueta: p.etiqueta,`:
```ts
          ficheroId: p.ficheroId,
          cortes: p.cortes,
```

- [ ] **Step 7: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-piezas.test.ts && npm run test:base -- tests/base/taller-examenes.test.ts && npx tsc --noEmit`
Expected: PASS. Si `tsc` señala otros sitios que construyen `PiezaLeida` a mano en pruebas, añadir `ficheroId: null, cortes: []`.

- [ ] **Step 8: Commit**

```bash
git branch --show-current
git add prisma/schema.prisma prisma/migrations lib/taller/piezas.ts lib/taller/examenes.ts tests/taller-piezas.test.ts tests/base/taller-examenes.test.ts
git commit -F - <<'EOF'
Guardar fotos y pista: pieza AUDIO con sus cortes y ficheros comprobados

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: La IA no ve ni toca `medios`

**Files:**
- Modify: `lib/taller/formas.ts` (`ESQUEMA_PARA_LA_IA`)
- Modify: `lib/taller/ia/encargo.ts`
- Modify: `lib/taller/ia/estructura.ts`
- Modify: `lib/taller/ia/rellenar.ts` (`interpretar`)
- Test: `tests/taller-ia-encargo.test.ts`, `tests/taller-ia-interpretar.test.ts`, `tests/base/taller-ia-rellenar.test.ts`

**Interfaces:**
- Consumes: `Formulario.medios` (Task 1)
- Produces: `sinMedios(f: Formulario): Record<string, unknown>` exportado de `lib/taller/ia/encargo.ts`. `esquemaDeRespuesta(forma)` ya no admite `medios`. `interpretar` devuelve un formulario con `medios` vacíos, que la pantalla sustituye con `conMediosDe` (Task 7).

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir al final de `tests/taller-ia-encargo.test.ts` (importar lo que falte: `encargoDeTarea`, `esquemaDeRespuesta` y `sinMedios` de `@/lib/taller/ia/encargo`, `formularioVacio` de `@/lib/taller/formas` y `reglaDe` de `@/lib/dele/estructura`):
```ts
describe("la IA no ve las fotos ni la pista", () => {
  const co1 = reglaDe("A2_B1_ESCOLAR", "CO", 1)!;

  // Mutación que la mata: quitar el .omit({ medios: true }) del esquema de respuesta.
  it("el esquema de respuesta rechaza un formulario con medios y acepta uno sin ellos", () => {
    const esquema = esquemaDeRespuesta("OPCIONES");
    expect(esquema.safeParse({ formulario: formularioVacio(co1), dudas: [] }).success).toBe(false);
    expect(esquema.safeParse({ formulario: sinMedios(formularioVacio(co1)), dudas: [] }).success).toBe(true);
  });

  // Mutación que la mata: mandar formularioVacio(regla) sin quitarle medios.
  it("el formulario vacío que se le manda no lleva medios", () => {
    expect(encargoDeTarea("A2_B1_ESCOLAR", "CO", co1, []).texto).not.toContain("medios");
  });
});
```

En `tests/taller-ia-interpretar.test.ts`, importar `sinMedios` de `@/lib/taller/ia/encargo`. Cambiar `bueno` para que devuelva `sinMedios({ ...f, consigna: "Lee el texto." })`. Revisar cada `formulario:` que se pase a `respuesta(...)` en ese fichero y envolverlo en `sinMedios(...)`, salvo en la prueba «una salida de otra forma es error», que ya falla por otro motivo. Si una prueba modifica `f` antes de mandarlo, la modificación va antes de `sinMedios`. Añadir:
```ts
  // Mutación que la mata: quitar "medios" de las claves FIJAS de imponerEstructura.
  it("lo leído vuelve con medios vacíos y cumple su forma", () => {
    const co1 = reglaDe("A2_B1_ESCOLAR", "CO", 1)!;
    const r = interpretar(co1, respuesta({ formulario: sinMedios({ ...formularioVacio(co1), consigna: "Escucha." }), dudas: [] }));
    if ("error" in r) throw new Error(r.error);
    expect(r.formulario.medios).toEqual({ imagenes: {}, audio: null });
  });
```

En `tests/base/taller-ia-rellenar.test.ts`, importar `sinMedios` y cambiar `leido` por:
```ts
const leido = () => ({ formulario: sinMedios({ ...formularioVacio(ce3), consigna: "Lee el texto." }), dudas: [] });
```
Buscar con `grep -n "formulario:" tests/base/taller-ia-rellenar.test.ts` otros formularios mandados como salida de la IA y envolverlos igual.

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-ia-encargo.test.ts tests/taller-ia-interpretar.test.ts`
Expected: FAIL (`sinMedios` no existe).

- [ ] **Step 3: Implementar**

En `lib/taller/formas.ts`, debajo de `ESQUEMA_DE_FORMA`, añadir el mapa ya recortado. Se hace aquí, forma a forma, porque `ESQUEMA_DE_FORMA[forma].omit(...)` con `forma: Forma` es una llamada sobre una unión de esquemas y TypeScript puede no dejar invocarla:
```ts
/** Lo que ve la IA: cada forma sin `medios` (las fotos y la pista no son suyas). */
export const ESQUEMA_PARA_LA_IA = {
  RELACIONAR: relacionar.omit({ medios: true }),
  LISTA_COMUN: listaComun.omit({ medios: true }),
  OPCIONES: opciones.omit({ medios: true }),
  HUECOS: huecos.omit({ medios: true }),
  REDACCION_UNA: redaccionUna.omit({ medios: true }),
  REDACCION_DOS: redaccionDos.omit({ medios: true }),
  ORAL_SOLO: oralSolo.omit({ medios: true }),
  ORAL_DIRECTO: oralDirecto.omit({ medios: true }),
} as const satisfies Record<Forma, z.ZodType>;
```
Si `ESQUEMA_DE_FORMA` se queda sin usos, borrarlo (`grep -rn ESQUEMA_DE_FORMA lib app components tests`).

En `lib/taller/ia/encargo.ts` (que `lib/taller/ia/llamar.ts` usa para el formato de salida de la API, así que basta con cambiarlo aquí), cambiar el import de formas por:
```ts
import { ESQUEMA_PARA_LA_IA, formularioVacio, type Formulario } from "@/lib/taller/formas";
```
Añadir antes de `esquemaDeRespuesta`:
```ts
/** El formulario sin las fotos ni la pista: la IA no las ve, no las rellena y no las devuelve. */
export function sinMedios(f: Formulario): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...f };
  delete copia.medios;
  return copia;
}
```
Cambiar `esquemaDeRespuesta` por:
```ts
export function esquemaDeRespuesta(forma: Forma) {
  return z.strictObject({
    formulario: ESQUEMA_PARA_LA_IA[forma],
    dudas: z.array(z.strictObject({ campo: z.string(), nota: z.string() })),
  });
}
```
Y en `encargoDeTarea`, cambiar `JSON.stringify(formularioVacio(regla), null, 2),` por:
```ts
    JSON.stringify(sinMedios(formularioVacio(regla)), null, 2),
```

En `lib/taller/ia/estructura.ts`:
```ts
/** Las que manda el formulario vacío, diga lo que diga la IA. `medios` la repone la pantalla (conMediosDe). */
const FIJAS = new Set(["forma", "numero", "conImagen", "grupo", "medios"]);
```

En `lib/taller/ia/rellenar.ts`, dentro de `interpretar`, cambiar la línea de `imponerEstructura` por:
```ts
  // Lo leído no trae `medios` (la IA no los ve); imponerEstructura los toma del vacío.
  const impuesta = imponerEstructura(formularioVacio(regla), leida.data.formulario as Formulario);
```

- [ ] **Step 4: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-ia-encargo.test.ts tests/taller-ia-interpretar.test.ts tests/taller-ia-estructura.test.ts && npm run test:base -- tests/base/taller-ia-rellenar.test.ts && npx tsc --noEmit`
Expected: PASS. Si `tsc` rechaza el `as Formulario` por falta de solapamiento, usar `as unknown as Formulario` y dejar el comentario.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/taller/formas.ts lib/taller/ia/encargo.ts lib/taller/ia/estructura.ts lib/taller/ia/rellenar.ts tests/taller-ia-encargo.test.ts tests/taller-ia-interpretar.test.ts tests/base/taller-ia-rellenar.test.ts
git commit -F - <<'EOF'
La IA no ve las fotos ni la pista: fuera de su esquema y fijas al mezclar

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Qué bloquea una tarea: foto que falta, pista que falta, trozos que no cuadran

**Files:**
- Modify: `lib/taller/estado.ts`
- Modify: `components/taller/estado-de-la-tarea.tsx`
- Test: `tests/taller-estado.test.ts`; quitar `imagenesPendientes` de los dobles en `tests/taller-acciones.test.ts`, `tests/taller-formulario.test.tsx`, `tests/taller-pantallas.test.ts` y `tests/base/taller-examenes.test.ts`

**Interfaces:**
- Consumes: `huecosDeImagen` (Task 1), `ReglaTarea.trozos` (Task 1)
- Produces: `EstadoDeTarea = { estado: "VACIA" | "A_MEDIAS" | "COMPLETA"; motivos: string[] }`. Desaparecen el campo `imagenesPendientes` y la función `imagenesPendientes`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/taller-estado.test.ts`:
- Quitar `imagenesPendientes` del import.
- En «Lectura 3 llena y con su cuadernillo está completa», el `toEqual` pasa a `{ estado: "COMPLETA", motivos: [] }`.
- Borrar la prueba que hacía `expect(imagenesPendientes(f)).toBe(15)`, cambiándola por el bloque de abajo.
- Si alguna prueba existente espera `COMPLETA` en una tarea de auditiva o en Oral 1, pasarle antes el formulario por `conMedios` (abajo).

Añadir, después de la función `lleno`:
```ts
/** Pone una foto en cada hueco y, si la regla lleva trozos, una pista con las marcas justas. */
function conMedios(prueba: "CE" | "CO" | "EE" | "EO", numero: number, f: Formulario): Formulario {
  const r = regla(prueba, numero);
  const imagenes = Object.fromEntries(huecosDeImagen(f).map((h) => [h.clave, "foto"]));
  const audio = r.trozos ? { fichero: "pista", cortes: Array.from({ length: r.trozos - 1 }, (_, i) => (i + 1) * 10) } : null;
  return { ...f, medios: { imagenes, audio } };
}
const CO1 = { "1": "A", "2": "B", "3": "C", "4": "A", "5": "B", "6": "C", "7": "A" };
```
(importar `huecosDeImagen` de `@/lib/taller/medios`), y al final:
```ts
describe("fotos y pista", () => {
  // Mutación que la mata: no llamar a motivosDeMedios desde motivosDeTarea.
  it("Auditiva 1 sin fotos ni pista dice cada foto que falta y que falta la pista", () => {
    const motivos = motivosDeTarea(regla("CO", 1), lleno("CO", 1), CO1, null);
    expect(motivos).toContain("Falta la foto de la opción A del ejemplo.");
    expect(motivos).toContain("Falta la foto de la opción C de la pregunta 4.");
    expect(motivos.filter((m) => m.startsWith("Falta la foto"))).toHaveLength(15);
    expect(motivos).toContain("Falta la pista de audio.");
  });

  // Mutación que la mata: comparar cortes.length con trozos en vez de cortes.length + 1.
  it("Auditiva 4 con una sola marca tiene 2 trozos y lleva 3", () => {
    const f = conMedios("CO", 4, lleno("CO", 4));
    f.medios.audio = { fichero: "pista", cortes: [100] };
    const motivos = motivosDeTarea(regla("CO", 4), f, { "20": "A", "21": "A", "22": "A", "23": "A", "24": "A", "25": "A" }, null);
    expect(motivos).toEqual(["La pista tiene 2 trozos y esta tarea lleva 3."]);
  });

  it("Auditiva 3 no se corta: la pista sin marcas vale", () => {
    const f = conMedios("CO", 3, lleno("CO", 3));
    expect(f.medios.audio?.cortes).toEqual([]);
    expect(motivosDeTarea(regla("CO", 3), f, { "14": "A", "15": "A", "16": "A", "17": "A", "18": "A", "19": "A" }, null)).toEqual([]);
  });

  // Mutación que la mata: en huecosDeImagen, olvidar ORAL_SOLO.
  it("Oral 1 sin fotos dice qué opción no la tiene; con ellas está completa", () => {
    expect(motivosDeTarea(regla("EO", 1), lleno("EO", 1), null, null)).toEqual(["Falta la foto de la opción 1.", "Falta la foto de la opción 2."]);
    expect(estadoDeTarea(regla("EO", 1), conMedios("EO", 1, lleno("EO", 1)), null, null)).toEqual({ estado: "COMPLETA", motivos: [] });
  });

  // Mutación que la mata: exigir pista en tareas sin trozos.
  it("Auditiva 1 con todo puesto está completa, y Lectura 3 no pide pista", () => {
    expect(estadoDeTarea(regla("CO", 1), conMedios("CO", 1, lleno("CO", 1)), CO1, null).estado).toBe("COMPLETA");
    expect(motivosDeTarea(regla("CE", 3), lleno("CE", 3), CE3, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-estado.test.ts`
Expected: FAIL (ningún motivo de fotos ni de pista).

- [ ] **Step 3: Implementar**

En `lib/taller/estado.ts`:
- Añadir `import { huecosDeImagen } from "./medios";`.
- Cambiar el tipo por:
```ts
export type EstadoDeTarea = {
  estado: "VACIA" | "A_MEDIAS" | "COMPLETA";
  motivos: string[];
};
```
- Borrar la función `imagenesPendientes`.
- Añadir antes de `motivosDeTarea`:
```ts
/** Las fotos que faltan y la pista: que esté, y que sus marcas den los trozos que lleva la tarea. */
function motivosDeMedios(regla: ReglaTarea, f: Formulario): string[] {
  const m = huecosDeImagen(f)
    .filter((h) => !f.medios.imagenes[h.clave])
    .map((h) => `Falta la foto de ${h.etiqueta}.`);
  if (regla.trozos) {
    const audio = f.medios.audio;
    if (!audio) m.push("Falta la pista de audio.");
    else if (audio.cortes.length + 1 !== regla.trozos) {
      m.push(`La pista tiene ${audio.cortes.length + 1} trozos y esta tarea lleva ${regla.trozos}.`);
    }
  }
  return m;
}
```
- En `motivosDeTarea`, justo después de `if (f.forma === "HUECOS") motivos.push(...motivosDeMarcas(f));`:
```ts
  motivos.push(...motivosDeMedios(regla, f));
```
- En `estadoDeTarea`:
```ts
  if (!f) return { estado: "VACIA", motivos: ["Sin guardar todavía."] };
  const motivos = motivosDeTarea(regla, f, respuestas, claveGuardada);
  return { estado: motivos.length === 0 ? "COMPLETA" : "A_MEDIAS", motivos };
```

En `components/taller/estado-de-la-tarea.tsx`, dentro de `EstadoDeLaTarea`, borrar el bloque `{estado.imagenesPendientes > 0 && (…)}`. Queda solo la insignia dentro del `div`.

En los cuatro ficheros de pruebas de la lista **Files**, borrar `, imagenesPendientes: 0` de cada doble de estado (`grep -rn imagenesPendientes tests` tiene que quedar vacío).

- [ ] **Step 4: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-estado.test.ts tests/taller-acciones.test.ts tests/taller-formulario.test.tsx tests/taller-pantallas.test.ts && npx tsc --noEmit && grep -rn imagenesPendientes lib components app tests`
Expected: PASS, y el `grep` sin salida. Después, `npm run test:base -- tests/base/taller-examenes.test.ts` en verde.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/taller/estado.ts components/taller/estado-de-la-tarea.tsx tests/taller-estado.test.ts tests/taller-acciones.test.ts tests/taller-formulario.test.tsx tests/taller-pantallas.test.ts tests/base/taller-examenes.test.ts
git commit -F - <<'EOF'
Una foto o una pista que faltan dejan la tarea a medias

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Publicar, retirar, y un examen publicado no se escribe (servidor y acciones)

**Files:**
- Create: `lib/taller/publicado.ts`
- Modify: `lib/examen/publicar.ts`
- Modify: `lib/taller/examenes.ts` (`guardarTarea`, lecturas, `publicarExamen`, `retirarExamen`)
- Modify: `lib/taller/paginas.ts`, `lib/taller/cuadernillos.ts`, `lib/taller/ia/rellenar.ts`
- Modify: `app/examenes/acciones.ts`
- Test: `tests/publicar.test.ts`, `tests/base/taller-publicar.test.ts` (nuevo), `tests/base/taller-paginas.test.ts`, `tests/taller-acciones.test.ts`

**Interfaces:**
- Consumes: `EstadoDeTarea` sin `imagenesPendientes` (Task 4), `huecosDeImagen` (Task 1), `itemsDelFormulario` (ya en `lib/taller/estado.ts`)
- Produces:
  - `MENSAJE_PUBLICADO: string`, `class ExamenPublicado extends Error`, `bloquearExamen(tx: Prisma.TransactionClient, examenId: string): Promise<EstadoExamen | null>` en `lib/taller/publicado.ts`
  - `motivosParaPublicar(nivel: Nivel, tareas: TareaConEstado[]): string[]` y `type TareaConEstado = TareaParaRevisar & { completa: boolean }` en `lib/examen/publicar.ts`
  - `publicarExamen(examenId: string): Promise<{ error?: string }>`, `retirarExamen(examenId: string): Promise<{ error?: string }>` en `lib/taller/examenes.ts`
  - `ExamenDelTaller` gana `estado: EstadoExamen` y `motivosParaPublicar: string[]`; `TareaDelTaller` gana `publicado: boolean`
  - `borrarPaginas(examenId): Promise<{ error?: string }>`; `borrarPaginasAccion` devuelve `Promise<{ error?: string }>`
  - `publicarExamenAccion(examenId: string): Promise<void>` y `retirarExamenAccion(examenId: string): Promise<void>`, que redirigen a la pantalla del examen (con `?error=` si falla)

- [ ] **Step 1: Escribir las pruebas que fallan (lógica pura)**

Añadir a `tests/publicar.test.ts` (importar `motivosParaPublicar` junto a lo que ya importa):
```ts
describe("motivos para publicar desde el taller", () => {
  const todas = () =>
    [["CE", [6, 6, 6, 7]], ["CO", [7, 6, 6, 6]], ["EE", [0, 0]], ["EO", [0, 0, 0, 0]]].flatMap(([prueba, items]) =>
      (items as number[]).map((n, i) => ({ prueba: prueba as "CE" | "CO" | "EE" | "EO", numero: i + 1, items: n, completa: true })),
    );

  // Mutación que la mata: no mirar `completa`.
  it("una tarea a medias se nombra y no deja publicar", () => {
    const tareas = todas();
    tareas.find((t) => t.prueba === "CO" && t.numero === 1)!.completa = false;
    tareas.find((t) => t.prueba === "EO" && t.numero === 1)!.completa = false;
    expect(motivosParaPublicar("A2_B1_ESCOLAR", tareas)).toEqual(["Faltan por completar: CO1, EO1."]);
  });

  // Mutación que la mata: devolver [] sin llamar a motivosParaNoPublicar cuando están todas completas.
  it("con las 14 completas, manda la estructura", () => {
    expect(motivosParaPublicar("A2_B1_ESCOLAR", todas())).toEqual([]);
    const tareas = todas();
    tareas[0].items = 5;
    expect(motivosParaPublicar("A2_B1_ESCOLAR", tareas)).toEqual(["La tarea 1 de comprensión de lectura tiene que llevar 6 ítems y lleva 5."]);
  });
});
```
Las abiertas llevan `items: 0` y la regla tiene `items: null`, así que `motivosParaNoPublicar` no las mira: comprobar que la prueba de arriba pasa así. Si no, poner `items` a lo que devuelva `itemsDelFormulario` de una abierta (`[]`, es decir 0).

- [ ] **Step 2: Escribir las pruebas que fallan (contra la base)**

Crear `tests/base/taller-publicar.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const { borrarDeVercel } = vi.hoisted(() => ({ borrarDeVercel: vi.fn() }));
vi.mock("@/lib/ficheros/vercel", async (original) => ({
  ...(await original<typeof import("@/lib/ficheros/vercel")>()),
  borrarDeVercel,
}));

import { prisma } from "@/lib/db";
import { ESTRUCTURAS, PRUEBAS, letrasHasta, reglaDe } from "@/lib/dele/estructura";
import { formularioVacio, type Formulario } from "@/lib/taller/formas";
import { huecosDeImagen } from "@/lib/taller/medios";
import { crearExamen, examenParaElTaller, guardarTarea, publicarExamen, retirarExamen, tareaParaElTaller } from "@/lib/taller/examenes";
import { borrarPaginas, etiquetarPagina, registrarPaginas, sustituirPaginas } from "@/lib/taller/paginas";
import { elegirCuadernillo } from "@/lib/taller/cuadernillos";
import { rellenarTarea } from "@/lib/taller/ia/rellenar";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";

const ESCOLAR = ESTRUCTURAS.A2_B1_ESCOLAR!;

beforeEach(async () => {
  await prisma.paginaDeExamen.deleteMany();
  await prisma.examen.deleteMany();
  await prisma.cuadernillo.deleteMany();
  await prisma.fichero.deleteMany();
});

function fichero(tipoMime: string) {
  return prisma.fichero.create({ data: { almacen: "VERCEL", ruta: `material/${Math.random().toString(36).slice(2)}`, tipoMime, bytes: 1 } });
}

/** Letras inventadas (el repo es público): en relacionar, una distinta por ítem; en las demás, A. */
function solucionesInventadas() {
  const deUna = (prueba: "CE" | "CO") =>
    Object.fromEntries(
      ESCOLAR[prueba].flatMap((r) =>
        Array.from({ length: r.items ?? 0 }, (_, i) => [String(r.primero! + i), r.forma === "RELACIONAR" ? letrasHasta(r.letras)[i] : "A"]),
      ),
    );
  return { "1": { CE: deUna("CE"), CO: deUna("CO") } };
}

function llenar(f: Formulario, fotoId: string, pistaId: string, trozos: number | undefined): Formulario {
  const rellenar = (x: unknown, clave = ""): unknown => {
    if (typeof x === "string") return x === "" && clave !== "letra" ? "algo" : x;
    if (Array.isArray(x)) return x.map((v) => rellenar(v));
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "medios" ? v : rellenar(v, k)]));
    return x;
  };
  const lleno = rellenar(f) as Formulario;
  if (lleno.forma === "RELACIONAR") lleno.actividad.ejemplo.letra = "J";
  if ((lleno.forma === "LISTA_COMUN" || lleno.forma === "OPCIONES") && lleno.actividad.ejemplo) lleno.actividad.ejemplo.letra = "B";
  if (lleno.forma === "HUECOS") lleno.actividad.texto = lleno.actividad.huecos.map((h) => `palabra [${h.numero}]`).join(" ");
  lleno.medios = {
    imagenes: Object.fromEntries(huecosDeImagen(lleno).map((h) => [h.clave, fotoId])),
    audio: trozos ? { fichero: pistaId, cortes: Array.from({ length: trozos - 1 }, (_, i) => (i + 1) * 10) } : null,
  };
  return lleno;
}

/** Un examen con las 14 tareas completas. */
async function examenCompleto(): Promise<string> {
  const cuadernillo = await prisma.cuadernillo.create({ data: { titulo: "Inventado", texto: "SOLUCIONES", soluciones: solucionesInventadas() } });
  const creado = await crearExamen({ titulo: "Examen inventado", nivel: "A2_B1_ESCOLAR" });
  if ("error" in creado) throw new Error(creado.error);
  await prisma.examen.update({ where: { id: creado.id }, data: { cuadernilloId: cuadernillo.id, numeroEnCuadernillo: 1 } });
  const [foto, pista] = [await fichero("image/jpeg"), await fichero("audio/mpeg")];
  for (const prueba of PRUEBAS) {
    for (const r of ESCOLAR[prueba]) {
      const g = await guardarTarea(creado.id, prueba, r.numero, llenar(formularioVacio(r), foto.id, pista.id, r.trozos));
      if ("error" in g) throw new Error(`${prueba}${r.numero}: ${g.error}`);
      if (g.estado.estado !== "COMPLETA") throw new Error(`${prueba}${r.numero}: ${g.estado.motivos.join(" ")}`);
    }
  }
  return creado.id;
}

const estadoDe = async (id: string) => (await prisma.examen.findUniqueOrThrow({ where: { id } })).estado;

describe("publicar y retirar", () => {
  // Mutación que la mata: en publicarExamen, no llamar a motivosParaPublicar.
  it("con una tarea a medias no publica y dice cuál", async () => {
    const id = await examenCompleto();
    const co1 = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    await guardarTarea(id, "CO", 1, co1);
    const r = await publicarExamen(id);
    expect(r.error).toContain("Faltan por completar: CO1.");
    expect(await estadoDe(id)).toBe("EN_CONSTRUCCION");
    expect((await examenParaElTaller(id))!.motivosParaPublicar).toEqual(["Faltan por completar: CO1."]);
  });

  // Mutación que la mata: en retirarExamen, no filtrar por estado PUBLICADO.
  it("completo se publica; retirar lo devuelve a construcción, y retirar dos veces falla", async () => {
    const id = await examenCompleto();
    expect((await examenParaElTaller(id))!.motivosParaPublicar).toEqual([]);
    expect(await publicarExamen(id)).toEqual({});
    expect(await estadoDe(id)).toBe("PUBLICADO");
    expect((await tareaParaElTaller(id, "CE", 1))!.publicado).toBe(true);
    expect(await retirarExamen(id)).toEqual({});
    expect(await estadoDe(id)).toBe("EN_CONSTRUCCION");
    expect(await retirarExamen(id)).toEqual({ error: "Ese examen no está publicado." });
  });
});

describe("un examen publicado no se escribe", () => {
  async function publicado() {
    const id = await examenCompleto();
    const r = await publicarExamen(id);
    if (r.error) throw new Error(r.error);
    return id;
  }

  // Mutación que la mata: quitar la comprobación de bloquearExamen en guardarTarea.
  it("guardar una tarea se rechaza y no toca las piezas", async () => {
    const id = await publicado();
    const antes = await prisma.pieza.findMany({ orderBy: { id: "asc" } });
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CE", 3)!);
    expect(await guardarTarea(id, "CE", 3, f)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await prisma.pieza.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
  });

  // Mutación que la mata: quitar la comprobación en cualquiera de las cinco funciones.
  it("páginas y cuadernillo se rechazan", async () => {
    const id = await publicado();
    const hoja = await fichero("image/jpeg");
    expect(await registrarPaginas(id, [hoja.id])).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await sustituirPaginas(id, [hoja.id])).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await borrarPaginas(id)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await elegirCuadernillo(id, null, null)).toEqual({ error: MENSAJE_PUBLICADO });
    expect(await prisma.paginaDeExamen.count()).toBe(0);
    expect((await prisma.examen.findUniqueOrThrow({ where: { id } })).cuadernilloId).not.toBeNull();
  });

  it("etiquetar una página se rechaza", async () => {
    const id = await examenCompleto();
    const hoja = await fichero("image/jpeg");
    const pagina = await prisma.paginaDeExamen.create({ data: { examenId: id, ficheroId: hoja.id, orden: 1 } });
    await publicarExamen(id);
    expect(await etiquetarPagina(id, pagina.id, ["CE-1"])).toEqual({ error: MENSAJE_PUBLICADO });
    expect((await prisma.paginaDeExamen.findUniqueOrThrow({ where: { id: pagina.id } })).etiquetas).toEqual([]);
  });

  // Mutación que la mata: en rellenarTarea, mirar el estado después de llamar a la IA (se paga una llamada inútil).
  it("rellenar con IA se rechaza sin llamar a la IA", async () => {
    const id = await publicado();
    const leer = vi.fn();
    const r = await rellenarTarea(id, "CE", 3, { leer, descargar: vi.fn(), hayClave: () => true, reloj: () => 0, apuntar: vi.fn() });
    expect(r).toEqual({ error: MENSAJE_PUBLICADO });
    expect(leer).not.toHaveBeenCalled();
  });
});
```

En `tests/base/taller-paginas.test.ts`, donde se espere que `borrarPaginas` no devuelva nada, pasar a `expect(await borrarPaginas(id)).toEqual({})`.

- [ ] **Step 3: Correrlas y ver que fallan**

Run: `npx vitest run tests/publicar.test.ts` y `npm run test:base -- tests/base/taller-publicar.test.ts`
Expected: FAIL (no existen `motivosParaPublicar`, `publicarExamen`, `retirarExamen` ni `lib/taller/publicado`).

- [ ] **Step 4: `lib/taller/publicado.ts`**

```ts
import type { EstadoExamen, Prisma } from "@/lib/generated/prisma";

export const MENSAJE_PUBLICADO = "El examen está publicado: retíralo para editarlo.";

/** Se lanza dentro de una transacción para deshacerla; quien la abrió la traduce a MENSAJE_PUBLICADO. */
export class ExamenPublicado extends Error {
  constructor() {
    super(MENSAJE_PUBLICADO);
  }
}

/**
 * Bloquea la fila del Examen hasta el final de la transacción y dice en qué
 * estado está (null si no existe). Publicar bloquea la misma fila: así una
 * escritura y una publicación a la vez se ordenan, y ninguna escritura entra
 * en un examen que acaba de publicarse.
 */
export async function bloquearExamen(tx: Prisma.TransactionClient, examenId: string): Promise<EstadoExamen | null> {
  const filas = await tx.$queryRaw<{ estado: EstadoExamen }[]>`SELECT estado FROM "Examen" WHERE id = ${examenId} FOR UPDATE`;
  return filas[0]?.estado ?? null;
}

/** Para las escrituras: bloquea y, si está publicado, deshace la transacción. */
export async function exigirEditable(tx: Prisma.TransactionClient, examenId: string): Promise<void> {
  if ((await bloquearExamen(tx, examenId)) === "PUBLICADO") throw new ExamenPublicado();
}
```

- [ ] **Step 5: `motivosParaPublicar` en `lib/examen/publicar.ts`**

Añadir al final:
```ts
export type TareaConEstado = TareaParaRevisar & { completa: boolean };

/**
 * Lo que enseña el taller al lado de «Publicar». Primero las tareas a medias,
 * que es lo que el profesor tiene que ir a arreglar. La estructura solo se mira
 * con todas completas: una tarea sin guardar tiene 0 ítems y llenaría la
 * lista de avisos que no dicen nada nuevo.
 */
export function motivosParaPublicar(nivel: Nivel, tareas: TareaConEstado[]): string[] {
  const aMedias = tareas.filter((t) => !t.completa).map((t) => `${t.prueba}${t.numero}`);
  if (aMedias.length > 0) return [`Faltan por completar: ${aMedias.join(", ")}.`];
  return motivosParaNoPublicar(nivel, tareas);
}
```

- [ ] **Step 6: `lib/taller/examenes.ts`**

Imports:
```ts
import type { EstadoExamen, Nivel, Prisma, Prueba } from "@/lib/generated/prisma";
import { motivosParaPublicar, type TareaConEstado } from "@/lib/examen/publicar";
import { ExamenPublicado, MENSAJE_PUBLICADO, bloquearExamen, exigirEditable } from "./publicado";
```
y añadir `itemsDelFormulario` al import de `./estado`.

Añadir debajo de `leerTarea`:
```ts
type ExamenConTareas = {
  nivel: Nivel;
  numeroEnCuadernillo: number | null;
  cuadernillo: { soluciones: unknown } | null;
  tareas: (TareaConPiezas & { prueba: Prueba; numero: number })[];
};

/** Cada tarea del examen con su estado y sus ítems, en el orden de las pruebas. */
function tareasConEstado(examen: ExamenConTareas): (TareaConEstado & { estado: EstadoDeTarea })[] {
  return PRUEBAS.flatMap((prueba) =>
    examen.tareas
      .filter((t) => t.prueba === prueba)
      .sort((a, b) => a.numero - b.numero)
      .flatMap((t) => {
        const regla = reglaDe(examen.nivel, t.prueba, t.numero);
        if (!regla) return [];
        const { formulario, claveGuardada } = leerTarea(t);
        const estado = estadoDeTarea(regla, formulario, respuestasDe(examen, t.prueba), claveGuardada);
        return [{ prueba: t.prueba, numero: t.numero, estado, completa: estado.estado === "COMPLETA", items: formulario ? itemsDelFormulario(formulario).length : 0 }];
      }),
  );
}
```
En `ExamenDelTaller`, añadir `estado: EstadoExamen;` y `motivosParaPublicar: string[];`. En `examenParaElTaller`, sustituir el cálculo de `const tareas = PRUEBAS.flatMap(…);` por:
```ts
  const conEstado = tareasConEstado(examen);
  const tareas = conEstado.map(({ prueba, numero, estado }) => ({ prueba, numero, estado }));
```
y en el objeto devuelto añadir:
```ts
    estado: examen.estado,
    motivosParaPublicar: motivosParaPublicar(examen.nivel, conEstado),
```
En `TareaDelTaller`, añadir `publicado: boolean;`. En `tareaParaElTaller`, añadir `publicado: examen.estado === "PUBLICADO",` en el objeto devuelto.

En `guardarTarea`, sustituir el bloque `await prisma.$transaction(async (tx) => { … });` por:
```ts
  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      // Bloquea la fila de la Tarea para que dos guardados a la vez se
      // serialicen: si no, el borrado del segundo no encuentra nada que borrar
      // y sus creaciones chocan con las del primero (@@unique([tareaId, orden])).
      await tx.$queryRaw`SELECT id FROM "Tarea" WHERE id = ${tarea.id} FOR UPDATE`;
      await tx.pieza.deleteMany({ where: { tareaId: tarea.id } });
      for (const p of piezasDelFormulario(formulario)) {
        await tx.pieza.create({
          data: {
            tareaId: tarea.id,
            orden: p.orden,
            tipo: p.tipo,
            texto: p.texto,
            etiqueta: p.etiqueta,
            ficheroId: p.ficheroId,
            cortes: p.cortes,
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
  } catch (error) {
    if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };
    throw error;
  }
```
Al final del fichero:
```ts
/** Publica si las 14 tareas están completas y cuadran. Todo se recalcula con la fila del Examen bloqueada. */
export async function publicarExamen(examenId: string): Promise<{ error?: string }> {
  return prisma.$transaction(async (tx) => {
    const estado = await bloquearExamen(tx, examenId);
    if (estado === null) return { error: "Ese examen no existe." };
    if (estado === "PUBLICADO") return {};
    if (estado === "ARCHIVADO") return { error: "Un examen archivado no se publica." };
    const examen = await tx.examen.findUniqueOrThrow({ where: { id: examenId }, include: { cuadernillo: true, tareas: { include: CON_PIEZAS } } });
    const motivos = motivosParaPublicar(examen.nivel, tareasConEstado(examen));
    if (motivos.length > 0) return { error: `No se puede publicar: ${motivos.join(" ")}` };
    await tx.examen.update({ where: { id: examenId }, data: { estado: "PUBLICADO" } });
    return {};
  });
}

/** Devuelve un examen publicado a construcción. */
export async function retirarExamen(examenId: string): Promise<{ error?: string }> {
  const r = await prisma.examen.updateMany({ where: { id: examenId, estado: "PUBLICADO" }, data: { estado: "EN_CONSTRUCCION" } });
  return r.count === 1 ? {} : { error: "Ese examen no está publicado." };
}
```

- [ ] **Step 7: El candado en páginas, cuadernillo y rellenar**

En `lib/taller/paginas.ts`, importar `import { ExamenPublicado, MENSAJE_PUBLICADO, exigirEditable } from "./publicado";`. Luego:

1. **`registrarPaginas`**: sustituir el `try { await prisma.paginaDeExamen.createMany(…) } catch (error) { … }` por:
```ts
  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      await tx.paginaDeExamen.createMany({
        data: ficheroIds.map((ficheroId, i) => ({ examenId, ficheroId, orden: i + 1 })),
      });
    });
  } catch (error) {
    if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };
    // Dos subidas a la vez pueden pasar las dos la comprobación de arriba (ninguna ha
    // escrito todavía) y chocar aquí contra @@unique([examenId, orden]): la que pierde
    // la carrera recibe el mismo error que si hubiera llegado tarde.
    if (esClaveDuplicada(error)) return { error: "Este examen ya tiene páginas. Bórralas antes de subir otras." };
    throw error;
  }
```
2. **`etiquetarPagina`**: sustituir el `await prisma.paginaDeExamen.update(…)` por:
```ts
  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      await tx.paginaDeExamen.update({
        where: { id: paginaId },
        data: { etiquetas: validas.filter((v) => etiquetas.includes(v)) },
      });
    });
  } catch (error) {
    if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };
    throw error;
  }
```
3. **`borrarPaginas`**:
```ts
export async function borrarPaginas(examenId: string): Promise<{ error?: string }> {
  let paginas: { fichero: { id: string; ruta: string } }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      paginas = await tx.paginaDeExamen.findMany({ where: { examenId }, include: { fichero: true } });
      await tx.paginaDeExamen.deleteMany({ where: { examenId } });
    });
  } catch (error) {
    if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };
    throw error;
  }
  await limpiarSiHuerfanos(paginas.map((p) => p.fichero), new Set());
  return {};
}
```
4. **`sustituirPaginas`**: dentro de su transacción, sustituir `await tx.$queryRaw\`SELECT id FROM "Examen" WHERE id = ${examenId} FOR UPDATE\`;` por `await exigirEditable(tx, examenId);`, y en su `catch` añadir como primera línea `if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };`. En el comentario de la función, cambiar «El bloqueo de fila (`FOR UPDATE` sobre el Examen)» por «El bloqueo de fila (`exigirEditable`, que es `FOR UPDATE` sobre el Examen)».

En `lib/taller/cuadernillos.ts`, importar `import { ExamenPublicado, MENSAJE_PUBLICADO, exigirEditable } from "./publicado";`. En `elegirCuadernillo`, cada `await prisma.examen.update({ where: { id: examenId }, data: … })` pasa a hacerse con este ayudante local:
```ts
async function escribirEnExamen(examenId: string, data: { cuadernilloId: string | null; numeroEnCuadernillo: number | null }): Promise<{ error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      await exigirEditable(tx, examenId);
      await tx.examen.update({ where: { id: examenId }, data });
    });
    return {};
  } catch (error) {
    if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO };
    throw error;
  }
}
```
es decir:
- `return escribirEnExamen(examenId, { cuadernilloId: null, numeroEnCuadernillo: null });` en la rama de null;
- `return escribirEnExamen(examenId, { cuadernilloId, numeroEnCuadernillo: numero });` al final.

En `lib/taller/ia/rellenar.ts`, importar `import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";` y, justo después de `if (!examen || !regla) return { error: "Esa tarea no existe." };`:
```ts
  if (examen.estado === "PUBLICADO") return { error: MENSAJE_PUBLICADO };
```

- [ ] **Step 8: Acciones**

En `app/examenes/acciones.ts`, cambiar el import de examenes por `import { crearExamen, guardarTarea, publicarExamen, retirarExamen } from "@/lib/taller/examenes";`. Sustituir `borrarPaginasAccion` por:
```ts
export async function borrarPaginasAccion(examenId: string): Promise<{ error?: string }> {
  await exigirProfesor();
  const r = await borrarPaginas(examenId);
  revalidatePath(pantallaDelExamen(examenId));
  return r;
}
```
y añadir al final:
```ts
async function volverAlExamen(examenId: string, r: { error?: string }): Promise<never> {
  revalidatePath(pantallaDelExamen(examenId));
  if (r.error) redirect(`${pantallaDelExamen(examenId)}?error=${encodeURIComponent(r.error)}`);
  redirect(pantallaDelExamen(examenId));
}

export async function publicarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await publicarExamen(examenId));
}

export async function retirarExamenAccion(examenId: string): Promise<void> {
  await exigirProfesor();
  await volverAlExamen(examenId, await retirarExamen(examenId));
}
```

En `tests/taller-acciones.test.ts`:
- Añadir `publicarExamen: vi.fn(),` y `retirarExamen: vi.fn(),` a `dobles`.
- Cambiar el doble de `@/lib/taller/examenes` a `({ crearExamen: dobles.crearExamen, guardarTarea: dobles.guardarTarea, publicarExamen: dobles.publicarExamen, retirarExamen: dobles.retirarExamen })`.
- Importar las dos acciones.
- Añadir a `ACCIONES`:
```ts
  { nombre: "publicarExamenAccion", llamar: () => publicarExamenAccion("x1"), tocan: [dobles.publicarExamen] },
  { nombre: "retirarExamenAccion", llamar: () => retirarExamenAccion("x1"), tocan: [dobles.retirarExamen] },
```
- Añadir dentro de «lo que hace cada acción con el profesor»:
```ts
  // Mutación que la mata: redirigir siempre a la pantalla sin el ?error=.
  it("publicar vuelve al examen, con el motivo si no se pudo", async () => {
    dobles.publicarExamen.mockResolvedValue({});
    expect(await mensajeDelRechazo(publicarExamenAccion("x1"))).toBe("REDIRECT:/examenes/x1");
    dobles.publicarExamen.mockResolvedValue({ error: "No se puede publicar: Faltan por completar: CO1." });
    expect(await mensajeDelRechazo(publicarExamenAccion("x1"))).toBe(
      `REDIRECT:/examenes/x1?error=${encodeURIComponent("No se puede publicar: Faltan por completar: CO1.")}`,
    );
  });
```

- [ ] **Step 9: Correr las pruebas y ver verde**

Run: `npx vitest run tests/publicar.test.ts tests/taller-acciones.test.ts && npm run test:base -- tests/base/taller-publicar.test.ts tests/base/taller-paginas.test.ts tests/base/taller-examenes.test.ts tests/base/taller-cuadernillos.test.ts tests/base/taller-ia-rellenar.test.ts && npx tsc --noEmit`
Expected: PASS. **Aplicar a mano** la mutación de `guardarTarea` (comentar `await exigirEditable(tx, examenId);`), ver rojo «guardar una tarea se rechaza» y deshacer.

- [ ] **Step 10: Commit**

```bash
git branch --show-current
git add lib/taller/publicado.ts lib/examen/publicar.ts lib/taller/examenes.ts lib/taller/paginas.ts lib/taller/cuadernillos.ts lib/taller/ia/rellenar.ts app/examenes/acciones.ts tests/publicar.test.ts tests/base/taller-publicar.test.ts tests/base/taller-paginas.test.ts tests/taller-acciones.test.ts
git commit -F - <<'EOF'
Publicar y retirar un examen, y un examen publicado no se escribe

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Los cálculos de la onda, sin pantalla

**Files:**
- Create: `lib/taller/onda.ts`
- Test: `tests/taller-onda.test.ts` (nuevo)

**Interfaces:**
- Consumes: `SEPARACION_MINIMA`, `cortesEnOrden` (Task 1)
- Produces:
  - `type Silencio = { inicio: number; fin: number }` (segundos)
  - `picos(muestras: Float32Array, cubos: number): number[]` (0..1)
  - `silencios(muestras: Float32Array, frecuencia: number): Silencio[]`
  - `proponerCortes(lista: Silencio[], trozos: number, duracion: number): number[]`
  - `ajustarMarca(t: number, otras: readonly number[], duracion: number): number | null`
  - `trozosDe(cortes: readonly number[], duracion: number): [number, number][]`
  - `formatearTiempo(segundos: number): string` («1:42»)
  - `leerCortesEscritos(texto: string): number[] | null`

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/taller-onda.test.ts
import { describe, it, expect } from "vitest";
import { ajustarMarca, formatearTiempo, leerCortesEscritos, picos, proponerCortes, silencios, trozosDe } from "@/lib/taller/onda";

const HZ = 100;
/** Una señal sintética a 100 muestras por segundo: tramos de [segundos, suena]. */
function senal(tramos: [number, boolean][]): Float32Array {
  const valores: number[] = [];
  for (const [s, suena] of tramos) for (let i = 0; i < Math.round(s * HZ); i++) valores.push(suena ? (i % 2 ? 0.5 : -0.5) : 0);
  return Float32Array.from(valores);
}

// Tres trozos, cada uno oído dos veces: 2 s de silencio entre audiciones y 4 s entre trozos,
// como en las pistas del libro. Duración: 50 s.
const TRES_DOS_VECES: [number, boolean][] = [
  [4, true], [2, false], [5, true], [2, false], [5, true], [4, false],
  [5, true], [2, false], [5, true], [4, false], [5, true], [2, false], [5, true],
];

describe("silencios", () => {
  // Mutación que la mata: contar como silencio un tramo de menos de 1,5 s.
  it("encuentra los tramos de al menos 1,5 s y no los más cortos", () => {
    const s = silencios(senal([[3, true], [1, false], [3, true], [2, false], [3, true]]), HZ);
    expect(s).toEqual([{ inicio: 7, fin: 9 }]);
  });

  it("en la señal de tres trozos oídos dos veces hay seis silencios", () => {
    expect(silencios(senal(TRES_DOS_VECES), HZ).map((x) => x.fin)).toEqual([6, 13, 22, 29, 38, 45]);
  });

  // Mutación que la mata: umbral fijo en vez de relativo a la ventana más fuerte.
  it("el umbral es el 2 % de lo más fuerte: una pista flojita también tiene silencios", () => {
    const floja = senal([[3, true], [2, false], [3, true]]).map((v) => v / 100);
    expect(silencios(floja, HZ)).toEqual([{ inicio: 3, fin: 5 }]);
  });

  it("una pista muda no tiene silencios que proponer", () => {
    expect(silencios(new Float32Array(1000), HZ)).toEqual([]);
  });
});

describe("proponer marcas", () => {
  // Mutación que la mata: quedarse con los primeros silencios en vez de con los más largos.
  it("se queda con los silencios entre trozos, no con los de entre audiciones", () => {
    expect(proponerCortes(silencios(senal(TRES_DOS_VECES), HZ), 3, 50)).toEqual([22, 38]);
  });

  // Mutación que la mata: devolver [] si no hay candidatos de sobra.
  it("con menos candidatos que marcas, propone los que hay, en orden", () => {
    expect(proponerCortes(silencios(senal(TRES_DOS_VECES), HZ), 10, 50)).toEqual([6, 13, 22, 29, 38, 45]);
  });

  // Mutación que la mata: quitar el filtro de los 3 primeros segundos.
  it("nada en los 3 primeros segundos, y nada si la tarea no se corta", () => {
    const s = [{ inicio: 0.5, fin: 2.5 }, { inicio: 10, fin: 20 }];
    expect(proponerCortes(s, 2, 60)).toEqual([20]);
    expect(proponerCortes(s, 1, 60)).toEqual([]);
  });
});

describe("marcas y trozos", () => {
  // Mutación que la mata: no apartar la marca de la vecina.
  it("una marca no queda a menos de 0,3 s de otra ni de los extremos", () => {
    expect(ajustarMarca(10.1, [10], 60)).toBe(10.3);
    expect(ajustarMarca(9.9, [10], 60)).toBe(9.7);
    expect(ajustarMarca(0.1, [], 60)).toBe(0.3);
    expect(ajustarMarca(59.9, [], 60)).toBe(59.7);
    expect(ajustarMarca(10, [9.8, 10.2], 60)).toBeNull();
  });

  // Mutación que la mata: olvidar el último trozo (de la última marca al final).
  it("los trozos cubren la pista de 0 al final sin huecos", () => {
    expect(trozosDe([22, 38], 50)).toEqual([[0, 22], [22, 38], [38, 50]]);
    expect(trozosDe([], 50)).toEqual([[0, 50]]);
  });

  it("el tiempo se escribe en minutos y segundos", () => {
    expect(formatearTiempo(102.4)).toBe("1:42");
    expect(formatearTiempo(5)).toBe("0:05");
  });

  // Mutación que la mata: aceptar marcas desordenadas escritas a mano.
  it("las marcas escritas a mano se leen en segundos o en m:ss, y lo que no vale da null", () => {
    expect(leerCortesEscritos("22, 38.5")).toEqual([22, 38.5]);
    expect(leerCortesEscritos("0:22, 1:05")).toEqual([22, 65]);
    expect(leerCortesEscritos("")).toEqual([]);
    expect(leerCortesEscritos("38, 22")).toBeNull();
    expect(leerCortesEscritos("veinte")).toBeNull();
  });
});

describe("picos", () => {
  // Mutación que la mata: no normalizar al pico más alto.
  it("un pico por cubo, normalizado a 1", () => {
    expect(picos(Float32Array.from([0.1, -0.2, 0.4, 0]), 2)).toEqual([0.5, 1]);
    expect(picos(new Float32Array(0), 10)).toEqual([]);
  });
});
```
En la prueba de picos, `0.2 / 0.4` en coma flotante de 32 bits puede no dar 0.5 exacto: si falla solo por eso, comparar con `toBeCloseTo` elemento a elemento.

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-onda.test.ts`
Expected: FAIL (no existe `lib/taller/onda`).

- [ ] **Step 3: Implementar `lib/taller/onda.ts`**

```ts
import { SEPARACION_MINIMA, cortesEnOrden } from "./medios";

/** Tramos que se miden de golpe: 100 ms. */
const VENTANA = 0.1;
/** Silencio = ventana por debajo del 2 % de la ventana más fuerte de la pista. */
const UMBRAL = 0.02;
/** Un silencio cuenta si dura al menos esto. */
const SILENCIO_MINIMO = 1.5;
/** Las instrucciones del principio no se cortan. */
const SIN_MARCAS_AL_EMPEZAR = 3;
const EPSILON = 1e-9;

export type Silencio = { inicio: number; fin: number };

const centesimas = (x: number) => Math.round(x * 100) / 100;

/** El pico de cada cubo, normalizado de 0 a 1: lo que se dibuja. */
export function picos(muestras: Float32Array, cubos: number): number[] {
  if (muestras.length === 0 || cubos <= 0) return [];
  const tam = muestras.length / cubos;
  const salida: number[] = [];
  let maximo = 0;
  for (let c = 0; c < cubos; c++) {
    const desde = Math.floor(c * tam);
    const hasta = Math.min(muestras.length, Math.max(desde + 1, Math.floor((c + 1) * tam)));
    let pico = 0;
    for (let i = desde; i < hasta; i++) pico = Math.max(pico, Math.abs(muestras[i]));
    salida.push(pico);
    maximo = Math.max(maximo, pico);
  }
  return maximo === 0 ? salida : salida.map((p) => p / maximo);
}

/** Los tramos callados de al menos 1,5 s, en segundos. Viene del sitio viejo (components/taller/onda.tsx). */
export function silencios(muestras: Float32Array, frecuencia: number): Silencio[] {
  const tam = Math.max(1, Math.round(frecuencia * VENTANA));
  const ventanas = Math.floor(muestras.length / tam);
  const rms: number[] = [];
  for (let v = 0; v < ventanas; v++) {
    let suma = 0;
    for (let i = v * tam; i < (v + 1) * tam; i++) suma += muestras[i] * muestras[i];
    rms.push(Math.sqrt(suma / tam));
  }
  const maximo = Math.max(0, ...rms);
  if (maximo === 0) return [];
  const umbral = maximo * UMBRAL;
  const salida: Silencio[] = [];
  let empieza = -1;
  for (let v = 0; v <= ventanas; v++) {
    const callada = v < ventanas && rms[v] <= umbral;
    if (callada && empieza < 0) empieza = v;
    if (!callada && empieza >= 0) {
      if ((v - empieza) * VENTANA >= SILENCIO_MINIMO - EPSILON) {
        salida.push({ inicio: centesimas((empieza * tam) / frecuencia), fin: centesimas((v * tam) / frecuencia) });
      }
      empieza = -1;
    }
  }
  return salida;
}

/**
 * Las `trozos − 1` marcas: donde vuelve el sonido tras los silencios MÁS LARGOS.
 * Entre las dos audiciones de un trozo también hay silencio, más corto que el que
 * separa un trozo del siguiente. Es una ayuda: el profesor la corrige.
 */
export function proponerCortes(lista: Silencio[], trozos: number, duracion: number): number[] {
  if (trozos <= 1) return [];
  return lista
    .filter((s) => s.fin > SIN_MARCAS_AL_EMPEZAR && s.fin < duracion - SEPARACION_MINIMA)
    .sort((a, b) => b.fin - b.inicio - (a.fin - a.inicio) || a.fin - b.fin)
    .slice(0, trozos - 1)
    .map((s) => centesimas(s.fin))
    .sort((a, b) => a - b);
}

/** Dónde queda una marca que se suelta en `t`: lejos de los extremos y de las demás. null si no cabe. */
export function ajustarMarca(t: number, otras: readonly number[], duracion: number): number | null {
  let x = Math.min(Math.max(t, SEPARACION_MINIMA), duracion - SEPARACION_MINIMA);
  for (const o of [...otras].sort((a, b) => a - b)) {
    if (Math.abs(x - o) < SEPARACION_MINIMA - EPSILON) x = x < o ? o - SEPARACION_MINIMA : o + SEPARACION_MINIMA;
  }
  x = centesimas(x);
  const cabe =
    x >= SEPARACION_MINIMA - EPSILON &&
    x <= duracion - SEPARACION_MINIMA + EPSILON &&
    otras.every((o) => Math.abs(x - o) >= SEPARACION_MINIMA - EPSILON);
  return cabe ? x : null;
}

/** [inicio, fin] de cada trozo, de 0 a la duración. */
export function trozosDe(cortes: readonly number[], duracion: number): [number, number][] {
  const bordes = [0, ...cortes, duracion];
  return bordes.slice(0, -1).map((inicio, i) => [inicio, bordes[i + 1]]);
}

export function formatearTiempo(segundos: number): string {
  const total = Math.floor(segundos);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** El campo a mano: segundos («38.5») o minutos y segundos («1:05»), separados por comas. */
export function leerCortesEscritos(texto: string): number[] | null {
  const partes = texto.split(",").map((p) => p.trim()).filter((p) => p !== "");
  const cortes: number[] = [];
  for (const p of partes) {
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(p);
    if (!m) return null;
    cortes.push(centesimas(Number(m[1] ?? 0) * 60 + Number(m[2])));
  }
  return cortesEnOrden(cortes) ? cortes : null;
}
```

- [ ] **Step 4: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-onda.test.ts && npx tsc --noEmit`
Expected: PASS. **Aplicar a mano** la mutación de `proponerCortes` (quitar el primer `.sort`), ver rojo «se queda con los silencios entre trozos» y deshacer.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add lib/taller/onda.ts tests/taller-onda.test.ts
git commit -F - <<'EOF'
Calculos de la onda: picos, silencios, marcas propuestas y trozos

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Las fotos en pantalla, la IA que respeta los medios, y la tarea de solo lectura

**Files:**
- Create: `lib/taller/medios-en-navegador.ts`
- Create: `components/taller/foto-de-opcion.tsx`
- Modify: `components/taller/formas-cerradas.tsx` (`Opciones`, `FormaOpciones`)
- Modify: `components/taller/formas-abiertas.tsx` (`FormaOralSolo`)
- Modify: `components/taller/formulario-de-tarea.tsx`
- Modify: `app/examenes/[id]/[prueba]/[numero]/page.tsx`
- Test: `tests/taller-formulario.test.tsx`, `tests/taller-pantallas.test.ts` (doble de `tareaParaElTaller`)

**Interfaces:**
- Consumes: `Medios` (Task 1), `conMediosDe` (Task 1), `TareaDelTaller.publicado` (Task 5), `MENSAJE_PUBLICADO` (Task 5), `subirAlAlmacen` (ya existe)
- Produces:
  - `reducirFoto(fichero: File): Promise<File>`
  - `muestrasDeAudio(datos: ArrayBuffer): Promise<{ muestras: Float32Array; frecuencia: number; duracion: number }>`
  - `FRECUENCIA_DE_ONDA = 8000`
  - `<FotoDeOpcion clave etiqueta ficheroId alCambiar />`
  - `FormularioDeTarea` gana la prop `publicado: boolean` y pasa `cambiarAudio: (audio: Medios["audio"]) => void` a la Task 8

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/taller-formulario.test.tsx`:
- Quitar `imagenesPendientes` de `VACIA` si quedara.
- Añadir un séptimo parámetro a `pintar`, `extra: { inicial?: Formulario; publicado?: boolean } = {}`, usar `inicial={extra.inicial ?? formularioVacio(regla)}` y pasar `publicado={extra.publicado ?? false}`.
- Importar `type Formulario` de `@/lib/taller/formas`.

Añadir:
```ts
describe("fotos y solo lectura", () => {
  // Mutación que la mata: dejar el texto «se sube en la Entrega 3» en Opciones.
  it("Auditiva 1 enseña un hueco de foto por cada opción con imagen, y ningún aviso viejo", () => {
    const html = pintar("CO", 1, null);
    expect(html.match(/data-foto="/g)).toHaveLength(15);
    expect(html).toContain('data-foto="ejemplo-A"');
    expect(html).toContain('data-foto="4-C"');
    expect(html).toContain("Subir foto");
    expect(html).not.toContain("Entrega 3");
  });

  // Mutación que la mata: en FotoDeOpcion, no pintar la miniatura cuando hay ficheroId.
  it("una foto ya subida se ve desde el almacén", () => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", 1)!);
    f.medios.imagenes["ejemplo-A"] = "f1";
    const html = pintar("CO", 1, null, null, true, true, { inicial: f });
    expect(html).toContain('src="/api/ficheros/f1"');
    expect(html.match(/Subir foto/g)).toHaveLength(14);
  });

  // Mutación que la mata: en FormaOralSolo, dejar «Foto: se sube en la Entrega 3».
  it("Oral 1 tiene una foto por opción; Oral 3, ninguna", () => {
    expect(pintar("EO", 1, null)).toContain('data-foto="opcion-2"');
    expect(pintar("EO", 3, null)).not.toContain("data-foto=");
  });

  // Mutación que la mata: no pasar `publicado` al fieldset.
  it("con el examen publicado, aviso arriba y todo apagado", () => {
    const html = pintar("CE", 3, null, null, true, true, { publicado: true });
    expect(html).toContain("El examen está publicado: retíralo para editarlo.");
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Guardar<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Rellenar con IA<\/button>/);
  });
});
```
Si el orden de los atributos de `<button>` que pinta React no casa con la expresión, cambiarla por una que busque `disabled=""` dentro de la etiqueta de apertura del botón que acaba en `Guardar`. **No hay que quitar la comprobación.**

En `tests/taller-pantallas.test.ts`, añadir `publicado: false,` a cada `dobles.tareaParaElTaller.mockResolvedValue({ … })`.

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-formulario.test.tsx`
Expected: FAIL (no hay `data-foto`; la prop `publicado` no existe).

- [ ] **Step 3: `lib/taller/medios-en-navegador.ts`**

```ts
// Solo navegador: usa canvas y Web Audio. Nunca se importa desde el servidor.

const LADO_MAXIMO = 1600;
/** La onda no necesita más: 8.000 muestras por segundo en un canal. */
export const FRECUENCIA_DE_ONDA = 8000;

/** Una foto, a JPEG al 0,85 con el lado largo en 1600 px como mucho. */
export async function reducirFoto(fichero: File): Promise<File> {
  let mapa: ImageBitmap;
  try {
    mapa = await createImageBitmap(fichero);
  } catch {
    throw new Error("Este navegador no puede abrir esa foto. Pásala a JPG o PNG.");
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(mapa.width, mapa.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(mapa.width * escala);
  lienzo.height = Math.round(mapa.height * escala);
  lienzo.getContext("2d")!.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
  mapa.close();
  const blob = await new Promise<Blob>((listo, fallo) =>
    lienzo.toBlob((b) => (b ? listo(b) : fallo(new Error("No se pudo preparar la foto."))), "image/jpeg", 0.85),
  );
  return new File([blob], `${fichero.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
}

/**
 * La pista descodificada a un canal y 8.000 muestras por segundo: una de 11
 * minutos ocupa unos 45 MB y no los ~250 MB de descodificarla a 44,1 kHz.
 * decodeAudioData remuestrea a la frecuencia del contexto.
 */
export async function muestrasDeAudio(datos: ArrayBuffer): Promise<{ muestras: Float32Array; frecuencia: number; duracion: number }> {
  const contexto = new OfflineAudioContext(1, 1, FRECUENCIA_DE_ONDA);
  const pista = await contexto.decodeAudioData(datos);
  return { muestras: pista.getChannelData(0), frecuencia: pista.sampleRate, duracion: pista.duration };
}
```

- [ ] **Step 4: `components/taller/foto-de-opcion.tsx`**

```tsx
"use client";

import { useState } from "react";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";
import { reducirFoto } from "@/lib/taller/medios-en-navegador";

/** El hueco de la foto de una opción: subir, ver, cambiar o quitar. Sin foto se pinta en amarillo, como un campo que falta. */
export function FotoDeOpcion({
  clave,
  etiqueta,
  ficheroId,
  alCambiar,
}: {
  clave: string;
  etiqueta: string;
  ficheroId: string | null;
  alCambiar: (ficheroId: string | null) => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(fichero: File | undefined) {
    if (!fichero) return;
    setError(null);
    setSubiendo(true);
    try {
      alCambiar(await subirAlAlmacen(await reducirFoto(fichero)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  const selector = (texto: string) => (
    <label className="cursor-pointer self-start rounded-xl border border-tinta-suave/30 px-3 py-2">
      {subiendo ? "Subiendo…" : texto}
      <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => elegir(e.target.files?.[0])} />
    </label>
  );

  return (
    <div data-foto={clave} className={`flex min-w-0 flex-col gap-2 rounded-xl p-3 ${ficheroId ? "bg-hp-50" : "bg-sol-100"}`}>
      <span className="text-sm font-bold text-tinta-suave">{etiqueta}</span>
      {ficheroId ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos */}
          <img src={`/api/ficheros/${ficheroId}`} alt={etiqueta} className="max-h-48 w-auto max-w-full self-start rounded-lg" />
          <div className="flex flex-wrap gap-2">
            {selector("Cambiar")}
            <button type="button" onClick={() => alCambiar(null)} className="rounded-xl border border-tinta-suave/30 px-3 py-2">Quitar</button>
          </div>
        </>
      ) : (
        selector("Subir foto")
      )}
      {error && <span role="alert" className="text-error-600">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 5: Enchufar las fotos en las formas**

En `components/taller/formas-cerradas.tsx`, importar `import { FotoDeOpcion } from "./foto-de-opcion";` y sustituir `Opciones` por:
```tsx
type Fotos = { imagenes: Record<string, string>; cambiarImagen: (clave: string, ficheroId: string | null) => void };

function Opciones({ opciones, ruta, cambiar, fotos, claveDe }: { opciones: Opcion[]; ruta: (string | number)[]; cambiar: Cambiar; fotos?: Fotos; claveDe?: (letra: string) => string }) {
  return (
    <div className="flex flex-col gap-2">
      {opciones.map((o, i) =>
        o.conImagen && fotos && claveDe ? (
          <FotoDeOpcion
            key={o.letra}
            clave={claveDe(o.letra)}
            etiqueta={`Opción ${o.letra}`}
            ficheroId={fotos.imagenes[claveDe(o.letra)] ?? null}
            alCambiar={(id) => fotos.cambiarImagen(claveDe(o.letra), id)}
          />
        ) : (
          <Campo key={o.letra} etiqueta={`Opción ${o.letra}`} valor={o.texto} alCambiar={(v) => cambiar([...ruta, i, "texto"], v)} ruta={[...ruta, i, "texto"]} />
        ),
      )}
    </div>
  );
}
```
`FormaOpciones` recibe además `cambiarImagen: Fotos["cambiarImagen"]`. Dentro:
```tsx
  const fotos = { imagenes: f.medios.imagenes, cambiarImagen };
```
- En el ejemplo: `<Opciones opciones={a.ejemplo.opciones} ruta={["actividad", "ejemplo", "opciones"]} cambiar={cambiar} fotos={fotos} claveDe={(l) => `ejemplo-${l}`} />`.
- En cada pregunta: `<Opciones opciones={p.opciones} ruta={["actividad", "preguntas", i, "opciones"]} cambiar={cambiar} fotos={fotos} claveDe={(l) => `${p.numero}-${l}`} />`.

Las claves tienen que ser las de `huecosDeImagen` (Task 1).

En `components/taller/formas-abiertas.tsx`, importar `FotoDeOpcion`. `FormaOralSolo` recibe además `cambiarImagen: (clave: string, ficheroId: string | null) => void`. Sustituir la línea del aviso «Foto: se sube en la Entrega 3» por:
```tsx
          {o.conImagen && (
            <FotoDeOpcion
              clave={`opcion-${i + 1}`}
              etiqueta="Foto"
              ficheroId={f.medios.imagenes[`opcion-${i + 1}`] ?? null}
              alCambiar={(id) => cambiarImagen(`opcion-${i + 1}`, id)}
            />
          )}
```

- [ ] **Step 6: `components/taller/formulario-de-tarea.tsx`**

Imports:
```ts
import type { Medios } from "@/lib/taller/formas";
import { conMediosDe } from "@/lib/taller/medios";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
```
`lib/taller/publicado.ts` importa solo tipos de Prisma. Si al pintar en la prueba sale un error de `@/lib/db`, mover `MENSAJE_PUBLICADO` a `lib/taller/mensajes.ts` y reexportarlo desde `publicado.ts`.

Añadir `publicado: boolean;` a `Props` y a la desestructuración. Luego:
```ts
  const rellenoApagado = !hayClave || !hayHojas || rellenando || guardando || publicado;
```
Debajo de `cambiar`:
```ts
  // Con la función de setF y no con `f`: dos fotos que terminan de subir casi a la vez no se pisan.
  const cambiarImagen = (clave: string, ficheroId: string | null) => {
    setF((actual) => {
      const imagenes = { ...actual.medios.imagenes };
      if (ficheroId) imagenes[clave] = ficheroId;
      else delete imagenes[clave];
      return cambiarEn(actual, ["medios", "imagenes"], imagenes);
    });
    setSinGuardar(true);
  };
  const cambiarAudio = (audio: Medios["audio"]) => {
    setF((actual) => cambiarEn(actual, ["medios", "audio"], audio));
    setSinGuardar(true);
  };
```
En `rellenar`, cambiar `setF(r.formulario);` por:
```ts
          // La IA no ve las fotos ni la pista: se quedan las que hay en pantalla.
          setF((actual) => conMediosDe(r.formulario, actual));
```
Justo después de `<DudasContext.Provider value={mapaDeDudas}>`:
```tsx
        {publicado && <p role="status" className="rounded-2xl bg-sol-100 p-4 font-bold">{MENSAJE_PUBLICADO}</p>}
```
Luego:
- El `fieldset` pasa a `disabled={rellenando || publicado}`.
- El botón «Guardar» pasa a `disabled={guardando || rellenando || publicado}`.
- `FormaOpciones` recibe `cambiarImagen={cambiarImagen}`, y `FormaOralSolo` también.
- `cambiarAudio` no se usa todavía: la Task 8 lo enchufa. Para que lint no se queje, se añade en esta tarea con `void cambiarAudio;` debajo de su declaración, y la Task 8 quita esa línea.

En `app/examenes/[id]/[prueba]/[numero]/page.tsx`, pasar `publicado={tarea.publicado}` a `FormularioDeTarea`.

- [ ] **Step 7: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-formulario.test.tsx tests/taller-pantallas.test.ts tests/taller-ia-campo.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS, lint sin errores nuevos. Queda sin prueba automática (no hay jsdom) que tras «Rellenar con IA» sigan las fotos en pantalla: lo cubren `conMediosDe` (Task 1) y el paso 5 de la aceptación (Task 10).

- [ ] **Step 8: Commit**

```bash
git branch --show-current
git add lib/taller/medios-en-navegador.ts components/taller/foto-de-opcion.tsx components/taller/formas-cerradas.tsx components/taller/formas-abiertas.tsx components/taller/formulario-de-tarea.tsx "app/examenes/[id]/[prueba]/[numero]/page.tsx" tests/taller-formulario.test.tsx tests/taller-pantallas.test.ts
git commit -F - <<'EOF'
Fotos en la pantalla de la tarea, la IA respeta los medios y la tarea publicada es de solo lectura

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: La onda y el bloque de audio

**Files:**
- Create: `components/taller/onda.tsx`
- Create: `components/taller/bloque-de-audio.tsx`
- Modify: `components/taller/formulario-de-tarea.tsx`
- Test: `tests/taller-formulario.test.tsx`

**Interfaces:**
- Consumes: `picos`, `silencios`, `proponerCortes`, `ajustarMarca`, `trozosDe`, `formatearTiempo`, `leerCortesEscritos` (Task 6); `muestrasDeAudio` (Task 7); `subirAlAlmacen`; `cambiarAudio` de `FormularioDeTarea` (Task 7); `Medios` (Task 1)
- Produces: `<Onda picos duracion cortes alCambiar />` y `<BloqueDeAudio audio trozos alCambiar />`

- [ ] **Step 1: Escribir las pruebas que fallan**

Añadir a `tests/taller-formulario.test.tsx`:
```ts
describe("el bloque de audio", () => {
  const conPista = (numero: number, cortes: number[]) => {
    const f = formularioVacio(reglaDe("A2_B1_ESCOLAR", "CO", numero)!);
    f.medios.audio = { fichero: "a1", cortes };
    return f;
  };

  // Mutación que la mata: pintar el bloque también en tareas sin `trozos`.
  it("solo en auditiva, y sin pista pide subirla", () => {
    const html = pintar("CO", 4, null);
    expect(html).toContain("data-bloque-audio");
    expect(html).toContain("Subir la pista");
    expect(pintar("CE", 3, null)).not.toContain("data-bloque-audio");
  });

  // Mutación que la mata: comparar cortes.length con trozos en el contador.
  it("el contador dice cuántos trozos salen y cuántos lleva la tarea", () => {
    const mal = pintar("CO", 4, null, null, true, true, { inicial: conPista(4, [100]) });
    expect(mal).toContain('data-contador="mal"');
    expect(mal).toContain("1 marca → 2 trozos, esta tarea lleva 3");
    const bien = pintar("CO", 4, null, null, true, true, { inicial: conPista(4, [100, 200]) });
    expect(bien).toContain('data-contador="bien"');
    expect(bien).toContain("2 marcas → 3 trozos, esta tarea lleva 3");
  });

  it("Auditiva 3 no se corta: sin contador ni botón de proponer", () => {
    const html = pintar("CO", 3, null, null, true, true, { inicial: conPista(3, []) });
    expect(html).toContain("Esta tarea no se corta");
    expect(html).not.toContain("data-contador");
    expect(html).not.toContain("Proponer marcas");
  });

  // Mutación que la mata: dejar el <audio> sin la ruta del fichero.
  it("con pista, el reproductor apunta a la pista guardada", () => {
    expect(pintar("CO", 4, null, null, true, true, { inicial: conPista(4, [100, 200]) })).toContain('src="/api/ficheros/a1"');
  });
});
```

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-formulario.test.tsx`
Expected: FAIL (no hay `data-bloque-audio`).

- [ ] **Step 3: `components/taller/onda.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ajustarMarca } from "@/lib/taller/onda";

const ALTO = 120;

/**
 * La onda con sus marcas. Pulsar sobre la onda añade una marca; cada marca se
 * arrastra. Eventos de puntero: vale igual el dedo que el ratón.
 */
export function Onda({
  picos,
  duracion,
  cortes,
  alCambiar,
}: {
  picos: number[];
  duracion: number;
  cortes: number[];
  alCambiar: (cortes: number[]) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [ancho, setAncho] = useState(0);
  const [arrastre, setArrastre] = useState<{ indice: number; t: number } | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.floor(entrada.contentRect.width)));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const c = lienzo.current;
    if (!c || ancho === 0 || picos.length === 0) return;
    const escala = window.devicePixelRatio || 1;
    c.width = ancho * escala;
    c.height = ALTO * escala;
    const g = c.getContext("2d")!;
    g.scale(escala, escala);
    g.clearRect(0, 0, ancho, ALTO);
    g.fillStyle = "#6b7a90";
    for (let x = 0; x < ancho; x++) {
      const alto = Math.max(1, picos[Math.floor((x / ancho) * picos.length)] * ALTO);
      g.fillRect(x, (ALTO - alto) / 2, 1, alto);
    }
  }, [picos, ancho]);

  const tiempoDe = (clientX: number) => {
    const r = caja.current!.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * duracion;
  };

  function pulsarOnda(e: PointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget && e.target !== lienzo.current) return;
    const t = ajustarMarca(tiempoDe(e.clientX), cortes, duracion);
    if (t !== null) alCambiar([...cortes, t].sort((a, b) => a - b));
  }

  function soltar(indice: number) {
    if (!arrastre || arrastre.indice !== indice) return;
    const otras = cortes.filter((_, j) => j !== indice);
    const t = ajustarMarca(arrastre.t, otras, duracion);
    setArrastre(null);
    if (t !== null) alCambiar([...otras, t].sort((a, b) => a - b));
  }

  return (
    <div ref={caja} data-onda className="relative w-full touch-none select-none rounded-xl bg-hp-50" style={{ height: ALTO }} onPointerDown={pulsarOnda}>
      <canvas ref={lienzo} className="absolute inset-0 h-full w-full" />
      {cortes.map((c, i) => {
        const t = arrastre?.indice === i ? arrastre.t : c;
        return (
          <div
            key={i}
            role="slider"
            aria-label={`Marca ${i + 1}`}
            aria-valuemin={0}
            aria-valuemax={Math.round(duracion)}
            aria-valuenow={Math.round(t)}
            className="absolute top-0 h-full w-6 -translate-x-1/2 cursor-ew-resize"
            style={{ left: `${(t / duracion) * 100}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              setArrastre({ indice: i, t: c });
            }}
            onPointerMove={(e) => {
              if (arrastre?.indice === i) setArrastre({ indice: i, t: tiempoDe(e.clientX) });
            }}
            onPointerUp={() => soltar(i)}
            onPointerCancel={() => setArrastre(null)}
          >
            <div className="mx-auto h-full w-0.5 bg-error-600" />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: `components/taller/bloque-de-audio.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { subirAlAlmacen } from "@/lib/ficheros/subir-desde-navegador";
import type { Medios } from "@/lib/taller/formas";
import { muestrasDeAudio } from "@/lib/taller/medios-en-navegador";
import { formatearTiempo, leerCortesEscritos, picos, proponerCortes, silencios, trozosDe, type Silencio } from "@/lib/taller/onda";
import { CAJA } from "./campo";
import { Onda } from "./onda";

const CUBOS = 1200;
type Leida = { picos: number[]; silencios: Silencio[]; duracion: number };

async function leerPista(datos: ArrayBuffer): Promise<Leida> {
  const { muestras, frecuencia, duracion } = await muestrasDeAudio(datos);
  return { picos: picos(muestras, CUBOS), silencios: silencios(muestras, frecuencia), duracion };
}

/** La pista de una tarea de auditiva: subirla, ver la onda, poner las marcas y oír cada trozo. */
export function BloqueDeAudio({ audio, trozos, alCambiar }: { audio: Medios["audio"]; trozos: number; alCambiar: (audio: Medios["audio"]) => void }) {
  const [leida, setLeida] = useState<Leida | null>(null);
  const [sinOnda, setSinOnda] = useState(false);
  const [duracionDelReproductor, setDuracionDelReproductor] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reproductor = useRef<HTMLAudioElement>(null);
  const hasta = useRef<number | null>(null);
  const cortaSinMarcas = trozos === 1;

  // Al volver a abrir una tarea guardada, la onda se pide al almacén. Si el almacén
  // no deja leerla desde el navegador (CORS) o no se descodifica, queda el campo a mano.
  // Depende solo del id de la pista: mover una marca no vuelve a descargarla.
  const ficheroDeLaPista = audio?.fichero ?? null;
  useEffect(() => {
    if (!ficheroDeLaPista || leida || sinOnda || cortaSinMarcas) return;
    let vivo = true;
    fetch(`/api/ficheros/${ficheroDeLaPista}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(leerPista)
      .then((l) => { if (vivo) setLeida(l); })
      .catch(() => { if (vivo) setSinOnda(true); });
    return () => { vivo = false; };
  }, [ficheroDeLaPista, leida, sinOnda, cortaSinMarcas]);

  async function elegir(fichero: File | undefined) {
    if (!fichero) return;
    setError(null);
    setSubiendo(true);
    let nueva: Leida | null = null;
    try {
      nueva = cortaSinMarcas ? null : await leerPista(await fichero.arrayBuffer());
    } catch {
      nueva = null;
    }
    try {
      const id = await subirAlAlmacen(fichero);
      setLeida(nueva);
      setSinOnda(!cortaSinMarcas && nueva === null);
      alCambiar({ fichero: id, cortes: nueva ? proponerCortes(nueva.silencios, trozos, nueva.duracion) : [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la pista.");
    } finally {
      setSubiendo(false);
    }
  }

  function oir(inicio: number, fin: number) {
    const el = reproductor.current;
    if (!el) return;
    hasta.current = fin;
    el.currentTime = inicio;
    void el.play();
  }

  const selector = (texto: string) => (
    <label className="cursor-pointer self-start rounded-xl border border-tinta-suave/30 px-3 py-2">
      {subiendo ? "Subiendo…" : texto}
      <input type="file" accept="audio/*" className="sr-only" disabled={subiendo} onChange={(e) => elegir(e.target.files?.[0])} />
    </label>
  );

  if (!audio) {
    return (
      <section data-bloque-audio className={`${CAJA} bg-sol-100`}>
        <h3 className="font-bold">Audio</h3>
        {selector("Subir la pista")}
        {error && <span role="alert" className="text-error-600">{error}</span>}
      </section>
    );
  }

  const duracion = leida?.duracion ?? duracionDelReproductor;
  const marcas = audio.cortes.length;
  const cuadra = marcas + 1 === trozos;
  const cambiarCortes = (cortes: number[]) => alCambiar({ ...audio, cortes });

  return (
    <section data-bloque-audio className={CAJA}>
      <h3 className="font-bold">Audio</h3>
      <audio
        ref={reproductor}
        src={`/api/ficheros/${audio.fichero}`}
        preload="metadata"
        controls
        className="w-full"
        onLoadedMetadata={(e) => setDuracionDelReproductor(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (hasta.current !== null && e.currentTarget.currentTime >= hasta.current) {
            e.currentTarget.pause();
            hasta.current = null;
          }
        }}
      />
      {cortaSinMarcas ? (
        <p className="text-tinta-suave">Esta tarea no se corta: suena la pista entera.</p>
      ) : (
        <>
          <p data-contador={cuadra ? "bien" : "mal"} className={`font-bold ${cuadra ? "text-verde-600" : "text-error-600"}`}>
            {marcas} {marcas === 1 ? "marca" : "marcas"} → {marcas + 1} trozos, esta tarea lleva {trozos}
          </p>
          {leida && <Onda picos={leida.picos} duracion={leida.duracion} cortes={audio.cortes} alCambiar={cambiarCortes} />}
          {!leida && !sinOnda && <p className="text-tinta-suave">Dibujando la onda…</p>}
          {sinOnda && (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-tinta-suave">No se pudo dibujar la onda. Escribe las marcas en segundos, separadas por comas (22, 38.5 o 1:05)</span>
              <input
                type="text"
                defaultValue={audio.cortes.join(", ")}
                className="w-full rounded-xl border border-tinta-suave/30 p-3"
                onBlur={(e) => {
                  const cortes = leerCortesEscritos(e.target.value);
                  if (cortes === null) setError("Las marcas tienen que ir en orden, separadas por comas: 22, 38.5 o 1:05.");
                  else { setError(null); cambiarCortes(cortes); }
                }}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {leida && (
              <button type="button" onClick={() => cambiarCortes(proponerCortes(leida.silencios, trozos, leida.duracion))} className="rounded-xl border border-tinta-suave/30 px-3 py-2">
                Proponer marcas por los silencios
              </button>
            )}
            {selector("Cambiar la pista")}
          </div>
        </>
      )}
      {duracion !== null && (
        <ol className="flex flex-col gap-2">
          {trozosDe(audio.cortes, duracion).map(([inicio, fin], i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-bold">Trozo {i + 1} · {formatearTiempo(inicio)}–{formatearTiempo(fin)}</span>
              <button type="button" onClick={() => oir(inicio, fin)} className="rounded-xl border border-tinta-suave/30 px-3 py-1">Oír</button>
              {i > 0 && (
                <>
                  <button type="button" onClick={() => oir(inicio, inicio + 5)} className="rounded-xl border border-tinta-suave/30 px-3 py-1">Oír 5 s desde la marca</button>
                  <button type="button" onClick={() => cambiarCortes(audio.cortes.filter((_, j) => j !== i - 1))} className="rounded-xl border border-tinta-suave/30 px-3 py-1">Quitar marca</button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {error && <span role="alert" className="text-error-600">{error}</span>}
    </section>
  );
}
```

- [ ] **Step 5: Enchufarlo en `formulario-de-tarea.tsx`**

Importar `import { BloqueDeAudio } from "./bloque-de-audio";`. Quitar la línea `void cambiarAudio;`. Dentro del `fieldset`, como primer hijo (antes de la sección de la consigna):
```tsx
          {regla.trozos ? <BloqueDeAudio audio={f.medios.audio} trozos={regla.trozos} alCambiar={cambiarAudio} /> : null}
```

- [ ] **Step 6: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-formulario.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS y lint sin errores nuevos. Si lint pide dependencias en el `useEffect` de `BloqueDeAudio`, dejarlas como están escritas (`[audio, leida, cortaSinMarcas]`), que ya son todas.

- [ ] **Step 7: Commit**

```bash
git branch --show-current
git add components/taller/onda.tsx components/taller/bloque-de-audio.tsx components/taller/formulario-de-tarea.tsx tests/taller-formulario.test.tsx
git commit -F - <<'EOF'
Bloque de audio: subir la pista, onda con marcas arrastrables y oir cada trozo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: Publicar y Retirar en la pantalla del examen, que queda de solo lectura

**Files:**
- Modify: `app/examenes/[id]/page.tsx`
- Test: `tests/taller-pantallas.test.ts`

**Interfaces:**
- Consumes: `ExamenDelTaller.estado` y `ExamenDelTaller.motivosParaPublicar` (Task 5), `publicarExamenAccion`, `retirarExamenAccion` (Task 5), `MENSAJE_PUBLICADO` (Task 5)
- Produces: la caja `data-publicacion` en la pantalla del examen

- [ ] **Step 1: Escribir las pruebas que fallan**

En `tests/taller-pantallas.test.ts`:
- Añadir `publicarExamenAccion: vi.fn(),` y `retirarExamenAccion: vi.fn(),` al doble de `@/app/examenes/acciones`.
- Convertir el objeto que hoy se pasa a `dobles.examenParaElTaller.mockResolvedValue({ … })` (hacia la línea 132) en una función del fichero, `function examenDePrueba(extra: Record<string, unknown> = {})`, que devuelva ese mismo objeto con `estado: "EN_CONSTRUCCION", motivosParaPublicar: [], ...extra`. Usarla donde estaba.
- Añadir, en el mismo `describe` y con el mismo arranque de sesión de profesor que usan sus pruebas vecinas:
```ts
  // Mutación que la mata: no apagar «Publicar» cuando hay motivos.
  it("en construcción con motivos: Publicar apagado y la lista de por qué", async () => {
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ motivosParaPublicar: ["Faltan por completar: CO1, EO1."] }));
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).toContain("data-publicacion");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Publicar<\/button>/);
    expect(html).toContain("Faltan por completar: CO1, EO1.");
    expect(html).toContain("Subir un cuadernillo nuevo");
  });

  it("sin motivos, Publicar encendido", async () => {
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba());
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Publicar<\/button>/);
    expect(html).toContain(">Publicar</button>");
  });

  // Mutación que la mata: seguir pintando los editores (cuadernillo, páginas, etiquetas) con el examen publicado.
  it("publicado: Retirar, el aviso, y nada que edite", async () => {
    dobles.examenParaElTaller.mockResolvedValue(examenDePrueba({ estado: "PUBLICADO" }));
    const html = renderToStaticMarkup(await PantallaDelExamen({ params: Promise.resolve({ id: "x1" }), searchParams: sinError() }));
    expect(html).toContain(">Retirar</button>");
    expect(html).toContain("El examen está publicado: retíralo para editarlo.");
    expect(html).not.toContain("Subir un cuadernillo nuevo");
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain(">Publicar</button>");
  });
```
Si las pruebas vecinas no usan `renderToStaticMarkup(await PantallaDelExamen(…))` sino un ayudante propio, usar ese ayudante. Si el fichero no tiene páginas en el doble, añadir una en `examenDePrueba` para que `aria-pressed` tenga dónde salir cuando no está publicado.

- [ ] **Step 2: Correrlas y ver que fallan**

Run: `npx vitest run tests/taller-pantallas.test.ts`
Expected: FAIL (no hay `data-publicacion`).

- [ ] **Step 3: Implementar en `app/examenes/[id]/page.tsx`**

Imports:
```ts
import { publicarExamenAccion, retirarExamenAccion } from "@/app/examenes/acciones";
import { MENSAJE_PUBLICADO } from "@/lib/taller/publicado";
```
y añadir `nombreDeEtiqueta` al import de `@/lib/dele/estructura`.

Tras `const resumenDelNumero = …;`:
```ts
  const publicado = examen.estado === "PUBLICADO";
  const motivos = examen.motivosParaPublicar;
```
Justo después de la línea del `error` (`{error && <p role="alert" …>}`):
```tsx
      <section className={CAJA} data-publicacion>
        <h2 className="text-xl font-bold">Publicación</h2>
        {publicado ? (
          <>
            <p className="font-bold text-verde-600">Publicado</p>
            <p className="text-tinta-suave">{MENSAJE_PUBLICADO}</p>
            <form action={retirarExamenAccion.bind(null, examen.id)}>
              <button type="submit" className="rounded-2xl border border-hp-400 px-5 py-2 font-bold text-hp-600">Retirar</button>
            </form>
          </>
        ) : (
          <>
            <form action={publicarExamenAccion.bind(null, examen.id)}>
              <button type="submit" disabled={motivos.length > 0} className={`rounded-2xl bg-hp-400 px-6 py-3 font-bold text-white ${motivos.length > 0 ? "opacity-50" : ""}`}>Publicar</button>
            </form>
            {motivos.length > 0 && (
              <ul className="list-disc pl-5">
                {motivos.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
          </>
        )}
      </section>
```
En la sección del cuadernillo:
- `<ElegirCuadernillo … />` pasa a pintarse solo con `{!publicado && (…)}`.
- El `<details>` de «Subir un cuadernillo nuevo», también.
- La tabla del resumen se queda.

En la sección de páginas:
- `<SubirPaginas … />` pasa a `{!publicado && <SubirPaginas … />}`.
- El `map` de páginas pinta, si está publicado, una ficha de solo lectura:
```tsx
            {examen.paginas.map((p) =>
              publicado ? (
                <figure key={p.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-tinta-suave/20 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- la ruta redirige a un enlace firmado de 5 minutos */}
                  <img src={`/api/ficheros/${p.ficheroId}`} alt={`Hoja ${p.orden}`} loading="lazy" className="w-full rounded-xl border border-tinta-suave/10" />
                  <figcaption className="font-bold">Hoja {p.orden} · {p.etiquetas.map(nombreDeEtiqueta).join(", ") || "sin etiquetar"}</figcaption>
                </figure>
              ) : (
                <EtiquetasDePagina key={p.id} examenId={examen.id} pagina={p} todas={todas} />
              ),
            )}
```

- [ ] **Step 4: Correr las pruebas y ver verde**

Run: `npx vitest run tests/taller-pantallas.test.ts && npx tsc --noEmit && npm run lint`
Expected: PASS, lint sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add "app/examenes/[id]/page.tsx" tests/taller-pantallas.test.ts
git commit -F - <<'EOF'
Publicar y Retirar en la pantalla del examen; publicado queda de solo lectura

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 10: Cierre y aceptación (la hace el controlador, no un subagente)

- [ ] **Step 1: Suites completas, una vez**

```bash
npm test 2>&1 | tail -n 5
npm run test:base 2>&1 | tail -n 5
npx tsc --noEmit && npm run lint
grep -rn "Entrega 3\|imagenesPendientes" lib components app
```
Expected: todo verde. Las cifras son las de la Task 0 más las nuevas, y **no son cero**. El `grep` no devuelve nada.

- [ ] **Step 2: Revisión final** del diff completo de la rama contra la spec, sección por sección, empezando por `git diff --stat 67d30c4..HEAD`. Comprobar a propósito que:
- ningún camino de escritura del taller se salta `exigirEditable`: `grep -n "prisma\.\(pieza\|paginaDeExamen\|examen\)\.\(create\|update\|delete\)" lib/taller` y mirar cada resultado;
- `encargoDeTarea` no manda `medios`.

- [ ] **Step 3: Fusionar y empujar SOLO con el «sí» del profesor** (skill `abrir-rama-en-worktree`, sección «Al fusionar»). El despliegue aplica la migración `taller_entrega_3a`. Empujar el commit probado: `git push origin <sha>:main`.

- [ ] **Step 4: Aceptación en producción con el examen 1 del libro** (spec §9, obligatoria). Antes, contarle al profesor lo que salió en la Task 0 sobre CORS.
1. Subir las pistas 05, 06, 07 y 08 (`~/Downloads/A2B1 examenes/claves_dele_escolar_mp3/`) a las tareas 1-4 de auditiva del examen 1.
2. Con la 08, la onda se dibuja y la propuesta cae cerca de 188-191 s y 354-358 s. Tras mover lo que haga falta, «Oír» del trozo 2 empieza donde arranca la segunda noticia, y el trozo 1 acaba después de su segunda audición. **Si la propuesta cae mal en varias pistas, se quita** el botón y la propuesta automática (spec §4.2), sin afinar a ciegas. En la tarea 3 de auditiva, que no se corta, comprobar que **no** sale ninguna fila «Trozo 1 · …» debajo del reproductor: sin navegador ninguna prueba puede cubrirlo.
3. Guardar, cerrar la tarea y reabrirla. La onda se dibuja desde el almacén o, si la Task 0 dijo que no hay CORS, sale el campo a mano con las marcas guardadas.
4. Subir las fotos de la tarea 1 de auditiva y de la tarea 1 de oral, desde el portátil y desde el móvil.
5. «Rellenar con IA» sobre una tarea con fotos: las fotos siguen en pantalla y siguen tras guardar. **Es la comprobación más importante del paseo:** la línea que las conserva (`setF((actual) => conMediosDe(r.formulario, actual))` en `components/taller/formulario-de-tarea.tsx`) no la cubre ninguna prueba automática, y cambiarla por `setF(r.formulario)` borraría las fotos subidas sin poner nada en rojo.
6. Publicar con una tarea a medias: apagado y con motivos. Completar y publicar. Abrir una tarea: aviso y todo apagado. Retirar.
7. Mirar la pantalla de la tarea de auditiva 1 y la del examen a 400 px de ancho: nada desborda.

Todo lo que falle se apunta y se arregla antes de la 3b.

- [ ] **Step 5: Memoria.** Actualizar `hispaprofe-dele-taller-entrega-3.md` con el resultado real (CORS, si la propuesta de marcas acertó, qué se tuvo que mover) y la línea de `MEMORY.md`. Copiar el ledger a `~/.claude/projects/-Users-FLE/ledgers-preservados/` antes de retirar el worktree.
