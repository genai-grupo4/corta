# SPEC — Corta

Especificación del comportamiento esperado de Corta, un acortador de URLs interno.
Este documento es la fuente de verdad: los tests de `tests/` verifican lo que está acá.

## Modelo de datos

Un **link** es un objeto con esta forma:

| Campo    | Tipo   | Descripción                                          |
|----------|--------|------------------------------------------------------|
| `codigo` | string | Identificador corto y único. Ver *Generación de códigos*. |
| `url`    | string | URL de destino, absoluta y con esquema `http`/`https`. |
| `clicks` | number | Cantidad de redirecciones servidas. Arranca en `0`.   |
| `creado` | string | Fecha de creación en ISO 8601 UTC.                    |

### Generación de códigos

- Alfabeto: `abcdefghijklmnopqrstuvwxyz0123456789` (36 caracteres, minúsculas).
- Longitud: **7 caracteres** (`36^7` ≈ 78 mil millones de combinaciones).
- Los códigos son **únicos**. Al crear un link se reintenta la generación hasta
  encontrar uno libre, con un máximo de 10 intentos.
- Si tras 10 intentos no se consigue un código libre, se responde `503`.

> El código original usaba 3 caracteres (46.656 combinaciones), donde la
> probabilidad de colisión supera el 50% con apenas ~250 links (paradoja del
> cumpleaños). Además no verificaba unicidad, así que un código repetido
> pisaba silenciosamente el destino anterior.

### Códigos reservados

No se pueden generar ni usar como código: `api`, `stats`, `index`, `public`,
`favicon.ico`, `robots.txt`. Evita que un código tape una ruta real del server.

## Endpoints

### `POST /api/links` — crear un link corto

**Request**

```json
{ "url": "https://ejemplo.com/una/ruta/muy/larga" }
```

**Respuesta `201 Created`**

```json
{
  "codigo": "a3kf9zq",
  "corta": "/a3kf9zq",
  "url": "https://ejemplo.com/una/ruta/muy/larga",
  "clicks": 0,
  "creado": "2026-08-19T14:11:09.000Z"
}
```

**Validaciones** — todas responden `400` con `{ "error": "<mensaje>" }`:

| Caso                                        | Mensaje                                     |
|---------------------------------------------|---------------------------------------------|
| Falta `url` o es `""`                       | `Falta la url`                              |
| `url` no es string                          | `La url debe ser un texto`                  |
| `url` no parsea como URL absoluta           | `La url no es valida`                       |
| Esquema distinto de `http`/`https`          | `Solo se permiten urls http o https`        |
| `url` de más de 2048 caracteres             | `La url es demasiado larga`                 |

Rechazar esquemas como `javascript:`, `data:` o `file:` es deliberado: sin eso,
el acortador se vuelve un vector de XSS y de acceso a archivos locales.

**Notas**

- Dos requests con la misma `url` generan **dos links distintos**. No se
  deduplica: cada uno lleva sus propias estadísticas.
- Se ignora cualquier campo del body que no sea `url`. En particular, el cliente
  **no** puede elegir el `codigo`, ni sembrar `clicks` o `creado`.

### `GET /:codigo` — redirigir al destino

- Si el código existe: incrementa `clicks` en **1**, **persiste el cambio**, y
  responde `302 Found` con el header `Location` apuntando a la `url` original.
- Si no existe: responde `404` con un cuerpo de texto `No existe ese link`.
- El incremento ocurre una sola vez por request y debe sobrevivir a un reinicio
  del servidor.

> En la versión original esta ruta hacía `res.send(link.url)`, o sea devolvía la
> URL como texto plano en lugar de redirigir, y sumaba el click sólo en memoria
> sin volver a escribir el almacenamiento: el contador siempre volvía a cero.

### `GET /api/links/:codigo/stats` — estadísticas de un link

**Respuesta `200 OK`**

```json
{
  "codigo": "a3kf9zq",
  "url": "https://ejemplo.com/una/ruta/muy/larga",
  "clicks": 42,
  "creado": "2026-08-19T14:11:09.000Z"
}
```

- Si el código no existe: `404` con `{ "error": "No existe ese link" }`.
- Consultar las stats **no** incrementa `clicks`.

### `GET /api/health` — healthcheck

Responde `200` con `{ "ok": true }`. Lo usa Railway para saber si el servicio
está vivo.

## Reglas transversales

- **Orden de rutas**: los archivos estáticos y las rutas `/api/*` se resuelven
  antes que `/:codigo`, para que un código nunca tape la app.
- **Códigos con formato inválido** (largo distinto al esperado o caracteres
  fuera del alfabeto) se tratan como inexistentes: `404`, sin tocar el
  almacenamiento.
- **Errores no controlados**: `500` con `{ "error": "Error interno" }`. Nunca se
  filtra el stack trace al cliente.
- **Concurrencia**: las escrituras al almacenamiento se serializan para que dos
  requests simultáneos no se pisen entre sí.

## Persistencia

El almacenamiento está detrás de una interfaz (`src/storage.js`) con dos
implementaciones:

- **Archivo JSON** (por defecto en desarrollo). Ruta configurable con
  `DATA_FILE`, default `data/links.json`. Las escrituras son atómicas
  (se escribe a un archivo temporal y se renombra) para no corromper los datos
  si el proceso muere a mitad de camino.
- **PostgreSQL** (producción). Se activa cuando existe la variable de entorno
  `DATABASE_URL`. Es lo que permite que los datos sobrevivan a los redeploys,
  ya que el filesystem de Railway es efímero.

Ambas implementaciones exponen la misma interfaz y deben cumplir este SPEC por igual.

## Configuración

| Variable       | Default            | Descripción                                  |
|----------------|--------------------|----------------------------------------------|
| `PORT`         | `3000`             | Puerto HTTP. Railway lo inyecta.             |
| `DATA_FILE`    | `data/links.json`  | Ruta del store JSON.                          |
| `DATABASE_URL` | *(vacío)*          | Si está definida, se usa PostgreSQL.          |
