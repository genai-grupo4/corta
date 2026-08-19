const test = require('node:test');
const assert = require('node:assert/strict');

const { levantarApp } = require('./helpers');

test('GET /api/links/:codigo/stats devuelve clicks, url y fecha', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const destino = 'https://ejemplo.com/medido';
  const creado = await (await app.postLink({ url: destino })).json();

  await app.fetch('/' + creado.codigo);

  const res = await app.fetch(`/api/links/${creado.codigo}/stats`);
  assert.equal(res.status, 200);

  assert.deepEqual(await res.json(), {
    codigo: creado.codigo,
    url: destino,
    clicks: 1,
    creado: creado.creado
  });
});

test('consultar stats no incrementa los clicks', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const { codigo } = await (await app.postLink({ url: 'https://ejemplo.com' })).json();

  await app.fetch(`/api/links/${codigo}/stats`);
  await app.fetch(`/api/links/${codigo}/stats`);

  const stats = await (await app.fetch(`/api/links/${codigo}/stats`)).json();
  assert.equal(stats.clicks, 0);
});

test('GET /api/links/:codigo/stats de un codigo inexistente responde 404', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const res = await app.fetch('/api/links/noexiste/stats');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'No existe ese link' });
});
