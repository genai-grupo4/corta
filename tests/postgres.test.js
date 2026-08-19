const test = require('node:test');
const assert = require('node:assert/strict');

const { crearApp } = require('../src/app');
const { crearStoragePostgres } = require('../src/storage');

// El backend de Postgres solo se prueba si hay una base a mano. En local se
// levanta una temporal; en CI se puede apuntar TEST_DATABASE_URL a un servicio.
// Sin la variable, los tests se saltan en vez de fallar.
const connectionString = process.env.TEST_DATABASE_URL;

test('storage de Postgres', { skip: !connectionString && 'falta TEST_DATABASE_URL' }, async (t) => {
  const storage = crearStoragePostgres({ connectionString });
  await storage.init();

  // Base limpia en cada corrida.
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString });
  await pool.query('TRUNCATE links');
  await pool.end();

  const app = crearApp({ storage });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await storage.cerrar();
  });

  const pedir = (ruta, opciones = {}) =>
    fetch(base + ruta, { redirect: 'manual', ...opciones });

  const crear = (url) =>
    pedir('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

  await t.test('crea un link', async () => {
    const res = await crear('https://ejemplo.com/pg');
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.codigo, /^[a-z0-9]{7}$/);
    assert.equal(body.clicks, 0);
    assert.equal(body.url, 'https://ejemplo.com/pg');
  });

  await t.test('redirige con 302 y persiste los clicks', async () => {
    const { codigo } = await (await crear('https://ejemplo.com/destino')).json();

    const redirect = await pedir('/' + codigo);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), 'https://ejemplo.com/destino');

    await pedir('/' + codigo);

    // Lectura directa contra la base: confirma que se escribio de verdad.
    const link = await storage.buscarPorCodigo(codigo);
    assert.equal(link.clicks, 2);
  });

  await t.test('devuelve stats sin incrementar clicks', async () => {
    const creado = await (await crear('https://ejemplo.com/stats')).json();
    await pedir('/' + creado.codigo);

    const res = await pedir(`/api/links/${creado.codigo}/stats`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      codigo: creado.codigo,
      url: 'https://ejemplo.com/stats',
      clicks: 1,
      creado: creado.creado
    });

    const otra = await (await pedir(`/api/links/${creado.codigo}/stats`)).json();
    assert.equal(otra.clicks, 1);
  });

  await t.test('la PRIMARY KEY rechaza codigos duplicados', async () => {
    const link = {
      codigo: 'dup1234',
      url: 'https://ejemplo.com',
      clicks: 0,
      creado: new Date().toISOString()
    };
    await storage.crear(link);
    await assert.rejects(() => storage.crear(link), { code: 'CODIGO_DUPLICADO' });
  });

  await t.test('404 para codigos inexistentes', async () => {
    assert.equal((await pedir('/nohaynd')).status, 404);
    assert.equal((await pedir('/api/links/nohaynd/stats')).status, 404);
  });

  await t.test('los clicks concurrentes no se pisan', async () => {
    const { codigo } = await (await crear('https://ejemplo.com/carrera')).json();

    // 20 redirects en paralelo: con un UPDATE ... clicks + 1 atomico tienen
    // que contarse los 20.
    await Promise.all(Array.from({ length: 20 }, () => pedir('/' + codigo)));

    const link = await storage.buscarPorCodigo(codigo);
    assert.equal(link.clicks, 20);
  });
});
