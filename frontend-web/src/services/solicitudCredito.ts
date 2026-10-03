/**
 * Lógica pura de la solicitud de crédito (pantalla C9): qué se precarga del enlace personal, cuánto da la cuenta y qué
 * se envía al servidor. Sin React ni red, para probarla con node y mantenerla pegada al contrato (`api/credito.ts`).
 *
 * La cuota y la capacidad que se muestran y se envían son **referenciales**: el servidor es quien manda y las verifica.
 */
import type { EnlaceCreditoApi, PoliticaEnlaceApi, RecaudoEnvioApi, SolicitantePrecargadoApi, SolicitudEnvioApi } from '../api/credito.ts';
import { telefonoLocal } from '../api/crmAdaptadores.ts';
import { derivarRIF } from '../validacion/venezuela.ts';
import { calcularCuota, type ParametrosFinanciamiento } from './financiamientoMotor.ts';

export interface Referencia {
  nombre: string;
  parentesco: string;
  telefono: string;
}

/** Lo que la persona llena en el asistente de ocho pasos. */
export interface DatosSolicitud {
  // Paso 0
  inicialAportado: string;
  // Paso 1
  primerApellido: string;
  segundoApellido: string;
  primerNombre: string;
  segundoNombre: string;
  tipoDocumento: string;
  numeroDocumento: string;
  rif: string;
  nacionalidad: string;
  estadoCivil: string;
  fechaNacimiento: string;
  lugarNacimiento: string;
  nivelAcademico: string;
  cargasFamiliares: string;
  condicionVivienda: string;
  // Paso 2
  direccion: string;
  puntoReferencia: string;
  estado: string;
  municipio: string;
  codigoPostal: string;
  telefonoHabitacion: string;
  telefonoCelular: string;
  correo: string;
  // Paso 3
  situacionLaboral: string;
  empresa: string;
  rifEmpresa: string;
  cargo: string;
  antiguedadAnios: string;
  antiguedadMeses: string;
  direccionEmpresa: string;
  telefonoOficina: string;
  jefeDirecto: string;
  // Paso 4
  sueldoMensual: string;
  otrosIngresos: string;
  conceptoOtrosIngresos: string;
  alquilerHipoteca: string;
  alimentacionServicios: string;
  pagosDeudas: string;
  // Paso 5
  referencias: [Referencia, Referencia, Referencia];
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  // Paso 7
  declaraciones: Record<string, boolean>;
  esPEP: boolean;
  vinculoPEP: boolean;
  cargoPEP: string;
  institucionPEP: string;
  periodoPEP: string;
  consentimientoDatos: boolean;
}

const referenciaVacia: Referencia = { nombre: '', parentesco: '', telefono: '' };

export const datosIniciales: DatosSolicitud = {
  inicialAportado: '',
  primerApellido: '',
  segundoApellido: '',
  primerNombre: '',
  segundoNombre: '',
  tipoDocumento: 'V',
  numeroDocumento: '',
  rif: '',
  nacionalidad: 'Venezolana',
  estadoCivil: 'Soltero(a)',
  fechaNacimiento: '',
  lugarNacimiento: '',
  nivelAcademico: 'Bachiller',
  cargasFamiliares: '0',
  condicionVivienda: 'Propia',
  direccion: '',
  puntoReferencia: '',
  estado: '',
  municipio: '',
  codigoPostal: '',
  telefonoHabitacion: '',
  telefonoCelular: '',
  correo: '',
  situacionLaboral: 'Empleado Fijo',
  empresa: '',
  rifEmpresa: '',
  cargo: '',
  antiguedadAnios: '',
  antiguedadMeses: '0',
  direccionEmpresa: '',
  telefonoOficina: '',
  jefeDirecto: '',
  sueldoMensual: '',
  otrosIngresos: '',
  conceptoOtrosIngresos: '',
  alquilerHipoteca: '',
  alimentacionServicios: '',
  pagosDeudas: '',
  referencias: [{ ...referenciaVacia }, { ...referenciaVacia }, { ...referenciaVacia }],
  banco: '',
  tipoCuenta: 'Corriente',
  numeroCuenta: '',
  declaraciones: {},
  esPEP: false,
  vinculoPEP: false,
  cargoPEP: '',
  institucionPEP: '',
  periodoPEP: '',
  consentimientoDatos: false,
};

// ── Enlace personal ──────────────────────────────────────────────────────────────────────

/** El vehículo de la solicitud, venga del enlace (servidor) o del inventario de demostración. */
export interface VehiculoSolicitud {
  codigo: string;
  titulo: string;
  version: string;
  precio: number;
  fotoUrl: string | null;
}

/**
 * Un enlace de recaudos (D-70): la solicitud ya existe y el analista pidió más documentos. No abre una solicitud nueva:
 * la persona solo vuelve a cargar recaudos de esa.
 */
export interface ComplementoSolicitud {
  numero: string;
  /** Tipos de recaudo que la solicitud ya tiene cargados. */
  tiposCargados: string[];
}

/** Lo que trae un enlace válido: el vehículo, la política que rige y lo que ya se sabe de la persona. */
export interface ContextoSolicitud {
  vehiculo: VehiculoSolicitud;
  politica: ParametrosFinanciamiento;
  precargado: Partial<DatosSolicitud>;
  /** Solo en un enlace de recaudos; en uno normal es nulo. */
  complemento: ComplementoSolicitud | null;
}

/** La política del servidor, en el modelo del motor de cálculo. */
export function politicaDesdeEnlace(p: PoliticaEnlaceApi): ParametrosFinanciamiento {
  return {
    tasaMensual: Number(p.defaultMonthlyRate),
    plazoMeses: Number(p.defaultTermMonths),
    ratioCuotaIngreso: Number(p.paymentCapacityPercentage),
    opcionesInicial: [Number(p.minDownPaymentPercentage)],
    inicialMinima: Number(p.minDownPaymentPercentage),
  };
}

/**
 * Reparte el nombre completo que tiene el CRM en los cuatro campos del formulario. Con una, dos, tres o cuatro
 * palabras la correspondencia es la habitual (nombre, apellido, segundo apellido, segundo nombre); la persona puede
 * corregirla, por eso es solo una precarga.
 */
export function repartirNombre(completo: string): Pick<DatosSolicitud, 'primerNombre' | 'segundoNombre' | 'primerApellido' | 'segundoApellido'> {
  const palabras = completo.trim().split(/\s+/).filter(Boolean);
  const vacio = { primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '' };
  if (palabras.length === 0) return vacio;
  if (palabras.length === 1) return { ...vacio, primerNombre: palabras[0] };
  if (palabras.length === 2) return { ...vacio, primerNombre: palabras[0], primerApellido: palabras[1] };
  if (palabras.length === 3) {
    return { ...vacio, primerNombre: palabras[0], primerApellido: palabras[1], segundoApellido: palabras[2] };
  }
  return {
    primerNombre: palabras[0],
    segundoNombre: palabras[1],
    primerApellido: palabras[2],
    segundoApellido: palabras.slice(3).join(' '),
  };
}

/** Lo que el CRM ya sabe de la persona, en los campos del formulario, para no volver a pedírselo. */
export function precargarSolicitante(
  solicitante: SolicitantePrecargadoApi | null,
  precio: number,
  politica: ParametrosFinanciamiento,
): Partial<DatosSolicitud> {
  const precarga: Partial<DatosSolicitud> = {
    // La inicial arranca en el mínimo vigente; la persona puede aportar más. Se redondea a centavos antes de subir al
    // euro entero: 15.400 × 0,20 no es exacto en coma flotante y daría 3.081 en vez de 3.080.
    inicialAportado: precio > 0 ? String(Math.ceil(Math.round(precio * politica.inicialMinima * 100) / 100)) : '',
  };
  if (!solicitante) return precarga;

  Object.assign(precarga, repartirNombre(solicitante.fullName ?? ''));
  const cedula = /^([VE])(\d{6,9})$/i.exec((solicitante.nationalId ?? '').replace(/[-.\s]/g, ''));
  if (cedula) {
    precarga.tipoDocumento = cedula[1].toUpperCase();
    precarga.numeroDocumento = cedula[2];
    const rif = derivarRIF(`${precarga.tipoDocumento}${precarga.numeroDocumento}`);
    if (rif) precarga.rif = rif;
  }
  if (solicitante.phone) precarga.telefonoCelular = telefonoLocal(solicitante.phone);
  if (solicitante.email) precarga.correo = solicitante.email;
  return precarga;
}

/** Un enlace válido, como contexto de la solicitud; nulo si el servidor no trajo lo indispensable. */
export function contextoDesdeEnlace(dto: EnlaceCreditoApi): ContextoSolicitud | null {
  if (!dto.valid || !dto.vehicle || !dto.financingParams) return null;
  const v = dto.vehicle;
  const politica = politicaDesdeEnlace(dto.financingParams);
  const precio = Number(v.priceEur);
  return {
    vehiculo: {
      codigo: v.code,
      titulo: `${v.brand} ${v.model} ${v.year}`,
      version: v.version ?? '',
      precio,
      fotoUrl: v.photoUrl,
    },
    politica,
    precargado: precargarSolicitante(dto.applicant, precio, politica),
    complemento: dto.complemento
      ? { numero: dto.complemento.applicationNumber, tiposCargados: dto.complemento.documentTypes ?? [] }
      : null,
  };
}

/** Por qué un enlace no sirve, dicho a quien lo abrió. El servidor responde con un código corto. */
export function mensajeEnlaceNoValido(motivo: string | null | undefined): string {
  switch (motivo) {
    case 'usado':
      return 'Este enlace ya se usó para enviar una solicitud. Si necesitas ayuda con ella, escríbele a tu asesor.';
    case 'vencido':
      return 'Este enlace venció. Pídele a tu asesor que te envíe uno nuevo.';
    default:
      return 'Este enlace no es válido. Revisa que lo hayas copiado completo o pídele a tu asesor que te envíe uno nuevo.';
  }
}

// ── Cálculo ──────────────────────────────────────────────────────────────────────────────

const aNumero = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const redondear = (n: number): number => Math.round(n * 100) / 100;

export interface ResumenCuenta {
  precio: number;
  inicial: number;
  aFinanciar: number;
  cuota: number;
  totalIngresos: number;
  totalEgresos: number;
  capacidadPago: number;
  inicialMinima: number;
}

/**
 * La cuenta del asistente. La capacidad de pago es el porcentaje vigente del ingreso mensual (decisión del PO): los
 * egresos se declaran para el analista, pero no restan.
 */
export function calcularResumen(datos: DatosSolicitud, precio: number, politica: ParametrosFinanciamiento): ResumenCuenta {
  const inicial = aNumero(datos.inicialAportado);
  const aFinanciar = Math.max(precio - inicial, 0);
  const totalIngresos = aNumero(datos.sueldoMensual) + aNumero(datos.otrosIngresos);
  const totalEgresos = aNumero(datos.alquilerHipoteca) + aNumero(datos.alimentacionServicios) + aNumero(datos.pagosDeudas);
  return {
    precio,
    inicial,
    aFinanciar,
    // `calcularCuota` recibe el precio y la inicial en tanto por uno; sin nada que financiar no hay cuota.
    cuota: aFinanciar > 0 ? calcularCuota(precio, inicial / precio, politica) : 0,
    totalIngresos,
    totalEgresos,
    capacidadPago: totalIngresos * politica.ratioCuotaIngreso,
    inicialMinima: precio * politica.inicialMinima,
  };
}

// ── Envío ────────────────────────────────────────────────────────────────────────────────

export interface ArgumentosEnvio {
  token: string;
  datos: DatosSolicitud;
  precio: number;
  politica: ParametrosFinanciamiento;
  recaudos: RecaudoEnvioApi[];
  versionTexto: string;
}

const opcional = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

/**
 * Lo que se envía con el enlace. El vehículo no viaja: lo fija la oportunidad del enlace. Los montos de la cuenta van
 * redondeados a centavos y el servidor los vuelve a calcular; el RIF que no se pudo deducir queda vacío, no se inventa.
 */
export function construirEnvio({ token, datos, precio, politica, recaudos, versionTexto }: ArgumentosEnvio): SolicitudEnvioApi {
  const cuenta = calcularResumen(datos, precio, politica);
  const rif = datos.rif.trim() || derivarRIF(`${datos.tipoDocumento}${datos.numeroDocumento}`) || '';
  const declaracion = (id: string) => Boolean(datos.declaraciones[id]);
  return {
    token,
    montoSolicitado: redondear(cuenta.aFinanciar),
    cuotaInicial: redondear(cuenta.inicial),
    plazoMeses: politica.plazoMeses,
    frecuenciaPago: 'Mensual',
    cuotaEstimada: redondear(cuenta.cuota),
    capacidadPagoMensual: redondear(cuenta.capacidadPago),
    datosPersonales: {
      primerNombre: datos.primerNombre.trim(),
      segundoNombre: opcional(datos.segundoNombre),
      primerApellido: datos.primerApellido.trim(),
      segundoApellido: opcional(datos.segundoApellido),
      tipoDocumento: datos.tipoDocumento,
      numeroDocumento: datos.numeroDocumento.trim(),
      rif,
      nacionalidad: datos.nacionalidad,
      estadoCivil: datos.estadoCivil,
      fechaNacimiento: datos.fechaNacimiento,
      lugarNacimiento: datos.lugarNacimiento.trim(),
      nivelAcademico: datos.nivelAcademico,
      cargasFamiliares: Number(datos.cargasFamiliares) || 0,
      condicionVivienda: datos.condicionVivienda,
    },
    datosContacto: {
      direccionHabitacion: datos.direccion.trim(),
      puntoReferencia: opcional(datos.puntoReferencia),
      estado: datos.estado,
      municipio: datos.municipio,
      codigoPostal: opcional(datos.codigoPostal),
      telefonoHabitacion: opcional(datos.telefonoHabitacion),
      telefonoCelular: datos.telefonoCelular.trim(),
      correo: datos.correo.trim(),
    },
    datosLaborales: {
      situacionLaboral: datos.situacionLaboral,
      empresa: opcional(datos.empresa),
      rifEmpresa: opcional(datos.rifEmpresa),
      cargo: opcional(datos.cargo),
      antiguedadAnios: Number(datos.antiguedadAnios) || 0,
      antiguedadMeses: Number(datos.antiguedadMeses) || 0,
      direccionEmpresa: opcional(datos.direccionEmpresa),
      telefonoOficina: opcional(datos.telefonoOficina),
      nombreJefeInmediato: opcional(datos.jefeDirecto),
    },
    datosFinancieros: {
      sueldoMensual: aNumero(datos.sueldoMensual),
      otrosIngresos: aNumero(datos.otrosIngresos),
      conceptoOtrosIngresos: opcional(datos.conceptoOtrosIngresos),
      alquilerHipoteca: aNumero(datos.alquilerHipoteca),
      alimentacionServicios: aNumero(datos.alimentacionServicios),
      pagosDeudas: aNumero(datos.pagosDeudas),
    },
    referencias: datos.referencias
      .filter((r) => r.nombre.trim() !== '')
      .map((r) => ({ nombre: r.nombre.trim(), parentesco: r.parentesco.trim(), telefono: r.telefono.trim() })),
    datosBancarios: {
      banco: datos.banco,
      tipoCuenta: datos.tipoCuenta,
      numeroCuenta: datos.numeroCuenta.replace(/\D/g, ''),
    },
    declaraciones: {
      veracidad: declaracion('veracidad'),
      centralesRiesgo: declaracion('centrales-riesgo'),
      origenFondos: declaracion('origen-fondos'),
      compromisoPago: declaracion('compromiso-pago'),
      esPep: datos.esPEP,
      vinculoPep: datos.vinculoPEP,
      cargoPep: opcional(datos.cargoPEP),
      institucionPep: opcional(datos.institucionPEP),
      periodoPep: opcional(datos.periodoPEP),
      consentimientoDatos: datos.consentimientoDatos,
    },
    recaudos,
    versionTexto,
  };
}
