# La carcasa · Entrega A — plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una cabecera común para todo el sitio, una cabecera propia mientras corre una prueba, el kit de diez piezas y el Inicio del estudiante rehecho con él.

**Architecture:** Las pantallas con sesión pasan a un grupo de rutas `app/(sitio)/` cuyo `layout` dibuja `Cabecera` (servidor: lee la persona y cuenta Pendientes) y dentro `CabeceraVista` (cliente: menú, sección activa, panel móvil). Qué enlaces ve cada papel y cuál está activo sale de funciones puras en `lib/carcasa/menu.ts`. `/examen/…` queda fuera del grupo: cada cara de la prueba dibuja `CabeceraExamen` con su tarea y su reloj, y la página dibuja `Cabecera` cuando la prueba ya está entregada.

**Tech Stack:** Next 16 (App Router, grupos de rutas, `redirects` en `next.config.ts`), React 19, Tailwind 4 (`@theme` en `app/globals.css`), Vitest con `renderToStaticMarkup` (sin jsdom).

**Spec:** `docs/superpowers/specs/2026-09-18-carcasa-entrega-a-design.md`. Referencia visual: `docs/diseno/carcasa/` (abrir los `.dc.html` en el navegador). **Cuando el paquete y la spec choquen, manda la spec.**

## Global Constraints

- Colores, sombras, radio y letra: **solo** los tokens que ya hay en `app/globals.css` (`hp-*`, `sol-*`, `coral-*`, `verde-*`, `error-*`, `fondo`, `tinta`, `tinta-suave`, `shadow-suave`, `shadow-tarjeta`, `rounded-tarjeta`). No se añade ninguno.
- **Botón principal: fondo `hp-700`, nunca `hp-400`** (letra blanca sobre azul claro no se lee).
- **Ninguna librería nueva.** Nada de `npm install <algo>`.
- **Menús exactos:** estudiante `[Inicio]`; profesor `[Exámenes, Estudiantes, Pendientes]`. Practicar, Mis resultados y Biblioteca no aparecen en ningún sitio.
- **Nunca se escribe «apto».** Los criterios de la escrita salen de `CRITERIOS_EE`.
- **Todo en español:** identificadores, textos y comentarios, como el resto del repo.
- **Cada prueba nueva lleva encima su comentario `// Mutación que la mata: …`** y se comprueba de verdad: romper el código a mano, ver la prueba en rojo, deshacer. Renombrar un símbolo NO vale como mutación (revienta el módulo entero).
- **Aserciones de atributos:** `toContain("disabled")` pasa por casualidad con la clase `disabled:…`. Se mira el atributo recortando la etiqueta (`/<button[^>]*\sdisabled=""/`).
- **Prohibido leer o tocar `node_modules`** y ficheros `.sql`, y prohibido esquivar esa prohibición (renombrar, copiar, `cat` por otra ruta). Si hace falta saber una API de Next, se valida con `npx tsc --noEmit`.
- Pruebas acotadas mientras se trabaja: `npx vitest run tests/<fichero>`. La suite entera solo en la Task 9.
- Commits con rutas concretas, **nunca `git add -A`**. Antes de cada commit, `git branch --show-current` debe decir `carcasa-a`.

---

## Mapa de ficheros

| Fichero | Qué hace |
|---|---|
| `components/ui/boton.tsx` | `Boton` y `clasesDeBoton` |
| `components/ui/enlace.tsx` | `Enlace` (texto o con aspecto de botón) |
| `components/ui/tarjeta.tsx` | `Tarjeta` |
| `components/ui/aviso.tsx` | `Aviso` y el tipo `Tono` |
| `components/ui/etiqueta-estado.tsx` | `EtiquetaEstado` |
| `components/ui/campo.tsx` | `Campo` (input o textarea) |
| `components/ui/casilla.tsx` | `Casilla` |
| `components/ui/desplegable.tsx` | `Desplegable` |
| `components/ui/encabezado-pagina.tsx` | `EncabezadoPagina` |
| `components/ui/bloque-vacio.tsx` | `BloqueVacio` |
| `lib/carcasa/menu.ts` | `enlacesDe`, `seccionActiva`, `inicioDe`, `usaCabeceraDelExamen` (puras) |
| `lib/carcasa/pendientes.ts` | `contarPendientes` (servidor, nunca lanza) |
| `components/carcasa/cabecera.tsx` | `Cabecera` (servidor) |
| `components/carcasa/cabecera-vista.tsx` | `CabeceraVista`, `PanelMovil` (cliente) |
| `components/carcasa/cabecera-examen.tsx` | `CabeceraExamen`, `VentanaDeSalida`, `frasesDeSalida` (cliente) |
| `app/(sitio)/layout.tsx` | dibuja `Cabecera` sobre las pantallas del grupo |
| `app/(sitio)/(inicio)/page.tsx` | el `/` de hoy, movido y rehecho |
| `app/(sitio)/(inicio)/loading.tsx`, `error.tsx` | cargando y error del Inicio |
| `app/(sitio)/pendientes/…` | antes `app/corregir/…` |
| `app/(sitio)/estudiantes/…` | antes `app/personas/…` |
| `app/(sitio)/examenes/…`, `app/(sitio)/pruebas/…` | movidos sin cambiar la dirección |
| `app/(sitio)/muestrario/page.tsx` | el muestrario del kit |
| `next.config.ts` | redirecciones de las direcciones viejas |

---

### Task 0: Dejar la carpeta de la rama lista para trabajar

La carpeta `hispaprofe-dele-carcasa-a` se creó sin dependencias ni cliente de Prisma generado.

- [ ] **Step 1:** Desde `/Users/FLE/Projects/hispaprofe-dele-carcasa-a`, `npm ci`. El `postinstall` corre `prisma generate` y crea `lib/generated/prisma`. **No usar `npx prisma` antes de `npm ci`**: sin `node_modules` baja otra CLI que no tiene `generate`.
- [ ] **Step 2:** `npx tsc --noEmit` y `npx vitest run tests/portada.test.ts` en verde. Es la línea de salida: si algo está rojo aquí, se para y se avisa al controlador.

Sin commit (no cambia ningún fichero seguido por git).

---

### Task 1: El kit de piezas

**Files:**
- Create: los diez ficheros de `components/ui/` del mapa.
- Test: `tests/ui-kit.test.tsx`

**Interfaces:**
- Produces (lo usan las Tasks 4, 5, 6 y 7):
  - `type Variante = "principal" | "secundario" | "peligro"`; `clasesDeBoton(variante?: Variante): string`; `Boton(props: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; enviando?: boolean; textoEnviando?: string })`.
  - `Enlace(props: { href: string; children: ReactNode; comoBoton?: Variante; className?: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">)`.
  - `Tarjeta(props: { as?: "div" | "section" | "li" | "article"; className?: string; children: ReactNode })`.
  - `type Tono = "info" | "exito" | "aviso" | "error"`; `Aviso(props: { tono: Tono; titulo?: string; children?: ReactNode })`.
  - `EtiquetaEstado(props: { tono: Tono | "neutro"; children: ReactNode })`.
  - `Campo(props: { id: string; etiqueta: string; ayuda?: string; error?: string } & ({ multilinea?: false } & InputHTMLAttributes<HTMLInputElement> | { multilinea: true } & TextareaHTMLAttributes<HTMLTextAreaElement>))`.
  - `Casilla(props: { id: string; etiqueta: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">)`.
  - `Desplegable(props: { id: string; etiqueta: string; opciones: { valor: string; texto: string }[] } & SelectHTMLAttributes<HTMLSelectElement>)`.
  - `EncabezadoPagina(props: { titulo: string; subtitulo?: string; acciones?: ReactNode })`.
  - `BloqueVacio(props: { titulo: string; texto?: string; accion?: ReactNode })`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```tsx
// tests/ui-kit.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Boton, clasesDeBoton } from "@/components/ui/boton";
import { Enlace } from "@/components/ui/enlace";
import { Aviso } from "@/components/ui/aviso";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Campo } from "@/components/ui/campo";
import { Desplegable } from "@/components/ui/desplegable";
import { BloqueVacio } from "@/components/ui/bloque-vacio";

/** La etiqueta de apertura del primer <button>, para mirar sus atributos sin
 *  que la clase `disabled:…` de Tailwind cuente como el atributo. */
function aperturaDelBoton(html: string): string {
  return html.match(/<button[^>]*>/)?.[0] ?? "";
}

describe("Boton", () => {
  // Mutación que la mata: volver al hp-400 en el principal. Letra blanca sobre
  // azul claro es lo que no se leía.
  it("el principal es azul oscuro, nunca el claro", () => {
    expect(clasesDeBoton("principal")).toContain("bg-hp-700");
    expect(clasesDeBoton("principal")).not.toContain("bg-hp-400");
  });

  // Mutación que la mata: no apagar el botón mientras envía (doble envío).
  it("enviando se apaga y dice lo que hace", () => {
    const html = renderToStaticMarkup(<Boton enviando textoEnviando="Guardando…">Guardar</Boton>);
    expect(aperturaDelBoton(html)).toMatch(/\sdisabled=""/);
    expect(html).toContain("Guardando…");
    expect(html).not.toContain(">Guardar<");
  });

  // Mutación que la mata: apagarlo siempre (p. ej. `disabled={true}`).
  it("en reposo no está apagado y es type=button por defecto", () => {
    const apertura = aperturaDelBoton(renderToStaticMarkup(<Boton>Guardar</Boton>));
    expect(apertura).not.toMatch(/\sdisabled=""/);
    expect(apertura).toContain('type="button"');
  });

  // Mutación que la mata: quitar las clases de foco de la base.
  it("todas las variantes enseñan el foco del teclado", () => {
    for (const v of ["principal", "secundario", "peligro"] as const) {
      expect(clasesDeBoton(v)).toContain("focus-visible:outline");
    }
  });
});

describe("Enlace", () => {
  // Mutación que la mata: ignorar `comoBoton` y pintar siempre el enlace subrayado.
  it("con comoBoton lleva las clases del botón", () => {
    const html = renderToStaticMarkup(<Enlace href="/x" comoBoton="principal">Empezar</Enlace>);
    expect(html).toContain('href="/x"');
    expect(html).toContain("bg-hp-700");
  });
});

describe("Aviso", () => {
  // Mutación que la mata: dar role=alert a todos (un lector de pantalla
  // interrumpiría por cada aviso informativo) o a ninguno.
  it("solo el de error interrumpe", () => {
    expect(renderToStaticMarkup(<Aviso tono="error">Fallo</Aviso>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Aviso tono="aviso">Tarde</Aviso>)).not.toContain('role="alert"');
  });

  // Mutación que la mata: pintar el tono «aviso» con los colores de error.
  // Llegar tarde no es un fallo del sistema.
  it("el aviso es coral y el error es error", () => {
    expect(renderToStaticMarkup(<Aviso tono="aviso">x</Aviso>)).toContain("coral");
    expect(renderToStaticMarkup(<Aviso tono="aviso">x</Aviso>)).not.toContain("error-");
    expect(renderToStaticMarkup(<Aviso tono="error">x</Aviso>)).toContain("error-");
  });
});

describe("EtiquetaEstado", () => {
  // Mutación que la mata: un tono fijo para todos.
  it("cada tono tiene su color", () => {
    expect(renderToStaticMarkup(<EtiquetaEstado tono="exito">Hecha</EtiquetaEstado>)).toContain("verde");
    expect(renderToStaticMarkup(<EtiquetaEstado tono="aviso">Tarde</EtiquetaEstado>)).toContain("coral");
  });
});

describe("Campo y Desplegable", () => {
  // Mutación que la mata: no atar la etiqueta al control con htmlFor/id.
  it("la etiqueta apunta a su control", () => {
    const campo = renderToStaticMarkup(<Campo id="nombre" etiqueta="Nombre" />);
    expect(campo).toContain('for="nombre"');
    expect(campo).toContain('id="nombre"');
    const lista = renderToStaticMarkup(
      <Desplegable id="modo" etiqueta="Modo" opciones={[{ valor: "COMPLETO", texto: "Completo" }]} />,
    );
    expect(lista).toContain('for="modo"');
    expect(lista).toContain('<option value="COMPLETO">Completo</option>');
  });

  // Mutación que la mata: pintar el error sin atarlo al control (aria-describedby).
  it("el error se ata al control", () => {
    const html = renderToStaticMarkup(<Campo id="c" etiqueta="Correo" error="Falta la arroba." />);
    expect(html).toContain('aria-describedby="c-error"');
    expect(html).toContain('id="c-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  // Mutación que la mata: ignorar `multilinea` y pintar siempre un input.
  it("multilinea es un textarea", () => {
    expect(renderToStaticMarkup(<Campo id="t" etiqueta="Texto" multilinea />)).toContain("<textarea");
  });
});

describe("BloqueVacio", () => {
  // Mutación que la mata: no pintar el título.
  it("dice qué pasa y, si la hay, ofrece la acción", () => {
    const html = renderToStaticMarkup(
      <BloqueVacio titulo="No tienes nada pendiente" texto="Cuando…" accion={<a href="/x">Ir</a>} />,
    );
    expect(html).toContain("No tienes nada pendiente");
    expect(html).toContain('href="/x"');
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/ui-kit.test.tsx` → FALLA (no existen los módulos).

- [ ] **Step 3: Escribir las piezas**

```tsx
// components/ui/boton.tsx
import type { ButtonHTMLAttributes } from "react";

export type Variante = "principal" | "secundario" | "peligro";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const POR_VARIANTE: Record<Variante, string> = {
  principal: "bg-hp-700 text-white hover:bg-hp-600",
  secundario: "border border-hp-300 bg-white text-hp-600 hover:bg-hp-50",
  peligro: "bg-coral-600 text-white hover:bg-coral-500",
};

/** Las clases de un botón, para lo que tiene que parecerlo sin serlo (un enlace). */
export function clasesDeBoton(variante: Variante = "principal"): string {
  return `${BASE} ${POR_VARIANTE[variante]}`;
}

/**
 * Mientras envía se apaga y cambia el texto por lo que está haciendo: un botón
 * que sigue encendido invita al segundo clic, y uno que se apaga sin decir nada
 * parece roto.
 */
export function Boton({
  variante = "principal",
  enviando = false,
  textoEnviando,
  className = "",
  type = "button",
  disabled,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; enviando?: boolean; textoEnviando?: string }) {
  return (
    <button
      {...resto}
      type={type}
      disabled={disabled || enviando}
      aria-busy={enviando || undefined}
      className={`${clasesDeBoton(variante)} ${className}`.trim()}
    >
      {enviando && textoEnviando ? textoEnviando : children}
    </button>
  );
}
```

```tsx
// components/ui/enlace.tsx
import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { clasesDeBoton, type Variante } from "@/components/ui/boton";

const DE_TEXTO =
  "font-bold text-hp-600 underline underline-offset-2 hover:text-hp-700 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600 rounded";

/** Un enlace de Next. Con `comoBoton` se ve como un botón: para ir a algún
 *  sitio, nunca para cambiar nada (Next precarga los enlaces al pintarlos). */
export function Enlace({
  href,
  children,
  comoBoton,
  className = "",
  ...resto
}: { href: string; children: ReactNode; comoBoton?: Variante; className?: string } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const clases = comoBoton ? clasesDeBoton(comoBoton) : DE_TEXTO;
  return (
    <Link {...resto} href={href} className={`${clases} ${className}`.trim()}>
      {children}
    </Link>
  );
}
```

```tsx
// components/ui/tarjeta.tsx
import type { ReactNode } from "react";

export function Tarjeta({
  as: Etiqueta = "div",
  className = "",
  children,
}: {
  as?: "div" | "section" | "li" | "article";
  className?: string;
  children: ReactNode;
}) {
  return <Etiqueta className={`rounded-tarjeta bg-white p-5 shadow-tarjeta ${className}`.trim()}>{children}</Etiqueta>;
}
```

```tsx
// components/ui/aviso.tsx
import type { ReactNode } from "react";

/** «aviso» es coral y es para lo que no es un fallo (llegar tarde, una cita
 *  no preparada); «error» es solo para fallos de verdad. */
export type Tono = "info" | "exito" | "aviso" | "error";

export const COLORES_DE_TONO: Record<Tono, string> = {
  info: "border-hp-200 bg-hp-50 text-hp-700",
  exito: "border-verde-500/40 bg-verde-100 text-verde-600",
  aviso: "border-coral-500/40 bg-coral-100 text-coral-600",
  error: "border-error-500/40 bg-error-100 text-error-600",
};

export function Aviso({ tono, titulo, children }: { tono: Tono; titulo?: string; children?: ReactNode }) {
  return (
    <div role={tono === "error" ? "alert" : undefined} className={`rounded-2xl border p-4 ${COLORES_DE_TONO[tono]}`}>
      {titulo && <p className="font-bold">{titulo}</p>}
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}
```

```tsx
// components/ui/etiqueta-estado.tsx
import type { ReactNode } from "react";
import { COLORES_DE_TONO, type Tono } from "@/components/ui/aviso";

const NEUTRO = "border-tinta-suave/20 bg-fondo text-tinta-suave";

export function EtiquetaEstado({ tono, children }: { tono: Tono | "neutro"; children: ReactNode }) {
  const colores = tono === "neutro" ? NEUTRO : COLORES_DE_TONO[tono];
  return <span className={`inline-flex rounded-full border px-3 py-0.5 text-xs font-bold ${colores}`}>{children}</span>;
}
```

```tsx
// components/ui/campo.tsx
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL =
  "w-full rounded-2xl border border-tinta-suave/30 bg-white px-3 py-2 text-tinta " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hp-600 " +
  "aria-[invalid=true]:border-error-500";

type Comun = { id: string; etiqueta: string; ayuda?: string; error?: string };
type ComoInput = Comun & { multilinea?: false } & InputHTMLAttributes<HTMLInputElement>;
type ComoTexto = Comun & { multilinea: true } & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Campo(props: ComoInput | ComoTexto) {
  const { id, etiqueta, ayuda, error } = props;
  const describe = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const aria = { "aria-describedby": describe, "aria-invalid": error ? true : undefined };
  let control;
  if (props.multilinea) {
    const { id: _i, etiqueta: _e, ayuda: _a, error: _r, multilinea: _m, className = "", ...resto } = props;
    control = <textarea {...resto} {...aria} id={id} className={`${CONTROL} ${className}`.trim()} />;
  } else {
    const { id: _i, etiqueta: _e, ayuda: _a, error: _r, multilinea: _m, className = "", ...resto } = props;
    control = <input {...resto} {...aria} id={id} className={`${CONTROL} ${className}`.trim()} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {etiqueta}
      </label>
      {control}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-sm text-tinta-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-bold text-error-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

```tsx
// components/ui/casilla.tsx
import type { InputHTMLAttributes } from "react";

export function Casilla({
  id,
  etiqueta,
  ...resto
}: { id: string; etiqueta: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2">
      <input
        {...resto}
        id={id}
        type="checkbox"
        className="size-4 accent-hp-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600"
      />
      <span>{etiqueta}</span>
    </label>
  );
}
```

```tsx
// components/ui/desplegable.tsx
import type { SelectHTMLAttributes } from "react";

export function Desplegable({
  id,
  etiqueta,
  opciones,
  className = "",
  ...resto
}: { id: string; etiqueta: string; opciones: { valor: string; texto: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {etiqueta}
      </label>
      <select
        {...resto}
        id={id}
        className={`rounded-2xl border border-tinta-suave/30 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hp-600 ${className}`.trim()}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
```

```tsx
// components/ui/encabezado-pagina.tsx
import type { ReactNode } from "react";

export function EncabezadoPagina({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: string; acciones?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">{titulo}</h1>
        {subtitulo && <p className="text-tinta-suave">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}
```

```tsx
// components/ui/bloque-vacio.tsx
import type { ReactNode } from "react";

export function BloqueVacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-dashed border-tinta-suave/30 bg-white/60 p-8 text-center">
      <p className="text-lg font-bold">{titulo}</p>
      {texto && <p className="text-tinta-suave">{texto}</p>}
      {accion}
    </div>
  );
}
```

- [ ] **Step 4:** `npx vitest run tests/ui-kit.test.tsx` → PASA. `npx tsc --noEmit` limpio. Si `tsc` protesta por las variables `_i`, `_e`… sin usar, cambiarlas por un `omitir` explícito, no desactivar la regla.
- [ ] **Step 5:** Comprobar tres mutaciones a mano (principal a `bg-hp-400`; quitar `|| enviando`; `role="alert"` para todos), ver rojo, deshacer.
- [ ] **Step 6: Commit**

```bash
git branch --show-current   # carcasa-a
git add components/ui tests/ui-kit.test.tsx
git commit -m "El kit de piezas de la carcasa: diez componentes sobre los colores de siempre"
```

---

### Task 2: El menú de cada papel, en funciones puras

**Files:**
- Create: `lib/carcasa/menu.ts`
- Test: `tests/carcasa-menu.test.ts`

**Interfaces:**
- Consumes: `Persona` de `@/lib/generated/prisma`; `estaEntregada` de `@/lib/examen/hacer` **solo si** es pura y no arrastra Prisma. Si arrastra `lib/db`, `usaCabeceraDelExamen` recibe el booleano ya calculado (ver abajo).
- Produces:
  - `type Papel = Persona["papel"]`
  - `type EnlaceDelMenu = { href: string; texto: string; conContador?: true }`
  - `enlacesDe(papel: Papel): EnlaceDelMenu[]`
  - `inicioDe(papel: Papel): string` — `"/"` o `"/pendientes"`
  - `seccionActiva(ruta: string, enlaces: EnlaceDelMenu[]): string | null` — devuelve el `href` activo
  - `usaCabeceraDelExamen(entregada: boolean): boolean`

- [ ] **Step 1: Pruebas que fallan**

```ts
// tests/carcasa-menu.test.ts
import { describe, it, expect } from "vitest";
import { enlacesDe, inicioDe, seccionActiva, usaCabeceraDelExamen } from "@/lib/carcasa/menu";

describe("el menú de cada papel", () => {
  // Mutación que la mata: añadir Practicar (o cualquier sección que no
  // existe) a la lista del estudiante. Se compara la lista ENTERA: con
  // «contiene», una sección de más pasaría en verde.
  it("el estudiante ve exactamente Inicio", () => {
    expect(enlacesDe("ESTUDIANTE").map((e) => [e.href, e.texto])).toEqual([["/", "Inicio"]]);
  });

  // Mutación que la mata: añadir Biblioteca, quitar una, o cambiar el orden.
  it("el profesor ve exactamente Exámenes, Estudiantes y Pendientes", () => {
    expect(enlacesDe("PROFESOR").map((e) => [e.href, e.texto])).toEqual([
      ["/examenes", "Exámenes"],
      ["/estudiantes", "Estudiantes"],
      ["/pendientes", "Pendientes"],
    ]);
  });

  // Mutación que la mata: poner el contador en otro enlace, o en ninguno.
  it("solo Pendientes lleva contador", () => {
    expect(enlacesDe("PROFESOR").filter((e) => e.conContador).map((e) => e.href)).toEqual(["/pendientes"]);
    expect(enlacesDe("ESTUDIANTE").some((e) => e.conContador)).toBe(false);
  });

  // Mutación que la mata: mandar al profesor a "/" (vería un Inicio vacío).
  it("el profesor empieza en Pendientes y el estudiante en Inicio", () => {
    expect(inicioDe("PROFESOR")).toBe("/pendientes");
    expect(inicioDe("ESTUDIANTE")).toBe("/");
  });
});

describe("la sección activa", () => {
  const profesor = enlacesDe("PROFESOR");
  const estudiante = enlacesDe("ESTUDIANTE");

  // Mutación que la mata: comparar solo la ruta exacta (dentro de un examen
  // no se marcaría Exámenes).
  it("se marca también dentro de la sección", () => {
    expect(seccionActiva("/examenes", profesor)).toBe("/examenes");
    expect(seccionActiva("/examenes/abc/CE/1", profesor)).toBe("/examenes");
    expect(seccionActiva("/pendientes/i1", profesor)).toBe("/pendientes");
  });

  // Mutación que la mata: tratar "/" como prefijo (marcaría Inicio en todas).
  it("Inicio solo se marca en /", () => {
    expect(seccionActiva("/", estudiante)).toBe("/");
    expect(seccionActiva("/examen/x1/CE", estudiante)).toBeNull();
  });

  // Mutación que la mata: `startsWith` sin la barra (/examenesX contaría).
  it("un prefijo que no es sección no marca nada", () => {
    expect(seccionActiva("/examenes-viejos", profesor)).toBeNull();
    expect(seccionActiva("/muestrario", profesor)).toBeNull();
  });
});

describe("qué cabecera lleva la pantalla de la prueba", () => {
  // Mutación que la mata: devolver siempre lo mismo.
  it("la del examen mientras no está entregada; la normal después", () => {
    expect(usaCabeceraDelExamen(false)).toBe(true);
    expect(usaCabeceraDelExamen(true)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-menu.test.ts` → FALLA.
- [ ] **Step 3: Implementar**

```ts
// lib/carcasa/menu.ts
import type { Persona } from "@/lib/generated/prisma";

export type Papel = Persona["papel"];
export type EnlaceDelMenu = { href: string; texto: string; conContador?: true };

/**
 * Los menús, y ni un enlace más. Regla dura del sitio: no se dibuja el enlace a
 * una sección que todavía no funciona (el sitio viejo murió enseñando cuatro
 * bloques con tres «en preparación»). Practicar, Mis resultados y Biblioteca
 * entran aquí el día que existan, no antes.
 */
const MENUS: Record<Papel, EnlaceDelMenu[]> = {
  ESTUDIANTE: [{ href: "/", texto: "Inicio" }],
  PROFESOR: [
    { href: "/examenes", texto: "Exámenes" },
    { href: "/estudiantes", texto: "Estudiantes" },
    { href: "/pendientes", texto: "Pendientes", conContador: true },
  ],
};

export function enlacesDe(papel: Papel): EnlaceDelMenu[] {
  return MENUS[papel];
}

/** A dónde lleva la marca «HispaProfe» y dónde cae cada uno al entrar. */
export function inicioDe(papel: Papel): string {
  return papel === "PROFESOR" ? "/pendientes" : "/";
}

/** El href de la sección en la que se está, o null. "/" solo cuenta exacta. */
export function seccionActiva(ruta: string, enlaces: EnlaceDelMenu[]): string | null {
  const activa = enlaces.find((e) =>
    e.href === "/" ? ruta === "/" : ruta === e.href || ruta.startsWith(`${e.href}/`),
  );
  return activa?.href ?? null;
}

/** Mientras la prueba no está entregada corre (o puede correr) un reloj, y la
 *  cabecera normal estorba. Entregada, lo que hay es un resultado. */
export function usaCabeceraDelExamen(entregada: boolean): boolean {
  return !entregada;
}
```

- [ ] **Step 4:** `npx vitest run tests/carcasa-menu.test.ts` → PASA. Mutaciones: añadir Practicar al estudiante; quitar el caso `"/"` de `seccionActiva`; quitar la barra del `startsWith`. Rojo, deshacer.
- [ ] **Step 5: Commit**

```bash
git branch --show-current   # carcasa-a
git add lib/carcasa/menu.ts tests/carcasa-menu.test.ts
git commit -m "El menu de cada papel y la seccion activa, en funciones puras"
```

---

### Task 3: Mover las pantallas al grupo y cambiar los nombres

Solo movimientos y nombres: ninguna pantalla cambia de aspecto todavía.

**Files:**
- Move (con `git mv`, para conservar la historia):
  - `app/page.tsx` → `app/(sitio)/(inicio)/page.tsx`
  - `app/corregir` → `app/(sitio)/pendientes`
  - `app/personas` → `app/(sitio)/estudiantes`
  - `app/examenes` → `app/(sitio)/examenes`
  - `app/pruebas` → `app/(sitio)/pruebas`
- Se quedan donde están: `app/entrar`, `app/examen`, `app/salir`, `app/api`, `app/layout.tsx`, `app/not-found.tsx`, `app/globals.css`.
- Modify: `next.config.ts`, `app/(sitio)/pendientes/acciones.ts` (revalidaciones), `app/(sitio)/estudiantes/acciones.ts` (redirecciones), `components/examen/corregir-escrita.tsx:139` (`router.push`), y todas las importaciones `@/app/corregir/…`, `@/app/personas/…`, `@/app/examenes/…`, `@/app/pruebas/…` y `@/app/page`.
- Test: `tests/carcasa-rutas.test.ts` (nuevo); ajustar `tests/examen-acciones.test.ts:282-283`.

- [ ] **Step 1: Prueba que falla, de las redirecciones**

```ts
// tests/carcasa-rutas.test.ts
import { describe, it, expect } from "vitest";
import configuracion from "@/next.config";

describe("las direcciones viejas llevan a las nuevas", () => {
  // Mutación que la mata: quitar cualquiera de las tres, o hacerla permanente
  // (un 308 se queda grabado en el navegador y no se puede deshacer).
  it("personas y corregir redirigen, sin quedarse grabadas", async () => {
    const reglas = await configuracion.redirects!();
    expect(reglas).toEqual(
      expect.arrayContaining([
        { source: "/personas", destination: "/estudiantes", permanent: false },
        { source: "/corregir", destination: "/pendientes", permanent: false },
        { source: "/corregir/:intentoId", destination: "/pendientes/:intentoId", permanent: false },
      ]),
    );
    expect(reglas).toHaveLength(3);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-rutas.test.ts` → FALLA (`redirects` no existe).
- [ ] **Step 3: Las redirecciones**

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las direcciones cambiaron de nombre para coincidir con el menú (carcasa,
  // Entrega A). Las viejas siguen llevando a las nuevas; no permanentes, para
  // que ningún navegador se las quede grabadas si algún día cambian otra vez.
  async redirects() {
    return [
      { source: "/personas", destination: "/estudiantes", permanent: false },
      { source: "/corregir", destination: "/pendientes", permanent: false },
      { source: "/corregir/:intentoId", destination: "/pendientes/:intentoId", permanent: false },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Mover**

```bash
mkdir -p "app/(sitio)/(inicio)"
git mv app/page.tsx "app/(sitio)/(inicio)/page.tsx"
git mv app/corregir "app/(sitio)/pendientes"
git mv app/personas "app/(sitio)/estudiantes"
git mv app/examenes "app/(sitio)/examenes"
git mv app/pruebas "app/(sitio)/pruebas"
```

- [ ] **Step 5: Arreglar lo que nombra las rutas viejas.** Con `grep -rn` sobre `app components lib tests`:
  - `"@/app/corregir/` → `"@/app/(sitio)/pendientes/`; `"@/app/personas/` → `"@/app/(sitio)/estudiantes/`; `"@/app/examenes/` → `"@/app/(sitio)/examenes/`; `"@/app/pruebas/` → `"@/app/(sitio)/pruebas/`; `"@/app/page"` → `"@/app/(sitio)/(inicio)/page"`. Ojo: `tests/examen-pantallas.test.tsx:1630` lo importa con `await import(…)`, también cuenta.
  - `app/(sitio)/pendientes/acciones.ts:48-49`: `revalidatePath("/corregir")` → `revalidatePath("/pendientes")` y `` revalidatePath(`/corregir/${intentoId}`) `` → `` revalidatePath(`/pendientes/${intentoId}`) ``. Y el test `tests/examen-acciones.test.ts:282-283` igual.
  - `app/(sitio)/estudiantes/acciones.ts:22,32,34`: `/personas` → `/estudiantes` en los tres `redirect`. Buscar en `tests/personas-acciones.test.ts` las mismas cadenas y cambiarlas.
  - `components/examen/corregir-escrita.tsx:139`: `` `/corregir/${para.siguiente}` : "/corregir" `` → `` `/pendientes/${para.siguiente}` : "/pendientes" ``. Buscar en `tests/examen-pantallas.test.tsx` si alguna prueba afirma `/corregir/` y cambiarla.
  - `app/(sitio)/(inicio)/page.tsx`: los `href="/personas"` y `href="/corregir"` → `/estudiantes` y `/pendientes` (la Task 4 los quita del todo, pero la suite tiene que quedar en verde en este commit). Ajustar `tests/portada.test.ts` donde afirme esos `href`.
  - Comentarios que nombran `app/corregir/…` o `app/personas/…` como fichero: actualizar la ruta (`grep -rn "app/corregir\|app/personas" app components lib tests`).
- [ ] **Step 6:** Lo que no puede quedar: `grep -rn '"/corregir\|"/personas\|`/corregir\|`/personas\|@/app/corregir\|@/app/personas\|@/app/examenes\|@/app/pruebas\|"@/app/page"' app components lib tests` solo puede devolver `next.config.ts` y `tests/carcasa-rutas.test.ts`.
- [ ] **Step 7:** `npx tsc --noEmit` limpio; `npx vitest run tests/carcasa-rutas.test.ts tests/portada.test.ts tests/personas-pagina.test.ts tests/personas-acciones.test.ts tests/examen-acciones.test.ts tests/examen-pantallas.test.tsx tests/taller-pantallas.test.ts` en verde.
- [ ] **Step 8: Commit**

```bash
git branch --show-current   # carcasa-a
git add next.config.ts tests/carcasa-rutas.test.ts app components tests
git status --short          # revisar que solo hay movimientos y los cambios de arriba
git commit -m "Las pantallas con sesion pasan al grupo (sitio); personas y corregir se llaman estudiantes y pendientes"
```

(Aquí `git add app components tests` es aceptable porque son exactamente los directorios tocados; se revisa `git status --short` antes de commitear.)

---

### Task 4: La cabecera del sitio

**Files:**
- Create: `lib/carcasa/pendientes.ts`, `components/carcasa/cabecera.tsx`, `components/carcasa/cabecera-vista.tsx`, `app/(sitio)/layout.tsx`
- Modify: `app/(sitio)/(inicio)/page.tsx` (el profesor redirige; fuera la lista de enlaces y el «Salir»), `app/(sitio)/pendientes/page.tsx` (fuera el `<nav>` de «← Inicio», líneas 30-34), `app/(sitio)/pendientes/acciones.ts` (refrescar la cabecera al firmar)
- Test: `tests/carcasa-cabecera.test.tsx` (nuevo); `tests/portada.test.ts` (ajustar)

**Interfaces:**
- Consumes: `enlacesDe`, `inicioDe`, `seccionActiva`, `EnlaceDelMenu`, `Papel` (Task 2); `escritosPorCorregir(ahora: Date)` de `@/lib/examen/corregir`; `personaDeLaPeticion` de `@/lib/puerta/sesion-http`.
- Produces:
  - `contarPendientes(): Promise<number | null>` — null si falla; nunca lanza.
  - `Cabecera({ persona }: { persona: Persona | null }): Promise<JSX.Element | null>` (servidor).
  - `CabeceraVista({ papel, nombre, pendientes }: { papel: Papel; nombre: string; pendientes: number | null })` (cliente).
  - `PanelMovil({ enlaces, activa, nombre, pendientes, alCerrar }: { enlaces: EnlaceDelMenu[]; activa: string | null; nombre: string; pendientes: number | null; alCerrar: () => void })` (cliente, exportado para probarlo abierto).

- [ ] **Step 1: Pruebas que fallan**

```tsx
// tests/carcasa-cabecera.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";

const dobles = vi.hoisted(() => ({
  ruta: { actual: "/" },
  escritosPorCorregir: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => dobles.ruta.actual }));
vi.mock("@/lib/examen/corregir", () => ({ escritosPorCorregir: dobles.escritosPorCorregir }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { Cabecera } from "@/components/carcasa/cabecera";
import { PanelMovil } from "@/components/carcasa/cabecera-vista";
import { contarPendientes } from "@/lib/carcasa/pendientes";
import { enlacesDe } from "@/lib/carcasa/menu";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

async function pintar(persona: Persona | null): Promise<string> {
  const elemento = await Cabecera({ persona });
  return elemento ? renderToStaticMarkup(elemento) : "";
}

/** Los href de los enlaces de navegación (los que llevan data-menu). */
function hrefsDelMenu(html: string): string[] {
  return [...html.matchAll(/<a[^>]*data-menu=""[^>]*href="([^"]+)"|<a[^>]*href="([^"]+)"[^>]*data-menu=""/g)].map((m) => m[1] ?? m[2]!);
}

beforeEach(() => {
  vi.resetAllMocks();
  dobles.ruta.actual = "/";
  dobles.escritosPorCorregir.mockResolvedValue([]);
});

describe("la cabecera", () => {
  // Mutación que la mata: pintar la cabecera sin sesión (la pantalla de
  // entrar y la página sin sesión no la llevan).
  it("sin sesión no se dibuja", async () => {
    expect(await pintar(null)).toBe("");
  });

  // Mutación que la mata: pintar al estudiante el menú del profesor, o
  // cualquier enlace de más. Es la regla dura: ni un enlace que no toque.
  it("el estudiante ve solo Inicio, y ningún enlace de profesor", async () => {
    const html = await pintar(ESTUDIANTE);
    expect(hrefsDelMenu(html)).toEqual(["/"]);
    for (const ajeno of ["/examenes", "/estudiantes", "/pendientes", "/muestrario", "/pruebas/grabar"]) {
      expect(html).not.toContain(`href="${ajeno}"`);
    }
  });

  // Mutación que la mata: olvidar un enlace del profesor o meter uno de más.
  it("el profesor ve Exámenes, Estudiantes y Pendientes", async () => {
    expect(hrefsDelMenu(await pintar(PROFESOR))).toEqual(["/examenes", "/estudiantes", "/pendientes"]);
  });

  // Mutación que la mata: que la marca lleve siempre a "/" (el profesor
  // caería en su redirección, un salto de más).
  it("la marca lleva al inicio de cada papel", async () => {
    expect(await pintar(PROFESOR)).toMatch(/<a[^>]*href="\/pendientes"[^>]*>[^<]*HispaProfe/);
    expect(await pintar(ESTUDIANTE)).toMatch(/<a[^>]*href="\/"[^>]*>[^<]*HispaProfe/);
  });

  // Mutación que la mata: no marcar la sección activa (aria-current).
  it("marca la sección en la que se está", async () => {
    dobles.ruta.actual = "/examenes/x1";
    expect(await pintar(PROFESOR)).toMatch(/<a[^>]*href="\/examenes"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/examenes"/);
  });

  // Mutación que la mata: pintar el número siempre, o no pintarlo nunca.
  it("el número de Pendientes: con aria-label, y sin dibujar el cero", async () => {
    dobles.escritosPorCorregir.mockResolvedValue([{}, {}, {}]);
    const conTres = await pintar(PROFESOR);
    expect(conTres).toContain('aria-label="Por corregir: 3"');
    dobles.escritosPorCorregir.mockResolvedValue([]);
    expect(await pintar(PROFESOR)).not.toContain("Por corregir:");
  });

  // Mutación que la mata: pedir la cola también para el estudiante.
  it("al estudiante no se le cuenta nada", async () => {
    await pintar(ESTUDIANTE);
    expect(dobles.escritosPorCorregir).not.toHaveBeenCalled();
  });

  // Mutación que la mata: dejar que el fallo de la cuenta suba (tumbaría
  // TODAS las pantallas del profesor por un número).
  it("si la cuenta falla, la cabecera sale sin número", async () => {
    dobles.escritosPorCorregir.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await contarPendientes()).toBeNull();
    const html = await pintar(PROFESOR);
    expect(html).toContain('href="/pendientes"');
    expect(html).not.toContain("Por corregir:");
  });

  // Mutación que la mata: quitar el formulario de salir del menú del nombre.
  it("salir es un POST a /salir", async () => {
    expect(await pintar(ESTUDIANTE)).toMatch(/<form[^>]*action="\/salir"[^>]*method="post"|<form[^>]*method="post"[^>]*action="\/salir"/);
  });
});

describe("el panel del móvil", () => {
  // Mutación que la mata: no pintar los enlaces o el salir dentro del panel.
  it("abierto, lleva los enlaces, el nombre, salir y la ✕", () => {
    const html = renderToStaticMarkup(
      <PanelMovil enlaces={enlacesDe("PROFESOR")} activa="/pendientes" nombre="Pablo" pendientes={2} alCerrar={() => {}} />,
    );
    expect(html).toContain('href="/examenes"');
    expect(html).toContain('href="/pendientes"');
    expect(html).toContain("Pablo");
    expect(html).toContain('action="/salir"');
    expect(html).toContain('aria-label="Cerrar el menú"');
    expect(html).toContain('aria-label="Por corregir: 2"');
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-cabecera.test.tsx` → FALLA.
- [ ] **Step 3: La cuenta y la cabecera de servidor**

```ts
// lib/carcasa/pendientes.ts
import { escritosPorCorregir } from "@/lib/examen/corregir";

/**
 * Cuántas redacciones esperan corrección, para el número de la cabecera. Si la
 * cuenta falla devuelve null y la cabecera sale sin número: un número que no
 * se puede contar no puede tumbar todas las pantallas del profesor.
 */
export async function contarPendientes(): Promise<number | null> {
  try {
    return (await escritosPorCorregir(new Date())).length;
  } catch (e) {
    console.error("No se pudo contar Pendientes para la cabecera:", e);
    return null;
  }
}
```

```tsx
// components/carcasa/cabecera.tsx
import type { Persona } from "@/lib/generated/prisma";
import { contarPendientes } from "@/lib/carcasa/pendientes";
import { CabeceraVista } from "@/components/carcasa/cabecera-vista";

/** La cabecera de todo el sitio. Sin sesión no se dibuja. */
export async function Cabecera({ persona }: { persona: Persona | null }) {
  if (!persona) return null;
  const pendientes = persona.papel === "PROFESOR" ? await contarPendientes() : null;
  return <CabeceraVista papel={persona.papel} nombre={persona.nombre} pendientes={pendientes} />;
}
```

- [ ] **Step 4: La parte de cliente**

```tsx
// components/carcasa/cabecera-vista.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { enlacesDe, inicioDe, seccionActiva, type EnlaceDelMenu, type Papel } from "@/lib/carcasa/menu";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hp-600";

function Contador({ n }: { n: number | null }) {
  if (!n) return null;
  return (
    <span aria-label={`Por corregir: ${n}`} className="ml-1 rounded-full bg-coral-600 px-2 text-xs font-bold text-white">
      {n}
    </span>
  );
}

function EnlaceDeMenu({
  enlace,
  activa,
  pendientes,
  alElegir,
}: {
  enlace: EnlaceDelMenu;
  activa: string | null;
  pendientes: number | null;
  alElegir?: () => void;
}) {
  const esActiva = activa === enlace.href;
  return (
    <Link
      data-menu=""
      href={enlace.href}
      aria-current={esActiva ? "page" : undefined}
      onClick={alElegir}
      className={`inline-flex items-center rounded-full px-4 py-2 font-bold ${FOCO} ${
        esActiva ? "bg-hp-50 text-hp-700" : "text-tinta hover:bg-hp-50"
      }`}
    >
      {enlace.texto}
      {enlace.conContador && <Contador n={pendientes} />}
    </Link>
  );
}

function Salir() {
  return (
    <form action="/salir" method="post">
      <button type="submit" className={`rounded-2xl px-3 py-2 font-bold text-coral-600 hover:bg-coral-100 ${FOCO}`}>
        Salir
      </button>
    </form>
  );
}

/** El panel del móvil: cubre la pantalla bajo la barra. Exportado para poder
 *  probarlo abierto sin navegador. */
export function PanelMovil({
  enlaces,
  activa,
  nombre,
  pendientes,
  alCerrar,
}: {
  enlaces: EnlaceDelMenu[];
  activa: string | null;
  nombre: string;
  pendientes: number | null;
  alCerrar: () => void;
}) {
  return (
    <div id="panel-del-menu" className="fixed inset-x-0 bottom-0 top-16 z-20 flex flex-col gap-2 bg-white p-4 md:hidden">
      <button type="button" aria-label="Cerrar el menú" onClick={alCerrar} className={`self-end rounded-full p-2 text-xl ${FOCO}`}>
        ✕
      </button>
      <nav aria-label="Menú" className="flex flex-col gap-1">
        {enlaces.map((e) => (
          <EnlaceDeMenu key={e.href} enlace={e} activa={activa} pendientes={pendientes} alElegir={alCerrar} />
        ))}
      </nav>
      <div className="mt-auto flex items-center justify-between border-t border-tinta-suave/10 pt-4">
        <span className="font-bold">{nombre}</span>
        <Salir />
      </div>
    </div>
  );
}

export function CabeceraVista({ papel, nombre, pendientes }: { papel: Papel; nombre: string; pendientes: number | null }) {
  const ruta = usePathname() ?? "";
  const enlaces = enlacesDe(papel);
  const activa = seccionActiva(ruta, enlaces);
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="border-b border-tinta-suave/10 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href={inicioDe(papel)} className={`text-xl font-extrabold text-hp-700 ${FOCO} rounded`}>
          HispaProfe
        </Link>

        <nav aria-label="Menú" className="hidden flex-1 items-center gap-1 md:flex">
          {enlaces.map((e) => (
            <EnlaceDeMenu key={e.href} enlace={e} activa={activa} pendientes={pendientes} />
          ))}
        </nav>

        {/* El nombre abre un menú con Salir. <details> no necesita estado ni
            efecto, y el teclado lo abre con Intro. */}
        <details className="relative ml-auto hidden md:block">
          <summary className={`cursor-pointer list-none rounded-2xl px-3 py-2 font-bold ${FOCO}`}>{nombre} ▾</summary>
          <div className="absolute right-0 z-20 mt-2 rounded-2xl bg-white p-2 shadow-tarjeta">
            <Salir />
          </div>
        </details>

        <button
          type="button"
          className={`ml-auto rounded-2xl px-3 py-2 font-bold md:hidden ${FOCO}`}
          aria-expanded={abierto}
          aria-controls="panel-del-menu"
          onClick={() => setAbierto(true)}
        >
          Menú
          <Contador n={pendientes} />
        </button>
      </div>
      {abierto && <PanelMovil enlaces={enlaces} activa={activa} nombre={nombre} pendientes={pendientes} alCerrar={() => setAbierto(false)} />}
    </header>
  );
}
```

Nota: en el móvil el `Contador` sale en el botón «Menú» para que el número se vea sin abrir el panel. La prueba de «Por corregir: 3» pasa por el menú de ordenador, que siempre se pinta (se oculta con CSS).

- [ ] **Step 5: El layout del grupo**

```tsx
// app/(sitio)/layout.tsx
import { personaDeLaPeticion } from "@/lib/puerta/sesion-http";
import { Cabecera } from "@/components/carcasa/cabecera";

/**
 * La cabecera de todas las pantallas con sesión. `/examen/…`, `/entrar` y
 * `/salir` quedan FUERA de este grupo a propósito: la prueba dibuja su propia
 * cabecera mientras corre el reloj (spec §5), y entrar no lleva ninguna.
 *
 * Los layouts no se vuelven a pintar al navegar entre sus pantallas: el número
 * de Pendientes se refresca al recargar, al entrar y cuando una acción llama a
 * `revalidatePath("/", "layout")` (firmar una corrección lo hace).
 */
export default async function LayoutDelSitio({ children }: { children: React.ReactNode }) {
  const persona = await personaDeLaPeticion();
  return (
    <>
      <Cabecera persona={persona} />
      {children}
    </>
  );
}
```

- [ ] **Step 6: El profesor en "/" va a Pendientes, y el Inicio suelta lo que ya lleva la cabecera.** En `app/(sitio)/(inicio)/page.tsx`:
  - Importar `redirect` de `next/navigation` e `inicioDe` de `@/lib/carcasa/menu`.
  - Justo después de `const persona = await personaDeLaPeticion();`: `if (persona?.papel === "PROFESOR") redirect(inicioDe("PROFESOR"));`
  - Quitar `esProfesor`, `porCorregir`, la llamada a `escritosPorCorregir` y su importación, y el bloque `<nav className="flex flex-col gap-1">…</nav>` entero (enlaces del profesor **y** el formulario de Salir, que ya está en la cabecera).
  - El `<p>Hola, {persona.nombre}.</p>` y la lista de asignaciones se quedan como están (la Task 5 los rehace).
- [ ] **Step 7: Pendientes sin su «← Inicio».** En `app/(sitio)/pendientes/page.tsx` borrar el `<nav>…← Inicio…</nav>` (líneas 30-34) y la importación de `Link` si deja de usarse.
- [ ] **Step 8: Firmar refresca el número.** En `app/(sitio)/pendientes/acciones.ts`, tras los dos `revalidatePath` de la Task 3, añadir `revalidatePath("/", "layout");` con el comentario: `// La cabecera cuenta Pendientes en el layout, que no se vuelve a pintar al navegar: sin esto, el número seguiría diciendo lo de antes de firmar.` Añadir en `tests/examen-acciones.test.ts`, junto a las líneas 282-283: `expect(dobles.revalidatePath).toHaveBeenCalledWith("/", "layout");` con su comentario de mutación.
- [ ] **Step 9: Ajustar `tests/portada.test.ts`.**
  - Añadir `redirect` al `vi.hoisted` (lanzando `new Error(\`REDIRECT:${ruta}\`)`, como en `tests/personas-pagina.test.ts`) y `vi.mock("next/navigation", () => ({ redirect }))`.
  - Borrar las pruebas del profesor en la portada que ya no aplican: «el profesor sí ve el enlace a personas», «solo el profesor ve el enlace al taller», «un estudiante no ve las pantallas de prueba y el profesor sí», «al profesor no se le piden asignaciones» y el `describe` ««Por corregir» en la portada del profesor» entero. **Lo que protegían pasa a `tests/carcasa-cabecera.test.tsx`.**
  - La de «con sesión, saluda por su nombre y ofrece salir»: el saludo sigue, pero ya no se afirma `href="/salir"` en la portada (Salir vive en la cabecera).
  - Añadir:

```ts
  // Mutación que la mata: quitar el redirect del profesor (vería un Inicio
  // vacío, sin nada suyo).
  it("el profesor en / va a Pendientes, sin pedir nada", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);

    await expect(Portada()).rejects.toThrow("REDIRECT:/pendientes");
    expect(asignacionesDe).not.toHaveBeenCalled();
    expect(cerrarLasQueSePasaron).not.toHaveBeenCalled();
  });
```

- [ ] **Step 10:** `npx vitest run tests/carcasa-cabecera.test.tsx tests/portada.test.ts tests/examen-acciones.test.ts tests/examen-pantallas.test.tsx` en verde; `npx tsc --noEmit` limpio. Mutaciones: estudiante con el menú del profesor; `Contador` que pinta el 0; quitar el `try` de `contarPendientes`; quitar el `redirect`. Rojo, deshacer.
- [ ] **Step 11: Commit**

```bash
git branch --show-current   # carcasa-a
git add lib/carcasa/pendientes.ts components/carcasa/cabecera.tsx components/carcasa/cabecera-vista.tsx "app/(sitio)/layout.tsx" "app/(sitio)/(inicio)/page.tsx" "app/(sitio)/pendientes/page.tsx" "app/(sitio)/pendientes/acciones.ts" tests/carcasa-cabecera.test.tsx tests/portada.test.ts tests/examen-acciones.test.ts
git commit -m "La cabecera del sitio: menu por papel, numero de Pendientes y el profesor empieza en Pendientes"
```

---

### Task 5: El Inicio del estudiante, con el kit

**Files:**
- Modify: `app/(sitio)/(inicio)/page.tsx`
- Create: `app/(sitio)/(inicio)/loading.tsx`, `app/(sitio)/(inicio)/error.tsx`, `lib/carcasa/tonos.ts`
- Test: `tests/portada.test.ts` (añadir), `tests/carcasa-tonos.test.ts` (nuevo)

**Interfaces:**
- Consumes: `Tarjeta`, `EtiquetaEstado`, `Enlace`, `BloqueVacio`, `Aviso`, `Boton`, `Tono` (Task 1); `AsignacionDelEstudiante`, `EstadoDeUnaPrueba` de `@/lib/examen/asignar`.
- Produces: `tonoDelEstado(estado: EstadoDeUnaPrueba | undefined): Tono | "neutro"`; `varianteDelBoton(estado: EstadoDeUnaPrueba | undefined): "principal" | "secundario"`.

- [ ] **Step 1: Pruebas que fallan**

```ts
// tests/carcasa-tonos.test.ts
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { tonoDelEstado, varianteDelBoton } from "@/lib/carcasa/tonos";

const con = (estado: "SIN_EMPEZAR" | "HACIENDO" | "ENTREGADA") => ({
  prueba: "CE" as const,
  estado: { estado, aciertos: null, total: null, porTiempo: false },
  texto: "",
});

describe("el color del estado de cada prueba", () => {
  // Mutación que la mata: un tono fijo, o «entregada» en el tono de error.
  it("sin empezar, a medias y entregada se distinguen", () => {
    expect(tonoDelEstado(con("SIN_EMPEZAR"))).toBe("neutro");
    expect(tonoDelEstado(con("HACIENDO"))).toBe("info");
    expect(tonoDelEstado(con("ENTREGADA"))).toBe("exito");
    expect(tonoDelEstado(undefined)).toBe("neutro");
  });

  // Mutación que la mata: el mismo botón para repasar que para empezar.
  it("repasar es secundario; empezar, seguir y practicar son principales", () => {
    expect(varianteDelBoton(con("ENTREGADA"))).toBe("secundario");
    expect(varianteDelBoton(con("SIN_EMPEZAR"))).toBe("principal");
    expect(varianteDelBoton(con("HACIENDO"))).toBe("principal");
    expect(varianteDelBoton(undefined)).toBe("principal");
  });
});
```

Si el tipo real de `estado.estado` tiene más valores que esos tres (mirar `EstadoDeUnaPrueba` en `lib/examen/asignar.ts` y `estaEntregada` en `lib/examen/hacer.ts`), cada valor entregado va a `"exito"` y los que no, según su sentido; la prueba se amplía con ellos.

Y en `tests/portada.test.ts`, dentro de «Inicio del estudiante»:

```ts
  // Mutación que la mata: pintar el plazo pasado con el tono de error. La
  // fecha es blanda: llegar tarde no es un fallo del sistema.
  it("el plazo pasado sale en coral, no en rojo de error", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([{ ...ASIGNADO, fechaTope: new Date("2020-01-01T00:00:00Z") }]);

    const marcado = await html();
    const trozo = marcado.slice(Math.max(0, marcado.indexOf("Se pasó el plazo") - 300), marcado.indexOf("Se pasó el plazo"));
    expect(trozo).toContain("coral");
    expect(trozo).not.toContain("error-");
  });

  // Mutación que la mata: volver al bg-hp-400 de antes en los botones.
  it("los botones de las pruebas son del kit, azul oscuro", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    asignacionesDe.mockResolvedValue([ASIGNADO]);

    const marcado = await html();
    expect(marcado).toContain("bg-hp-700");
    expect(marcado).not.toContain("bg-hp-400");
  });
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-tonos.test.ts tests/portada.test.ts` → FALLAN las nuevas.
- [ ] **Step 3: Los tonos**

```ts
// lib/carcasa/tonos.ts
import type { EstadoDeUnaPrueba } from "@/lib/examen/asignar";
import type { Tono } from "@/components/ui/aviso";

/** El color de la etiqueta de cada prueba en el Inicio. Sin estado es modo
 *  libre de lectura/auditiva: no hay nada que colorear. */
export function tonoDelEstado(estado: EstadoDeUnaPrueba | undefined): Tono | "neutro" {
  if (!estado) return "neutro";
  if (estado.estado.estado === "HACIENDO") return "info";
  if (estado.estado.estado === "SIN_EMPEZAR") return "neutro";
  return "exito";
}

/** Repasar lo hecho es secundario; lo que queda por hacer, principal. */
export function varianteDelBoton(estado: EstadoDeUnaPrueba | undefined): "principal" | "secundario" {
  return estado && estado.estado.estado !== "SIN_EMPEZAR" && estado.estado.estado !== "HACIENDO" ? "secundario" : "principal";
}
```

(Si `lib/examen/asignar.ts` arrastra Prisma al importarse, el `vi.mock("@/lib/db")` de la prueba lo cubre; los tipos se importan con `import type` y no cargan nada.)

- [ ] **Step 4: El Inicio.** En `app/(sitio)/(inicio)/page.tsx`, la parte con sesión del estudiante pasa a:

```tsx
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <EncabezadoPagina titulo={`Hola, ${persona.nombre}`} subtitulo="¿Qué tienes que hacer hoy?" />
      {asignaciones.length === 0 ? (
        <BloqueVacio titulo="No tienes nada pendiente" texto="Cuando el profesor te asigne un examen, aparecerá aquí." />
      ) : (
        <ul className="flex flex-col gap-4">
          {asignaciones.map((a) => (
            <Tarjeta as="li" key={a.examenId}>
              <h2 className="text-xl font-bold">{a.titulo}</h2>
              <p className="text-tinta-suave">{NOMBRE_DE_NIVEL[a.nivel]}</p>
              {estaFueraDePlazo(a.fechaTope, ahora) ? (
                <div className="mt-2">
                  <EtiquetaEstado tono="aviso">{`Se pasó el plazo el ${fechaEnPalabras(a.fechaTope)}.`}</EtiquetaEstado>
                </div>
              ) : (
                <p>{`Para el ${fechaEnPalabras(a.fechaTope)}.`}</p>
              )}
              <ul className="mt-3 flex flex-col gap-3 border-t border-tinta-suave/10 pt-3">
                {PRUEBAS_QUE_SE_HACEN.map((prueba) => {
                  const deLaPrueba = a.pruebas.find((p) => p.prueba === prueba);
                  return (
                    <li key={prueba} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{NOMBRE_CORTO[prueba]}</span>
                        {deLaPrueba && <EtiquetaEstado tono={tonoDelEstado(deLaPrueba)}>{deLaPrueba.texto}</EtiquetaEstado>}
                      </span>
                      {/* Enlace y no botón: solo lleva a la pantalla; Next precarga los enlaces. */}
                      <Enlace href={`/examen/${a.examenId}/${prueba}`} comoBoton={varianteDelBoton(deLaPrueba)}>
                        {textoDelBoton(deLaPrueba)}
                      </Enlace>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          ))}
        </ul>
      )}
    </main>
```

  - La rama **sin sesión** se queda como está (título y «Entrar»).
  - `textoDelBoton` no cambia. `cerrarLasQueSePasaron` sigue ANTES de `asignacionesDe`.
  - La prueba «sin nada asignado lo dice en una línea» sigue pasando («No tienes nada pendiente»).
  - Si alguna prueba de la portada busca el texto exacto `Hola, Ana.` (con punto), cambiarla a `Hola, Ana`.

- [ ] **Step 5: Cargando y error**

```tsx
// app/(sitio)/(inicio)/loading.tsx
/** Un esqueleto mientras llegan los exámenes: dos tarjetas grises. Solo cubre
 *  el Inicio (está en su propio grupo), no las demás pantallas. */
export default function Cargando() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando tu inicio">
      <div className="h-8 w-48 animate-pulse rounded-2xl bg-hp-100" />
      <div className="h-40 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
      <div className="h-40 animate-pulse rounded-tarjeta bg-white shadow-tarjeta" />
    </main>
  );
}
```

```tsx
// app/(sitio)/(inicio)/error.tsx
"use client";

import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";

export default function ErrorDelInicio({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Aviso tono="error" titulo="No hemos podido cargar tu inicio">
        Comprueba tu conexión e inténtalo otra vez.
      </Aviso>
      <div>
        <Boton onClick={() => reset()}>Reintentar</Boton>
      </div>
    </main>
  );
}
```

  Si `npx tsc --noEmit` protesta por la firma de `error.tsx` en Next 16 (la prop de reintentar puede llamarse distinto), usar la que pida `tsc`, sin mirar `node_modules`, y dejarlo dicho en el informe.

- [ ] **Step 6:** `npx vitest run tests/carcasa-tonos.test.ts tests/portada.test.ts` en verde; `npx tsc --noEmit` limpio. Mutaciones: plazo pasado con `tono="error"`; `varianteDelBoton` que devuelve siempre `"principal"`. Rojo, deshacer.
- [ ] **Step 7: Commit**

```bash
git branch --show-current   # carcasa-a
git add lib/carcasa/tonos.ts "app/(sitio)/(inicio)" tests/carcasa-tonos.test.ts tests/portada.test.ts
git commit -m "El Inicio del estudiante con el kit: tarjetas, estados de color y el plazo pasado en coral"
```

---

### Task 6: La cabecera del examen y la ventana de salir

**Files:**
- Create: `components/carcasa/cabecera-examen.tsx`
- Modify: `components/examen/hacer-prueba.tsx`, `components/examen/hacer-escrita.tsx`, `components/examen/piezas.tsx` (borrar `VolverAInicio`), `app/examen/[id]/[prueba]/page.tsx`
- Test: `tests/carcasa-cabecera-examen.test.tsx` (nuevo); `tests/examen-pantallas.test.tsx` (reescribir las pruebas de «Volver a Inicio» y del aviso del reloj)

**Contexto que el implementador necesita (leído del código el 18 sep):**
- `HacerPrueba` (`hacer-prueba.tsx:409`) elige la cara en 430-434: `PruebaLibre` / `AvisoPrevio` / `PruebaEntregada` / `PruebaHaciendo`. La EE sale antes (426) hacia `HacerEscrita`. El armazón pinta `<VolverAInicio …/>` en 438.
- La tarea abierta es estado LOCAL de cada cara: `const [tareaAbierta, setTareaAbierta] = useState(...)` en `PruebaHaciendo` (151), `PruebaEntregada` (321) y `PruebaLibre` (352); en la escrita, en `EscritaHaciendo` (588). N es `prueba.tareas.length`. Por eso **la cabecera del examen se dibuja dentro de cada cara**, no en el armazón.
- El reloj: `PruebaHaciendo` 226-228 y `EscritaHaciendo` 668-675 (`conReloj && prueba.segundosQueQuedan !== null`, al lado del cartel de guardado). La auditiva no tiene reloj (`minutos: null`); el modo libre tampoco.
- El registro de salidas de la escrita cuelga del **desmontaje** de `EscritaHaciendo` (`hacer-escrita.tsx` 268-297 y 389-419), no del `<Link>`. Un `router.push("/")` también desmonta, así que registra igual. **No se toca nada de `useBorradores`.**
- Nombres: `NOMBRE_CORTO` (`Lectura`, `Auditiva`, `Escrita`, `Oral`) y `NOMBRE_DE_PRUEBA` (en minúscula) en `lib/dele/estructura.ts`.

**Interfaces:**
- Consumes: `Boton` (Task 1); `usaCabeceraDelExamen` (Task 2); `Cabecera` (Task 4); `Prueba` y `NOMBRE_CORTO` de `@/lib/dele/estructura`.
- Produces:
  - `frasesDeSalida({ conReloj, escrita }: { conReloj: boolean; escrita: boolean }): string[]`
  - `VentanaDeSalida({ abierta, frases, alSeguir, alSalir }: { abierta: boolean; frases: string[]; alSeguir: () => void; alSalir: () => void })`
  - `CabeceraExamen({ prueba, tarea, reloj, preguntar, escrita }: { prueba: Prueba; tarea: { actual: number; total: number } | null; reloj: ReactNode | null; preguntar: boolean; escrita?: boolean })`

**Decisión que concreta la spec §5:** en el aviso previo («antes de empezar») no hay nada en juego, así que «Salir» es un enlace directo a `/` (`preguntar={false}`). La ventana sale solo con la prueba en curso: `PruebaHaciendo`, `PruebaLibre` y `EscritaHaciendo`.

- [ ] **Step 1: Pruebas que fallan**

```tsx
// tests/carcasa-cabecera-examen.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { CabeceraExamen, VentanaDeSalida, frasesDeSalida } from "@/components/carcasa/cabecera-examen";

const APUNTADO = "Salir queda apuntado";

describe("lo que dice la ventana de salir", () => {
  // Mutación que la mata: decir lo del reloj en práctica libre (no hay reloj),
  // o callárselo con reloj.
  it("el reloj solo se nombra cuando corre", () => {
    expect(frasesDeSalida({ conReloj: true, escrita: false }).join(" ")).toContain("El reloj sigue corriendo aunque salgas.");
    expect(frasesDeSalida({ conReloj: false, escrita: false }).join(" ")).not.toContain("reloj");
  });

  // Mutación que la mata: quitar la frase de «queda apuntado» en la escrita,
  // o decirla en la lectura (allí no se apunta nada) o en libre.
  it("solo la escrita con reloj avisa de que queda apuntado", () => {
    expect(frasesDeSalida({ conReloj: true, escrita: true }).join(" ")).toContain(APUNTADO);
    expect(frasesDeSalida({ conReloj: true, escrita: false }).join(" ")).not.toContain(APUNTADO);
    expect(frasesDeSalida({ conReloj: false, escrita: true }).join(" ")).not.toContain(APUNTADO);
  });

  // Mutación que la mata: quitar la frase que tranquiliza.
  it("siempre dice que se puede volver", () => {
    for (const conReloj of [true, false]) {
      for (const escrita of [true, false]) {
        expect(frasesDeSalida({ conReloj, escrita }).join(" ")).toContain("Podrás volver a entrar");
      }
    }
  });
});

describe("la ventana", () => {
  // Mutación que la mata: usar window.confirm (no se puede vestir ni probar)
  // o no pintar los dos botones.
  it("es un diálogo de la página con sus dos salidas", () => {
    const html = renderToStaticMarkup(
      <VentanaDeSalida abierta frases={["Uno.", "Dos."]} alSeguir={() => {}} alSalir={() => {}} />,
    );
    expect(html).toContain("<dialog");
    expect(html).toContain("¿Seguro que quieres salir?");
    expect(html).toContain("Seguir la prueba");
    expect(html).toContain("Salir de todos modos");
    expect(html).toContain("Uno.");
  });
});

describe("la cabecera del examen", () => {
  // Mutación que la mata: pintar un hueco de reloj vacío en libre, o no pintar
  // el que llega.
  it("lleva el reloj que le pasan, y ninguno si no le pasan", () => {
    const con = renderToStaticMarkup(
      <CabeceraExamen prueba="CE" tarea={{ actual: 2, total: 4 }} reloj={<p data-reloj="60">Te quedan 1:00</p>} preguntar />,
    );
    expect(con).toContain("data-reloj");
    const sin = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 2, total: 4 }} reloj={null} preguntar />);
    expect(sin).not.toContain("data-reloj");
    expect(sin).not.toContain("Te quedan");
  });

  // Mutación que la mata: no enseñar la tarea, o enseñar la total como actual.
  it("dice la prueba y la tarea abierta", () => {
    const html = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 2, total: 4 }} reloj={null} preguntar />);
    expect(html).toContain("Lectura");
    expect(html).toContain("Tarea 2 de 4");
  });

  // Mutación que la mata: dejar un enlace directo a Inicio con la prueba en
  // curso (se saldría sin la pregunta).
  it("en curso, Salir es un botón que pregunta; antes de empezar, un enlace", () => {
    const enCurso = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={{ actual: 1, total: 4 }} reloj={null} preguntar />);
    expect(enCurso).not.toContain('href="/"');
    expect(enCurso).toMatch(/<button[^>]*>Salir<\/button>/);
    const antes = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={null} reloj={null} preguntar={false} />);
    expect(antes).toContain('href="/"');
  });

  // Mutación que la mata: no pasar `escrita` a las frases.
  it("la de la escrita con reloj lleva la frase de apuntado", () => {
    const html = renderToStaticMarkup(
      <CabeceraExamen prueba="EE" tarea={{ actual: 1, total: 2 }} reloj={<p data-reloj="60">x</p>} preguntar escrita />,
    );
    expect(html).toContain(APUNTADO);
  });

  // Mutación que la mata: meter el menú o el nombre del estudiante.
  it("no lleva menú ni nombre", () => {
    const html = renderToStaticMarkup(<CabeceraExamen prueba="CE" tarea={null} reloj={null} preguntar={false} />);
    expect(html).not.toContain("data-menu");
    expect(html).not.toContain('action="/salir"');
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-cabecera-examen.test.tsx` → FALLA.
- [ ] **Step 3: La pieza**

```tsx
// components/carcasa/cabecera-examen.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { NOMBRE_CORTO, type Prueba } from "@/lib/dele/estructura";
import { Boton, clasesDeBoton } from "@/components/ui/boton";

/**
 * Lo que dice la ventana antes de salir. El reloj solo se nombra si corre; lo
 * de «queda apuntado» solo en la escrita con reloj, que es la única prueba que
 * registra las salidas (en práctica libre no se apunta nada, y decirlo sería
 * mentir).
 */
export function frasesDeSalida({ conReloj, escrita }: { conReloj: boolean; escrita: boolean }): string[] {
  const frases: string[] = [];
  if (conReloj) frases.push("El reloj sigue corriendo aunque salgas.");
  frases.push("Podrás volver a entrar mientras la prueba no esté entregada.");
  if (conReloj && escrita) {
    frases.push("Salir queda apuntado, y tu profesor ve cuántas veces saliste y cuánto tiempo estuviste fuera.");
  }
  return frases;
}

/**
 * La pregunta, como <dialog> de la página y no como confirm() del navegador:
 * se viste, se prueba, Escape la cierra (evento `cancel` → onClose) y el
 * navegador devuelve el foco al botón que la abrió. Abrirla o cerrarla con
 * «Seguir la prueba» NO desmonta la pantalla de la prueba, así que no apunta
 * ninguna salida: lo que apunta es irse de verdad.
 */
export function VentanaDeSalida({
  abierta,
  frases,
  alSeguir,
  alSalir,
}: {
  abierta: boolean;
  frases: string[];
  alSeguir: () => void;
  alSalir: () => void;
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ventana.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ventana}
      onClose={alSeguir}
      aria-labelledby="titulo-de-salir"
      className="m-auto max-w-md rounded-tarjeta p-6 shadow-tarjeta backdrop:bg-tinta/40"
    >
      <h2 id="titulo-de-salir" className="text-lg font-bold">
        ¿Seguro que quieres salir?
      </h2>
      {frases.map((f) => (
        <p key={f} className="mt-2 text-tinta-suave">
          {f}
        </p>
      ))}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Boton variante="secundario" onClick={alSeguir} autoFocus>
          Seguir la prueba
        </Boton>
        <Boton variante="peligro" onClick={alSalir}>
          Salir de todos modos
        </Boton>
      </div>
    </dialog>
  );
}

/**
 * La cabecera mientras se hace una prueba: sustituye del todo a la del sitio.
 * Ni menú ni nombre. Se dibuja DENTRO de cada cara porque la tarea abierta es
 * estado de la cara. `reloj` es el <Reloj> de la cara, que se mueve aquí: en
 * pantalla solo puede haber uno.
 */
export function CabeceraExamen({
  prueba,
  tarea,
  reloj,
  preguntar,
  escrita = false,
}: {
  prueba: Prueba;
  tarea: { actual: number; total: number } | null;
  reloj: ReactNode | null;
  preguntar: boolean;
  escrita?: boolean;
}) {
  const router = useRouter();
  const [preguntando, setPreguntando] = useState(false);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tarjeta bg-white px-4 py-3 shadow-suave">
      <p className="font-bold">
        {NOMBRE_CORTO[prueba]}
        {tarea && (
          <>
            <span className="hidden sm:inline">{` · Tarea ${tarea.actual} de ${tarea.total}`}</span>
            <span className="sm:hidden">{` · ${tarea.actual}/${tarea.total}`}</span>
          </>
        )}
      </p>
      {reloj && <div className="ml-auto">{reloj}</div>}
      <div className={reloj ? "" : "ml-auto"}>
        {preguntar ? (
          <Boton variante="secundario" onClick={() => setPreguntando(true)}>
            Salir
          </Boton>
        ) : (
          <Link href="/" className={clasesDeBoton("secundario")}>
            Salir
          </Link>
        )}
      </div>
      {preguntar && (
        <VentanaDeSalida
          abierta={preguntando}
          frases={frasesDeSalida({ conReloj: reloj !== null, escrita })}
          alSeguir={() => setPreguntando(false)}
          alSalir={() => router.push("/")}
        />
      )}
    </header>
  );
}
```

Nota: la prueba «Tarea 2 de 4» busca el texto de ordenador; el de móvil (`2/4`) va en su propio `span`. La prueba de «en curso» mira `<button …>Salir</button>`: si `Boton` mete espacios o hijos alrededor del texto, ajustar la expresión a la etiqueta real sin aflojar lo que comprueba.

- [ ] **Step 4: Meterla en las caras de `hacer-prueba.tsx`**
  - `AvisoPrevio`: primera línea del JSX devuelto, `<CabeceraExamen prueba={prueba.prueba} tarea={null} reloj={null} preguntar={false} />`.
  - `PruebaHaciendo`: sustituir el bloque 226-228 (el `<Reloj>` suelto) por

```tsx
      <CabeceraExamen
        prueba={prueba.prueba}
        tarea={{ actual: tarea.numero, total: prueba.tareas.length }}
        reloj={
          prueba.minutos !== null && prueba.segundosQueQuedan !== null ? (
            <Reloj segundos={prueba.segundosQueQuedan} alAcabarse={alAcabarse} />
          ) : null
        }
        preguntar
      />
```

    (`tarea` es la variable de la línea 222; si se declara después de donde se pinta, usarla igual: está en el mismo cuerpo de función antes del `return`).
  - `PruebaLibre`: primera línea del JSX devuelto, `<CabeceraExamen prueba={prueba.prueba} tarea={{ actual: tarea.numero, total: prueba.tareas.length }} reloj={null} preguntar />`.
  - `PruebaEntregada`: **nada** (la página pinta la cabecera normal).
  - Armazón `HacerPrueba`: borrar `<VolverAInicio …/>` (438) y su importación; actualizar el comentario de 422-425, que nombra `<VolverAInicio>`.
- [ ] **Step 5: Meterla en las caras de `hacer-escrita.tsx`**
  - `AvisoDeLaEscrita`: primera línea, `<CabeceraExamen prueba={prueba.prueba} tarea={null} reloj={null} preguntar={false} />`.
  - `EscritaHaciendo`: en el bloque 668-675, el `<Reloj>` sale de ahí y entra en la cabecera; el cartel de guardado se queda donde estaba:

```tsx
      <CabeceraExamen
        prueba={prueba.prueba}
        tarea={{ actual: tareaAbierta, total: prueba.tareas.length }}
        reloj={conReloj && prueba.segundosQueQuedan !== null ? <Reloj segundos={prueba.segundosQueQuedan} alAcabarse={alAcabarse} /> : null}
        preguntar
        escrita
      />
      {cartel && <p className="text-sm text-tinta-suave">{cartel}</p>}
```

  - `EscritaEsperando` y `EscritaCorregida`: nada.
  - Armazón `HacerEscrita`: borrar `<VolverAInicio …/>` (851) y su comentario (848-850).
  - **Los comentarios de `useBorradores` que dicen «← Volver a Inicio» es un <Link>** (271-276, 389-397, 404-416): cambiar el nombre de la puerta a «el Salir de la cabecera del examen (router.push, también navegación de cliente)», sin tocar ni una línea de código de esos efectos.
  - El texto del aviso previo (479) «o vuelves a Inicio, queda apuntado» se queda: sigue siendo verdad.
- [ ] **Step 6: Borrar `VolverAInicio`** de `components/examen/piezas.tsx` (97-108) e `import Link` si deja de usarse. `grep -rn VolverAInicio app components` debe dar vacío.
- [ ] **Step 7: La página pinta la cabecera normal con la prueba entregada.** En `app/examen/[id]/[prueba]/page.tsx`:

```tsx
import { Cabecera } from "@/components/carcasa/cabecera";
import { usaCabeceraDelExamen } from "@/lib/carcasa/menu";
import { estaEntregada } from "@/lib/examen/hacer"; // o de donde lo importe hoy hacer-prueba.tsx
// …
  const leida = await pruebaParaHacer(id, prueba, persona.id, new Date());
  if (!leida) notFound();
  // Entregada, lo que se ve es un resultado: vuelve la cabecera del sitio.
  // Sin entregar, cada cara pinta la del examen (components/carcasa/cabecera-examen.tsx).
  const conLaDelSitio = !usaCabeceraDelExamen(estaEntregada(leida.estado));
  return (
    <>
      {conLaDelSitio && <Cabecera persona={persona} />}
      <HacerPrueba prueba={leida} />
    </>
  );
```

  Importar `estaEntregada` del mismo módulo del que lo importa `hacer-prueba.tsx`. Si ese módulo arrastra Prisma, en las pruebas ya está doblado `@/lib/db`.
- [ ] **Step 8: Reescribir las pruebas viejas de `tests/examen-pantallas.test.tsx`.**
  - Añadir `usePathname: () => "/examen/x1/CE"` al `vi.mock("next/navigation", …)` (la cabecera del sitio lo usa en la cara entregada), y doblar `@/lib/examen/corregir` si la importación de `Cabecera` lo arrastra y no lo estaba ya.
  - Sustituir «las cuatro caras tienen salida a Inicio» (842-849) por:

```tsx
  // Mutación que la mata: quitar la CabeceraExamen de una cara, o no pintar
  // la cabecera del sitio en la entregada. Ninguna cara puede quedarse sin
  // salida: es el fallo que cazó el profesor en la aceptación de la 3c.
  it("ninguna cara se queda sin salida", async () => {
    for (const cara of [sinEmpezar(), haciendoAuditiva(), enLibre()]) {
      expect(await pintarPagina(cara)).toContain(">Salir<");
    }
    const entregada = await pintarPagina(entregadaCon19De25());
    expect(entregada).toContain("data-menu");
    expect(entregada).toContain('href="/"');
  });
```

  - Sustituir «solo avisa de que el reloj sigue…» (854-859) por:

```tsx
  // Mutación que la mata: quitar el reloj de la cabecera, o pintar un segundo
  // reloj en el cuerpo. En pantalla solo puede haber uno.
  it("con reloj, hay uno y solo uno; sin reloj, ninguno", async () => {
    expect((await pintarPagina(haciendoLectura())).match(/data-reloj=/g) ?? []).toHaveLength(1);
    expect(await pintarPagina(haciendoAuditiva())).not.toContain("data-reloj=");
    expect(await pintarPagina(sinEmpezar())).not.toContain("data-reloj=");
  });

  // Mutación que la mata: pintar la cabecera del sitio mientras se hace la
  // prueba (el menú distrae y el Inicio queda a un clic sin pregunta).
  it("sin entregar no hay menú del sitio", async () => {
    for (const cara of [sinEmpezar(), haciendoLectura(), enLibre()]) {
      expect(await pintarPagina(cara)).not.toContain("data-menu");
    }
  });
```

  - Sustituir las dos de la escrita (1389-1405) por:

```tsx
  // Mutación que la mata: quitar la CabeceraExamen de una cara de la escrita.
  it("las caras sin entregar de la escrita tienen su Salir", () => {
    for (const cara of [escritaSinEmpezar(), escritaParaHacer(), escritaLibreHaciendo()]) {
      expect(renderToStaticMarkup(<HacerPrueba prueba={cara} />)).toContain(">Salir<");
    }
  });

  // Mutación que la mata: no pasar `escrita` a la cabecera, o pasárselo en libre.
  it("solo la escrita con reloj avisa al salir de que queda apuntado", () => {
    expect(renderToStaticMarkup(<HacerPrueba prueba={escritaParaHacer()} />)).toContain("Salir queda apuntado");
    expect(renderToStaticMarkup(<HacerPrueba prueba={escritaLibreHaciendo()} />)).not.toContain("Salir queda apuntado");
  });

  // Mutación que la mata: dejar el <Reloj> también en el cuerpo de la escrita.
  it("la escrita con reloj tiene uno solo", () => {
    expect(renderToStaticMarkup(<HacerPrueba prueba={escritaParaHacer()} />).match(/data-reloj=/g) ?? []).toHaveLength(1);
  });
```

  - Las pruebas que afirman «Te quedan» (657, 785, 866, 1280, 1373) no deberían cambiar: el reloj pinta lo mismo, solo cambia de sitio. Si alguna se pone roja, es que el reloj no llegó a la cabecera: arreglar el código, no la prueba.
  - `>Salir<` asume que `Boton` pinta el texto sin espacios. Si no, ajustar las cuatro aserciones a la forma real sin aflojarlas.
- [ ] **Step 9:** `npx vitest run tests/carcasa-cabecera-examen.test.tsx tests/examen-pantallas.test.tsx` en verde; `npx tsc --noEmit` limpio. **Todas las pruebas del registro de salidas de `examen-pantallas.test.tsx` siguen verdes sin tocarlas.** Mutaciones: quitar `escrita` en `EscritaHaciendo`; dejar un `<Reloj>` en el cuerpo de `PruebaHaciendo`; `preguntar={false}` en `PruebaHaciendo`; quitar `conLaDelSitio`. Rojo, deshacer.
- [ ] **Step 10: Commit**

```bash
git branch --show-current   # carcasa-a
git add components/carcasa/cabecera-examen.tsx components/examen/hacer-prueba.tsx components/examen/hacer-escrita.tsx components/examen/piezas.tsx "app/examen/[id]/[prueba]/page.tsx" tests/carcasa-cabecera-examen.test.tsx tests/examen-pantallas.test.tsx
git commit -m "La cabecera del examen: prueba, tarea, un solo reloj y un Salir que pregunta"
```

---

### Task 7: El muestrario

**Files:**
- Create: `app/(sitio)/muestrario/page.tsx`
- Test: `tests/carcasa-muestrario.test.tsx`

**Interfaces:**
- Consumes: las diez piezas (Task 1), `exigirProfesor` de `@/lib/puerta/sesion-http`.

- [ ] **Step 1: Prueba que falla**

```tsx
// tests/carcasa-muestrario.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Persona } from "@/lib/generated/prisma";

const { cookiesGet, personaDeLaCookie, redirect, notFound } = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  personaDeLaCookie: vi.fn(),
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookiesGet }) }));
vi.mock("@/lib/puerta/entrada", () => ({ personaDeLaCookie }));
vi.mock("next/navigation", () => ({ redirect, notFound }));

import Muestrario from "@/app/(sitio)/muestrario/page";

const PROFESOR: Persona = { id: "p1", correo: "pablo@hispaprofe.com", nombre: "Pablo", papel: "PROFESOR", activa: true, createdAt: new Date("2026-01-01") };
const ESTUDIANTE: Persona = { id: "e1", correo: "ana@ejemplo.com", nombre: "Ana", papel: "ESTUDIANTE", activa: true, createdAt: new Date("2026-01-01") };

beforeEach(() => vi.resetAllMocks());

describe("el muestrario", () => {
  // Mutación que la mata: quitar el exigirProfesor.
  it("un estudiante topa con el 404", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-ana" });
    personaDeLaCookie.mockResolvedValue(ESTUDIANTE);
    await expect(Muestrario()).rejects.toThrow("NOT_FOUND");
  });

  // Mutación que la mata: olvidar una de las diez piezas.
  it("el profesor ve las diez piezas por su nombre", async () => {
    cookiesGet.mockReturnValue({ value: "cookie-de-pablo" });
    personaDeLaCookie.mockResolvedValue(PROFESOR);
    const html = renderToStaticMarkup(await Muestrario());
    for (const pieza of ["Boton", "Enlace", "Tarjeta", "Aviso", "EtiquetaEstado", "Campo", "Casilla", "Desplegable", "EncabezadoPagina", "BloqueVacio"]) {
      expect(html).toContain(`id="pieza-${pieza}"`);
    }
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/carcasa-muestrario.test.tsx` → FALLA.
- [ ] **Step 3: La página**

```tsx
// app/(sitio)/muestrario/page.tsx
import type { ReactNode } from "react";
import { exigirProfesor } from "@/lib/puerta/sesion-http";
import { Boton } from "@/components/ui/boton";
import { Enlace } from "@/components/ui/enlace";
import { Tarjeta } from "@/components/ui/tarjeta";
import { Aviso } from "@/components/ui/aviso";
import { EtiquetaEstado } from "@/components/ui/etiqueta-estado";
import { Campo } from "@/components/ui/campo";
import { Casilla } from "@/components/ui/casilla";
import { Desplegable } from "@/components/ui/desplegable";
import { EncabezadoPagina } from "@/components/ui/encabezado-pagina";
import { BloqueVacio } from "@/components/ui/bloque-vacio";

function Pieza({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <section id={`pieza-${nombre}`} className="flex flex-col gap-3">
      <h2 className="font-mono text-sm text-tinta-suave">{nombre}</h2>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

/** Las diez piezas del kit, juntas, para revisarlas de un vistazo. Solo el
 *  profesor, y fuera de cualquier menú. */
export default async function Muestrario() {
  await exigirProfesor();
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-4 sm:p-6">
      <EncabezadoPagina titulo="Muestrario" subtitulo="Las piezas del sitio, con sus variantes." />
      <Pieza nombre="Boton">
        <Boton>Principal</Boton>
        <Boton variante="secundario">Secundario</Boton>
        <Boton variante="peligro">Peligro</Boton>
        <Boton enviando textoEnviando="Guardando…">Guardar</Boton>
        <Boton disabled>Apagado</Boton>
      </Pieza>
      <Pieza nombre="Enlace">
        <Enlace href="/muestrario">Un enlace</Enlace>
        <Enlace href="/muestrario" comoBoton="principal">
          Empezar
        </Enlace>
        <Enlace href="/muestrario" comoBoton="secundario">
          Ver resultado
        </Enlace>
      </Pieza>
      <Pieza nombre="Tarjeta">
        <Tarjeta>Una tarjeta con su sombra y su radio.</Tarjeta>
      </Pieza>
      <Pieza nombre="Aviso">
        <Aviso tono="info" titulo="Información">Algo que conviene saber.</Aviso>
        <Aviso tono="exito" titulo="Hecho">Se ha guardado.</Aviso>
        <Aviso tono="aviso" titulo="Aviso">Se pasó el plazo.</Aviso>
        <Aviso tono="error" titulo="Error">No se ha podido guardar.</Aviso>
      </Pieza>
      <Pieza nombre="EtiquetaEstado">
        <EtiquetaEstado tono="neutro">Sin empezar</EtiquetaEstado>
        <EtiquetaEstado tono="info">A medias</EtiquetaEstado>
        <EtiquetaEstado tono="exito">Entregada</EtiquetaEstado>
        <EtiquetaEstado tono="aviso">Se pasó el plazo</EtiquetaEstado>
        <EtiquetaEstado tono="error">Error</EtiquetaEstado>
      </Pieza>
      <Pieza nombre="Campo">
        <Campo id="m-nombre" etiqueta="Nombre" ayuda="Como quieres que te llamen." />
        <Campo id="m-correo" etiqueta="Correo" error="Falta la arroba." defaultValue="ana.ejemplo.com" />
        <Campo id="m-texto" etiqueta="Comentario" multilinea rows={3} />
      </Pieza>
      <Pieza nombre="Casilla">
        <Casilla id="m-casilla" etiqueta="Marcar todos" />
      </Pieza>
      <Pieza nombre="Desplegable">
        <Desplegable
          id="m-modo"
          etiqueta="Modo"
          opciones={[
            { valor: "COMPLETO", texto: "Completo" },
            { valor: "LIBRE", texto: "Práctica libre" },
          ]}
        />
      </Pieza>
      <Pieza nombre="EncabezadoPagina">
        <EncabezadoPagina titulo="Exámenes" subtitulo="Los que has cargado" acciones={<Boton>Nuevo examen</Boton>} />
      </Pieza>
      <Pieza nombre="BloqueVacio">
        <BloqueVacio titulo="No tienes nada pendiente" texto="Cuando el profesor te asigne un examen, aparecerá aquí." />
      </Pieza>
    </main>
  );
}
```

Si `Boton` con `onClick` no puede ir en una página de servidor, aquí no lleva ninguno, así que no hace falta `"use client"`. Si `tsc` pide que `Boton` sea de cliente por algún atributo, no se cambia la pieza: se deja el muestrario sin ese atributo.

- [ ] **Step 4:** `npx vitest run tests/carcasa-muestrario.test.tsx` en verde; mutación: quitar `exigirProfesor`. Rojo, deshacer.
- [ ] **Step 5: Commit**

```bash
git branch --show-current   # carcasa-a
git add "app/(sitio)/muestrario/page.tsx" tests/carcasa-muestrario.test.tsx
git commit -m "El muestrario del kit, solo para el profesor"
```

---

### Task 8: Revisión de cierre del código (controlador)

- [ ] `grep -rn "Practicar\|Mis resultados\|Biblioteca" components/carcasa lib/carcasa` → solo en comentarios que explican por qué NO están.
- [ ] `grep -rn "apto" app components lib` → nada nuevo.
- [ ] `grep -rn "bg-hp-400" components/ui components/carcasa "app/(sitio)/(inicio)"` → vacío.
- [ ] `grep -rn "VolverAInicio\|Volver a Inicio" app components tests` → vacío, salvo comentarios que cuenten la historia.
- [ ] Revisión final de toda la rama con un revisor fresco (opus), contra la spec, antes de la Task 9.

---

### Task 9: Cierre y aceptación en el navegador, ANTES de fusionar

- [ ] **Step 1:** Suite entera, una vez: `npx tsc --noEmit`, `npm run lint` (0 errores), `npm test`, `npm run test:base`. Apuntar las cifras en el ledger.
- [ ] **Step 2:** Pedir al profesor que ponga **`DIRECT_URL` en el entorno Preview** del proyecto `hispaprofe-dele` de Vercel (el mismo valor que en Production), si todavía falta. Sin eso la vista previa de la rama no construye.
- [ ] **Step 3:** Empujar la rama **solo con su sí** (`git push -u origin carcasa-a`) para que Vercel haga la vista previa. Comprobar el estado con `vercel inspect <url>` (no `vercel ls` en tubería: sale sin la columna de estado).
- [ ] **Step 4:** Los nueve pasos de la sección 11 de la spec, con el profesor, en ordenador y en móvil de verdad. Cada fallo que salga: arreglo con su prueba y vuelta al paso.
- [ ] **Step 5:** Con la aceptación entera y su sí: fusionar en `main` con `--no-ff`, empujar el commit probado (`git push origin <sha>:main`) y comprobar el despliegue de producción. Copiar el ledger de `.superpowers/sdd/…` a `~/.claude/projects/-Users-FLE/ledgers-preservados/` ANTES de retirar la carpeta.
