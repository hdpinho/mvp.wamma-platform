import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrato } from '../pruebas/contrato.ts';
import {
  citaDesdeApi,
  fichaDesdeApi,
  franjaDesdeApi,
  franjaParaApi,
  oportunidadDesdeApi,
  personaDesdeResumenApi,
  telefonoLocal,
} from './crmAdaptadores.ts';
import type { CitaApi, OportunidadApi, PersonaDetalleApi, PersonaResumenApi, RespuestaVentaApi } from './crmDtos.ts';

// Los adaptadores reciben lo que el servidor responde: los mismos archivos con que el backend fija esas respuestas.

const ETAPAS = ['nuevo', 'contactado', 'cita_confirmada', 'visito', 'negociacion', 'cerrado_ganado', 'cerrado_perdido'];

test('una oportunidad del servidor se lee con el código del vehículo, su enlace y su crédito', () => {
  const api = contrato<OportunidadApi>('crm-oportunidad');
  const o = oportunidadDesdeApi(api);

  assert.equal(o.id, api.id);
  assert.equal(o.vehiculoId, 'WAM-00012', 'en pantalla el vehículo se identifica por su código, no por su uuid');
  assert.equal(o.vehiculoResumen.marca, 'Toyota');
  assert.equal(o.vehiculoResumen.anio, 2021);
  assert.equal(o.modalidadPago, 'Financiamiento');
  assert.equal(o.valorEstimadoUSD, 18000);
  assert.equal(o.etapa, 'negociacion');
  assert.ok(ETAPAS.includes(o.etapa), 'la etapa del contrato existe en el modelo de la web');
  assert.equal(o.asesorNombre, 'Ana Pérez');
  assert.equal(o.version, 3);
  assert.equal(o.entroEtapaEn, api.entroEtapaEn);
  assert.deepEqual(o.solicitudCredito, { id: api.solicitudCreditoId, numero: 'SOL-2026-0001', estado: 'enviada' });
});

test('el enlace de financiamiento llega sin su texto: el servidor solo guarda la huella', () => {
  const o = oportunidadDesdeApi(contrato<OportunidadApi>('crm-oportunidad'));
  assert.ok(o.enlaceFinanciamiento);
  assert.equal(o.enlaceFinanciamiento.token, undefined);
  assert.equal(o.enlaceFinanciamiento.emitidoEn, '2026-09-30T14:05:00Z');
  assert.equal(o.enlaceFinanciamiento.usadoEn, '2026-09-30T15:20:00Z');
});

test('una oportunidad sin enlace ni crédito no los inventa', () => {
  const venta = contrato<RespuestaVentaApi>('crm-venta');
  const sinEnlace: OportunidadApi = { ...venta.oportunidad, tieneEnlaceFinanciamiento: false, enlaceEmitidoEn: null };
  const o = oportunidadDesdeApi(sinEnlace);
  assert.equal(o.enlaceFinanciamiento, undefined);
  assert.equal(o.solicitudCredito, undefined);
});

test('la venta financiada trae el enlace una sola vez, junto a la oportunidad', () => {
  const venta = contrato<RespuestaVentaApi>('crm-venta');
  assert.ok(venta.tokenFinanciamiento && venta.tokenFinanciamiento.length > 10);
  assert.equal(venta.oportunidad.tieneEnlaceFinanciamiento, true);
  assert.equal(venta.oportunidad.enlaceUsadoEn, null);
});

test('una cita conserva su vehículo por código y su franja se muestra con tilde', () => {
  const api = contrato<CitaApi>('crm-cita');
  const c = citaDesdeApi(api);
  assert.equal(c.vehiculoId, 'WAM-00012');
  assert.equal(c.franjaHoraria, 'Mañana');
  assert.equal(c.estado, 'confirmada');
  assert.equal(c.diaPreferencia, '2026-10-03');
});

test('la franja viaja sin tilde y en minúsculas, y vuelve con tilde', () => {
  assert.equal(franjaParaApi('Mañana'), 'manana');
  assert.equal(franjaParaApi('Tarde'), 'tarde');
  assert.equal(franjaDesdeApi('manana'), 'Mañana');
  assert.equal(franjaDesdeApi('tarde'), 'Tarde');
});

test('el resumen de una persona trae el principal primero y su último movimiento', () => {
  const api = contrato<PersonaResumenApi>('crm-persona-resumen');
  const p = personaDesdeResumenApi(api);
  assert.equal(p.cedula, 'V12345678');
  assert.equal(p.telefonoWhatsApp, '+584121234567');
  assert.deepEqual(p.telefonosAdicionales, ['+584141112233']);
  assert.equal(p.ultimaActividadEn, api.ultimaActividadEn);
});

test('la ficha completa trae notas, historial, citas y las fusiones que la formaron', () => {
  const api = contrato<PersonaDetalleApi>('crm-persona-detalle');
  const ficha = fichaDesdeApi(api);

  assert.equal(ficha.persona.nombreApellido, 'Carlos Rodríguez');
  assert.equal(ficha.persona.fusionadaCon, undefined);
  assert.equal(ficha.persona.fusionadaDesde?.length, 1);
  assert.equal(ficha.persona.fusionadaDesde?.[0].nombreApellido, 'Carlos R.');
  assert.equal(ficha.persona.fusionadaDesde?.[0].oportunidadIds.length, 1);
  assert.equal(ficha.oportunidades.length, 1);
  assert.equal(ficha.citas.length, 1);
  assert.equal(ficha.interacciones[0].canal, 'whatsapp');
  assert.equal(ficha.historial[0].etapaNueva, 'negociacion');
  assert.equal(ficha.historial[0].etapaAnterior, 'visito');
});

test('un registro fusionado dice dónde está la persona vigente', () => {
  const api = contrato<PersonaDetalleApi>('crm-persona-detalle');
  const fusionado: PersonaDetalleApi = {
    ...api,
    estado: 'fusionado',
    oportunidades: [],
    citas: [],
    interacciones: [],
    historial: [],
    fusiones: [],
    fusionadaCon: '11111111-2222-4333-8444-555555555555',
  };
  const ficha = fichaDesdeApi(fusionado);
  assert.equal(ficha.persona.fusionadaCon, '11111111-2222-4333-8444-555555555555');
  assert.equal(ficha.persona.fusionadaDesde, undefined);
});

test('un teléfono E.164 del servidor se muestra como lo escribe un venezolano', () => {
  assert.equal(telefonoLocal('+584121234567'), '04121234567');
  assert.equal(telefonoLocal('04121234567'), '04121234567');
});
