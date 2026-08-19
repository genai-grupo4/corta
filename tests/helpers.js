const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { crearApp } = require('../src/app');
const { crearStorageArchivo } = require('../src/storage');

// Levanta una instancia de Corta aislada, con su propio archivo de datos
// temporal, en un puerto libre. Devuelve helpers para pegarle por HTTP.
async function levantarApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'corta-test-'));
  const archivo = path.join(dir, 'links.json');

  const storage = crearStorageArchivo({ archivo });
  await storage.init();

  const app = crearApp({ storage });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    archivo,
    storage,
    // fetch que NO sigue redirects: queremos inspeccionar el 302.
    fetch: (ruta, opciones = {}) =>
      fetch(base + ruta, { redirect: 'manual', ...opciones }),
    postLink: (body) =>
      fetch(base + '/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'manual'
      }),
    async cerrar() {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

module.exports = { levantarApp };
