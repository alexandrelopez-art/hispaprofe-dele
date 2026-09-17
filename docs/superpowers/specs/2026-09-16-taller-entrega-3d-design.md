# El taller del examen · Entrega 3d: la escrita y la cola de corrección

*16 sept 2026. Diseño aprobado por el profesor en dos partes. Continúa
`2026-09-16-taller-entrega-3c-design.md`. Es la cuarta de las cinco piezas en que se
partió la Entrega 3.*

## 1. Qué es

Con la 3c el estudiante hace las dos pruebas que se corrigen solas. Con esta entrega hace
**la expresión escrita**, que no se corrige sola: la escribe con su reloj, la manda, y
entra en **una cola de corrección** donde el profesor le pone las bandas del DELE y un
comentario. Y, de paso, se cierra el cabo que la 3c dejó apuntado: **la ficha pregunta a
pregunta** de la lectura y la auditiva.

**Decisiones del profesor, tomadas el 16 sept (no se reabren sin información nueva):**

- **Se corrige con las cuatro bandas oficiales del DELE**, de 0 a 3, por cada una de las
  dos tareas: adecuación al género discursivo, coherencia textual, corrección y alcance.
  Más un comentario por tarea. Descartados «una nota de 0 a 10 y un comentario» (no le
  dice al chico en qué falla) y «apto / no apto con un comentario» (se corrige en un
  minuto, pero no sirve para ver si mejora).
- **La escrita lleva reloj: 50 minutos**, los del examen oficial, con las mismas reglas
  que la lectura — se entrega sola al acabarse y el reloj no para si se corta. Descartados
  no ponerle reloj y ponerle uno que avise sin entregar.
- **La cola vive en una pantalla propia, «Por corregir»**, en la cabecera, con todo lo que
  espera de todos los exámenes y todos los chicos. Descartado meterla dentro de cada
  examen: obligaría a acordarse de entrar examen por examen.
- **La ficha pregunta a pregunta entra en esta entrega.**
- **Ya corregida, el estudiante lo ve todo**: su texto, las ocho bandas con lo que
  significan, los dos comentarios y la suma. Descartado enseñarle solo el comentario.
- **En modo libre la escrita sí se guarda y sí se manda a corregir.** Es la única
  excepción a «en libre no se guarda nada» de la 3c, y está razonada en la sección 9:
  practicar a escribir sin que nadie lo lea no sirve de nada.
- **La suma no dice «apto».** El sitio dice «18 de 24» y nada más. El examen oficial no
  publica cómo se convierte la suma de bandas en el apto, y no se inventa aquí un listón
  que luego parezca oficial. Descartado el 60% y descartada una casilla de apto a mano.
- **La IA no propone la corrección.** Las bandas y los comentarios los pone el profesor.
  Se puede añadir después sin tocar nada de lo de aquí. (Además, `ANTHROPIC_API_KEY`
  sigue sin estar puesta en el proyecto de Vercel.)

**Fuera de esta entrega:** la oral (3e), «Practicar», que la IA proponga la corrección,
poder subrayar y anotar sobre el texto del estudiante, reescribir una escrita ya mandada,
y cualquier aviso automático de que hay cosas esperando en la cola.

## 2. Lo que se guarda

Una tabla nueva y dos columnas en una que ya existe.

```prisma
/// Lo que el estudiante escribió en una tarea de la escrita, y su corrección.
/// Una fila por tarea: la 1 y la 2. Nace en cuanto guarda el primer borrador.
model EscritoDeIntento {
  id        String  @id @default(cuid())
  intento   Intento @relation(fields: [intentoId], references: [id], onDelete: Cascade)
  intentoId String
  tarea     Int
  /// Solo la tarea 2: cuál de las opciones eligió (1..n). null mientras no elige.
  opcion    Int?
  texto     String
  /// Las cuenta el SERVIDOR sobre el texto que llegó, no el navegador.
  palabras  Int      @default(0)
  guardadoEn DateTime @updatedAt

  /// La corrección. Cuatro valores 0-3, en el orden de CRITERIOS_EE.
  /// Vacío = sin corregir; quien manda de verdad es Intento.corregidaEn.
  bandas     Int[]  @default([])
  comentario String @default("")

  @@unique([intentoId, tarea])
}

model Intento {
  // ...lo de la 3c...
  corregidaEn    DateTime?
  corregidaPor   Persona?  @relation("correcciones", fields: [corregidaPorId], references: [id], onDelete: SetNull)
  corregidaPorId String?
  escritos       EscritoDeIntento[]
}
```

**La nota se congela igual que en la lectura, y sin columnas nuevas.** Al firmar la
corrección, `aciertos` = la suma de las ocho bandas y `total` = 24. Así «Quién lo hace»
dice «Corregida, 18 de 24» con el mismo código que dice «Entregada, 19 de 25», y si mañana
el profesor cambia su criterio, lo ya firmado sigue diciendo lo que dijo.

**El estado «esperando corrección» sale solo, sin preguntar de qué prueba se trata.** Una
lectura o una auditiva entregadas SIEMPRE tienen nota; una escrita entregada y sin
corregir NO la tiene. O sea: `entregadaEn != null && aciertos == null` *es* «esperando
corrección». `estadoDePrueba` sigue siendo una función pura sobre una fila.

**Los criterios viven en `lib/dele/estructura.ts`**, junto a los demás números del DELE,
porque son del examen y no de la pantalla:

```ts
export const CRITERIOS_EE = [
  { clave: "adecuacion", nombre: "Adecuación al género discursivo", ayuda: "..." },
  { clave: "coherencia", nombre: "Coherencia textual", ayuda: "..." },
  { clave: "correccion", nombre: "Corrección", ayuda: "..." },
  { clave: "alcance",    nombre: "Alcance", ayuda: "..." },
] as const;
export const BANDA_MAXIMA = 3;
```

**El `ayuda` de cada criterio es una línea**, la que el profesor quiere ver al lado de la
casilla para no dudar entre un 2 y un 3. No se copia de ningún sitio ni se inventa: la
dicta él al empezar la construcción, y hasta entonces queda como lo único sin escribir de
esta spec.

y el 24 **no se escribe a mano**: es `CRITERIOS_EE.length * BANDA_MAXIMA * (tareas de EE
de ese nivel)`. Un nivel con tres tareas de escrita daría 36 sin tocar nada.

## 3. El reloj

```ts
A2_B1_ESCOLAR: { CE: 50, CO: null, EE: 50, EO: null }
```

Mismo reloj de servidor de la 3c, mismos diez segundos de gracia, misma entrega automática
«al mirar». Lo único que cambia: **al cerrar una escrita por tiempo no hay nota que
congelar**, así que `congelarNota` se parte en dos caminos —las pruebas con clave calculan
y guardan la nota; la escrita solo pone `entregadaEn` y `porTiempo`— y `cerrarLasQueSePasaron`
llama al mismo sitio sin enterarse. Una escrita cerrada por el reloj **entra en la cola
igual**, con lo que hubiera escrito hasta ese momento y marcada «entregada por tiempo».

## 4. El motor, en piezas puras

A `lib/examen/motor.ts`, sin base de datos y sin `new Date()` dentro:

```ts
palabras(texto) -> number                     // separa por espacios, saltos y tabuladores
sumaDeBandas(escritos) -> number              // las ocho, o las que haya
estadoDePrueba(...)                           // gana "ESPERANDO" (entregada y sin nota)
textoDelEstado(...)                           // "Entregada, esperando corrección" / "Corregida, 18 de 24"
```

`palabras` es la que más trampa tiene para lo pequeña que es: dobles espacios, saltos de
línea, un texto vacío, una palabra con guion (cuenta una), los signos sueltos. Se prueba
entera.

## 5. La pantalla de la escrita

Ruta `/examen/[id]/EE`. `PRUEBAS_QUE_SE_HACEN` pasa a `["CE", "CO", "EE"]`; `/examen/[id]/EO`
sigue contestando 404 hasta la 3e.

**El aviso**, antes de empezar: cincuenta minutos, se entrega sola, no se puede repetir.
«Empezar» fija `empezadaEn`.

**La prueba**: dos pestañas, «Tarea 1» y «Tarea 2», el reloj arriba y «← Volver a Inicio»,
como quedó en las cuatro caras tras la aceptación de la 3c.

- **Tarea 1**: a un lado la situación, el texto recibido y las pautas; al otro el folio.
  En el móvil, uno debajo del otro con el enunciado plegable — el mismo reparto que se hizo
  en la lectura 1 y 2, que es el que le gusta al profesor.
- **Tarea 2**: primero las opciones enteras, con su contexto y sus pautas, para elegir una.
  Al elegir se abre el folio. **Cambiar de opción no borra lo escrito**: puede haber
  empezado y arrepentirse, y borrarle el texto sería imperdonable. El texto es de la
  TAREA; la opción es solo una marca al lado.

**El contador de palabras, en vivo y debajo del folio**: «118 palabras (te piden entre 80 y
100)», en rojo si se pasa o se queda corto, **y le deja entregar igual**. Pasarse de
palabras es un fallo del examen, no algo que la máquina deba impedir.

**El borrador se guarda solo**: a los dos segundos de dejar de teclear, al cambiar de
pestaña y al pulsar «Entregar». La pantalla dice «Guardando…» / «Guardado» para que no se
quede con la duda. Si se va la luz, vuelve y sigue — con el reloj corriendo.

**«Entregar» entrega las dos tareas juntas.** Si una está vacía o la 2 no tiene opción
elegida, avisa antes con lo que le falta y pregunta si entrega igual.

**Después**: «Entregada. Esperando corrección», con su texto tal como lo mandó y la fecha.
Cuando esté corregida, esa misma pantalla enseña las ocho bandas con su nombre y su ayuda,
los dos comentarios y «18 de 24».

## 6. La cola y la pantalla de corregir

**`/corregir`**, en la cabecera del profesor con el número de lo que espera. Lista: quién,
qué examen, cuándo entregó, **cuántos días lleva esperando** (días de calendario de Madrid,
con el mismo cuidado que `diasDeRetraso`, que ya se arregló una vez por contar
milisegundos), y si la entregó el reloj. Lo más viejo arriba.

**`/corregir/[intentoId]`**: las dos tareas una debajo de otra. Por cada una, el enunciado
(y en la 2, cuál eligió), el texto del estudiante, las cuatro bandas de 0 a 3 con su
nombre y su ayuda escritas al lado —para no tener que recordarlas—, y un comentario. Ocho
casillas y dos comentarios en total.

**«Guardar y seguir» lleva a la siguiente de la cola** sin pasar por la lista. Si no queda
ninguna, lo dice.

**Firmar es un acto con fecha.** Hasta que se guarda, el estudiante no ve nada. Una vez
firmada se puede volver a entrar y cambiarla: se sobrescriben bandas, comentarios y la
suma congelada, y `corregidaEn` pasa a ser la de la última vez.

`lib/examen/corregir.ts`: `escritosPorCorregir()`, `escritoParaCorregir(intentoId)`,
`guardarCorreccion(intentoId, tareas, profesorId, ahora)`. Las tres **exigen papel
PROFESOR**, y `guardarCorreccion` valida que cada banda sea un entero de 0 a 3 y que las
tareas sean las de ese intento: es una dirección pública.

## 7. La ficha pregunta a pregunta

En «Quién lo hace», «Entregada, 19 de 25» pasa a ser un enlace a
`/examenes/[id]/hoja/[personaId]/[prueba]`: las 25 preguntas con **lo que marcó y lo que
era**, los fallos en rojo, y las no contestadas dichas como tales. Vale para la lectura y
para la auditiva.

Es la única pantalla del profesor, fuera del taller, que lee la tabla `Clave`. Exige papel
PROFESOR y se dice aquí en voz alta para que nadie la copie hacia el lado del estudiante.

## 8. El candado de ficheros

**No hay que tocarlo**, y conviene decir por qué, que es el sitio donde se metió el fallo
de la aceptación de la 3c: `ficherosDeLasPruebasAbiertas` abre los ficheros de las tareas
de las pruebas que la persona tiene empezadas, sin lista de pruebas escrita a mano, y las
fotos de la escrita viajan dentro de `datos.imagenes` de la actividad, como las de la
auditiva. En cuanto el estudiante pulsa «Empezar» en la escrita, sus fotos se abren solas.

Lo que sí entra es **una prueba que lo fije**: que un estudiante con la escrita empezada
abre la foto de su tarea 1, y que sin empezarla no la abre. Sin esa prueba, el día que
alguien vuelva a poner una lista de pruebas a mano en esa función, nadie se entera.

## 9. El modo libre, la excepción

En la 3c se decidió que en modo libre no se guarda nada. **En la escrita sí se guarda**:
intento, texto y corrección, sin reloj. La razón es que la escrita no se corrige sola, y
un modo de práctica donde escribes cuatrocientas palabras que nadie lee no es práctica de
nada.

Consecuencias, escritas para que no sorprendan:

- En libre, la escrita se comporta como en completo salvo el reloj: se guarda, se manda y
  entra en la cola.
- **Una escrita mandada no se reescribe, tampoco en libre.** El «repitiendo» del modo libre
  vale para la lectura y la auditiva, que se corrigen solas.
- La lista del profesor no distingue el modo en la cola; sí lo dice la ficha del examen.

## 9 bis. Las salidas de la pantalla se registran

Añadido el 17 de septiembre, **decidido por el profesor y fuera del alcance original**. Y
cambiado por él mismo el mismo día: la primera versión BORRABA la tarea de quien tardaba en
volver. Queda anotado aquí porque el cambio se entiende mejor que la decisión sola.

**Por qué no se borra.** El navegador no sabe distinguir «se fue a buscar la respuesta» de
«le entró una llamada» o «el sistema le bajó a leer una notificación». El precio del borrado
lo acababa pagando un chaval que no hizo nada, mientras que quien quiere copiar de verdad
tiene el móvil de al lado y no sale de la pantalla. Así que **no se borra nada, nunca**.

**Lo que se hace en su lugar: se registra, y el profesor lo ve al corregir.** Disuade igual
—saben que se ve— y cuando se equivoca no le cuesta el trabajo a nadie.

Las decisiones, una a una:

- **Se apunta cada salida**: cuándo se fue, cuánto tardó en volver y de qué tarea estaba.
- **En el SERVIDOR**, no en el navegador: si el rastro viviera ahí, cerrar la pestaña lo
  borraría, y a un chaval de catorce años ese truco le dura media tarde. Cargar la pantalla
  YA cuenta como volver, igual que con `cerrarLasQueSePasaron`: la página llama al registro
  antes de leer nada.
- **Solo en modo COMPLETO.** En práctica libre no se apunta nada: ahí se practica, y un
  registro de la práctica no le dice nada a nadie.
- **Contadores en el intento, sin tabla nueva**: `salidas`, `segundosFuera`,
  `ultimaSalidaEn` y `ultimaSalidaDeTarea`, más la marca viva de la ausencia en curso
  (`salioEn`, `salioDeTarea`). Con eso sale la línea que el profesor quiere leer, y una fila
  por ausencia no le diría nada más.
- **El aviso previo se lo dice al chaval**, antes de «Empezar»: si se sale, queda apuntado y
  su profesor lo ve. Ahí está la disuasión — un registro que nadie sabe que existe no
  disuade, solo delata. Y se dice **sin miedo**: no se borra nada, no se pierde nada. Es una
  regla, no un castigo.
- **Al volver, el estudiante no ve ningún cartel.** No ha perdido nada, no hay nada que
  anunciarle, y enseñarle su propia cuenta lo convertiría en un marcador.
- **El profesor lo ve solo en la pantalla de corregir esa redacción**, en una línea y
  **solo si hubo salidas**: «Salió de la pantalla 3 veces, 4 minutos en total; la última, el
  15 de septiembre de 2026, 10:42, desde la tarea 2». No está en la cola —no es un criterio
  para elegir a quién corregir antes— y si no salió, no se pinta nada. Le explica un folio
  corto o en blanco sin tener que suponer que el chico no sabía.
- **«Volver a Inicio» sigue en la pantalla**, y esa salida también se apunta. Es un `<Link>`,
  o sea una navegación de cliente que desmonta la pantalla sin `visibilitychange` ni
  `pagehide`, así que se marca al desmontar. Un registro que no viera la puerta más cómoda de
  la pantalla no sería un registro honesto.
- **El reloj no se para** mientras está fuera. Eso no cambia.

**La exactitud es la pieza, no un adorno**: el profesor va a hablar con un alumno con esto
delante, así que un registro que inventa minutos es peor que no tenerlo. Dos defensas, en
dos capas distintas, porque hacen falta las dos:

- **En el navegador, el encadenado.** Las dos peticiones —«me voy» y «he vuelto»— salen de
  eventos distintos y, sueltas, se cruzan: «he vuelto» adelanta a «me voy», la marca queda
  puesta con el chaval delante, y la siguiente carga la cierra como una ausencia de veinte
  minutos que nunca ocurrió. Se encadenan sobre una cola, y las dos llevan `.catch` —si la
  cola quedara rechazada, la pantalla dejaría de registrar en toda la prueba—.
- **En el servidor, `volvioEn`.** Una salida con fecha anterior o igual a la última vuelta es
  de una ausencia ya contada: se limpia y no suma. Y los segundos llevan suelo de cero: el
  registro no puede restar tiempo.

Dos detalles más que se decidieron al escribirlo:

- **Salir dos veces sin que llegue la vuelta es UNA ausencia**, contada desde la primera
  (`salioEn: null` en el `where`).
- **Al entregar, la ausencia abierta se cierra sin contarla.** No se sabe cuándo volvió, y
  apuntarle «estuvo fuera hasta que el reloj cerró» sería inventarle al profesor el dato más
  gordo del registro. Dejarla puesta sería peor.

## 10. Errores

Los mismos textos y el mismo orden de comprobaciones que la 3c —hay sesión, la asignación
es de esta persona, el examen sigue PUBLICADO, la prueba no está entregada, no se acabó el
tiempo—, más:

- **Guardar un borrador cuando ya se acabó el tiempo** rebota, y la pantalla pasa sola a
  «Entregada»: no se queda tecleando en el vacío.
- **El texto tiene tope de tamaño** (`LETRAS_TOPE`, 10.000 caracteres, unas 1.500 palabras
  y siete veces lo que se pide). Por encima, rebota. Es para que nadie pegue un libro
  entero en una columna de la base, no para corregir a nadie.
- **Una opción que no existe** en la tarea 2 rebota.
- **Corregir sin ser profesor**, o corregir un intento que no es de la escrita, o que no
  está entregado: rebota.

## 11. Cómo se prueba

Puras (`npm test`), donde está lo barato y lo que más se rompe: `palabras` con sus casos
raros, `sumaDeBandas`, el estado nuevo y su texto, y el 24 salido de la estructura.

Contra Postgres de verdad (`npm run test:base`), y cada una con la mutación que tiene que
matar escrita al lado:

1. Guardar un borrador rebota con el examen retirado, con la prueba entregada y con el
   tiempo agotado. (Mata quitar cualquiera de las cinco comprobaciones.)
2. Entregar una escrita **no se inventa una nota**: `aciertos` y `total` quedan a null.
   (Mata reutilizar `congelarNota` tal cual.)
3. Una escrita a la que se le pasó el tiempo se cierra al mirar, conserva lo escrito y
   aparece en la cola. (Mata cerrarla borrando el borrador.)
4. La cola sale ordenada por antigüedad, solo con escritas entregadas y sin corregir, y se
   vacía al firmar.
5. `guardarCorreccion` exige profesor, valida las bandas y congela la suma en `aciertos`.
6. **La que de verdad importa**: `pruebaParaHacer` NO devuelve bandas ni comentarios
   mientras `corregidaEn` sea null, y sí los devuelve después. (Mata devolver la fila
   entera de `EscritoDeIntento`.)
7. La ficha pregunta a pregunta no sale para un estudiante.
8. El candado: con la escrita empezada, la foto de la tarea 1 se abre; sin empezarla, no.

Nada de esto toca la red. Y el repositorio es **público**: ninguna clave real del libro
entra en una prueba.

## 12. Aceptación, en producción

Con el examen 1, ya publicado, y un estudiante de verdad:

1. El chico entra, ve la escrita encendida en su Inicio y pulsa «Empezar».
2. Escribe media tarea 1, **cierra la pestaña y vuelve**: su texto está y el reloj ha
   seguido corriendo.
3. En la tarea 2 elige una opción, escribe, **cambia de opción**: el texto sigue ahí.
4. El contador de palabras se pone en rojo al pasarse y le deja entregar igual.
5. Entrega con la tarea 2 vacía a propósito: avisa, y él decide.
6. En «Por corregir» aparece, con su nombre y los días que lleva.
7. El profesor pone las ocho bandas y los dos comentarios y firma.
8. El chico ve su texto, las bandas, los comentarios y «18 de 24». Antes de firmar no veía
   nada de eso.
9. En «Quién lo hace» pone «Corregida, 18 de 24», y el «Entregada, 19 de 25» de la lectura
   abre la ficha con las 25 preguntas.
10. En el móvil: el folio se escribe cómodo y el enunciado se pliega.
11. **El registro de salidas (§9 bis), y que NO se borra nada.** Antes de «Empezar», el
    chico lee el aviso. Ya dentro: escribe media tarea 1, **bloquea el móvil y vuelve
    enseguida**; **cambia a otra aplicación medio minuto y vuelve**; **cierra la pestaña
    entera y vuelve a entrar por la dirección**; y por último **pulsa «← Volver a Inicio» y
    vuelve a la escrita**. En las cuatro, su texto sigue entero y no ve ningún cartel. Al
    entregar y abrirla en «Por corregir», el profesor lee una línea con **cuatro salidas** y
    un tiempo que cuadra con lo que tardó — y la tarea desde la que salió la última vez. Con
    un examen de **práctica libre**, lo mismo no apunta nada.

## 13. Lo que sigue abierto

- **La oral (3e)**, y con ella el examen entero.
- **La pregunta sin contestar de la 3c**: en cuanto un estudiante pulsa «Empezar», el
  examen queda congelado —no se puede retirar, ni archivar, ni editar, ni quitar la
  asignación—. Si aparece una errata con los críos dentro, no hay salida por pantalla.
- **La aceptación de la 3c a medias**: faltan los pasos 4 y 5 y los del final.
- **El preview de Vercel no construye**: falta `DIRECT_URL` en el entorno Preview.
- Que la IA proponga la corrección, y anotar sobre el texto del estudiante.
