// Verificación de la fase R1 (seguridad y accesos) contra el backend local aislado (8081).
// Sin atajos: ingreso real con contraseña y 2FA, un usuario por rol. Solo toca el PostgreSQL
// embebido y desechable de esa instancia.
import crypto from 'node:crypto';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8081';
const resultados = [];

function registrar(id, desc, esperado, obtenido, ok, nota = '') {
  resultados.push({ id, desc, esperado, obtenido, ok, nota });
  const marca = ok === null ? 'PEND ' : ok ? 'PASA ' : 'FALLA';
  console.log(`${marca} ${id} ${desc}\n       esperado: ${esperado}\n       obtenido: ${obtenido}${nota ? `\n       nota: ${nota}` : ''}`);
}

async function api(method, path, { token, body, headers = {}, form } = {}) {
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let b;
  if (form) b = form;
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    b = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, { method, headers: h, body: b });
  const buf = Buffer.from(await r.arrayBuffer());
  const text = buf.toString('utf8');
  let json;
  try { json = JSON.parse(text); } catch { /* no es JSON */ }
  return { status: r.status, json, text, buf, headers: r.headers };
}

function base32Decode(s) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const limpio = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const c of limpio) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secreto, t = Date.now()) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const hmac = crypto.createHmac('sha1', base32Decode(secreto)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  return ((hmac.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

/** Primer ingreso completo: contraseña temporal → contraseña propia → activación del 2FA. */
async function primerIngreso(usuario, temporal, nueva) {
  const l = await api('POST', '/v1/auth/ingreso', { body: { usuario, contrasena: temporal } });
  if (l.status !== 200) throw new Error(`ingreso ${usuario}: ${l.status} ${l.text}`);
  const tt = l.json.tokenTemporal;
  let siguiente = l.json.siguiente;
  if (siguiente === 'CAMBIAR_CONTRASENA') {
    const c = await api('POST', '/v1/auth/contrasena-inicial', { token: tt, body: { nueva } });
    if (c.status !== 200) throw new Error(`contraseña ${usuario}: ${c.status} ${c.text}`);
    siguiente = c.json.siguiente;
  }
  if (siguiente !== 'ACTIVAR_2FA') throw new Error(`${usuario}: paso inesperado ${siguiente}`);
  const a = await api('POST', '/v1/auth/2fa/activacion', { token: tt });
  const f = await api('POST', '/v1/auth/2fa/confirmacion', { token: tt, body: { codigo: totp(a.json.secreto) } });
  if (!f.json?.token) throw new Error(`2FA ${usuario}: ${f.status} ${f.text}`);
  return { usuario, contrasena: nueva, secreto: a.json.secreto, token: f.json.token, id: f.json.usuario?.id };
}

async function crearUsuario(adminToken, clave, rol) {
  const usuario = `qa.${clave.toLowerCase()}`;
  const c = await api('POST', '/v1/usuarios', {
    token: adminToken,
    body: { usuario, nombre: 'QA', apellido: clave, correo: `${usuario}@qa.invalid`, roles: [rol] },
  });
  if (c.status !== 201) throw new Error(`crear ${clave}: ${c.status} ${c.text}`);
  return primerIngreso(usuario, c.json.contrasenaTemporal, `Frase larga de prueba QA 2026 para ${clave.toLowerCase()}`);
}

const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
let telSeq = 0;
const telefono = () => `0414${String(7770000 + telSeq++).padStart(7, '0')}`;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);

function formulario(campos, archivo, nombre, tipo) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  f.append('archivo', new Blob([archivo], { type: tipo }), nombre);
  return f;
}

async function main() {
  // ── 0. Cuentas: el administrador de arranque y un usuario por rol ──────────
  const admin = await primerIngreso('admin.local', 'Clave local de desarrollo 2026', 'Frase del administrador local QA 2026');
  const u = { admin };
  for (const [clave, rol] of [['AsesorA', 'ASESOR_COMERCIAL'], ['AsesorB', 'ASESOR_COMERCIAL'],
    ['Coordinador', 'COORDINADOR_COMERCIAL'], ['Analista', 'ANALISTA_CREDITO'], ['Auditor', 'AUDITOR'],
    ['Inventario', 'INVENTARIO']]) {
    u[clave] = await crearUsuario(admin.token, clave, rol);
  }
  registrar('R1-00', 'Ingreso real con contraseña y 2FA para los seis roles', '7 sesiones', `${Object.keys(u).length} sesiones`,
    Object.values(u).every((x) => x.token));

  const dev = await api('GET', '/v1/auth/yo', { token: 'dev-admin-token' });
  registrar('R1-00b', 'El token fijo de desarrollo no abre sesión sin la bandera', '401', `${dev.status}`, dev.status === 401);

  // ── R1.1 · Expediente de crédito solo para los roles de crédito ────────────
  const lista = await api('GET', '/v1/solicitudes-credito', { token: u.Analista.token });
  const sembrada = lista.json?.[0];
  registrar('R1.1-a', 'El analista ve la bandeja de crédito', '200 con la solicitud sembrada',
    `${lista.status} (${lista.json?.length ?? 0})`, lista.status === 200 && Boolean(sembrada));
  const dictamen = { resultado: 'condicionado', justificacion: 'prueba de permisos' };
  for (const clave of ['AsesorA', 'Coordinador', 'Inventario', 'admin']) {
    const t = u[clave].token;
    const estados = [
      (await api('GET', '/v1/solicitudes-credito', { token: t })).status,
      (await api('GET', `/v1/solicitudes-credito/${sembrada.id}`, { token: t })).status,
      (await api('POST', `/v1/solicitudes-credito/${sembrada.id}/evaluacion`, { token: t, body: dictamen })).status,
    ];
    registrar(`R1.1-${clave}`, `${clave}: bandeja, expediente y dictamen`, '403, 403, 403', estados.join(', '),
      estados.every((s) => s === 403));
  }
  const aud = [
    (await api('GET', `/v1/solicitudes-credito/${sembrada.id}`, { token: u.Auditor.token })).status,
    (await api('POST', `/v1/solicitudes-credito/${sembrada.id}/evaluacion`, { token: u.Auditor.token, body: dictamen })).status,
  ];
  registrar('R1.1-Auditor', 'Auditor: lee el expediente pero no dictamina', '200, 403', aud.join(', '), aud[0] === 200 && aud[1] === 403);

  // ── R1.2 · Política de financiamiento solo con parametros.gestionar ────────
  const antes = await api('GET', '/v1/parametros-financiamiento');
  const put = await api('PUT', '/v1/parametros-financiamiento', {
    token: u.AsesorA.token,
    // Cuerpo válido: así el rechazo es por permiso (403) y no por validación (400).
    body: { tasa_mensual: 0.09, plazo_meses: 24, ratio_cuota_ingreso: 0.3, opciones_inicial: [0.2, 0.3, 0.4],
      inicial_minima: 0.2, moneda_base: 'EUR' },
  });
  const despues = await api('GET', '/v1/parametros-financiamiento');
  registrar('R1.2', 'El asesor no cambia la tasa oficial', '403 y parámetros sin cambios',
    `${put.status}; ${JSON.stringify(antes.json) === JSON.stringify(despues.json) ? 'sin cambios' : 'CAMBIARON'}`,
    put.status === 403 && JSON.stringify(antes.json) === JSON.stringify(despues.json));

  // ── R1.3 · CRM: cada asesor ve lo suyo y lo que no tiene dueño ─────────────
  const catalogo = await api('GET', '/v1/catalogo');
  const items = Array.isArray(catalogo.json) ? catalogo.json : (catalogo.json?.vehiculos ?? catalogo.json?.items ?? []);
  const nombre = `Lucía Ajena ${crypto.randomBytes(3).toString('hex')}`;
  let cita;
  let vehiculoCita;
  // El primer vehículo disponible; el límite por IP (5) acota los intentos.
  for (const v of items.filter((x) => x.disponibilidad === 'disponible').slice(-3)) {
    cita = await api('POST', '/v1/citas', {
      body: { nombreApellido: nombre, telefonoWhatsApp: telefono(), diaPreferencia: manana, franjaHoraria: 'tarde',
        modalidadPago: 'financiamiento', vehiculoId: v.id },
    });
    if (cita.status === 201) { vehiculoCita = v; break; }
    if (cita.status !== 409) throw new Error(`cita: ${cita.status} ${cita.text}`);
  }
  if (!vehiculoCita) throw new Error('No hubo vehículo disponible para la cita');
  const citas = await api('GET', '/v1/crm/citas?estado=pendiente', { token: u.Coordinador.token });
  const miCita = citas.json.find((c) => c.id === cita.json.id);
  const opp = miCita.oportunidadId;
  const persona = miCita.personaId;
  const tomar = await api('PUT', `/v1/crm/oportunidades/${opp}/asesor`, { token: u.AsesorA.token, body: {} });
  const ajenos = [
    (await api('GET', `/v1/crm/oportunidades/${opp}`, { token: u.AsesorB.token })).status,
    (await api('GET', `/v1/crm/personas/${persona}`, { token: u.AsesorB.token })).status,
    (await api('PUT', `/v1/crm/oportunidades/${opp}/proxima-accion`, { token: u.AsesorB.token,
      body: { accion: 'Llamar', fecha: manana } })).status,
    (await api('POST', `/v1/crm/citas/${miCita.id}/descarte`, { token: u.AsesorB.token, body: { motivo: 'otro' } })).status,
  ];
  const busquedaB = await api('GET', `/v1/crm/personas?q=${encodeURIComponent(nombre)}`, { token: u.AsesorB.token });
  const busquedaC = await api('GET', `/v1/crm/personas?q=${encodeURIComponent(nombre)}`, { token: u.Coordinador.token });
  // Desde R2 el servidor devuelve la oportunidad ya asignada (antes, 204 sin cuerpo) y la web aplica esa respuesta.
  const tomada = tomar.status === 200 && /AsesorA/.test(tomar.json?.asesorNombre ?? '');
  registrar('R1.3-a', 'El asesor A toma la oportunidad sin dueño', '200 con la oportunidad a su nombre',
    `${tomar.status}${tomar.json?.asesorNombre ? ` · ${tomar.json.asesorNombre}` : ''}`, tomada);
  registrar('R1.3-b', 'El asesor B: oportunidad, ficha, próxima acción y descarte ajenos', '404, 404, 404, 404',
    ajenos.join(', '), ajenos.every((s) => s === 404));
  registrar('R1.3-c', 'El asesor B no encuentra a la persona; el coordinador sí', 'B: 0 · coordinador: 1',
    `B: ${busquedaB.json?.length} · coordinador: ${busquedaC.json?.length}`,
    busquedaB.json?.length === 0 && busquedaC.json?.length === 1);

  // ── R1.3 (cont.) · El asesor A atiende y vende con financiamiento ───────────
  const conf = await api('POST', `/v1/crm/citas/${miCita.id}/confirmacion`, { token: u.AsesorA.token,
    body: { cedula: `V-${20000000 + crypto.randomInt(9999999)}` } });
  const asis = await api('POST', `/v1/crm/citas/${miCita.id}/asistencia`, { token: u.AsesorA.token });
  const venta = await api('POST', `/v1/crm/oportunidades/${opp}/venta`, { token: u.AsesorA.token,
    body: { modalidad: 'financiamiento' } });
  const enlace = venta.json?.tokenFinanciamiento;
  registrar('R1.3-d', 'El dueño confirma, registra la visita y vende con financiamiento', '200, 204, 200 con enlace',
    `${conf.status}, ${asis.status}, ${venta.status}${enlace ? ' con enlace' : ''}`,
    conf.status === 200 && asis.status === 204 && venta.status === 200 && Boolean(enlace));

  // ── R1.4 · Límite de citas por IP ──────────────────────────────────────────
  const fantasma = crypto.randomUUID();
  const intento = (ip) => api('POST', '/v1/citas', {
    headers: { 'X-Forwarded-For': ip },
    body: { nombreApellido: 'QA Límite', telefonoWhatsApp: telefono(), diaPreferencia: manana, franjaHoraria: 'tarde',
      modalidadPago: 'contado', vehiculoId: fantasma },
  });
  const mismaIp = [];
  for (let i = 0; i < 6; i++) mismaIp.push((await intento('198.51.100.7')).status);
  const otraIp = (await intento('198.51.100.8')).status;
  registrar('R1.4', 'Una IP declarada nueva en X-Forwarded-For no estrena cupo', '6.º intento 429 y la IP nueva también 429',
    `misma IP: ${mismaIp.join(', ')} · IP nueva: ${otraIp}`, otraIp === 429 ? true : null,
    otraIp === 429 ? '' : 'El servidor aceptó la cabecera: con `native`, solo se acepta si quien la envía está en WAMMA_PROXIES_CONFIABLES. Para este caso, arrancar con WAMMA_PROXIES_CONFIABLES=ninguno (el cliente local no es un proxy).');

  // ── R1.5 · Recaudos privados ───────────────────────────────────────────────
  const subir = (token, archivo, nombreArchivo, tipo, tipoDocumento = 'cedula') =>
    api('POST', '/v1/solicitudes-credito/recaudos', { form: formulario({ token, tipoDocumento }, archivo, nombreArchivo, tipo) });
  const inventado = await subir('A'.repeat(43), JPEG, 'cedula.jpg', 'image/jpeg');
  const malformado = await subir('corto', JPEG, 'cedula.jpg', 'image/jpeg');
  const ejecutable = await subir(enlace, Buffer.from('MZ ejecutable disfrazado'), 'cedula.pdf', 'application/pdf');
  registrar('R1.5-a', 'Carga con enlace inventado, malformado, o un ejecutable con nombre .pdf', '404, 400, 422',
    `${inventado.status}, ${malformado.status}, ${ejecutable.status}`,
    inventado.status === 404 && malformado.status === 400 && ejecutable.status === 422);

  const cargado = await subir(enlace, JPEG, 'mi cédula.jpg', 'application/pdf');
  const clave = cargado.json?.fileKey ?? '';
  registrar('R1.5-b', 'Carga válida: clave bajo la oportunidad, tipo por contenido, sin URL', `recaudos/${opp}/….jpg · image/jpeg`,
    `${cargado.status} ${clave} · ${cargado.json?.mimeType}`,
    cargado.status === 200 && clave.startsWith(`recaudos/${opp}/`) && clave.endsWith('.jpg') && cargado.json?.mimeType === 'image/jpeg');
  const publico = await api('GET', `/archivos/${clave}`);
  registrar('R1.5-c', 'El almacén público de fotos no sirve el recaudo', '404', `${publico.status}`, publico.status === 404);

  const solicitud = await api('POST', '/v1/solicitudes-credito', {
    body: {
      token: enlace, vehiculoId: vehiculoCita.id, montoSolicitado: 9000, cuotaInicial: 3000, plazoMeses: 24,
      frecuenciaPago: 'Mensual', cuotaEstimada: 500, capacidadPagoMensual: 600,
      datosPersonales: { primerNombre: 'Lucía', primerApellido: 'Ajena', tipoDocumento: 'V', numeroDocumento: '20111222' },
      datosContacto: { telefonoCelular: '+584147770000', correo: 'lucia@ejemplo.invalid' },
      datosLaborales: { situacionLaboral: 'Empleado Fijo', empresa: 'Empresa QA C.A.' },
      datosFinancieros: { sueldoMensual: 2000 },
      referencias: [{ nombre: 'Ref QA', parentesco: 'Amiga', telefono: '04141112233' }],
      datosBancarios: { banco: '0105', tipoCuenta: 'Corriente', numeroCuenta: '01050000000000000099' },
      declaraciones: { veracidad: true },
      recaudos: [cargado.json],
      codigoOtp: null, otpVerificado: false,
    },
  });
  registrar('R1.5-d', 'Envío de la solicitud con el recaudo cargado con su enlace', '200', `${solicitud.status} ${solicitud.json?.numeroSolicitud ?? solicitud.text}`,
    solicitud.status === 200);
  const appId = solicitud.json?.id;

  const detalle = await api('GET', `/v1/solicitudes-credito/${appId}`, { token: u.Analista.token });
  const rec = detalle.json?.recaudos?.[0] ?? {};
  registrar('R1.5-e', 'El expediente no expone clave ni dirección del recaudo', 'sin fileUrl ni fileKey ni la clave',
    Object.keys(rec).join(', '), !('fileUrl' in rec) && !('fileKey' in rec) && !detalle.text.includes(clave));

  const link = await api('GET', `/v1/solicitudes-credito/${appId}/recaudos/${rec.id}/enlace`, { token: u.Analista.token });
  const archivo = await api('GET', link.json?.ruta ?? '/x');
  registrar('R1.5-f', 'El analista lo abre con enlace firmado, sin sesión y sin caché', '200 image/jpeg no-store, mismos bytes',
    `${link.status} → ${archivo.status} ${archivo.headers.get('content-type')} ${archivo.headers.get('cache-control')}`,
    link.status === 200 && archivo.status === 200 && archivo.headers.get('content-type') === 'image/jpeg'
      && /no-store/.test(archivo.headers.get('cache-control') ?? '') && archivo.buf.equals(JPEG));
  const ruta = link.json?.ruta ?? '';
  const firma = ruta.slice(ruta.indexOf('firma=') + 6);
  const alterado = await api('GET', ruta.replace(`firma=${firma}`, `firma=${firma[0] === '0' ? '1' : '0'}${firma.slice(1)}`));
  const otroArchivo = await api('GET', ruta.replace(opp, crypto.randomUUID()));
  registrar('R1.5-g', 'Firma alterada u otro archivo con la misma firma', '403, 403', `${alterado.status}, ${otroArchivo.status}`,
    alterado.status === 403 && otroArchivo.status === 403);
  const linkAsesor = await api('GET', `/v1/solicitudes-credito/${appId}/recaudos/${rec.id}/enlace`, { token: u.AsesorA.token });
  const linkAuditor = await api('GET', `/v1/solicitudes-credito/${appId}/recaudos/${rec.id}/enlace`, { token: u.Auditor.token });
  registrar('R1.5-h', 'Enlaces solo para roles de crédito', 'asesor 403 · auditor 200',
    `asesor ${linkAsesor.status} · auditor ${linkAuditor.status}`, linkAsesor.status === 403 && linkAuditor.status === 200);

  const detSembrada = await api('GET', `/v1/solicitudes-credito/${sembrada.id}`, { token: u.Analista.token });
  const recSembrado = detSembrada.json?.recaudos?.[0];
  const linkPdf = await api('GET', `/v1/solicitudes-credito/${sembrada.id}/recaudos/${recSembrado?.id}/enlace`, { token: u.Analista.token });
  const pdf = await api('GET', linkPdf.json?.ruta ?? '/x');
  registrar('R1.5-i', 'Los recaudos de la solicitud sembrada abren como PDF real', '200 application/pdf %PDF-',
    `${pdf.status} ${pdf.headers.get('content-type')} ${pdf.buf.subarray(0, 5).toString()}`,
    pdf.status === 200 && pdf.headers.get('content-type') === 'application/pdf' && pdf.buf.subarray(0, 5).toString() === '%PDF-');

  // ── R1.6 · Expediente cifrado: el analista lo lee descifrado ───────────────
  registrar('R1.6', 'El expediente se guarda cifrado y el analista lo lee completo', 'cuenta y empresa legibles en la API',
    `${detalle.json?.datosBancarios?.numeroCuenta} · ${detalle.json?.datosLaborales?.empresa}`,
    detalle.json?.datosBancarios?.numeroCuenta === '01050000000000000099' && detalle.json?.datosLaborales?.empresa === 'Empresa QA C.A.',
    'Que en la base no quede en claro lo prueban CreditApplicationIntegrationTest y pruebas-esquema.sql.');

  // ── R1.7 · Sin consulta pública por número ─────────────────────────────────
  const estadoPublico = await api('GET', `/v1/solicitudes-credito/${solicitud.json?.numeroSolicitud}/estado`);
  registrar('R1.7', 'Consultar una solicitud por su número sin sesión', '401', `${estadoPublico.status}`, estadoPublico.status === 401);

  // ── R1.8 · Un recaudo solo se valida dentro de su solicitud ────────────────
  const cruzado = await api('PATCH', `/v1/solicitudes-credito/${sembrada.id}/recaudos/${rec.id}`, {
    token: u.Analista.token, body: { estado: 'rechazado' } });
  const inventadoEstado = await api('PATCH', `/v1/solicitudes-credito/${appId}/recaudos/${rec.id}`, {
    token: u.Analista.token, body: { estado: 'verificado' } });
  registrar('R1.8', 'Recaudo de otra solicitud, o estado que no existe', '404, 422', `${cruzado.status}, ${inventadoEstado.status}`,
    cruzado.status === 404 && inventadoEstado.status === 422);

  fs.mkdirSync(new URL('../resultados/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../resultados/seguridad-r1.json', import.meta.url), JSON.stringify(resultados, null, 2));
  const fallas = resultados.filter((r) => r.ok === false).length;
  const pendientes = resultados.filter((r) => r.ok === null).length;
  console.log(`\nTotal: ${resultados.length} · fallas: ${fallas} · pendientes: ${pendientes}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
