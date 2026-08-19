const { randomInt } = require('node:crypto');

const CARACTERES = 'abcdefghijklmnopqrstuvwxyz0123456789';
const LARGO = 7;

// Palabras que nunca deben funcionar como codigo, para que un link corto no
// termine tapando una ruta real de la app.
const RESERVADOS = Object.freeze([
  'api',
  'stats',
  'index',
  'public',
  'favicon.ico',
  'robots.txt'
]);

const FORMATO = new RegExp(`^[a-z0-9]{${LARGO}}$`);

// Genera un codigo corto. Usa randomInt (CSPRNG, sin sesgo de modulo) en lugar
// de Math.random: los codigos son adivinables de otra forma, y con Math.random
// alcanza con observar unos pocos para predecir el resto.
function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < LARGO; i++) {
    codigo += CARACTERES[randomInt(CARACTERES.length)];
  }
  return codigo;
}

function esCodigoValido(codigo) {
  if (typeof codigo !== 'string') return false;
  if (RESERVADOS.includes(codigo)) return false;
  return FORMATO.test(codigo);
}

module.exports = { generarCodigo, esCodigoValido, CARACTERES, LARGO, RESERVADOS };
