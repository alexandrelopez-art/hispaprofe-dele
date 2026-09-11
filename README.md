# hispaprofe-dele

Cimientos de una plataforma de preparación al examen DELE A2/B1 escolar:
esqueleto de Next.js, modelo de datos de Prisma, las reglas de estructura del
examen y la guarda que impide publicar un examen mal cargado. Repositorio
nuevo, decidido el 9 de septiembre de 2026. El anterior sigue en
`~/Projects/hispaprofe` y no se toca. Es para uso interno del equipo, no un
producto terminado.

## Instalación

Requiere Node 24.15 (declarado en `.nvmrc` y en `engines` de `package.json`)
y npm 11.12.

```
nvm use
npm install
```

## Pruebas

Hay dos formas de correr las pruebas, y no tocan la base las mismas cosas:

```
npm test
```

Corre `tests/**/*.test.ts` (salvo `tests/base/`) con Vitest. No hace falta
base de datos: son pruebas de lógica pura y de rutas con Prisma, el almacén
de Vercel, Drive y la sesión HTTP doblados (mocks) — comprueban qué le
llega a cada dependencia, no una base real.

```
npm run test:base
```

Corre `scripts/postgres-de-pruebas.sh`, que levanta un Postgres de
usar-y-tirar (necesita `postgresql@17`: `brew install postgresql@17`),
le aplica las migraciones, corre `tests/base/**/*.test.ts` contra él de
verdad, y al terminar lo para y borra. Estas SÍ tocan la base: la puerta de
entrada (pedir y usar un enlace, la sesión, el frenado), las personas y los
cimientos del modelo se prueban contra Postgres real, no contra dobles.

## Variables de entorno

Copia `.env.example` a `.env` y rellena. `DATABASE_URL` y `DIRECT_URL`
vienen de los cimientos; las otras siete las trajo esta entrega (la puerta
de entrada y los dos almacenes de ficheros):

- `DATABASE_URL`: la conexión con pool (pgbouncer). La usa el cliente de
  Prisma en tiempo de ejecución (`lib/db.ts`).
- `DIRECT_URL`: la conexión directa, sin pool. La usa el CLI de migraciones
  de Prisma (`prisma.config.ts`).
- `CORREO_USUARIO`, `CORREO_CONTRASENA`, `CORREO_REMITENTE`: la cuenta SMTP
  de Gmail que manda los enlaces de entrada (`lib/correo/transporte.ts`).
- `SITIO_URL`: la dirección del sitio para componer el enlace de entrada.
  Obligatoria en producción — sin ella no se compone ningún enlace, porque
  la cabecera `host` de la petición no es de fiar (`lib/puerta/sitio.ts`).
- `BLOB_READ_WRITE_TOKEN`: el almacén privado de Vercel Blob, para el
  material del examen (páginas escaneadas y audios). En Vercel llega solo;
  en local se baja con `vercel env pull`.
- `GOOGLE_CUENTA_DE_SERVICIO`, `DRIVE_CARPETA_GRABACIONES`: la cuenta robot
  y la unidad compartida de Drive donde suben las grabaciones de los
  estudiantes, aparte del almacén de arriba porque son de menores
  (`lib/ficheros/drive.ts`).

El detalle de cada una, incluidos los riesgos concretos de dejarla mal
puesta, está comentado en `.env.example`.

## El primer profesor

La base empieza vacía y la pantalla de personas (`/personas`) exige ser
profesor para entrar (`exigirProfesor`): sin nadie con ese papel, no hay
forma de dar de alta a nadie más. Para crear (o recuperar) al primer
profesor:

```
npx tsx scripts/primer-profesor.ts <correo> <nombre>
```

Por ejemplo:

```
npx tsx scripts/primer-profesor.ts pablo@hispaprofe.com "Pablo"
```

Si ese correo ya existe, se actualiza su papel a PROFESOR (y se reactiva si
estaba dado de baja); si no existe, se crea. Hace falta `DATABASE_URL`
puesta (mira `.env.example`); si falta, el script lo avisa y no hace nada.
A partir de ahí, esa persona da de alta a las demás desde `/personas`.

## Aviso sobre las migraciones

La migración inicial (`prisma/migrations/20260909000000_cimientos`) se
generó en seco, sin conexión a ninguna base de datos. Desde entonces sí se
aplica contra Postgres real: `scripts/postgres-de-pruebas.sh` la aplica —
junto con todas las demás — cada vez que corre `npm run test:base`, contra
un Postgres de usar-y-tirar, y también se ha aplicado al construir. Lo que
sigue sin hacerse es aplicarla contra la base de datos de producción.
