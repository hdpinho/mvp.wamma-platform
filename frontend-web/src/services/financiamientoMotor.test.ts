import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFactor,
  calcularCuota,
  calcularCuotaMaxima,
  calcularPrecioMaximo,
  calcularIngresoMinimo,
  simularOpciones,
  formatoUSD,
  formatoVES,
  PARAMETROS_APROBADOS,
} from './financiamientoMotor.ts';

const TOLERANCIA = 0.01;

function assertAproximado(actual: number, esperado: number, mensaje: string) {
  const diff = Math.abs(actual - esperado);
  assert.ok(
    diff <= TOLERANCIA,
    `${mensaje}: esperado ${esperado} ± ${TOLERANCIA}, recibido ${actual} (diff: ${diff})`,
  );
}

test('1. Factor francés para i=0.04 y n=24', () => {
  const factor = calcularFactor(0.04, 24);
  assertAproximado(factor, 0.0655868313, 'Factor francés');
});

test('2. Cuota con 20% de inicial para precio $15,400', () => {
  const cuota = calcularCuota(15400, 0.20);
  assertAproximado(cuota, 808.03, 'Cuota 20%');
  assert.equal(formatoUSD(cuota), '$808');
});

test('3. Cuota con 30% de inicial para precio $15,400', () => {
  const cuota = calcularCuota(15400, 0.30);
  assertAproximado(cuota, 707.03, 'Cuota 30%');
  assert.equal(formatoUSD(cuota), '$707');
});

test('4. Cuota con 40% de inicial para precio $15,400', () => {
  const cuota = calcularCuota(15400, 0.40);
  assertAproximado(cuota, 606.02, 'Cuota 40%');
  assert.equal(formatoUSD(cuota), '$606');
});

test('5. Cuota máxima para ingreso $1,000 (ratio 30%)', () => {
  const cuotaMax = calcularCuotaMaxima(1000);
  assertAproximado(cuotaMax, 300.00, 'Cuota máxima para ingreso $1,000');
  assert.equal(formatoUSD(cuotaMax), '$300');
});

test('6. Precio máximo con 20% inicial para ingreso $1,000', () => {
  const precioMax = calcularPrecioMaximo(1000, 0.20);
  assertAproximado(precioMax, 5717.61, 'Precio máximo 20% ingreso $1,000');
  assert.equal(formatoUSD(precioMax), '$5,718');
});

test('7. Precio máximo con 30% inicial para ingreso $1,000', () => {
  const precioMax = calcularPrecioMaximo(1000, 0.30);
  assertAproximado(precioMax, 6534.41, 'Precio máximo 30% ingreso $1,000');
  assert.equal(formatoUSD(precioMax), '$6,534');
});

test('8. Precio máximo con 40% inicial para ingreso $1,000', () => {
  const precioMax = calcularPrecioMaximo(1000, 0.40);
  assertAproximado(precioMax, 7623.48, 'Precio máximo 40% ingreso $1,000');
  assert.equal(formatoUSD(precioMax), '$7,623');
});

test('9. Precio máximo con 20% inicial para ingreso $2,000', () => {
  const precioMax = calcularPrecioMaximo(2000, 0.20);
  assertAproximado(precioMax, 11435.22, 'Precio máximo 20% ingreso $2,000');
  assert.equal(formatoUSD(precioMax), '$11,435');
});

test('10. Ingreso mínimo con 20% inicial para precio $6,000', () => {
  const ingresoMin = calcularIngresoMinimo(6000, 0.20);
  assertAproximado(ingresoMin, 1049.39, 'Ingreso mínimo precio $6,000');
  assert.equal(formatoUSD(ingresoMin), '$1,049');
});

test('11. Ingreso mínimo con 20% inicial para precio $12,000', () => {
  const ingresoMin = calcularIngresoMinimo(12000, 0.20);
  assertAproximado(ingresoMin, 2098.78, 'Ingreso mínimo precio $12,000');
  assert.equal(formatoUSD(ingresoMin), '$2,099');
});

test('12. Validación de entradas inválidas, ceros o negativos', () => {
  assert.equal(calcularFactor(0, 24), 0);
  assert.equal(calcularFactor(0.04, 0), 0);
  assert.equal(calcularCuota(0, 0.20), 0);
  assert.equal(calcularCuota(-15400, 0.20), 0);
  assert.equal(calcularCuota(15400, -0.20), 0);
  assert.equal(calcularCuota(15400, 1.2), 0);
  assert.equal(calcularCuotaMaxima(0), 0);
  assert.equal(calcularCuotaMaxima(-1000), 0);
  assert.equal(calcularPrecioMaximo(0, 0.20), 0);
  assert.equal(calcularPrecioMaximo(-1000, 0.20), 0);
  assert.equal(calcularIngresoMinimo(0, 0.20), 0);
  assert.equal(calcularIngresoMinimo(-6000, 0.20), 0);
  assert.deepEqual(simularOpciones(0), []);
});

test('13. Simulación de opciones para precio $15,400', () => {
  const opciones = simularOpciones(15400);
  assert.equal(opciones.length, 3);

  // 20%
  assert.equal(opciones[0].pctInicial, 0.20);
  assert.equal(opciones[0].montoInicial, 3080);
  assert.equal(opciones[0].montoFinanciado, 12320);
  assertAproximado(opciones[0].cuota, 808.03, 'Opción 20%');

  // 30%
  assert.equal(opciones[1].pctInicial, 0.30);
  assert.equal(opciones[1].montoInicial, 4620);
  assert.equal(opciones[1].montoFinanciado, 10780);
  assertAproximado(opciones[1].cuota, 707.03, 'Opción 30%');

  // 40%
  assert.equal(opciones[2].pctInicial, 0.40);
  assert.equal(opciones[2].montoInicial, 6160);
  assert.equal(opciones[2].montoFinanciado, 9240);
  assertAproximado(opciones[2].cuota, 606.02, 'Opción 40%');
});

test('14. Parámetros aprobados y formateo de monedas', () => {
  assert.equal(PARAMETROS_APROBADOS.tasaMensual, 0.04);
  assert.equal(PARAMETROS_APROBADOS.plazoMeses, 24);
  assert.equal(PARAMETROS_APROBADOS.ratioCuotaIngreso, 0.30);
  assert.deepEqual(PARAMETROS_APROBADOS.opcionesInicial, [0.20, 0.30, 0.40]);

  // Formato USD: sin decimales
  assert.equal(formatoUSD(808.03), '$808');
  assert.equal(formatoUSD(5717.61), '$5,718');
  assert.equal(formatoUSD(15400), '$15,400');

  // Formato VES: 2 decimales
  assert.ok(formatoVES(1234.5).includes('Bs.'));
});
