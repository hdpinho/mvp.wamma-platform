import assert from 'node:assert/strict';
import { test } from 'node:test';
import { metodoDe } from './metodoHttp.ts';

test('sin cuerpo y sin método, GET', () => {
  assert.equal(metodoDe({}), 'GET');
});

test('con cuerpo JSON y sin método, POST (antes salía un GET con cuerpo y no llegaba nada)', () => {
  assert.equal(metodoDe({ cuerpo: { a: 1 } }), 'POST');
});

test('con formulario y sin método, POST', () => {
  assert.equal(metodoDe({ formulario: new FormData() }), 'POST');
});

test('un cuerpo vacío también es un cuerpo', () => {
  assert.equal(metodoDe({ cuerpo: {} }), 'POST');
});

test('el método explícito manda y se normaliza a mayúsculas', () => {
  assert.equal(metodoDe({ method: 'patch', cuerpo: {} }), 'PATCH');
  assert.equal(metodoDe({ method: 'PUT', cuerpo: { a: 1 } }), 'PUT');
  assert.equal(metodoDe({ method: 'delete' }), 'DELETE');
});

test('GET o HEAD con cuerpo es un error de programación, no un fallo silencioso', () => {
  assert.throws(() => metodoDe({ method: 'GET', cuerpo: { a: 1 } }), /no admite cuerpo/);
  assert.throws(() => metodoDe({ method: 'head', formulario: new FormData() }), /no admite cuerpo/);
});
