# Handoff: Carcasa y pantallas de HispaProfe (DELE escolar A2/B1)

## Overview
Diseño de la carcasa común (cabecera + navegación) de HispaProfe, un sitio donde
un profesor y doce estudiantes adolescentes preparan el DELE escolar A2/B1, más
las pantallas hoy en producción, la carcasa mínima del examen cronometrado, una
portada pública, el kit de piezas reutilizables y una nota de construcción.
Regla de diseño rectora: doce estudiantes, un profesor — nunca filtros,
paginación ni colas largas.

## About the Design Files
Los ficheros `.dc.html` de esta carpeta son **referencias de diseño hechas en
HTML** — prototipos que muestran el aspecto y el comportamiento previstos, no
código de producción para copiar tal cual. La tarea es **recrear estos diseños
en el entorno real del proyecto** (Next 16, React 19, Tailwind 4) usando sus
patrones ya establecidos, siguiendo el orden y las piezas descritas en
`05-Nota-de-construccion.dc.html`.

## Fidelity
**Alta fidelidad (hifi).** Colores exactos (tomados de `03-colores-y-letra.css`,
incluido en esta carpeta), tipografía Nunito con pesos y tamaños definidos,
radios y sombras concretos, y los tres anchos de referencia: ordenador 1280 px,
móvil 400 px. Recrear pixel a pixel con los componentes propios del kit, no con
una librería de UI nueva.

## Screens / Views
Cada fichero es una página autocontenida; abrir cualquiera muestra la barra de
navegación del paquete para saltar entre todas.

- **00-Indice.dc.html** — portada del paquete de diseño y su navegación.
- **01-Carcasa.dc.html** — `Cabecera` (papel estudiante/profesor) en ordenador
  y móvil, abierta/cerrada; y `CabeceraExamen`, la carcasa mínima que sustituye
  a `Cabecera` durante una prueba cronometrada (aviso previo, barra con reloj,
  confirmación de salida).
- **02-Pantallas-Estudiante.dc.html** — Inicio (con datos/vacío/cargando/error),
  Hacer la lectura (dos columnas en ordenador, barra pegada abajo en móvil),
  Hacer la escrita (pestañas, reloj, contador de palabras), Resultado de una
  prueba.
- **03-Pantallas-Profesor.dc.html** — Pendientes, Corregir una redacción
  (bandas 0–3 que nacen vacías), Exámenes (lista, detalle, publicación,
  asignación), El taller de una tarea (páginas + formulario + audio),
  Estudiantes (lista + ficha con opiniones y permisos).
- **04-Kit-de-piezas.dc.html** — los diez componentes base con sus variantes y
  estados.
- **05-Nota-de-construccion.dc.html** — orden de construcción recomendado, qué
  pieza es cada cosa en pantalla, qué token de color usa cada una, y el mapa de
  rutas de hoy.
- **06-Portada-publica.dc.html** — escaparate público para `/` sin sesión;
  anuncia el DELE escolar A2/B1. Los bloques de precio, convocatoria, plazas y
  opiniones son huecos marcados a propósito — **no inventar esos datos**, se
  rellenan cuando el profesor los dé.

## Interactions & Behavior
- **Menú móvil**: el icono de hamburguesa abre un panel que cubre el resto de
  la pantalla; se cierra con la ✕. Nunca se navega mientras el panel está
  abierto sin cerrarlo primero.
- **Regla dura del menú**: no se dibuja ningún enlace a una sección que no
  funcione todavía. Hoy estudiante ve solo Inicio; profesor ve Exámenes,
  Estudiantes, Pendientes. Practicar, Mis resultados, Biblioteca y la Oral
  están diseñados pero fuera de cualquier menú real hasta que existan.
- **Salir durante un examen**: nunca navega directo — siempre pasa por el
  modal de confirmación (`¿Seguro que quieres salir?`) porque el reloj sigue
  corriendo en el servidor aunque el estudiante cierre la pestaña.
- **Entrega de una prueba**: es irreversible. El aviso de "no se puede volver
  a abrir" se muestra ANTES de empezar, no después de entregar.
- **Botones que envían algo** (Guardar redacción, Rellenar con IA): cambian a
  estado de carga con spinner + texto de progreso (p. ej. "Guardando…",
  "Leyendo la página…"); vuelven a su estado normal al terminar.
- **Guardar corrección**: el botón permanece deshabilitado hasta que las 8
  casillas de banda (4 bandas × 2 tareas) tengan un valor — un 0 es una nota
  legítima y no cuenta como vacía, así que el chequeo es "tiene valor", no
  "es mayor que 0".
- **Publicar un examen**: se bloquea con un aviso de error inline que explica
  el motivo exacto (p. ej. "la Tarea 3 de lectura tiene 5 ítems, hacen falta
  6") — nunca solo un botón apagado sin explicación.
- **Opiniones de estudiantes**: solo las que tienen "Permiso dado" muestran el
  botón "Publicar en la portada"; sin permiso, ese botón no se dibuja en
  absoluto (no se deshabilita, se omite).
- **Fecha tope**: es blanda. Entregar tarde no bloquea nada; solo cambia la
  etiqueta a "Se pasó el plazo el…" en tono aviso (coral), nunca en tono error.
- **Resultado de una prueba**: nunca traduce la nota a "apto"/"no apto"; solo
  enseña números ("18 de 24"). En preguntas falladas, marca en rojo la
  respuesta del estudiante sin revelar cuál era la correcta.
- **Marca "ñ" del logo**: en `00-Indice.dc.html`, el cuadrado del logo antes de
  "HispaProfe" es una "ñ" minúscula cuyo color de fondo cicla suavemente cada
  12s entre los tonos de la paleta (azul → verde → ámbar → coral →azul) vía
  `@keyframes marca-color`; es un detalle solo de este paquete de diseño, no
  una pieza del kit de producción.
- **Resaltado de "ñ"**: `enye.js` colorea discretamente cada "ñ"/"Ñ" del texto
  dentro de cualquier elemento con `data-enye-zone`. Es una ayuda de este
  paquete de diseño para poner en valor la letra distintiva del español, no un
  requisito de producto — el desarrollador decide si merece la pena portarlo.

## State Management
- **Cabecera**: prop `papel` (`"estudiante"` | `"profesor"`) decide los
  enlaces; estado local de menú móvil abierto/cerrado.
- **CabeceraExamen**: prueba activa, tarea actual (`n de N`), segundos
  restantes (cuenta atrás en el servidor, la UI solo refleja), estado de modal
  de confirmación de salida abierto/cerrado.
- **Inicio (estudiante)**: estado de carga de los exámenes asignados
  (cargando/con datos/vacío/error); por prueba, uno de
  en-curso/hecha/sin-empezar/empezada/plazo-pasado.
- **Hacer la lectura/escrita**: pregunta o tarea activa, respuesta seleccionada
  por pregunta, contador de palabras derivado del texto, estado de guardado
  (reposo/guardando/guardado), tiempo restante.
- **Corregir una redacción**: valor de cada una de las 8 casillas de banda
  (`null` inicial, no `0`), texto de comentario por tarea, contador de veces y
  tiempo fuera de pantalla (viene del cliente del examen), estado del botón
  Guardar derivado de si las 8 casillas tienen valor.
- **Exámenes/Taller**: estado de publicación (borrador/publicado), validación
  de ítems completos por tarea, lista de asignaciones (estudiante, fecha tope,
  modo completo/libre, progreso).
- **Estudiantes/Ficha**: lista de opiniones con su estado de permiso
  (dado/sin-permiso/pendiente) y si está publicada en portada.

## Design Tokens
Todos definidos en `03-colores-y-letra.css` (incluido en esta carpeta, Tailwind
4, `@theme`). Resumen de uso — ver la tabla completa en
`05-Nota-de-construccion.dc.html`:

- `--color-hp-50` / `--color-hp-700`: fondo/texto de sección activa y avisos
  informativos.
- `--color-hp-700`: fondo de botón primario (no usar `hp-400`: letra blanca
  sobre azul claro dio problemas de contraste).
- `--color-hp-300` / `--color-hp-600`: borde y texto de botón secundario.
- `--color-verde-100` / `--color-verde-600`: estados "hecha", "publicado",
  "éxito".
- `--color-sol-100` / `--color-sol-400`: estado "sin empezar", avatar de
  usuario, "Rellenar con IA".
- `--color-coral-100` / `--color-coral-500` / `--color-coral-600`: botón de
  peligro, "se pasó el plazo", "no preparada".
- `--color-error-100` / `--color-error-500` / `--color-error-600`: errores
  reales (fallo de red, campo inválido) — distinto de coral.
- `--color-fondo` / `--color-tinta` / `--color-tinta-suave`: fondo de página,
  texto principal, texto de apoyo.
- `--shadow-tarjeta` / `--radius-tarjeta`: toda pieza `Tarjeta`.
- Tipografía: Nunito, pesos 400/600/700/800, cargada vía Google Fonts en el
  prototipo (en el proyecto real, según cómo ya se sirva la fuente).
- No hizo falta ningún color nuevo — la paleta existente cubre las diez piezas
  del kit y las siete pantallas de este paquete.

## Assets
No hay imágenes ni iconos reales; las páginas escaneadas del libro, fotos de
opciones y avatares de usuario son marcadores con textura (`repeating-linear-
gradient`) o iniciales — sustituir por los assets reales del profesor/alumno
cuando existan. La portada pública deja explícitamente como huecos: precio,
próxima convocatoria, plazas y opiniones — no inventar esos datos.

## Files
- `00-Indice.dc.html` — índice y navegación del paquete.
- `01-Carcasa.dc.html` — `Cabecera` y `CabeceraExamen`.
- `02-Pantallas-Estudiante.dc.html` — Inicio, Hacer la lectura, Hacer la
  escrita, Resultado.
- `03-Pantallas-Profesor.dc.html` — Pendientes, Corregir, Exámenes, Taller,
  Estudiantes.
- `04-Kit-de-piezas.dc.html` — Boton, Enlace, Tarjeta, Aviso, EtiquetaEstado,
  Campo, Casilla, Desplegable, EncabezadoPagina, BloqueVacio.
- `05-Nota-de-construccion.dc.html` — orden de construcción, mapeo pieza↔color,
  mapa de rutas.
- `06-Portada-publica.dc.html` — portada pública `/` sin sesión.
- `03-colores-y-letra.css` — tokens de color y tipografía (Tailwind 4) de
  referencia.
- `enye.js` — script decorativo del propio paquete de diseño (resalta la "ñ"),
  no es parte del kit de producción.
