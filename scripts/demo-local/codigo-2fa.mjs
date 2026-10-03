// Muestra el código de 6 dígitos vigente del segundo factor de una cuenta de la demostración local.
// Uso:  node scripts/demo-local/codigo-2fa.mjs demo.analista     (o «todos»)
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const RUTA = fileURLToPath(new URL('../../scratch/demo/credenciales.json', import.meta.url));
if (!fs.existsSync(RUTA)) {
  console.error('Todavía no hay credenciales: corre primero iniciar-demo.ps1 (o preparar-demo.mjs).');
  process.exit(1);
}
const cuentas = JSON.parse(fs.readFileSync(RUTA, 'utf-8'));
const pedido = process.argv[2];
const elegidas = !pedido || pedido === 'todos' ? cuentas : cuentas.filter((c) => c.usuario === pedido);
if (elegidas.length === 0) {
  console.error(`No existe «${pedido}». Cuentas: ${cuentas.map((c) => c.usuario).join(', ')}`);
  process.exit(1);
}

function base32(s) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
const ahora = Math.floor(Date.now() / 1000);
const codigo = (secreto) => {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 30)));
  const h = crypto.createHmac('sha1', base32(secreto)).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
};
const restan = 30 - (ahora % 30);
for (const c of elegidas) console.log(`${c.usuario.padEnd(18)} ${codigo(c.secreto)}   (vale ${restan} s)`);
if (restan < 5) console.log('\nCambia en segundos: espera al siguiente código antes de escribirlo.');
