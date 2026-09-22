# La carcasa · Entrega B2 — plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vestir con el kit todo lo que hace el estudiante dentro de una prueba (lectura, auditiva, escrita y resultado), unificar la pregunta de entrega en un `<dialog>` que lista lo que falta, decir la verdad en la ventana de Salir de la práctica libre, y borrar `components/examen/piezas.tsx`.

**Architecture:** No cambia ningún dato, consulta ni acción de servidor. Se añaden: una función pura (`sinResponderPorTarea`), una pieza (`PreguntaDeEntrega`, `<dialog>` calcado de `VentanaDeSalida`), y un parámetro `libre` a `frasesDeSalida`/`CabeceraExamen`. `enLista` pasa a `lib/examen/` y `PestanasDeTarea` a su propio fichero; el resto de `piezas.tsx` se sustituye por el kit y el fichero se borra.

**Tech Stack:** Next 16 (App Router), React 19, Tailwind 4 (`@theme` en `app/globals.css`), Vitest con `renderToStaticMarkup` (sin jsdom).

**Spec:** `docs/superpowers/specs/2026-09-18-carcasa-entrega-b2-design.md`. Siguen valiendo la A (secciones 6 y 7) y la B1 (sección 2). Referencia visual: `docs/diseno/carcasa/02-Pantallas-Estudiante.dc.html`. **Si el dibujo y la spec chocan, manda la spec.**

## Global Constraints

- **Vestir, no rediseñar.** Ninguna consulta, campo, acción de servidor ni dato nuevo. La única excepción es la pregunta de entrega (Task 2 y su uso en las Tasks 4 y 5).
- **No se dibuja lo que no existe:** ni una pregunta a la vez con «Pregunta 3 de 6», ni botón «Guardar»/«Guardando…» como botón en la escrita, ni «Cohesión», ni «Entregada por el reloj, a tiempo», ni grabaciones, citas u oral.
- **No se toca la lógica** del reloj, del guardado de la escrita (`useBorradores`), de las salidas, de la cinta (racionado, `key={tarea.numero}`, pestañas bloqueadas mientras suena) ni de la entrega por tiempo. Los comentarios largos que explican esa lógica **se conservan**.
- Colores, sombras, radio y letra: **solo** los tokens de `app/globals.css`, y dentro de `components/examen/`, `app/examen/` y `app/entrar/` **ninguna** clase `bg-hp-*`, `border-hp-*` ni `text-hp-*` escrita a mano: los colores de marca llegan a través de las piezas del kit (`components/ui/`). Donde haga falta marcar «elegido/abierto» sin pieza del kit (pestañas, números de la barra, opción marcada), se usa `bg-tinta text-white` / `border-tinta`.
- **El tono `error` (rojo) es solo para fallos de verdad.** La respuesta fallada y el aviso de palabras pasadas van en coral (`coral-*` / tono `aviso`). Los últimos 5 minutos del reloj **siguen** en `text-error-600`.
- **Los criterios salen de `CRITERIOS_EE`** (`lib/dele/estructura.ts:177`); «Cohesión» no aparece.
- **Ninguna librería nueva.** Nada de `npm install <algo>`.
- **Todo en español:** identificadores, textos y comentarios.
- **Cada prueba nueva lleva encima su comentario `// Mutación que la mata: …`** y se comprueba de verdad: romper el código a mano, ver la prueba en rojo, deshacer. Renombrar un símbolo NO vale como mutación.
- **Atributos:** `toContain("disabled")` pasa por casualidad con la clase `disabled:…` del kit. Se mira el atributo en la etiqueta (ver `botonQueDice` en `tests/carcasa-cabecera-examen.test.tsx`).
- **Prohibido leer o tocar `node_modules`** y ficheros `.sql`, y prohibido esquivar esa prohibición (renombrar, copiar, `cat` por otra ruta). Si hace falta saber una API de Next o React, se valida con `npx tsc --noEmit`.
- Pruebas acotadas mientras se trabaja: `npx vitest run tests/<fichero> -t "<describe>"`. La suite entera solo en la Task 7.
- Si una prueba existente cambia por el vestido (un texto, una clase), se actualiza **y se dice por qué en su comentario**. No se borra ninguna prueba sin sustituirla por otra que vigile lo mismo.
- Commits con rutas concretas, **nunca `git add -A`**. Antes de cada commit, `git branch --show-current` debe decir `carcasa-b2`. Los mensajes de commit, sin acentos graves (zsh se los come dentro de comillas dobles).
- Trabajar en `/Users/FLE/Projects/hispaprofe-dele-carcasa-b2`. No hacer `git switch` en ninguna otra carpeta.

---

## Mapa de ficheros

| Fichero | Qué cambia |
|---|---|
| `lib/examen/en-lista.ts` | **nuevo**: `enLista` (sale de `piezas.tsx`), con conjunción opcional |
| `components/examen/pestanas-de-tarea.tsx` | **nuevo**: `PestanasDeTarea` (sale de `piezas.tsx`), vestida |
| `components/examen/notas.ts` | importa `enLista` del sitio nuevo |
| `lib/examen/sin-responder.ts` | **nuevo**: `sinResponderPorTarea` (pura) |
| `components/examen/pregunta-de-entrega.tsx` | **nuevo**: `PreguntaDeEntrega` como `<dialog>` |
| `components/carcasa/cabecera-examen.tsx` | `frasesDeSalida` y `CabeceraExamen` aceptan `libre` |
| `components/ui/desplegable.tsx` | acepta `marcador` (opción vacía desactivada) |
| `components/examen/tarea-del-estudiante.tsx` | fallo en coral, opciones y barra con tokens, `Desplegable` |
| `components/examen/cinta.tsx` | `Tarjeta`, `Boton`, `Aviso` |
| `components/examen/hacer-prueba.tsx` | todas las caras vestidas; Entregar con `PreguntaDeEntrega` |
| `components/examen/hacer-escrita.tsx`, `folio.tsx` | todas las caras vestidas; la pregunta pasa a la pieza común |
| `app/examen/[id]/[prueba]/page.tsx` | un `<main>` con ancho máximo |
| `app/entrar/page.tsx`, `app/entrar/enviado/page.tsx` | `Aviso`, `Boton`, `Enlace` |
| `components/examen/piezas.tsx` | **se borra** |
| `tests/carcasa-b2-barrido.test.ts` | **nuevo**: la prueba que busca en los ficheros |

---

### Task 0: Dejar la carpeta lista

La carpeta `hispaprofe-dele-carcasa-b2` nace sin dependencias ni cliente de Prisma.

- [ ] **Step 1:** Desde `/Users/FLE/Projects/hispaprofe-dele-carcasa-b2`: `DIRECT_URL=postgresql://x:x@localhost:5432/x DATABASE_URL=postgresql://x:x@localhost:5432/x npm ci`. El `postinstall` corre `prisma generate`, que falla sin `DIRECT_URL`; la URL falsa vale, no conecta. **No usar `npx prisma` antes de `npm ci`.**
- [ ] **Step 2:** `npx tsc --noEmit` y `npx vitest run tests/examen-pantallas.test.tsx tests/carcasa-cabecera-examen.test.tsx tests/corregir-notas.test.ts` en verde. Es la línea de salida: si algo está rojo aquí, se para y se avisa al controlador.

Sin commit.

---

### Task 1: `enLista` y `PestanasDeTarea` salen de `piezas.tsx`

**Files:**
- Create: `lib/examen/en-lista.ts`, `components/examen/pestanas-de-tarea.tsx`
- Modify: `components/examen/piezas.tsx` (quitarles las dos), `components/examen/notas.ts:2`, `components/examen/hacer-prueba.tsx:21`, `components/examen/hacer-escrita.tsx:17`, `tests/examen-pantallas.test.tsx:11`
- Test: `tests/corregir-notas.test.ts` (añadir), `tests/examen-pantallas.test.tsx` (`describe("las pestañas de las tareas")`, línea ~1080)

**Interfaces:**
- Produces:
  ```ts
  // lib/examen/en-lista.ts
  export function enLista(cosas: string[], conjuncion?: "y" | "ni"): string; // por defecto "y"
  // components/examen/pestanas-de-tarea.tsx ("use client")
  export function PestanasDeTarea(props: {
    tareas: TareaParaHacer[]; abierta: number; alElegir: (numero: number) => void; bloqueadas?: boolean;
  }): JSX.Element;
  ```

- [ ] **Step 1: Las pruebas, en rojo.** En `tests/corregir-notas.test.ts`, un `describe("enLista")` que importe de `@/lib/examen/en-lista`:

```ts
// Mutación que la mata: ignorar la conjunción y pegar siempre «y». La
// pregunta de entrega dice «no has contestado la 8 ni la 9»: con «y» se lee
// como que sí contestó una.
it("junta con «y» por defecto y con «ni» cuando se pide", () => {
  expect(enLista([])).toBe("");
  expect(enLista(["a"])).toBe("a");
  expect(enLista(["a", "b", "c"])).toBe("a, b y c");
  expect(enLista(["la 8", "la 9"], "ni")).toBe("la 8 ni la 9");
});
```

  En el `describe("las pestañas de las tareas")` de `tests/examen-pantallas.test.tsx`, cambiar el import de la línea 11 a `@/components/examen/pestanas-de-tarea` y añadir:

```ts
// Mutación que la mata: volver a pintar la abierta con bg-hp-400 (el coral
// de marca sobre blanco no pasa contraste, y es un color a mano fuera del kit).
it("la abierta se marca con aria-current y sin colores a mano", () => {
  const html = renderToStaticMarkup(<PestanasDeTarea tareas={tareas} abierta={2} alElegir={() => {}} />);
  const abierta = html.match(/<button[^>]*aria-current="true"[^>]*>/)?.[0] ?? "";
  expect(abierta).toContain("bg-tinta");
  expect(html).not.toMatch(/(bg|border|text)-hp-/);
});
```

  (`tareas`: reutilizar el ayudante que ya usa ese `describe`; si no hay, construir dos `TareaParaHacer` con el ayudante de tareas de arriba del fichero.)

- [ ] **Step 2:** `npx vitest run tests/corregir-notas.test.ts tests/examen-pantallas.test.tsx -t "enLista|pestañas"` → FAIL (no existen los ficheros).

- [ ] **Step 3: Mover.**
  - `lib/examen/en-lista.ts`: el comentario largo de `enLista` de `piezas.tsx` (ajustando «Vive aquí» a que es castellano puro y la usan estudiante y profesor) y:

```ts
export function enLista(cosas: string[], conjuncion: "y" | "ni" = "y"): string {
  if (cosas.length <= 1) return cosas[0] ?? "";
  return `${cosas.slice(0, -1).join(", ")} ${conjuncion} ${cosas[cosas.length - 1]}`;
}
```

  - `components/examen/pestanas-de-tarea.tsx`: `"use client"`, el comentario de `PestanasDeTarea` tal cual, y la misma función con esta clase en el `<button>`:

```tsx
className={`rounded-full px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 disabled:cursor-not-allowed disabled:opacity-60 ${
  t.numero === abierta ? "bg-tinta text-white" : "border border-tinta-suave/30 bg-white"
}`}
```

  > El `outline-hp-600` del foco es el mismo que usa `Boton`; es la **única** clase `hp-` permitida fuera del kit, y la prueba de barrido de la Task 6 la exceptúa explícitamente.

  - Quitar `enLista` y `PestanasDeTarea` de `piezas.tsx` (y su import de `TareaParaHacer` si queda sin uso). Actualizar los imports de `notas.ts`, `hacer-prueba.tsx`, `hacer-escrita.tsx` y del test.

- [ ] **Step 4:** Las pruebas del Step 2 → PASS; `npx tsc --noEmit` limpio; mutaciones hechas. Commit:

```bash
git add lib/examen/en-lista.ts components/examen/pestanas-de-tarea.tsx components/examen/piezas.tsx components/examen/notas.ts components/examen/hacer-prueba.tsx components/examen/hacer-escrita.tsx tests/corregir-notas.test.ts tests/examen-pantallas.test.tsx
git commit -m "enLista a lib/examen y PestanasDeTarea a su fichero, vestida"
```

---

### Task 2: `sinResponderPorTarea` y `PreguntaDeEntrega`

**Files:**
- Create: `lib/examen/sin-responder.ts`, `components/examen/pregunta-de-entrega.tsx`
- Test: `tests/pregunta-de-entrega.test.tsx` (**nuevo**)

**Interfaces:**
- Consumes: `enLista` (Task 1); `itemsDelFormulario` de `@/lib/taller/estado` (la misma fuente de números que usa `corregirTareaEnLibre`); `Boton`.
- Produces (lo usan las Tasks 4 y 5):
  ```ts
  // lib/examen/sin-responder.ts
  export function sinResponderPorTarea(tareas: TareaParaHacer[], marcadas: Record<string, string>): string[];
  // components/examen/pregunta-de-entrega.tsx ("use client")
  export function PreguntaDeEntrega(props: {
    abierta: boolean;
    falta: string[];          // frases en minúscula, listas para ir tras «Ojo:»
    enviando: boolean;
    textoSeguir: string;      // «Seguir con la prueba» o «Seguir escribiendo»
    alSi: () => void;
    alNo: () => void;         // también la llama Escape (evento close)
  }): JSX.Element;
  ```

- [ ] **Step 1: Las pruebas, en rojo.** `tests/pregunta-de-entrega.test.tsx`. Para las tareas, copiar de `tests/examen-pantallas.test.tsx` el ayudante que construye una `TareaParaHacer` con `formularioVacio` y rellena preguntas (mirar con `grep -n "function tarea\|function unaTarea\|formularioVacio(" tests/examen-pantallas.test.tsx`); lo que hace falta es una tarea cuyas `itemsDelFormulario` sean, por ejemplo, 1–6 y otra 7–12.

```ts
// Mutación que la mata: contar como respondida una cadena vacía (el
// servidor guarda "" al borrar), o listar las preguntas de todas las
// tareas juntas sin decir de cuál son.
it("dice, tarea a tarea, qué números faltan", () => {
  const falta = sinResponderPorTarea([t1, t2], { "1": "A", "2": "B", "3": "", "4": "C", "5": "A", "6": "B", "7": "A", "8": "B", "9": "C", "10": "A", "11": "B", "12": "C" });
  expect(falta).toEqual(["en la tarea 1 no has contestado la 3"]);
});

// Mutación que la mata: listar las seis una a una cuando no hay ninguna.
it("una tarea entera en blanco se dice de una vez", () => {
  expect(sinResponderPorTarea([t1], {})).toEqual(["no has contestado nada en la tarea 1"]);
});

// Mutación que la mata: juntar con «y».
it("varias sueltas van con «ni»", () => {
  expect(sinResponderPorTarea([t2], { "7": "A", "10": "B", "11": "C", "12": "A" })).toEqual([
    "en la tarea 2 no has contestado la 8 ni la 9",
  ]);
});

// Mutación que la mata: devolver algo con todo contestado.
it("con todo contestado no falta nada", () => {
  const todo = Object.fromEntries([...Array(12)].map((_, i) => [String(i + 1), "A"]));
  expect(sinResponderPorTarea([t1, t2], todo)).toEqual([]);
});

// Mutación que la mata: volver a window.confirm (no se viste ni se prueba),
// o no pintar lo que falta.
it("es un diálogo de la página que lista lo que falta", () => {
  const html = renderToStaticMarkup(
    <PreguntaDeEntrega abierta falta={["la tarea 1 está en blanco", "en la tarea 2 no has contestado la 8 ni la 9"]}
      enviando={false} textoSeguir="Seguir con la prueba" alSi={() => {}} alNo={() => {}} />,
  );
  expect(html).toContain("<dialog");
  expect(html).toContain("Ojo:");
  expect(html).toContain("<li>la tarea 1 está en blanco</li>");
  expect(html).toContain("<li>en la tarea 2 no has contestado la 8 ni la 9</li>");
  expect(html).toContain("¿Entregar de todas formas?");
  expect(html).toContain("Sí, entregar");
  expect(html).toContain("Seguir con la prueba");
});

// Mutación que la mata: dejar el «Ojo:» con la lista vacía.
it("sin nada pendiente solo avisa de que no se puede deshacer", () => {
  const html = renderToStaticMarkup(
    <PreguntaDeEntrega abierta falta={[]} enviando={false} textoSeguir="Seguir escribiendo" alSi={() => {}} alNo={() => {}} />,
  );
  expect(html).not.toContain("Ojo:");
  expect(html).toContain("Entregar no se puede deshacer.");
  expect(html).toContain("Seguir escribiendo");
});

// Mutación que la mata: no apagar «Sí, entregar» mientras envía (segundo
// clic = segunda entrega) o apagar también «Seguir» sin motivo.
it("mientras envía, «Sí, entregar» se apaga y dice que entrega", () => {
  const html = renderToStaticMarkup(
    <PreguntaDeEntrega abierta falta={[]} enviando textoSeguir="Seguir con la prueba" alSi={() => {}} alNo={() => {}} />,
  );
  expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Entregando…<\/button>/);
});
```

- [ ] **Step 2:** `npx vitest run tests/pregunta-de-entrega.test.tsx` → FAIL.

- [ ] **Step 3: El código.**

```ts
// lib/examen/sin-responder.ts
import type { TareaParaHacer } from "@/lib/examen/paraHacer";
import { itemsDelFormulario } from "@/lib/taller/estado";
import { enLista } from "@/lib/examen/en-lista";

/**
 * Lo que queda sin contestar, tarea a tarea, en frases que se leen tras
 * «Ojo:». Una cadena vacía NO cuenta como contestada (el servidor guarda ""
 * al borrar). Los números salen de `itemsDelFormulario`, la misma fuente que
 * corrige: si se contaran de otra forma, la pregunta diría que falta una que
 * la nota da por contestada.
 */
export function sinResponderPorTarea(tareas: TareaParaHacer[], marcadas: Record<string, string>): string[] {
  const falta: string[] = [];
  for (const t of tareas) {
    const numeros = itemsDelFormulario(t.formulario);
    const sin = numeros.filter((n) => (marcadas[String(n)] ?? "").trim() === "");
    if (sin.length === 0) continue;
    if (sin.length === numeros.length) falta.push(`no has contestado nada en la tarea ${t.numero}`);
    else falta.push(`en la tarea ${t.numero} no has contestado ${enLista(sin.map((n) => `la ${n}`), "ni")}`);
  }
  return falta;
}
```

  `components/examen/pregunta-de-entrega.tsx`: calcado de `VentanaDeSalida` (`components/carcasa/cabecera-examen.tsx`): mismo `useRef<HTMLDialogElement>` + `useEffect` que llama `showModal()`/`close()` según `abierta`, `onClose={alNo}`, `aria-labelledby="titulo-de-entregar"`, mismas clases del `<dialog>`. Dentro:

```tsx
<h2 id="titulo-de-entregar" className="text-lg font-bold">¿Entregar ya?</h2>
{falta.length > 0 && (
  <>
    <p className="mt-2">Ojo:</p>
    <ul className="mt-1 list-disc pl-5 text-tinta-suave">
      {falta.map((f) => <li key={f}>{f}</li>)}
    </ul>
    <p className="mt-2">¿Entregar de todas formas?</p>
  </>
)}
<p className="mt-2 text-tinta-suave">Entregar no se puede deshacer.</p>
<div className="mt-4 flex flex-wrap justify-end gap-2">
  <Boton variante="secundario" onClick={alNo} disabled={enviando} autoFocus>{textoSeguir}</Boton>
  <Boton onClick={alSi} enviando={enviando} textoEnviando="Entregando…">Sí, entregar</Boton>
</div>
```

  Con un comentario encima que diga por qué es un `<dialog>` y no un `confirm` (se viste, se prueba, dice qué falta; Escape la cierra y el foco vuelve a «Entregar») y que la entrega por reloj **no** pasa por aquí.

- [ ] **Step 4:** `npx vitest run tests/pregunta-de-entrega.test.tsx` → PASS; mutaciones hechas. Commit:

```bash
git add lib/examen/sin-responder.ts components/examen/pregunta-de-entrega.tsx tests/pregunta-de-entrega.test.tsx
git commit -m "PreguntaDeEntrega como dialog y sinResponderPorTarea"
```

---

### Task 3: La ventana de Salir en la práctica libre

**Files:**
- Modify: `components/carcasa/cabecera-examen.tsx` (`frasesDeSalida` y `CabeceraExamen`)
- Test: `tests/carcasa-cabecera-examen.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  frasesDeSalida(o: { conReloj: boolean; escrita: boolean; libre?: boolean }): string[];
  CabeceraExamen(props: { …las de hoy…; libre?: boolean }) // pasa `libre` a frasesDeSalida
  ```
- La Task 4 pasa `libre` en `PruebaLibre`. La escrita **nunca** lo pasa: en libre la escrita guarda y se entrega de verdad (`lib/examen/paraHacer.ts:52`).

- [ ] **Step 1: Las pruebas, en rojo.** La de «siempre dice que se puede volver» (línea ~25) pasa a recorrer solo `libre: false` y su comentario dice por qué. Nuevas:

```ts
// Mutación que la mata: volver a decir «mientras la prueba no esté
// entregada» en la práctica libre, que nunca se entrega, o callar que lo
// marcado se pierde (Corregir en libre no escribe nada en la base).
it("en la práctica libre dice que no se guarda, y nada de entregar", () => {
  const frases = frasesDeSalida({ conReloj: false, escrita: false, libre: true }).join(" ");
  expect(frases).toContain("Lo que marques en esta práctica no se guarda: al volver empiezas de nuevo.");
  expect(frases).not.toContain("entregada");
});

// Mutación que la mata: tratar libre como «sin reloj» y perder el aviso del
// registro en la escrita de verdad.
it("la escrita con reloj sigue diciendo que queda apuntado", () => {
  expect(frasesDeSalida({ conReloj: true, escrita: true }).join(" ")).toContain("queda apuntado");
});

// Mutación que la mata: no pasar `libre` de CabeceraExamen a frasesDeSalida.
it("la cabecera lleva la frase de la práctica libre a su ventana", () => {
  const html = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 1, total: 4 }} reloj={null} preguntar libre />);
  expect(html).toContain("no se guarda");
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-cabecera-examen.test.tsx` → FAIL.

- [ ] **Step 3:** En `frasesDeSalida`, al principio: `if (libre) return ["Lo que marques en esta práctica no se guarda: al volver empiezas de nuevo."];` y ampliar el comentario de la función (libre de lectura/auditiva no guarda; la escrita nunca llega con `libre`). En `CabeceraExamen`, la prop `libre = false` pasada a `frasesDeSalida({ conReloj: reloj !== null, escrita, libre })`.

- [ ] **Step 4:** PASS; mutaciones hechas. Commit:

```bash
git add components/carcasa/cabecera-examen.tsx tests/carcasa-cabecera-examen.test.tsx
git commit -m "Salir en la practica libre dice que lo marcado no se guarda"
```

---

### Task 4: Lectura y auditiva vestidas

Es la tarea más grande; se hace en dos commits.

**Files:**
- Modify: `components/ui/desplegable.tsx`, `components/examen/tarea-del-estudiante.tsx`, `components/examen/cinta.tsx`, `components/examen/hacer-prueba.tsx`
- Test: `tests/examen-pantallas.test.tsx` (`describe("TareaDelEstudiante")` ~282, `describe("la pantalla que hace el estudiante")` ~632, `describe("la cinta")` ~1024), `tests/ui-kit.test.tsx`

**Interfaces:**
- Consumes: `PestanasDeTarea` (Task 1), `PreguntaDeEntrega`, `sinResponderPorTarea` (Task 2), `CabeceraExamen` con `libre` (Task 3); `Tarjeta`, `Boton`, `Aviso`, `Enlace`, `EtiquetaEstado`, `Desplegable`.
- Produces: `Desplegable` acepta `marcador?: string`: si viene, pinta primero `<option value="" disabled>{marcador}</option>`.

#### 4a — Las piezas: desplegable, tarea y cinta

- [ ] **Step 1: Las pruebas, en rojo.**
  - `tests/ui-kit.test.tsx`:

```ts
// Mutación que la mata: pintar el marcador como opción elegible (elegirlo
// mandaría "" al servidor como si fuera una respuesta).
it("Desplegable con marcador: primera opción vacía y desactivada", () => {
  const html = renderToStaticMarkup(<Desplegable id="d" etiqueta="E" marcador="Elige una letra" opciones={[{ valor: "A", texto: "A" }]} />);
  expect(html).toMatch(/<option value="" disabled="">Elige una letra<\/option>/);
});
```

  - `describe("TareaDelEstudiante")`:

```ts
// Mutación que la mata: volver a pintar la fallada con border-error-600. Una
// respuesta fallada no es un fallo del sistema: va en coral (spec B1 §2).
it("la fallada va en coral, sin el tono de error", () => {
  const html = renderToStaticMarkup(<TareaDelEstudiante tarea={/* la de opciones que ya usan las pruebas de data-fallo */} marcadas={{}} fallos={[1]} bloqueada alMarcar={() => {}} />);
  const caja = html.match(/<section[^>]*data-fallo="1"[^>]*>/)?.[0] ?? "";
  expect(caja).toContain("border-coral-500");
  expect(caja).not.toContain("error");
});

// Mutación que la mata: dejar bg-hp-400/border-hp-400/text-hp-600 a mano.
it("sin colores de marca escritos a mano", () => {
  const html = renderToStaticMarkup(/* la misma tarea, con una marcada: marcadas={{ "1": "A" }} */);
  expect(html).not.toMatch(/(bg|border|text)-hp-/);
});
```

    La prueba de la barra que busca `"respuesta rápida"` (línea ~745) sigue valiendo: la etiqueta visible del `Desplegable` será `Pregunta {n}, respuesta rápida`.
  - `describe("la cinta")`: una prueba que pinte la cinta lista (la que hoy espera «Escuchar el audio», ~1045) y compruebe que el botón «Escuchar el audio» lleva las clases de `clasesDeBoton("principal")` (importar de `@/components/ui/boton`) y que no queda `bg-hp-400`. Mutación: volver a la constante `BOTON` local.

- [ ] **Step 2:** `npx vitest run tests/ui-kit.test.tsx tests/examen-pantallas.test.tsx -t "Desplegable|TareaDelEstudiante|la cinta"` → FAIL.

- [ ] **Step 3: El código.**
  - `desplegable.tsx`: la prop `marcador` y la opción vacía desactivada antes de las demás.
  - `tarea-del-estudiante.tsx`:
    - `CAJA` local → las mismas clases con tokens del kit: `"flex min-w-0 flex-col gap-3 rounded-tarjeta bg-white p-4 shadow-suave"`.
    - `cajaPregunta(fallo)`: `fallo ? "border-coral-500 bg-coral-100/40" : "border-tinta-suave/20"` (con `border` y el resto igual). Ajustar el comentario («coral y con `data-fallo`»).
    - `OpcionRadio`: `borde` elegido → `"border-tinta bg-fondo"`; añadir `accent-tinta` al `<input type="radio">` y `focus-within:outline-2 focus-within:outline-hp-600` al `<label>`.
    - «Noticia N»: `text-hp-600` → `text-tinta-suave`.
    - `BarraDeRespuestas`: número enfocado `bg-tinta text-white` (en vez de `bg-hp-400 text-white`); el `<select>` pasa a `<Desplegable id={`barra-${pregunta.numero}`} etiqueta={`Pregunta ${pregunta.numero}, respuesta rápida`} marcador="Elige una letra" opciones={pregunta.letras.map((l) => ({ valor: l, texto: l }))} value={…} disabled={bloqueada} onChange={…} className="w-full p-3" />`. El `<p>` con el texto de la pregunta se queda.
  - `cinta.tsx`: fuera `CAJA`, `BOTON` y `AVISO_DE_ERROR` locales. La sección `data-cinta` pasa a `<Tarjeta as="section" …>` — `Tarjeta` no reenvía atributos: envolver en `<section data-cinta>` con una `Tarjeta` dentro, o añadir el `data-cinta` a un `<div>` interior; lo que importa es que `data-cinta` siga existiendo (lo miran las pruebas). El botón pasa a `<Boton onClick={avanzar}>`. El error, `<Aviso tono="error">No se pudo preparar el audio. Vuelve a entrar.</Aviso>` (es un fallo de verdad). El comentario de arriba del fichero no se toca.

- [ ] **Step 4:** PASS; `npx tsc --noEmit`; mutaciones hechas. Commit:

```bash
git add components/ui/desplegable.tsx components/examen/tarea-del-estudiante.tsx components/examen/cinta.tsx tests/ui-kit.test.tsx tests/examen-pantallas.test.tsx
git commit -m "La tarea y la cinta del estudiante con el kit; la fallada en coral"
```

#### 4b — Las caras de `hacer-prueba.tsx`

- [ ] **Step 5: Las pruebas, en rojo.** En `describe("la pantalla que hace el estudiante")`, reutilizando las fábricas de pruebas que ya usa (lectura sin empezar, haciendo, entregada, libre):

```ts
// Mutación que la mata: volver a window.confirm en alEntregar. La pregunta
// tiene que ser la de la página, con lo que falta.
it("la lectura a medias trae la pregunta de entrega de la página, cerrada", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={/* lectura HACIENDO */} />);
  expect(html).toContain('aria-labelledby="titulo-de-entregar"');
  expect(html).toContain("Seguir con la prueba");
  expect(html).not.toMatch(/<dialog[^>]*\sopen/);
});

// Mutación que la mata: volver a pintar «Ir a hacerla» como Link con
// text-hp-600 o «te queda» como texto suelto.
it("el resultado dice lo que queda con etiqueta y enlace del kit", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={/* lectura entregada con la escrita pendiente */} />);
  expect(html).toContain("Te queda");
  expect(html).toMatch(/<span[^>]*rounded-full[^>]*>[^<]*Expresión e interacción escritas/); // EtiquetaEstado; usar el NOMBRE_DE_PRUEBA real de EE
  expect(html).toContain("Ir a hacerla");
  expect(html).not.toMatch(/(bg|border|text)-hp-/);
});

// Mutación que la mata: dejar «Se entregó sola» como texto gris suelto.
it("la entrega por tiempo va en un aviso informativo", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={/* entregada porTiempo: true */} />);
  expect(html).toMatch(/border-hp-200[^"]*"[^>]*>(<p[^>]*>)?[^<]*Se entregó sola: se acabó el tiempo\./);
});

// Mutación que la mata: no pasar `libre` a la CabeceraExamen de PruebaLibre.
it("la práctica libre avisa al salir de que no se guarda", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={/* lectura LIBRE */} />);
  expect(html).toContain("no se guarda");
  expect(html).not.toContain("mientras la prueba no esté entregada");
});
```

  Y una de fichero: `expect(readFileSync("components/examen/hacer-prueba.tsx", "utf8")).not.toContain("confirm(")` con su comentario de mutación. Las pruebas de hoy de este `describe` (aviso previo, cinta, barra, nota y fallos, resultado por tarea, «quedan», porTiempo, un solo `data-reloj`, Salir, libre con «Corregir», 404, cierres) **siguen en verde**; si alguna mira un texto que se mueve de etiqueta, se ajusta con su porqué.

  > La expresión de la del aviso informativo depende de cómo pinte `Aviso` su hijo: si no casa, ajustar la regex mirando el HTML real, pero seguir exigiendo que la frase esté **dentro** de la caja `border-hp-200` (tono `info`) y no suelta.

- [ ] **Step 6:** `npx vitest run tests/examen-pantallas.test.tsx -t "la pantalla que hace el estudiante"` → FAIL.

- [ ] **Step 7: El código,** en `hacer-prueba.tsx`, sin tocar ningún comentario de lógica:
  - Imports: fuera `piezas`, fuera `Link`; entran `PestanasDeTarea` (ya en Task 1), `PreguntaDeEntrega`, `sinResponderPorTarea`, `Tarjeta`, `Boton`, `Aviso`, `Enlace`, `EtiquetaEstado`.
  - `AvisoPrevio`: `<Tarjeta as="section" className="flex flex-col gap-4">`; el error `<Aviso tono="error">{error}</Aviso>`; `<Boton onClick={alEmpezar} enviando={enviando} textoEnviando="Empezando…" className="self-start">Empezar</Boton>`.
  - `PruebaHaciendo`:
    - estado nuevo `const [preguntando, setPreguntando] = useState(false);`
    - `alEntregar` se parte: el botón «Entregar» hace `setPreguntando(true)`; la entrega de verdad pasa a `entregarYa()` (el cuerpo de hoy **sin** la `pregunta` ni el `window.confirm`), que llama `PreguntaDeEntrega.alSi`. Tras la entrega, `router.refresh()` como hoy; si vuelve error, `setPreguntando(false)` y se enseña.
    - `totalDePreguntas` y `contarContestadas`: si ya no se usan, borrarlos (`sinResponderPorTarea` los sustituye); `tsc`/lint lo dirán.
    - Debajo del botón: `<PreguntaDeEntrega abierta={preguntando} falta={sinResponderPorTarea(prueba.tareas, marcadas)} enviando={procesando} textoSeguir="Seguir con la prueba" alSi={entregarYa} alNo={() => setPreguntando(false)} />`.
    - `alAcabarse` **no** abre la pregunta (si está abierta, da igual: el refresco lleva al resultado).
    - Error: `<Aviso tono="error">`. «Entregar»: `<Boton onClick={() => setPreguntando(true)} disabled={procesando} className="self-start">Entregar</Boton>`.
  - `Resultado`: `<Tarjeta as="section" className="flex flex-col gap-4">`; «Se entregó sola…» dentro de `<Aviso tono="info">`; «En rojo, las que fallaste» pasa a **«Marcadas en coral, las que fallaste. No se dice cuál era la buena: vuelve al texto y búscala.»**; lo que queda:

```tsx
{queda.length > 0 ? (
  <div className="flex flex-wrap items-center gap-2">
    <span>{queda.length === 1 ? "Te queda" : "Te quedan"}</span>
    {queda.map((o) => <EtiquetaEstado key={o.prueba} tono="aviso">{NOMBRE_DE_PRUEBA[o.prueba]}</EtiquetaEstado>)}
    <Enlace href="/">{queda.length === 1 ? "Ir a hacerla" : "Ir a hacerlas"}</Enlace>
  </div>
) : (
  <p className="font-bold">Ya has terminado el examen.</p>
)}
```

    (Conservar el comentario sobre `otras`.) Si alguna prueba de hoy busca literalmente «Te queda Expresión…» en una sola cadena, se ajusta diciendo por qué.
  - `PruebaEntregada`: sin cambios más allá de lo que hereda.
  - `PruebaLibre`: `<CabeceraExamen … preguntar libre />`; el texto de práctica se queda; la nota «X de Y» en `<Tarjeta className="text-xl font-bold">`; error con `Aviso`; «Corregir» con `<Boton onClick={() => alCorregir(tarea)} enviando={procesando} textoEnviando="Corrigiendo…" className="self-start">Corregir</Boton>`.

- [ ] **Step 8:** `npx vitest run tests/examen-pantallas.test.tsx` → PASS entero; `npx tsc --noEmit`; `npm run lint` sin errores en los ficheros tocados; mutaciones hechas. Commit:

```bash
git add components/examen/hacer-prueba.tsx tests/examen-pantallas.test.tsx
git commit -m "Lectura y auditiva con el kit; Entregar pregunta con la lista de lo que falta"
```

---

### Task 5: La escrita vestida

**Files:**
- Modify: `components/examen/hacer-escrita.tsx`, `components/examen/folio.tsx`, `components/examen/enunciado-de-escrita.tsx` (solo si lleva colores a mano)
- Test: `tests/examen-pantallas.test.tsx` (`describe("la escrita")` ~1238, `describe("el folio")` ~1160)

**Interfaces:**
- Consumes: `PreguntaDeEntrega` (Task 2), `enLista` ya no hace falta aquí si `PreguntaDeEntrega` pinta la lista; `Tarjeta`, `Boton`, `Aviso`.
- `PreguntaDeEntrega` **deja de exportarse** de `hacer-escrita.tsx`: la prueba que la importaba (la de «la pregunta de entrega está escrita en castellano», ~1459) pasa a importar la pieza común y a esperar la lista:

```ts
// Mutación que la mata: volver a «Te falta {falta.join(" y ")}», o pintar la
// lista sin el «Ojo:». Lo lee un chaval de catorce años justo antes de entregar.
it("la pregunta de entrega de la escrita dice lo que falta, en castellano", () => {
  const html = renderToStaticMarkup(
    <PreguntaDeEntrega abierta falta={["la tarea 1 está en blanco", "no has elegido opción en la tarea 2"]}
      enviando={false} textoSeguir="Seguir escribiendo" alSi={() => {}} alNo={() => {}} />,
  );
  expect(html).toContain("Ojo:");
  expect(html).toContain("<li>la tarea 1 está en blanco</li>");
  expect(html).toContain("<li>no has elegido opción en la tarea 2</li>");
  expect(html).toContain("¿Entregar de todas formas?");
  expect(html).toContain("Seguir escribiendo");
});
```

- [ ] **Step 1: Las pruebas, en rojo.** En `describe("la escrita")`, con las fábricas que ya usa:

```ts
// Mutación que la mata: dibujar un botón «Guardar» (se guarda sola: A §6).
it("escribiendo no hay botón Guardar, y Entregar abre la pregunta común", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={/* escrita HACIENDO */} />);
  expect(html).not.toMatch(/<button[^>]*>Guardar/);
  expect(html).toContain('aria-labelledby="titulo-de-entregar"');
  expect(html).toContain("Seguir escribiendo");
});

// Mutación que la mata: el comentario del profesor otra vez en bg-hp-50 a
// mano (o como texto suelto).
it("corregida: el comentario va en un aviso informativo y los criterios son los de CRITERIOS_EE", () => {
  const html = renderToStaticMarkup(<HacerPrueba prueba={/* escrita corregida con comentario "Bien hecho." */} />);
  expect(html).toMatch(/border-hp-200[^>]*>[\s\S]{0,80}Bien hecho\./);
  for (const c of CRITERIOS_EE) expect(html).toContain(c.nombre);
  expect(html).not.toContain("Cohesión");
});
```

  En `describe("el folio")`:

```ts
// Mutación que la mata: volver al rojo de error para las palabras pasadas.
// Pasarse de palabras no es un fallo del sistema: es un aviso (coral).
it("el aviso de palabras pasadas va en coral", () => {
  const html = renderToStaticMarkup(<Folio texto={"palabra ".repeat(200)} rango={{ min: 80, max: 100 }} bloqueado={false} alEscribir={() => {}} />);
  expect(html).toContain("text-coral-600");
  expect(html).not.toContain("text-error-600");
});
```

  Las pruebas de hoy de la escrita (guardado, lo que falta, bandas, `data-ayuda`, libre, salidas apuntadas, el `<details>` abierto) **siguen en verde**.

- [ ] **Step 2:** `npx vitest run tests/examen-pantallas.test.tsx -t "la escrita|el folio"` → FAIL.

- [ ] **Step 3: El código,** sin tocar `useBorradores`, `apagaLosFolios`, `loQueFalta`, el reloj ni ningún comentario de lógica:
  - Imports: fuera `piezas` y `enLista` (si ya no se usa); entran `PreguntaDeEntrega` de `@/components/examen/pregunta-de-entrega`, `Tarjeta`, `Boton`, `Aviso`.
  - `AvisoDeLaEscrita`: igual que `AvisoPrevio` de la Task 4 (`Tarjeta`, `Aviso` de error, `Boton` «Empezar» con `enviando`). El párrafo de las salidas apuntadas se queda **tal cual** (lo miran las pruebas), ahora dentro de un `<Aviso tono="aviso">` porque no es un fallo pero hay que verlo.
  - `TareaDeEscrita`: el `<summary>` pasa de `text-hp-600` a `text-tinta`.
  - Se borra la `PreguntaDeEntrega` local.
  - `EscritaHaciendo`:
    - el cartel del guardado: `{cartel && <p aria-live="polite" className="self-end rounded-full bg-fondo px-3 py-1 text-xs font-bold text-tinta-suave">{cartel}</p>}` justo encima del folio (dentro del bloque de la tarea abierta, no suelto bajo la cabecera). Conservar su comentario ajustándolo.
    - Error con `Aviso tono="error"`.
    - El `confirmando ? … : …` se sustituye por: `<Boton onClick={() => setConfirmando(true)} disabled={procesando} className="self-start">Entregar</Boton>` siempre, y `<PreguntaDeEntrega abierta={confirmando} falta={loQueFalta(prueba, borradores)} enviando={procesando} textoSeguir="Seguir escribiendo" alSi={alEntregar} alNo={() => setConfirmando(false)} />`. `alEntregar` no cambia (ya hace `setConfirmando(false)` si falla el guardado).
  - `EscritaEsperando` y `EscritaCorregida`: `section className={CAJA}` → `<Tarjeta as="section" className="flex flex-col gap-4">`; «Se entregó sola…» en `<Aviso tono="info">`; el comentario del profesor, `<Aviso tono="info" titulo="Tu profesor dice"><p className="whitespace-pre-line">{…}</p></Aviso>`; la caja del texto entregado, `rounded-2xl border border-tinta-suave/20 bg-fondo p-4 whitespace-pre-line`.
  - `folio.tsx:46`: `aviso.pasada ? "text-sm font-bold text-coral-600" : "text-sm text-tinta-suave"`.
  - `enunciado-de-escrita.tsx`: `grep -n "hp-" components/examen/enunciado-de-escrita.tsx`; si hay, a tokens (`tinta`, `fondo`, `border-tinta`).

- [ ] **Step 4:** `npx vitest run tests/examen-pantallas.test.tsx` → PASS entero; `npx tsc --noEmit`; mutaciones hechas. Commit:

```bash
git add components/examen/hacer-escrita.tsx components/examen/folio.tsx components/examen/enunciado-de-escrita.tsx tests/examen-pantallas.test.tsx
git commit -m "La escrita con el kit; su pregunta de entrega pasa a la pieza comun"
```

---

### Task 6: `/entrar`, la página del examen, y adiós a `piezas.tsx`

**Files:**
- Modify: `app/entrar/page.tsx`, `app/entrar/enviado/page.tsx`, `app/examen/[id]/[prueba]/page.tsx`
- Delete: `components/examen/piezas.tsx`
- Create: `tests/carcasa-b2-barrido.test.ts`

- [ ] **Step 1: La prueba de barrido, en rojo.** `tests/carcasa-b2-barrido.test.ts`, con el mismo `ficheros(dir)` recursivo de `tests/carcasa-altura.test.ts` (ampliado a `.ts` y `.tsx`):

```ts
const DEL_ESTUDIANTE = [...ficheros("components/examen"), ...ficheros("app/examen"), ...ficheros("app/entrar")]
  // corregir-escrita.tsx y notas.ts son del profesor (B1), no de esta entrega.
  .filter((f) => !f.endsWith("corregir-escrita.tsx") && !f.endsWith("notas.ts"));

// Mutación que la mata: devolver piezas.tsx o importarlo desde cualquier sitio.
it("piezas.tsx ya no existe y nadie lo importa", () => {
  expect(existsSync("components/examen/piezas.tsx")).toBe(false);
  const todos = [...ficheros("components"), ...ficheros("app"), ...ficheros("lib"), ...ficheros("tests")];
  expect(todos.filter((f) => readFileSync(f, "utf8").includes("examen/piezas"))).toEqual([]);
});

// Mutación que la mata: escribir a mano bg-hp-400 (o cualquier color de marca)
// en una pantalla del estudiante. El foco (focus-visible:outline-hp-600 /
// focus-within:outline-hp-600) es la única excepción: es el mismo del kit.
it("las pantallas del estudiante no escriben colores de marca a mano", () => {
  const culpables = DEL_ESTUDIANTE.filter((f) =>
    /(?<!outline-)(bg|border|text)-hp-\d/.test(readFileSync(f, "utf8")),
  );
  expect(culpables).toEqual([]);
});

// Mutación que la mata: volver a window.confirm en cualquier pantalla del estudiante.
it("nadie pregunta con confirm()", () => {
  expect(DEL_ESTUDIANTE.filter((f) => readFileSync(f, "utf8").includes("confirm("))).toEqual([]);
});

// Mutación que la mata: copiar del dibujo «Cohesión» o un botón «Guardar».
it("ni Cohesión ni botón Guardar en la escrita", () => {
  const escrita = readFileSync("components/examen/hacer-escrita.tsx", "utf8");
  expect(escrita).not.toContain("Cohesión");
  expect(escrita).not.toMatch(/>\s*Guardar\s*</);
});
```

  > Ojo con la regex de colores: `outline-hp-600` NO debe contar, pero `text-hp-600` sí. Comprobar la mutación con los dos casos.

- [ ] **Step 2:** `npx vitest run tests/carcasa-b2-barrido.test.ts` → FAIL (existe `piezas.tsx`; `/entrar` lleva `bg-hp-400`).

- [ ] **Step 3: El código.**
  - Borrar `components/examen/piezas.tsx` (`git rm`). Si `tsc` encuentra a alguien que aún importa `CAJA`/`BOTON`/`AVISO_*`, sustituirlo por el kit como en las Tasks 4–5.
  - `app/entrar/page.tsx`: el aviso a `<Aviso tono="info">{aviso}</Aviso>`; el input a `<Campo id="correo" etiqueta="Tu correo" type="email" name="correo" required autoComplete="email" placeholder="tu@correo.com" />`; el botón a `<Boton type="submit">Mandarme el enlace</Boton>`. Su `min-h-screen` **se queda** (no está bajo la cabecera del sitio).
  - `app/entrar/enviado/page.tsx`: el `Link` con `text-hp-600` a `<Enlace href="/entrar">`.
  - `app/examen/[id]/[prueba]/page.tsx`: envolver lo que devuelve en `<main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">…</main>` (la cabecera del sitio, cuando la hay, queda **fuera** del `main`, igual que en `(sitio)`). Comprobar que las pruebas de la página de `examen-pantallas` que buscan la cabecera siguen en verde.

- [ ] **Step 4:** `npx vitest run tests/carcasa-b2-barrido.test.ts tests/examen-pantallas.test.tsx tests/portada.test.ts` → PASS; mutaciones hechas (incluida la de `outline-hp-600` frente a `text-hp-600`). Commit:

```bash
git add app/entrar/page.tsx app/entrar/enviado/page.tsx "app/examen/[id]/[prueba]/page.tsx" tests/carcasa-b2-barrido.test.ts
git rm components/examen/piezas.tsx
git commit -m "Entrar y la pagina del examen con el kit; se borra piezas.tsx"
```

---

### Task 7: Cierre (controlador)

- [ ] **Step 1:** `npx tsc --noEmit` limpio; `npm run lint` sin errores.
- [ ] **Step 2:** `npm test` entero, y `npm run test:base` (Postgres de pruebas en `.tmp`, corre en el portátil).
- [ ] **Step 3:** Comprobaciones de alcance:
  - `grep -rn "confirm(" components/examen app/examen` vacío.
  - `grep -rnE "(bg|border|text)-hp-[0-9]" components/examen app/examen app/entrar | grep -v corregir-escrita` vacío.
  - `grep -rn "Cohesión\|Grabación\|Pregunta [0-9] de" components/examen app/examen` vacío.
  - `git diff main --stat -- app/examen/acciones.ts lib/` solo enseña `lib/examen/en-lista.ts` y `lib/examen/sin-responder.ts` (ninguna acción ni consulta tocada).
- [ ] **Step 4:** Revisión final de toda la rama contra la spec (subagente revisor), tanda de arreglos si hace falta.
- [ ] **Step 5:** Salvar el ledger (`.superpowers/sdd/…` a `~/.claude/projects/-Users-FLE/ledgers-preservados/hispaprofe-dele-2026-09-18-carcasa-entrega-b2/`) antes de retirar el worktree.
- [ ] **Step 6:** Pedir al profesor el sí para fusionar y empujar (la fusión puede necesitar que la haga él con `!`). Tras el despliegue, curl: `/entrar` 200 y `/examen/x/CE` sin sesión → `/entrar`; y la aceptación de la spec §7 en hispaprofe.com, en ordenador y en móvil.
