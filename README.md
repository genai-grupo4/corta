# Corta

Acortador de URLs interno. Pegás una URL larga, te devuelve un link corto, y
podés ver cuántos clicks recibió.

> **¿Recién llegás al proyecto?** Leé [CLAUDE.md](CLAUDE.md) primero: tiene el
> estado actual, lo que falta, las decisiones ya tomadas y las trampas conocidas.

## Arrancar en local

```bash
npm install
npm start
```

Queda en http://localhost:3000. No necesita base de datos: por defecto guarda
todo en `data/links.json`, que se crea solo.

## Tests

```bash
npm test
```

Usa el runner nativo de Node (`node --test`), sin dependencias de testing.
Cada test levanta la app en un puerto libre con su propio archivo de datos
temporal, así que corren aislados y en cualquier orden.

Los tests del backend de Postgres se saltan salvo que le pases una base:

```bash
TEST_DATABASE_URL="postgresql://usuario@localhost:5432/corta" npm test
```

Vale la pena correrlos antes de deployar: son los que verifican que la
implementación que se usa en producción cumple el mismo SPEC que la de
desarrollo.

## Cómo está armado

```
server.js          Punto de entrada: arma el storage, levanta el HTTP server
src/
  app.js           Rutas y middlewares de Express (exporta crearApp)
  storage.js       Persistencia detrás de una interfaz: archivo JSON o Postgres
  codigos.js       Generación y validación de códigos cortos
  urls.js          Validación de las URLs que manda el cliente
public/            Frontend estático (sin build ni frameworks)
tests/             Tests de integración vía HTTP
SPEC.md            Comportamiento esperado de cada endpoint
```

`crearApp` recibe el storage por parámetro y no llama a `listen`. Eso es lo que
permite testear la app real por HTTP sin ocupar un puerto fijo ni tocar los
datos de desarrollo.

## API

| Método | Ruta                          | Qué hace                                  |
|--------|-------------------------------|-------------------------------------------|
| `POST` | `/api/links`                  | Crea un link corto a partir de `{ url }`  |
| `GET`  | `/:codigo`                    | Redirige (302) y suma un click            |
| `GET`  | `/api/links/:codigo/stats`    | Clicks, URL original y fecha de creación  |
| `GET`  | `/api/health`                 | Healthcheck                               |

El detalle completo, con validaciones y casos borde, está en [SPEC.md](SPEC.md).

```bash
curl -X POST http://localhost:3000/api/links \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.austral.edu.ar/ingenieria/"}'
```

## Configuración

| Variable       | Default           | Descripción                             |
|----------------|-------------------|-----------------------------------------|
| `PORT`         | `3000`            | Puerto HTTP                             |
| `DATA_FILE`    | `data/links.json` | Ruta del store JSON                     |
| `DATABASE_URL` | *(vacío)*         | Si está definida, usa PostgreSQL        |

## Deploy en Railway

El filesystem de Railway es efímero: se borra en cada redeploy. Por eso en
producción hay que usar Postgres, no el archivo JSON.

1. Crear el proyecto apuntando a este repo.
2. Agregar un servicio **PostgreSQL** desde el dashboard.
3. En el servicio de la app, referenciar la variable del Postgres:
   `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.
4. Railway inyecta `PORT` solo y ejecuta `npm start`. La tabla `links` se crea
   sola al arrancar.

Con eso los links y sus clicks sobreviven a los redeploys.
