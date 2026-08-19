const fs = require('node:fs/promises');
const path = require('node:path');

// Error comun a las dos implementaciones: lo usa app.js para reintentar con
// otro codigo cuando hay colision.
class CodigoDuplicado extends Error {
  constructor(codigo) {
    super(`El codigo "${codigo}" ya existe`);
    this.name = 'CodigoDuplicado';
    this.code = 'CODIGO_DUPLICADO';
  }
}

const copiar = (link) => (link ? { ...link } : null);

/**
 * Store en archivo JSON. Default en desarrollo.
 *
 * Mantiene los links en memoria y escribe el archivo completo en cada cambio.
 * Alcanza de sobra para el volumen de una herramienta interna y evita depender
 * de una base para levantar el proyecto.
 */
function crearStorageArchivo({ archivo }) {
  let links = [];
  let porCodigo = new Map();

  // Serializa las escrituras: dos requests simultaneos no pueden pisarse.
  let cola = Promise.resolve();
  function enCola(tarea) {
    const resultado = cola.then(tarea);
    cola = resultado.then(
      () => {},
      () => {}
    );
    return resultado;
  }

  // Escritura atomica: si el proceso muere a mitad del write, el archivo
  // original queda intacto porque rename() es atomico dentro del mismo FS.
  async function persistir() {
    const temporal = `${archivo}.tmp`;
    await fs.writeFile(temporal, JSON.stringify(links, null, 2), 'utf8');
    await fs.rename(temporal, archivo);
  }

  return {
    async init() {
      await fs.mkdir(path.dirname(archivo), { recursive: true });
      try {
        const crudo = await fs.readFile(archivo, 'utf8');
        links = JSON.parse(crudo);
        if (!Array.isArray(links)) throw new Error('El archivo de datos no es una lista');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        links = [];
        await persistir();
      }
      porCodigo = new Map(links.map((link) => [link.codigo, link]));
    },

    async buscarPorCodigo(codigo) {
      return copiar(porCodigo.get(codigo));
    },

    async crear(link) {
      return enCola(async () => {
        if (porCodigo.has(link.codigo)) throw new CodigoDuplicado(link.codigo);
        links.push(link);
        porCodigo.set(link.codigo, link);
        await persistir();
        return copiar(link);
      });
    },

    async incrementarClicks(codigo) {
      return enCola(async () => {
        const link = porCodigo.get(codigo);
        if (!link) return null;
        link.clicks += 1;
        await persistir();
        return copiar(link);
      });
    },

    async cerrar() {}
  };
}

/**
 * Store en PostgreSQL. Es lo que se usa en produccion (Railway), porque el
 * filesystem de los contenedores es efimero y se pierde en cada redeploy.
 *
 * La unicidad del codigo la garantiza la PRIMARY KEY, no un chequeo previo:
 * asi no hay ventana de carrera entre "consultar si existe" e "insertar".
 */
function crearStoragePostgres({ connectionString }) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS links (
          codigo TEXT PRIMARY KEY,
          url    TEXT NOT NULL,
          clicks INTEGER NOT NULL DEFAULT 0,
          creado TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },

    async buscarPorCodigo(codigo) {
      const { rows } = await pool.query(
        'SELECT codigo, url, clicks, creado FROM links WHERE codigo = $1',
        [codigo]
      );
      return rows.length ? aLink(rows[0]) : null;
    },

    async crear(link) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO links (codigo, url, clicks, creado)
           VALUES ($1, $2, $3, $4)
           RETURNING codigo, url, clicks, creado`,
          [link.codigo, link.url, link.clicks, link.creado]
        );
        return aLink(rows[0]);
      } catch (error) {
        // 23505 = unique_violation
        if (error.code === '23505') throw new CodigoDuplicado(link.codigo);
        throw error;
      }
    },

    async incrementarClicks(codigo) {
      // Un solo UPDATE atomico: dos clicks simultaneos no se pisan.
      const { rows } = await pool.query(
        `UPDATE links SET clicks = clicks + 1
         WHERE codigo = $1
         RETURNING codigo, url, clicks, creado`,
        [codigo]
      );
      return rows.length ? aLink(rows[0]) : null;
    },

    async cerrar() {
      await pool.end();
    }
  };
}

function aLink(fila) {
  return {
    codigo: fila.codigo,
    url: fila.url,
    clicks: Number(fila.clicks),
    creado: new Date(fila.creado).toISOString()
  };
}

// Elige la implementacion segun el entorno.
function crearStorage(env = process.env) {
  if (env.DATABASE_URL) {
    return crearStoragePostgres({ connectionString: env.DATABASE_URL });
  }
  const archivo = env.DATA_FILE
    ? path.resolve(env.DATA_FILE)
    : path.join(__dirname, '..', 'data', 'links.json');
  return crearStorageArchivo({ archivo });
}

module.exports = {
  crearStorage,
  crearStorageArchivo,
  crearStoragePostgres,
  CodigoDuplicado
};
