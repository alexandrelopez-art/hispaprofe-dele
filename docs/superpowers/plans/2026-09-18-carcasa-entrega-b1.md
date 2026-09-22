# La carcasa · Entrega B1 — plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vestir con el kit de la Entrega A las pantallas del profesor (Pendientes, corregir, Exámenes, un examen, la hoja, el taller, Estudiantes), poner las notas de corregir en botones 0–3 que nacen vacíos, y cerrar los aplazados de la A.

**Architecture:** No cambia ningún dato, consulta ni acción de servidor. Se añade una pieza al kit (`GrupoDeOpciones`), dos funciones puras para las notas (`components/examen/notas.ts`) y una pieza de error de pantalla reutilizable. La sesión y la cola de Pendientes pasan por `cache()` de React para leerse una vez por petición. El layout de `(sitio)` pone la altura y las pantallas dejan de poner `min-h-screen`.

**Tech Stack:** Next 16 (App Router), React 19 (`cache`, `Suspense`), Tailwind 4 (`@theme` en `app/globals.css`), Vitest con `renderToStaticMarkup` (sin jsdom).

**Spec:** `docs/superpowers/specs/2026-09-18-carcasa-entrega-b1-design.md`. La de la A (`2026-09-18-carcasa-entrega-a-design.md`) sigue valiendo en sus secciones 6 y 7. Referencia visual: `docs/diseno/carcasa/03-Pantallas-Profesor.dc.html`. **Si el dibujo y la spec chocan, manda la spec.**

## Global Constraints

- **Vestir, no rediseñar.** Ninguna consulta, campo, acción de servidor ni dato nuevo. La única excepción es la forma de poner las notas (Task 5).
- **No se dibuja lo que no existe:** ni grabaciones, ni citas, ni opiniones, ni «Pedir opinión», ni modo completo/libre en la lista de asignados, ni «5 de 6 — falta 1».
- Colores, sombras, radio y letra: **solo** los tokens de `app/globals.css`. No se añade ninguno. Botón principal: fondo `hp-700`, nunca `hp-400`.
- **El tono `error` (rojo) es solo para fallos de verdad.** No poder publicar, una respuesta fallada y las salidas del estudiante van en `aviso` (coral).
- **Nunca se escribe «apto».** Los criterios salen de `CRITERIOS_EE` (`lib/dele/estructura.ts:177`); «Cohesión» no aparece.
- **Ninguna librería nueva.** Nada de `npm install <algo>`.
- **Todo en español:** identificadores, textos y comentarios.
- **Cada prueba nueva lleva encima su comentario `// Mutación que la mata: …`** y se comprueba de verdad: romper el código a mano, ver la prueba en rojo, deshacer. Renombrar un símbolo NO vale como mutación.
- **Atributos:** `toContain("disabled")` pasa por casualidad con la clase `disabled:…` del kit. Se mira el atributo en la etiqueta: `/<button[^>]*\sdisabled=""[^>]*>Guardar</`.
- **Prohibido leer o tocar `node_modules`** y ficheros `.sql`, y prohibido esquivar esa prohibición (renombrar, copiar, `cat` por otra ruta). Si hace falta saber una API de Next o React, se valida con `npx tsc --noEmit`.
- Pruebas acotadas mientras se trabaja: `npx vitest run tests/<fichero>`. La suite entera solo en la Task 9.
- Commits con rutas concretas, **nunca `git add -A`**. Antes de cada commit, `git branch --show-current` debe decir `carcasa-b1`. Los mensajes de commit, sin acentos graves (zsh se los come dentro de comillas dobles).
- Trabajar en `/Users/FLE/Projects/hispaprofe-dele-carcasa-b1`. No hacer `git switch` en ninguna otra carpeta.

---

## Mapa de ficheros

| Fichero | Qué cambia |
|---|---|
| `components/ui/grupo-de-opciones.tsx` | **nuevo**: `GrupoDeOpciones` (radios, formas `lista` y `segmentos`) |
| `app/(sitio)/muestrario/page.tsx` | añade las dos formas |
| `lib/puerta/sesion-http.ts` | la sesión, envuelta con `cache()` |
| `lib/carcasa/pendientes.ts` | `colaPorCorregir()` con `cache()`; `contarPendientes` la usa |
| `lib/puerta/entrada.ts` | `usarEnlace` devuelve también el `papel` |
| `app/entrar/[secreto]/route.ts` | redirige a `inicioDe(papel)` |
| `app/(sitio)/(inicio)/page.tsx`, `loading.tsx` (se borra), `esqueleto.tsx` (nuevo) | el esqueleto solo en la rama del estudiante |
| `app/(sitio)/layout.tsx` y todas las `page.tsx` de `(sitio)` | la altura la pone el layout; fuera `min-h-screen` |
| `components/carcasa/error-de-pantalla.tsx` | **nuevo**: el error con «Reintentar», compartido |
| `app/(sitio)/{pendientes,examenes,estudiantes}/{loading,error}.tsx` | **nuevos** |
| `app/(sitio)/pendientes/page.tsx` | la cola vestida |
| `components/examen/notas.ts` | **nuevo**: `sumaDeNotas`, `motivoParaNoGuardar` (puras) |
| `components/examen/corregir-escrita.tsx` | notas 0–3, suma, botones apagados con motivo, dos columnas |
| `app/(sitio)/examenes/page.tsx`, `app/(sitio)/estudiantes/page.tsx` | vestidas |
| `app/(sitio)/examenes/[id]/page.tsx`, `components/taller/quien-lo-hace.tsx`, `components/taller/estado-de-la-tarea.tsx` | vestidas; `tonoDeTarea` |
| `app/(sitio)/examenes/[id]/hoja/…/page.tsx` | vestida; falladas en coral |
| `app/(sitio)/examenes/[id]/[prueba]/[numero]/page.tsx`, `components/taller/*` | vestidas; `Campo` del taller → `CampoDelTaller` |

---

### Task 0: Dejar la carpeta lista

La carpeta `hispaprofe-dele-carcasa-b1` nace sin dependencias ni cliente de Prisma.

- [ ] **Step 1:** Desde `/Users/FLE/Projects/hispaprofe-dele-carcasa-b1`: `DIRECT_URL=postgresql://x:x@localhost:5432/x DATABASE_URL=postgresql://x:x@localhost:5432/x npm ci`. El `postinstall` corre `prisma generate`, que falla sin `DIRECT_URL`; la URL falsa vale, no conecta. **No usar `npx prisma` antes de `npm ci`.**
- [ ] **Step 2:** `npx tsc --noEmit` y `npx vitest run tests/portada.test.ts tests/examen-pantallas.test.tsx` en verde. Es la línea de salida: si algo está rojo aquí, se para y se avisa al controlador.

Sin commit.

---

### Task 1: `GrupoDeOpciones` y el muestrario

**Files:**
- Create: `components/ui/grupo-de-opciones.tsx`
- Modify: `app/(sitio)/muestrario/page.tsx`
- Test: `tests/ui-kit.test.tsx` (añadir un `describe`)

**Interfaces:**
- Produces (lo usan las Tasks 5 y 7):
  ```ts
  type OpcionDeGrupo = { valor: string; texto: string };
  GrupoDeOpciones(props: {
    nombre: string;            // el name de los radios; también prefijo de sus id
    leyenda: string;           // <legend> visible
    opciones: OpcionDeGrupo[];
    forma?: "lista" | "segmentos"; // por defecto "lista"
    valor?: string | null;     // controlado: null = ninguno marcado
    alCambiar?: (valor: string) => void; // si viene, es controlado
    valorInicial?: string;     // no controlado (formularios de servidor)
    disabled?: boolean;
    ayuda?: string;            // texto bajo la leyenda (data-ayuda)
  })
  ```

- [ ] **Step 1: Las pruebas, en rojo.** Añadir a `tests/ui-kit.test.tsx`:

```tsx
import { GrupoDeOpciones } from "@/components/ui/grupo-de-opciones";

const BANDAS = ["0", "1", "2", "3"].map((v) => ({ valor: v, texto: v }));
const radios = (html: string) => html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];

describe("GrupoDeOpciones", () => {
  // Mutación que la mata: tratar null como "0" (p. ej. `checked={String(valor ?? 0) === o.valor}`).
  // Una nota sin poner no es un 0: es justo el agujero que las notas vacías tapan.
  it("con valor null no marca ninguno", () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpciones nombre="b" leyenda="Coherencia" opciones={BANDAS} forma="segmentos" valor={null} alCambiar={() => {}} />,
    );
    expect(radios(html)).toHaveLength(4);
    expect(radios(html).some((r) => /\schecked=""/.test(r))).toBe(false);
  });

  // Mutación que la mata: comparar con `==` contra un número, o marcar por índice.
  it("con valor \"0\" marca el 0 y solo el 0", () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpciones nombre="b" leyenda="Coherencia" opciones={BANDAS} forma="segmentos" valor="0" alCambiar={() => {}} />,
    );
    const marcados = radios(html).filter((r) => /\schecked=""/.test(r));
    expect(marcados).toHaveLength(1);
    expect(marcados[0]).toContain('value="0"');
  });

  // Mutación que la mata: quitar el <legend> o esconderlo con sr-only. Sin él, un
  // lector de pantalla oye «2, 3» sin saber de qué criterio.
  it("lleva fieldset y una leyenda visible", () => {
    const html = renderToStaticMarkup(<GrupoDeOpciones nombre="m" leyenda="Cómo lo hace" opciones={BANDAS} />);
    expect(html).toMatch(/<fieldset[^>]*>[\s\S]*<legend[^>]*>Cómo lo hace<\/legend>/);
    expect(html).not.toMatch(/<legend[^>]*sr-only/);
  });

  // Mutación que la mata: poner el mismo id a todos, o quitar el name.
  it("cada radio tiene su id y todos el mismo name", () => {
    const html = renderToStaticMarkup(<GrupoDeOpciones nombre="modo" leyenda="Modo" opciones={BANDAS} />);
    const ids = radios(html).map((r) => r.match(/id="([^"]+)"/)![1]);
    expect(new Set(ids).size).toBe(4);
    expect(radios(html).every((r) => r.includes('name="modo"'))).toBe(true);
  });

  // Mutación que la mata: ignorar valorInicial (el formulario de asignar
  // nacería sin modo y el servidor recibiría null).
  it("sin control, marca valorInicial", () => {
    const html = renderToStaticMarkup(
      <GrupoDeOpciones nombre="modo" leyenda="Modo" opciones={BANDAS} valorInicial="2" />,
    );
    expect(radios(html).filter((r) => /\schecked=""/.test(r))[0]).toContain('value="2"');
  });

  // Mutación que la mata: no pasar `disabled` al fieldset.
  it("disabled apaga el grupo entero", () => {
    const html = renderToStaticMarkup(<GrupoDeOpciones nombre="m" leyenda="M" opciones={BANDAS} disabled />);
    expect(html).toMatch(/<fieldset[^>]*\sdisabled=""/);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/ui-kit.test.tsx` → FAIL (no existe el módulo).

- [ ] **Step 3: La pieza.** `components/ui/grupo-de-opciones.tsx`:

```tsx
export type OpcionDeGrupo = { valor: string; texto: string };

const FOCO = "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-hp-600";

/**
 * Elegir UNA opción entre varias, con radios de verdad: las flechas del
 * teclado, el foco y el lector de pantalla los da el navegador gratis.
 *
 * `valor = null` es «ninguna marcada», que NO es lo mismo que la primera
 * opción: en las notas de corregir, un 0 es una nota y un hueco es una nota
 * que falta.
 *
 * Controlado si llega `alCambiar` (corregir); si no, lo lleva el formulario
 * con `valorInicial` (asignar, que se envía a una acción de servidor).
 */
export function GrupoDeOpciones({
  nombre,
  leyenda,
  opciones,
  forma = "lista",
  valor,
  alCambiar,
  valorInicial,
  disabled,
  ayuda,
}: {
  nombre: string;
  leyenda: string;
  opciones: OpcionDeGrupo[];
  forma?: "lista" | "segmentos";
  valor?: string | null;
  alCambiar?: (valor: string) => void;
  valorInicial?: string;
  disabled?: boolean;
  ayuda?: string;
}) {
  const controlado = alCambiar !== undefined;
  const marca = (o: OpcionDeGrupo) =>
    controlado
      ? { checked: valor === o.valor, onChange: () => alCambiar(o.valor) }
      : { defaultChecked: valorInicial === o.valor };

  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2 disabled:opacity-60">
      <legend className="text-sm font-bold">{leyenda}</legend>
      {ayuda && <p data-ayuda className="text-sm text-tinta-suave">{ayuda}</p>}
      {forma === "segmentos" ? (
        <div className="inline-flex self-start overflow-hidden rounded-2xl border border-hp-300 bg-white">
          {opciones.map((o) => (
            <label key={o.valor} htmlFor={`${nombre}-${o.valor}`} className="relative">
              <input type="radio" id={`${nombre}-${o.valor}`} name={nombre} value={o.valor} className="peer sr-only" {...marca(o)} />
              <span
                className={`block min-w-11 cursor-pointer border-l border-hp-300 px-3 py-2 text-center font-bold text-hp-600 first:border-l-0 hover:bg-hp-50 peer-checked:bg-hp-700 peer-checked:text-white ${FOCO}`}
              >
                {o.texto}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {opciones.map((o) => (
            <label key={o.valor} htmlFor={`${nombre}-${o.valor}`} className="flex items-start gap-2">
              <input
                type="radio"
                id={`${nombre}-${o.valor}`}
                name={nombre}
                value={o.valor}
                className="mt-1 size-4 accent-hp-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600"
                {...marca(o)}
              />
              <span>{o.texto}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
```

Nota: `first:border-l-0` va en el `<span>`, que es el primer hijo de su `<label>`; si al mirarlo en el navegador salen dos bordes a la izquierda, se mueve el borde al `<label>` con `[&+label]:border-l`. No es motivo de parar.

- [ ] **Step 4:** `npx vitest run tests/ui-kit.test.tsx` → PASS. Hacer las mutaciones de los comentarios y ver cada una en rojo.

- [ ] **Step 5: El muestrario.** En `app/(sitio)/muestrario/page.tsx`, añadir una sección más junto a las otras piezas, con el mismo formato que usan las demás:
  - `GrupoDeOpciones` `forma="lista"`, `nombre="muestra-modo"`, `leyenda="Cómo lo hace"`, opciones `COMPLETO` / `LIBRE` con los textos de `quien-lo-hace.tsx` y `valorInicial="COMPLETO"`.
  - `GrupoDeOpciones` `forma="segmentos"`, `nombre="muestra-banda-vacia"`, `leyenda="Coherencia textual (sin nota)"`, opciones 0–3, sin `valorInicial`.
  - Lo mismo con `nombre="muestra-banda-2"`, `valorInicial="2"` y `leyenda="Coherencia textual (con un 2)"`.
  - Y una con `disabled`.

  El muestrario es un componente de servidor: usar **siempre** la forma no controlada (`valorInicial`), nunca `alCambiar`.
  Añadir en `tests/carcasa-muestrario.test.tsx` una prueba que busque `name="muestra-banda-vacia"` (con su comentario de mutación: quitar la sección).

- [ ] **Step 6:** `npx vitest run tests/ui-kit.test.tsx tests/carcasa-muestrario.test.tsx` y `npx tsc --noEmit` en verde. Commit:

```bash
git add components/ui/grupo-de-opciones.tsx app/\(sitio\)/muestrario/page.tsx tests/ui-kit.test.tsx tests/carcasa-muestrario.test.tsx
git commit -m "Kit: GrupoDeOpciones, en lista y en segmentos, y en el muestrario"
```

---

### Task 2: La sesión una vez, y el profesor sin el esqueleto del estudiante

**Files:**
- Modify: `lib/puerta/sesion-http.ts`, `lib/carcasa/pendientes.ts`, `lib/puerta/entrada.ts:79-118`, `app/entrar/[secreto]/route.ts`, `app/(sitio)/(inicio)/page.tsx`
- Create: `app/(sitio)/(inicio)/esqueleto.tsx`
- Delete: `app/(sitio)/(inicio)/loading.tsx`
- Test: `tests/puerta-sesion-http.test.ts`, `tests/carcasa-cabecera.test.tsx`, `tests/puerta-entrar-secreto.test.ts`, `tests/base/entrada.test.ts`, `tests/portada.test.ts`

**Interfaces:**
- Produces:
  - `colaPorCorregir(): Promise<Awaited<ReturnType<typeof escritosPorCorregir>>>` en `lib/carcasa/pendientes.ts` (la usa la Task 4).
  - `ResultadoDeEntrada = { cookie: string; papel: Papel } | { error: … }`.
  - `EsqueletoDelInicio()` en `app/(sitio)/(inicio)/esqueleto.tsx`; `InicioDelEstudiante({ persona }: { persona: Persona })` exportado de `app/(sitio)/(inicio)/page.tsx`.

**Sobre `cache()`:** fuera de una petición de servidor de React (en Vitest, en `app/api/...`) `cache` de `react` no guarda nada: llama a la función cada vez. Por eso las pruebas de hoy, que cambian el doble de `personaDeLaCookie` entre casos, siguen valiendo, y por eso **no se puede probar contando consultas**. Se prueba que nadie se salte la envoltura.

- [ ] **Step 1: La sesión.** En `lib/puerta/sesion-http.ts`:

```ts
import { cache } from "react";
// …
/**
 * La persona de ESTA petición, leída una sola vez: el layout de (sitio) y la
 * página la piden los dos, y sin esto cada pantalla consultaba la sesión dos
 * veces. La fecha se toma dentro: una función que recibe `ahora` no se puede
 * cachear (cada llamada trae una fecha distinta).
 */
const personaDeEstaPeticion = cache(async (): Promise<Persona | null> => personaActual(new Date()));
```

`personaDeLaPeticion()` pasa a `return personaDeEstaPeticion();` y `exigirPersona()` a `const persona = await personaDeEstaPeticion();`. `personaActual` sigue sin exportarse.

- [ ] **Step 2: La prueba de que nadie se la salta.** En `tests/puerta-sesion-http.test.ts`:

```ts
import { readFileSync } from "node:fs";

// Mutación que la mata: en exigirPersona, volver a `personaActual(new Date())`.
// La sesión se leería dos veces por pantalla, que es lo que cache() quitó.
it("solo la envoltura cacheada llama a personaActual", () => {
  const fuente = readFileSync("lib/puerta/sesion-http.ts", "utf8");
  const llamadas = fuente.match(/personaActual\(/g) ?? [];
  // Una en la definición y una dentro de cache(): ninguna más.
  expect(llamadas).toHaveLength(2);
  expect(fuente).toMatch(/cache\(async \(\): Promise<Persona \| null> => personaActual\(new Date\(\)\)\)/);
});
```

- [ ] **Step 3: La cola de Pendientes.** En `lib/carcasa/pendientes.ts`:

```ts
import { cache } from "react";
import { escritosPorCorregir } from "@/lib/examen/corregir";

/** La cola de Pendientes de ESTA petición. En /pendientes la pide la cabecera
 *  (para el número) y la página (para la lista): una sola consulta. */
export const colaPorCorregir = cache(() => escritosPorCorregir(new Date()));
```

y `contarPendientes` pasa a `return (await colaPorCorregir()).length;`, con el mismo `try/catch`. Las pruebas de `tests/carcasa-cabecera.test.tsx` deben seguir en verde sin tocarlas (mockean `escritosPorCorregir`).

- [ ] **Step 4: `usarEnlace` devuelve el papel.** En `lib/puerta/entrada.ts`: `export type ResultadoDeEntrada = { cookie: string; papel: Papel } | { error: MotivoDeRechazo | "desconocido" };` (importar `Papel` de `@/lib/generated/prisma`) y, en la línea 118, `return { cookie: cookie.secreto, papel: enlace.persona.papel };`. En `tests/base/entrada.test.ts`, allí donde se compruebe el resultado bueno, añadir que trae el papel de la persona (con comentario de mutación: devolver siempre `"ESTUDIANTE"`).

- [ ] **Step 5: La entrada, directa.** En `app/entrar/[secreto]/route.ts`, importar `inicioDe` de `@/lib/carcasa/menu` y cambiar el destino a `new URL(inicioDe(resultado.papel), request.url)`. Añadir un comentario: el profesor iba a `/` y de ahí a `/pendientes` (dos saltos, y veía el esqueleto del estudiante).

  En `tests/puerta-entrar-secreto.test.ts`, los `mockResolvedValue({ cookie: … })` pasan a llevar `papel: "ESTUDIANTE"` (la `location` sigue siendo `http://hispaprofe.com/`), y se añade:

```ts
// Mutación que la mata: redirigir siempre a "/". El profesor daría dos saltos y
// vería un instante el esqueleto del Inicio del estudiante.
it("el profesor entra directo a Pendientes", async () => {
  usarEnlace.mockResolvedValue({ cookie: "c", papel: "PROFESOR" });
  const respuesta = await GET(peticion(), contexto()); // los mismos ayudantes que ya usan las demás pruebas del fichero
  expect(respuesta.headers.get("location")).toBe("http://hispaprofe.com/pendientes");
});
```

- [ ] **Step 6: El esqueleto, solo para el estudiante.** Crear `app/(sitio)/(inicio)/esqueleto.tsx` con el contenido de hoy de `loading.tsx` (función `EsqueletoDelInicio`, mismo `aria-label="Cargando tu inicio"`) y **borrar** `loading.tsx` (`git rm`). En `page.tsx`:
  - `Portada` lee la persona, redirige al profesor, pinta el `<main>` sin sesión como hoy, y para el estudiante devuelve:
    ```tsx
    <Suspense fallback={<EsqueletoDelInicio />}>
      <InicioDelEstudiante persona={persona} />
    </Suspense>
    ```
  - `export async function InicioDelEstudiante({ persona }: { persona: Persona })` hace lo de hoy: `cerrarLasQueSePasaron` **antes** de `asignacionesDe`, en ese orden, y devuelve el `<main>` con las tarjetas.
  - El comentario de la cabecera del fichero explica por qué: con un `loading.tsx` que cubre la ruta, el esqueleto sale antes de saber el papel, y el profesor lo veía un instante antes de la redirección.

- [ ] **Step 7: Las pruebas del Inicio.** En `tests/portada.test.ts`, el ayudante `html()` resuelve el `Suspense`:

```ts
import { Suspense, isValidElement, type ReactElement } from "react";

async function html(): Promise<string> {
  const el = await Portada();
  if (isValidElement(el) && el.type === Suspense) {
    const hijo = (el.props as { children: ReactElement<{ persona: Persona }> }).children;
    const Componente = hijo.type as (p: { persona: Persona }) => Promise<ReactElement>;
    return renderToStaticMarkup(await Componente(hijo.props));
  }
  return renderToStaticMarkup(el);
}
```

y se añaden:

```ts
// Mutación que la mata: devolver el <main> del estudiante sin Suspense, o con
// el fallback vacío. Sin el esqueleto, el estudiante mira una pantalla en blanco
// mientras llegan sus exámenes.
it("el estudiante ve el esqueleto mientras cargan sus exámenes", async () => {
  /* persona de la cookie = estudiante, como en las demás pruebas del fichero */
  const el = await Portada();
  expect(isValidElement(el) && el.type === Suspense).toBe(true);
  const fallback = renderToStaticMarkup((el as ReactElement<{ fallback: ReactElement }>).props.fallback);
  expect(fallback).toContain('aria-label="Cargando tu inicio"');
});

// Mutación que la mata: volver a crear app/(sitio)/(inicio)/loading.tsx.
it("no hay loading.tsx que cubra el Inicio entero", () => {
  expect(existsSync("app/(sitio)/(inicio)/loading.tsx")).toBe(false);
});
```

  La prueba de hoy `rejects.toThrow("REDIRECT:/pendientes")` del profesor se queda.

- [ ] **Step 8:** `npx vitest run tests/puerta-sesion-http.test.ts tests/carcasa-cabecera.test.tsx tests/puerta-entrar-secreto.test.ts tests/portada.test.ts` y `npx tsc --noEmit` en verde. Mutaciones hechas. `tests/base/entrada.test.ts` necesita Postgres: se corre en la Task 9 con `npm run test:base`. Commit:

```bash
git add lib/puerta/sesion-http.ts lib/carcasa/pendientes.ts lib/puerta/entrada.ts app/entrar/\[secreto\]/route.ts app/\(sitio\)/\(inicio\)/page.tsx app/\(sitio\)/\(inicio\)/esqueleto.tsx tests/puerta-sesion-http.test.ts tests/puerta-entrar-secreto.test.ts tests/portada.test.ts tests/base/entrada.test.ts
git rm app/\(sitio\)/\(inicio\)/loading.tsx
git commit -m "La sesion se lee una vez y el profesor ya no ve el esqueleto del estudiante"
```

---

### Task 3: La altura en el layout, y cargando / error de cada pantalla

**Files:**
- Modify: `app/(sitio)/layout.tsx` y **todas** las pantallas de `(sitio)` que llevan `min-h-screen`: `(inicio)/page.tsx`, `pendientes/page.tsx`, `examenes/page.tsx`, `examenes/[id]/page.tsx`, `examenes/[id]/hoja/[personaId]/[prueba]/page.tsx`, `examenes/[id]/[prueba]/[numero]/page.tsx`, `estudiantes/page.tsx`, `pruebas/grabar/page.tsx`, `pruebas/subir/page.tsx`, `components/examen/corregir-escrita.tsx`
- Create: `components/carcasa/error-de-pantalla.tsx`; `app/(sitio)/pendientes/loading.tsx`, `error.tsx`; `app/(sitio)/examenes/loading.tsx`, `error.tsx`; `app/(sitio)/estudiantes/loading.tsx`, `error.tsx`
- Modify: `app/(sitio)/(inicio)/error.tsx` (pasa a usar la pieza compartida)
- Test: `tests/carcasa-altura.test.ts` (nuevo), `tests/carcasa-inicio-error.test.ts`

**Interfaces:**
- Produces: `ErrorDePantalla({ titulo, reset }: { titulo: string; reset: () => void })`.

- [ ] **Step 1: La prueba de la altura, en rojo.** `tests/carcasa-altura.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    return statSync(ruta).isDirectory() ? ficheros(ruta) : ruta.endsWith(".tsx") ? [ruta] : [];
  });
}

describe("la altura de las pantallas del sitio", () => {
  // Mutación que la mata: volver a poner min-h-screen en cualquier pantalla del
  // grupo. Con la cabecera de 64 px encima, min-h-screen hace que TODA pantalla
  // tenga scroll aunque esté vacía.
  it("ninguna pantalla de (sitio) pone min-h-screen", () => {
    const culpables = [...ficheros("app/(sitio)"), "components/examen/corregir-escrita.tsx"].filter((f) =>
      readFileSync(f, "utf8").includes("min-h-screen"),
    );
    expect(culpables).toEqual([]);
  });

  // Mutación que la mata: quitar el flex-1 del contenedor del layout. Sin él las
  // pantallas cortas no llegan al pie y el fondo se corta.
  it("el layout pone la altura: columna a pantalla completa y el contenido ocupa el resto", () => {
    const layout = readFileSync("app/(sitio)/layout.tsx", "utf8");
    expect(layout).toContain("min-h-dvh");
    expect(layout).toContain("flex-1");
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-altura.test.ts` → FAIL (lista de culpables).

- [ ] **Step 3: El layout.** En `app/(sitio)/layout.tsx`:

```tsx
return (
  <div className="flex min-h-dvh flex-col">
    <Cabecera persona={persona} />
    <div className="flex flex-1 flex-col">{children}</div>
  </div>
);
```

y quitar la palabra `min-h-screen` del `className` de cada `<main>` de la lista de ficheros (sin tocar nada más de esas pantallas en esta tarea). Cuidado en `(inicio)/page.tsx`: hay dos `<main>`.

- [ ] **Step 4: El error compartido.** `components/carcasa/error-de-pantalla.tsx`: es `"use client"` y lleva el cuerpo de hoy de `app/(sitio)/(inicio)/error.tsx`, con el título por propiedad:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";

/** El error de una pantalla del sitio. `reset()` solo repinta con los datos que
 *  ya fallaron: sin `router.refresh()` delante, «Reintentar» no reintenta nada. */
export function ErrorDePantalla({ titulo, reset }: { titulo: string; reset: () => void }) {
  const router = useRouter();
  const reintentar = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Aviso tono="error" titulo={titulo}>
        Comprueba tu conexión e inténtalo otra vez.
      </Aviso>
      <div>
        <Boton onClick={reintentar}>Reintentar</Boton>
      </div>
    </main>
  );
}
```

  `app/(sitio)/(inicio)/error.tsx` pasa a `return <ErrorDePantalla titulo="No hemos podido cargar tu inicio" reset={reset} />;` (sigue siendo `"use client"`). `tests/carcasa-inicio-error.test.ts` llama al componente como función y busca el `onClick` en el árbol: como ahora el `onClick` está un nivel más abajo, **se cambia el ayudante para que renderice `ErrorDePantalla` directamente** (`ErrorDePantalla({ titulo: "x", reset })`) y se añade una prueba de que `ErrorDelInicio` devuelve un `ErrorDePantalla` con el título «No hemos podido cargar tu inicio». La prueba de «Reintentar llama a refresh y a reset» se queda igual.

- [ ] **Step 5: Tres pares de cargando / error.** Cada `error.tsx`:

```tsx
"use client";
import { ErrorDePantalla } from "@/components/carcasa/error-de-pantalla";

export default function ErrorDePendientes({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorDePantalla titulo="No hemos podido cargar Pendientes" reset={reset} />;
}
```

  (Exámenes: «No hemos podido cargar los exámenes»; Estudiantes: «No hemos podido cargar los estudiantes».) Cada `loading.tsx`, un esqueleto con la forma de la pantalla, como el del Inicio:

```tsx
export default function CargandoPendientes() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando Pendientes">
      <div className="h-8 w-48 animate-pulse rounded-2xl bg-hp-100" />
      <div className="h-24 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-24 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
    </main>
  );
}
```

  (Exámenes: `aria-label="Cargando los exámenes"`, `max-w-6xl`; Estudiantes: `aria-label="Cargando los estudiantes"`, filas de `h-14`.) Las pantallas de dentro (`/pendientes/[id]`, `/examenes/[id]`, la hoja y el taller) heredan el de su carpeta: no se crea ninguno más.

  Añadir a `tests/carcasa-altura.test.ts`:

```ts
// Mutación que la mata: borrar cualquiera de los seis ficheros.
it("Pendientes, Exámenes y Estudiantes tienen su cargando y su error", () => {
  for (const s of ["pendientes", "examenes", "estudiantes"]) {
    expect(existsSync(`app/(sitio)/${s}/loading.tsx`), `${s}/loading`).toBe(true);
    expect(readFileSync(`app/(sitio)/${s}/error.tsx`, "utf8")).toContain("ErrorDePantalla");
  }
});
```

- [ ] **Step 6:** `npx vitest run tests/carcasa-altura.test.ts tests/carcasa-inicio-error.test.ts tests/portada.test.ts` y `npx tsc --noEmit` en verde. Mutaciones hechas. Commit con las rutas concretas de todos los ficheros tocados:

```bash
git add app/\(sitio\)/layout.tsx app/\(sitio\)/\(inicio\)/page.tsx app/\(sitio\)/\(inicio\)/error.tsx app/\(sitio\)/pendientes app/\(sitio\)/examenes app/\(sitio\)/estudiantes app/\(sitio\)/pruebas components/examen/corregir-escrita.tsx components/carcasa/error-de-pantalla.tsx tests/carcasa-altura.test.ts tests/carcasa-inicio-error.test.ts
git status --short   # comprobar que no se ha colado nada ajeno
git commit -m "La altura la pone el layout, y cargando y error en las pantallas del profesor"
```

---

### Task 4: Pendientes

**Files:**
- Modify: `app/(sitio)/pendientes/page.tsx`
- Test: `tests/examen-pantallas.test.tsx` (el `describe("Por corregir: la cola del profesor")`, línea ~1641)

**Interfaces:**
- Consumes: `colaPorCorregir()` (Task 2); `EncabezadoPagina`, `Tarjeta`, `EtiquetaEstado`, `Enlace`, `BloqueVacio` del kit.

- [ ] **Step 1: Las pruebas, en rojo.** En el `describe` de la cola:
  - La de la cola vacía pasa a esperar `"No hay redacciones por corregir"` y además `not.toContain("cita")` (sin distinguir mayúsculas: `expect(html.toLowerCase()).not.toContain("cita")`). Su comentario de mutación se queda y se añade: «o volver a mencionar citas, que no existen hasta la 3e».
  - Nuevas:

```ts
// Mutación que la mata: dejar el título «Por corregir». El menú dice
// «Pendientes»: la pantalla tiene que llamarse igual que su enlace.
it("se titula Pendientes", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(profe);
  const html = renderToStaticMarkup(await Cola());
  expect(html).toMatch(/<h1[^>]*>Pendientes<\/h1>/);
});

// Mutación que la mata: copiar del dibujo «Grabación», «Cita oral» o «Ver
// grabación». Nada de eso existe hasta la 3e.
it("solo hay redacciones: ni grabaciones ni citas", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(profe);
  dobles.escritosPorCorregir.mockResolvedValue([
    { intentoId: "i1", examenId: "ex1", titulo: "Examen 1", persona: { id: "p1", nombre: "Ana" }, entregadaEn: new Date("2026-09-20T09:00:00Z"), porTiempo: false, diasEsperando: 1 },
  ]);
  const html = renderToStaticMarkup(await Cola());
  expect(html).toContain("Redacción");
  expect(html).not.toMatch(/Grabación|Cita|Ver grabación/);
});

// Mutación que la mata: reordenar la lista (por nombre, o la más nueva arriba).
// Lo más viejo es lo primero que hay que corregir.
it("respeta el orden de la cola: la más antigua arriba", async () => {
  dobles.personaDeLaCookie.mockResolvedValue(profe);
  dobles.escritosPorCorregir.mockResolvedValue([
    { intentoId: "vieja", examenId: "ex1", titulo: "E", persona: { id: "p2", nombre: "Zoe" }, entregadaEn: new Date("2026-09-10T09:00:00Z"), porTiempo: false, diasEsperando: 8 },
    { intentoId: "nueva", examenId: "ex1", titulo: "E", persona: { id: "p1", nombre: "Ana" }, entregadaEn: new Date("2026-09-17T09:00:00Z"), porTiempo: false, diasEsperando: 1 },
  ]);
  const html = renderToStaticMarkup(await Cola());
  expect(html.indexOf("/pendientes/vieja")).toBeLessThan(html.indexOf("/pendientes/nueva"));
});
```

  Las demás pruebas del `describe` (quién/qué/días/«por tiempo», el `href` propio, `data-refrescar`, no cerrar las pasadas) **no se tocan** y siguen en verde.

- [ ] **Step 2:** `npx vitest run tests/examen-pantallas.test.tsx -t "cola del profesor"` → FAIL.

- [ ] **Step 3: La pantalla.** `app/(sitio)/pendientes/page.tsx`, manteniendo el comentario grande de la función y `diasEnPalabras`:

```tsx
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { colaPorCorregir } from "@/lib/carcasa/pendientes";
import { RefrescarAlEntrar } from "@/components/carcasa/refrescar-al-entrar";
import { fechaHoraEnPalabras } from "@/lib/tiempo/madrid";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { Tarjeta } from "@/components/ui/tarjeta";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Enlace } from "@/components/ui/enlace";
import { BloqueVacio } from "@/components/ui/bloque-vacio";

export default async function Cola() {
  await exigirProfesor();
  // La misma consulta que ya hizo la cabecera para el número (cache()).
  const cola = await colaPorCorregir();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <RefrescarAlEntrar />
      <EncabezadoPagina titulo="Pendientes" subtitulo="Redacciones entregadas que esperan tu nota, la más antigua primero." />
      {cola.length === 0 ? (
        <BloqueVacio titulo="No hay redacciones por corregir" texto="Cuando un estudiante entregue una, aparecerá aquí." />
      ) : (
        <ul className="flex flex-col gap-3">
          {cola.map((c) => (
            <Tarjeta as="li" key={c.intentoId} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{c.persona.nombre}</span>
                  <EtiquetaEstado tono="info">Redacción</EtiquetaEstado>
                </span>
                <span className="text-tinta-suave">{c.titulo}</span>
                <span className="text-sm text-tinta-suave">
                  Entregada el {fechaHoraEnPalabras(c.entregadaEn)}
                  {c.porTiempo ? " · por tiempo" : ""} · {diasEnPalabras(c.diasEsperando)}
                </span>
              </div>
              <Enlace href={`/pendientes/${c.intentoId}`} comoBoton="principal">
                Corregir
              </Enlace>
            </Tarjeta>
          ))}
        </ul>
      )}
    </main>
  );
}
```

  Si al usar `colaPorCorregir` alguna prueba de la cola deja de ver el doble de `escritosPorCorregir`, es que `lib/carcasa/pendientes` está mockeado en ese fichero: mirar los `vi.mock` de arriba del fichero y no mockearlo (debe llegar al doble de `@/lib/examen/corregir`).

- [ ] **Step 4:** `npx vitest run tests/examen-pantallas.test.tsx -t "cola del profesor"` → PASS; mutaciones hechas. Commit:

```bash
git add app/\(sitio\)/pendientes/page.tsx tests/examen-pantallas.test.tsx
git commit -m "Pendientes con el kit: tarjetas, Corregir como boton y el vacio que no habla de citas"
```

---

### Task 5: Corregir una redacción — las notas en botones

**Files:**
- Create: `components/examen/notas.ts`
- Modify: `components/examen/corregir-escrita.tsx`
- Test: `tests/corregir-notas.test.ts` (nuevo), `tests/examen-pantallas.test.tsx` (los `describe` de corregir, líneas ~1710-1990)

**Interfaces:**
- Consumes: `GrupoDeOpciones` (Task 1); `Aviso`, `Boton`, `Campo`, `Tarjeta`, `EncabezadoPagina` del kit; `enLista` de `components/examen/piezas.tsx`; `CRITERIOS_EE`, `BANDA_MAXIMA` de `lib/dele/estructura.ts`.
- Produces (en `components/examen/notas.ts`):
  ```ts
  export type Bandas = (number | null)[];
  export function sumaDeNotas(bandas: Record<number, Bandas>, numeros: number[]): { suma: number; maximo: number };
  export function motivoParaNoGuardar(bandas: Record<number, Bandas>, numeros: number[]): string | null;
  ```

**Qué decide esta tarea (spec §5.2):** las notas nacen sin marcar; «Guardar» y «Guardar y seguir» se apagan mientras falte alguna, con el motivo en texto al lado; arriba, «18 de 24», que nunca se traduce a apto. Se conservan: el aviso de salidas (`data-salidas`), el de «Ya la corregiste», el enunciado de solo lectura, las palabras y `useTransition`. **No se toca `guardarCorreccionAccion`.** La comprobación de faltantes dentro de `guardar()` se queda como red (los botones ya vienen apagados, pero no cuesta nada).

- [ ] **Step 1: Las funciones puras, en rojo.** `tests/corregir-notas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { motivoParaNoGuardar, sumaDeNotas } from "@/components/examen/notas";

const vacia = () => [null, null, null, null];

describe("la suma de las notas", () => {
  // Mutación que la mata: contar un null como 0 en el máximo, o calcular el
  // máximo con las notas puestas en vez de con todas.
  it("suma lo puesto y el máximo es 3 por criterio y tarea", () => {
    expect(sumaDeNotas({ 1: [3, 2, null, 1], 2: vacia() }, [1, 2])).toEqual({ suma: 6, maximo: 24 });
  });

  // Mutación que la mata: sumar solo la tarea abierta, o solo la primera.
  it("con todo puesto suma las dos tareas", () => {
    expect(sumaDeNotas({ 1: [3, 3, 3, 3], 2: [0, 1, 2, 3] }, [1, 2])).toEqual({ suma: 18, maximo: 24 });
  });
});

describe("el motivo para no guardar", () => {
  // Mutación que la mata: devolver null aunque falte una nota. Se firmaría una
  // tarea con huecos.
  it("una tarea con dos notas sin poner", () => {
    expect(motivoParaNoGuardar({ 1: [3, 3, 3, 3], 2: [1, null, 2, null] }, [1, 2])).toBe("Te faltan 2 notas en la tarea 2.");
  });

  // Mutación que la mata: el singular mal («1 notas»).
  it("una sola nota", () => {
    expect(motivoParaNoGuardar({ 1: [3, 3, 3, null], 2: [1, 1, 1, 1] }, [1, 2])).toBe("Te falta 1 nota en la tarea 1.");
  });

  it("en las dos tareas", () => {
    expect(motivoParaNoGuardar({ 1: vacia(), 2: [1, null, 1, 1] }, [1, 2])).toBe("Te faltan 5 notas en las tareas 1 y 2.");
  });

  // Mutación que la mata: tratar el 0 como vacío. Un 0 es una nota válida.
  it("con todo puesto, también con ceros, no hay motivo", () => {
    expect(motivoParaNoGuardar({ 1: [0, 0, 0, 0], 2: [3, 0, 1, 2] }, [1, 2])).toBeNull();
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/corregir-notas.test.ts` → FAIL.

- [ ] **Step 3:** `components/examen/notas.ts`:

```ts
import { BANDA_MAXIMA, CRITERIOS_EE } from "@/lib/dele/estructura";
import { enLista } from "@/components/examen/piezas";

/** Una nota por criterio. `null` = sin poner, que NO es un 0 (un 0 es una nota). */
export type Bandas = (number | null)[];

const fila = (bandas: Record<number, Bandas>, n: number): Bandas => bandas[n] ?? CRITERIOS_EE.map(() => null);

/** «18 de 24»: lo puesto hasta ahora sobre el máximo de todas. Solo informa:
 *  nunca se traduce a apto / no apto. */
export function sumaDeNotas(bandas: Record<number, Bandas>, numeros: number[]): { suma: number; maximo: number } {
  const suma = numeros.flatMap((n) => fila(bandas, n)).reduce<number>((s, b) => s + (b ?? 0), 0);
  return { suma, maximo: numeros.length * CRITERIOS_EE.length * BANDA_MAXIMA };
}

/** Por qué no se puede guardar todavía, o null si ya se puede. Va escrito al
 *  lado de los botones apagados: un botón apagado sin motivo parece roto. */
export function motivoParaNoGuardar(bandas: Record<number, Bandas>, numeros: number[]): string | null {
  const faltanPorTarea = numeros
    .map((n) => ({ n, faltan: fila(bandas, n).filter((b) => b === null).length }))
    .filter((t) => t.faltan > 0);
  if (faltanPorTarea.length === 0) return null;
  const total = faltanPorTarea.reduce((s, t) => s + t.faltan, 0);
  const cuantas = total === 1 ? "Te falta 1 nota" : `Te faltan ${total} notas`;
  const donde = faltanPorTarea.length === 1 ? `la tarea ${faltanPorTarea[0].n}` : `las tareas ${enLista(faltanPorTarea.map((t) => String(t.n)))}`;
  return `${cuantas} en ${donde}.`;
}
```

- [ ] **Step 4:** `npx vitest run tests/corregir-notas.test.ts` → PASS; mutaciones hechas.

- [ ] **Step 5: Las pruebas de la pantalla, reescritas en rojo.** En `tests/examen-pantallas.test.tsx`, dentro de `describe("CorregirEscrita: la pantalla de las ocho bandas")`, **sustituir** las cuatro pruebas que hablan de casillas numéricas, cada una con su comentario de mutación reescrito:

  | Prueba de hoy | Pasa a ser |
  |---|---|
  | «trae las ocho casillas y los dos textos» (`type="number"` ×8, `max="3"`) | ocho grupos (`(html.match(/<fieldset/g) ?? []).length` ≥ 8 contando solo los de nota: buscar `name="nota-` ), 32 radios `name="nota-…"`, valores exactamente `0,1,2,3` en cada grupo, y el texto del estudiante |
  | «van de 0 a 3, entero a entero» (`min`/`step`) | ninguna opción fuera de `0..BANDA_MAXIMA`: los `value` de los radios `nota-` son solo `"0"`–`"3"` |
  | «sin corrección previa nacen vacías» (`value=""` ×8) | ningún radio `nota-` lleva `checked=""` |
  | «con corrección previa traen sus valores» | 8 radios `nota-` con `checked=""`; el de `nota-2-3` (tarea 2, cuarto criterio) marcado es el de `value="0"` |

  Los radios se llaman `name="nota-{tarea}-{indiceDelCriterio}"`. Y se añaden:

```ts
// Mutación que la mata: sacar los criterios de otra lista (p. ej. copiar los
// del dibujo, que ponía «Cohesión»).
it("los criterios son exactamente los de CRITERIOS_EE, en su orden", () => {
  const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
  const leyendas = [...html.matchAll(/<legend[^>]*>([^<]+)<\/legend>/g)].map((m) => m[1]);
  const deNotas = leyendas.filter((l) => CRITERIOS_EE.some((c) => c.nombre === l));
  expect(deNotas).toEqual([...CRITERIOS_EE, ...CRITERIOS_EE].map((c) => c.nombre));
  expect(html).not.toContain("Cohesión");
});

// Mutación que la mata: dejar los botones encendidos con notas vacías, o
// apagarlos sin escribir el motivo al lado.
it("sin todas las notas, los dos botones apagados y el motivo escrito", () => {
  const html = renderToStaticMarkup(<CorregirEscrita para={paraCorregirDePrueba()} />);
  expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Guardar<\/button>/);
  expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Guardar y seguir<\/button>/);
  expect(html).toContain("Te faltan 8 notas en las tareas 1 y 2.");
});

// Mutación que la mata: apagarlos siempre.
it("con todas las notas, los dos botones encendidos y sin motivo", () => {
  const html = renderToStaticMarkup(<CorregirEscrita para={yaCorregidaDePrueba()} />);
  expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Guardar/);
  expect(html).not.toContain("Te falta");
});

// Mutación que la mata: quitar la suma, o traducirla a apto/no apto.
it("la suma, arriba, y sin veredicto", () => {
  const html = renderToStaticMarkup(<CorregirEscrita para={yaCorregidaDePrueba()} />);
  expect(html).toContain("17 de 24"); // 3+2+2+1 + 3+3+2+1
  expect(html.toLowerCase()).not.toContain("apto");
});
```

  `yaCorregidaDePrueba()` es un ayudante nuevo junto a `paraCorregirDePrueba` que devuelve lo mismo que usa hoy la prueba «si ya se corrigió, avisa de la fecha…» (bandas `[3, 2, 2, 1]` y `[3, 3, 2, 1]`, `corregidaEn` puesto). Importar `CRITERIOS_EE` en el fichero de pruebas si no lo está.

  **`BotonesDeGuardar`:** si alguna prueba lo pinta suelto, se adapta a su nueva firma (Step 6). Las pruebas de `SalidasDelEstudiante` y de «el enunciado de solo lectura» **no se tocan**; si alguna mira la clase `AVISO_SUAVE`, pasa a mirar `data-salidas` y `role="status"`.

- [ ] **Step 6: La pantalla.** En `components/examen/corregir-escrita.tsx`:
  - Borrar `Bandas`, `tareasIncompletas` y `mensajeDeFaltantes` locales; importar `Bandas`, `sumaDeNotas`, `motivoParaNoGuardar` de `@/components/examen/notas`. `bandasIniciales` se queda. Quitar el import de `piezas` salvo lo que siga usándose (nada, si todo pasa al kit).
  - `SalidasDelEstudiante`: `<p role="status" data-salidas className={AVISO_SUAVE}>` pasa a
    ```tsx
    <div role="status" data-salidas>
      <Aviso tono="aviso">…el mismo texto…</Aviso>
    </div>
    ```
    y el comentario que dice «Lleva el aviso SUAVE» pasa a «Va en coral y no en rojo».
  - `BotonesDeGuardar` recibe también `motivo: string | null`:
    ```tsx
    export function BotonesDeGuardar({ procesando, motivo, alGuardar, alGuardarYSeguir }: {
      procesando: boolean; motivo: string | null; alGuardar: () => void; alGuardarYSeguir: () => void;
    }) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <Boton onClick={alGuardar} disabled={motivo !== null} enviando={procesando} textoEnviando="Guardando…">Guardar</Boton>
          <Boton variante="secundario" onClick={alGuardarYSeguir} disabled={motivo !== null || procesando}>Guardar y seguir</Boton>
          {motivo && <span className="text-sm text-tinta-suave">{motivo}</span>}
        </div>
      );
    }
    ```
    (Solo el primero cambia su texto a «Guardando…»: dos botones diciendo lo mismo confunden.)
  - Un ayudante local, fuera del componente: `function valorDeBanda(bandas: Record<number, Bandas>, tarea: number, i: number): string | null { const b = bandas[tarea]?.[i] ?? null; return b === null ? null : String(b); }`.
  - En `CorregirEscrita`: `const numeros = para.tareas.map((t) => t.numero); const motivo = motivoParaNoGuardar(bandas, numeros); const { suma, maximo } = sumaDeNotas(bandas, numeros);`.
  - El JSX:
    ```tsx
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPagina
        titulo={para.persona.nombre}
        subtitulo={`${para.examen.titulo} · entregada el ${fechaHoraEnPalabras(para.entregadaEn)}${para.porTiempo ? " · por tiempo" : ""}`}
        acciones={<p className="text-lg font-extrabold" data-suma>{suma} de {maximo}</p>}
      />
      {para.corregidaEn !== null && (
        <div role="status">
          <Aviso tono="info">Ya la corregiste el {fechaHoraEnPalabras(para.corregidaEn)}; si guardas, se cambia.</Aviso>
        </div>
      )}
      <SalidasDelEstudiante resumen={para.salidas} />
      {error && <Aviso tono="error">{error}</Aviso>}

      {para.tareas.map((t) => (
        <Tarjeta as="section" key={t.numero} className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">Tarea {t.numero}</h2>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <EnunciadoDeEscrita formulario={t.formulario} opcionElegida={t.opcion} bloqueado />
              <p className="min-w-0 rounded-2xl border border-tinta-suave/20 bg-fondo p-4 whitespace-pre-line">{t.texto}</p>
              <p className="text-sm text-tinta-suave">{t.palabras} palabras</p>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {CRITERIOS_EE.map((criterio, i) => (
                <GrupoDeOpciones
                  key={criterio.clave}
                  nombre={`nota-${t.numero}-${i}`}
                  leyenda={criterio.nombre}
                  ayuda={criterio.ayuda || undefined}
                  forma="segmentos"
                  opciones={Array.from({ length: BANDA_MAXIMA + 1 }, (_, v) => ({ valor: String(v), texto: String(v) }))}
                  valor={valorDeBanda(bandas, t.numero, i)}
                  alCambiar={(v) => cambiarBanda(t.numero, i, Number(v))}
                  disabled={procesando}
                />
              ))}
              <Campo
                multilinea
                id={`comentario-${t.numero}`}
                etiqueta="Comentario"
                rows={4}
                value={comentarios[t.numero] ?? ""}
                disabled={procesando}
                onChange={(e) => setComentarios((actual) => ({ ...actual, [t.numero]: e.target.value }))}
              />
            </div>
          </div>
        </Tarjeta>
      ))}

      <div className="sticky bottom-0 border-t border-tinta-suave/20 bg-fondo py-3">
        <BotonesDeGuardar procesando={procesando} motivo={motivo} alGuardar={() => guardar(false)} alGuardarYSeguir={() => guardar(true)} />
      </div>
    </main>
    ```
  - La prueba de hoy «sin ayuda dictada, no se pinta ningún renglón de ayuda» (`not.toContain("data-ayuda")`) sigue valiendo gracias al `|| undefined`.
  - Actualizar el comentario largo de `CorregirEscrita`: «las ocho casillas» → «las ocho notas», y que los botones ahora vienen apagados con el motivo al lado.

- [ ] **Step 7:** `npx vitest run tests/corregir-notas.test.ts tests/examen-pantallas.test.tsx -t "corregir|Corregir|bandas|salidas"` y `npx tsc --noEmit` en verde; mutaciones hechas (incluida: pasar `valor={… ?? "0"}` y ver en rojo «nacen sin marcar»). Commit:

```bash
git add components/examen/notas.ts components/examen/corregir-escrita.tsx tests/corregir-notas.test.ts tests/examen-pantallas.test.tsx
git commit -m "Corregir: notas 0-3 en botones que nacen vacios, la suma y Guardar apagado con su motivo"
```

---

### Task 6: Exámenes y Estudiantes

**Files:**
- Modify: `app/(sitio)/examenes/page.tsx`, `app/(sitio)/estudiantes/page.tsx`
- Test: `tests/personas-pagina.test.ts`, `tests/examenes-pagina.test.tsx` (nuevo; copiar la forma de mockear de `tests/personas-pagina.test.ts`: `next/headers`, `@/lib/puerta/entrada`, `next/navigation`, y aquí `@/lib/taller/examenes` con `listarExamenes`)

**Interfaces:**
- Produces: `tonoDelExamen(estado: EstadoExamen): Tono | "neutro"` en `lib/carcasa/tonos.ts` (no en la página: una `page.tsx` de Next solo puede exportar lo suyo) (EN_CONSTRUCCION → `"neutro"`, PUBLICADO → `"exito"`, ARCHIVADO → `"neutro"`), con su prueba en `tests/carcasa-tonos.test.ts`.

- [ ] **Step 1: Pruebas en rojo.**
  - `tests/carcasa-tonos.test.ts`: `tonoDelExamen` para los tres estados (mutación: PUBLICADO en `"info"`).
  - `tests/examenes-pagina.test.tsx`:
    - el `<h1>` es «Exámenes» y hay un enlace `href="#nuevo"` con el texto «Nuevo examen»;
    - con un examen PUBLICADO sale «Publicado» y **no** «Borrador» (mutación: copiar el nombre del dibujo);
    - el formulario tiene `id="nuevo"`, un `<label for="titulo-nuevo">` y `<label for="nivel-nuevo">` (mutación: volver al placeholder sin etiqueta);
    - vacío: `"Todavía no hay ningún examen"` dentro de un `BloqueVacio` (el `border-dashed` que lo delata).
  - `tests/personas-pagina.test.ts`:
    - el `<h1>` es «Estudiantes» (mutación: dejar «Personas»);
    - con dos personas, **ningún `<a`** dentro de la `<ul>` (mutación: enlazar las filas a una ficha que no existe);
    - sale el profesor también, con su papel «Profesor» (mutación: filtrar por papel);
    - las iniciales: «Ana Pérez» → `AP` (mutación: sacar solo la primera letra);
    - con `?error=…`, sale en un `role="alert"` (hoy va en azul y sin rol).

- [ ] **Step 2:** `npx vitest run tests/carcasa-tonos.test.ts tests/examenes-pagina.test.tsx tests/personas-pagina.test.ts` → FAIL.

- [ ] **Step 3: Exámenes.**

```tsx
<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
  <EncabezadoPagina titulo="Exámenes" acciones={<Enlace href="#nuevo" comoBoton="principal">Nuevo examen</Enlace>} />
  {examenes.length === 0 ? (
    <BloqueVacio titulo="Todavía no hay ningún examen" texto="Crea el primero con el formulario de abajo." />
  ) : (
    <ul className="flex flex-col gap-3">
      {examenes.map((e) => (
        <li key={e.id}>
          <Link href={`/examenes/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-white p-5 shadow-tarjeta hover:bg-hp-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600">
            <span className="flex min-w-0 flex-col">
              <span className="font-bold">{e.titulo}</span>
              <span className="text-sm text-tinta-suave">{NOMBRE_DE_NIVEL[e.nivel]}</span>
            </span>
            <EtiquetaEstado tono={tonoDelExamen(e.estado)}>{NOMBRE_DEL_ESTADO[e.estado]}</EtiquetaEstado>
          </Link>
        </li>
      ))}
    </ul>
  )}
  <Tarjeta as="section" className="flex flex-col gap-4">
    <h2 id="nuevo" className="scroll-mt-20 text-xl font-bold">Nuevo examen</h2>
    {error && <Aviso tono="error">{error}</Aviso>}
    <form action={crearExamenAccion} className="flex flex-col gap-4">
      <Campo id="titulo-nuevo" name="titulo" etiqueta="Título" required placeholder="Libro de preparación, examen 1" />
      <Desplegable id="nivel-nuevo" name="nivel" etiqueta="Nivel" opciones={nivelesConReglas().map((n) => ({ valor: n, texto: NOMBRE_DE_NIVEL[n] }))} />
      <div><Boton type="submit">Crear el examen</Boton></div>
    </form>
  </Tarjeta>
</main>
```

  La fila entera es el enlace (con clases de tarjeta), no una `Tarjeta` con un `Enlace` dentro: así se pulsa en cualquier sitio de la fila, como hoy. `Link` de `next/link` se queda importado. **Ojo con el `id="nuevo"`**: en la prueba de «el formulario tiene `id="nuevo"`», buscar el `id` en el `<h2>`, que es donde queda.

- [ ] **Step 4: Estudiantes.** Renombrar la función `Personas` → `Estudiantes` (y el import de la prueba). Un ayudante local, no exportado:

```ts
/** «Ana Pérez» → «AP»; «Ana» → «A». Solo presentación. */
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
```

```tsx
<main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
  <EncabezadoPagina titulo="Estudiantes" acciones={<Enlace href="#alta" comoBoton="principal">Dar de alta</Enlace>} />
  <ul className="flex flex-col divide-y divide-tinta-suave/10 rounded-tarjeta bg-white shadow-tarjeta">
    {personas.map((persona) => (
      <li key={persona.id} className="flex items-center gap-3 p-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sol-100 font-bold text-tinta">
          {iniciales(persona.nombre)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold">{persona.nombre}</span>
          <span className="truncate text-sm text-tinta-suave">{persona.correo}</span>
        </span>
        <EtiquetaEstado tono="neutro">{NOMBRE_DEL_PAPEL[persona.papel]}</EtiquetaEstado>
      </li>
    ))}
  </ul>
  <Tarjeta as="section" className="flex flex-col gap-4">
    <h2 id="alta" className="scroll-mt-20 text-xl font-bold">Dar de alta</h2>
    {error && <Aviso tono="error">{error}</Aviso>}
    <form action={crearPersona} className="flex flex-col gap-4">
      <Campo id="alta-nombre" name="nombre" etiqueta="Nombre" required />
      <Campo id="alta-correo" name="correo" etiqueta="Correo" type="email" required autoComplete="email" placeholder="correo@ejemplo.com" />
      <Desplegable id="alta-papel" name="papel" etiqueta="Papel" defaultValue="ESTUDIANTE" opciones={[{ valor: "ESTUDIANTE", texto: "Estudiante" }, { valor: "PROFESOR", texto: "Profesor" }]} />
      <div><Boton type="submit">Dar de alta</Boton></div>
    </form>
  </Tarjeta>
</main>
```

  Si la lista llega vacía (no debería: al menos está el profesor), la `<ul>` sale vacía sin romper nada; no se añade `BloqueVacio`.

- [ ] **Step 5:** las tres pruebas en verde, `npx tsc --noEmit` limpio, mutaciones hechas. Commit:

```bash
git add lib/carcasa/tonos.ts app/\(sitio\)/examenes/page.tsx app/\(sitio\)/estudiantes/page.tsx tests/carcasa-tonos.test.ts tests/examenes-pagina.test.tsx tests/personas-pagina.test.ts
git commit -m "Examenes y Estudiantes con el kit"
```

---

### Task 7: Un examen: detalle, publicación y asignar

**Files:**
- Modify: `app/(sitio)/examenes/[id]/page.tsx`, `components/taller/quien-lo-hace.tsx`, `components/taller/estado-de-la-tarea.tsx`, `lib/carcasa/tonos.ts`
- Test: `tests/carcasa-tonos.test.ts`, y el fichero que ya prueba la pantalla del examen y `QuienLoHace` (localizarlo con `grep -ln "PantallaDelExamen\|QuienLoHace\|data-publicacion" tests/*.tsx`; si es `tests/examen-pantallas.test.tsx`, ir a sus `describe` con `grep -n`)

**Interfaces:**
- Consumes: `GrupoDeOpciones` (Task 1), `Casilla`, `Campo`, `Boton`, `Enlace`, `Aviso`, `EtiquetaEstado`, `Tarjeta`, `EncabezadoPagina`; `tonoDelEstado` (ya existe).
- Produces: `tonoDeTarea(estado: EstadoDeTarea["estado"]): Tono | "neutro"` en `lib/carcasa/tonos.ts` (COMPLETA → `"exito"`, A_MEDIAS → `"aviso"`, VACIA → `"neutro"`). La usa también la Task 8.

- [ ] **Step 1: Pruebas en rojo.**
  - `tonoDeTarea` para los tres estados.
  - Pantalla del examen: con motivos para no publicar, el botón «Publicar» lleva `disabled=""` **y** la lista de motivos **no** lleva ninguna clase `error-` (mutación: pintar los motivos en rojo); «Archivar» lleva la clase de la variante peligro (`bg-coral-600`); sale **un** solo enlace `href="/examenes"` (mutación: dejar dos vueltas); el `<h1>` es el título del examen.
  - Estado de tarea: `InsigniaDeEstado` pinta una `EtiquetaEstado` (la clase `rounded-full border`), «A medias» con `bg-coral-100`.
  - `QuienLoHace`: `name="modo"` con dos radios, el `COMPLETO` con `checked=""` (mutación: nacer en LIBRE); cada casilla con `id="estudiante-<id>"` y `name="estudiante"`; la fecha con `<label for="dia-tope">`; nada de «completo»/«libre» en la lista de asignados (mutación: inventar el modo por asignación).
  - Las pruebas de hoy de `data-publicacion`, `data-asignacion`, «Publícalo primero» y la ficha solo para CE/CO **se quedan**.

- [ ] **Step 2:** correr los ficheros afectados → FAIL.

- [ ] **Step 3: `estado-de-la-tarea.tsx`.** `InsigniaDeEstado` pasa a `return <EtiquetaEstado tono={tonoDeTarea(estado)}>{NOMBRE_DEL_ESTADO[estado]}</EtiquetaEstado>;` (se borra `COLOR`). `EstadoDeLaTarea` pasa su `<section>` a `<Tarjeta as="section" className="flex flex-col gap-2">` y conserva `aria-live="polite"` en un `<div>` interior que envuelve etiqueta y motivos (la `Tarjeta` no pasa atributos). El nombre `InsigniaDeEstado` se queda: lo importan el detalle y el taller.

- [ ] **Step 4: El detalle.** En `app/(sitio)/examenes/[id]/page.tsx` (sin tocar datos ni el orden de las consultas):
  - Borrar la `const CAJA` local. `<nav>← Exámenes</nav>` pasa a `<Enlace href="/examenes">← Exámenes</Enlace>` y la cabecera a `EncabezadoPagina titulo={examen.titulo} subtitulo={[NOMBRE_DE_NIVEL[examen.nivel], textoDelGasto(examen.gasto)].filter(Boolean).join(" · ")}`.
  - `?error` → `<Aviso tono="error">`; `?aviso` → `<div role="status"><Aviso tono="exito">…</Aviso></div>`.
  - El cuerpo en dos columnas:
    ```tsx
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-6">{/* Tareas, Cuadernillo de soluciones, Páginas */}</div>
      <div className="flex min-w-0 flex-col gap-6">{/* Publicación, Quién lo hace */}</div>
    </div>
    ```
    Cada `<section className={CAJA}>` → `<Tarjeta as="section" className="flex min-w-0 flex-col gap-4">` conservando sus `data-publicacion` / `data-asignacion` en un `<div>` interior si hace falta (la `Tarjeta` no pasa atributos): **las pruebas buscan esos `data-`, no deben desaparecer.**
  - Publicación:
    - «Publicado» → `<EtiquetaEstado tono="exito">Publicado</EtiquetaEstado>`.
    - «Archivado: fuera de circulación.» → `<EtiquetaEstado tono="neutro">Archivado</EtiquetaEstado>` y debajo el texto «Fuera de circulación.».
    - Retirar y Recuperar → `<Boton type="submit" variante="secundario">`.
    - Archivar → `<Boton type="submit" variante="peligro">`.
    - Publicar → `<Boton type="submit" disabled={motivos.length > 0}>Publicar</Boton>` (se quita el `opacity-50` a mano), y los motivos en `<Aviso tono="aviso" titulo="Todavía no se puede publicar"><ul className="list-disc pl-5">…</ul></Aviso>`.
  - Tareas: cada fila `<Link>` conserva su `href` y pasa a las clases `flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-tinta-suave/20 p-3 hover:bg-hp-50 focus-visible:outline-2 focus-visible:outline-hp-600`; la etiqueta, con `InsigniaDeEstado` (ya vestida).
  - «Hay N hojas sin etiquetar» → `<Aviso tono="aviso">`.
  - Las `<figure>` de las páginas: `rounded-2xl` → `rounded-tarjeta`, sin más.
  - La tabla del cuadernillo se queda; su «No» pasa de `text-error-600` a `text-coral-600` (que no cuadre no es un fallo del sistema, es algo que revisar).

- [ ] **Step 5: `quien-lo-hace.tsx`.**
  - «Marcar todos» → `<Boton variante="secundario" onClick={…} className="self-start">`.
  - Cada estudiante:
    ```tsx
    <li key={e.id} className="flex flex-wrap items-center gap-x-3">
      <Casilla id={`estudiante-${e.id}`} name="estudiante" value={e.id} etiqueta={e.nombre} checked={marcados.includes(e.id)} onChange={() => …igual que hoy…} />
      {fechaDe.has(e.id) && <span className="text-sm text-tinta-suave">ya lo tiene para el {fechaEnPalabras(fechaDe.get(e.id)!)}</span>}
    </li>
    ```
  - Fecha → `<Campo id="dia-tope" name="dia" type="date" etiqueta="Fecha tope" required className="w-auto" />`.
  - Modo → `<GrupoDeOpciones nombre="modo" leyenda="Cómo lo hace" valorInicial="COMPLETO" opciones={[{ valor: "COMPLETO", texto: "Completo: con reloj, cada audio una vez, y queda la nota." }, { valor: "LIBRE", texto: "Práctica libre: sin reloj, audios repetibles, se corrige tarea a tarea y no queda nota." }]} />`. El comentario de hoy sobre el modo se queda encima.
  - «Asignar» → `<Boton type="submit" className="self-start">Asignar</Boton>`.
  - «Quitárselo» → `<Boton type="submit" variante="secundario">Quitárselo</Boton>`; el comentario de «un botón que cambia algo es siempre un formulario POST» se queda.
  - En cada prueba del asignado: el texto de estado → `<EtiquetaEstado tono={tonoDelEstado(p)}>`; cuando lleva ficha, `<Enlace href=…>` envolviendo la etiqueta.

- [ ] **Step 6:** pruebas en verde, `npx tsc --noEmit` limpio, mutaciones hechas. Commit:

```bash
git add lib/carcasa/tonos.ts app/\(sitio\)/examenes/\[id\]/page.tsx components/taller/quien-lo-hace.tsx components/taller/estado-de-la-tarea.tsx tests/carcasa-tonos.test.ts tests/examen-pantallas.test.tsx
git status --short
git commit -m "Un examen con el kit: dos columnas, publicar en coral y asignar con GrupoDeOpciones"
```

  (Si las pruebas de la pantalla del examen viven en otro fichero, ese va en el `git add` en lugar de `examen-pantallas`.)

---

### Task 8: La hoja y el taller

**Files:**
- Modify: `app/(sitio)/examenes/[id]/hoja/[personaId]/[prueba]/page.tsx`, `app/(sitio)/examenes/[id]/[prueba]/[numero]/page.tsx`, `components/taller/campo.tsx`, `components/taller/formulario-de-tarea.tsx`, `components/taller/formas-abiertas.tsx`, `components/taller/formas-cerradas.tsx`, `components/taller/bloque-de-audio.tsx`, `components/taller/elegir-cuadernillo.tsx`, `components/taller/subir-paginas.tsx`, `components/taller/subir-cuadernillo.tsx`, `components/taller/foto-de-opcion.tsx`, `components/taller/etiquetas-de-pagina.tsx`
- Test: `tests/examen-pantallas.test.tsx` (la hoja, línea ~2057), `tests/taller-formulario.test.tsx`, `tests/taller-ia-campo.test.tsx`

**Interfaces:**
- Consumes: `tonoDeTarea` (Task 7, a través de `InsigniaDeEstado`), el kit.
- Produces: `CampoDelTaller` (antes `Campo`) en `components/taller/campo.tsx`.

**Lo que NO cambia:** el resaltado amarillo de «la IA duda» (`border-sol-400 bg-sol-100`, que vigilan las pruebas de `taller-ia-campo`), el `window.confirm` antes de rellenar con IA, `onda.tsx`, el `<fieldset disabled>` que apaga los campos mientras la IA lee, y la columna pegada de las hojas.

- [ ] **Step 1: Pruebas en rojo.**
  - La hoja (`tests/examen-pantallas.test.tsx`, ~2057): la prueba «la fila donde falló sale marcada en rojo» pasa a llamarse «…en coral», busca `bg-coral-100` y además `not.toContain("bg-error-100")` en las dos variantes. Comentario de mutación: «volver al rojo de error: fallar una pregunta no es un fallo del sistema». Nueva: **un solo** `href="/examenes/ex1"` en la página (mutación: dejar el «← Volver al examen» de abajo).
  - Taller (`tests/taller-formulario.test.tsx`): las pruebas de hoy de «Rellenar con IA» apagado/encendido y de Guardar apagado ya miran el atributo con regex: **deben seguir en verde sin tocarlas**. Nueva: mientras `rellenando`, el botón dice «Leyendo las hojas…» con `aria-busy="true"` (si el estado `rellenando` no se puede fijar desde fuera sin jsdom, en su lugar: el botón de Rellenar lleva la clase de `Boton` secundario `border-hp-300`, mutación: volver a la clase a mano). Y: no queda ninguna clase `bg-hp-400` en la salida del formulario (mutación: dejar el Guardar de hoy).
  - Página del taller: un solo enlace a `/examenes/<id>` y el `<h1>` con `nombreCortoDeTarea`.

- [ ] **Step 2:** correr los tres ficheros → FAIL.

- [ ] **Step 3: La hoja.**
  - `<nav>…</nav>` de arriba → `<Enlace href={`/examenes/${id}`}>← {hoja.titulo}</Enlace>`; **borrar** el `<p>` final con «← Volver al examen».
  - La cabecera → `<EncabezadoPagina titulo={`${hoja.persona.nombre} — ${NOMBRE_CORTO[hoja.prueba]}`} subtitulo={`${hoja.aciertos ?? "—"} de ${hoja.total ?? "—"} aciertos`} />`.
  - `<div className={CAJA}>` → `<Tarjeta className="overflow-x-auto">`; quitar el import de `piezas`.
  - La fila fallada: `bg-error-100` → `bg-coral-100`.

- [ ] **Step 4: La página del taller.** `<nav>` → `<Enlace href={`/examenes/${id}`}>← {tarea.examen.titulo}</Enlace>`; `<h1>` → `<EncabezadoPagina titulo={nombreCortoDeTarea(prueba, n)} />`; «Ninguna hoja lleva esta tarea…» → `<Aviso tono="aviso">`. La `<section>` pegada: su `lg:top-6` se queda (la cabecera no es pegada). `<main>` con `w-full`.

- [ ] **Step 5: `CampoDelTaller`.** En `components/taller/campo.tsx`, renombrar la función `Campo` → `CampoDelTaller`, con un comentario de una línea: «No es el `Campo` del kit: este lleva el resaltado de "la IA duda"». Cambiar sus usos en `formulario-de-tarea.tsx`, `formas-abiertas.tsx`, `formas-cerradas.tsx` y en las pruebas (`grep -rn "Campo\b" components/taller tests/taller-*.tsx` para encontrarlos todos; ojo con no tocar `Campo` del kit si algún fichero lo importa). La constante `CAJA` del taller pasa a `"flex min-w-0 flex-col gap-3 rounded-tarjeta bg-white p-4 shadow-suave"`. Los botones de «Quitar» / «Añadir pauta» de `Pautas` → `<Boton variante="secundario">`.

- [ ] **Step 6: `formulario-de-tarea.tsx`.**
  - `bloqueo` → `<div role="status"><Aviso tono="aviso">{bloqueo}</Aviso></div>`.
  - «Rellenar con IA» → `<Boton variante="secundario" onClick={rellenar} disabled={rellenoApagado} enviando={rellenando} textoEnviando="Leyendo las hojas…">Rellenar con IA</Boton>`. Si `rellenoApagado` ya incluye `rellenando`, está bien que los dos apaguen. Se conserva el `<span>` con el motivo al lado y **se borra** el comentario sobre la clase `disabled:` (ya no aplica: el kit lo resolvió y las pruebas miran el atributo).
  - La lista de dudas → `Tarjeta` con `data-lista-de-dudas` en un `<div>` interior.
  - El error → `<Aviso tono="error">`.
  - Guardar → `<Boton onClick={guardar} disabled={rellenando || bloqueo !== null} enviando={guardando} textoEnviando="Guardando…">Guardar</Boton>`.

- [ ] **Step 7: Los demás del taller**, solo aspecto:
  - `elegir-cuadernillo.tsx`: los dos `<select>` → `Desplegable` (con `id` y `etiqueta`; si hoy tienen `<label>` a mano, su texto pasa a `etiqueta`); Guardar → `<Boton type="submit">`.
  - `subir-cuadernillo.tsx`: el título → `Campo` (`id="cuadernillo-titulo"`, `etiqueta="Título del cuadernillo"`); el `<input type="file">` se queda como está; el aviso `bg-hp-50` → `<div role="status"><Aviso tono="info">`.
  - `subir-paginas.tsx`: los tres botones → `Boton variante="secundario"` (con su `disabled={ocupado}`); el aviso de confirmar `bg-sol-100` → `<Aviso tono="aviso">`; el de `bg-hp-50` → `<div role="status"><Aviso tono="info">`.
  - `foto-de-opcion.tsx`: «Quitar» → `Boton variante="secundario"`; el fondo `bg-sol-100` / `bg-hp-50` de la caja se queda (dice si hay foto o falta).
  - `bloque-de-audio.tsx`: los botones «Oír», «Oír 5 s desde la marca», «Quitar marca» y «Proponer cortes» → `Boton variante="secundario"` con `className="px-3 py-1"`; los `<span role="alert">` → `<Aviso tono="error">`. El fondo `bg-sol-100` del bloque sin audio se queda. Si algún texto dice que las marcas separan «preguntas», pasa a «trozos».
  - `etiquetas-de-pagina.tsx`: el interruptor se queda como `<button>` con `aria-pressed={puesta}` (añadirlo si no lo tiene); su clase encendida pasa de `bg-hp-400` a `bg-hp-700`, y se le añade el foco del kit (`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600`). El `<span role="alert">` → `<Aviso tono="error">`.
  - `formas-abiertas.tsx`: la píldora «Va con:» → `<EtiquetaEstado tono="info">`.

- [ ] **Step 8:** `npx vitest run tests/examen-pantallas.test.tsx tests/taller-formulario.test.tsx tests/taller-ia-campo.test.tsx` y `npx tsc --noEmit` en verde; `grep -rn "bg-hp-400" app components` no devuelve nada fuera de `components/examen/` (las pantallas del estudiante, que son de la B2). Mutaciones hechas. Commit:

```bash
git add app/\(sitio\)/examenes/\[id\]/hoja app/\(sitio\)/examenes/\[id\]/\[prueba\] components/taller tests/examen-pantallas.test.tsx tests/taller-formulario.test.tsx tests/taller-ia-campo.test.tsx
git status --short
git commit -m "La hoja y el taller con el kit; el Campo del taller pasa a CampoDelTaller"
```

---

### Task 9: Cierre (controlador)

- [ ] **Step 1:** `npx tsc --noEmit` limpio; `npm run lint` sin errores.
- [ ] **Step 2:** `npm test` entero, y `npm run test:base` (Postgres de pruebas; incluye `tests/base/entrada.test.ts` de la Task 2).
- [ ] **Step 3:** Comprobaciones de alcance:
  - `grep -rn "min-h-screen" app/\(sitio\) components/examen/corregir-escrita.tsx` vacío.
  - `grep -rln "components/examen/piezas" app/\(sitio\) components/taller components/examen/corregir-escrita.tsx` solo devuelve lo que sigue usando `enLista` (vía `components/examen/notas.ts`).
  - `grep -rn "Cohesión\|Grabación\|Pedir opinión\|Cita oral" app/\(sitio\)/pendientes app/\(sitio\)/estudiantes app/\(sitio\)/examenes components/examen/corregir-escrita.tsx components/taller` vacío. (Lo de «apto» lo vigila la prueba de la Task 5; en comentarios sí puede aparecer.)
- [ ] **Step 4:** Revisión final de toda la rama contra la spec (subagente revisor), tanda de arreglos si hace falta.
- [ ] **Step 5:** Salvar el ledger (`.superpowers/sdd/…` a `~/.claude/projects/-Users-FLE/ledgers-preservados/hispaprofe-dele-2026-09-18-carcasa-entrega-b1/`) antes de retirar el worktree.
- [ ] **Step 6:** Pedir al profesor el sí para fusionar y empujar (la fusión puede necesitar que la haga él con `!`). Tras el despliegue, curl: `/pendientes`, `/examenes`, `/estudiantes` → redirigen a `/entrar` sin sesión; y la aceptación de la spec §8 en hispaprofe.com, en ordenador y en móvil.
