# Las pantallas de HispaProfe, a 18 de septiembre de 2026

Todas funcionan y están en producción, salvo las que se marcan como «no existe».
Hoy ninguna comparte cabecera. Cada una lleva, como mucho, un «← Volver a Inicio».

## Sin sesión

| Dirección | Qué es |
|---|---|
| `/entrar` | «Entrar en HispaProfe»: se escribe el correo y llega un enlace. No hay contraseñas. |
| `/entrar/enviado` | «Mira tu correo»: aviso de que el enlace va de camino. |
| `/` sin sesión | Hoy solo el título y un enlace «Entrar». Aquí irá la portada pública (no existe). |

## Estudiante

| Dirección | Qué es |
|---|---|
| `/` | **Inicio**: una tarjeta por examen asignado, con una fila por prueba y su botón (ver el encargo). |
| `/examen/[id]/[prueba]` | **Hacer una prueba** (lectura, auditiva o escrita), con reloj en modo completo. Al terminar, esta misma dirección enseña el **resultado**. |
| Practicar | No existe. |
| Mis resultados | No existe. |
| La oral (grabar las tareas 1 y 3, ver la cita de las 2 y 4) | No existe. Es la próxima entrega. |

## Profesor

| Dirección | Qué es | Sitio del menú |
|---|---|---|
| `/` | Inicio: «Hola, nombre» y una lista de enlaces. | (desaparece o se convierte en resumen) |
| `/personas` | «Personas»: la lista y el formulario «Dar de alta» (nombre, correo, papel). | **Estudiantes** |
| `/examenes` | «Exámenes»: la lista y «Nuevo examen». | **Exámenes** |
| `/examenes/[id]` | Un examen: páginas escaneadas, sus tareas y su estado, la caja «Publicación» (Publicar/Retirar) y «Quién lo hace» (asignar a estudiantes con fecha tope y modo, y el estado de cada uno). | Exámenes |
| `/examenes/[id]/[prueba]/[numero]` | **El taller** de una tarea: las páginas del libro al lado del formulario para rellenar la tarea, «Rellenar con IA», fotos de las opciones y, en la auditiva, la pista con su onda y las marcas arrastrables. | Exámenes |
| `/examenes/[id]/hoja/[personaId]/[prueba]` | La **ficha pregunta a pregunta** de lo que contestó un estudiante. | Exámenes / Estudiantes |
| `/corregir` | «Por corregir»: la cola de redacciones. | **Pendientes** |
| `/corregir/[intentoId]` | **Corregir una redacción** (ver el encargo). | Pendientes |
| `/pruebas/grabar`, `/pruebas/subir` | Pantallas de prueba técnica. **No van en el menú**; se quitarán. | — |
| Biblioteca | No existe. | **Biblioteca** |

## Lo que ya se decidió de pantallas y no se cambia

- En la lectura, ordenador a **dos columnas**: el texto con su propio
  desplazamiento y las preguntas al lado. En móvil, una **barra pegada abajo** con
  las preguntas, su enunciado y su desplegable.
- En las opciones con foto, las opciones van una al lado de otra y **la foto
  manda**.
- La pantalla de resultado enseña la nota grande, la nota de cada tarea, qué
  significa el rojo (sin decir la letra buena), si la entregó el reloj y qué
  prueba le queda.
- Al corregir, las casillas de las bandas **nacen vacías**. Guardar se niega
  mientras falte alguna, porque un 0 es una nota legítima.
- La suma de la escrita dice «18 de 24». Nunca «apto».
