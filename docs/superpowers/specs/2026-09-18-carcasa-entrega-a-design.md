# La carcasa · Entrega A: el kit, las dos cabeceras y el Inicio

*18 sept 2026. Diseño aprobado por el profesor en tres partes. Parte del paquete que
entregó Claude Design (`docs/diseno/carcasa/`), con cinco correcciones. Es la primera de
dos entregas; la B viste con el kit el resto de las pantallas.*

## 1. Qué es

Hoy el sitio no tiene cabecera común. El Inicio del profesor es una lista de enlaces
subrayados y cada pantalla lleva, como mucho, su propio «← Volver a Inicio», puesto a
mano. Esta entrega pone **una cabecera para todo el sitio**, **una cabecera aparte para
cuando corre el reloj de una prueba**, y **el juego de piezas** con el que se dibujará
todo lo demás. De las pantallas, solo cambia de aspecto el Inicio del estudiante.

**El paquete de Claude Design es la referencia visual**, no código que se copie:
`docs/diseno/carcasa/README.md` y los `.dc.html` (se abren en el navegador). El encargo
que se le hizo está al lado (`01-ENCARGO.md`, `04-pantallas-de-hoy.md`). Cuando el
paquete y esta spec choquen, **manda esta spec**.

**Decisiones del profesor, tomadas el 18 sept (no se reabren sin información nueva):**

- **Se parte en dos entregas.** La A: kit, cabecera, cabecera del examen, Inicio del
  estudiante y los cambios de nombre. La B: vestir con el kit la lectura, la auditiva,
  la escrita, el resultado, Pendientes, corregir, exámenes, el taller y Estudiantes.
  Cada una se acepta en el navegador antes de la siguiente. Descartados «todo de una
  vez» (la aceptación sería enorme y un fallo del kit se vería tarde) y «solo la
  cabecera» (sin kit, la B no tiene con qué construir).
- **El profesor, al entrar, cae en Pendientes.** No hay una pantalla de resumen propia.
  Descartados «un resumen propio» (el paquete no lo dibuja y habría que diseñarlo) y
  «Exámenes».
- **No volver a Claude Design.** Lo que falla del paquete se corrige aquí (sección 6).

## 2. Dónde se ve cada cabecera

| Pantalla | Cabecera |
|---|---|
| `/entrar`, `/entrar/enviado` | ninguna |
| `/` sin sesión (hoy: título y «Entrar») | ninguna; la portada pública espera a los datos comerciales |
| Cualquier pantalla con sesión, salvo las de abajo | `Cabecera` |
| `/examen/[id]/[prueba]` desde el aviso previo hasta entregar | `CabeceraExamen` |
| `/examen/[id]/[prueba]` ya entregada (el resultado) | `Cabecera` |

**Cómo se monta:** las pantallas con `Cabecera` se agrupan en un grupo de rutas de Next
con su propio `layout`. El grupo no cambia ninguna dirección. `/examen/…` queda fuera del
grupo, porque solo la propia pantalla sabe en qué estado está la prueba: es ella la que
dibuja `CabeceraExamen` o `Cabecera` según haya o no entrega. Los «← Volver a Inicio»
sueltos desaparecen.

## 3. La cabecera

**Qué lleva:** a la izquierda, la marca «HispaProfe», que lleva al inicio de cada papel.
En el centro, el menú con la sección activa marcada (fondo `hp-50`, texto `hp-700`). A la
derecha, el nombre de la persona; al pulsarlo sale «Salir» (el mismo `POST /salir` de
hoy).

**En el móvil (400 px):** la marca y un botón de menú. El botón abre un panel que cubre
el resto de la pantalla, con los enlaces, el nombre y «Salir»; se cierra con la ✕ y al
elegir un enlace.

**El menú de cada papel**, y ni un enlace más:

| Papel | Menú | Al entrar en `/` |
|---|---|---|
| Estudiante | Inicio | su Inicio |
| Profesor | Exámenes · Estudiantes · Pendientes | redirige a `/pendientes` |

- **Regla dura:** no se dibuja el enlace a una sección que todavía no funciona.
  Practicar, Mis resultados y Biblioteca no están en ningún menú.
- **Pendientes lleva un número**: las redacciones que esperan corrección, las mismas que
  cuenta hoy el enlace «Por corregir (N)». Si no hay ninguna, no se dibuja. El número
  lleva `aria-label="Por corregir: N"`.
- **La lista de enlaces sale de una función pura** que recibe el papel y devuelve los
  enlaces; la sección activa, de otra que recibe la ruta. Las dos se prueban sin
  navegador.

## 4. Las direcciones cambian de nombre

Para que coincidan con el menú:

- `/personas` → `/estudiantes`.
- `/corregir` → `/pendientes`, y `/corregir/[intentoId]` → `/pendientes/[intentoId]`.

**Las viejas redirigen a las nuevas** (redirecciones en `next.config.ts`, no
permanentes), así que ningún enlace guardado ni ningún marcador se rompe. Se actualizan
los enlaces internos que las nombran (hoy, el Inicio y el `router.push` de
`corregir-escrita.tsx`).

**Las dos pantallas de prueba técnica** (`/pruebas/grabar` y `/pruebas/subir`) salen del
menú, pero no se borran: la de grabar es la base de la oral y se retira en la 3e, cuando
exista la de verdad.

## 5. La cabecera del examen

**Cuándo:** desde el aviso «antes de empezar» (que ya existe: `AvisoPrevio`) hasta que la
prueba se entrega. Sustituye del todo a `Cabecera`: ni menú ni nombre del estudiante.

**Qué lleva:** el nombre de la prueba, la tarea abierta («Tarea 2 de 4»; en móvil
«Lectura · 2/4»), el reloj y «Salir». **En modo libre no hay reloj y no se dibuja
hueco para él.** El reloj es el de hoy (`components/examen/reloj.tsx`), movido a la
cabecera: **en pantalla solo puede haber uno.** Como la tarea abierta vive en el estado
de la pantalla de la prueba, la cabecera se dibuja dentro de ella y recibe la tarea por
propiedad.

**«Salir» ya no saca directo: pregunta.**

> **¿Seguro que quieres salir?**
> El reloj sigue corriendo aunque salgas. Podrás volver a entrar mientras la prueba no
> esté entregada.
> [Seguir la prueba] [Salir de todos modos]

En la **escrita** se añade una frase, la misma idea que ya dice su aviso previo:
«Salir queda apuntado, y tu profesor ve cuántas veces saliste y cuánto tiempo estuviste
fuera.» En modo libre, sin reloj, la primera frase no se dice.

**La pregunta no cuenta como salida.** Abrir la ventana, e incluso cerrarla con
«Seguir la prueba», no apunta nada. Lo que se apunta es irse de verdad, y eso sigue
funcionando como hoy: «Salir de todos modos» lleva a Inicio con la misma navegación que
el enlace actual, que el registro de salidas ya ve al desmontarse la pantalla. **No se
toca el registro de salidas**; si hiciera falta tocarlo, es otra conversación con el
profesor.

La ventana es una pieza de la página (no un `confirm()` del navegador), se cierra con
Escape y devuelve el foco al botón «Salir».

## 6. Las cinco correcciones al paquete de Claude Design

Valen para esta entrega y para la B:

1. **Los criterios de corrección salen de `CRITERIOS_EE`**, nunca del dibujo. El paquete
   pone «Cohesión», que no es un criterio del DELE; los cuatro son adecuación al género
   discursivo, coherencia textual, corrección y alcance.
2. **La escrita no lleva botón «Guardar».** Se sigue guardando sola mientras se escribe y
   se entrega con «Entregar». Lo que se ve es el estado del guardado («Guardado»).
3. **Salir de la escrita avisa de que queda apuntado** (sección 5).
4. **Dentro de las pantallas tampoco se dibuja lo que no existe.** Pendientes enseña solo
   redacciones por corregir, sin grabaciones ni citas, hasta la 3e. La ficha del
   estudiante, sin opiniones ni «Pedir opinión», hasta que se construya la sección 9 bis
   del diseño general.
5. **Las pantallas que el paquete no dibujó** (la auditiva con su reproductor, la ficha
   pregunta a pregunta, asignar con fecha y modo, subir páginas) se visten en la B con
   las piezas del kit, sin rediseñarlas. La oral se diseña en la 3e.

Dos errores menores del dibujo que no se copian: un examen «sin fecha tope» que a la vez
dice «se pasó el plazo» (el Inicio enseña lo que digan los datos), y la explicación de
que las marcas del audio separan «preguntas» (separan trozos).

## 7. El kit de piezas

Diez piezas en `components/ui/`, con los nombres de la nota de construcción del paquete:
`Boton`, `Enlace`, `Tarjeta`, `Aviso`, `EtiquetaEstado`, `Campo`, `Casilla`,
`Desplegable`, `EncabezadoPagina`, `BloqueVacio`. Colores, sombras y radio, **solo** de
los que ya hay en `app/globals.css`; no se añade ninguno.

- **`Boton`**: principal (fondo `hp-700`, no `hp-400`: la letra blanca sobre azul claro no
  se leía), secundario (borde `hp-300`, texto `hp-600`) y peligro (coral). Tiene estado
  «enviando»: se apaga y cambia el texto por el que se le pase («Guardando…»). Un botón
  apagado por una regla lleva el motivo en texto a su lado, nunca solo apagado.
- **`Aviso`**: información (`hp`), éxito (`verde`), aviso (coral, para lo que no es un
  fallo, como llegar tarde) y error (`error`, solo para fallos de verdad).
- **`EtiquetaEstado`**: los mismos tonos, en pequeño.
- **Todas**: foco visible con teclado, y los botones se ven como botones.

**El muestrario**, en `/muestrario`, junta las diez piezas con sus variantes y estados.
Solo lo abre el profesor (un estudiante recibe el 404 de siempre) y no está en ningún
menú: sirve para revisar el kit de un vistazo antes de la B.

**En esta entrega las piezas se usan en:** la cabecera, la cabecera del examen con su
ventana de salir, el aviso previo, el Inicio del estudiante y el muestrario. Nada más. El
interior de las demás pantallas no se toca hasta la B.

## 8. El Inicio del estudiante

La misma información que hoy, dibujada con el kit como en
`02-Pantallas-Estudiante.dc.html`: una `Tarjeta` por examen asignado (título, nivel, fecha
tope) y una fila por prueba con su `EtiquetaEstado` y su botón («Empezar», «Seguir»,
«Ver resultado», «Practicar»).

- **La fecha tope pasada** sale como aviso en coral («Se pasó el plazo el…»), nunca en
  rojo de error: la fecha es blanda y llegar tarde no es un fallo.
- **Cuatro casos:** con exámenes; vacío («No tienes nada pendiente», con `BloqueVacio`);
  cargando (un esqueleto, con `loading.tsx`); y error («No hemos podido cargar tu inicio»
  y «Reintentar», con `error.tsx`).
- **No cambia nada de lo que se lee.** Sigue llamando a `cerrarLasQueSePasaron` antes de
  `asignacionesDe`, en ese orden.

## 9. Errores

- **Sin sesión en una pantalla del grupo:** lo de hoy, el candado de `proxy.ts` manda a
  `/entrar`.
- **Un estudiante en una pantalla de profesor** (`/pendientes`, `/estudiantes`,
  `/muestrario`…): lo de hoy, 404. La cabecera no cambia eso; solo deja de enseñar el
  enlace.
- **Falla la cuenta de Pendientes al dibujar la cabecera:** la cabecera se dibuja sin el
  número. Una cuenta que falla no puede tumbar todas las pantallas del profesor.

## 10. Cómo se prueba

Vitest con `renderToStaticMarkup`, como el resto (no hay jsdom). Cada prueba nueva se
demuestra **rompiendo a propósito lo que vigila y viéndola en rojo**, con el comentario de
mutación de siempre.

- El menú del estudiante es **exactamente** `[Inicio]` y el del profesor **exactamente**
  `[Exámenes, Estudiantes, Pendientes]`. Se compara la lista entera, no «contiene»: una
  sección de más tiene que poner la prueba en rojo.
- La sección activa, para cada ruta del menú y para una ruta que no está en él.
- Las redirecciones: `/personas`, `/corregir` y `/corregir/abc` llevan a las nuevas.
- El profesor en `/` va a `/pendientes`; el estudiante no.
- El número de Pendientes: no se dibuja con cero, y lleva el `aria-label`.
- `/examen/…` dibuja `CabeceraExamen` sin entregar y `Cabecera` entregada.
- `CabeceraExamen` en modo libre no dibuja reloj.
- La ventana de salir de la escrita contiene la frase de «queda apuntado»; la de la
  lectura no.
- **En la pantalla de la prueba hay un solo reloj.**
- `/muestrario` da 404 a un estudiante.
- Las pruebas del registro de salidas, sin tocar y en verde.
- **Trampa conocida:** `toContain("disabled")` pasa por casualidad con la clase de
  Tailwind `disabled:…`. Los atributos se miran recortando la etiqueta.

Y al cerrar: `tsc` limpio, lint sin errores, `npm test` y `npm run test:base` enteros.

## 11. Aceptación en el navegador, ANTES de fusionar

A diferencia de la 3d, esta vez la aceptación va **antes** de fusionar. Se hace en el
despliegue de vista previa de la rama. Si ese despliegue sigue sin construir porque falta
`DIRECT_URL` en el entorno Preview de Vercel, se pone esa variable como primer paso.

1. **Ordenador**, como profesor: entrar y caer en Pendientes; el menú con tres entradas y
   la activa marcada; el número de Pendientes; pulsar el nombre y salir.
2. **Móvil de verdad**, como profesor: abrir y cerrar el menú; elegir una sección.
3. `/personas` y `/corregir` en la barra de direcciones: llevan a las nuevas.
4. Como **estudiante de prueba**: el Inicio con un examen asignado; el menú con una sola
   entrada; una fecha pasada en coral.
5. Empezar una prueba: desaparece el menú, se ve la cabecera del examen con un reloj y la
   tarea; cambiar de tarea y ver que cambia el número.
6. «Salir» → «Seguir la prueba»: sigue dentro y no se ha apuntado ninguna salida.
   «Salir» → «Salir de todos modos»: vuelve a Inicio; en la escrita, el profesor ve esa
   salida al corregir.
7. Entregar una prueba: el resultado ya lleva la cabecera normal.
8. `/muestrario` como profesor: las diez piezas; como estudiante: 404.
9. Con el teclado: el foco se ve en la cabecera, en la ventana de salir y en los botones.

## 12. Lo que sigue abierto

- **La Entrega B**, con su propia spec y plan, cuando la A esté aceptada.
- **La portada pública**, esperando los datos comerciales del profesor.
- **Los cabos que esta entrega no toca:** la aceptación pendiente de la 3d y de la 3c, la
  pregunta del examen congelado en cuanto alguien pulsa «Empezar», y la
  `ANTHROPIC_API_KEY` en Vercel.
