import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrato } from '../pruebas/contrato.ts';
import { PARAMETROS_APROBADOS } from './financiamientoMotor.ts';
import { parametrosDesdeApi, type ParametrosDb } from './parametrosServidor.ts';

test('la política del servidor se convierte al modelo del motor de cálculo', () => {
  const p = parametrosDesdeApi(contrato<ParametrosDb>('parametros-financiamiento'));
  assert.equal(p.tasaMensual, PARAMETROS_APROBADOS.tasaMensual);
  assert.equal(p.plazoMeses, PARAMETROS_APROBADOS.plazoMeses);
  assert.equal(p.ratioCuotaIngreso, PARAMETROS_APROBADOS.ratioCuotaIngreso);
  assert.deepEqual(p.opcionesInicial, PARAMETROS_APROBADOS.opcionesInicial);
  assert.equal(p.inicialMinima, PARAMETROS_APROBADOS.inicialMinima);
  assert.equal(p.monedaBase, 'EUR');
  assert.equal(p.activo, true);
});

test('una política incompleta es un error: nunca se completa con ceros', () => {
  const base = contrato<ParametrosDb>('parametros-financiamiento');
  assert.throws(() => parametrosDesdeApi({ ...base, tasa_mensual: 0 }), /incompletos/);
  assert.throws(() => parametrosDesdeApi({ ...base, plazo_meses: 0 }), /incompletos/);
  assert.throws(() => parametrosDesdeApi({ ...base, opciones_inicial: [] }), /incompletos/);
  assert.throws(() => parametrosDesdeApi({ ...base, opciones_inicial: [1.2] }), /incompletos/);
  assert.throws(() => parametrosDesdeApi({ ...base, ratio_cuota_ingreso: Number.NaN }), /incompletos/);
  assert.throws(
    () => parametrosDesdeApi({ ...base, inicial_minima: undefined as unknown as number }),
    /incompletos/,
  );
});
