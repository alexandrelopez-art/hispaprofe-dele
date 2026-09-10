# La puerta y el almacén · diseño

**Fecha:** 10 septiembre 2026.
**Estado:** decidido con el profesor en la sesión del 10 de septiembre.
**Depende de:** `2026-09-09-hispaprofe-dele-design.md` (el diseño general) y de los
cimientos ya construidos (`2026-09-09-cimientos.md`).

Esta entrega construye las dos piezas que hoy no existen y sin las cuales el taller
del examen no se puede ni planear: **quién entra al sitio** y **dónde viven los
ficheros**. No construye nada del taller.

## 1. Por qué ahora

El repositorio nuevo tiene modelo de datos, guarda de publicación y la función que
manda una actividad al navegador. No tiene nada más. No hay forma de saber quién
está mirando la pantalla, así que no existe «el profesor», y no hay dónde poner una
página de examen, un audio ni una grabación.

El taller necesita las dos cosas desde su primera pantalla. Diseñarlo antes sería
diseñar sobre supuestos.

## 2. Decisiones del profesor

Tomadas el 10 de septiembre y no se reabren sin información nueva.

1. **Se entra con un enlace que llega al correo. No hay contraseñas.** Descartada
   la puerta del sitio viejo (correo y contraseña propia, ya probada en producción)
   porque con doce adolescentes las contraseñas se pierden y se comparten.
2. **El remitente es `contacto@hispaprofe.com`**, que es un **alias** de
   `ips@ips-hyl.com`, no una cuenta con contraseña propia. El sitio manda por el
   SMTP de Gmail de esa cuenta, con el remitente puesto al alias.
3. **Las grabaciones de los estudiantes van a una unidad compartida de Drive.** El
   navegador sube directo; la base guarda el enlace; el profesor lo abre con su
   cuenta de Google. Idea suya, y resuelve el problema del tamaño sin gastar cupo.
4. **Las páginas y los audios de los exámenes van al almacén privado de Vercel**,
   servidos con enlaces firmados que caducan.
5. **Nadie se registra solo.** El profesor da de alta a cada persona.
6. **Dos papeles: profesor y estudiante.** Con trece personas, un tercero sobra.

### Enmienda a la sección 7 del diseño general

Aquella sección descartaba Drive en bloque, con este argumento: para enseñarle un
fichero al estudiante habría que sacarlo de Drive y pasarlo por nuestro servidor, y
ahí choca con el límite de salida.

El argumento sigue siendo cierto **para lo que miran los doce**. No lo es para las
grabaciones, que **las mira una sola persona, el profesor, que además tiene cuenta
de Google y acceso a la carpeta**. Por eso el reparto:

| Qué | Dónde | Quién lo abre | Por qué ahí |
|---|---|---|---|
| Grabaciones de los estudiantes | Unidad compartida de Drive | Solo el profesor | Pesan mucho y crecen sin parar; en Vercel llenarían el cupo gratuito |
| Páginas y audios de los seis exámenes | Almacén privado de Vercel | Los doce, a diario | Hay que servirlos muchas veces y deprisa; unos 250 MB en total |

El límite de 4,5 MB deja de aplicar en los dos casos, porque **el navegador sube y
descarga directo contra el almacén** y el fichero nunca atraviesa nuestro servidor.

## 3. Quién entra: el modelo

Tres tablas nuevas.

- **`Persona`**: `id`, `correo` (único, en minúsculas), `nombre`, `papel`
  (`PROFESOR` | `ESTUDIANTE`), `activa`, `createdAt`. Es la lista blanca: si un
  correo no está aquí, no entra nadie.
- **`EnlaceDeEntrada`**: `id`, `personaId`, `secretoHash`, `expiraEn`, `usadoEn`,
  `createdAt`. **El secreto no se guarda nunca en claro**, igual que una contraseña.
- **`Sesion`**: `id`, `personaId`, `cookieHash`, `expiraEn`, `ultimaVezEn`,
  `createdAt`.

Y una cuarta para los ficheros.

- **`Fichero`**: `id`, `almacen` (`VERCEL` | `DRIVE`), `ruta` (la ruta en el almacén
  o el identificador del fichero de Drive), `nombreOriginal`, `tipoMime`, `bytes`,
  `subidoPorId`, `createdAt`.

`Pieza.ficheroId` existe hoy como texto suelto, sin relación. **Pasa a ser una clave
ajena a `Fichero`.** Hoy la base está vacía, así que el cambio es gratis; con datos
sería caro.

## 4. Cómo se entra

1. La persona escribe su correo en `/entrar`.
2. **La pantalla siguiente es siempre la misma**, exista el correo o no: «si esa
   dirección está dada de alta, te hemos mandado un enlace». Así nadie puede
   averiguar quién está apuntado probando direcciones.
3. Si el correo existe y la persona está activa, se genera un secreto aleatorio de
   32 bytes, se guarda solo su huella, y sale el correo con el enlace.
4. **El enlace vale quince minutos y un solo uso.** Al pulsarlo se comprueba que no
   ha caducado y que no está usado, se marca usado, y se abre sesión.
5. La sesión es una cookie `httpOnly`, `secure`, `sameSite=Lax`, con **treinta días**
   de vida. En la práctica se entra una vez por trimestre.
6. Se vuelve a donde la persona quería ir, si venía de algún sitio.

**Límites contra el abuso:** cinco peticiones de enlace por correo y por dirección de
red cada quince minutos. Pasado el límite, la misma pantalla de siempre, sin correo.

**Salir** borra la fila de sesión, no solo la cookie.

## 5. Cómo se sube y se ve un fichero

**Página o audio de examen (lo sube el profesor):**

1. El navegador le pide al sitio permiso para subir, diciendo nombre y tamaño.
2. El sitio comprueba que quien pide es el profesor y responde con un **enlace
   firmado de subida**, válido quince minutos y para esa ruta y solo esa.
3. El navegador sube directo al almacén.
4. Avisa al sitio, que **pregunta al almacén si el fichero está de verdad ahí** y
   solo entonces escribe la fila `Fichero`. Una subida cortada no deja fila.

**Ver una página o un audio:** el sitio comprueba quién eres y si te toca, y devuelve
un **enlace firmado de lectura de pocos minutos**. Nada queda accesible por el simple
hecho de conocer la dirección.

**Grabación (la sube el estudiante):**

1. El estudiante graba en el navegador y confirma el envío.
2. El sitio, con la cuenta robot, abre una **sesión de subida en la unidad
   compartida** y le pasa al navegador la dirección de esa sesión.
3. El navegador sube directo a Google.
4. El sitio guarda la fila `Fichero` con el identificador de Drive.
5. **El estudiante nunca ve la carpeta.** No tiene permiso en ella, y por eso no
   puede ver las grabaciones de los demás.

**Ver una grabación:** en la lista de pendientes del profesor aparece el enlace, que
él abre en Drive con su cuenta.

## 6. Lo que puede fallar, y qué se hace

- **El correo no llega.** La pantalla ofrece pedir otro enlace, con el límite de
  arriba. Es el fallo más probable y el más caro: un estudiante que no entra.
- **El enlace caducó o ya se usó.** Pantalla que lo dice y ofrece pedir otro. No se
  distingue entre las dos causas.
- **La cuenta robot no puede escribir en Drive.** Mensaje claro al profesor diciendo
  qué falta, nunca un error genérico. Pasa si la carpeta no es una unidad compartida:
  una cuenta robot no tiene espacio propio.
- **La subida se corta a medias.** No hay fila, así que no hay fichero fantasma. El
  estudiante lo ve y vuelve a intentarlo.
- **El cupo del almacén de Vercel.** Con 250 MB de material no debería acercarse. Si
  se acercara, el aviso llega por correo de Vercel y hay que pasar a plan de pago
  antes de que corte, porque el corte dura treinta días.

## 7. Seguridad

- Ningún fichero es público. Ningún enlace de lectura vive más de unos minutos.
- Ni el secreto del enlace de entrada ni el de la cookie se guardan en claro.
- La respuesta es idéntica para un correo dado de alta y uno que no existe.
- La contraseña de aplicación del correo es **aparte de la de la clínica**, para que
  revocar una no tumbe la otra.

## 8. Cómo se prueba

Las trampas concretas de esta entrega, que son las que hay que cerrar con pruebas:

1. **Probar solo el camino feliz de la entrada.** La prueba que importa es la del
   enlace caducado y la del enlace usado dos veces.
2. **Dar por buena una subida sin preguntar al almacén.** Hay que probar el caso en
   que el navegador dice que subió y el fichero no está.
3. **Comprobar que «se manda un correo» sin mirar qué lleva dentro.** La prueba tiene
   que sacar el enlace del cuerpo del mensaje y usarlo.
4. **Probar una función que ninguna pantalla llama.** Cada regla de esta entrega se
   prueba por el camino por el que la usa la aplicación.
5. **Que el estudiante pueda pedir un enlace firmado de un fichero que no le toca.**
   Hay que probarlo desde el papel de estudiante, no solo desde el de profesor.

**Y una comprobación que ninguna prueba automática puede hacer:** mandar un enlace de
entrada de verdad a una dirección de Gmail y a otra de Hotmail y ver que llega a la
bandeja y no a no deseado. Mandar desde una cuenta de otro dominio puede fallar la
firma según cómo esté montado el espacio de Google. **La entrega no se da por buena
sin esa prueba.**

## 9. Qué se construye y qué queda fuera

**Se construye:** entrar, salir, la lista de personas del profesor con el alta, los
dos caminos de subida enteros (almacén de Vercel y Drive) y el de lectura con enlace
firmado.

Los dos caminos de subida se construyen **con una pantalla mínima cada uno**, sin
diseño y sin sitio en el menú, porque es la única forma de comprobar que Drive y el
almacén funcionan de verdad y que lo que tiene que preparar el profesor está bien
puesto. Cuando llegue el taller, esas pantallas se tiran y el mecanismo se queda.

**Queda fuera:** el taller, la biblioteca, el reproductor del estudiante, la portada
comercial y cualquier otra pantalla.

## 10. Lo que tiene que hacer el profesor

1. Dar de alta `contacto@hispaprofe.com` en el «Enviar como» de `ips@ips-hyl.com` y
   confirmarlo, y crear una **contraseña de aplicación aparte** para el sitio.
2. Crear el almacén privado en Vercel y conectarlo al proyecto.
3. Crear la unidad compartida de Drive y dar acceso de escritura a la cuenta robot.
4. Pasar la cadena de conexión de Postgres, que sigue pendiente desde ayer y sin la
   cual no hay base donde crear nada de esto.
