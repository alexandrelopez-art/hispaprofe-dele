# El taller del examen · Entrega 3a: fotos, audio con marcas, publicar y retirar

*15 sept 2026. Diseño aprobado por el profesor en dos partes. Continúa
`2026-09-15-taller-entrega-2-design.md`. Es la primera de las cinco piezas en que se
partió la Entrega 3 del reparto de `2026-09-13-taller-entrega-1-design.md`.*

## 1. Qué es

Con esta entrega un examen del libro queda **cargado al 100 % y publicado**. Cada opción
«con imagen» recibe su foto. Cada tarea de comprensión auditiva recibe su pista y las
marcas que la parten en trozos. Una foto o un audio que falten dejan la tarea a medias.
Y la página del examen gana **Publicar** y **Retirar**.

**Decisiones del profesor (no se reabren sin información nueva):**

- **La Entrega 3 lleva las tres cosas**: fotos y audio, publicar y asignar, y que el
  estudiante **haga el examen entero, las cuatro pruebas**. Por tamaño se parte en
  cinco piezas, cada una con su diseño, su plan y su construcción, en este orden:
  - **3a** taller completo (esta).
  - **3b** asignar con fecha y modo, candado de ficheros, Inicio del estudiante y
    Archivar.
  - **3c** comprensión de lectura y auditiva hechas por el estudiante: responder,
    reproductor, escuchas, reloj y nota calculada en el servidor. El modo libre se
    decide al llegar aquí.
  - **3d** expresión escrita, con cola de Pendientes.
  - **3e** expresión oral: grabación de las tareas 1 y 3 a Drive, cita en directo de
    las 2 y 4, y la marca «no preparada».
- **El audio se guarda como marcas en segundos sobre la pista entera**, subida tal cual.
  El reproductor salta dentro de la misma pista. Queda descartado el corte físico con
  ffmpeg en trozos sueltos del sitio viejo. El profesor acepta que el navegador del
  estudiante reciba la pista entera.
- **Un examen publicado no se edita.** Primero se retira, y retirar lo devuelve a «en
  construcción».
- **Las marcas se proponen solas por los silencios**, y el profesor las corrige. Queda
  descartado ponerlas siempre a mano.
- **El paseo en navegador es obligatorio antes de dar la 3a por terminada** (sección 9).

**Fuera de esta entrega:** asignar, Archivar, el candado de ficheros y todo lo que ve el
estudiante (van en la 3b y siguientes). También quedan fuera que la IA oiga el audio y
el vídeo.

## 2. Lo comprobado en el material, no supuesto

Se midió con `silencedetect` sobre `claves_dele_escolar_mp3` y se contrastó con
`claves_dele_escolar_sol_trans (2).pdf`.

- **Hay una pista por tarea**, de 4 a 11,5 minutos, en MP3 a 128 kbps constantes y de
  10 MB como mucho. Cabe de sobra en el tope de 50 MB de la subida.
- **La pista ya trae cada trozo dos veces.** En la pista 08 (tarea 4 del examen 1) los
  silencios terminan hacia 42 → 115 → 188 s, 191 → 273 → 354 s y 358 → 426 → 489 s: tres
  noticias, cada una oída dos veces. El sitio viejo suponía dos escuchas por trozo
  además de las que ya trae la pista, así que el estudiante oía cada trozo cuatro
  veces. La 3c tiene que partir de este dato.
- **El ejemplo suena y es un trozo.** Según la transcripción: la tarea 1 son «siete
  conversaciones» más un ejemplo; la tarea 2, «siete mensajes, incluido el ejemplo».

| Tarea de auditiva | Trozos | Marcas | Qué es cada trozo |
|---|---|---|---|
| 1 | 8 | 7 | instrucciones y ejemplo, luego una conversación por pregunta |
| 2 | 7 | 6 | instrucciones y mensaje 0, luego un mensaje por pregunta |
| 3 | 1 | 0 | la conversación entera; no se corta |
| 4 | 3 | 2 | una noticia por cada dos preguntas |

El primer trozo empieza en el segundo 0 y lleva dentro las instrucciones. El último
termina donde acaba la pista.

## 3. Las fotos

**Dónde.** En las opciones marcadas `conImagen`: el ejemplo y las preguntas 1-4 de la
tarea 1 de auditiva, y las opciones de la tarea 1 de oral.

**Qué ve el profesor.** Donde hoy pone «imagen: se sube en la Entrega 3» aparece un
hueco con «Subir foto». Al elegir el fichero:

1. El navegador lo reduce: 1600 px en el lado largo, JPEG al 0,85, con el mismo lienzo
   que `lib/taller/pdf-en-navegador.ts`.
2. Lo sube al almacén privado con `subirAlAlmacen`.
3. Enseña la miniatura, con «Cambiar» y «Quitar».

Si el navegador no puede abrir la imagen (una HEIC en Chrome, por ejemplo), sale «Este
navegador no puede abrir esa foto. Pásala a JPG o PNG.» y no se sube nada.

**Dónde se guarda.** Cada opción con imagen gana un campo
`imagen: string | null`, que es el `id` del `Fichero`. Va dentro de los `datos` de la
actividad, en `lib/taller/formas.ts`. Así el «Guardar» de la Entrega 1, que borra y
rehace todas las piezas (`lib/taller/examenes.ts:198`), la conserva sin cambios. Una
opción sin `conImagen` lleva siempre `imagen: null`; si trae otra cosa, se rechaza la
forma.

**Al guardar**, cada `imagen` no nula tiene que ser un `Fichero` que exista y sea
`image/*`. Si no, no se guarda nada y sale «Una de las fotos ya no existe: vuelve a
subirla.»

**Lo guardado antes de esta entrega.** Una opción sin el campo `imagen` se lee como
`null`: el esquema lo pone por defecto al leer. Al guardar se escribe siempre.

**La IA.** El esquema que se manda a la IA **no lleva** `imagen`. Al volver, `imagen`
se toma **del formulario que está en pantalla**, no del vacío. Hoy
`imponerEstructura(vacio, leido)` saca los campos fijos del vacío, y con eso «Rellenar
con IA» borraría las fotos ya subidas. Tiene que haber una prueba de esto.

## 4. El audio

### 4.1 Qué se guarda

- **`ReglaTarea` gana `trozos?: number`**, solo en las cuatro tareas de auditiva: 8, 7,
  1 y 3 (sección 2). Una tarea sin `trozos` no lleva audio.
- **El formulario gana un campo común**
  `audio: { fichero: string; cortes: number[] } | null`. `cortes` son los segundos de
  cada marca, en orden creciente. `fallosDeForma` rechaza un `audio` no nulo en una
  tarea sin `trozos`, y más de 20 cortes.
- **En la base**, `piezasDelFormulario` escribe una pieza `AUDIO` con su `ficheroId`
  justo antes de la `ACTIVIDAD`. `Pieza` gana la columna `cortes Float[]`, con
  `@default([])` y solo para AUDIO, en su propia migración. `formularioDePiezas` la lee
  de vuelta. El audio viaja con el mismo «Guardar» que todo lo demás.
- **Al guardar**, el `fichero` tiene que existir y ser `audio/*`, con el mismo mensaje
  que las fotos. Los cortes tienen que ir en orden, ser mayores que 0 y quedar al menos
  a 0,3 s entre sí. No se comprueba que queden por debajo de la duración: el servidor
  no la conoce. Eso lo avisa la pantalla.
- **La IA no toca `audio`**: fuera de su esquema y repuesto desde la pantalla, igual
  que `imagen`.

### 4.2 Los cálculos, sin pantalla

Van en un fichero puro, `lib/taller/onda.ts`, probado con números:

- `picos(muestras, cubos)`: el pico absoluto de cada cubo, normalizado de 0 a 1.
- `silencios(muestras, frecuencia)`: ventanas de 100 ms; es silencio la ventana cuyo
  RMS no llega al 2 % de la más fuerte, y cuenta el tramo de al menos 1,5 s. Salen
  del sitio viejo.
- `proponerCortes(silencios, trozos)`: los candidatos son los finales de silencio
  después de los 3 primeros segundos. Se quedan los `trozos − 1` con el silencio
  previo más largo, en orden de tiempo. Si hay menos candidatos, propone los que haya
  y el contador lo pinta en rojo.
- `ajustarMarca(t, cortes, duracion)`: nunca a menos de 0,3 s de otra marca ni de los
  extremos.
- `trozosDe(cortes, duracion)`: pares `[inicio, fin]`, de 0 a la duración.

La propuesta es una ayuda, no la verdad. Entre las dos audiciones de un mismo trozo
también hay silencio, y el criterio del silencio más largo puede fallar con alguna
pista. Si en el paseo de la sección 9 falla con las pistas reales, **se quita la
propuesta** en lugar de afinarla a ciegas: las marcas a mano ya cubren la necesidad.

### 4.3 La pantalla

Un bloque **«Audio»** en la pantalla de la tarea, solo si la regla lleva `trozos`:

1. **Sin pista:** «Subir la pista», que admite `audio/*` y usa `subirAlAlmacen`.
2. **Con pista:**
   - La onda en un lienzo de 120 px de alto, al ancho de la caja.
   - Encima, las marcas, que se arrastran con eventos de puntero (dedo y ratón).
     Pulsar fuera de una marca añade otra.
   - Debajo, la lista de trozos, «Trozo 3 · 1:42–2:55», cada uno con «Oír» (suena
     entero, de su inicio a su fin), «Oír 5 s desde la marca» (los 5 primeros
     segundos, para afinar dónde cae) y «Quitar marca».
   - El contador: «7 marcas → 8 trozos, esta tarea lleva 8», en verde o en rojo.
   - Dos botones: «Proponer marcas por los silencios» y «Cambiar la pista».
   - Nada depende del teclado ni del ratón: todo funciona con el dedo.
   - La propuesta se hace sola solo si la tarea no tiene cortes guardados.
3. **La onda** sale de descodificar la pista con un `OfflineAudioContext` a 8.000
   muestras por segundo. Una pista de 11 minutos ocupa unos 45 MB en memoria, frente a
   los ~250 MB del sitio viejo.
   - Recién subida, se descodifica el `File` local.
   - Al volver a abrir una tarea guardada, se pide a `/api/ficheros/<id>`.
4. **Si no se puede descodificar,** aparece «No se pudo dibujar la onda» y un campo
   para escribir los segundos a mano, separados por comas. Viene del sitio viejo.

**Riesgo que se comprueba lo primero en el plan.** `/api/ficheros/<id>` redirige a un
enlace firmado del almacén de Vercel, que es otro origen. `<audio src>` no necesita
CORS, pero `fetch` para descodificar sí. Si el almacén privado no da cabeceras CORS:

- No se puede hacer pasar la pista por el servidor, porque Vercel corta las respuestas
  a 4,5 MB.
- Queda el campo a mano como plan B, y la onda solo se dibuja justo después de subir.

Se decide con una prueba contra el almacén real **antes** de construir la pantalla.

## 5. Qué bloquea una tarea

Desaparecen `imagenesPendientes` y el aviso «Faltan N imágenes (se suben en la Entrega
3)». `motivosDeTarea` gana tres motivos, y con cualquiera la tarea queda `A_MEDIAS`:

- «Falta la foto de la opción B de la pregunta 3.» (o «del ejemplo», o «de la opción 1»
  en oral)
- «Falta la pista de audio.»
- «La pista tiene 5 trozos y esta tarea lleva 8.»

Los mensajes nombran la opción o el trozo, igual que los motivos que ya existen.

## 6. Publicar y retirar

**En la página del examen**, una caja nueva arriba:

- **En construcción:** botón **«Publicar»**. Se enciende solo si las 14 tareas están
  `COMPLETA` **y** `motivosParaNoPublicar(nivel, tareas)` (`lib/examen/publicar.ts`,
  que ya existe y hasta ahora no usaba nadie) devuelve la lista vacía. Si no se
  enciende, se ve la lista de motivos, empezando por «Faltan por completar: CO1, EO1».
- **Publicado:** «Publicado» y el botón **«Retirar»**, que lo devuelve a
  `EN_CONSTRUCCION`.

**En el servidor**, `publicarExamen` y `retirarExamen` en `lib/taller/examenes.ts`, con
sus acciones solo para el profesor:

- **Publicar** vuelve a calcular todo dentro de una transacción, con la fila del
  `Examen` bloqueada (`FOR UPDATE`, como `guardarTarea`). Si algo cambió entre la
  pantalla y el clic, no publica y devuelve los motivos.
- **Retirar** solo actúa sobre un examen `PUBLICADO`.

**Un examen publicado no se edita.** Rechazan con «El examen está publicado: retíralo
para editarlo.»:

- `guardarTarea` y rellenar con IA.
- Registrar, sustituir, borrar y etiquetar páginas.
- Guardar y elegir el cuadernillo, porque cambiarlo cambia las claves.

La comprobación se hace **dentro** de la misma transacción que escribe. La pantalla
apaga además los botones y enseña el aviso arriba.

## 7. Errores

| Qué pasa | Qué ve el profesor | Qué queda |
|---|---|---|
| Foto que el navegador no abre | «Este navegador no puede abrir esa foto…» | nada subido |
| Falla la subida (red, 50 MB, tipo) | el mensaje de `subirAlAlmacen` | el formulario sin cambios |
| Pista que no se descodifica | «No se pudo dibujar la onda» y el campo a mano | la pista subida y usable |
| Fichero borrado entre subir y guardar | «Una de las fotos ya no existe…» | no se guarda nada |
| Publicar con algo roto | la lista de motivos | sigue en construcción |
| Guardar estando publicado | «El examen está publicado…» | nada escrito |

Una foto o una pista subidas que nunca se guardan dejan un `Fichero` huérfano. Se
acepta: son pocos megas y la limpieza no compensa todavía.

## 8. Cómo se prueba

**Pruebas de lógica** (`npm test`):

- `lib/taller/onda.ts` con señales sintéticas:
  - Una pista falsa de tres trozos, cada uno dos veces con silencios de distinta
    longitud, propone las dos marcas buenas y no las de entre audiciones.
  - Con menos candidatos, propone los que hay.
  - `ajustarMarca` respeta los 0,3 s.
  - `trozosDe` cubre de 0 a la duración sin huecos.
- Formas:
  - `imagen` fuera de `conImagen` y `audio` en una tarea sin `trozos` se rechazan.
  - Lo guardado sin `imagen` se lee como `null`.
- Motivos: los tres nuevos, uno por uno, y que una tarea con todo puesto queda
  `COMPLETA`.
- IA: tras «Rellenar», la foto y la pista que ya estaban siguen ahí. **Mutación:** si
  se toma `imagen` del vacío, la prueba se pone roja.
- Piezas: ida y vuelta formulario → piezas → formulario con audio y cortes.

**Pruebas contra la base** (`npm run test:base`):

- Publicar con una tarea a medias se rechaza. Con las 14 completas publica. Retirar
  vuelve a construcción.
- Con el examen publicado, `guardarTarea`, las páginas y el cuadernillo se rechazan y
  no escriben nada. **Mutación:** quitar la comprobación de `guardarTarea` pone una
  prueba en rojo.
- Guardar con un `Fichero` de foto que no existe, o que es audio, se rechaza.
- La columna `cortes` sobrevive a la ida y vuelta.

**Pruebas de pintado** (`renderToStaticMarkup`, sin navegador simulado): el hueco de la
foto con y sin imagen, el contador en rojo y en verde, «Publicar» apagado con sus
motivos, y el aviso de publicado con los botones apagados.

**Lo que ninguna prueba de estas ve**, y por eso existe la sección 9: la onda, el
arrastre y el sonido.

## 9. Aceptación, en producción y con el examen 1 del libro

Obligatoria antes de dar la 3a por terminada, en el navegador, tras fusionar:

1. Subir las pistas 05, 06, 07 y 08 a las tareas 1 a 4 de auditiva del examen 1.
2. Con la 08, la onda se dibuja y la propuesta cae cerca de los 188-191 s y los
   354-358 s. Tras mover lo que haga falta, «Oír» del trozo 2 empieza justo donde
   arranca la segunda noticia, y el trozo 1 acaba después de su segunda audición.
   Si la propuesta cae mal, se quita (sección 4.2).
3. Cerrar la tarea y volver a abrirla: la onda se dibuja desde el almacén. Esto
   comprueba el CORS de la sección 4.3.
4. Subir las fotos de la tarea 1 de auditiva y de la tarea 1 de oral, desde el
   portátil y desde el móvil.
5. «Rellenar con IA» sobre una tarea con fotos: las fotos siguen.
6. Publicar con una tarea a medias: apagado y con motivos. Completar y publicar.
   Intentar guardar: rechazado. Retirar.
7. Mirar la pantalla a 400 px de ancho.

Todo lo que falle se apunta y se arregla antes de la 3b.

## 10. Lo que sigue abierto

- **El candado de ficheros**: cualquiera con sesión abre cualquier `Fichero` por su
  `id`. Se cierra en la 3b, antes de que entre ningún estudiante.
- **El reproductor del estudiante** (3c) sale de `cortes` y del dato de la sección 2:
  la pista ya trae las dos audiciones.
- **Archivar** y qué pasa al retirar un examen asignado: en la 3b.
- **Los ficheros huérfanos** de subidas que no se guardaron.
