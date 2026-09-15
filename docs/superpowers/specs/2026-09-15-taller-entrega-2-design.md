# El taller del examen · Entrega 2: rellenar una tarea con IA

*15 sept 2026. Diseño aprobado por el profesor sección a sección. Continúa
`2026-09-13-taller-entrega-1-design.md`, cuyo punto 2 del reparto en tres entregas
es este.*

## 1. Qué es

En la pantalla de una tarea, un botón **«Rellenar con IA»** lee las hojas etiquetadas
con esa tarea y **llena el formulario en pantalla sin guardar nada**. El profesor
revisa con la hoja al lado y pulsa «Guardar», que es el guardado de la Entrega 1 con
sus comprobaciones.

**Decisiones del profesor (no se reabren sin información nueva):**

- **Nada entra en la base sin que el profesor lo vea.** La IA rellena el formulario;
  no guarda. Descartada la variante del sitio viejo (guardar como «rellenada sin
  revisar» y marcar «revisada»), que obligaba a estados y reglas de vuelta atrás.
- **Las catorce tareas**, no solo lectura y auditiva: la Entrega 1 carga las cuatro
  pruebas con su formulario y el trabajo de la IA es el mismo, copiar.
- **Una tarea cada vez, esperando la respuesta.** Descartados el progreso en directo
  (código de más para entretener la espera) y los lotes (obligan a guardar borradores,
  lo que contradice la primera decisión).
- Sigue en pie la de la Entrega 1: **la IA copia; las respuestas correctas NO las
  pone la IA.** Salen del cuadernillo, y por eso **el cuadernillo no se le manda**.

**Fuera de esta entrega:** rellenar varias tareas de golpe, guardar borradores, que la
IA oiga el audio, las fotos, y la autorización fina de ficheros (sigue abierta desde
la puerta y se cierra antes de dar acceso a estudiantes).

## 2. El recorrido del profesor

1. En la pantalla de una tarea, encima del formulario, el botón **«Rellenar con IA»**.
   Sale **apagado con su motivo** en dos casos:
   - la tarea no tiene hojas etiquetadas: «Etiqueta primero las hojas de esta tarea»;
   - no hay `ANTHROPIC_API_KEY` en el entorno: «Falta la clave de la IA».
2. Si el formulario **tiene algo escrito** (guardado o no), pide confirmación:
   «Se sustituirá lo escrito por lo que lea la IA. ¿Seguir?». «Tiene algo escrito» es
   que difiere del formulario vacío de su regla.
3. Al pulsar, el botón pasa a **«Leyendo las hojas…»** y queda apagado hasta que
   vuelve la respuesta: un segundo clic no puede lanzar una segunda llamada pagada.
4. Al volver bien, el formulario se sustituye por lo leído y queda **«sin guardar»**
   (el mismo aviso que ya da el formulario al editar).
5. **Los campos dudosos se pintan en amarillo** con la nota debajo («La IA duda: …»),
   y encima del formulario va la lista de todas las dudas, para no tener que buscarlas.
   Una duda desaparece de su campo en cuanto el profesor edita ese campo.
6. **Las dudas no se guardan**: viven en la pantalla y se pierden al guardar o al salir.
7. Al volver mal, el formulario **se queda como estaba** y se muestra el mensaje del
   motivo (sección 6).

**La pantalla del examen** gana una sola línea con el gasto: «IA: 1,84 $ en 14
llamadas» (sección 5). No gana ningún botón.

## 3. Lo que la IA deja hecho a propósito

- **La consigna, ya corregida**, sin «Hoja de respuestas» ni nada que no tenga sentido
  en el sitio. Como la original está en la hoja de al lado, **la consigna va siempre
  en la lista de dudas**, con la nota «Consigna retocada: compárala con la hoja».
- **Opciones que son un dibujo** (las que el formulario vacío marca `conImagen`): el
  texto se deja vacío y no se describe el dibujo. La foto es de la Entrega 3.
- **Orales 2 y 4:** las dos opciones en el orden en que aparecen en la hoja. El
  emparejamiento con la tarea hermana lo comprueba el profesor con el tema que el
  formulario ya enseña al lado.
- Letras en mayúscula y textos literales, con sus tildes y su puntuación.

## 4. La llamada, por dentro

**La acción** `rellenarTareaConIAAccion(examenId, prueba, numero)` vive en
`app/examenes/acciones.ts` y su primera línea es `exigirProfesor()`, como todas. La
lógica va en `lib/taller/ia/` para probarla sin Next.

**Entrada:**

1. **Las hojas etiquetadas con la tarea**, en su orden, descargadas por el servidor
   del almacén privado con la llave que ya usa `/api/ficheros`. El navegador no manda
   ninguna imagen. Si una no se puede descargar, se para aquí: «No se pudo leer la
   hoja N del almacén», sin llamar a la IA.
2. **Unas instrucciones fijas** en `system`, idénticas en todas las llamadas, con
   `cache_control` para que se reaprovechen: el papel (transcribir un examen del DELE
   para que lo vea un estudiante tal cual), las reglas de la sección 3, no poner
   respuestas, y cómo apuntar dudas.
3. **El mensaje de la tarea:** primero las imágenes; después un texto con qué tarea
   es («Comprensión de lectura, tarea 3, A2/B1 escolar»), qué pide su forma («un texto
   largo y 6 preguntas con 3 opciones cada una»), y **el formulario vacío** de su regla
   (`formularioVacio`) en JSON, con números, letras, grupos y `conImagen` ya puestos:
   la IA rellena textos, no inventa la forma.

**Llamada:** `@anthropic-ai/sdk`, modelo `claude-opus-5`, razonamiento adaptativo con
esfuerzo `high` (manda la exactitud), en flujo con el mensaje final (para que no la
corte un tiempo de espera), y el **respaldo del servidor** ante un rechazo
(`fallbacks: "default"` con su cabecera beta). **Salida con esquema obligatorio**
(`output_config.format`): el esquema Zod **de la forma de esa tarea** (el miembro de
`formularioBase`, no la unión entera) más `dudas: { campo, nota }[]`. `campo` es la
ruta del campo con puntos e índices desde cero: `actividad.preguntas.2.enunciado`.

Lo que el esquema de la API no admite (longitudes, mínimos, máximos) lo quita el SDK y
lo vuelve a comprobar al leer; además la respuesta se pasa otra vez por el esquema Zod
completo.

**Al volver, antes de devolver nada al navegador:**

1. `stop_reason` `max_tokens` → error «La IA se quedó sin espacio y la respuesta está
   a medias». `refusal` (tras el respaldo) → «La IA no quiso leer estas hojas». Sin
   salida válida contra el esquema → «La IA devolvió algo que no es esta tarea».
2. **Se imponen la forma, los números, las letras, los grupos y `conImagen` del
   formulario vacío** sobre lo leído, posición a posición
   (`imponerEstructura(vacio, leido)`, función pura). Si **una lista tiene otra
   cantidad** que en el formulario vacío (textos sueltos, elementos, destinos,
   lista común, preguntas, opciones, huecos, las dos opciones de escrita y oral),
   **se rechaza entero**: «La IA leyó 5 preguntas y la
   tarea tiene 6». No se recoloca nada a ojo: una pregunta corrida un sitio es el
   error que no se ve.
   Las **pautas** son la excepción: su número es libre en la forma, así que se aceptan
   las que vengan.
3. Tras imponer, `fallosDeForma(regla, f)` tiene que salir vacío. Si no, es un fallo
   del código y se trata como error, no se enseña.
4. Se descartan las dudas cuyo `campo` no existe en el formulario, y se añade la duda
   fija de la consigna (sección 3).
5. Se devuelve `{ formulario, dudas }`. **La acción no escribe en `Tarea`, `Pieza`,
   `Actividad` ni `Clave`.**

**Tiempo:** la pantalla de la tarea declara `maxDuration = 300`.

## 5. El registro de llamadas

**`LlamadaDeIA`** (nuevo): `id`, `examenId` (cascada), `prueba`, `numero`, `modelo`
(el que respondió de verdad, que con el respaldo puede no ser Opus 5), `tokensEntrada`,
`tokensCacheLeidos`, `tokensCacheEscritos`, `tokensSalida`, `costeMilesimasDeDolar`
(entero), `milisegundos`, `resultado` (`OK` o `ERROR`), `error?` (el mensaje),
`createdAt`.

- Se apunta **siempre que se llegó a llamar a la API**, también si falla después, porque
  se paga igual. No se apunta si no se llegó a llamar (sin hojas, sin clave, hoja
  ilegible).
- El coste lo calcula una función pura con las tarifas de Opus 5 (5 $ el millón de
  entrada, 25 $ el de salida; leer caché al 10 %, escribirla al 125 %). Es una
  **estimación**: la factura manda.
- La pantalla del examen suma sus llamadas en una línea.

**Si el profesor cierra la pestaña a mitad**, la llamada sigue en el servidor, se paga
y queda apuntada, aunque no vea el resultado.

## 6. Errores

En todos, el formulario se queda como estaba.

| Qué pasa | Mensaje |
|---|---|
| Sin `ANTHROPIC_API_KEY` | Botón apagado: «Falta la clave de la IA» (y la acción lo rechaza igual si la llaman) |
| Sin hojas etiquetadas | Botón apagado; la acción lo rechaza igual |
| Clave no válida (401) | «La clave de la IA no es válida. Revísala en Vercel.» |
| 429 o 5xx tras los dos reintentos del SDK, o sin conexión | «La IA no responde ahora. Prueba en un minuto.» |
| Hoja ilegible del almacén | «No se pudo leer la hoja N del almacén.» |
| Cortada, rechazada, fuera de esquema | Sección 4, punto 1 |
| Cantidades distintas | «La IA leyó 5 preguntas y la tarea tiene 6.» |
| La acción revienta por otra cosa | El formulario ya avisa si guardar falla por red; rellenar usa el mismo aviso |

Los errores se distinguen por las clases del SDK (`Anthropic.AuthenticationError`,
`RateLimitError`, `APIError`…), nunca por el texto del mensaje.

## 7. Cómo se prueba

Regla de siempre: **cada prueba lleva «Mutación que la mata: …» y se comprueba a mano
al menos una por tarea del plan.**

**Funciones puras, sin red:**

- `imponerEstructura`: un número, una letra, un grupo o un `conImagen` cambiados por la
  IA vuelven a los del formulario vacío; una lista con una pregunta de menos o de más
  se rechaza; las pautas de más se aceptan. Una prueba por cada una de las 8 formas.
- Filtro de dudas: una ruta que no existe se tira; una que existe se queda; la duda de
  la consigna está siempre.
- Coste: con tokens conocidos sale la cifra exacta, caché incluida.
- Instrucciones: el mensaje de cada forma lleva su formulario vacío y su descripción;
  el bloque fijo es **idéntico byte a byte** entre dos tareas distintas (si no, la
  caché no acierta nunca).

**La acción, con una IA falsa inyectada:**

- sin sesión de profesor rebota (la guarda enganchada en la acción, no solo la regla);
- sin hojas no llama a la IA ni apunta llamada;
- una respuesta rechazada devuelve error y ningún formulario, y **sí** apunta la llamada;
- una respuesta buena devuelve el formulario con la estructura impuesta;
- **no cambia ninguna fila de `Tarea`, `Pieza`, `Actividad` ni `Clave`**, comprobado
  contra Postgres real contando filas y comparando `datos` antes y después.

**El formulario:** un campo con duda sale marcado y deja de estarlo al editarlo;
rellenar deja «sin guardar»; con algo escrito pide confirmación y sin nada no.

**Contra la API de verdad, a mano y una vez** (unos 1 $): **una tarea de cada una de
las 8 formas** del examen 1. Es lo único que demuestra que la API acepta los ocho
esquemas. Se observa, sin exigirlo, si la caché acierta (`cache_read_input_tokens`):
las instrucciones fijas rondan el mínimo cacheable de Opus 5 y el ahorro posible es
de céntimos. Se hace en la aceptación, en producción.

## 8. Lo que hace falta antes de la aceptación

1. **El profesor pega `ANTHROPIC_API_KEY` en el proyecto `hispaprofe-dele` de
   Vercel** (Production). Puede ser la del proyecto viejo.
2. **El examen 1 cargado de nuevo con sus hojas etiquetadas.** A 15 sept la base de
   producción tiene 15 exámenes de prueba sin ninguna hoja: la carga del 13 sept se
   quedó a medias por el fallo del almacén (arreglado en `2be23d5`).
3. Aparte, y sin bloquear: por qué hay **13 exámenes «Test»** idénticos en producción
   (sospecha: el botón de crear no se apaga al enviar). Se mira y se limpian los de
   prueba con el sí del profesor.
