import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrato } from '../pruebas/contrato.ts';
import type { DetalleSolicitudApi } from './credito.ts';
import {
  NO_INFORMADO,
  documentoDe,
  monto,
  nombreCompleto,
  resumenFinanciero,
  texto,
  textoOInformado,
  tituloDeRecaudo,
} from './creditoAdaptadores.ts';
import type { SolicitudEnvioApi } from './credito.ts';

/**
 * El detalle del expediente es el archivo de contrato del backend con el expediente que arma la web
 * (`credito-solicitud-envio.json`): lo que el analista lee es lo que la persona escribió, con las mismas claves.
 */
function detalleDeContrato(): DetalleSolicitudApi {
  const detalle = contrato<DetalleSolicitudApi>('credito-solicitud-detalle');
  const envio = contrato<SolicitudEnvioApi>('credito-solicitud-envio');
  return {
    ...detalle,
    datosPersonales: envio.datosPersonales,
    datosContacto: envio.datosContacto,
    datosLaborales: envio.datosLaborales,
    datosFinancieros: envio.datosFinancieros,
    datosBancarios: envio.datosBancarios,
    declaraciones: envio.declaraciones,
    referencias: envio.referencias,
  };
}

test('el nombre y el documento se arman con las claves que escribe el formulario', () => {
  const d = detalleDeContrato();
  assert.equal(nombreCompleto(d.datosPersonales), 'Carlos Alberto Rodríguez Pérez');
  assert.equal(documentoDe(d.datosPersonales), 'V-12345678');
});

test('lo que falta se ve como «No informado», nunca con un valor inventado', () => {
  assert.equal(nombreCompleto(null), '');
  assert.equal(documentoDe({}), '');
  assert.equal(textoOInformado(undefined), NO_INFORMADO);
  assert.equal(textoOInformado('   '), NO_INFORMADO);
  assert.equal(textoOInformado(0), '0');
  assert.equal(texto({}), '');
});

test('un monto libre es número, texto numérico o cero', () => {
  assert.equal(monto(1500), 1500);
  assert.equal(monto('300.50'), 300.5);
  assert.equal(monto('abc'), 0);
  assert.equal(monto(undefined), 0);
  assert.equal(monto(null), 0);
});

test('el resumen financiero compara la cuota con la capacidad de pago declarada', () => {
  const d = detalleDeContrato();
  const r = resumenFinanciero(d, 0.2);

  assert.equal(r.precio, 18000);
  assert.equal(r.inicial, 3600);
  assert.equal(r.financiado, 14400);
  assert.equal(r.porcentajeInicial, 0.2);
  assert.equal(r.ingresos, 3800);
  assert.equal(r.egresos, 1000);
  assert.equal(r.capacidadPago, 1140);
  assert.equal(r.cuota, 944.45);
  assert.equal(r.excedeCapacidad, false);
  assert.equal(r.inicialInsuficiente, false, '3.600 de 18.000 es justo el mínimo de 20 %');
});

test('una cuota mayor que la capacidad se marca, y una inicial bajo el mínimo también', () => {
  const d = { ...detalleDeContrato(), cuotaEstimada: 1300, cuotaInicial: 3000 };
  const r = resumenFinanciero(d, 0.2);
  assert.equal(r.excedeCapacidad, true);
  assert.equal(r.inicialInsuficiente, true);
  assert.ok(r.cuotaSobreCapacidad !== null && r.cuotaSobreCapacidad > 1);
});

test('sin ingresos declarados no hay capacidad contra la que medir', () => {
  const d = { ...detalleDeContrato(), capacidadPagoMensual: 0 };
  const r = resumenFinanciero(d);
  assert.equal(r.cuotaSobreCapacidad, null);
  assert.equal(r.excedeCapacidad, false);
  assert.equal(r.inicialInsuficiente, null, 'sin mínimo vigente no se afirma nada');
});

test('los recaudos se titulan por el tipo con que se cargaron', () => {
  assert.equal(tituloDeRecaudo('cedula'), 'Cédula de Identidad o Pasaporte');
  assert.equal(tituloDeRecaudo('ingresos'), 'Constancia de trabajo o certificación de ingresos');
  assert.equal(tituloDeRecaudo('otro'), 'otro');
  assert.equal(tituloDeRecaudo(null), 'Documento');
});

test('el contrato del detalle trae el dictamen vigente sin puntajes obligatorios', () => {
  const d = contrato<DetalleSolicitudApi>('credito-solicitud-detalle');
  assert.equal(d.decisionRiesgo?.result, 'aprobado');
  assert.equal(d.decisionRiesgo?.internalScore, null, 'el dictamen a mano no exige puntaje (D-63)');
  assert.equal(d.recaudos?.[0].validationStatus, 'conforme');
});
