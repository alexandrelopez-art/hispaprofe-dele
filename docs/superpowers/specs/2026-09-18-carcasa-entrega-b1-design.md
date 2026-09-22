# La carcasa · Entrega B1: las pantallas del profesor

*18 sept 2026. Diseño aprobado por el profesor en dos partes. Sigue a la Entrega A
(`2026-09-18-carcasa-entrega-a-design.md`, en producción y aceptada: main 7225aeb), cuyas
secciones 6 (las cinco correcciones al paquete) y 7 (el kit) siguen valiendo aquí.*

## 1. Qué es

La Entrega A puso la cabecera, la cabecera del examen y el kit de diez piezas, y vistió
solo el Inicio del estudiante. **La B viste con el kit el resto**, y el profesor la partió
en dos:

- **B1 (esta):** las pantallas del profesor —Pendientes, corregir, Exámenes, el detalle
  de un examen con su asignación, la hoja pregunta a pregunta, el taller y Estudiantes— y
  los aplazados de la A que no son del estudiante.
- **B2 (después, con su spec y su aceptación):** lectura, auditiva, escrita y resultado,
  donde viven el reloj y el registro de salidas.

**Por qué este orden:** son las pantallas que el profesor usa a diario y todavía no hay
estudiantes en el sitio. Descartados «todo de una vez» (aceptación enorme, lo mismo que se
descartó en la A) y «estudiante primero» (lo de más riesgo, sin nadie que lo use aún).

**La regla de siempre: vestir, no rediseñar.** No se añade ningún dato, consulta ni
acción. Hay **una** excepción decidida por el profesor: la forma de poner las notas al
corregir (sección 5.2). Lo que el paquete dibuja y no existe queda fuera sin preguntar:
el modo completo/libre en la lista de asignados, el «5 de 6 — falta 1» por tarea, la
ficha del estudiante con opiniones, grabaciones y citas.

**Referencia visual:** `docs/diseno/carcasa/03-Pantallas-Profesor.dc.html`. Si choca con
esta spec, manda la spec.

## 2. En todas las pantallas de la B1

- El título, con `EncabezadoPagina` (título, subtítulo y acciones). Fuera los `<h1>`
  hechos a mano.
- Los avisos, con `Aviso`; los botones, campos y desplegables, con `Boton`, `Campo`,
  `Casilla` y `Desplegable`; las listas vacías, con `BloqueVacio`; las cajas, con
  `Tarjeta`. Los estados, con `EtiquetaEstado`.
- **Las pantallas de la B1 dejan de usar** las clases de `components/examen/piezas.tsx`
  (`CAJA`, `BOTON`, `BOTON_SUAVE`, `AVISO_DE_ERROR`, `AVISO_SUAVE`). El fichero **no se
  borra**: las pantallas del estudiante lo usan hasta la B2.
- **El tono rojo (`error`) es solo para fallos de verdad.** Lo que no es un fallo —no poder
  publicar todavía, una respuesta fallada, las salidas del estudiante— va en coral
  (`aviso`).
- **Enlaces de vuelta:** se quitan los «← Volver» sueltos, **salvo uno** en las pantallas
  que el menú no alcanza (el detalle de un examen, la hoja y el taller): un solo `Enlace`
  al padre, encima del título. Ninguna pantalla lleva dos.

## 3. Piezas nuevas y cambios en el kit

- **`GrupoDeOpciones`** (nueva, en `components/ui/`): elegir una opción entre varias, con
  radios de verdad (`<fieldset>`, `<legend>` visible, flechas del teclado del navegador).
  Dos formas:
  - `lista`: una opción por línea. Se usa en «completo / libre» al asignar.
  - `segmentos`: botones pegados en fila. Se usa en las notas 0–3 al corregir.
  Puede **nacer sin nada marcado** (valor `null`), que no es lo mismo que marcar 0.
- **El muestrario** (`/muestrario`) añade las dos formas, con y sin nada marcado.
- **El campo del taller** (`components/taller/campo.tsx`) se renombra `CampoDelTaller`
  para no confundirse con el `Campo` del kit. Conserva su resaltado de «la IA duda»; solo
  cambia de aspecto.

## 4. Los aplazados de la Entrega A

1. **La sesión se lee una vez por petición.** Hoy el `layout` y la página llegan cada uno a
   `personaActual()` y consultan la base dos veces. Se envuelve con `cache()` de React una
   función sin argumentos (la que recibe `ahora` no sirve: una fecha nueva por llamada
   rompe la caché). Lo mismo con `contarPendientes()`, que en `/pendientes` se cuenta en
   la cabecera y otra vez en la lista.
2. **El profesor deja de ver el esqueleto del estudiante.**
   - `app/entrar/[secreto]/route.ts` redirige directo a `inicioDe(papel)`; para eso
     `usarEnlace` devuelve también el papel (ya carga la persona).
   - Quien escribe `/` a mano: el Inicio decide primero el papel y redirige al profesor;
     el esqueleto sale de un `<Suspense>` **dentro de la rama del estudiante**, no de un
     `loading.tsx` que cubre la ruta entera.
3. **Se acaba el scroll vacío bajo la cabecera.** El `layout` de `(sitio)` pone la altura
   (columna flexible con la cabecera arriba y `main` que ocupa el resto) y **todas** las
   pantallas del grupo quitan su `min-h-screen`, incluidos el Inicio del estudiante y las
   dos de pruebas técnicas.
4. **Pasa a la B2:** el texto «mientras no esté entregada» de la práctica libre en lectura
   y auditiva, que es de pantallas del estudiante.

**Cargando y error:** un par `loading.tsx` / `error.tsx` en `pendientes/`, `examenes/` y
`estudiantes/` (las pantallas de dentro heredan el suyo). El esqueleto imita la forma de la
pantalla; el error dice «No hemos podido cargar…» con «Reintentar», como el del Inicio.

## 5. Pantalla por pantalla

### 5.1 Pendientes (`/pendientes`)

- `EncabezadoPagina` «Pendientes».
- La lista, **de la más antigua a la más reciente**, como hoy. Cada fila, una `Tarjeta`:
  estudiante, examen, fecha de entrega, `EtiquetaEstado` «Redacción», «por tiempo» si la
  entregó el reloj, «N días esperando» y `Enlace` como botón «Corregir».
- **No se agrupa por días.** El «Hoy / Mañana» del dibujo es de citas futuras, no de
  entregas que ya llegaron.
- Vacío: `BloqueVacio` «No hay redacciones por corregir», sin mencionar citas.
- `RefrescarAlEntrar` se queda.

### 5.2 Corregir una redacción (`/pendientes/[intentoId]`)

- En ordenador, dos columnas: a la izquierda enunciado, texto y número de palabras; a la
  derecha las notas y los botones. En móvil, una columna.
- **Las notas** (decisión del profesor): por cada tarea, los cuatro criterios de
  `CRITERIOS_EE` (nunca los del dibujo), cada uno con `GrupoDeOpciones` en `segmentos`
  0–1–2–3 (`BANDA_MAXIMA`). **Nacen sin nada marcado** salvo que la redacción ya esté
  corregida, en cuyo caso llegan con las notas guardadas.
- **La suma** arriba: «18 de 24». Es un cálculo en el cliente, y **nunca** se traduce a
  apto / no apto.
- **«Guardar» y «Guardar y seguir» apagados** hasta tener todas las notas, con el motivo
  en texto al lado («Te faltan 2 notas en la tarea 2»). Al enviar, «Guardando…». Se
  conserva «Guardar y seguir» (el dibujo solo pinta uno).
- El comentario, con `Campo` multilínea con su etiqueta.
- Las salidas del estudiante, en `Aviso` coral (se conserva `data-salidas`). «Ya la
  corregiste», en `Aviso` informativo. Los fallos al guardar, en `Aviso` de error.

### 5.3 Exámenes (`/examenes`)

- `EncabezadoPagina` «Exámenes» con la acción «Nuevo examen», que baja al formulario
  (`#nuevo`).
- Cada fila: título, nivel y estado con su tono. Los nombres, los del código: «En
  construcción» neutro, «Publicado» éxito, «Archivado» neutro. (No el «Borrador» del
  dibujo.)
- El formulario en una `Tarjeta`: `Campo` «Título» con etiqueta visible, `Desplegable`
  «Nivel», `Boton` «Crear».
- Vacío con `BloqueVacio`; error con `Aviso`.

### 5.4 Un examen (`/examenes/[id]`)

- Enlace «← Exámenes» y `EncabezadoPagina` con el título; de subtítulo, nivel y gasto de
  IA. Los `?error` / `?aviso` de la dirección, en `Aviso`.
- En ordenador, dos columnas. **Izquierda:** tareas, cuadernillo de soluciones y páginas.
  **Derecha:** publicación y «Quién lo hace». En móvil, en ese orden, una debajo de otra.
- **Tareas:** cada una con `EtiquetaEstado` (completa → éxito, a medias → aviso, vacía →
  neutro) y el recuento de motivos que ya existe. Sustituye a `InsigniaDeEstado`.
- «Hay N hojas sin etiquetar», en `Aviso` coral.
- **Publicación:** «Publicado» con `EtiquetaEstado`. «Publicar» apagado con los motivos
  al lado en coral, no en rojo. «Retirar» y «Recuperar» en secundario; «Archivar» en
  peligro.
- **Quién lo hace:** `Casilla` por estudiante (el «ya lo tiene para el…» queda como
  texto de ayuda bajo la etiqueta), `Campo` de fecha, `GrupoDeOpciones` en `lista` para
  completo / libre, `Boton` «Asignar». En la lista de asignados, «Quitárselo» en
  secundario, los enlaces a la hoja con `Enlace` y el estado de cada prueba con
  `EtiquetaEstado`. El formulario sigue siempre abierto.

### 5.5 La hoja pregunta a pregunta (`/examenes/[id]/hoja/[personaId]/[prueba]`)

- Un solo «← título del examen» arriba; fuera el de abajo.
- `EncabezadoPagina` «Nombre — Prueba» con los aciertos de subtítulo.
- La tabla, dentro de una `Tarjeta`. **Las falladas en coral**, no en rojo de error.

### 5.6 El taller (`/examenes/[id]/[prueba]/[numero]`)

- «← título del examen» y `EncabezadoPagina`.
- `formulario-de-tarea`: «Rellenar con IA» como `Boton` secundario con «Leyendo las
  hojas…» (se conserva el motivo al lado cuando no se puede); el `bloqueo` y los fallos en
  `Aviso`; Guardar pegado abajo como `Boton` con «Guardando…»; las dudas en `Tarjeta`. **La
  pregunta del navegador** antes de rellenar con IA **se queda**.
- `estado-de-la-tarea`: `EtiquetaEstado` y `Tarjeta`.
- `elegir-cuadernillo`: `Desplegable` y `Boton`. `subir-paginas`, `subir-cuadernillo`,
  `foto-de-opcion` y `bloque-de-audio`: sus botones con `Boton` y sus avisos con `Aviso`.
- **No se tocan más que de aspecto:** la onda del audio (`onda.tsx`) y las etiquetas de
  página, cuyo interruptor no tiene pieza en el kit (se queda como botón con
  `aria-pressed`, con los colores del kit). Las marcas del audio separan **trozos**.
- Las respuestas se siguen escribiendo con campos de letra y la marca de la correcta; no se
  copian las casillas apagadas del dibujo.

### 5.7 Estudiantes (`/estudiantes`)

- `EncabezadoPagina` «Estudiantes» (hoy dice «Personas»; el componente se renombra
  también) con la acción «Dar de alta», que baja al formulario (`#alta`).
- Filas planas, sin tarjeta: un círculo con las iniciales, nombre, correo y el papel en
  `EtiquetaEstado` neutro. **Siguen saliendo también los profesores**: quitarlos sería
  cambiar la consulta.
- **Las filas no son enlaces**: todavía no hay ficha del estudiante.
- El formulario: `Campo` nombre y correo, `Desplegable` papel, `Boton`. El error, que hoy
  va en azul y sin `role`, pasa a `Aviso` de error.

## 6. Errores

- Lo de la A sigue igual: sin sesión, a `/entrar`; un estudiante en una pantalla del
  profesor, 404; si falla la cuenta de Pendientes, la cabecera se dibuja sin número.
- Un fallo al cargar cualquier pantalla de la B1 cae en su `error.tsx`, no en la página
  genérica de Next.
- Guardar las notas sigue fallando igual que hoy (mismo aviso, ahora con `Aviso` de
  error); no se cambia la acción de servidor.

## 7. Cómo se prueba

Como en la A: Vitest con `renderToStaticMarkup`, sin jsdom. **Cada prueba nueva se
demuestra rompiendo a propósito lo que vigila** y viéndola en rojo, con el comentario de
mutación. Los atributos se miran recortando la etiqueta (la trampa de `disabled:` de
Tailwind).

- `GrupoDeOpciones`: con valor `null` no hay ningún radio `checked`; con 0, sí el 0. Hay
  `legend`. Las dos formas.
- Corregir:
  - Los criterios dibujados son **exactamente** los de `CRITERIOS_EE`, y no aparece
    «Cohesión».
  - Sin notas previas, ninguna banda marcada. Con la redacción ya corregida, las guardadas.
  - La suma: con notas parciales y completas.
  - Guardar y Guardar y seguir llevan `disabled` y el motivo en texto mientras falte
    alguna, y no lo llevan con todas.
  - El motivo y la suma salen de **funciones puras**, probadas aparte.
- Pendientes: no aparecen «Grabación», «Cita» ni «Ver grabación»; el orden es el de
  la más antigua primero.
- Estudiantes: el título es «Estudiantes»; las filas no llevan `<a>`.
- Un examen: los motivos de no publicar no llevan el tono de error; el mapeo de estado de
  tarea a tono.
- La hoja: una sola vuelta atrás; las falladas sin tono de error.
- Aplazados:
  - `usarEnlace` devuelve el papel y la ruta de entrada manda al profesor a
    `/pendientes`.
  - El Inicio no dibuja el esqueleto para el profesor.
  - Ninguna pantalla de `(sitio)` lleva `min-h-screen` (una prueba que lo busca en los
    ficheros).
  - La sesión: `cache()` de React no guarda nada fuera de una petición de servidor, así
    que en Vitest no se puede contar consultas. Se vigila que el `layout`, las páginas y
    `exigirPersona` lleguen a la sesión **solo** por la función envuelta (una prueba que
    busca llamadas directas a `personaActual` fuera de ella). Lo de una sola consulta se
    mira en la aceptación, en el registro de Prisma si hace falta.
- Las pruebas que hoy vigilan estas pantallas (incluidas las de `data-salidas` y del
  registro de salidas) siguen en verde; si alguna cambia de texto por el vestido, se
  actualiza diciendo por qué.

Al cerrar: `tsc` limpio, lint sin errores, `npm test` y `npm run test:base` enteros.

## 8. Aceptación

Como en la A, por decisión del profesor: **sin vista previa**. Se fusiona y se hace el
paseo en hispaprofe.com, en ordenador y en móvil de verdad.

1. Entrar por el enlace del correo como profesor: se cae en Pendientes **sin ver el
   esqueleto del estudiante**. Escribir `/`: lo mismo.
2. Ninguna pantalla hace scroll si su contenido cabe.
3. Pendientes: las filas, «Corregir». Corregir: las notas nacen vacías, la suma se mueve,
   Guardar apagado con su motivo hasta la última nota; guardar y seguir.
4. Exámenes: «Nuevo examen» baja al formulario; crear uno. El detalle a dos columnas; los
   motivos de no publicar en coral; asignar con fecha y modo; quitarlo.
5. La hoja de un estudiante: una sola vuelta atrás, falladas en coral.
6. El taller: rellenar con IA, guardar, las etiquetas de página, oír el audio.
7. Estudiantes: dar de alta.
8. `/muestrario`: las dos formas de `GrupoDeOpciones`.
9. Con el teclado: foco visible; las notas se cambian con las flechas.

## 9. Lo que sigue abierto

- **La B2** (pantallas del estudiante), con su spec y su aceptación, cuando la B1 esté
  aceptada. Se lleva el texto de la práctica libre.
- **La 3e (oral)**, que necesita foto en las tareas de redacción.
- **La portada pública**, esperando los datos comerciales del profesor.
