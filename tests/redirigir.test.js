const test = require('node:test');
const assert = require('node:assert/strict');

const { levantarApp } = require('./helpers');
const { crearStorageArchivo } = require('../src/storage');

test('GET /:codigo redirige al destino con 302', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const destino = 'https://ejemplo.com/destino/final';
  const { codigo } = await (await app.postLink({ url: destino })).json();

  const res = await app.fetch('/' + codigo);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), destino);
});

test('GET /:codigo incrementa los clicks de a uno', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const { codigo } = await (await app.postLink({ url: 'https://ejemplo.com' })).json();

  for (let i = 0; i < 3; i++) await app.fetch('/' + codigo);

  const stats = await (await app.fetch(`/api/links/${codigo}/stats`)).json();
  assert.equal(stats.clicks, 3);
});

test('los clicks sobreviven a un reinicio del servidor', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const { codigo } = await (await app.postLink({ url: 'https://ejemplo.com' })).json();
  await app.fetch('/' + codigo);
  await app.fetch('/' + codigo);

  // Nueva instancia de storage sobre el mismo archivo: simula un reinicio.
  const otro = crearStorageArchivo({ archivo: app.archivo });
  await otro.init();
  const link = await otro.buscarPorCodigo(codigo);

  assert.equal(link.clicks, 2);
});

test('GET /:codigo inexistente responde 404', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const res = await app.fetch('/noexiste');
  assert.equal(res.status, 404);
});

test('GET /:codigo con formato invalido responde 404', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  for (const codigo of ['ab', 'CON-MAYUS', 'demasiado-largo-para-ser-codigo', 'a_b!c']) {
    const res = await app.fetch('/' + encodeURIComponent(codigo));
    assert.equal(res.status, 404, `esperaba 404 para "${codigo}"`);
  }
});

test('las rutas de la app no quedan tapadas por la ruta de codigos', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const home = await app.fetch('/');
  assert.equal(home.status, 200);

  const estaticos = await app.fetch('/stats.html');
  assert.equal(estaticos.status, 200);

  const health = await app.fetch('/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });
});
