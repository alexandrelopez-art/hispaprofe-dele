# El taller del examen · Entrega 1: cargar un examen a mano

*13 sept 2026. Diseño aprobado por el profesor sección a sección. Desarrolla la
sección 3 del diseño general (`2026-09-09-hispaprofe-dele-design.md`) y la parte
«taller» de sus secciones 10 y 12.*

## 1. Qué es y por qué va primero

El taller es donde el profesor pasa un examen del libro al sitio. Se parte en
tres entregas, cada una usable por sí sola:

1. **Cargar un examen a mano** (esta). Sin IA.
2. «Rellenar con IA» y la revisión de cada pregunta junto a su respuesta.
3. Audio con cortes sobre la onda, fotos, publicar y asignar.

Va primero lo manual porque **no necesita `ANTHROPIC_API_KEY`**, que sigue sin
ponerse: con esta entrega ya se pueden subir exámenes.

**Decisiones del profesor que enmarcan todo (no se reabren sin información nueva):**

- **La IA copia; las respuestas correctas NO las pone la IA.** Se leen sin IA de la
  tabla «SOLUCIONES» del cuadernillo. Motivo: el error más grave, la clave corrida un
  renglón, no lo ve ninguna comprobación de estructura.
- **Se cargan las cuatro pruebas**, para subir cada examen una sola vez. Escrita y
  oral quedan guardadas y no se publican hasta que exista la pantalla del estudiante
  que las usa.
- **Las páginas se asignan a mano**: se sube el PDF entero y el profesor etiqueta
  cada miniatura con una o varias tareas. Nada de reparto automático.
- **El taller se rehace sobre el modelo nuevo**, rescatando del repositorio viejo solo
  lo que no depende de su modelo (sección 11). El viejo mete las respuestas dentro de
  los datos del ejercicio; aquí viven aparte.
- **Nuevo nivel «A2/B1 escolar»** y reglas de estructura por nivel.

**Fuera de esta entrega:** la IA, el audio, las imágenes dentro de las tareas,
publicar, asignar y cualquier pantalla del estudiante.

## 2. El recorrido del profesor

1. **Exámenes → «Nuevo examen».** Título y nivel. Al crearlo nacen sus tareas vacías
   según las reglas del nivel (14 en el escolar).
2. **Subir el PDF del examen.** El navegador lo parte en imágenes y sube cada una
   directamente al almacén privado. Se ven las miniaturas en fila.
3. **Etiquetar las páginas.** Bajo cada miniatura, botones con las tareas del examen;
   una página puede llevar varias.
4. **Elegir el cuadernillo** del libro (o subirlo, la primera vez) y decir **qué número
   de examen del libro es**.
5. **Pantalla del examen**: páginas, cuadernillo y las tareas en cuatro bloques con su
   estado (*vacía*, *a medias* con sus motivos, *completa*). Señala las páginas sin
   etiqueta.
6. **Pantalla de una tarea**: a la izquierda sus páginas; a la derecha el formulario con
   la forma fija de esa tarea, la numeración del libro y **las respuestas del
   cuadernillo ya puestas, que no se editan**.
7. **Guardar** siempre guarda, aunque falte algo, y la tarea queda *a medias* diciendo
   qué falta.

## 3. Cambios en el modelo

**`Nivel`** gana `A2_B1_ESCOLAR`. `ESTRUCTURA` (`lib/dele/estructura.ts`) pasa a ir por
nivel: `Record<Nivel, reglas | null>`. Hoy solo el escolar tiene reglas. **El taller
solo ofrece crear exámenes de niveles con reglas**, porque sin reglas no hay forma de
tarea que rellenar; y `motivosParaNoPublicar` devuelve «Este nivel todavía no tiene sus
números» para cualquier examen de un nivel sin ellas. Las reglas del escolar ganan,
por tarea, su **forma** (sección 4) y su **primer número** (CE 1, 7, 13, 19; CO 1, 8,
14, 20).

**`Cuadernillo`** (nuevo): `id`, `titulo`, `texto` (el texto entero, para la Entrega 2),
`soluciones` (JSON: `{ [examen]: { CE: { [numero]: letra }, CO: {…} } }`), `createdAt`.
El PDF no se guarda: solo lo que se sacó de él.

**`Examen`** gana `cuadernilloId?` (`onDelete: Restrict`) y `numeroEnCuadernillo?`.

**`PaginaDeExamen`** (nuevo): `id`, `examenId` (cascada), `ficheroId` (`Restrict`),
`orden`, `etiquetas: String[]` con valores `CE-1`…`EO-4`. `@@unique([examenId, orden])`.

**`TipoActividad`** gana `CONVERSACION`: las orales 2 y 4 son en directo con el
profesor y no son una grabación.

**Qué es un «ítem»** (el hueco que dejaron los cimientos): una pregunta numerada de una
actividad autocorregible de la tarea. **El ejemplo no cuenta.** Lo calcula una función,
`itemsDeTarea`, que es la que alimenta a `motivosParaNoPublicar`.

**`orden` decimal para arrastrar piezas** sigue aparcado: los formularios del taller
tienen forma fija y no reordenan nada.

## 4. Las formas de las tareas

Contrastadas contra las páginas de los exámenes 1 y 2 del libro. Todas empiezan por una
pieza TEXTO con la **consigna ya corregida** (sin «Hoja de respuestas»; la original está
en la página de al lado). Las letras son siempre mayúsculas aunque el libro use «a)».

Cada `Actividad.datos` tiene un **esquema Zod con `.strict()`** por forma, y cada ítem
lleva su `numero` del libro. **Ningún esquema de `datos` admite un campo de respuesta**:
las respuestas van en `Clave.respuestas` como `{ "13": "B" }`.

| Forma | Tareas | Piezas y datos |
|---|---|---|
| Relacionar con ejemplo | CE1, CO2 | ACTIVIDAD `RELACIONAR`: `ejemplo` {numero 0, texto, letra}; 6 elementos {numero, texto}; 10 destinos A-J {letra, titulo?, texto}. Sobran 3. En CO2 los elementos son «Mensaje 1-6» sin texto y los destinos son los enunciados. |
| Lista común | CE2, CO3 | CE2: tres TEXTO (uno por persona, con su nombre de etiqueta). ACTIVIDAD `OPCION`: `comunes` A/B/C {letra, texto}; 6 preguntas {numero, enunciado}; en CO3, `ejemplo` {numero 0, enunciado, letra} y comunes «ella / él / ninguno de los dos» con los nombres del diálogo. |
| Opciones propias | CE3, CO1, CO4 | CE3: un TEXTO con el texto largo. ACTIVIDAD `OPCION`: preguntas {numero, enunciado, opciones A/B/C {letra, texto?, conImagen}, grupo?}. CO1 lleva `ejemplo` y sus ítems 1-4 (y el ejemplo) tienen `conImagen: true`; CO4 agrupa de dos en dos (`grupo` 1-3, «Primera noticia»…). |
| Huecos | CE4 | ACTIVIDAD `HUECOS`: titulo, texto con marcas `[19]`…`[25]`, fuente, huecos {numero, opciones A/B/C}. Cada marca aparece una vez y coincide con un hueco. |
| Redacción | EE1, EE2 | ACTIVIDAD `REDACCION`. EE1: situacion, textoRecibido, pautas[], palabras {min, max}. EE2: dos opciones {titulo, contexto, pautas[]}, palabras. |
| Oral solo | EO1, EO3 | ACTIVIDAD `GRABACION`: dos opciones {tema, pautas[], conImagen} (EO1 lleva foto; EO3 no), minutos {min, max}, preparacion. |
| Oral en directo | EO2, EO4 | ACTIVIDAD `CONVERSACION`: dos opciones {tema, situacion?, papelExaminador?, pautas[]}, minutos. **La opción N va con la opción N de EO1 / EO3**: el formulario enseña al lado, sin editar, el tema de la tarea hermana, para que el profesor empareje por tema (el libro intercala las páginas y tiene rótulos de opción equivocados). |

Los números de las formas (6 elementos, 10 destinos, 3 opciones…) salen de las reglas
del nivel y no de constantes sueltas por el código.

## 5. Estado de una tarea

- **Vacía:** nunca se guardó.
- **A medias:** guardada, con una lista de motivos legibles.
- **Completa:** sin ningún motivo.

Motivos:

1. Un texto obligatorio vacío (consigna, enunciado, opción de texto, pauta…).
2. En CE y CO: **no hay cuadernillo** o no tiene soluciones para ese número de examen.
3. Los números del cuadernillo no coinciden con los de la tarea: «el cuadernillo trae
   la 19, la tarea empieza en la 20». Se dice cuál sobra y cuál falta.
4. **Una letra imposible** para ese ítem (una D con opciones A-C, una letra de destino
   que no existe, **la letra del ejemplo usada en un ítem** de relacionar).
5. En relacionar: dos ítems con la misma letra.
6. En huecos: marcas del texto que no casan con los huecos.

**Las imágenes pendientes no bloquean en esta entrega**, porque todavía no se pueden
subir. La tarea muestra «Faltan N imágenes (se suben en la Entrega 3)». La Entrega 3
convierte eso en motivo.

**Al guardar:** los `datos` se validan contra su esquema estricto (la forma nunca se
rompe, aunque falten textos), se reescriben las piezas de la tarea en una transacción,
y **la `Clave` se copia del cuadernillo** para los números que la tarea tiene. Si
después se elige otro cuadernillo u otro número de examen, las claves se recalculan
al volver a guardar cada tarea, y mientras tanto el estado lo compara y lo avisa.

## 6. El cuadernillo

- **El PDF no sale del navegador.** El navegador saca con `pdfjs-dist` (la misma
  librería que parte las páginas) los trozos de texto con su página y su posición, y
  manda al servidor solo eso. Así pdf.js no corre nunca en Vercel. El envío va por una
  acción de servidor, que corta a 1 MB, así que el tope es de **10.000 trozos**; el del
  libro son unos 2.300 (unos 160 KB).
- El servidor **usa la posición horizontal de cada trozo para separar las dos
  columnas** de la tabla de soluciones: en ese PDF cada página lleva dos exámenes lado
  a lado.
- Solo lee páginas que contienen «SOLUCIONES». Dentro de cada columna, de arriba abajo:
  «EXAMEN N», «… LECTURA» / «… AUDITIVA» y pares `13-B`. La tarea de cada par la da su
  número, no el rótulo «TAREA N». **Comprobado el 13 sept contra el cuadernillo real:
  seis exámenes, 25 + 25 respuestas cada uno.**
- **Al terminar enseña lo que ha entendido**: una tabla por examen con cuántas
  respuestas tiene cada tarea, y lo marca en rojo si no cuadra con las reglas del
  nivel (6/6/6/7 y 7/6/6/6, numeración seguida). Se guarda igualmente: el profesor
  decide.
- Un PDF sin texto, o sin bloque «SOLUCIONES», se rechaza con su mensaje.

## 7. Las páginas

- Se rescata `paginasDePdf` del taller viejo: pdf.js en el navegador, escala 2, JPEG
  al 85 %. El worker se copia a `public/` en el `postinstall`. Un PDF del libro puede
  traer dos páginas del libro por hoja (el del examen 2 tiene 7): da igual, se
  etiqueta la hoja.
- Cada imagen sube **directa al almacén de Vercel** con el camino que ya existe
  (`/api/ficheros/permiso` y `/api/ficheros/confirmar`) y luego se registra como
  `PaginaDeExamen`. Solo se registra un `Fichero` del almacén VERCEL y de tipo imagen.
- Si una falla, queda marcada con «Reintentar» y las demás siguen. El orden lo da el
  PDF, no la llegada.
- **Volver a subir el PDF** pide confirmación, borra páginas y etiquetas, y borra sus
  ficheros del almacén si nada más los usa.
- Las páginas se ven con los enlaces firmados de 5 minutos que ya existen.

## 8. Pantallas y candados

| Ruta | Qué hay |
|---|---|
| `/examenes` | Lista de exámenes con estado y «Nuevo examen». Es la entrada «Exámenes» del mapa aprobado. |
| `/examenes/[id]` | Páginas y etiquetas, cuadernillo y número, y las tareas en cuatro bloques. |
| `/examenes/[id]/[prueba]/[numero]` | Página(s) a la izquierda, formulario a la derecha, Guardar y motivos. |

- Toda pantalla y toda acción llaman a `exigirProfesor`. **A un estudiante le sale el
  404**, no un «no tienes permiso».
- Ninguna acción que cambie algo es un GET (lección de `/salir`).
- Diseño con el kit del lienzo aprobado. El lienzo no dibuja el taller, así que se
  construye con sus piezas y se enseña al profesor en Chrome.

## 9. Errores

Siempre en español y diciendo qué hacer:

- Subida de página rota: «Reintentar».
- Cuadernillo ilegible: el motivo exacto.
- Guardar con datos que no casan con la forma (una manipulación, no un despiste): 400
  y nada escrito.
- Tarea o examen inexistente: 404.

## 10. Cómo se prueba

- **Reglas puras** con Vitest: `itemsDeTarea`, cada motivo de la sección 5, los
  esquemas estrictos (incluido que **ninguno acepta un campo de respuesta**), el
  lector de soluciones y la estructura por nivel.
- **El lector de soluciones con dos fixtures:** uno inventado con la misma forma (trozos
  con posición, dos columnas, letras hasta la J), que va en el repo; y el cuadernillo
  real, **solo en este Mac**, en una prueba que se salta si falta la variable
  `CUADERNILLO_REAL`. **El repo es público: ni el cuadernillo, ni sus textos, ni las
  páginas del libro entran en él.** La prueba real tiene que dar 6 exámenes × 50
  respuestas.
- **Contra Postgres** (`tests/base`): guardar reescribe piezas y clave en una
  transacción; la clave nunca sale por `actividadParaElEstudiante`; borrar un examen
  arrastra páginas y tareas pero no el cuadernillo.
- **Cada candado se prueba en su sitio**, no solo la regla: una prueba por ruta y por
  acción que falla si se quita `exigirProfesor`.
- **Mutación**: quitar cada motivo tiene que poner al menos una prueba en rojo.
- **Aceptación en Chrome contra producción:** cargar entero el examen 1 del libro
  (páginas, etiquetas, cuadernillo, las 14 tareas) y llegar a «completa» en las ocho de
  lectura y auditiva. Probar también el examen 2, el de las hojas dobles.

## 11. Qué se rescata del repositorio viejo

- `paginasDePdf` y la reducción de imágenes (`components/taller/paginas.tsx`).
- La lectura de texto de `textoDePdf` (`lib/taller/cuadernillo.ts`), llevada al
  navegador y ampliada para devolver cada trozo con su página y su posición.
- La idea de `components/taller/dudas.ts` y del campo con aviso de los editores.

Lo demás del taller viejo (onda, corte con ffmpeg, reproductor encadenado, llamada a la
IA) es de las Entregas 2 y 3.

## 12. Lo que sigue abierto

- **La autorización fina de ficheros** sigue aparcada desde la puerta: cualquiera que
  haya entrado puede pedir un fichero de material por su identificador. Las páginas del
  libro son de ese tipo. Se cierra antes de que un estudiante tenga acceso a nada.
- Las capturas sueltas de cada carpeta de examen no se usan: basta el PDF.
