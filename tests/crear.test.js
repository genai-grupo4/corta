const test = require('node:test');
const assert = require('node:assert/strict');

const { levantarApp } = require('./helpers');

test('POST /api/links crea un link corto', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const res = await app.postLink({ url: 'https://ejemplo.com/una/ruta/larga' });
  assert.equal(res.status, 201);

  const body = await res.json();
  assert.equal(body.url, 'https://ejemplo.com/una/ruta/larga');
  assert.equal(body.clicks, 0);
  assert.equal(body.corta, '/' + body.codigo);
  assert.match(body.codigo, /^[a-z0-9]{7}$/);
  assert.equal(new Date(body.creado).toISOString(), body.creado);
});

test('POST /api/links genera codigos unicos', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const codigos = new Set();
  for (let i = 0; i < 50; i++) {
    const res = await app.postLink({ url: `https://ejemplo.com/${i}` });
    const { codigo } = await res.json();
    assert.equal(codigos.has(codigo), false, `codigo repetido: ${codigo}`);
    codigos.add(codigo);
  }
  assert.equal(codigos.size, 50);
});

test('POST /api/links no deduplica: la misma url da dos codigos distintos', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const uno = await (await app.postLink({ url: 'https://ejemplo.com' })).json();
  const dos = await (await app.postLink({ url: 'https://ejemplo.com' })).json();

  assert.notEqual(uno.codigo, dos.codigo);
});

test('POST /api/links ignora campos que el cliente no controla', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const res = await app.postLink({
    url: 'https://ejemplo.com',
    codigo: 'elegido',
    clicks: 9999,
    creado: '1999-01-01T00:00:00.000Z'
  });
  const body = await res.json();

  assert.notEqual(body.codigo, 'elegido');
  assert.equal(body.clicks, 0);
  assert.notEqual(body.creado, '1999-01-01T00:00:00.000Z');
});

test('POST /api/links valida la url', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  const casos = [
    { body: {}, error: 'Falta la url' },
    { body: { url: '' }, error: 'Falta la url' },
    { body: { url: 42 }, error: 'La url debe ser un texto' },
    { body: { url: 'no-es-una-url' }, error: 'La url no es valida' },
    { body: { url: 'javascript:alert(1)' }, error: 'Solo se permiten urls http o https' },
    { body: { url: 'file:///etc/passwd' }, error: 'Solo se permiten urls http o https' },
    { body: { url: 'data:text/html,<script>' }, error: 'Solo se permiten urls http o https' },
    { body: { url: 'https://ejemplo.com/' + 'a'.repeat(2048) }, error: 'La url es demasiado larga' }
  ];

  for (const caso of casos) {
    const res = await app.postLink(caso.body);
    assert.equal(res.status, 400, `esperaba 400 para ${JSON.stringify(caso.body).slice(0, 60)}`);
    assert.equal((await res.json()).error, caso.error);
  }
});

test('POST /api/links acepta http y https', async (t) => {
  const app = await levantarApp();
  t.after(() => app.cerrar());

  for (const url of ['http://interno.local/algo', 'https://ejemplo.com']) {
    const res = await app.postLink({ url });
    assert.equal(res.status, 201, `deberia aceptar ${url}`);
  }
});
