# Encargo: la carcasa completa de HispaProfe

Necesito el diseño completo de la **carcasa** de HispaProfe (la cabecera, la
navegación y la plantilla común de todas las pantallas) y de las pantallas que
cuelgan de ella. Lo quiero como **paquete para Claude Code**: lo vamos a
construir tal cual, así que tiene que decir qué va en cada pantalla, cómo se ve en
ordenador y en móvil, y qué piezas se repiten.

Adjunto:
- `02-diseno-general.md`: el diseño general del sitio. **Manda sobre este
  encargo** si algo choca. Las secciones que importan aquí son la 2, la 4, la 5,
  la 6, la 8, la 9 y la 9 bis.
- `03-colores-y-letra.css`: los colores y la letra que ya usa el sitio (Tailwind
  4, letra Nunito). Úsalos. Si te falta un color, añádelo con el mismo estilo de
  nombre en español.
- `04-pantallas-de-hoy.md`: lo que existe hoy, pantalla a pantalla, y lo que falta.

## Qué es HispaProfe

Un sitio para preparar el **DELE A2/B1 escolar** (examen oficial de español). Lo
usan **un profesor y doce estudiantes adolescentes**. Esa cifra es la regla de
diseño más útil: nada de filtros, paginación ni colas largas. Lo que se lee de un
vistazo gana. Todo el sitio está en español de España.

Hay dos papeles, y cada uno ve un sitio distinto:

- **Estudiante: tres sitios.** Inicio, Practicar y Mis resultados.
- **Profesor: cuatro sitios.** Exámenes, Biblioteca, Estudiantes y Pendientes.

Un solo nivel de menú en los dos.

## El problema que resuelve

Hoy no hay cabecera común. El Inicio del profesor es una lista de enlaces
subrayados y cada pantalla lleva su propio «← Volver a Inicio», puesto a mano. El
sitio anterior murió por lo contrario: **enseñaba botones de cosas que no
existían** («en preparación»). Regla dura: **no se dibuja en el menú nada que no
funcione todavía.** Si diseñas una sección que aún no existe (Practicar,
Biblioteca), márcala en el paquete como «llega en otra entrega». No debe salir en
el menú hasta entonces.

## Qué necesito que entregues

1. **La carcasa**, para cada papel:
   - La cabecera con el menú: en ordenador (1280 px) y en móvil (400 px), y cómo
     se abre y se cierra en móvil.
   - El contador de Pendientes en la cabecera del profesor («Por corregir: 3»).
   - Quién soy y cómo salgo.
   - La sección activa marcada.
2. **La carcasa del examen, aparte.** Mientras un estudiante hace una prueba
   cronometrada, la cabecera normal estorba y distrae. Ahí manda otra, mínima: en
   qué prueba va, cuánto tiempo le queda, y una salida que avisa de que el reloj
   sigue corriendo. **Una prueba entregada no se reabre**, y eso se avisa ANTES de
   empezar, no después.
3. **Cada pantalla de la lista de `04-pantallas-de-hoy.md`**, en ordenador y en
   móvil, con sus estados: vacío («No tienes nada pendiente»), con datos, error y
   cargando. Donde haya un botón que envía algo, cómo se ve mientras envía.
4. **El kit de piezas** que se repiten: botón (principal, secundario, peligro),
   enlace, tarjeta, aviso (información, éxito, error), etiqueta de estado,
   campo de formulario, casilla, desplegable, encabezado de página, bloque vacío.
   Con los nombres que tendrán en el código.
5. **Una nota de construcción** para Claude Code: qué pieza es cada cosa, qué
   colores del CSS usa, y en qué orden conviene construirlo.

## Las pantallas del estudiante que más importan

- **Inicio** contesta a «¿qué tengo que hacer hoy?». Hoy es una tarjeta por
  examen asignado: título, nivel y fecha tope, y debajo una fila por prueba
  (Lectura, Auditiva, Escrita, más adelante Oral) con su estado y un botón
  («Empezar», «Seguir», «Ver resultado», o «Practicar» en modo libre). La fecha
  tope es blanda: quien llega tarde lo hace igual y queda marcado («Se pasó el
  plazo el…»).
- **Hacer la lectura**: el texto largo en su propia columna con su desplazamiento
  y las preguntas al lado. En móvil, una barra pegada abajo con las preguntas.
  **Leer un texto largo y contestar sin perderse es donde se gana o se pierde el
  sitio.** En la auditiva, algunas opciones de respuesta SON fotos, y la foto
  manda.
- **Hacer la escrita**: dos redacciones, con reloj de 50 minutos, contador de
  palabras y enunciado plegable.
- **Resultado de una prueba**: la nota grande, la nota de cada tarea, qué
  significa el rojo (no se dice cuál era la letra buena), si la entregó el reloj y
  qué prueba le queda.

## Las pantallas del profesor que más importan

- **Pendientes** (hoy se llama «Por corregir»): una sola lista por fecha con las
  redacciones por corregir, las grabaciones por ver y las citas orales. Una cita
  cuya grabación de la tarea 3 no se ha visto se marca como **no preparada**.
- **Corregir una redacción**: el texto del estudiante; las cuatro bandas oficiales
  del DELE (0 a 3) por cada una de las dos tareas, con las casillas vacías al
  empezar; un comentario por tarea, y cuántas veces y cuánto tiempo se salió de la
  pantalla. La suma dice «18 de 24» y nada más: **nunca «apto»**.
- **Exámenes y el taller**: la lista de exámenes y la pantalla de un examen. Allí
  se suben las páginas, se rellenan las tareas, se publica o se retira, y se
  asigna a estudiantes con fecha y modo (completo o libre).
- **Estudiantes** (hoy «Personas»): la lista de doce y la ficha de cada uno, con
  sus resultados y sus opiniones (sección 9 bis).

## Lo que llega después (diséñalo, pero márcalo)

- **La oral** (la próxima entrega). El estudiante graba las tareas 1 y 3 (puede
  repetir tomas y entrega la que elija), y las tareas 2 y 4 son una cita en
  directo con el profesor. Hay 12 minutos de preparación para las tareas 1 y 3.
- **Practicar**, **Mis resultados** (con el sitio para dejar una opinión),
  **Biblioteca**.
- **La portada pública**: un escaparate con un acceso discreto. **No inventes
  datos comerciales** (precio, fechas, plazas, resultados, testimonios). Déjalos
  como huecos marcados.

## Lo que NO se dibuja

Artículos, juegos, clases particulares, grupos, deberes y el editor de secuencias
por bloques. Están aparcados y no aparecen en ningún menú.

## Restricciones

- Es para adolescentes en edad escolar y un profesor. Tono claro y cálido, sin
  infantilizar.
- Tiene que verse bien a 400 px. Muchos lo harán desde el móvil.
- Accesible: contraste suficiente (ojo, los botones azules con letra blanca ya
  dieron problemas de lectura), foco visible y botones que se vean como botones.
- Construido con Next 16, React 19 y Tailwind 4. Nada de librerías de componentes
  nuevas sin decirlo.
