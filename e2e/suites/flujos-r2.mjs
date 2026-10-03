// Verificación de la fase R2 (flujos y contratos) contra el backend local aislado (8081): el recorrido del MVP
// de punta a punta, por HTTP, con ingreso real (contraseña y 2FA) y un usuario por rol. Solo toca el PostgreSQL
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

async function api(method, path, { token, body, headers = {}, form, raw } = {}) {
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
  return { status: r.status, json, text, buf, headers: r.headers, raw };
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
  const usuario = `qa2.${clave.toLowerCase()}`;
  const c = await api('POST', '/v1/usuarios', {
    token: adminToken,
    body: { usuario, nombre: clave, apellido: 'QA', correo: `${usuario}@qa.invalid`, roles: [rol] },
  });
  if (c.status !== 201) throw new Error(`crear ${clave}: ${c.status} ${c.text}`);
  return primerIngreso(usuario, c.json.contrasenaTemporal, `Frase larga de prueba QA 2026 para ${clave.toLowerCase()}`);
}

const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
let telSeq = 0;
const telefono = () => `0414${String(8880000 + telSeq++).padStart(7, '0')}`;
let cedSeq = 0;
const cedula = () => `V-${30100000 + cedSeq++}`;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);

function formulario(campos, archivo, nombre, tipo) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  f.append('archivo', new Blob([archivo], { type: tipo }), nombre);
  return f;
}

/** La solicitud tal como la arma C9 (mismas claves que el contrato compartido con el backend). */
function solicitud(token, recaudos, extra = {}, precio = 8900) {
  // Desde R3 el servidor calcula el monto, la cuota y la capacidad: del navegador solo se toma la inicial (≥ 20 %).
  return {
    token,
    montoSolicitado: precio * 0.8,
    cuotaInicial: Math.ceil(precio * 0.2),
    plazoMeses: 24,
    frecuenciaPago: 'Mensual',
    cuotaEstimada: 466.97,
    capacidadPagoMensual: 1050,
    datosPersonales: { primerNombre: 'Lucía', primerApellido: 'Fernández', tipoDocumento: 'V', numeroDocumento: '30100001',
      rif: 'V-30100001-0', nacionalidad: 'Venezolana', estadoCivil: 'Soltero(a)', fechaNacimiento: '1990-03-02',
      lugarNacimiento: 'Caracas', nivelAcademico: 'Universitario', cargasFamiliares: 1, condicionVivienda: 'Alquilada' },
    datosContacto: { direccionHabitacion: 'Av. Principal, Los Palos Grandes', estado: 'Miranda', municipio: 'Chacao',
      telefonoCelular: '0414-8880001', correo: 'lucia@ejemplo.invalid' },
    datosLaborales: { situacionLaboral: 'Empleado Fijo', empresa: 'Clínica Ejemplo C.A.', cargo: 'Enfermera',
      antiguedadAnios: 4, antiguedadMeses: 0, direccionEmpresa: 'Av. Libertador', nombreJefeInmediato: 'Dr. Pérez' },
    datosFinancieros: { sueldoMensual: 3000, otrosIngresos: 500, conceptoOtrosIngresos: 'Guardias', alquilerHipoteca: 400,
      alimentacionServicios: 350, pagosDeudas: 0 },
    referencias: [
      { nombre: 'Ana Ruiz', parentesco: 'Amiga', telefono: '0412-1110001' },
      { nombre: 'Luis Soto', parentesco: 'Colega', telefono: '0424-1110002' },
      { nombre: 'Rosa Díaz', parentesco: 'Madre', telefono: '0416-1110003' },
    ],
    datosBancarios: { banco: '0134', tipoCuenta: 'Corriente', numeroCuenta: '01340000000000000001' },
    declaraciones: { veracidad: true, centralesRiesgo: true, origenFondos: true, compromisoPago: true, esPep: false,
      vinculoPep: false, consentimientoDatos: true },
    recaudos,
    versionTexto: 'WMA-F-FIN-001 v1',
    ...extra,
  };
}

async function main() {
  // ── 0. Cuentas: el administrador de arranque y un usuario por rol ─────────────────────
  const admin = await primerIngreso('admin.local', 'Clave local de desarrollo 2026', 'Frase del administrador local QA 2026');
  const u = { admin };
  for (const [clave, rol] of [['AsesorA', 'ASESOR_COMERCIAL'], ['AsesorB', 'ASESOR_COMERCIAL'],
    ['Coordinador', 'COORDINADOR_COMERCIAL'], ['Analista', 'ANALISTA_CREDITO'], ['Auditor', 'AUDITOR']]) {
    u[clave] = await crearUsuario(admin.token, clave, rol);
  }
  registrar('R2-00', 'Ingreso real con contraseña y 2FA para los seis roles', '6 sesiones', `${Object.keys(u).length} sesiones`,
    Object.values(u).every((x) => x.token));

  const catalogo = (await api('GET', '/v1/catalogo')).json;
  const libres = catalogo.vehiculos.filter((v) => v.disponibilidad === 'disponible');
  const [v1, v2, v3, v4] = libres.slice(10, 14);

  // ── A. Captación pública ──────────────────────────────────────────────────────────────
  const telA = telefono();
  const citaA = await api('POST', '/v1/citas', { body: { nombreApellido: 'Lucía Fernández', telefonoWhatsApp: telA,
    correo: 'lucia@ejemplo.invalid', diaPreferencia: manana, franjaHoraria: 'Mañana', modalidadPago: 'financiamiento',
    vehiculoCodigo: v1.codigo } });
  registrar('R2-01', 'Agendar con la franja «Mañana» (con tilde) la acepta como «manana»', '201, franja manana',
    `${citaA.status}, ${citaA.json?.franjaHoraria}`, citaA.status === 201 && citaA.json?.franjaHoraria === 'manana');

  const citaMala = await api('POST', '/v1/citas', { body: { nombreApellido: 'Otra Persona', telefonoWhatsApp: telefono(),
    diaPreferencia: manana, franjaHoraria: 'noche', modalidadPago: 'financiamiento', vehiculoCodigo: v2.codigo } });
  const v2Despues = (await api('GET', `/v1/catalogo/${v2.codigo}`)).json;
  registrar('R2-02', 'Una franja inválida es 422 y no reserva el vehículo', '422, sigue disponible',
    `${citaMala.status}, ${v2Despues?.disponibilidad}`, citaMala.status === 422 && v2Despues?.disponibilidad === 'disponible');

  const choque = await api('POST', '/v1/citas', { body: { nombreApellido: 'Segunda Persona', telefonoWhatsApp: telefono(),
    diaPreferencia: manana, franjaHoraria: 'tarde', modalidadPago: 'contado', vehiculoCodigo: v1.codigo } });
  registrar('R2-03', 'El mismo vehículo no se reserva dos veces', '409', `${choque.status}`, choque.status === 409, choque.json?.detail);

  const v1Despues = (await api('GET', `/v1/catalogo/${v1.codigo}`)).json;
  registrar('R2-04', 'El vehículo con cita queda marcado en la vitrina', 'cita_agendada o reservado',
    `${v1Despues?.disponibilidad ?? 'ya no aparece'}`, !v1Despues || ['cita_agendada', 'reservado'].includes(v1Despues.disponibilidad));

  const sinTel = await api('POST', '/v1/citas', { body: { nombreApellido: 'Sin Teléfono', telefonoWhatsApp: '123',
    diaPreferencia: manana, franjaHoraria: 'manana', modalidadPago: 'contado', vehiculoCodigo: v2.codigo } });
  registrar('R2-05', 'Un teléfono inválido es 422', '422', `${sinTel.status}`, sinTel.status === 422);

  // ── B. Seguimiento comercial ──────────────────────────────────────────────────────────
  const aCitas = await api('GET', '/v1/crm/citas', { token: u.AsesorA.token });
  const cita = aCitas.json?.find((c) => c.id === citaA.json.id);
  registrar('R2-06', 'El asesor ve la cita nueva (sin dueño) con sus datos completos', 'cita presente con vehiculoCodigo',
    cita ? `${cita.personaNombre} · ${cita.vehiculoCodigo} · ${cita.franjaHoraria}` : 'no aparece', Boolean(cita) && cita.vehiculoCodigo === v1.codigo);

  const oportunidadId = cita.oportunidadId;
  const personaId = cita.personaId;
  const tomar = await api('PUT', `/v1/crm/oportunidades/${oportunidadId}/asesor`, { token: u.AsesorA.token, body: {} });
  registrar('R2-07', 'El asesor A toma una oportunidad sin dueño', '200, asesor asignado', `${tomar.status}, ${tomar.json?.asesorNombre}`,
    tomar.status === 200 && Boolean(tomar.json?.asesorId));

  const bLista = await api('GET', '/v1/crm/oportunidades', { token: u.AsesorB.token });
  const bDirecto = await api('GET', `/v1/crm/oportunidades/${oportunidadId}`, { token: u.AsesorB.token });
  registrar('R2-08', 'El asesor B no ve la oportunidad ajena (ni en lista ni por id)', 'fuera de la lista y 404',
    `${bLista.json?.some((o) => o.id === oportunidadId) ? 'en lista' : 'fuera de lista'}, ${bDirecto.status}`,
    !bLista.json?.some((o) => o.id === oportunidadId) && bDirecto.status === 404);

  const coordAsesores = await api('GET', '/v1/crm/asesores', { token: u.Coordinador.token });
  const asesorSinPermiso = await api('GET', '/v1/crm/asesores', { token: u.AsesorA.token });
  registrar('R2-09', 'El coordinador lista a los asesores; el asesor no', '200 con asesores, 403',
    `${coordAsesores.status} (${coordAsesores.json?.length ?? 0}), ${asesorSinPermiso.status}`,
    coordAsesores.status === 200 && coordAsesores.json.length >= 2 && asesorSinPermiso.status === 403);

  // Vender antes de la visita
  const ventaTemprana = await api('POST', `/v1/crm/oportunidades/${oportunidadId}/venta`, { token: u.AsesorA.token, body: { modalidad: 'financiamiento' } });
  registrar('R2-10', 'No se vende antes de registrar la visita', '422', `${ventaTemprana.status}`, ventaTemprana.status === 422, ventaTemprana.json?.detail);

  // Confirmar con cédula y fusionar con otro registro de la misma persona
  const ced = cedula();
  const conf = await api('POST', `/v1/crm/citas/${citaA.json.id}/confirmacion`, { token: u.AsesorA.token,
    body: { cedula: ced, correo: 'lucia@ejemplo.invalid' } });
  registrar('R2-11', 'Confirmar la cita con la cédula', '200', `${conf.status}`, conf.status === 200);

  const telOtro = telefono();
  const citaDup = await api('POST', '/v1/citas', { body: { nombreApellido: 'Lucía F.', telefonoWhatsApp: telOtro,
    diaPreferencia: manana, franjaHoraria: 'tarde', modalidadPago: 'contado', vehiculoCodigo: v3.codigo } });
  const antesDeFusion = (await api('GET', '/v1/crm/citas', { token: u.AsesorA.token })).json?.find((c) => c.id === citaDup.json?.id);
  const personaAbsorbida = antesDeFusion?.personaId;
  const confDup = await api('POST', `/v1/crm/citas/${citaDup.json?.id}/confirmacion`, { token: u.AsesorA.token, body: { cedula: ced } });
  const personasA = (await api('GET', '/v1/crm/personas', { token: u.AsesorA.token })).json ?? [];
  const conCedula = personasA.filter((p) => p.cedula && p.cedula.replace(/\D/g, '') === ced.replace(/\D/g, ''));
  registrar('R2-12', 'La misma cédula en otro registro fusiona a la persona (una sola, con los dos teléfonos)',
    '1 persona con 2 teléfonos', `${conCedula.length} persona(s), ${conCedula[0]?.telefonos?.length ?? 0} teléfono(s)`,
    confDup.status === 200 && conCedula.length === 1 && (conCedula[0]?.telefonos?.length ?? 0) >= 2);

  // El registro absorbido ya no tiene nada propio: su ficha solo remite a la persona vigente.
  const fichaAbsorbida = await api('GET', `/v1/crm/personas/${personaAbsorbida}`, { token: u.AsesorA.token });
  registrar('R2-13', 'El registro absorbido en la fusión remite a la persona vigente (sin datos de contacto propios)',
    '200, fusionado, fusionadaCon = persona vigente, sin cédula ni teléfonos',
    `${fichaAbsorbida.status}, ${fichaAbsorbida.json?.estado}, fusionadaCon ${fichaAbsorbida.json?.fusionadaCon === personaId ? '= vigente' : fichaAbsorbida.json?.fusionadaCon}`,
    fichaAbsorbida.status === 200 && fichaAbsorbida.json?.estado === 'fusionado' && fichaAbsorbida.json?.fusionadaCon === personaId &&
      fichaAbsorbida.json?.cedula === null && (fichaAbsorbida.json?.telefonos ?? []).length === 0);

  // Asistencia y venta financiada
  const asist = await api('POST', `/v1/crm/citas/${citaA.json.id}/asistencia`, { token: u.AsesorA.token });
  registrar('R2-14', 'Registrar la asistencia a la cita', '204', `${asist.status}`, asist.status === 204);

  const venta = await api('POST', `/v1/crm/oportunidades/${oportunidadId}/venta`, { token: u.AsesorA.token, body: { modalidad: 'financiamiento' } });
  const tokenEnlace = venta.json?.tokenFinanciamiento;
  registrar('R2-15', 'Vender con financiamiento emite el enlace personal (se muestra una vez)', '200, etapa negociacion, token',
    `${venta.status}, ${venta.json?.oportunidad?.etapa}, token ${tokenEnlace ? 'sí' : 'no'}`,
    venta.status === 200 && venta.json?.oportunidad?.etapa === 'negociacion' && Boolean(tokenEnlace));

  const lecturaPosterior = (await api('GET', '/v1/crm/oportunidades', { token: u.AsesorA.token })).json?.find((o) => o.id === oportunidadId);
  registrar('R2-16', 'Releer la oportunidad no devuelve el texto del enlace, solo que existe y cuándo vence',
    'tieneEnlaceFinanciamiento, sin token', `${lecturaPosterior?.tieneEnlaceFinanciamiento}, ${JSON.stringify(lecturaPosterior).includes(tokenEnlace) ? 'el token aparece' : 'sin token'}`,
    lecturaPosterior?.tieneEnlaceFinanciamiento === true && !JSON.stringify(lecturaPosterior).includes(tokenEnlace));

  // Reemisión: el enlace anterior deja de servir
  const reemision = await api('POST', `/v1/crm/oportunidades/${oportunidadId}/venta`, { token: u.AsesorA.token, body: { modalidad: 'financiamiento' } });
  const tokenNuevo = reemision.json?.tokenFinanciamiento;
  const viejo = await api('GET', `/v1/solicitudes-credito/enlace/${tokenEnlace}`);
  const nuevo = await api('GET', `/v1/solicitudes-credito/enlace/${tokenNuevo}`);
  registrar('R2-17', 'Emitir un enlace nuevo invalida el anterior', 'viejo 404, nuevo válido',
    `${viejo.status}, valid=${nuevo.json?.valid}`, reemision.status === 200 && viejo.status === 404 && nuevo.json?.valid === true);

  // ── C. Solicitud de crédito ───────────────────────────────────────────────────────────
  const enlace = nuevo.json;
  registrar('R2-18', 'El enlace trae el vehículo, el precio, la política y a la persona', 'vehículo, política y solicitante',
    `${enlace.vehicle?.code} ${enlace.vehicle?.priceEur} €; ${enlace.financingParams?.defaultTermMonths} meses; ${enlace.applicant?.fullName}`,
    enlace.vehicle?.code === v1.codigo && Number(enlace.vehicle?.priceEur) === Number(v1.precio) &&
      enlace.financingParams?.defaultTermMonths === 24 && Boolean(enlace.applicant?.fullName));

  const invalido = await api('POST', '/v1/solicitudes-credito/recaudos', { form: formulario({ token: tokenNuevo, tipoDocumento: 'cedula' }, Buffer.from('texto plano'), 'cedula.txt', 'text/plain') });
  registrar('R2-19', 'Un archivo que no es PDF, JPG ni PNG se rechaza por su contenido', '422', `${invalido.status}`, invalido.status === 422, invalido.json?.detail);

  const subida = await api('POST', '/v1/solicitudes-credito/recaudos', { form: formulario({ token: tokenNuevo, tipoDocumento: 'cedula' }, JPEG, 'mi cedula.jpg', 'application/pdf') });
  registrar('R2-20', 'Un JPG se acepta y el tipo lo decide el contenido', '200, image/jpeg', `${subida.status}, ${subida.json?.mimeType}`,
    subida.status === 200 && subida.json?.mimeType === 'image/jpeg');

  const plazoMalo = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenNuevo, [subida.json], { plazoMeses: 36 }, Number(v1.precio)) });
  registrar('R2-21', 'Un plazo distinto de 24 meses se rechaza (D-55)', '422', `${plazoMalo.status}`, plazoMalo.status === 422, plazoMalo.json?.detail);

  const enviada = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenNuevo, [subida.json], {}, Number(v1.precio)) });
  registrar('R2-22', 'La solicitud se envía: estado «enviada» y número', '200, SOL-…', `${enviada.status}, ${enviada.json?.numeroSolicitud}, ${enviada.json?.estado}`,
    enviada.status === 200 && /^SOL-\d{4}-\d+$/.test(enviada.json?.numeroSolicitud ?? '') && enviada.json?.estado === 'enviada');

  const reenvio = await api('POST', '/v1/solicitudes-credito', { body: solicitud(tokenNuevo, [subida.json], {}, Number(v1.precio)) });
  const usado = await api('GET', `/v1/solicitudes-credito/enlace/${tokenNuevo}`);
  registrar('R2-23', 'El enlace ya usado no admite otro envío y dice por qué', '422, usado',
    `${reenvio.status}, ${usado.json?.valid}/${usado.json?.invalidReason}`, reenvio.status === 422 && usado.json?.invalidReason === 'usado');

  const opLuego = (await api('GET', '/v1/crm/oportunidades', { token: u.AsesorA.token })).json?.find((o) => o.id === oportunidadId);
  registrar('R2-24', 'El asesor ve en la oportunidad solo el número y el estado del crédito', 'SOL-… / enviada',
    `${opLuego?.solicitudCreditoNumero} / ${opLuego?.solicitudCreditoEstado}`,
    opLuego?.solicitudCreditoEstado === 'enviada' && opLuego?.solicitudCreditoNumero === enviada.json?.numeroSolicitud);

  const expAsesor = await api('GET', `/v1/solicitudes-credito/${enviada.json?.id}`, { token: u.AsesorA.token });
  registrar('R2-25', 'El asesor no puede leer el expediente de crédito', '403', `${expAsesor.status}`, expAsesor.status === 403);

  // ── D. Análisis y dictamen ────────────────────────────────────────────────────────────
  const bandeja = await api('GET', '/v1/solicitudes-credito', { token: u.Analista.token });
  const fila = bandeja.json?.find((s) => s.id === enviada.json?.id);
  registrar('R2-26', 'El analista ve la solicitud en su bandeja con el código del vehículo y sus recaudos', `${v1.codigo}, 1 recaudo`,
    fila ? `${fila.vehiculoCodigo}, ${fila.totalRecaudos} recaudo(s), ${fila.estado}` : 'no aparece',
    Boolean(fila) && fila.vehiculoCodigo === v1.codigo && fila.totalRecaudos === 1 && fila.estado === 'enviada');

  const filtrada = await api('GET', '/v1/solicitudes-credito?estado=enviada', { token: u.Analista.token });
  registrar('R2-27', 'El filtro «Nuevas» usa el estado que el servidor emite', 'incluye la solicitud',
    `${filtrada.json?.length} solicitud(es)`, filtrada.json?.some((s) => s.id === enviada.json?.id));

  const detalle = await api('GET', `/v1/solicitudes-credito/${enviada.json?.id}`, { token: u.Analista.token });
  const d = detalle.json;
  registrar('R2-28', 'El expediente trae lo que escribió la persona, con las claves del formulario', 'sueldo 3000, banco 0134, versión del texto',
    `${d?.datosFinancieros?.sueldoMensual}, ${d?.datosBancarios?.banco}, ${d?.evidenciaAceptacion?.versionTexto}`,
    d?.datosFinancieros?.sueldoMensual === 3000 && d?.datosBancarios?.banco === '0134' && d?.evidenciaAceptacion?.versionTexto === 'WMA-F-FIN-001 v1' &&
      d?.datosPersonales?.primerNombre === 'Lucía');

  registrar('R2-29', 'La evidencia de aceptación trae fecha, IP y agente (sin OTP inventado)', 'aceptadoEn, ip, userAgent',
    JSON.stringify({ ip: d?.evidenciaAceptacion?.ip, ua: Boolean(d?.evidenciaAceptacion?.userAgent), en: Boolean(d?.evidenciaAceptacion?.aceptadoEn) }),
    Boolean(d?.evidenciaAceptacion?.aceptadoEn) && Boolean(d?.evidenciaAceptacion?.ip) && !('otp' in (d?.evidenciaAceptacion ?? {})));

  const doc = d?.recaudos?.[0];
  const malEstado = await api('PATCH', `/v1/solicitudes-credito/${d.id}/recaudos/${doc.id}`, { token: u.Analista.token, body: { estado: 'verificado' } });
  const bienEstado = await api('PATCH', `/v1/solicitudes-credito/${d.id}/recaudos/${doc.id}`, { token: u.Analista.token, body: { estado: 'conforme' } });
  const refrescado = (await api('GET', `/v1/solicitudes-credito/${d.id}`, { token: u.Analista.token })).json;
  registrar('R2-30', 'El recaudo se marca «conforme» (no «verificado») y queda guardado', '422, 200, conforme',
    `${malEstado.status}, ${bienEstado.status}, ${refrescado?.recaudos?.[0]?.validationStatus}`,
    malEstado.status === 422 && bienEstado.status === 200 && refrescado?.recaudos?.[0]?.validationStatus === 'conforme');

  const enlaceDoc = await api('GET', `/v1/solicitudes-credito/${d.id}/recaudos/${doc.id}/enlace`, { token: u.Analista.token });
  const archivo = enlaceDoc.json?.ruta ? await api('GET', enlaceDoc.json.ruta) : { status: 0, headers: new Headers() };
  registrar('R2-31', 'El analista abre el recaudo con el enlace firmado', '200, image/jpeg',
    `${archivo.status}, ${archivo.headers.get('content-type')}`, archivo.status === 200 && /image\/jpeg/.test(archivo.headers.get('content-type') ?? ''));

  const dictamen = await api('POST', `/v1/solicitudes-credito/${d.id}/evaluacion`, { token: u.Analista.token, body: {
    resultado: 'aprobado', justificacion: 'Capacidad de pago demostrada y recaudos conformes.', limiteAprobado: Number(d.montoSolicitado), cuotaMaximaPermitida: Number(d.capacidadPagoMensual) } });
  const tras = (await api('GET', `/v1/solicitudes-credito/${d.id}`, { token: u.Analista.token })).json;
  registrar('R2-32', 'El analista aprueba con su justificación y el estado pasa a «aprobada»', '200, aprobada, aprobado',
    `${dictamen.status}, ${tras?.estado}, ${tras?.decisionRiesgo?.result}`, dictamen.status === 200 && tras?.estado === 'aprobada' && tras?.decisionRiesgo?.result === 'aprobado');

  const dictAsesor = await api('POST', `/v1/solicitudes-credito/${d.id}/evaluacion`, { token: u.AsesorA.token, body: { resultado: 'rechazado', justificacion: 'no debe poder' } });
  const dictAuditor = await api('POST', `/v1/solicitudes-credito/${d.id}/evaluacion`, { token: u.Auditor.token, body: { resultado: 'rechazado', justificacion: 'no debe poder' } });
  registrar('R2-33', 'Solo el analista dictamina: asesor y auditor reciben 403', '403, 403', `${dictAsesor.status}, ${dictAuditor.status}`,
    dictAsesor.status === 403 && dictAuditor.status === 403);

  const opAprobada = (await api('GET', '/v1/crm/oportunidades', { token: u.AsesorA.token })).json?.find((o) => o.id === oportunidadId);
  registrar('R2-34', 'El asesor ve el crédito aprobado en su oportunidad', 'aprobada', `${opAprobada?.solicitudCreditoEstado}`, opAprobada?.solicitudCreditoEstado === 'aprobada');

  const cierre = await api('PATCH', `/v1/crm/oportunidades/${oportunidadId}/etapa`, { token: u.AsesorA.token, headers: { 'If-Match': `"${opAprobada.version}"` },
    body: { etapa: 'cerrado_ganado', nota: 'Crédito aprobado: se cierra la venta.' } });
  const vendido = (await api('GET', `/v1/catalogo/${v1.codigo}`)).status;
  registrar('R2-35', 'Con el crédito aprobado el asesor cierra la venta y el vehículo sale de la vitrina', '200, cerrado_ganado, 404 en la vitrina',
    `${cierre.status}, ${cierre.json?.etapa}, ${vendido}`, cierre.status === 200 && cierre.json?.etapa === 'cerrado_ganado' && vendido === 404);

  // Venta de contado
  const telC = telefono();
  const citaC = await api('POST', '/v1/citas', { body: { nombreApellido: 'Mario Contado', telefonoWhatsApp: telC, diaPreferencia: manana,
    franjaHoraria: 'manana', modalidadPago: 'contado', vehiculoCodigo: v4.codigo } });
  const listaC = (await api('GET', '/v1/crm/citas', { token: u.AsesorA.token })).json?.find((c) => c.id === citaC.json?.id);
  await api('PUT', `/v1/crm/oportunidades/${listaC.oportunidadId}/asesor`, { token: u.AsesorA.token, body: {} });
  await api('POST', `/v1/crm/citas/${citaC.json.id}/confirmacion`, { token: u.AsesorA.token, body: { cedula: cedula() } });
  await api('POST', `/v1/crm/citas/${citaC.json.id}/asistencia`, { token: u.AsesorA.token });
  const ventaC = await api('POST', `/v1/crm/oportunidades/${listaC.oportunidadId}/venta`, { token: u.AsesorA.token, body: { modalidad: 'contado' } });
  registrar('R2-36', 'La venta de contado cierra la oportunidad sin enlace', '200, cerrado_ganado, sin token',
    `${ventaC.status}, ${ventaC.json?.oportunidad?.etapa}, ${ventaC.json?.tokenFinanciamiento ? 'con token' : 'sin token'}`,
    ventaC.status === 200 && ventaC.json?.oportunidad?.etapa === 'cerrado_ganado' && !ventaC.json?.tokenFinanciamiento);

  // ── E. Parámetros ─────────────────────────────────────────────────────────────────────
  const publica = await api('GET', '/v1/parametros-financiamiento');
  const putAsesor = await api('PUT', '/v1/parametros-financiamiento', { token: u.AsesorA.token, body: { tasa_mensual: 0.09, plazo_meses: 24,
    ratio_cuota_ingreso: 0.3, opciones_inicial: [0.2, 0.3, 0.4], inicial_minima: 0.2, moneda_base: 'EUR' } });
  registrar('R2-37', 'La política es pública para leer; cambiarla exige el permiso', '200, 403', `${publica.status}, ${putAsesor.status}`,
    publica.status === 200 && putAsesor.status === 403);
  registrar('R2-38', 'La moneda base de la política es el euro (Constitución v3.0.0)', 'EUR', `${publica.json?.moneda_base}`, publica.json?.moneda_base === 'EUR',
    'Si falla: el valor de origen de V0015 es USD; se corrige con migración en R3.');

  const fallas = resultados.filter((r) => r.ok === false).length;
  console.log(`\nTotal: ${resultados.length} casos · ${resultados.filter((r) => r.ok).length} pasan · ${fallas} fallan · ${resultados.filter((r) => r.ok === null).length} pendientes`);
  fs.mkdirSync(new URL('../resultados/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../resultados/flujos-r2.json', import.meta.url), JSON.stringify(resultados, null, 2));
  if (fallas > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('ERROR DEL GUION:', e);
  process.exitCode = 2;
});
