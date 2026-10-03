// Prepara la demostración local: crea un usuario por rol con su contraseña y su segundo factor ya activados, sobre el
// backend local recién arrancado (`LocalDevServer`). Guarda las credenciales en `scratch/demo/credenciales.json`, que
// Git ignora. Las cuentas solo sirven para esa base desechable.
//
// Uso:  node scripts/demo-local/preparar-demo.mjs        (o lo llama iniciar-demo.ps1)
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.WAMMA_API ?? 'http://localhost:8080';
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const SALIDA = `${RAIZ}scratch/demo/credenciales.json`;

const CUENTAS = [
  { rol: 'ASESOR_COMERCIAL', usuario: 'demo.asesor', nombre: 'Ana', apellido: 'Asesora', etiqueta: 'Asesor comercial' },
  { rol: 'COORDINADOR_COMERCIAL', usuario: 'demo.coordinador', nombre: 'Carlos', apellido: 'Coordinador', etiqueta: 'Coordinador comercial' },
  { rol: 'ANALISTA_CREDITO', usuario: 'demo.analista', nombre: 'Andrea', apellido: 'Analista', etiqueta: 'Analista de crédito' },
  { rol: 'INVENTARIO', usuario: 'demo.inventario', nombre: 'Ismael', apellido: 'Inventario', etiqueta: 'Inventario' },
  { rol: 'AUDITOR', usuario: 'demo.auditor', nombre: 'Aurora', apellido: 'Auditora', etiqueta: 'Auditor' },
];
const CONTRASENA = (clave) => `Demostracion WAMMA 2026 ${clave}`;

async function api(method, path, { token, body } = {}) {
  const cabeceras = { Accept: 'application/json' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  if (body !== undefined) cabeceras['Content-Type'] = 'application/json';
  const r = await fetch(API + path, { method, headers: cabeceras, body: body === undefined ? undefined : JSON.stringify(body) });
  const texto = await r.text();
  let json;
  try { json = JSON.parse(texto); } catch { /* sin cuerpo JSON */ }
  return { status: r.status, json, texto };
}

function base32(s) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
const codigo = (secreto) => {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = crypto.createHmac('sha1', base32(secreto)).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
};

/** Primer ingreso completo: contraseña temporal → contraseña propia → activación del segundo factor. */
async function primerIngreso(usuario, temporal, nueva) {
  const ingreso = await api('POST', '/v1/auth/ingreso', { body: { usuario, contrasena: temporal } });
  if (ingreso.status !== 200) {
    throw new Error(`${usuario}: el ingreso inicial respondió ${ingreso.status}. Si ya se había preparado, reinicia el backend: la base local nace vacía en cada arranque.`);
  }
  const temporalToken = ingreso.json.tokenTemporal;
  let siguiente = ingreso.json.siguiente;
  if (siguiente === 'CAMBIAR_CONTRASENA') {
    const cambio = await api('POST', '/v1/auth/contrasena-inicial', { token: temporalToken, body: { nueva } });
    if (cambio.status !== 200) throw new Error(`${usuario}: no se pudo fijar la contraseña (${cambio.status}) ${cambio.texto}`);
    siguiente = cambio.json.siguiente;
  }
  if (siguiente !== 'ACTIVAR_2FA') throw new Error(`${usuario}: paso inesperado ${siguiente}`);
  const activacion = await api('POST', '/v1/auth/2fa/activacion', { token: temporalToken });
  const confirmacion = await api('POST', '/v1/auth/2fa/confirmacion', {
    token: temporalToken,
    body: { codigo: codigo(activacion.json.secreto) },
  });
  if (!confirmacion.json?.token) throw new Error(`${usuario}: no se pudo activar el segundo factor (${confirmacion.status})`);
  return { secreto: activacion.json.secreto, token: confirmacion.json.token };
}

const salud = await api('GET', '/api/health').catch(() => null);
if (!salud || salud.status !== 200) {
  console.error(`No hay backend en ${API}. Arráncalo primero (iniciar-demo.ps1).`);
  process.exit(1);
}

const admin = await primerIngreso('admin.local', 'Clave local de desarrollo 2026', CONTRASENA('administrador'));
const credenciales = [{ rol: 'ADMINISTRADOR', usuario: 'admin.local', contrasena: CONTRASENA('administrador'), secreto: admin.secreto, etiqueta: 'Administrador' }];

for (const c of CUENTAS) {
  const creada = await api('POST', '/v1/usuarios', {
    token: admin.token,
    body: { usuario: c.usuario, nombre: c.nombre, apellido: c.apellido, correo: `${c.usuario}@demo.invalid`, roles: [c.rol] },
  });
  if (creada.status !== 201) throw new Error(`${c.usuario}: no se pudo crear (${creada.status}) ${creada.texto}`);
  const contrasena = CONTRASENA(c.rol.split('_')[0].toLowerCase());
  const ingreso = await primerIngreso(c.usuario, creada.json.contrasenaTemporal, contrasena);
  credenciales.push({ rol: c.rol, usuario: c.usuario, contrasena, secreto: ingreso.secreto, etiqueta: c.etiqueta });
}

fs.mkdirSync(`${RAIZ}scratch/demo`, { recursive: true });
fs.writeFileSync(SALIDA, JSON.stringify(credenciales, null, 2));

console.log('\nUsuarios de la demostración (base local desechable):\n');
console.log('Rol                       Usuario            Contraseña');
for (const c of credenciales) console.log(`${c.etiqueta.padEnd(25)} ${c.usuario.padEnd(18)} ${c.contrasena}`);
console.log('\nSegundo factor: en cada ingreso pide un código de 6 dígitos. Obtén el vigente con:');
console.log('  node scripts/demo-local/codigo-2fa.mjs demo.analista');
console.log(`\nCredenciales y secretos guardados en ${SALIDA} (ignorado por Git).`);
