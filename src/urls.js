const LARGO_MAXIMO = 2048;
const ESQUEMAS_PERMITIDOS = ['http:', 'https:'];

// Valida la url que manda el cliente. Devuelve { ok: true, url } o
// { ok: false, error } con el mensaje exacto que define SPEC.md.
function validarUrl(valor) {
  if (valor === undefined || valor === null) {
    return { ok: false, error: 'Falta la url' };
  }
  if (typeof valor !== 'string') {
    return { ok: false, error: 'La url debe ser un texto' };
  }

  const url = valor.trim();
  if (url === '') {
    return { ok: false, error: 'Falta la url' };
  }
  if (url.length > LARGO_MAXIMO) {
    return { ok: false, error: 'La url es demasiado larga' };
  }

  let parseada;
  try {
    parseada = new URL(url);
  } catch {
    return { ok: false, error: 'La url no es valida' };
  }

  // Sin esta restriccion el acortador serviria javascript: (XSS al redirigir)
  // o file:// (lectura de archivos locales del que hace click).
  if (!ESQUEMAS_PERMITIDOS.includes(parseada.protocol)) {
    return { ok: false, error: 'Solo se permiten urls http o https' };
  }

  return { ok: true, url };
}

module.exports = { validarUrl, LARGO_MAXIMO, ESQUEMAS_PERMITIDOS };
