// Recorrido completo del MVP en navegador, por la interfaz real, contra el backend local aislado (con la configuración
// por defecto) y Vite. De la vitrina a la venta cerrada. Cubre:
//  · D-73 / E1: «Tomar» y «repartir» no existen (ni botón ni permiso ni endpoint).
//  · D-69 / D-75: WhatsApp y correo se abren solos con el mensaje redactado (confirmar cita, enlace, dictamen).
//  · D-70 / E3: al condicionar, el cliente completa los recaudos de la MISMA solicitud con un enlace.
//  · D-71 / E2: el analista reabre un expediente aprobado y lo dictamina de nuevo.
//  · R4.5: todo campo de formulario tiene nombre accesible.
// Crea sus propias cuentas por API (ingreso real con 2FA). Direcciones y navegador, por variables de entorno
// (E2E_WEB, E2E_API, E2E_NAVEGADOR; ver e2e/README.md).
import { chromium } from 'playwright-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const WEB = process.env.E2E_WEB ?? 'http://localhost:5199';
const API = process.env.E2E_API ?? 'http://localhost:8081';
const DIR = fileURLToPath(new URL('../resultados/capturas/', import.meta.url));
fs.mkdirSync(DIR, { recursive: true });
const casos = [];
const anotar = (id, desc, ok, obtenido) => {
  casos.push({ id, desc, ok, obtenido });
  console.log(`${ok ? 'PASA ' : 'FALLA'} ${id} ${desc} → ${obtenido}`);
};

// ── API mínima para crear cuentas ─────────────────────────────────────────────────────────
async function api(method, path, { token, body } = {}) {
  const h = { Accept: 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { /* */ }
  return { status: r.status, json, text };
}
function base32Decode(s) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, '0');
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secreto) {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = crypto.createHmac('sha1', base32Decode(secreto)).update(buf).digest(); const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}
async function primerIngreso(usuario, temporal, nueva) {
  const l = await api('POST', '/v1/auth/ingreso', { body: { usuario, contrasena: temporal } });
  const tt = l.json.tokenTemporal; let sig = l.json.siguiente;
  if (sig === 'CAMBIAR_CONTRASENA') sig = (await api('POST', '/v1/auth/contrasena-inicial', { token: tt, body: { nueva } })).json.siguiente;
  const a = await api('POST', '/v1/auth/2fa/activacion', { token: tt });
  const f = await api('POST', '/v1/auth/2fa/confirmacion', { token: tt, body: { codigo: totp(a.json.secreto) } });
  return { usuario, contrasena: nueva, secreto: a.json.secreto, token: f.json.token };
}
async function crearUsuario(adminToken, clave, rol) {
  const usuario = `f2.${clave.toLowerCase()}${String(Date.now()).slice(-5)}`;
  const c = await api('POST', '/v1/usuarios', { token: adminToken, body: { usuario, nombre: clave, apellido: 'QA', correo: `${usuario}@qa.invalid`, roles: [rol] } });
  return primerIngreso(usuario, c.json.contrasenaTemporal, `Frase larga de prueba QA 2026 para ${clave.toLowerCase()}`);
}

// ── Navegador ─────────────────────────────────────────────────────────────────────────────
async function ingresar(page, { usuario, contrasena, secreto }) {
  await page.goto(`${WEB}/admin/ingresar`, { waitUntil: 'networkidle' });
  await page.fill('#ingreso-usuario', usuario);
  await page.fill('#ingreso-contrasena', contrasena);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForSelector('#codigo-2fa');
  for (let i = 0; i < 2; i++) {
    await page.fill('#codigo-2fa', totp(secreto));
    await page.getByRole('button', { name: 'Verificar', exact: true }).click();
    try { await page.getByRole('button', { name: 'Cerrar sesión' }).waitFor({ timeout: 8000 }); return; }
    catch { await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_000); }
  }
  throw new Error(`No se pudo ingresar como ${usuario}`);
}
const campo = (page, etiqueta, n = 0) =>
  page.locator(`div.form-group:has(> label:text-is("${etiqueta}")) :is(input, select, textarea)`).nth(n);
/**
 * R4.5: todo campo de formulario tiene un nombre que un lector de pantalla puede decir (etiqueta enlazada o envolvente,
 * aria-label, aria-labelledby o title). Acumula los que no lo tienen, con la pantalla donde se vieron.
 */
const sinNombreAccesible = [];
let camposRevisados = 0;
async function revisar(page, pantalla) {
  const r = await page.evaluate(() => {
    const campos = [...document.querySelectorAll('input, select, textarea')].filter((el) => el.type !== 'hidden');
    const sin = campos.filter((el) => !(el.labels && el.labels.length > 0) && !el.getAttribute('aria-label')
      && !el.getAttribute('aria-labelledby') && !el.getAttribute('title'))
      .map((el) => `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''} «${(el.placeholder || el.name || el.id || '').slice(0, 30)}»`);
    return { total: campos.length, sin };
  });
  camposRevisados += r.total;
  for (const s of r.sin) sinNombreAccesible.push(`${pantalla}: ${s}`);
}
/** wa.me no se contacta de verdad: la prueba solo mira la dirección a la que el navegador fue a abrir. */
const sinRed = (ctx) => ctx.route('https://wa.me/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
/** Ejecuta la acción y devuelve la dirección de WhatsApp que se abrió sola (o null si no se abrió). */
async function whatsappAbierto(ctx, accion) {
  const espera = ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await accion();
  const p = await espera;
  if (!p) return null;
  // La ventana nace en blanco y navega a wa.me: la dirección se lee cuando ya llegó.
  await p.waitForURL(/wa\.me/, { timeout: 10000 }).catch(() => {});
  const url = decodeURIComponent(p.url());
  await p.close().catch(() => {});
  return url;
}
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
const sufijo = String(Date.now()).slice(-6);
const nombreCliente = `Lucía Prueba${sufijo}`;
const telefono = `0414${sufijo}1`.slice(0, 11);
const correoCliente = `lucia.${sufijo}@ejemplo.invalid`;
const cedula = `V-${30000000 + Number(sufijo)}`;
const ruta = (e) => e.replace(/^https?:\/\/[^/]+/, '');

const admin = await primerIngreso('admin.local', 'Clave local de desarrollo 2026', 'Frase del administrador local QA 2026');
const asesor = await crearUsuario(admin.token, 'AsesorF2', 'ASESOR_COMERCIAL');
const coordinador = await crearUsuario(admin.token, 'CoordF2', 'COORDINADOR_COMERCIAL');
const analista = await crearUsuario(admin.token, 'AnalistaF2', 'ANALISTA_CREDITO');
const catalogo = (await api('GET', '/v1/catalogo')).json;
const vehiculo = catalogo.vehiculos.find((v) => v.disponibilidad === 'disponible' && v.precio > 5000 && v.precio < 12000);

// Con Chrome instalado (por defecto) o, con E2E_NAVEGADOR vacío, el Chromium que baja `playwright-core install`.
const canal = process.env.E2E_NAVEGADOR ?? 'chrome';
const browser = await chromium.launch(canal ? { channel: canal, headless: true } : { headless: true });
let enlace = '', enlaceRecaudos = '', numeroSolicitud = '';

// ── 1. Visitante: vitrina y cita ──────────────────────────────────────────────────────────
const ctxV = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctxV2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const rancia = await ctxV2.newPage();
{
  const page = await ctxV.newPage();
  await page.goto(`${WEB}/catalogo`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article.tarjeta-vehiculo');
  const tarjetas = await page.locator('article.tarjeta-vehiculo').count();
  const texto = await page.locator('main').innerText();
  await page.screenshot({ path: `${DIR}F2-01-vitrina.png` });
  anotar('UI-F2.1', 'La vitrina muestra los vehículos del servidor, con cuota «desde» de la política vigente', tarjetas === catalogo.vehiculos.length && /Desde [\d.]+\s*€/.test(texto), `${tarjetas} tarjetas de ${catalogo.vehiculos.length}`);

  await rancia.goto(`${WEB}/vehiculo/${vehiculo.codigo}`, { waitUntil: 'networkidle' });
  await page.goto(`${WEB}/vehiculo/${vehiculo.codigo}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Agendar cita' }).first().click();
  await revisar(page, 'modal de cita');
  await page.fill('#nombreApellido', nombreCliente);
  await page.fill('#telefonoWhatsApp', telefono);
  await page.fill('#correo', correoCliente);
  await page.getByRole('button', { name: 'Confirmar y Agendar Cita' }).click();
  await page.getByText('¡Tu solicitud ha sido recibida!').waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${DIR}F2-02-cita-agendada.png` });
  const cuerpo = await page.locator('.modal-exito').innerText();
  anotar('UI-F2.2', 'La cita se agenda en el servidor y el éxito dice el turno que registró (mañana)', /turno\s+mañana/i.test(cuerpo), cuerpo.replace(/\s+/g, ' ').slice(0, 110));

  await rancia.getByRole('button', { name: 'Agendar cita' }).first().click();
  await rancia.fill('#nombreApellido', 'Otra Persona Prueba');
  await rancia.fill('#telefonoWhatsApp', `0412${sufijo}2`.slice(0, 11));
  await rancia.getByRole('button', { name: 'Confirmar y Agendar Cita' }).click();
  await rancia.locator('[role=alert].alerta-error-envio').waitFor({ timeout: 15000 });
  const err = await rancia.locator('.alerta-error-envio').innerText();
  anotar('UI-F2.3', 'Agendar un vehículo ya reservado muestra el motivo del servidor', /ya tiene una cita|no está disponible/i.test(err), err);
}
await ctxV2.close();

// ── 2. Asesor: sin «Tomar», confirma, vende, y WhatsApp/correo se abren solos ─────────────
const ctxA = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
await sinRed(ctxA);
const pa = await ctxA.newPage();
await ingresar(pa, asesor);
await pa.goto(`${WEB}/admin/citas`, { waitUntil: 'networkidle' });
const tarjeta = () => pa.locator('.tarjeta-cita', { hasText: nombreCliente });
await tarjeta().waitFor({ timeout: 15000 });
const textoTarjeta = await tarjeta().innerText();
await pa.screenshot({ path: `${DIR}F2-03-bandeja-sin-tomar.png` });
anotar('UI-F2.4', '«Tomar» y «repartir» no existen: la oportunidad queda sin asesor y sin botón para tomarla (D-73, E1)',
  /Sin asesor asignado/.test(textoTarjeta) && !(await tarjeta().getByRole('button', { name: /Tomar esta oportunidad/ }).count()) && !(await tarjeta().locator('select[aria-label="Asignar a un asesor"]').count()),
  'sin botón «Tomar» ni «Asignar a…»');

{
  // El servidor también lo cierra: el coordinador no recibe el permiso y la asignación se rechaza.
  const yo = await api('GET', '/v1/auth/yo', { token: coordinador.token });
  const asesores = await api('GET', '/v1/crm/asesores', { token: coordinador.token });
  const lista = (await api('GET', '/v1/crm/oportunidades', { token: asesor.token })).json;
  const opp = lista.find((o) => /Lucía/.test(o.personaNombre ?? ''));
  const tomar = await api('PUT', `/v1/crm/oportunidades/${opp.id}/asesor`, { token: asesor.token, body: {} });
  anotar('UI-F2.5', 'El servidor lo cierra igual: el coordinador no recibe crm.asignar, no lista asesores y tomar se rechaza (403)',
    !(yo.json.permisos ?? []).includes('crm.asignar') && asesores.status === 403 && tomar.status === 403,
    `permiso: ${(yo.json.permisos ?? []).includes('crm.asignar')} · asesores ${asesores.status} · tomar ${tomar.status}`);
}

await pa.goto(`${WEB}/admin/financiamiento`, { waitUntil: 'networkidle' });
await revisar(pa, 'cotizador del asesor');
await pa.goto(`${WEB}/admin/citas`, { waitUntil: 'networkidle' });
await tarjeta().waitFor({ timeout: 15000 });
await tarjeta().getByRole('button', { name: /Confirmar Cita/ }).click();
await revisar(pa, 'confirmar cita');
await tarjeta().locator('input[id^="ced-"]').fill(cedula);
let url = await whatsappAbierto(ctxA, () => tarjeta().getByRole('button', { name: 'Confirmar cita', exact: true }).click());
await pa.getByText(/Cita confirmada/).waitFor({ timeout: 15000 });
const avisoConfirmar = (await pa.locator('.aviso-crm').first().innerText()).replace(/\s+/g, ' ');
await pa.screenshot({ path: `${DIR}F2-04-cita-confirmada.png` });
anotar('UI-F2.6', 'Al confirmar la cita se abre solo WhatsApp (número normalizado) con la confirmación, y el aviso lo dice',
  !!url && url.startsWith(`https://wa.me/58${telefono.slice(1)}?text=`) && /quedó confirmada/.test(url) && /Se abrió WhatsApp/.test(avisoConfirmar),
  (url ?? 'no se abrió').slice(0, 130));
anotar('UI-F2.7', 'Con correo del cliente, además se abre el programa de correo y la página sigue en pie', /Se abrió tu correo/.test(avisoConfirmar) && (await pa.getByText(/Cita confirmada/).count()) > 0, avisoConfirmar.slice(0, 140));

await tarjeta().getByRole('button', { name: /Asistió a la cita/ }).click();
await pa.getByText(/Asistencia registrada/).waitFor({ timeout: 15000 });
await tarjeta().getByRole('button', { name: /Vender Vehículo/ }).click();
await tarjeta().getByLabel('Financiamiento WAMMA').check();
url = await whatsappAbierto(ctxA, () => tarjeta().getByRole('button', { name: 'Emitir enlace de financiamiento' }).click());
await tarjeta().locator('code.bf-enlace').waitFor({ timeout: 15000 });
enlace = (await tarjeta().locator('code.bf-enlace').innerText()).trim();
await pa.screenshot({ path: `${DIR}F2-05-enlace-emitido.png` });
anotar('UI-F2.8', 'Al vender con financiamiento se abre solo WhatsApp con el enlace personal ya en el mensaje',
  !!url && /enlace personal para solicitar el financiamiento/.test(url) && url.includes(enlace), (url ?? 'no se abrió').slice(0, 130));

// ── 3. Cliente: formulario completo con el enlace ─────────────────────────────────────────
const ctxC = await browser.newContext({ viewport: { width: 420, height: 900 } });
const pc = await ctxC.newPage();
await pc.goto(`${WEB}${ruta(enlace)}`, { waitUntil: 'networkidle' });
await pc.getByText('Solicitud de financiamiento', { exact: true }).waitFor({ timeout: 15000 });
const paso0 = await pc.locator('main').innerText();
anotar('UI-F2.9', 'El formulario muestra el vehículo del enlace y el plazo fijo de 24 meses (sin cambios)', paso0.includes(vehiculo.modelo) && /24 meses/.test(await campo(pc, 'Plazo (fijo)').inputValue()), `${vehiculo.marca} ${vehiculo.modelo}`);
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
await campo(pc, 'Primer apellido *').fill('Apellido Prueba');
await campo(pc, 'Fecha de nacimiento *').fill('1990-03-02');
await campo(pc, 'Lugar de nacimiento *').fill('Caracas');
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
await campo(pc, 'Dirección de habitación *').fill('Av. Principal, Los Palos Grandes');
await campo(pc, 'Estado *').selectOption('Miranda');
await campo(pc, 'Ciudad / Municipio *').selectOption('Chacao');
await campo(pc, 'Correo electrónico *').fill(correoCliente);
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
await campo(pc, 'Empresa o negocio *').fill('Clínica Ejemplo C.A.');
await campo(pc, 'Cargo desempeñado *').fill('Enfermera');
await campo(pc, 'Antigüedad (años) *').fill('4');
await campo(pc, 'Dirección de la empresa *').fill('Av. Libertador, Caracas');
await campo(pc, 'Jefe directo *').fill('Dr. Pérez');
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
await campo(pc, 'Sueldo o ingreso mensual (EUR) *').fill('3000');
await campo(pc, 'Alimentación y servicios (EUR) *').fill('350');
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
const refs = [['Ana Ruiz', 'Amiga', '04121110001'], ['Luis Soto', 'Colega', '04241110002'], ['Rosa Díaz', 'Madre', '04161110003']];
for (let i = 0; i < 3; i++) {
  await campo(pc, 'Nombre y apellido *', i).fill(refs[i][0]);
  await campo(pc, 'Parentesco o relación *', i).fill(refs[i][1]);
  await campo(pc, 'Teléfono *', i).fill(refs[i][2]);
}
await campo(pc, 'Institución bancaria *').selectOption('0134');
await campo(pc, 'Número de cuenta (20 dígitos) *').fill('01340000000000000001');
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
await pc.locator('input[type=file]').nth(0).setInputFiles({ name: 'cedula.jpg', mimeType: 'image/jpeg', buffer: JPEG });
await pc.getByText('📎 cedula.jpg').waitFor({ timeout: 15000 });
await pc.locator('input[type=file]').nth(1).setInputFiles({ name: 'rif.jpg', mimeType: 'image/jpeg', buffer: JPEG });
await pc.getByText('📎 rif.jpg').waitFor({ timeout: 15000 });
await pc.getByRole('button', { name: 'Continuar' }).click();
await revisar(pc, 'solicitud de crédito');
const cajas = pc.locator('input[type=checkbox]');
for (const i of [0, 1, 2, 3, 6]) await cajas.nth(i).check();
await pc.getByRole('button', { name: 'Enviar solicitud' }).click();
await pc.getByText('Solicitud recibida').waitFor({ timeout: 20000 });
numeroSolicitud = (await pc.locator('main div', { hasText: /^SOL-\d{4}-\d+$/ }).first().innerText()).trim();
await pc.screenshot({ path: `${DIR}F2-06-solicitud-recibida.png` });
anotar('UI-F2.10', 'La solicitud llega al servidor con su número oficial (formulario sin cambios)', /^SOL-\d{4}-\d+$/.test(numeroSolicitud), numeroSolicitud);
await ctxC.close();

// ── 4. Analista: condiciona → WhatsApp con el enlace de recaudos ─────────────────────────
const ctxN = await browser.newContext({ viewport: { width: 1366, height: 1100 } });
await sinRed(ctxN);
const pn = await ctxN.newPage();
await ingresar(pn, analista);
await pn.goto(`${WEB}/admin/solicitudes`, { waitUntil: 'networkidle' });
const fila = pn.locator('tr', { hasText: numeroSolicitud });
await fila.waitFor({ timeout: 15000 });
await fila.getByRole('button', { name: 'Revisar' }).click();
const modal = pn.getByRole('dialog', { name: 'Expediente de crédito' });
await modal.getByText(`Expediente ${numeroSolicitud}`).waitFor({ timeout: 15000 });
anotar('UI-F2.11', 'El analista abre el expediente con lo que escribió la persona', /3\.000,00/.test(await modal.innerText()), 'expediente visible');
await revisar(pn, 'expediente y dictamen');

await modal.locator('#cred-resultado').selectOption('condicionado');
await modal.locator('#cred-justificacion').fill('Falta una copia legible de la cédula y el estado de cuenta.');
url = await whatsappAbierto(ctxN, () => modal.getByRole('button', { name: 'Registrar dictamen' }).click());
await modal.locator('.cred-aviso-exito').getByText(/Dictamen registrado/).waitFor({ timeout: 15000 });
await modal.locator('.cred-aviso-cliente').waitFor({ timeout: 15000 });
const avisoCond = (await modal.locator('.cred-aviso-cliente').innerText()).replace(/\s+/g, ' ');
enlaceRecaudos = (await modal.locator('.cred-aviso-cliente code').innerText()).trim();
await pn.screenshot({ path: `${DIR}F2-07-condicionada-aviso.png`, fullPage: true });
anotar('UI-F2.12', 'Al condicionar se abre solo WhatsApp con el texto aprobado y el enlace para completar los documentos',
  !!url && /necesita información adicional/.test(url) && url.includes(enlaceRecaudos) && /enlace=/.test(enlaceRecaudos),
  (url ?? 'no se abrió').slice(0, 130));
anotar('UI-F2.13', 'La pantalla muestra el enlace una vez, con botones por si el navegador bloquea la ventana, y sin cifras en el mensaje',
  /Solo se muestra ahora/.test(avisoCond) && (await modal.locator('.cred-aviso-cliente a', { hasText: 'WhatsApp' }).count()) === 1 && !/€|EUR/.test(url ?? ''), avisoCond.slice(0, 120));

// ── 5. Cliente: completa los documentos de la MISMA solicitud ─────────────────────────────
const ctxC2 = await browser.newContext({ viewport: { width: 420, height: 900 } });
const pc2 = await ctxC2.newPage();
await pc2.goto(`${WEB}${ruta(enlaceRecaudos)}`, { waitUntil: 'networkidle' });
await pc2.getByText('Completa los documentos de tu solicitud').waitFor({ timeout: 15000 });
const textoComp = await pc2.locator('main').innerText();
await pc2.screenshot({ path: `${DIR}F2-08-recaudos-pendientes.png`, fullPage: true });
anotar('UI-F2.14', 'El enlace de recaudos abre solo los documentos de la misma solicitud, no el formulario',
  textoComp.includes(numeroSolicitud) && !/Paso 1 de 8|Primer nombre/.test(textoComp) && (await pc2.getByText('Ya enviado').count()) === 2,
  `${numeroSolicitud} · «Ya enviado» en ${await pc2.getByText('Ya enviado').count()} documentos`);
anotar('UI-F2.15', 'La justificación interna del analista no se ve en la pantalla pública', !/copia legible|estado de cuenta\./i.test(textoComp.replace('Estado de cuenta bancario', '')), 'sin texto del analista');

await pc2.locator('input[type=file]').nth(0).setInputFiles({ name: 'cedula-nueva.jpg', mimeType: 'image/jpeg', buffer: JPEG });
await pc2.getByText('📎 cedula-nueva.jpg').waitFor({ timeout: 15000 });
await pc2.locator('input[type=file]').nth(3).setInputFiles({ name: 'estado-cuenta.jpg', mimeType: 'image/jpeg', buffer: JPEG });
await pc2.getByText('📎 estado-cuenta.jpg').waitFor({ timeout: 15000 });
await pc2.getByRole('button', { name: 'Enviar 2 documentos' }).click();
await pc2.getByText('Documentos recibidos').waitFor({ timeout: 20000 });
const numeroComp = (await pc2.locator('main div', { hasText: /^SOL-\d{4}-\d+$/ }).first().innerText()).trim();
await pc2.screenshot({ path: `${DIR}F2-09-documentos-recibidos.png` });
anotar('UI-F2.16', 'Al enviar, los documentos se suman a la MISMA solicitud (mismo número)', numeroComp === numeroSolicitud, `${numeroComp}`);
await pc2.goto(`${WEB}${ruta(enlaceRecaudos)}`, { waitUntil: 'networkidle' });
await pc2.getByText('Enlace no disponible').waitFor({ timeout: 15000 });
anotar('UI-F2.17', 'El enlace de recaudos queda usado y no admite más archivos', /ya se usó/.test(await pc2.locator('main').innerText()), 'enlace usado');
await ctxC2.close();

// ── 6. Analista: vuelve a «En evaluación», aprueba, reabre y aprueba de nuevo ─────────────
await modal.getByRole('button', { name: 'Cerrar expediente' }).click();
await pn.reload({ waitUntil: 'networkidle' });
const fila2 = pn.locator('tr', { hasText: numeroSolicitud });
await fila2.waitFor({ timeout: 15000 });
const estadoFila = (await fila2.innerText()).replace(/\s+/g, ' ');
await fila2.getByRole('button', { name: 'Revisar' }).click();
const modal2 = pn.getByRole('dialog', { name: 'Expediente de crédito' });
await modal2.getByText(`Expediente ${numeroSolicitud}`).waitFor({ timeout: 15000 });
const exp2 = await modal2.innerText();
anotar('UI-F2.18', 'La solicitud vuelve a «En evaluación», con la cédula reemplazada (sin duplicado) y el estado de cuenta sumado',
  /En evaluación/.test(estadoFila) && exp2.includes('cedula-nueva.jpg') && !exp2.includes('cedula.jpg') && exp2.includes('estado-cuenta.jpg'), estadoFila.slice(0, 90));

const conformes = modal2.getByRole('button', { name: 'Conforme', exact: true });
for (let i = (await conformes.count()) - 1; i >= 0; i--) await conformes.nth(i).click();
await modal2.locator('#cred-justificacion').fill('Capacidad de pago demostrada y recaudos conformes.');
url = await whatsappAbierto(ctxN, () => modal2.getByRole('button', { name: 'Registrar dictamen' }).click());
await modal2.locator('.cred-aviso-exito').getByText(/Dictamen registrado/).waitFor({ timeout: 15000 });
await pn.screenshot({ path: `${DIR}F2-10-aprobada.png`, fullPage: true });
anotar('UI-F2.19', 'Al aprobar se abre solo WhatsApp con el texto aprobado (D-72), sin cifras del crédito',
  !!url && /fue aprobada/.test(url) && url.includes(numeroSolicitud) && !/€|EUR|\d+[.,]\d{2}/.test(url.replace(/^https:\/\/wa\.me\/\d+\?text=/, '')), (url ?? 'no se abrió').slice(0, 130));

await modal2.getByRole('button', { name: 'Reabrir expediente' }).waitFor({ timeout: 10000 });
await modal2.locator('#cred-reapertura').fill('El cliente trajo otro comprobante de ingresos.');
await modal2.getByRole('button', { name: 'Reabrir expediente' }).click();
await modal2.locator('.cred-aviso-exito').getByText(/Expediente reabierto/).waitFor({ timeout: 15000 });
await modal2.locator('#cred-justificacion').waitFor({ timeout: 10000 });
await pn.screenshot({ path: `${DIR}F2-11-reabierta.png`, fullPage: true });
anotar('UI-F2.20', 'Un expediente aprobado se puede reabrir con justificación y vuelve a «En evaluación» para dictaminarlo', /En evaluación/.test(await modal2.innerText()) && (await modal2.locator('#cred-justificacion').count()) === 1, 'reabierto');

await modal2.locator('#cred-justificacion').fill('Con el comprobante nuevo la capacidad de pago alcanza.');
await modal2.getByRole('button', { name: 'Registrar dictamen' }).click();
await modal2.locator('.cred-aviso-exito').getByText(/Dictamen registrado/).waitFor({ timeout: 15000 });
// El aviso de éxito aparece antes de que el expediente termine de recargarse: se espera la insignia, no se lee de golpe.
const aprobadaOtraVez = await modal2.locator('.cred-insignia', { hasText: 'Aprobada' })
  .waitFor({ timeout: 15000 }).then(() => true, () => false);
anotar('UI-F2.21', 'Se vuelve a dictaminar y queda «Aprobada»', aprobadaOtraVez, aprobadaOtraVez ? 'aprobada otra vez' : 'la insignia no cambió');
await ctxN.close();

// ── 7. Asesor: ve el crédito y cierra la venta ────────────────────────────────────────────
await pa.goto(`${WEB}/admin/citas`, { waitUntil: 'networkidle' });
await tarjeta().waitFor();
const t7 = await tarjeta().innerText();
anotar('UI-F2.22', 'La tarjeta del asesor muestra el crédito aprobado (solo número y estado) y el aviso para el cliente', /Crédito aprobado/.test(t7) && t7.includes(numeroSolicitud) && /Avisar que el crédito fue aprobado/.test(t7) && !/3\.000|0134/.test(t7), t7.match(/Crédito aprobado[^\n]*/)?.[0] ?? '');
await pa.goto(`${WEB}/admin/embudo`, { waitUntil: 'networkidle' });
const art = pa.locator('article.embudo-tarjeta', { hasText: 'Lucía Prueba' });
await art.getByLabel('Mover a otra etapa').selectOption('cerrado_ganado');
await art.getByRole('button', { name: 'Confirmar' }).click();
await pa.getByText(/pasó a "Vendido"/).waitFor({ timeout: 15000 });
const enVitrina = (await api('GET', `/v1/catalogo/${vehiculo.codigo}`)).status;
await pa.screenshot({ path: `${DIR}F2-12-venta-cerrada.png` });
anotar('UI-F2.23', 'Con el crédito aprobado, cerrar la venta saca el vehículo de la vitrina', enVitrina === 404, `vitrina: ${enVitrina}`);

anotar('UI-F2.24', 'Todo campo de formulario tiene nombre accesible: etiqueta enlazada, aria-label o título (R4.5)',
  sinNombreAccesible.length === 0 && camposRevisados > 40, `${camposRevisados} campos revisados · sin nombre: ${sinNombreAccesible.length ? [...new Set(sinNombreAccesible)].slice(0, 6).join(' | ') : 'ninguno'}`);

await browser.close();
const fallas = casos.filter((c) => !c.ok).length;
console.log(`\nTotal: ${casos.length} · pasan ${casos.length - fallas} · fallan ${fallas}`);
fs.mkdirSync(fileURLToPath(new URL('../resultados/', import.meta.url)), { recursive: true });
fs.writeFileSync(fileURLToPath(new URL('../resultados/recorrido-ui.json', import.meta.url)), JSON.stringify(casos, null, 2));
if (fallas) process.exitCode = 1;
