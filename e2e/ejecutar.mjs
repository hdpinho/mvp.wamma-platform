// Corre las pruebas de punta a punta (R5.1) contra un backend local nuevo por cada suite: la base nace vacía, el
// administrador de arranque ingresa por primera vez y los límites de citas y de ingreso empiezan en cero.
//
//   node ejecutar.mjs            todas las suites
//   node ejecutar.mjs r1 ui      solo esas
//
// Qué arranca: `LocalDevServer` (Spring Boot sobre PostgreSQL embebido) en E2E_API y, para la suite de navegador, Vite en
// E2E_WEB. Qué NO toca: Supabase, Render ni Vercel. Ver README.md.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const AQUI = fileURLToPath(new URL('./', import.meta.url));
const SALIDA = `${AQUI}resultados/`;
const WINDOWS = process.platform === 'win32';

const API = process.env.E2E_API ?? 'http://localhost:8081';
const WEB = process.env.E2E_WEB ?? 'http://localhost:5199';
const PUERTO_API = Number(new URL(API).port || 80);
const PUERTO_WEB = Number(new URL(WEB).port || 80);
const MVN = process.env.E2E_MVN ?? 'mvn';

/**
 * Cada suite pide su propia configuración del servidor:
 *  · WAMMA_CRM_ASIGNACION=true: R1, R2 y R3 ejercitan «tomar» y «repartir», que están apagados por defecto (D-73).
 *  · WAMMA_PROXIES_CONFIABLES=ninguno: R1 comprueba que una X-Forwarded-For inventada no cambia la IP (R1.4).
 *  · El recorrido de navegador corre con la configuración por defecto, la que se entrega.
 */
const SUITES = [
  { id: 'r1', nombre: 'Seguridad y accesos (R1)', archivo: 'suites/seguridad-r1.mjs', env: { WAMMA_CRM_ASIGNACION: 'true', WAMMA_PROXIES_CONFIABLES: 'ninguno' }, web: false },
  { id: 'r2', nombre: 'Flujos y contratos (R2)', archivo: 'suites/flujos-r2.mjs', env: { WAMMA_CRM_ASIGNACION: 'true' }, web: false },
  { id: 'r3', nombre: 'Integridad del crédito (R3)', archivo: 'suites/credito-r3.mjs', env: { WAMMA_CRM_ASIGNACION: 'true' }, web: false },
  { id: 'ui', nombre: 'Recorrido completo en navegador', archivo: 'suites/recorrido-ui.mjs', env: {}, web: true },
];

const pedidas = process.argv.slice(2);
const elegidas = pedidas.length ? SUITES.filter((s) => pedidas.includes(s.id)) : SUITES;
if (elegidas.length === 0) {
  console.error(`Suites válidas: ${SUITES.map((s) => s.id).join(', ')}`);
  process.exit(2);
}

fs.mkdirSync(SALIDA, { recursive: true });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

const puertoOcupado = (puerto) =>
  new Promise((resolver) => {
    const s = net.connect({ port: puerto, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); resolver(true); });
    s.once('error', () => resolver(false));
  });

async function esperar(condicion, limiteMs, que) {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (await condicion()) return;
    await pausa(2000);
  }
  throw new Error(`Se agotó la espera: ${que}`);
}

/** PostgreSQL embebidos que ya existían, para no tocar los de otra persona al limpiar (solo Windows). */
function bases() {
  if (!WINDOWS) return new Set();
  const r = spawnSync('powershell', ['-NoProfile', '-Command',
    "(Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { $_.CommandLine -match 'embedded-pg' }).ProcessId"],
  { encoding: 'utf-8' });
  return new Set((r.stdout ?? '').split(/\s+/).filter(Boolean));
}

function detener(proceso) {
  if (!proceso || proceso.exitCode !== null) return;
  if (WINDOWS) spawnSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F']);
  else { try { process.kill(-proceso.pid, 'SIGTERM'); } catch { /* ya terminó */ } }
}

function limpiarBases(previas) {
  if (!WINDOWS) return;
  // El JVM se mata sin dejar que cierre su PostgreSQL: se apagan solo las que nacieron en esta corrida.
  for (const pid of bases()) {
    if (previas.has(pid)) continue;
    spawnSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`]);
  }
}

function arrancarBackend(suite, entorno) {
  const registro = fs.openSync(`${SALIDA}backend-${suite.id}.log`, 'w');
  const argumentos = `--server.port=${PUERTO_API} --wamma.cors.allowed-origins=${WEB},${WEB.replace('localhost', '127.0.0.1')} --wamma.fotos.url-publica=${API}/archivos`;
  const args = ['-B', '-q', 'spring-boot:test-run', '-Dspring-boot.run.main-class=com.wamma.support.LocalDevServer',
    WINDOWS ? `"-Dspring-boot.run.arguments=${argumentos}"` : `-Dspring-boot.run.arguments=${argumentos}`];
  return spawn(MVN, args, { cwd: `${RAIZ}backend`, env: entorno, stdio: ['ignore', registro, registro], shell: WINDOWS, detached: !WINDOWS });
}

function arrancarWeb(suite) {
  const registro = fs.openSync(`${SALIDA}web-${suite.id}.log`, 'w');
  return spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PUERTO_WEB), '--strictPort', '--host', 'localhost'],
    { cwd: `${RAIZ}frontend-web`, env: { ...process.env, VITE_API_URL: API }, stdio: ['ignore', registro, registro], detached: !WINDOWS });
}

const hecho = (s, textos) => textos.some((t) => new RegExp(t).test(fs.readFileSync(`${SALIDA}backend-${s.id}.log`, 'utf-8')));

async function correr(suite) {
  console.log(`\n══ ${suite.nombre} ══`);
  for (const puerto of suite.web ? [PUERTO_API, PUERTO_WEB] : [PUERTO_API]) {
    if (await puertoOcupado(puerto)) throw new Error(`El puerto ${puerto} ya está en uso: apaga lo que lo ocupa y vuelve a intentar.`);
  }
  const previas = bases();
  const entorno = { ...process.env, ...suite.env };
  const backend = arrancarBackend(suite, entorno);
  let web = null;
  try {
    await esperar(async () => {
      if (backend.exitCode !== null) throw new Error(`El backend se detuvo (revisa ${SALIDA}backend-${suite.id}.log)`);
      if (hecho(suite, ['Application run failed', 'APPLICATION FAILED'])) throw new Error(`El backend no arrancó (${SALIDA}backend-${suite.id}.log)`);
      return hecho(suite, ['SOLICITUD DE CR.DITO SEMBRADA', 'Advertencia al sembrar']);
    }, 5 * 60_000, 'el backend no terminó de arrancar');
    if (suite.web) {
      web = arrancarWeb(suite);
      await esperar(async () => { try { return (await fetch(WEB)).ok; } catch { return false; } }, 60_000, 'Vite no respondió');
    }
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [`${AQUI}${suite.archivo}`], {
      cwd: AQUI, stdio: 'inherit', env: { ...entorno, BASE: API, E2E_API: API, E2E_WEB: WEB },
    });
    return { id: suite.id, nombre: suite.nombre, ok: r.status === 0, segundos: Math.round((Date.now() - t0) / 1000) };
  } finally {
    detener(web);
    detener(backend);
    await pausa(3000);
    limpiarBases(previas);
  }
}

const resumen = [];
for (const suite of elegidas) {
  try {
    resumen.push(await correr(suite));
  } catch (e) {
    console.error(`✗ ${suite.nombre}: ${e.message}`);
    resumen.push({ id: suite.id, nombre: suite.nombre, ok: false, segundos: 0, error: e.message });
  }
}

console.log('\n══ Resumen ══');
for (const r of resumen) console.log(`${r.ok ? 'PASA ' : 'FALLA'}  ${r.nombre}  (${r.segundos} s)${r.error ? ` · ${r.error}` : ''}`);
fs.writeFileSync(`${SALIDA}resumen.json`, JSON.stringify(resumen, null, 2));
process.exit(resumen.every((r) => r.ok) ? 0 : 1);
