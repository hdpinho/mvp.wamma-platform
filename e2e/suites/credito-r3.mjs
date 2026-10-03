// Verificación de la fase R3 (integridad del crédito) contra el backend local aislado (8081), por HTTP, con ingreso
// real (contraseña y 2FA). Necesita un backend recién arrancado. Solo toca el PostgreSQL embebido y desechable.
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const resultados = [];
const registrar = (id, desc, esperado, obtenido, ok) => {
  resultados.push({ id, desc, esperado, obtenido, ok });
  console.log(`${ok ? 'PASA ' : 'FALLA'} ${id} ${desc}\n       esperado: ${esperado}\n       obtenido: ${obtenido}`);
};

async function api(method, path, { token, body, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
}
const base32Decode = (s) => {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, '0');
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};
const totp = (secreto) => {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = crypto.createHmac('sha1', base32Decode(secreto)).update(buf).digest(); const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
};
async function primerIngreso(usuario, temporal, nueva) {
  const l = await api('POST', '/v1/auth/ingreso', { body: { usuario, contrasena: temporal } });
  const tt = l.json.tokenTemporal; let sig = l.json.siguiente;
  if (sig === 'CAMBIAR_CONTRASENA') sig = (await api('POST', '/v1/auth/contrasena-inicial', { token: tt, body: { nueva } })).json.siguiente;
  const a = await api('POST', '/v1/auth/2fa/activacion', { token: tt });
  const f = await api('POST', '/v1/auth/2fa/confirmacion', { token: tt, body: { codigo: totp(a.json.secreto) } });
  return { token: f.json.token };
}
async function crearUsuario(adminToken, clave, rol) {
  const usuario = `qa3.${clave.toLowerCase()}`;
  const c = await api('POST', '/v1/usuarios', { token: adminToken, body: { usuario, nombre: clave, apellido: 'QA', correo: `${usuario}@qa.invalid`, roles: [rol] } });
  return primerIngreso(usuario, c.json.contrasenaTemporal, `Frase larga de prueba QA 2026 para ${clave.toLowerCase()}`);
}

const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
let seq = 0;
const tel = () => `0416${String(5550000 + seq++).padStart(7, '0')}`;
const ced = () => `V-${31200000 + seq++}`;

/** Lleva un vehículo desde la cita hasta el enlace de financiamiento y devuelve lo necesario para solicitar. */
async function hastaElEnlace(asesor, vehiculo) {
  const cita = await api('POST', '/v1/citas', { body: { nombreApellido: 'Marta Prueba', telefonoWhatsApp: tel(), diaPreferencia: manana,
    franjaHoraria: 'manana', modalidadPago: 'financiamiento', vehiculoCodigo: vehiculo.codigo } });
  const fila = (await api('GET', '/v1/crm/citas', { token: asesor.token })).json.find((c) => c.id === cita.json.id);
  await api('PUT', `/v1/crm/oportunidades/${fila.oportunidadId}/asesor`, { token: asesor.token, body: {} });
  await api('POST', `/v1/crm/citas/${cita.json.id}/confirmacion`, { token: asesor.token, body: { cedula: ced() } });
  await api('POST', `/v1/crm/citas/${cita.json.id}/asistencia`, { token: asesor.token });
  const venta = await api('POST', `/v1/crm/oportunidades/${fila.oportunidadId}/venta`, { token: asesor.token, body: { modalidad: 'financiamiento' } });
  return venta.json.tokenFinanciamiento;
}

const dossier = (sueldo = 3000) => ({
  datosPersonales: { primerNombre: 'Marta', primerApellido: 'Prueba', tipoDocumento: 'V', numeroDocumento: '31200001', nacionalidad: 'Venezolana' },
  datosContacto: { direccionHabitacion: 'Calle 1', estado: 'Miranda', municipio: 'Chacao', telefonoCelular: '0416-5550000', correo: 'marta@ejemplo.invalid' },
  datosLaborales: { situacionLaboral: 'Empleado Fijo', empresa: 'Empresa Ejemplo C.A.', cargo: 'Analista', antiguedadAnios: 3 },
  datosFinancieros: { sueldoMensual: sueldo, otrosIngresos: 0, alimentacionServicios: 300 },
  referencias: [{ nombre: 'Ana', parentesco: 'Amiga', telefono: '0412-1110001' }],
  datosBancarios: { banco: '0134', tipoCuenta: 'Corriente', numeroCuenta: '01340000000000000009' },
  declaraciones: { veracidad: true, centralesRiesgo: true, origenFondos: true, compromisoPago: true, esPep: false, vinculoPep: false, consentimientoDatos: true },
  recaudos: [], versionTexto: 'WMA-F-FIN-001 v1',
});

async function main() {
  const admin = await primerIngreso('admin.local', 'Clave local de desarrollo 2026', 'Frase del administrador local QA 2026');
  const asesor = await crearUsuario(admin.token, 'Asesor', 'ASESOR_COMERCIAL');
  const analista = await crearUsuario(admin.token, 'Analista', 'ANALISTA_CREDITO');
  const catalogo = (await api('GET', '/v1/catalogo')).json;
  const libres = catalogo.vehiculos.filter((v) => v.disponibilidad === 'disponible');
  const [v1, v2, v3] = libres.slice(8, 11);

  // ── R3.1 · El servidor calcula ──────────────────────────────────────────────────────
  const tokenA = await hastaElEnlace(asesor, v1);
  const inicial = Math.ceil(Number(v1.precio) * 0.2);
  const solicitud = (token, extra = {}) => ({ token, montoSolicitado: 1, cuotaInicial: inicial, plazoMeses: 24, frecuenciaPago: 'Semanal',
    cuotaEstimada: 1, capacidadPagoMensual: 999999, ...dossier(3000), ...extra });
  const bajaInicial = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenA, { cuotaInicial: inicial - 50 }) });
  registrar('R3.1-a', 'Una inicial por debajo del 20 % se rechaza en el servidor', '422', `${bajaInicial.status}`, bajaInicial.status === 422);
  const igualPrecio = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenA, { cuotaInicial: Number(v1.precio) }) });
  registrar('R3.1-b', 'Una inicial igual al precio se rechaza', '422', `${igualPrecio.status}`, igualPrecio.status === 422);
  const plazo = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenA, { plazoMeses: 36 }) });
  registrar('R3.1-c', 'Un plazo distinto de 24 meses se rechaza', '422', `${plazo.status}`, plazo.status === 422);

  const enviada = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenA) });
  registrar('R3.1-d', 'Los rechazos no gastaron el enlace: la solicitud correcta pasa', '200', `${enviada.status}`, enviada.status === 200);
  const det = (await api('GET', `/v1/solicitudes-credito/${enviada.json.id}`, { token: analista.token })).json;
  const precio = Number(v1.precio);
  const financiado = precio - inicial;
  const i = 0.04; const cuota = Math.round(((financiado * i) / (1 - Math.pow(1 + i, -24))) * 100) / 100;
  registrar('R3.1-e', 'Monto, cuota (sistema francés) y capacidad (30 %) son los del servidor, no los que mandó el navegador',
    `monto ${financiado.toFixed(2)}, cuota ${cuota.toFixed(2)}, capacidad 900.00, Mensual`,
    `monto ${Number(det.montoSolicitado).toFixed(2)}, cuota ${Number(det.cuotaEstimada).toFixed(2)}, capacidad ${Number(det.capacidadPagoMensual).toFixed(2)}, ${det.frecuenciaPago}`,
    Math.abs(Number(det.montoSolicitado) - financiado) < 0.01 && Math.abs(Number(det.cuotaEstimada) - cuota) < 0.01 &&
      Number(det.capacidadPagoMensual) === 900 && det.frecuenciaPago === 'Mensual');

  // ── R3.3 · Motor apagado ───────────────────────────────────────────────────────────
  const motor = await api('POST', `/v1/riesgo/solicitudes/${enviada.json.id}/evaluar-motor`, { token: analista.token, body: {} });
  const resumen = await api('GET', `/v1/riesgo/solicitudes/${enviada.json.id}/resumen`, { token: analista.token });
  const alertas = await api('GET', '/v1/riesgo/alertas-aml', { token: analista.token });
  registrar('R3.3', 'El motor de scoring, el AML y el Score Buró no existen (D-63)', '404, 404, 404', `${motor.status}, ${resumen.status}, ${alertas.status}`,
    [motor.status, resumen.status, alertas.status].every((s) => s === 404));

  // ── R3.5 · Dictamen manual ─────────────────────────────────────────────────────────
  const ruta = `/v1/solicitudes-credito/${enviada.json.id}/evaluacion`;
  const sinJust = await api('POST', ruta, { token: analista.token, body: { resultado: 'rechazado' } });
  registrar('R3.5-a', 'Sin justificación no hay dictamen', '422', `${sinJust.status}`, sinJust.status === 422);
  const sinLimite = await api('POST', ruta, { token: analista.token, body: { resultado: 'aprobado', justificacion: 'Cumple lo exigido.' } });
  registrar('R3.5-b', 'Aprobar exige el límite y la cuota máxima', '422', `${sinLimite.status}`, sinLimite.status === 422);
  const cond = await api('POST', ruta, { token: analista.token, body: { resultado: 'condicionado', justificacion: 'Falta el estado de cuenta.' } });
  const aprob = await api('POST', ruta, { token: analista.token, body: { resultado: 'aprobado', justificacion: 'Entregó el estado de cuenta.',
    limiteAprobado: financiado, cuotaMaximaPermitida: 900 } });
  const tras = (await api('GET', `/v1/solicitudes-credito/${enviada.json.id}`, { token: analista.token })).json;
  registrar('R3.5-c', 'Condicionar y luego aprobar funciona, sin puntaje ni nivel de riesgo inventados',
    '200, 200, aprobada, puntaje nulo', `${cond.status}, ${aprob.status}, ${tras.estado}, ${tras.decisionRiesgo?.internalScore}`,
    cond.status === 200 && aprob.status === 200 && tras.estado === 'aprobada' && tras.decisionRiesgo?.internalScore === null && tras.decisionRiesgo?.riskLevel === null);
  const revertir = await api('POST', ruta, { token: analista.token, body: { resultado: 'rechazado', justificacion: 'Cambié de opinión.' } });
  registrar('R3.5-d', 'Un dictamen final no se revierte', '409', `${revertir.status}`, revertir.status === 409);

  // ── Auditoría de lectura del expediente ────────────────────────────────────────────
  const bit = await api('GET', '/v1/auditoria?accion=solicitud_credito.consultada', { token: admin.token });
  registrar('R3.audit', 'Leer el expediente deja evento en la bitácora', 'al menos 1 evento',
    `${bit.status}, ${Array.isArray(bit.json?.eventos ?? bit.json) ? (bit.json?.eventos ?? bit.json).length : '?'} evento(s)`,
    bit.status === 200 && JSON.stringify(bit.json).includes('solicitud_credito.consultada'));

  // ── Número de solicitud ────────────────────────────────────────────────────────────
  const tokenB = await hastaElEnlace(asesor, v2);
  const inicialB = Math.ceil(Number(v2.precio) * 0.2);
  const segunda = await api('POST', '/v1/solicitudes-credito', { body: { token: tokenB, cuotaInicial: inicialB, plazoMeses: 24, ...dossier(3000) } });
  const n1 = Number(enviada.json.numeroSolicitud.split('-')[2]); const n2 = Number(segunda.json?.numeroSolicitud?.split('-')[2]);
  registrar('R3.7', 'Los números de solicitud son consecutivos y sin repetirse', 'n y n+1', `${enviada.json.numeroSolicitud}, ${segunda.json?.numeroSolicitud}`, n2 === n1 + 1);

  // ── Política ────────────────────────────────────────────────────────────────────────
  const pol = (await api('GET', '/v1/parametros-financiamiento')).json;
  registrar('R3.pol-a', 'La moneda base de la política es EUR', 'EUR', `${pol.moneda_base}`, pol.moneda_base === 'EUR');
  const putPlazo = await api('PUT', '/v1/parametros-financiamiento', { token: admin.token, body: { tasa_mensual: 0.04, plazo_meses: 36, ratio_cuota_ingreso: 0.3,
    opciones_inicial: [0.2, 0.3, 0.4], inicial_minima: 0.2, moneda_base: 'EUR' } });
  registrar('R3.pol-b', 'La política no admite un plazo distinto de 24 meses (D-55)', '422', `${putPlazo.status}`, putPlazo.status === 422);

  void v3;
  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\nTotal: ${resultados.length} · pasan ${resultados.length - fallas} · fallan ${fallas}`);
  fs.mkdirSync(new URL('../resultados/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../resultados/credito-r3.json', import.meta.url), JSON.stringify(resultados, null, 2));
  if (fallas) process.exitCode = 1;
}
main().catch((e) => { console.error('ERROR DEL GUION:', e); process.exitCode = 2; });
