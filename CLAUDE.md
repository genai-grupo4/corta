# Contexto para quien siga el proyecto

Corta es un acortador de URLs interno. Este archivo es el traspaso: qué estado
tiene el proyecto, qué se decidió y por qué, y con qué trampas te vas a cruzar.

- Cómo arrancarlo y qué hace cada carpeta: [README.md](README.md)
- Qué tiene que hacer cada endpoint, con casos borde: [SPEC.md](SPEC.md)

**Si vas a cambiar comportamiento, SPEC.md se actualiza primero.** Es la fuente
de verdad y los tests están escritos contra él, no contra la implementación.

## Estado

Funciona y está testeado de punta a punta en local. **Falta el deploy.**

| Milestone | Estado |
|---|---|
| M1 Trackear desde el principio | Hecho |
| M2 Ordenar | Hecho |
| M3 Corregir errores | Hecho |
| M4 Completar funcionalidad | Hecho |
| M5 Producción | **Pendiente: falta deployar** |

## Lo que falta

1. **Deploy a Railway.** El código ya está listo: `railway.json` tiene el
   healthcheck y el server respeta `PORT`. Faltan los pasos del dashboard, que
   están al final del README. Lo importante: **hay que agregar el servicio
   Postgres y setear `DATABASE_URL`**. Sin eso corre con el archivo JSON y los
   links se borran en cada redeploy, porque el filesystem de Railway es efímero.
2. **Pushear la rama.** El trabajo está en `corta_ThiagoSerebrinsky`, sin
   pushear. El remoto es un repo compartido del equipo.
3. **Rotar la credencial.** Ver *Trampas* más abajo.

## Cómo trabajar acá

El flujo que se viene usando, y que conviene mantener:

1. Escribís o actualizás el caso en `SPEC.md`.
2. Escribís el test, **lo commiteás en rojo**.
3. Implementás hasta que pase.

El historial refleja eso: el commit `bfd91f6` mete los tests fallando y recién
`bad393b` los hace pasar. Es un requisito de la consigna, no una preferencia.

```bash
npm test    # 20 tests
TEST_DATABASE_URL="postgresql://usuario@localhost:5432/corta" npm test    # +7 de Postgres
```

Los 7 de Postgres **se saltan en silencio** si no pasás la variable. Es fácil
creer que corriste todo cuando en realidad no probaste el backend que va a
producción. Corrélos antes de deployar.

## Decisiones que ya se tomaron

**`crearApp` recibe el storage por parámetro y no llama a `listen`.** Por eso
los tests pueden levantar la app real en un puerto libre, con su propio archivo
temporal, sin tocar los datos de desarrollo ni pelearse por el puerto 3000. Si
volvés a acoplar el `listen` a la app, perdés eso.

**Hay dos backends de storage detrás de una misma interfaz** (`src/storage.js`):
archivo JSON para desarrollo, Postgres para producción. Los dos tienen que
cumplir el mismo SPEC — para eso está `tests/postgres.test.js`.

**Los códigos son de 7 caracteres y se generan con `randomInt`, no
`Math.random`.** Con 3 caracteres, la probabilidad de colisión pasaba el 50% con
apenas ~250 links. Y `Math.random` no es un CSPRNG: observando unos pocos
códigos se pueden predecir los siguientes.

**La unicidad del código en Postgres la garantiza la PRIMARY KEY**, no un
`SELECT` previo. Un "¿existe?" seguido de un "insertá" tiene una ventana de
carrera entre las dos consultas.

**`POST /api/links` sólo acepta `http` y `https`.** No es purismo: sin esa
restricción, el acortador sirve `javascript:` (XSS al hacer click) y `file://`
(lectura de archivos locales de quien clickea).

**El cliente sólo controla `url`.** El `codigo`, los `clicks` y la fecha los
pone el servidor, aunque vengan en el body.

## Trampas

**La contraseña de Postgres sigue en el historial de git.** Estaba hardcodeada
en `notas.txt`, que se borró en `7e3995c`. Borrar el archivo *no* la saca de los
commits anteriores: sigue en `59105da`. Si el repo es público, hay que rotarla
igual, aunque ese server ya no exista. Sacarla de verdad requiere reescribir el
historial, que en un repo compartido rompe las ramas de los demás.

**`node_modules` estaba versionado en el commit inicial** (2413 archivos). Se
destrackeó en `7e3995c` y se agregó al `.gitignore`. Por eso ese commit borra
~254.000 líneas: es casi todo dependencias, no código del proyecto. Si venís de
una rama vieja que todavía lo tiene versionado, el merge va a traer conflictos
molestos; conviene destrackearlo ahí también antes de mergear.

**`data/links.json` no se versiona.** Es estado de runtime. En un clon nuevo no
existe y se crea solo al arrancar, vacío.

**La ruta `/:codigo` va última en `src/app.js`, a propósito.** Si la subís antes
de los estáticos o de `/api/*`, un código corto puede tapar la home o la propia
API. Hay un test que cubre esto.

**`.oculto` usa `!important`.** No es descuido: compite con reglas como
`.stats { display: flex }` que tienen la misma especificidad y están declaradas
después, así que sin eso no oculta nada.

**El puerto 3000 suele estar ocupado** en la máquina de desarrollo. El server
respeta `PORT`, y `.claude/launch.json` tiene `autoPort` para que el preview
busque uno libre solo.
