const test = require('node:test');
const assert = require('node:assert/strict');

const { generarCodigo, esCodigoValido, RESERVADOS } = require('../src/codigos');

test('generarCodigo devuelve 7 caracteres del alfabeto permitido', () => {
  for (let i = 0; i < 500; i++) {
    assert.match(generarCodigo(), /^[a-z0-9]{7}$/);
  }
});

test('generarCodigo no repite en un volumen razonable', () => {
  const vistos = new Set();
  for (let i = 0; i < 5000; i++) vistos.add(generarCodigo());
  assert.equal(vistos.size, 5000);
});

test('esCodigoValido acepta codigos bien formados', () => {
  assert.equal(esCodigoValido('a3kf9zq'), true);
  assert.equal(esCodigoValido('0000000'), true);
});

test('esCodigoValido rechaza formatos invalidos', () => {
  const invalidos = ['', 'ab', 'a3kf9zqx', 'A3KF9ZQ', 'a3kf9z!', 'a3kf9z q', null, undefined, 42];
  for (const codigo of invalidos) {
    assert.equal(esCodigoValido(codigo), false, `deberia rechazar ${JSON.stringify(codigo)}`);
  }
});

test('esCodigoValido rechaza los codigos reservados', () => {
  for (const reservado of RESERVADOS) {
    assert.equal(esCodigoValido(reservado), false, `deberia rechazar "${reservado}"`);
  }
});
