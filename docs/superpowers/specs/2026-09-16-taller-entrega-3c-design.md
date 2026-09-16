# El taller del examen · Entrega 3c: el estudiante hace la lectura y la auditiva

*16 sept 2026. Diseño aprobado por el profesor en dos partes. Continúa
`2026-09-16-taller-entrega-3b-design.md`. Es la tercera de las cinco piezas en que se
partió la Entrega 3.*

## 1. Qué es

Con la 3a un examen queda cargado y publicado; con la 3b llega a una persona y aparece en
su Inicio. Con esta entrega **el estudiante lo hace**: las dos pruebas que se corrigen
solas —comprensión de lectura y comprensión auditiva, 25 preguntas cada una— con su
reloj, su reproductor racionado y su nota calculada en el servidor.

**Decisiones del profesor, tomadas el 16 sept (no se reabren sin información nueva):**

- **El modo libre es el mismo examen sin reloj y repitiendo.** Misma pantalla, con el
  cronómetro apagado, los audios repetibles y un botón «Corregir» por tarea. Descartados
  «solo completo por ahora» y la bolsa de tareas de todos los exámenes, que es la pantalla
  «Practicar» del diseño grande y no entra aquí.
- **Reloj solo en la lectura: 50 minutos.** La auditiva no lleva cronómetro, la marca el
  audio. Descartado el reloj de 30 minutos del papel oficial, porque las cuatro pistas del
  libro traen dentro las dos audiciones y juntas pasan de 30 minutos: el estudiante se
  quedaría cortado sin culpa suya.
- **Cada trozo suena una vez, y la pista va sola.** Un trozo son las dos audiciones del
  examen real, ya grabadas seguidas en la pista. Entre trozo y trozo, una pausa corta con
  cuenta atrás y un botón para adelantarla. Descartado dejar que pulse él cada trozo, y
  descartado darle dos escuchas (sonaría cuatro veces: era el fallo del sitio viejo).
- **Al terminar ve su nota y sus fallos, no las respuestas correctas.** «Lectura 19 de
  25», y marcadas las preguntas falladas con lo que él marcó. Descartado enseñarle la
  letra buena, que quema el examen, y descartado no enseñarle nada.
- **Prueba a prueba, cada una de una sentada.** Dos botones en su Inicio. Una prueba
  entregada no se reabre; la otra puede hacerla otro día, antes de la fecha tope. No se
  impone el orden: puede empezar por la que quiera. Descartadas las dos seguidas (noventa
  minutos clavados) y el examen abierto hasta la fecha tope.
- **Si se corta, vuelve y sigue, y el reloj no para.** Cada respuesta se guarda en el
  servidor en cuanto se marca. El reloj cuenta desde que arrancó la prueba: media hora
  fuera son treinta minutos perdidos, como en el examen de verdad. Descartado congelar el
  cronómetro, que es la puerta a pararlo para pensar.
- **El profesor ve el estado y la nota en la lista de asignados** que ya existe. La ficha
  pregunta a pregunta se deja para junto a la cola de corrección de la escrita (3d).

**Fuera de esta entrega:** la expresión escrita y la oral (3d y 3e), «Practicar», la ficha
del profesor pregunta a pregunta, repetir una prueba ya entregada en modo completo, los
recordatorios antes de la fecha y cualquier cosa que el profesor quiera ver en directo
mientras el estudiante contesta.

## 2. Lo que se guarda

Tres tablas nuevas. Nada de esto vive en el navegador: por eso aguanta que el estudiante
cambie de aparato a media prueba.

```prisma
/// Una prueba de un examen asignado, hecha por una persona. Una sola por pareja:
/// una prueba entregada no se reabre y no se repite.
model Intento {
  id           String     @id @default(cuid())
  asignacion   Asignacion @relation(fields: [asignacionId], references: [id], onDelete: Cascade)
  asignacionId String
  prueba       Prueba
  empezadaEn   DateTime   @default(now())
  entregadaEn  DateTime?
  /// true si la entregó el reloj, no el estudiante.
  porTiempo    Boolean    @default(false)
  /// La nota, congelada al entregar. null mientras se hace.
  aciertos     Int?
  total        Int?

  respuestas  RespuestaDeIntento[]
  trozosOidos TrozoOido[]

  @@unique([asignacionId, prueba])
  @@index([asignacionId])
}

/// Una letra marcada. El número es el del libro: en la lectura 1-25 y en la
/// auditiva TAMBIÉN 1-25, y no chocan porque cada intento es de una prueba.
model RespuestaDeIntento {
  id        String   @id @default(cuid())
  intento   Intento  @relation(fields: [intentoId], references: [id], onDelete: Cascade)
  intentoId String
  numero    Int
  letra     String
  marcadaEn DateTime @updatedAt

  @@unique([intentoId, numero])
}

/// Un trozo de pista que ya ha sonado. Su existencia es lo que impide repetirlo.
model TrozoOido {
  id        String   @id @default(cuid())
  intento   Intento  @relation(fields: [intentoId], references: [id], onDelete: Cascade)
  intentoId String
  tarea     Int
  trozo     Int
  oidoEn    DateTime @default(now())

  @@unique([intentoId, tarea, trozo])
}
```

**La nota se congela.** `aciertos` y `total` se calculan al entregar y se guardan. Si
mañana el profesor recupera el examen y corrige una tarea, el 19 de 25 de esa chica sigue
siendo 19 de 25: la nota es de lo que hizo, no de lo que el examen diga hoy.

**En modo libre no se guarda nada.** Ni intento, ni respuestas, ni trozos: el estudiante
practica, pulsa «Corregir» y el servidor le contesta. Es coherente con lo decidido
(repetir cuanto quiera) y evita la pregunta de cuál de las tres pasadas es la buena. El
precio, escrito aquí para que no sorprenda: de una asignación en libre no queda registro
ninguno, y si cierra la pestaña pierde lo marcado.

**Quitar una asignación con un intento empezado NO deja**, y dice por qué. Es la misma
regla que «retirar no deja si alguien lo tiene asignado» de la 3b: sin ella, quitar a una
persona de la lista le borraría una nota ya puesta, en cascada y sin aviso.

## 3. Los minutos, y de quién es el reloj

En `lib/dele/estructura.ts`, junto a los demás números del DELE:

```ts
/** Minutos de cada prueba. null = no lleva reloj (la auditiva la marca el audio). */
export const MINUTOS_DE_PRUEBA: Record<Nivel, Readonly<Record<Prueba, number | null>>>
// A2_B1_ESCOLAR: { CE: 50, CO: null, EE: null, EO: null }   (EE llega con la 3d)
```

**El reloj es del servidor.** Lo único que se guarda es `empezadaEn`; el navegador recibe
cuántos segundos quedan y pinta la cuenta atrás. Cambiarle la hora al móvil no regala ni
un minuto. Cada acción que escribe (guardar una respuesta, entregar) vuelve a comprobar el
tiempo contra la hora del servidor.

**Diez segundos de gracia** (`SEGUNDOS_DE_GRACIA`) para que la última respuesta marcada
justo en el minuto 50 no se pierda por el viaje de red. Pasados esos diez segundos, guardar
rebota y la prueba se da por entregada.

**La entrega automática se resuelve al mirar.** No hay ningún proceso que corra solo en
este sitio, y no se va a montar para esto. Cuando el reloj del navegador llega a cero, el
navegador entrega. Si para entonces no hay navegador —se fue la luz, cerró el portátil—,
la prueba queda entregada, con `porTiempo = true`, la primera vez que alguien la mira: el
estudiante al volver a su Inicio, o el profesor al abrir su lista de asignados.

Eso significa que dos pantallas de lectura escriben en la base, y conviene que esté dicho en
voz alta: **`cerrarLasQueSePasaron(ahora)` se llama al pintar el Inicio del estudiante y la
lista del profesor**, antes de leer los estados. Es una escritura idempotente —solo toca
intentos sin entregar cuyo tiempo ya pasó— y deja el motor limpio: `estadoParaElProfesor` es
una función pura sobre filas ya cerradas, no tiene que adivinar nada.

## 4. El motor, en piezas puras

`lib/examen/motor.ts`, sin base de datos y sin `new Date()` dentro: todas las funciones
reciben el «ahora». Es lo que hace que esto se pueda probar de verdad.

```ts
notaDePrueba(clave, respuestas) -> { aciertos, total, fallos: { numero, marcada }[] }
segundosQueQuedan(empezadaEn, minutos, ahora) -> number | null   // null = sin reloj
seAcaboElTiempo(empezadaEn, minutos, ahora) -> boolean           // con la gracia dentro
siguienteTrozo(oidos, trozos) -> number | null                   // el menor sin oír
estadoParaElProfesor(intento, ahora) -> "Sin empezar" | "A medias" | "Entregada, 19/25"
```

`clave` es la unión de las claves de las cuatro tareas de esa prueba, y `total` es cuántas
respuestas tiene esa clave. Un examen publicado tiene sus 14 tareas completas y su clave
cuadrada contra el cuadernillo (3a), así que `total` valdrá 25; si algún día valiera otra
cosa, la nota lo dirá en vez de mentir con un 25 fijo.

`lib/examen/hacer.ts` es la parte que toca la base: `empezarPrueba`, `guardarRespuesta`,
`marcarTrozo`, `entregarPrueba`, `resultadoDePrueba`, `corregirEnLibre`. Cada una
comprueba, en este orden: hay sesión; la asignación es de esta persona; el examen sigue
PUBLICADO; la prueba no está entregada; no se acabó el tiempo.

**Lo que viaja al navegador** sale por una sola función, `pruebaParaHacer`, escrita como
`actividadParaElEstudiante` de la 3b: construye el objeto campo a campo en vez de borrarle
la clave a uno leído de la base. La `Clave` no se selecciona siquiera en la consulta.

## 5. La pantalla de la lectura

Ruta `/examen/[id]/CE` (en singular, para no confundirla nunca con `/examenes`, que es del
profesor). La misma ruta sirve tres estados: el aviso de antes de empezar, la prueba, y el
resultado.

**Solo valen CE y CO.** `/examen/[id]/EE` y `/examen/[id]/EO` contestan 404 hasta que las
escriban la 3d y la 3e: una pantalla a medias sería peor que no tenerla.

**El aviso** dice lo que va a pasar antes de que pase: cincuenta minutos, se entrega sola
al acabarse, no se puede repetir. El botón «Empezar» es lo que fija `empezadaEn`.

**La prueba**: pestañas «Tarea 1 · 2 · 3 · 4», el reloj siempre visible arriba, y libertad
para ir y volver entre las cuatro y cambiar lo marcado hasta entregar. Las cuatro tareas
se cargan de una vez —son 25 preguntas, no hay nada que aligerar— y cambiar de pestaña no
va al servidor. Cada letra marcada sí: se guarda en ese momento.

Las cuatro formas cerradas, tal como las ve el estudiante:

- **RELACIONAR** (lectura 1, auditiva 2): los seis elementos, y para cada uno un desplegable
  con los destinos A-J menos la letra que ya gasta el ejemplo. No se impide repetir letra:
  el examen real tampoco lo impide, y avisar sería darle información que no tiene.
- **LISTA_COMUN** (lectura 2, auditiva 3): las tres personas o las tres opciones comunes
  arriba, y cada pregunta con sus tres botones A/B/C.
- **OPCIONES** (lectura 3, auditiva 1 y 4): enunciado y tres opciones, en texto o en foto.
  Las fotos son las que el profesor subió en la 3a.
- **HUECOS** (lectura 4): el texto con el número del hueco bien visible, y debajo la lista
  de los siete huecos con sus tres opciones. Descartado meter el desplegable dentro del
  párrafo: en un móvil de 400 px parte el texto y se lee fatal.

**Leer sin perderse**, que es donde se gana el sitio: en la lectura 3 (el texto largo) y en
la 4, el texto va en su columna con su propio desplazamiento y las preguntas al lado. En
pantalla estrecha, el texto arriba y las preguntas debajo.

**Entregar** pide confirmación una vez, dice cuántas quedan sin marcar, y no se puede
deshacer.

## 6. La pantalla de la auditiva y la cinta

Ruta `/examen/[id]/CO`, misma forma. El aviso dice lo que de verdad importa: **cada audio
suena una sola vez**.

La cinta (`components/examen/cinta.tsx`) es un componente de cliente con un `<audio>` sin
controles —nada de barra de arrastre— y estas reglas:

1. El trozo *i* va de `cortes[i-1]` (o 0) a `cortes[i]` (o el final de la pista). El último
   trozo suena hasta el final del fichero, así que la rareza de duración de los MP3 del
   libro (el `<audio>` declara unos segundos de más) no corta nada.
2. **Antes de que suene, el trozo se marca como oído en el servidor.** Así, recargar a
   mitad no lo devuelve. El precio es que un corte de red justo ahí le cuesta ese trozo; es
   el lado seguro del error, y la pantalla lo dice antes de empezar.
3. Al llegar al corte, la pista se para y empieza una **pausa de diez segundos** con cuenta
   atrás visible y un botón «Sigue» para adelantarla. Luego arranca el siguiente trozo.
4. Cuando se acaban los trozos de la tarea, la tarea dice «Este audio ya ha sonado» y el
   estudiante pulsa él para pasar a la siguiente. Puede volver a una tarea anterior a
   cambiar una respuesta; lo que no puede es volver a oírla.
5. La auditiva 3 no se corta: suena la pista entera, una vez.

**El navegador no deja sonar audio sin que alguien haya tocado la pantalla.** Por eso el
botón «Empezar» del aviso es también lo que desbloquea el `<audio>`: a partir de ese gesto,
los trozos encadenados pueden arrancar solos.

**El enlace del audio tiene que durar más de cinco minutos.** Hoy `enlaceDeLectura` firma
cinco, y una pista de once minutos que el navegador vuelva a pedir a mitad se encontraría
con un enlace muerto. Se añade un segundo plazo, **una hora, solo para las piezas de
audio**; las fotos y las páginas siguen con cinco minutos. El enlace sigue siendo personal,
sin caché y solo alcanzable por quien pasó el candado. Es una hora de exposición a cambio de
que la cinta no se muera a mitad, y ya está aceptado desde la 3a que el estudiante recibe la
pista entera.

**El límite honesto, escrito para que no se descubra tarde:** el racionamiento impide el
accidente y la trampa fácil —recargar la página para repetir—, no al que se empeñe en
sacar el fichero del sitio. Con la pista entera en el navegador no hay forma de impedirlo,
y se aceptó al decidir que el audio no se corta en trozos sueltos.

## 7. El candado de ficheros gana su tercera rama

La 3b dejó `puedeVerFichero` como lista blanca: profesor todo, estudiante solo lo que
subió él. Ahora se le añade lo que faltaba:

> Un estudiante puede ver un fichero **si cuelga de una pieza de una tarea de un examen que
> tiene asignado**, y o bien esa asignación es **en modo libre**, o bien **ya ha empezado esa
> prueba**.

Cuatro cosas de esa frase, las cuatro a propósito:

- **De una pieza, nunca de una página.** Las hojas escaneadas del examen (`PaginaDeExamen`)
  no entran en la lista blanca de ningún estudiante, ni antes ni después: eso es regalarle
  el examen en PDF.
- **De la prueba que ha empezado.** Antes de pulsar «Empezar» no puede sacar la pista de la
  auditiva ni las fotos, aunque tenga el identificador. Después de entregar sí, porque la
  pantalla de resultados le enseña sus fallos con sus fotos.
- **En modo libre no hay prueba que empezar**, porque no se guarda intento: ahí manda la
  asignación sola. Sin esta rama, un estudiante en libre no vería ni una foto ni la pista, y
  la pantalla estaría muda sin que nada diera error.
- **La función sigue siendo pura.** La ruta carga el fichero con las tareas de sus piezas y
  los intentos empezados de esa persona, y se los pasa; decidir sigue siendo una función
  sin base de datos que se puede probar sola. Lo que no cambia nada: la respuesta al «no»
  sigue siendo **404 con el cuerpo idéntico** al de un fichero inexistente.

## 8. Inicio del estudiante y la lista del profesor

**Inicio.** La tarjeta del examen pierde la línea «Todavía no puedes empezarlo» y gana una
fila por prueba, con su estado y su botón:

```
Libro, examen 1 · A2/B1 escolar · Para el 30 de septiembre
  Lectura    25 preguntas · 50 minutos    Entregada: 19 de 25      [ Ver resultado ]
  Auditiva   25 preguntas · 4 audios      A medias                 [ Seguir ]
```

En modo libre, las mismas dos filas sin estado y con el botón «Practicar».

**La caja «Quién lo hace»** del profesor, que ya existe, gana dos columnas: el estado de
cada prueba y la nota. Quien entregó fuera de plazo lo lleva escrito al lado («2 días
tarde»), que es para lo que sirve un tope blando.

## 9. Errores

Todos con el mismo criterio de la casa: mensaje corto, en castellano, que dice qué hacer.

- **«Esta prueba ya está entregada.»** Al intentar reabrirla o guardar en ella.
- **«Se acabó el tiempo.»** Guardar pasados los 50 minutos y la gracia; la pantalla salta
  al resultado.
- **«Este examen ya no está disponible.»** El examen dejó de estar publicado.
- **«Este examen no es tuyo.»** Sin asignación. No dice si existe.
- **«No se pudo preparar el audio. Vuelve a entrar.»** Si el trozo no se pudo marcar: la
  cinta **no suena** si el servidor no ha podido apuntarlo.
- **«Tiene un examen empezado: no se puede quitar de la lista.»** Al quitar una asignación
  con intento.

## 10. Cómo se prueba

La regla de siempre: hay que poder **borrar el candado y ver algo rojo**. Cada prueba lleva
escrita al lado la mutación que tiene que matar. Y la de siempre con el tiempo: el «ahora»
se pasa a mano, nunca `new Date()` dentro de una prueba.

1. **La nota** (`tests/examen-motor.test.ts`): 25 respuestas contra la clave del examen 1 de
   verdad, con tres falladas y dos sin marcar; `aciertos`, `total` y la lista de fallos con
   lo que marcó. Mutación: contar las no marcadas como acierto, o devolver `total` fijo a 25.
2. **El reloj** (mismo fichero): a los 49 minutos quedan 60 segundos; a los 50 y 5 segundos
   todavía se puede guardar (gracia); a los 50 y 11, no. Con `minutos = null` no se acaba
   nunca. Mutación: quitar la gracia o comparar con `>` en vez de `>=`.
3. **Qué trozo toca** (mismo fichero): con los trozos 1 y 2 oídos de ocho, toca el 3; con
   los ocho, ninguno; con un hueco raro (oídos el 1 y el 3), toca el 2. Mutación: devolver
   `oidos.length + 1`, que es lo que parece pero falla con huecos.
4. **Una prueba no se empieza dos veces** (`tests/base/intentos.test.ts`, contra Postgres de
   verdad): dos `empezarPrueba` seguidas dejan **una** fila y la misma `empezadaEn`.
   Mutación: quitar el `@@unique` o cambiar el `upsert` por un `create`.
5. **Un trozo oído no vuelve** (misma prueba de base): marcar, volver a pedir, y el estado
   leído **otra vez de la base** dice que toca el siguiente. Mutación: dejar que `marcarTrozo`
   borre y reescriba.
6. **La nota se congela** (misma prueba de base): se entrega, se cambia la clave de una
   tarea, y la nota guardada sigue igual. Mutación: calcular la nota al leer el resultado en
   vez de al entregar.
7. **Guardar tarde rebota** (misma prueba de base, con el «ahora» pasado a mano): una
   respuesta a los 51 minutos no se guarda y la prueba queda entregada con `porTiempo`.
   Mutación: comprobar el tiempo solo en el navegador.
8. **Quitar una asignación con intento no deja** (misma prueba de base): da error y la fila
   sigue ahí. Mutación: quitar la comprobación — y entonces la cascada se lleva la nota.
9. **El candado, por la ruta** (`tests/ficheros-rutas.test.ts`, ampliando): con un examen
   asignado y la auditiva **sin empezar**, el estudiante pide la pista → 404 y
   `enlaceDeLectura` no llega a llamarse; después de empezar → 307; una **página escaneada**
   de ese mismo examen → 404 siempre; y el profesor, 307 en los tres casos. Mutación: dar
   por buena cualquier pieza sin mirar si la prueba empezó, o meter las páginas en la lista.
10. **La clave no viaja** (`tests/examen-para-hacer.test.ts`): se recorre entero el objeto
    que `pruebaParaHacer` devuelve buscando cualquier campo llamado `clave` o `respuestas`,
    y no puede haber ninguno. Mutación: devolver la tarea leída de la base tal cual.
11. **Las pantallas** (`tests/examen-pantallas.test.ts`), pintadas con
    `renderToStaticMarkup` y sin jsdom: el aviso previo dice los 50 minutos; la pantalla de
    resultado enseña «19 de 25» y marca las falladas **sin** enseñar la letra buena; y en
    libre no sale el reloj. Antes de dar por buena una ausencia, la prueba comprueba que lo
    pintado no está vacío: una pantalla que reviente pasaría todos los `not.toContain` del
    mundo.
12. **Las acciones exigen ser el dueño** (`tests/examen-acciones.test.ts`): otro estudiante,
    y un estudiante sin asignación, rebotan en las seis. Mutación: borrar la comprobación de
    la asignación en cualquiera.

**Lo que ninguna prueba puede ver, y por eso hay paseo:** el encadenado de la cinta, la
pausa con cuenta atrás, el reloj descontando en pantalla y el guardado al marcar.

## 11. Aceptación, en producción

Con el examen 1 («Libro, examen 1») y la cuenta de estudiante de prueba. **El paso 1 se
hace antes que nada**, porque afecta a lo que se oye:

1. **Arreglar la marca mal puesta de la auditiva 4** desde el taller: hoy hay una marca en
   4:35, que cae entre las dos audiciones de la noticia 2. Las fronteras buenas son 3:08 y
   5:54 (medidas con ffmpeg el 16 sept).
2. Asignar el examen 1 a la cuenta de prueba, en modo completo.
3. **Lectura**: empezar, ver el reloj, contestar las 25. A mitad, **recargar la página**:
   las respuestas siguen marcadas y el reloj ha seguido corriendo. Entregar y comparar la
   nota con la clave oficial del libro.
4. **Auditiva**: empezar, oír el trozo 1 entero y comprobar que trae las **dos audiciones**
   dentro; recargar y comprobar que no vuelve a sonar; pasar por las cuatro tareas; oír el
   **trozo 2 de la auditiva 4** y comprobar que ahora empieza donde debe.
5. **El enlace largo del audio**: llegar al último trozo de una pista con más de doce
   minutos de la página abierta, y que suene. Es lo que prueba que la hora de vida hacía
   falta y funciona.
6. Entregar la auditiva y ver la nota.
7. Desde la cuenta de prueba, pedir a mano **una página escaneada** del examen: 404.
8. En la lista «Quién lo hace», ver los dos estados y las dos notas.
9. Asignar el mismo examen en **modo libre** a otro estudiante de prueba: sin reloj, audio
   repetible, «Corregir» contesta sin enseñar la letra buena.
10. Mirarlo todo a **400 px de ancho**.

## 12. Lo que sigue abierto

- **La escrita (3d) y la oral (3e).** Hasta que estén, un estudiante no hace el examen
  entero, aunque estas dos pruebas ya den nota.
- **El profesor no puede verse la pantalla del estudiante** si no se asigna el examen a una
  cuenta de estudiante. Con la cuenta de prueba que ya existe basta; una vista previa de
  verdad, si hace falta, es otra entrega.
- **Sin registro de la práctica en modo libre.** Decidido, y apuntado aquí por si algún día
  molesta.
- **Los ficheros huérfanos** de subidas que no se guardaron, que vienen abiertos de la 3a.
