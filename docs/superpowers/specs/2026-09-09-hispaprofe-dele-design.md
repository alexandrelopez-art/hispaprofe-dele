# HispaProfe DELE · diseño

Escrito el 9 de septiembre de 2026, a partir de la conversación de ese día.
Sustituye a `~/Projects/hispaprofe`, que se queda donde está y no se toca.

Lienzo de las pantallas, aprobado:
https://claude.ai/code/artifact/82aaa647-d02b-4bce-9428-329cdd0f305b

---

## 1. Por qué un repositorio nuevo

El sitio actual no tiene usuarios, ni datos, ni una sola prueba automática. No
hay nada que proteger. Y tiene dos defectos que no se arreglan por encima:

1. **El examen del DELE es un disfraz.** El esquema lo dice con todas las
   letras: «un examen del DELE… por debajo son dos `Recorrido` que el estudiante
   abre como siempre». El taller del profesor es nuevo y bueno; el alumno entra
   al reproductor genérico de cursos, hecho para clases particulares.
2. **Un paso admite un solo ejercicio.** La regla `@@unique([pasoId])` prohíbe
   montar vídeo, luego preguntas, luego un espacio para escribir. El editor que
   el profesor quiere no es que esté mal hecho: está prohibido por el modelo.

La navegación y el editor eran el síntoma. Esto es la causa.

## 2. Qué se construye y qué no

**Nace solo con preparación al DELE A2/B1 escolar.** Un profesor, doce
estudiantes. Esa cifra es la restricción de diseño más útil que tenemos: nada de
colas, filtros ni paginación. Lo que se lee de un vistazo gana.

**Aparcado, y explícitamente fuera de esta entrega:** artículos, juegos, clases
particulares, grupos, deberes, el editor de secuencias por bloques y el corrector
de expresión oral por intervenciones. Ninguno de ellos se dibuja en el menú hasta
que funcione. Poner el botón antes que la cosa es exactamente lo que hizo
insoportable la versión anterior, que enseñaba cuatro bloques con tres «en
preparación».

## 3. Cómo se guarda un examen

*Sección aprobada por el profesor.*

Un examen es una caja con cuatro pruebas: comprensión de lectura, comprensión
auditiva, expresión escrita, expresión oral. Cada prueba tiene sus tareas
numeradas.

**Una tarea es una lista ordenada de piezas.** Una pieza es una de estas seis
cosas: un texto, una imagen, un audio, un vídeo, una actividad que se corrige
sola (opciones, huecos, ordenar, relacionar) o una actividad de respuesta abierta
(escribir, grabarse).

**Una tarea puede llevar tantas piezas como haga falta, en el orden que sea.**
Ese es el candado que se abre y el que hace posible el editor del futuro.

Encima de la lista, el examen impone sus reglas:

| Prueba | Tareas | Ítems por tarea |
|---|---|---|
| Comprensión de lectura | 4 | 6, 6, 6, 7 |
| Comprensión auditiva | 4 | 7, 6, 6, 6 |
| Expresión escrita | 2 | respuesta abierta, se elige una de dos opciones |
| Expresión oral | 4 | ver la sección 6 |

Si una tarea no cuadra con esos números, **el examen no se puede publicar**. Esa
comprobación es la red que caza los errores de la IA al transcribir, y por eso
las reglas viven en la capa del examen y no dentro de la lista de piezas.

Dos consecuencias:

- **Las respuestas correctas viven aparte de la tarea**, para que una tarea se
  pueda mostrar en práctica libre sin que la solución viaje al navegador.
- **Las instrucciones del libro hay que retocarlas al entrar.** Dicen «marca las
  opciones elegidas en la Hoja de respuestas», y en el sitio esa hoja no existe.
  El taller enseña la frase original y la corregida, y el profesor aprueba.

## 4. Publicar y asignar

El profesor publica un examen y elige a qué estudiantes. Al hacerlo decide el
**modo**, que es una propiedad de la publicación y no de la tarea:

- **Completo.** El estudiante lo hace entero, cronometrado, de una sentada.
- **Libre.** El estudiante escoge qué tareas hacer, sin reloj y repitiendo lo que
  quiera. Las tareas de todos los exámenes abiertos forman **una sola bolsa**, así
  que puede mezclar tareas de un examen y de otro.

## 5. Lo que ve el estudiante

Tres sitios, un solo nivel de menú: **Inicio**, **Practicar**, **Mis resultados**.

**Inicio** contesta a «¿qué tengo que hacer hoy?», no a cómo está organizada la
preparación. Enseña lo que tiene abierto con su fecha: el examen asignado, las
grabaciones sin entregar, la próxima cita oral. Cuando no hay nada, lo dice en
una línea y ofrece la biblioteca, que está siempre abierta.

**Practicar** junta las dos fuentes sin confundirlas: tareas sueltas de exámenes
reales, y ejercicios de gramática y vocabulario. Se filtra por prueba y por
nivel, de A1 a B2. Un estudiante de B1 puede subir a B2 a propósito y el sitio se
lo marca como un reto, para que no tropiece con ello por error.

**Leer un texto largo y contestar sin perderse** es lo que más hace un estudiante
del DELE y donde se gana o se pierde el sitio. El texto va en su propia columna
con su desplazamiento; las preguntas, al lado.

## 6. El examen blanco

Las cuatro pruebas, seguidas y cronometradas. Se ve siempre en qué prueba va y
cuánto queda. **Una prueba terminada no se reabre**, y eso se avisa antes de
empezar, no después.

La prueba oral dura unos 12 minutos y tiene **cuatro** tareas, no tres, y **dos
de ellas son de hablar solo**, no una. Esto está comprobado en el material, no
supuesto:

| Tarea | Qué es | Duración | Quién está |
|---|---|---|---|
| 1 | Describir una foto, elegida entre dos | 1-2 min | habla solo |
| 2 | Diálogo en una situación simulada | 2-3 min | con el examinador |
| 3 | Presentar un tema, elegido entre dos | 2-3 min | habla solo |
| 4 | Entrevista sobre lo que ha presentado | 2-3 min | con el examinador |

El estudiante tiene **12 minutos para preparar las tareas 1 y 3**, y puede tomar
notas que consulta durante el examen, sin leerlas.

**Y las tareas van emparejadas por tema.** En el examen 2, la tarea 1 y la 2
comparten «El regalo perfecto»; la 3 y la 4, «Las redes sociales». La tarea 4 es
una entrevista *sobre la presentación que el estudiante acaba de hacer*.

De ahí sale el reparto:

- **Las de hablar solo (1 y 3) las graba el estudiante**, en audio o vídeo según
  lo que el profesor haya pedido para ese examen. Puede repetir las tomas y
  entrega la que elija. Caen en la cola de revisión.
- **Las de interacción (2 y 4) son en directo con el profesor.** El sitio agenda
  la cita y le da la ficha con las preguntas modelo.
- **Orden obligatorio:** el profesor tiene que haber visto la grabación de la
  tarea 3 **antes** de la cita, porque la tarea 4 pregunta sobre ella. La cola de
  Pendientes tiene que dejarlo claro, y una cita cuya grabación no está vista se
  marca como no preparada.

**Ojo con las fotos.** La tarea 1 es describir una fotografía, y las del libro
están en gris como todas las demás. Entran en la misma lista de reemplazos en
color que el profesor busca a mano.

## 7. Los ficheros y las grabaciones

**Esto es el problema técnico serio y hay que resolverlo desde el principio.**

Hoy los ficheros viven como bytes **dentro de la base de datos**, y la plataforma
corta a 4,5 MB **tanto la petición como la respuesta**. Un audio de tres minutos
cabe raspando. Un vídeo de tres minutos, entre 30 y 100 MB, no cabe de ninguna
manera, y la subida se corta antes de que nuestro código se entere.

Guardarlos en Drive tampoco sirve: para enseñárselos al estudiante habría que
sacarlos de Drive y pasarlos por nuestro servidor, y ahí chocan con el límite de
salida. Hacerlos públicos no es aceptable, siendo grabaciones de menores.

**Decisión: un almacén de ficheros con subida y descarga directas desde el
navegador**, sin pasar por nuestro servidor. La base guarda solo el enlace. Las
imágenes de las páginas de los exámenes también se mudan ahí, porque hoy engordan
la base y cada copia de seguridad se las lleva enteras.

## 8. La biblioteca

Ejercicios de gramática y vocabulario **de A1 a B2**, importados de las
colecciones que el profesor compró. Los libros traen el texto extraíble y las
soluciones al final, y sus formatos son los que el motor ya sabe hacer, así que
**la biblioteca es más barata de cargar que los seis exámenes**.

El profesor la ve por nivel y por tema, y decide qué abre a quién.

## 9. Lo que ve el profesor

Cuatro sitios: **Exámenes**, **Biblioteca**, **Estudiantes**, **Pendientes**.

**Pendientes** junta en una sola lista, ordenada por fecha, las entregas por
corregir (expresiones escritas y grabaciones) y las citas orales. Son dos formas
de «lo que me espera», y con doce estudiantes caben en una pantalla.

## 9 bis. Las opiniones de los estudiantes

La portada necesita testimonios, y tienen que salir de los propios estudiantes.

**Una opinión pertenece a un estudiante** y guarda: el texto, la fecha, cómo
quiere que se le nombre, si hay permiso para publicarla, y su estado (nueva,
publicada, archivada). Un estudiante puede tener varias.

**Siempre abierta.** El estudiante puede escribir su opinión desde el primer día,
desde Mis resultados, y **tantas veces como quiera**: cada una es una entrada
suya, y el profesor elige. No hace falta acertar con el momento, porque la
clasificación la hace él.

**Y un aviso al final, que lo dispara el profesor.** Un botón en su lado pide la
opinión a los estudiantes que él elija, y a esos les aparece un aviso en su
Inicio. Nada de reglas automáticas: con doce estudiantes y una convocatoria,
cualquier regla sería más complicada que pulsar un botón. El aviso se puede
ignorar y no tapa nada.

**Quién publica.** El profesor, desde la ficha del estudiante en **Estudiantes**.
No hay sección nueva en el menú: una opinión pertenece a una persona, así que
vive donde vive esa persona. La portada enseña las publicadas; si no hay
ninguna, esa parte de la portada no se dibuja.

**Permiso y firma, que son dos cosas distintas y los estudiantes son menores.**
Publicar el nombre y las palabras de un menor en una web abierta normalmente
necesita el permiso de su padre o su madre, no solo el del estudiante. Por eso la
ficha guarda por separado:

- **El permiso**, marcado explícitamente. Sin permiso, la opinión le sirve al
  profesor pero **no puede salir a la portada**, y el sitio no se lo deja hacer.
- **Cómo firma**: nombre completo, solo el nombre de pila, iniciales, o anónimo.

Merece una prueba con su mutación: quitar la comprobación del permiso y que una
opinión sin permiso llegue a la portada tiene que poner una prueba en rojo.

## 10. Qué se muda del repositorio viejo

**Se lleva** (unas 3.000 líneas, que es lo caro de hacer):

- El motor de respuesta: opción, huecos, ordenar, relacionar, el reproductor con
  escuchas racionadas y el encadenado de trozos de audio.
- El taller del examen: subida de páginas, cuadernillo, «Rellenar con IA»,
  revisión tarea por tarea, corte de audio sobre la onda, publicar y asignar.
- Los orales del profesor: panel de evaluación en directo con cronómetro,
  tarjetas de criterio, parrilla de temas y horario, más la ficha A4 imprimible.

**Se deja** (unas 16.000 líneas): recorridos, pasos, bloques, ejercicios sueltos,
clases, grupos, deberes, entregas, importador de alumnos.

**Aviso.** El corrector de expresión oral que separa las intervenciones por
renglones **no existe**. La tabla `TranscripcionOral` está creada, con sus campos
para los segmentos y el informe, pero ningún fichero de la aplicación los lee ni
los escribe. Se diseñó y no se construyó. Va después de los seis exámenes.

## 11. Cómo se prueba

El repositorio viejo tiene **cero pruebas**. El nuevo nace con ellas, y con una
regla: **para cada prueba escrita, decir qué mutación tendría que matarla y
comprobarlo**. Sin la mutación, la prueba no está verificada.

Las seis formas conocidas de pasar en verde sin comprobar nada, adaptadas a este
repositorio: el campo que ya nacía vacío; la coincidencia del calendario (anclar
fechas lejos o fijar el reloj, nunca depender de cuándo corre la suite); la
cadena encontrada dentro de un comentario; la guarda definida pero no enganchada
a la ruta, que hay que mutar ruta por ruta; el dato de ejemplo que ya venía
limpio; y el parche que salta antes de llegar. Y comprobar siempre que el número
de pruebas recogidas no es cero antes de leer un resultado como bueno.

Las tres cosas que más merecen prueba aquí: que una tarea que no cumple sus
números **no se pueda publicar**; que un examen en modo completo **no deje
volver** a una prueba cerrada; y que la respuesta correcta **no viaje al
navegador** en práctica libre.

## 12. El orden del trabajo

1. **Cargar el primer examen con el taller que ya existe**, para medir lo que
   cuesta de verdad antes de mudar nada. Bloqueado hasta que el profesor ponga
   `ANTHROPIC_API_KEY` en Vercel. Estimación: unos 1,20 $ por examen, 8 $ los
   seis; el primero dará la cifra real.
2. Levantar el repositorio nuevo con el modelo de la sección 3.
3. Mudar el motor, el taller y los orales.
4. Las pantallas del estudiante y del profesor, según el lienzo.
5. El almacén de ficheros y las grabaciones.
6. Los cinco exámenes restantes.
7. La biblioteca.

## 13. Lo que sigue abierto

- Cómo se llama y cómo se ve la portada pública ya está decidido y dibujado
  (escaparate con acceso discreto), pero **los datos comerciales los tiene que
  dar el profesor**: precio, fechas, plazas, resultados y testimonio. Están
  marcados como huecos en el diseño y **no se inventan**.
- Cuando toque el corrector oral: quién parte el audio en intervenciones, si una
  máquina que el profesor corrige o él a mano sobre la onda.
