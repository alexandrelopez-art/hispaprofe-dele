# El taller del examen · Entrega 3b: asignar, el candado de ficheros e Inicio del estudiante

*16 sept 2026. Diseño aprobado por el profesor en dos partes. Continúa
`2026-09-15-taller-entrega-3a-design.md`. Es la segunda de las cinco piezas en que se
partió la Entrega 3.*

## 1. Qué es

Con la 3a un examen queda cargado y **publicado**. Con esta entrega ese examen **llega a
una persona**: el profesor elige a quién y para cuándo, al estudiante le avisa un correo,
y al entrar lo ve en su Inicio. De paso se cierra el agujero que la puerta dejó abierto a
propósito: hoy **cualquiera con sesión puede pedir cualquier fichero por su
identificador**, incluidas las páginas y los audios de un examen.

**Decisiones del profesor, tomadas el 16 sept (no se reabren sin información nueva):**

- **La fecha es un tope blando.** Se ve «para el 20 de octubre»; quien entre el 21 lo
  puede hacer igual y queda marcado como fuera de plazo. Descartados el cierre duro a
  medianoche y la ventana con dos fechas.
- **El modo solo se ofrece «completo».** El campo guarda los dos valores desde ya, pero
  la pantalla no deja elegir «libre» hasta que la 3c decida qué significa.
- **El estudiante no puede abrir NADA del examen** mientras no exista la pantalla de
  hacerlo (3c): ni páginas ni audios. Descartado dejarle las hojas escaneadas como
  material de lectura, porque eso es regalarle el examen.
- **Las fechas son de Madrid.** Un día sin hora, interpretado siempre en hora peninsular
  española, estén donde estén los estudiantes.
- **Al asignar sale un correo** al estudiante, con el título, la fecha y un enlace al
  sitio.
- **Se asigna con casillas**, eligiendo estudiantes de una lista, con «marcar todos», y
  se puede quitar.
- **Retirar un examen asignado NO deja**, y dice quién lo tiene. Descartado borrar las
  asignaciones al retirar y descartado dejarlas congeladas.

**Forma elegida para el candado (frente a una tabla de permisos fichero a fichero):** una
sola función que mira de dónde cuelga el fichero y contesta sí o no. La 3c le añade una
rama —«esta pieza es de la tarea que está haciendo ahora»— y no toca nada de lo
anterior. Una tabla de permisos habría que mantenerla al día en cada asignación, y es un
sitio más donde olvidarse.

**Fuera de esta entrega:** empezar o entregar el examen, la nota, el modo libre,
recordatorios automáticos antes de la fecha, avisar por correo cuando se quita una
asignación, y el freno por dirección de red que sigue aparcado desde la puerta.

## 2. La asignación

Una tabla nueva. Nada de estado todavía («empezada», «entregada» y la nota son de la 3c):
hoy una asignación existe o no existe.

```prisma
enum ModoDeExamen {
  COMPLETO
  LIBRE
}

model Asignacion {
  id            String       @id @default(cuid())
  examen        Examen       @relation(fields: [examenId], references: [id], onDelete: Cascade)
  examenId      String
  persona       Persona      @relation("recibidas", fields: [personaId], references: [id], onDelete: Cascade)
  personaId     String
  modo          ModoDeExamen @default(COMPLETO)
  fechaTope     DateTime
  asignadaEn    DateTime     @default(now())
  asignadaPor   Persona?     @relation("hechas", fields: [asignadaPorId], references: [id], onDelete: SetNull)
  asignadaPorId String?

  @@unique([examenId, personaId])
  @@index([personaId])
}
```

`@@unique([examenId, personaId])` es la regla de fondo: **una sola asignación por examen y
persona**. Volver a asignárselo a quien ya lo tiene no crea otra fila, le cambia la fecha
(`upsert`). `asignadaPor` se queda en nulo si algún día se borra a quien asignó, para no
arrastrar la asignación con él.

## 3. La fecha tope y el huso de Madrid

El profesor escribe un día (`<input type="date">`, «2026-10-20»). Por dentro se guarda el
instante de las **23:59:59.999 de ese día en Europe/Madrid**, que en junio y en diciembre
no cae en el mismo momento UTC.

Un fichero nuevo, `lib/tiempo/madrid.ts`, con tres funciones puras y ninguna dependencia
nueva:

- `finDelDiaEnMadrid(dia: string): Date` — de «2026-10-20» al instante exacto. El desfase
  se pide a `Intl.DateTimeFormat` con `timeZoneName: "longOffset"` («GMT+02:00»)
  preguntando por el **mediodía UTC de ese mismo día** —un instante que siempre cae
  dentro del día pedido, se sume o se reste el desfase— y se resta del
  `Date.UTC(año, mes, día, 23, 59, 59, 999)`. Los cambios de hora ocurren a las 02:00 y a las 03:00, así que las
  23:59 nunca caen en el salto: una sola corrección basta, y eso queda escrito en el
  comentario para que nadie lo «arregle» con una librería.
- `diaEnMadrid(instante: Date): string` — el camino de vuelta, para rellenar el campo de
  fecha al cambiarla.
- `fechaEnPalabras(instante: Date): string` — «viernes, 20 de octubre de 2026», con
  `Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "full" })`.

Y una cuarta, de regla: `estaFueraDePlazo(fechaTope: Date, ahora: Date): boolean`. **El
«ahora» se pasa siempre como argumento**, nunca se lee dentro: es lo que permite probarla
sin depender de cuándo corre la suite.

**Una fecha que ya pasó se rechaza al asignar** («Esa fecha ya pasó.»). No tiene sentido
mandar un correo diciendo «para ayer».

## 4. La pantalla del profesor: «Quién lo hace»

Una caja nueva en `app/examenes/[id]/page.tsx`, debajo de «Publicación», **solo visible si
el examen está publicado** (en construcción no hay nada que asignar, y eso se dice en una
línea en vez de enseñar un formulario muerto).

Dentro:

- La lista de personas **activas con papel ESTUDIANTE**, una casilla por cada una, y
  «marcar todos». **Las casillas nacen vacías**, incluidas las de quien ya lo tiene: si
  nacieran marcadas, asignárselo a uno nuevo le cambiaría la fecha a los otros once sin
  que nadie lo pidiera. Al lado de quien ya lo tiene se lee su fecha, para saber a quién
  se la estás cambiando si vuelves a marcarlo.
- Un campo de fecha, **uno solo para toda la tanda**.
- El botón «Asignar».
- Debajo, la lista de quién lo tiene: nombre, fecha en palabras, y un botón «Quitárselo»,
  que es un formulario con POST, **nunca un enlace**: en Next un enlace que cambia algo lo
  dispara sola la precarga, que es exactamente lo que borró la sesión de Pablo el 12 sept.

Las dos acciones nuevas viven en `app/examenes/acciones.ts` y empiezan, como todas, por
`exigirProfesor()`:

- `asignarExamenAccion(examenId, formulario)` → `lib/examen/asignar.ts`.
- `quitarAsignacionAccion(examenId, personaId)`.

`asignarExamen(examenId, personaIds, dia, profesorId)` comprueba, en una transacción que
**bloquea la fila del examen** con el `bloquearExamen` que ya existe:

1. el examen está PUBLICADO (si no: «Solo se asigna un examen publicado.»);
2. hay al menos una persona marcada;
3. cada persona existe, está activa y es estudiante (si no, no se asigna ninguna: es un
   error de programa, no del profesor);
4. el día tiene forma de día y no ha pasado.

Devuelve `{ asignados: number, sinAviso: string[] }` o `{ error }`.

## 5. El correo de aviso

`mensajeDeAsignacion(a, { nombre, titulo, nivel, fechaEnPalabras, url })` en
`lib/correo/mensaje.ts`, con la misma forma que `mensajeDeEntrada`: texto plano y HTML.
Asunto: **«Tienes un examen: <título>»**. El enlace apunta a la portada del sitio
(`direccionDelSitio()`), **no es un enlace de entrada**: si no tiene la sesión abierta, la
puerta le pedirá su correo como siempre. Un enlace de entrada por correo caduca en quince
minutos y se gasta al primer clic, así que mandarlo aquí solo produciría avisos rotos.

**El correo se manda FUERA de la transacción, después de guardar**, y uno por estudiante.
Si el envío falla, la asignación **no se deshace**: se recoge el nombre en `sinAviso` y la
pantalla lo dice («Asignado a 8. No salió el aviso a Ana: díselo tú.»). Que el correo de
un menor rebote no puede dejar a los otros once sin examen.

Al **quitar** una asignación no sale ningún correo (decidido: se dice en clase).

## 6. Retirar y Archivar

**Retirar** deja de ser un `updateMany` suelto. Pasa a la transacción que bloquea el
examen y cuenta las asignaciones:

- si hay, no retira: «No se puede retirar: lo tienen asignado Ana, Luis, Marta y 5 más.
  Quítaselo antes.» (tres nombres y el resto contado, para que el mensaje no crezca);
- si no hay, retira como hoy.

**Archivar** es nuevo y va en la misma caja. Un examen archivado está fuera de
circulación: no se edita, no se publica y no se asigna.

- `archivarExamen` solo desde EN_CONSTRUCCION. Desde publicado no deja: «Retíralo antes de
  archivarlo», y así la comprobación de asignaciones no hay que repetirla en dos sitios.
  Sobre uno ya archivado no hace nada y no es error, igual que publicar lo ya publicado.
- `recuperarExamen` lo devuelve a EN_CONSTRUCCION.

**El segundo agujero, que aparece con Archivar:** `exigirEditable` (`lib/taller/publicado.ts`)
hoy solo rechaza PUBLICADO, así que **un examen archivado se podría seguir editando**. Se
extiende a los dos estados:

- `ExamenPublicado` pasa a ser `ExamenNoEditable`, que lleva su propio mensaje;
- los seis sitios que hoy hacen `if (error instanceof ExamenPublicado) return { error: MENSAJE_PUBLICADO }`
  (cuatro en `paginas.ts`, uno en `examenes.ts`, uno en `cuadernillos.ts`) devuelven
  `{ error: error.message }`;
- `MENSAJE_PUBLICADO` se queda como está (lo usan la pantalla y las pruebas) y se le suma
  `MENSAJE_ARCHIVADO`;
- `lib/taller/ia/rellenar.ts:95` no pasa por `exigirEditable`: mira el estado a mano y
  solo conoce PUBLICADO. También hay que darle el archivado.

## 7. Inicio del estudiante

`app/page.tsx` deja de ser la pantalla de comprobar que entrar funcionaba.

**Si quien entra es estudiante:** su nombre y, debajo, una tarjeta por cada examen
asignado, ordenadas por fecha, con el título, el nivel, «Para el viernes, 20 de octubre de
2026» y, si el plazo pasó, «Se pasó el plazo el …». Cada tarjeta dice que **todavía no se
puede empezar**; el botón llega con la 3c. Si no tiene nada: una línea, «No tienes nada
pendiente.»

**Si es profesor:** lo mismo que ahora (Personas, Exámenes y las dos pantallas de prueba).
**Las pantallas de prueba dejan de enseñarse a los estudiantes**, que no tienen nada que
hacer ahí.

Los datos salen de `asignacionesDe(personaId)` en `lib/examen/asignar.ts`, que devuelve lo
justo para pintar: título, nivel, modo y fecha. **Ni una clave ni un identificador de
fichero**, por la misma razón por la que existe `actividadParaElEstudiante`.

## 8. El candado de los ficheros

`lib/ficheros/permisos.ts`, una función y nada más:

```ts
export function puedeVerFichero(
  persona: { id: string; papel: Papel },
  fichero: { subidoPorId: string | null },
): boolean
```

- profesor → sí, todo;
- estudiante → sí **solo si lo subió él mismo** (`subidoPorId === persona.id`);
- en cualquier otro caso → no.

Es una lista blanca a propósito: un fichero nuevo que nadie haya pensado queda **fuera**
por defecto, no dentro.

En `app/api/ficheros/[id]/route.ts`, cuando la respuesta es no, se contesta **404 con el
mismo cuerpo exacto** que un fichero inexistente (`{"error":"No encontrado."}`). Un 403
confirmaría que ese identificador existe, que es justo lo que no queremos contarle a quien
esté probando identificadores.

Lo que **no** cambia, y conviene dejarlo escrito para que nadie lo «arregle»:
`/api/ficheros/permiso` y `/api/ficheros/confirmar` ya son solo del profesor, y
`/api/grabaciones/permiso` sigue abierta a cualquiera con sesión **a propósito**, porque
ahí es donde grabará el estudiante en la 3e.

## 9. Errores

Todos en la misma voz que el resto del sitio: qué ha pasado y qué hacer.

| Situación | Mensaje |
|---|---|
| asignar un examen no publicado | «Solo se asigna un examen publicado.» |
| sin nadie marcado | «Marca al menos un estudiante.» |
| fecha vacía o mal escrita | «Falta la fecha, o no es una fecha.» |
| fecha pasada | «Esa fecha ya pasó.» |
| retirar con gente dentro | «No se puede retirar: lo tienen asignado A, B, C y N más. Quítaselo antes.» |
| archivar publicado | «Retíralo antes de archivarlo.» |
| escribir en un archivado | «El examen está archivado: recupéralo para editarlo.» |
| correo que no sale | «Asignado a N. No salió el aviso a X: díselo tú.» |

## 10. Cómo se prueba

La regla de siempre: hay que poder **borrar el candado y ver algo rojo**. Cada prueba
lleva escrita al lado la mutación que tiene que matar.

1. **La ruta del fichero, no la función** (`tests/ficheros-rutas.test.ts`, ampliando el
   fichero que ya existe y que se escribió por esto mismo): con `puedeVerFichero` de
   verdad y solo la red doblada, un estudiante pide una página de examen → **404**, con el
   cuerpo idéntico al de un fichero que no existe, y `enlaceDeLectura` **no llega a
   llamarse**; el mismo fichero con el profesor → 307. Mutación: quitar el `if` de la ruta.
2. **La regla suelta** (`tests/ficheros-permisos.test.ts`): profesor sí, dueño sí, otro
   estudiante no, `subidoPorId` nulo no. Mutación: cambiar el `===` por un `!==` o volver
   la lista blanca lista negra.
3. **El fin del día en Madrid** (`tests/tiempo-madrid.test.ts`): el 20 de junio y el 20 de
   diciembre dan instantes distintos, escritos a mano en la prueba. Mutación: calcular en
   UTC — el examen caducaría una o dos horas antes. Y `estaFueraDePlazo` con el «ahora»
   pasado a mano, nunca `new Date()`.
4. **Retirar con gente dentro** (`tests/base/asignaciones.test.ts`, contra Postgres de
   verdad): se asigna, se retira, da error, y el estado se **vuelve a leer de la base**, no
   del valor devuelto. Mutación: quitar el conteo de asignaciones.
5. **Una sola asignación por examen y persona** (misma prueba de base): asignar dos veces
   deja una fila con la fecha nueva. Mutación: quitar el `@@unique` o cambiar el `upsert`
   por un `create`.
6. **Archivar** (misma prueba de base): no deja desde publicado, sí desde construcción, y
   sobre un archivado `guardarTarea` y `registrarPaginas` devuelven el mensaje de
   archivado. Mutación: dejar `exigirEditable` mirando solo PUBLICADO — es el agujero que
   Archivar abre.
7. **Inicio** (`tests/portada.test.ts`, ampliando), pintado con `renderToStaticMarkup`, sin
   jsdom: un estudiante con asignación ve el título y la fecha en palabras; y **no** ve
   «Personas», «Exámenes» ni las pantallas de prueba. Antes de dar por buena una ausencia,
   la prueba comprueba que lo pintado **no está vacío**: una pantalla que reviente pasaría
   todos los `not.toContain` del mundo.
8. **El correo**, en dos mitades. El mensaje en sí (`tests/correo-mensaje.test.ts`, sin
   base): lleva título, nivel y fecha en palabras, y el enlace es la portada, no un enlace
   de entrada. El envío (`tests/base/asignaciones.test.ts`, con `mandar` doblado): sale
   **uno por estudiante marcado**, y si revienta con uno, las asignaciones de todos siguen
   en la base y ese nombre aparece en `sinAviso`. Mutación: mandar el correo dentro de la
   transacción — la prueba muere porque un fallo de correo dejaría a los otros once sin
   examen.
9. **Las acciones nuevas exigen profesor** (`tests/taller-acciones.test.ts`): asignar y
   quitar con un estudiante rebotan. Mutación: borrar el `exigirProfesor()` de cualquiera
   de las dos.

## 11. Aceptación, en producción

Con el examen 1 ya cargado y publicado:

1. Dar de alta un estudiante de prueba con un correo del profesor que no sea el suyo de
   entrar.
2. Asignárselo con fecha, marcando la casilla, y ver la caja decir a cuántos.
3. **Que el correo llegue de verdad** y que el enlace lleve a la portada.
4. Entrar con esa cuenta y ver la tarjeta en Inicio, con la fecha en palabras.
5. Desde esa cuenta, pedir a mano una página del examen por su identificador: **404**.
6. Intentar Retirar el examen: no deja, y dice el nombre.
7. Quitar la asignación, retirar, archivar, recuperar.

## 12. Lo que sigue abierto

- **La aceptación en producción de la 3a** sigue pendiente (pistas 05-08 del examen 1,
  fotos de CO1 y EO1, «Rellenar con IA» sin perder fotos). No bloquea esta entrega.
- El modo libre, que se decide al llegar a la 3c.
- Recordar por correo dos días antes de la fecha: no entra hoy.
- El freno por dirección de red en la puerta, aparcado desde el 12 sept.
