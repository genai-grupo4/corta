const path = require('node:path');
const express = require('express');

const { generarCodigo, esCodigoValido } = require('./codigos');
const { validarUrl } = require('./urls');

// Cuantas veces reintentamos generar un codigo libre antes de rendirnos.
const MAX_INTENTOS = 10;

function crearApp({ storage }) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // Crear un link corto.
  app.post('/api/links', async (req, res, next) => {
    try {
      const validacion = validarUrl(req.body?.url);
      if (!validacion.ok) {
        return res.status(400).json({ error: validacion.error });
      }

      // El cliente solo controla la url: codigo, clicks y creado los pone
      // el servidor.
      for (let intento = 0; intento < MAX_INTENTOS; intento++) {
        const codigo = generarCodigo();
        try {
          const link = await storage.crear({
            codigo,
            url: validacion.url,
            clicks: 0,
            creado: new Date().toISOString()
          });
          return res.status(201).json({ ...link, corta: `/${link.codigo}` });
        } catch (error) {
          if (error.code === 'CODIGO_DUPLICADO') continue;
          throw error;
        }
      }

      res.status(503).json({ error: 'No se pudo generar un codigo libre, intenta de nuevo' });
    } catch (error) {
      next(error);
    }
  });

  // Estadisticas de un link. Sólo lectura: no toca el contador.
  app.get('/api/links/:codigo/stats', async (req, res, next) => {
    try {
      const { codigo } = req.params;
      if (!esCodigoValido(codigo)) {
        return res.status(404).json({ error: 'No existe ese link' });
      }

      const link = await storage.buscarPorCodigo(codigo);
      if (!link) {
        return res.status(404).json({ error: 'No existe ese link' });
      }

      res.json({
        codigo: link.codigo,
        url: link.url,
        clicks: link.clicks,
        creado: link.creado
      });
    } catch (error) {
      next(error);
    }
  });

  // Redirigir al destino. Va última: cualquier ruta real de la app tiene
  // prioridad sobre un codigo.
  app.get('/:codigo', async (req, res, next) => {
    try {
      const { codigo } = req.params;
      if (!esCodigoValido(codigo)) {
        return res.status(404).send('No existe ese link');
      }

      // Incrementa y persiste en un solo paso, y de paso nos devuelve el link:
      // si no existe, devuelve null y no escribimos nada.
      const link = await storage.incrementarClicks(codigo);
      if (!link) {
        return res.status(404).send('No existe ese link');
      }

      res.redirect(302, link.url);
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    res.status(404).send('No existe ese link');
  });

  // eslint-disable-next-line no-unused-vars -- Express identifica el handler de
  // errores por su aridad de 4 argumentos.
  app.use((error, req, res, next) => {
    // JSON malformado en el body: es culpa del cliente, no del servidor.
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El body no es JSON valido' });
    }
    console.error('Error no controlado:', error);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}

module.exports = { crearApp };
