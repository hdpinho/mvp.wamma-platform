import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrato } from '../pruebas/contrato.ts';
import type { EnlaceCreditoApi, SolicitudEnvioApi } from '../api/credito.ts';
import { PARAMETROS_APROBADOS } from './financiamientoMotor.ts';
import {
  calcularResumen,
  construirEnvio,
  contextoDesdeEnlace,
  datosIniciales,
  mensajeEnlaceNoValido,
  politicaDesdeEnlace,
  precargarSolicitante,
  repartirNombre,
  type DatosSolicitud,
} from './solicitudCredito.ts';

/** Lo que la persona llenaría: los mismos datos del archivo de contrato de la solicitud. */
function datosDeContrato(): DatosSolicitud {
  const c = contrato<SolicitudEnvioApi>('credito-solicitud-envio');
  return {
    ...datosIniciales,
    inicialAportado: '3600',
    primerNombre: c.datosPersonales.primerNombre ?? '',
    segundoNombre: c.datosPersonales.segundoNombre ?? '',
    primerApellido: c.datosPersonales.primerApellido ?? '',
    segundoApellido: c.datosPersonales.segundoApellido ?? '',
    tipoDocumento: c.datosPersonales.tipoDocumento ?? 'V',
    numeroDocumento: c.datosPersonales.numeroDocumento ?? '',
    rif: c.datosPersonales.rif ?? '',
    nacionalidad: c.datosPersonales.nacionalidad ?? '',
    estadoCivil: c.datosPersonales.estadoCivil ?? '',
    fechaNacimiento: c.datosPersonales.fechaNacimiento ?? '',
    lugarNacimiento: c.datosPersonales.lugarNacimiento ?? '',
    nivelAcademico: c.datosPersonales.nivelAcademico ?? '',
    cargasFamiliares: String(c.datosPersonales.cargasFamiliares ?? 0),
    condicionVivienda: c.datosPersonales.condicionVivienda ?? '',
    direccion: c.datosContacto.direccionHabitacion ?? '',
    puntoReferencia: c.datosContacto.puntoReferencia ?? '',
    estado: c.datosContacto.estado ?? '',
    municipio: c.datosContacto.municipio ?? '',
    codigoPostal: c.datosContacto.codigoPostal ?? '',
    telefonoHabitacion: c.datosContacto.telefonoHabitacion ?? '',
    telefonoCelular: c.datosContacto.telefonoCelular ?? '',
    correo: c.datosContacto.correo ?? '',
    situacionLaboral: c.datosLaborales.situacionLaboral ?? '',
    empresa: c.datosLaborales.empresa ?? '',
    rifEmpresa: c.datosLaborales.rifEmpresa ?? '',
    cargo: c.datosLaborales.cargo ?? '',
    antiguedadAnios: String(c.datosLaborales.antiguedadAnios ?? 0),
    antiguedadMeses: String(c.datosLaborales.antiguedadMeses ?? 0),
    direccionEmpresa: c.datosLaborales.direccionEmpresa ?? '',
    telefonoOficina: c.datosLaborales.telefonoOficina ?? '',
    jefeDirecto: c.datosLaborales.nombreJefeInmediato ?? '',
    sueldoMensual: String(c.datosFinancieros.sueldoMensual ?? 0),
    otrosIngresos: String(c.datosFinancieros.otrosIngresos ?? 0),
    conceptoOtrosIngresos: c.datosFinancieros.conceptoOtrosIngresos ?? '',
    alquilerHipoteca: String(c.datosFinancieros.alquilerHipoteca ?? 0),
    alimentacionServicios: String(c.datosFinancieros.alimentacionServicios ?? 0),
    pagosDeudas: String(c.datosFinancieros.pagosDeudas ?? 0),
    referencias: c.referencias.map((r) => ({
      nombre: r.nombre ?? '',
      parentesco: r.parentesco ?? '',
      telefono: r.telefono ?? '',
    })) as DatosSolicitud['referencias'],
    banco: c.datosBancarios.banco ?? '',
    tipoCuenta: c.datosBancarios.tipoCuenta ?? '',
    numeroCuenta: c.datosBancarios.numeroCuenta ?? '',
    declaraciones: { veracidad: true, 'centrales-riesgo': true, 'origen-fondos': true, 'compromiso-pago': true },
    esPEP: c.declaraciones.esPep ?? false,
    vinculoPEP: c.declaraciones.vinculoPep ?? false,
    cargoPEP: c.declaraciones.cargoPep ?? '',
    institucionPEP: c.declaraciones.institucionPep ?? '',
    periodoPEP: c.declaraciones.periodoPep ?? '',
    consentimientoDatos: c.declaraciones.consentimientoDatos ?? false,
  };
}

const clavesOrdenadas = (objeto: object) => Object.keys(objeto).sort();

// ── Lo que se envía ──────────────────────────────────────────────────────────────────────

test('la solicitud que arma la web tiene las mismas claves que el contrato del backend', () => {
  const esperado = contrato<SolicitudEnvioApi>('credito-solicitud-envio');
  const envio = construirEnvio({
    token: 'TOKEN_DE_EJEMPLO',
    datos: datosDeContrato(),
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: esperado.recaudos,
    versionTexto: 'WMA-F-FIN-001 v1',
  });

  assert.deepEqual(clavesOrdenadas(envio), clavesOrdenadas(esperado));
  for (const parte of [
    'datosPersonales',
    'datosContacto',
    'datosLaborales',
    'datosFinancieros',
    'datosBancarios',
    'declaraciones',
  ] as const) {
    assert.deepEqual(clavesOrdenadas(envio[parte]), clavesOrdenadas(esperado[parte]), parte);
  }
  assert.deepEqual(clavesOrdenadas(envio.referencias[0]), clavesOrdenadas(esperado.referencias[0]));
  assert.deepEqual(clavesOrdenadas(envio.recaudos[0]), clavesOrdenadas(esperado.recaudos[0]));
});

test('la solicitud envía lo que escribió la persona, sin relleno', () => {
  const esperado = contrato<SolicitudEnvioApi>('credito-solicitud-envio');
  const envio = construirEnvio({
    token: 'T',
    datos: datosDeContrato(),
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'WMA-F-FIN-001 v1',
  });
  assert.deepEqual(envio.datosPersonales, esperado.datosPersonales);
  assert.deepEqual(envio.datosContacto, esperado.datosContacto);
  assert.deepEqual(envio.datosLaborales, esperado.datosLaborales);
  assert.deepEqual(envio.datosFinancieros, esperado.datosFinancieros);
  assert.deepEqual(envio.datosBancarios, esperado.datosBancarios);
  assert.deepEqual(envio.declaraciones, esperado.declaraciones);
  assert.deepEqual(envio.referencias, esperado.referencias);
});

test('el plazo y la frecuencia son los de la política: no se eligen (D-55)', () => {
  const envio = construirEnvio({
    token: 'T',
    datos: datosDeContrato(),
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'v',
  });
  assert.equal(envio.plazoMeses, 24);
  assert.equal(envio.frecuenciaPago, 'Mensual');
});

test('la cuenta del asistente: monto financiado, cuota francesa y capacidad del 30 %', () => {
  const envio = construirEnvio({
    token: 'T',
    datos: datosDeContrato(),
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'v',
  });
  assert.equal(envio.cuotaInicial, 3600);
  assert.equal(envio.montoSolicitado, 14400);
  assert.equal(envio.cuotaEstimada, 944.45);
  assert.equal(envio.capacidadPagoMensual, 1140);
});

test('el RIF que no se puede deducir queda vacío: no se inventa un dígito verificador', () => {
  const datos = { ...datosDeContrato(), tipoDocumento: 'P', numeroDocumento: 'AB123456', rif: '' };
  const envio = construirEnvio({
    token: 'T',
    datos,
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'v',
  });
  assert.equal(envio.datosPersonales.rif, '');
});

test('una declaración sin aceptar no se envía como aceptada', () => {
  const datos = { ...datosDeContrato(), declaraciones: { veracidad: true } };
  const envio = construirEnvio({
    token: 'T',
    datos,
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'v',
  });
  assert.equal(envio.declaraciones.veracidad, true);
  assert.equal(envio.declaraciones.centralesRiesgo, false);
  assert.equal(envio.declaraciones.origenFondos, false);
  assert.equal(envio.declaraciones.compromisoPago, false);
});

test('los campos opcionales vacíos no viajan', () => {
  const datos = { ...datosDeContrato(), segundoNombre: '  ', puntoReferencia: '', codigoPostal: '' };
  const envio = construirEnvio({
    token: 'T',
    datos,
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'v',
  });
  assert.equal(envio.datosPersonales.segundoNombre, undefined);
  assert.equal(envio.datosContacto.puntoReferencia, undefined);
  assert.equal(envio.datosContacto.codigoPostal, undefined);
});

test('el número de cuenta viaja solo con dígitos', () => {
  const datos = { ...datosDeContrato(), numeroCuenta: '0134 0000 0000 0000 0000' };
  const envio = construirEnvio({
    token: 'T',
    datos,
    precio: 18000,
    politica: PARAMETROS_APROBADOS,
    recaudos: [],
    versionTexto: 'v',
  });
  assert.equal(envio.datosBancarios.numeroCuenta, '01340000000000000000');
});

// ── Cuenta ───────────────────────────────────────────────────────────────────────────────

test('sin nada que financiar no hay cuota', () => {
  const r = calcularResumen({ ...datosIniciales, inicialAportado: '18000' }, 18000, PARAMETROS_APROBADOS);
  assert.equal(r.aFinanciar, 0);
  assert.equal(r.cuota, 0);
});

test('la inicial mínima y la capacidad salen de la política que rige', () => {
  const politica = { ...PARAMETROS_APROBADOS, inicialMinima: 0.3, ratioCuotaIngreso: 0.25 };
  const r = calcularResumen({ ...datosIniciales, sueldoMensual: '2000' }, 10000, politica);
  assert.equal(r.inicialMinima, 3000);
  assert.equal(r.capacidadPago, 500);
});

// ── Enlace personal ──────────────────────────────────────────────────────────────────────

test('un enlace válido trae el vehículo, la política y lo que ya se sabe de la persona', () => {
  const dto = contrato<EnlaceCreditoApi>('credito-enlace');
  const contexto = contextoDesdeEnlace(dto);
  assert.ok(contexto);
  assert.equal(contexto.vehiculo.codigo, 'WAM-00012');
  assert.equal(contexto.vehiculo.titulo, 'Toyota Corolla 2021');
  assert.equal(contexto.vehiculo.precio, 18000);
  assert.equal(contexto.politica.plazoMeses, 24);
  assert.equal(contexto.politica.tasaMensual, 0.04);
  assert.equal(contexto.politica.inicialMinima, 0.2);
  assert.equal(contexto.politica.ratioCuotaIngreso, 0.3);
  assert.equal(contexto.precargado.primerNombre, 'Carlos');
  assert.equal(contexto.precargado.primerApellido, 'Rodríguez');
  assert.equal(contexto.precargado.tipoDocumento, 'V');
  assert.equal(contexto.precargado.numeroDocumento, '12345678');
  assert.equal(contexto.precargado.telefonoCelular, '04121234567');
  assert.equal(contexto.precargado.correo, 'carlos@ejemplo.invalid');
  assert.equal(contexto.precargado.inicialAportado, '3600', 'la inicial arranca en el mínimo vigente');
});

test('un enlace inválido no da contexto y explica por qué', () => {
  const dto = contrato<EnlaceCreditoApi>('credito-enlace-invalido');
  assert.equal(contextoDesdeEnlace(dto), null);
  assert.match(mensajeEnlaceNoValido(dto.invalidReason), /venció/);
  assert.match(mensajeEnlaceNoValido('usado'), /ya se usó/);
  assert.match(mensajeEnlaceNoValido(null), /no es válido/);
});

test('un enlace válido sin vehículo no se acepta a medias', () => {
  const dto = { ...contrato<EnlaceCreditoApi>('credito-enlace'), vehicle: null };
  assert.equal(contextoDesdeEnlace(dto), null);
});

test('la política del enlace se convierte al modelo del motor de cálculo', () => {
  const dto = contrato<EnlaceCreditoApi>('credito-enlace');
  assert.ok(dto.financingParams);
  assert.deepEqual(politicaDesdeEnlace(dto.financingParams), {
    tasaMensual: 0.04,
    plazoMeses: 24,
    ratioCuotaIngreso: 0.3,
    opcionesInicial: [0.2],
    inicialMinima: 0.2,
  });
});

// ── Precarga ─────────────────────────────────────────────────────────────────────────────

test('el nombre del CRM se reparte en los cuatro campos del formulario', () => {
  assert.deepEqual(repartirNombre('Carlos'), {
    primerNombre: 'Carlos',
    segundoNombre: '',
    primerApellido: '',
    segundoApellido: '',
  });
  assert.deepEqual(repartirNombre('Carlos Rodríguez'), {
    primerNombre: 'Carlos',
    segundoNombre: '',
    primerApellido: 'Rodríguez',
    segundoApellido: '',
  });
  assert.deepEqual(repartirNombre('Carlos Rodríguez Pérez'), {
    primerNombre: 'Carlos',
    segundoNombre: '',
    primerApellido: 'Rodríguez',
    segundoApellido: 'Pérez',
  });
  assert.deepEqual(repartirNombre('Carlos Alberto Rodríguez Pérez de León'), {
    primerNombre: 'Carlos',
    segundoNombre: 'Alberto',
    primerApellido: 'Rodríguez',
    segundoApellido: 'Pérez de León',
  });
  assert.equal(repartirNombre('   ').primerNombre, '');
});

test('sin datos de la persona solo se precarga la inicial mínima', () => {
  const precarga = precargarSolicitante(null, 18000, PARAMETROS_APROBADOS);
  assert.deepEqual(precarga, { inicialAportado: '3600' });
});

test('la inicial mínima no sube un euro por un error de redondeo', () => {
  // 15.400 × 0,20 no es exacto en coma flotante; la inicial mínima es 3.080, no 3.081.
  const precarga = precargarSolicitante(null, 15400, PARAMETROS_APROBADOS);
  assert.equal(precarga.inicialAportado, '3080');
});

test('un extranjero (E) o una cédula de otro formato se precargan con lo que sea reconocible', () => {
  const extranjero = precargarSolicitante(
    { personId: 'p', fullName: 'Ana Gómez', nationalId: 'E98765432', phone: null, email: null },
    10000,
    PARAMETROS_APROBADOS,
  );
  assert.equal(extranjero.tipoDocumento, 'E');
  assert.equal(extranjero.numeroDocumento, '98765432');

  const raro = precargarSolicitante(
    { personId: 'p', fullName: 'Ana Gómez', nationalId: 'XYZ', phone: null, email: null },
    10000,
    PARAMETROS_APROBADOS,
  );
  assert.equal(raro.tipoDocumento, undefined, 'una cédula que no se reconoce no se adivina');
  assert.equal(raro.numeroDocumento, undefined);
});
