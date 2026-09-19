# La carcasa · Entrega B2: las pantallas del estudiante

*18 sept 2026. Diseño aprobado por el profesor en dos partes. Sigue a la B1
(`2026-09-18-carcasa-entrega-b1-design.md`, en producción y aceptada: main 4db004d). Las
secciones 6 (las cinco correcciones al paquete) y 7 (el kit) de la A, y la sección 2 de la
B1, siguen valiendo aquí.*

## 1. Qué es

La B2 viste con el kit **todo lo que hace el estudiante dentro de una prueba**: la ruta
`/examen/[id]/[prueba]` con todas sus caras. Es la última pieza de la carcasa; después
solo quedan la 3e (oral) y la portada pública.

**La regla de siempre: vestir, no rediseñar.** No se añade ningún dato, consulta ni
acción de servidor. Hay **una** excepción decidida por el profesor: la pregunta de entrega
de lectura y auditiva (sección 3).

**Lo que el paquete dibuja y no existe queda fuera sin preguntar:** una pregunta a la vez
con «Texto 2 de 4 / Pregunta 3 de 6» (el producto enseña la tarea entera), el botón
«Guardar» y «Guardando…» de la escrita (se guarda sola y se entrega), «Cohesión» (mandan
los criterios de `CRITERIOS_EE`), «Entregada por el reloj, a tiempo» (el texto real es
«Se entregó sola: se acabó el tiempo.»), y grabaciones, citas y oral (son de la 3e).

**Lo que existe y el paquete no dibuja se viste sin rediseñarlo:** la cinta de la auditiva
(trozos que suenan una vez, pestañas bloqueadas mientras suena), la práctica libre, la
escrita esperando corrección y corregida, el aviso de salidas apuntadas, la ventana de
Salir, y la columna de referencia de relacionar y lista común.

**Referencia visual:** `docs/diseno/carcasa/02-Pantallas-Estudiante.dc.html`. Si choca con
esta spec, manda la spec.

## 2. En todas las caras de la B2

- Cajas con `Tarjeta`; botones con `Boton` (principal, secundario, `enviando`); avisos con
  `Aviso`; enlaces con `Enlace`; estados con `EtiquetaEstado`; el desplegable de la barra
  de respuestas con `Desplegable`.
- **Sin colores a mano:** fuera `bg-hp-400`, `border-hp-400`, `text-hp-600`, `bg-hp-50` y
  `bg-hp-100` de `components/examen/`, `app/examen/` y `app/entrar/`. Se usan los tokens
  del kit.
- **El rojo, solo para fallos de verdad.** La respuesta fallada va en coral (`aviso`), no
  en `error`. Los últimos 5 minutos del reloj siguen en rojo: eso sí es una alarma.
- **`components/examen/piezas.tsx` se borra.**
  - `PestanasDeTarea` pasa a `components/examen/pestanas-de-tarea.tsx`, con los colores
    del kit; la usan lectura, auditiva y escrita.
  - `enLista` pasa a `lib/examen/` (la usan también las notas del profesor, `notas.ts`).
  - `CAJA`, `BOTON`, `BOTON_SUAVE` y `AVISO_DE_ERROR` desaparecen; la cinta deja también
    sus copias locales.
- Las **opciones con foto** siguen con su radio propio (`GrupoDeOpciones` solo admite
  texto), vestidos con los tokens del kit: borde, marca y foco.

## 3. La pregunta de entrega (la excepción)

Hoy lectura y auditiva preguntan con `window.confirm` («Te quedan N sin contestar…») y la
escrita con una sección propia dentro de la página. Pasan a **una sola pieza,
`PreguntaDeEntrega`** (`components/examen/pregunta-de-entrega.tsx`):

- Es un `<dialog>` de la página, como la ventana de Salir: Escape la cierra y el foco vuelve
  a «Entregar».
- Lista lo que falta, tras un «Ojo:», una línea por cosa. En lectura y auditiva, por tarea:
  «en la tarea 2 no has contestado la 8 ni la 9», o «no has contestado nada en la tarea 1».
  En la escrita, lo que ya lista hoy. Siempre dice «Entregar no se puede deshacer».
- Dos botones: «Sí, entregar» (principal, con `enviando`) y «Seguir con la prueba» (en la
  escrita, «Seguir escribiendo»).
- Cuando el reloj entrega solo, **no** sale.
- Lo que falta sale de **una función pura** (`sinResponderPorTarea`), probada aparte.

## 4. Caras, una por una

### 4.1 Aviso previo (las tres pruebas)

Una `Tarjeta` con las reglas y «Empezar» con `Boton`. El error, `Aviso` de error. El
aviso de que en la escrita las salidas quedan apuntadas se mantiene.

### 4.2 Lectura y auditiva, en curso

- Las dos columnas desde `md`, la columna de consulta desplazable y la barra de respuestas
  `sticky` en móvil **siguen igual**; cambia su aspecto.
- Los números de la barra y las opciones marcadas, con los tokens del kit; el `<select>`
  de la barra, con `Desplegable`.
- La cinta usa `Boton` y `Aviso` y suena igual que hoy.
- «Entregar» abre `PreguntaDeEntrega`.

### 4.3 Práctica libre (lectura y auditiva)

Igual que la anterior, sin reloj ni Entregar. «Corregir» por tarea con `Boton`; la nota
«X de Y» con el mismo estilo que en el resultado.

**La ventana de Salir dice la verdad.** Lo marcado en una práctica libre de lectura o
auditiva **no se guarda**: «Corregir» calcula sin escribir en la base. Así que ahí la
ventana no dice «Podrás volver a entrar mientras la prueba no esté entregada», sino
**«Lo que marques en esta práctica no se guarda: al volver empiezas de nuevo.»** Es el
aplazado que la B1 pasó aquí. `frasesDeSalida` recibe si la prueba es libre. La escrita
libre sí guarda el texto y conserva su frase de hoy.

### 4.4 Resultado

- La nota grande y la nota por tarea, en `Tarjeta`.
- «Se entregó sola: se acabó el tiempo.» en `Aviso` informativo.
- La prueba que queda: `EtiquetaEstado` y un `Enlace` «Ir a hacerla».
- Las falladas, en coral. El contenido es el de hoy, salvo la frase que explica el color:
  «En rojo, las que fallaste» pasa a «Marcadas en coral, las que fallaste».

### 4.5 Escrita, escribiendo

- El enunciado, plegable como hoy, vestido.
- El folio conserva su contador y su aviso de palabras, con tokens del kit.
- «Guardado…» deja de ser texto suelto y pasa a una marca discreta fija junto al folio.
  **No hay botón «Guardar».**
- «Entregar» abre `PreguntaDeEntrega`.

### 4.6 Escrita, esperando corrección

Una `Tarjeta` con la fecha de entrega y el texto en solo lectura.

### 4.7 Escrita, corregida

Los criterios salen de `CRITERIOS_EE` con su banda. El comentario del profesor va en un
`Aviso` informativo, no en `bg-hp-50`. El texto va debajo.

### 4.8 `/entrar`

Se quitan sus `bg-hp-400` y `bg-hp-50`.

### 4.9 La página del examen

Hoy ninguna cara pone ancho máximo y en un monitor ancho las columnas se estiran de borde a
borde. La página envuelve las caras en un `<main>` centrado con ancho máximo, como las
pantallas de `(sitio)`.

## 5. Errores

Los fallos se enseñan igual que hoy, con `Aviso` de error. Un fallo al guardar una
respuesta sigue sin bloquear la prueba. No se toca ninguna acción de servidor ni la
lógica del reloj, las salidas o la entrega por tiempo.

## 6. Cómo se prueba

Como en la A y la B1: Vitest con `renderToStaticMarkup`, sin jsdom. **Cada prueba nueva
se demuestra rompiendo a propósito lo que vigila**, con el comentario de mutación. Los
atributos se miran recortando la etiqueta (la trampa de `disabled:` de Tailwind).

- `sinResponderPorTarea`: tareas completas, parciales y vacías; una cadena vacía no cuenta
  como respondida.
- `PreguntaDeEntrega`: lista exactamente lo que falta, o «no se puede deshacer» sin nada;
  el texto del botón de seguir según la prueba.
- No queda `confirm(` en `components/examen/`.
- La entrega por el reloj no pasa por la pregunta.
- `frasesDeSalida`: en libre de lectura/auditiva, «no se guarda» y ninguna «entregada»; en
  la escrita con reloj, sigue «queda apuntado».
- Las falladas no llevan el tono de error.
- Una prueba que busca en los ficheros:
  - que nadie importe `piezas.tsx`;
  - que no queden `bg-hp-`, `border-hp-400` ni `text-hp-600` en `components/examen/`,
    `app/examen/` ni `app/entrar/`;
  - que no aparezca «Cohesión» ni un botón «Guardar» en la escrita.
- Las de hoy siguen en verde: `examen-pantallas`, `portada`, `carcasa-cabecera-examen`,
  `corregir-notas`, `paraElEstudiante`, `ui-kit`, `carcasa-altura` y las de base. Si alguna
  cambia de texto por el vestido, se actualiza diciendo por qué.

Al cerrar: `tsc` limpio, lint sin errores, `npm test` y `npm run test:base` enteros.

## 7. Aceptación

Sin vista previa, por decisión del profesor: se fusiona y se hace el paseo en
hispaprofe.com, en ordenador y en móvil de verdad, con una cuenta de estudiante de prueba.

1. Lectura: dejar preguntas sin responder, pulsar Entregar y ver la lista de lo que falta;
   «Seguir con la prueba»; entregar y ver el resultado con las falladas en coral.
2. Auditiva: la cinta suena por trozos y bloquea las pestañas; dejar que el reloj la
   entregue solo: no sale la pregunta y el resultado dice «Se entregó sola».
3. Práctica libre: «Corregir» por tarea; Salir dice que no se guarda.
4. Escrita: escribir y ver la marca de guardado; salir y volver; entregar con la pregunta;
   corregirla como profesor y verla corregida como estudiante.
5. En el móvil: la barra de respuestas pegada abajo y la pregunta de entrega que cabe.
6. Con el teclado: foco visible; Escape cierra la pregunta y el foco vuelve a Entregar.

## 8. Lo que sigue abierto

- **La 3e (oral)**, que necesita foto en las tareas de redacción.
- **La portada pública**, esperando los datos comerciales del profesor.
