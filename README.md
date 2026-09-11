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

```
npm test
```

Corre la suite de Vitest. No hace falta base de datos: las pruebas no tocan
Prisma ni Postgres.

## Variables de entorno

Copia `.env.example` a `.env` y rellena:

- `DATABASE_URL`: la conexión con pool (pgbouncer). La usa el cliente de
  Prisma en tiempo de ejecución (`lib/db.ts`).
- `DIRECT_URL`: la conexión directa, sin pool. La usa el CLI de migraciones
  de Prisma (`prisma.config.ts`).

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
generó en seco, sin conexión a ninguna base de datos, y **nunca se ha
aplicado contra una base de datos real**. Antes de confiar en ella hay que
probarla contra un Postgres de verdad.
