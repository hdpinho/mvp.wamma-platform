import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boton } from '../components/Boton';
import { Campo } from '../components/Campo';
import { NotaSimulada } from '../components/NotaSimulada';
import { FotoVehiculo } from '../components/FotoVehiculo';
import { useVehiculos } from '../state/vehiculosContexto';
import { esTokenFinanciamientoValido } from '../types/crm';
import { PARAMETROS_FINANCIAMIENTO, calcularCuota } from '../mocks/financiamiento';
import {
  BANCOS,
  CONDICIONES_VIVIENDA,
  DECLARACIONES,
  ESTADOS,
  ESTADOS_CIVILES,
  FRECUENCIAS_PAGO,
  MOTIVOS,
  MUNICIPIOS,
  NACIONALIDADES,
  NIVELES_ACADEMICOS,
  PASOS,
  PLAZOS_MESES,
  RECAUDOS,
  SITUACIONES_LABORALES,
  TIPOS_CUENTA,
  generarNumeroSolicitud,
} from '../mocks/solicitudCredito';
import {
  derivarRIF,
  mismoTelefono,
  requerido,
  validarCedula,
  validarCorreo,
  validarCuentaEstructura,
  validarFechaNacimiento,
  validarFijo,
  validarMovil,
  validarRIF,
} from '../validacion/venezuela';

/**
 * C9 · Solicitud de crédito en autoservicio — MAQUETA VISUAL.
 *
 * Digitaliza el formato en papel WMA-F-FIN-001 como asistente de 8 pasos.
 * Especificación completa en `specs/solicitud-credito/`.
 *
 * Alcance de esta maqueta: **solo la interfaz**. No hay API, ni persistencia,
 * ni OTP real, ni carga de archivos al servidor. El estado vive en memoria y se
 * pierde al recargar; en la plataforma real el borrador vive en el servidor y
 * el navegador solo guarda un token opaco (nunca datos personales).
 */

const formatoUSD = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const aNumero = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// ── Modelo del formulario ────────────────────────────────────────────

interface Referencia {
  nombre: string;
  parentesco: string;
  telefono: string;
}

interface Datos {
  // Paso 0
  vehiculoId: string;
  montoSolicitado: string;
  inicialAportado: string;
  plazoMeses: number;
  frecuencia: string;
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

const datosIniciales: Datos = {
  vehiculoId: '',
  montoSolicitado: '',
  inicialAportado: '',
  plazoMeses: PARAMETROS_FINANCIAMIENTO.plazoPorDefecto,
  frecuencia: 'Mensual',
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

type Errores = Record<string, string>;

// ── Piezas de presentación ───────────────────────────────────────────

const BarraProgreso: React.FC<{ paso: number }> = ({ paso }) => (
  <div style={{ marginBottom: 'var(--space-xl)' }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 'var(--space-sm)',
        gap: 'var(--space-md)',
      }}
    >
      <strong style={{ fontSize: '15px' }}>{PASOS[paso]}</strong>
      <span style={{ fontSize: '12px', color: 'var(--texto-mudo)', whiteSpace: 'nowrap' }}>
        Paso {paso + 1} de {PASOS.length}
      </span>
    </div>
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={PASOS.length}
      aria-valuenow={paso + 1}
      aria-label={`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`}
      style={{
        height: '6px',
        backgroundColor: 'var(--borde-claro)',
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${((paso + 1) / PASOS.length) * 100}%`,
          height: '100%',
          backgroundColor: 'var(--naranja-500)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  </div>
);

/** Línea que explica por qué se piden los datos de este paso. */
const Motivo: React.FC<{ paso: number }> = ({ paso }) => (
  <p
    style={{
      display: 'flex',
      gap: 'var(--space-sm)',
      alignItems: 'flex-start',
      fontSize: '13px',
      color: 'var(--texto-secundario)',
      backgroundColor: 'var(--naranja-50)',
      border: '1px solid var(--naranja-200)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-md)',
      marginBottom: 'var(--space-lg)',
    }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--naranja-700)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
    {MOTIVOS[paso]}
  </p>
);

const Bloque: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-lg)' }}>
    <legend
      style={{
        fontSize: '12px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--texto-mudo)',
        marginBottom: 'var(--space-md)',
        padding: 0,
      }}
    >
      {titulo}
    </legend>
    {children}
  </fieldset>
);

const Rejilla: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rejilla-sc">{children}</div>
);

/** Fila de un total calculado: se muestra, no se edita. */
const FilaTotal: React.FC<{ etiqueta: string; valor: number; destacado?: boolean; negativo?: boolean }> = ({
  etiqueta,
  valor,
  destacado,
  negativo,
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: 'var(--space-md)',
      padding: 'var(--space-sm) 0',
      borderTop: destacado ? '1px solid var(--borde)' : 'none',
      marginTop: destacado ? 'var(--space-sm)' : 0,
    }}
  >
    <span style={{ fontSize: destacado ? '14px' : '13px', fontWeight: destacado ? 700 : 400 }}>
      {etiqueta}
    </span>
    <strong
      style={{
        fontSize: destacado ? '18px' : '14px',
        color: negativo ? 'var(--peligro-texto)' : 'var(--texto-primario)',
      }}
    >
      {formatoUSD(valor)}
    </strong>
  </div>
);

// ── Pantalla ─────────────────────────────────────────────────────────

export const C9_SolicitudCredito: React.FC<{ rateBCV: number }> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Del inventario vivo y no de los mocks: así también aparecen los vehículos
  // cargados desde el backoffice.
  const { vehiculos } = useVehiculos();

  // Acceso por enlace personal (spec 010 §8.8): la solicitud ya no está abierta
  // al público. En la maqueta el token solo se valida por su forma.
  const accesoHabilitado = esTokenFinanciamientoValido(params.get('enlace'));

  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(() => {
    const vehiculoId = params.get('vehiculo') ?? '';
    const precio = vehiculos.find((v) => v.id === vehiculoId)?.precioUSD;
    return {
      ...datosIniciales,
      vehiculoId,
      // La inicial arranca en el mínimo vigente; el cliente puede aportar más.
      inicialAportado: precio ? String(Math.ceil(precio * PARAMETROS_FINANCIAMIENTO.inicialPorcentaje)) : '',
    };
  });
  const [errores, setErrores] = useState<Errores>({});
  const [archivos, setArchivos] = useState<Record<string, string[]>>({});

  // Cierre con OTP
  const [otpEnviado, setOtpEnviado] = useState('');
  const [otpIngresado, setOtpIngresado] = useState('');
  const [otpVerificado, setOtpVerificado] = useState(false);
  const [numeroSolicitud, setNumeroSolicitud] = useState('');

  const set = <K extends keyof Datos>(campo: K, valor: Datos[K]) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => {
      if (!e[campo as string]) return e;
      const resto = { ...e };
      delete resto[campo as string];
      return resto;
    });
  };

  const vehiculo = vehiculos.find((v) => v.id === datos.vehiculoId);
  const municipiosDisponibles = MUNICIPIOS[datos.estado] ?? [];

  // ── Cálculos en vivo ──────────────────────────────────────────────
  const financiero = useMemo(() => {
    const precio = vehiculo?.precioUSD ?? aNumero(datos.montoSolicitado);
    const inicial = aNumero(datos.inicialAportado);
    const aFinanciar = Math.max(precio - inicial, 0);
    const cuota = calcularCuota(aFinanciar, datos.plazoMeses);

    const totalIngresos = aNumero(datos.sueldoMensual) + aNumero(datos.otrosIngresos);
    const totalEgresos =
      aNumero(datos.alquilerHipoteca) + aNumero(datos.alimentacionServicios) + aNumero(datos.pagosDeudas);

    return {
      precio,
      inicial,
      aFinanciar,
      cuota,
      totalIngresos,
      totalEgresos,
      // Decisión del PO: 30 % del ingreso mensual; los egresos se declaran para
      // el analista, pero no restan. Misma regla que el núcleo Go.
      capacidadPago: totalIngresos * PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago,
      inicialMinima: precio * PARAMETROS_FINANCIAMIENTO.inicialPorcentaje,
    };
  }, [vehiculo, datos]);

  // ── Validación por paso ───────────────────────────────────────────
  const validarPaso = (n: number): Errores => {
    const e: Errores = {};
    const exigir = (campo: keyof Datos, etiqueta: string) => {
      const err = requerido(String(datos[campo] ?? ''), etiqueta);
      if (err) e[campo as string] = err;
    };

    if (n === 0) {
      if (!vehiculo && !aNumero(datos.montoSolicitado)) {
        e.montoSolicitado = 'Indica el monto solicitado o elige un vehículo';
      }
      if (financiero.inicial > financiero.precio) {
        e.inicialAportado = 'La inicial no puede superar el precio del vehículo';
      } else if (financiero.precio > 0 && financiero.inicial < financiero.inicialMinima) {
        e.inicialAportado = `La inicial mínima es el ${Math.round(
          PARAMETROS_FINANCIAMIENTO.inicialPorcentaje * 100,
        )} % del precio: ${formatoUSD(financiero.inicialMinima)}`;
      }
    }

    if (n === 1) {
      exigir('primerApellido', 'El primer apellido');
      exigir('primerNombre', 'El primer nombre');
      const errCedula = validarCedula(`${datos.tipoDocumento}${datos.numeroDocumento}`);
      if (datos.tipoDocumento !== 'P' && errCedula) e.numeroDocumento = errCedula;
      else if (datos.tipoDocumento === 'P' && !datos.numeroDocumento.trim()) {
        e.numeroDocumento = 'El número de pasaporte es obligatorio';
      }
      if (datos.rif) {
        const errRIF = validarRIF(datos.rif);
        if (errRIF) e.rif = errRIF;
      }
      const errFecha = validarFechaNacimiento(datos.fechaNacimiento);
      if (errFecha) e.fechaNacimiento = errFecha;
      exigir('lugarNacimiento', 'El lugar de nacimiento');
      if (Number(datos.cargasFamiliares) < 0 || !/^\d+$/.test(datos.cargasFamiliares)) {
        e.cargasFamiliares = 'Debe ser un número entero de cero o más';
      }
    }

    if (n === 2) {
      exigir('direccion', 'La dirección');
      exigir('estado', 'El estado');
      if (datos.estado && municipiosDisponibles.length === 0) {
        e.municipio = 'Todavía no hay catálogo de municipios para este estado';
      } else {
        exigir('municipio', 'El municipio');
      }
      const errMovil = validarMovil(datos.telefonoCelular);
      if (errMovil) e.telefonoCelular = errMovil;
      const errFijo = validarFijo(datos.telefonoHabitacion);
      if (errFijo) e.telefonoHabitacion = errFijo;
      const errCorreo = validarCorreo(datos.correo);
      if (errCorreo) e.correo = errCorreo;
    }

    if (n === 3) {
      const independiente = datos.situacionLaboral === 'Independiente o Firma Personal';
      const jubilado = datos.situacionLaboral === 'Jubilado o Pensionado';
      exigir('empresa', jubilado ? 'El ente pagador' : 'La empresa o negocio');
      if (!jubilado) exigir('cargo', 'El cargo');
      if (!jubilado) exigir('direccionEmpresa', 'La dirección de la empresa');
      if (!independiente && !jubilado && !datos.jefeDirecto.trim()) {
        e.jefeDirecto = 'El nombre del jefe directo es obligatorio';
      }
      if (!/^\d+$/.test(datos.antiguedadAnios)) {
        e.antiguedadAnios = jubilado ? 'Indica los años de pensión' : 'Indica la antigüedad en años';
      }
      if (datos.rifEmpresa) {
        const errRIF = validarRIF(datos.rifEmpresa);
        if (errRIF) e.rifEmpresa = errRIF;
      }
    }

    if (n === 4) {
      if (!aNumero(datos.sueldoMensual)) e.sueldoMensual = 'El ingreso mensual es obligatorio';
      if (!aNumero(datos.alimentacionServicios)) {
        e.alimentacionServicios = 'Indica cuánto gastas en alimentación y servicios';
      }
      if (aNumero(datos.otrosIngresos) > 0 && !datos.conceptoOtrosIngresos.trim()) {
        e.conceptoOtrosIngresos = 'Indica el concepto de los otros ingresos';
      }
    }

    if (n === 5) {
      datos.referencias.forEach((r, i) => {
        if (!r.nombre.trim()) e[`ref${i}nombre`] = 'El nombre es obligatorio';
        if (!r.parentesco.trim()) e[`ref${i}parentesco`] = 'El parentesco es obligatorio';
        const errTel = validarMovil(r.telefono);
        if (errTel) e[`ref${i}telefono`] = errTel;
      });

      // Los tres teléfonos deben ser distintos entre sí y del solicitante.
      datos.referencias.forEach((r, i) => {
        if (e[`ref${i}telefono`]) return;
        if (mismoTelefono(r.telefono, datos.telefonoCelular)) {
          e[`ref${i}telefono`] = 'No puede ser tu propio teléfono';
          return;
        }
        const repetida = datos.referencias.findIndex(
          (o, j) => j !== i && mismoTelefono(o.telefono, r.telefono),
        );
        if (repetida !== -1) e[`ref${i}telefono`] = 'Este teléfono está repetido en otra referencia';
      });

      exigir('banco', 'La institución bancaria');
      const errCuenta = validarCuentaEstructura(datos.numeroCuenta);
      if (errCuenta) e.numeroCuenta = errCuenta;
    }

    if (n === 7) {
      DECLARACIONES.forEach((d) => {
        if (!datos.declaraciones[d.id]) e[`decl-${d.id}`] = 'Debes aceptar esta declaración';
      });
      if (!datos.consentimientoDatos) {
        e.consentimientoDatos = 'Debes aceptar el tratamiento de tus datos';
      }
      if ((datos.esPEP || datos.vinculoPEP) && !datos.cargoPEP.trim()) {
        e.cargoPEP = 'Indica el cargo o la vinculación';
      }
      if (!otpVerificado) e.otp = 'Verifica el código enviado a tu teléfono';
    }

    return e;
  };

  const avanzar = () => {
    const e = validarPaso(paso);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retroceder = () => {
    setErrores({});
    setPaso((p) => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enviarOTP = () => {
    const codigo = String(Math.floor(Math.random() * 900000) + 100000);
    setOtpEnviado(codigo);
    setOtpVerificado(false);
    setOtpIngresado('');
  };

  const verificarOTP = () => {
    if (otpIngresado === otpEnviado && otpEnviado !== '') {
      setOtpVerificado(true);
      setErrores((e) => {
        const resto = { ...e };
        delete resto.otp;
        return resto;
      });
    } else {
      setErrores((e) => ({ ...e, otp: 'El código no coincide' }));
    }
  };

  const enviarSolicitud = () => {
    const e = validarPaso(7);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setNumeroSolicitud(generarNumeroSolicitud());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const recaudosCargados = RECAUDOS.filter((r) => (archivos[r.id] ?? []).length > 0).length;

  // ── Confirmación ──────────────────────────────────────────────────
  // ── Acceso por enlace personal ────────────────────────────────────
  // La solicitud ya no está abierta al público (spec 010 §8.8): se llega con el
  // enlace que emite el asesor al vender con financiamiento. Va después de todos
  // los hooks para no romper su orden entre renders.
  if (!accesoHabilitado || !vehiculo) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div
          style={{
            backgroundColor: 'var(--blanco)',
            border: '1px solid var(--borde-claro)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xxl)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: 'var(--space-md)' }} aria-hidden="true">
            🔒
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: 'var(--space-sm)' }}>
            {accesoHabilitado
              ? 'El vehículo de este enlace ya no está disponible'
              : 'La solicitud de financiamiento se habilita después de tu visita'}
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--texto-secundario)',
              lineHeight: 1.5,
              margin: '0 auto var(--space-xl)',
              maxWidth: '46ch',
            }}
          >
            {accesoHabilitado
              ? 'Escríbele a tu asesor para que revise el enlace o te envíe uno nuevo.'
              : 'Primero conoces el vehículo en la sede. Si decides comprarlo financiado, tu asesor te envía un enlace personal para completar esta solicitud desde tu teléfono.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Boton variant="primary" onClick={() => navigate('/catalogo')}>
              Ver el catálogo
            </Boton>
            <Boton variant="secondary" onClick={() => navigate('/financiamiento')}>
              Cómo funciona
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  if (numeroSolicitud) {
    return (
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <div
          style={{
            backgroundColor: 'var(--blanco)',
            border: '1px solid var(--exito-texto)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xxxl) var(--space-xl)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--exito-fondo)',
              color: 'var(--exito-texto)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-lg)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 style={{ fontSize: '22px', marginBottom: 'var(--space-sm)' }}>Solicitud recibida</h1>
          <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', marginBottom: 'var(--space-lg)' }}>
            Guarda este número: con él puedes consultar el estado de tu solicitud.
          </p>

          <div
            style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--naranja-700)',
              backgroundColor: 'var(--naranja-50)',
              border: '1px solid var(--naranja-200)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-lg)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            {numeroSolicitud}
          </div>

          {recaudosCargados < RECAUDOS.length && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <span className="badge badge-aviso">Recaudos incompletos</span>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginTop: 'var(--space-sm)' }}>
                Faltan {RECAUDOS.length - recaudosCargados} de {RECAUDOS.length} documentos. Te
                enviaremos un enlace para completarlos.
              </p>
            </div>
          )}

          {(datos.esPEP || datos.vinculoPEP) && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <span className="badge badge-info">Debida diligencia ampliada</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Boton variant="secondary" onClick={() => navigate('/catalogo')}>
              Volver al catálogo
            </Boton>
            {/* Antes llevaba a /panel, una ruta que ya no existe. */}
            <Boton variant="primary" onClick={() => navigate('/')}>
              Ir al inicio
            </Boton>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-lg)' }}>
          <NotaSimulada variante="bloque">
            Maqueta visual: la solicitud no se envió a ningún servidor y el número es aleatorio. En
            la plataforma real aquí se descarga el PDF del formato WMA-F-FIN-001 y se sella la
            evidencia de aceptación con hash, IP y marca de tiempo del servidor.
          </NotaSimulada>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: '24px' }}>Solicitud de financiamiento</h1>
        <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
          Completa los datos desde tu teléfono. Toma unos minutos.
        </p>
      </header>

      <BarraProgreso paso={paso} />

      <div
        style={{
          backgroundColor: 'var(--blanco)',
          border: '1px solid var(--borde-claro)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
        }}
      >
        <Motivo paso={paso} />

        {/* ── Paso 0 · Vehículo y condiciones ── */}
        {paso === 0 && (
          <>
            {vehiculo ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr',
                  gap: 'var(--space-lg)',
                  alignItems: 'center',
                  backgroundColor: 'var(--superficie)',
                  border: '1px solid var(--borde-claro)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                <FotoVehiculo vehiculo={vehiculo} alto={78} redondeo="var(--radius-sm)" />
                <div style={{ display: 'grid', gap: '2px', fontSize: '13px' }}>
                  <strong style={{ fontSize: '15px' }}>
                    {vehiculo.marca} {vehiculo.modelo} {vehiculo.anio}
                  </strong>
                  <span style={{ color: 'var(--texto-secundario)' }}>{vehiculo.version}</span>
                  <span style={{ color: 'var(--texto-secundario)' }}>
                    Precio {formatoUSD(vehiculo.precioUSD)}
                  </span>
                </div>
              </div>
            ) : (
              <Campo
                label="Vehículo"
                type="select"
                value={datos.vehiculoId}
                onChange={(e) => set('vehiculoId', e.target.value)}
                options={[
                  { value: '', label: 'Aún no he elegido vehículo' },
                  ...vehiculos.map((v) => ({
                    value: v.id,
                    label: `${v.marca} ${v.modelo} ${v.anio} — ${formatoUSD(v.precioUSD)}`,
                  })),
                ]}
              />
            )}

            <Rejilla>
              {!vehiculo && (
                <Campo
                  label="Monto solicitado (USD)"
                  type="number"
                  value={datos.montoSolicitado}
                  onChange={(e) => set('montoSolicitado', e.target.value)}
                  error={errores.montoSolicitado}
                />
              )}
              <Campo
                label="Inicial aportado (USD)"
                type="number"
                value={datos.inicialAportado}
                onChange={(e) => set('inicialAportado', e.target.value)}
                error={errores.inicialAportado}
              />
              <Campo
                label="Plazo"
                type="select"
                value={String(datos.plazoMeses)}
                onChange={(e) => set('plazoMeses', Number(e.target.value))}
                options={PLAZOS_MESES.map((m) => ({ value: String(m), label: `${m} meses` }))}
              />
              <Campo
                label="Frecuencia de pago"
                type="select"
                value={datos.frecuencia}
                onChange={(e) => set('frecuencia', e.target.value)}
                options={FRECUENCIAS_PAGO.map((f) => ({ value: f, label: f }))}
              />
            </Rejilla>

            <div
              style={{
                backgroundColor: 'var(--naranja-50)',
                border: '1px solid var(--naranja-200)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                textAlign: 'center',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--naranja-700)' }}>
                Cuota estimada
              </div>
              <div style={{ fontSize: '30px', fontWeight: 700, lineHeight: 1.2 }}>
                {formatoUSD(financiero.cuota)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                A financiar {formatoUSD(financiero.aFinanciar)} · tasa BCV {rateBCV.toFixed(2)}
              </div>
            </div>

            <NotaSimulada>
              Cifra referencial. La cuota definitiva depende de la evaluación crediticia y se
              confirma en el contrato.
            </NotaSimulada>
          </>
        )}

        {/* ── Paso 1 · Identificación ── */}
        {paso === 1 && (
          <>
            <Bloque titulo="Nombre completo">
              <Rejilla>
                <Campo label="Primer apellido *" value={datos.primerApellido} onChange={(e) => set('primerApellido', e.target.value)} error={errores.primerApellido} />
                <Campo label="Segundo apellido" value={datos.segundoApellido} onChange={(e) => set('segundoApellido', e.target.value)} />
                <Campo label="Primer nombre *" value={datos.primerNombre} onChange={(e) => set('primerNombre', e.target.value)} error={errores.primerNombre} />
                <Campo label="Segundo nombre" value={datos.segundoNombre} onChange={(e) => set('segundoNombre', e.target.value)} />
              </Rejilla>
            </Bloque>

            <Bloque titulo="Documento de identidad">
              <Rejilla>
                <Campo
                  label="Tipo *"
                  type="select"
                  value={datos.tipoDocumento}
                  onChange={(e) => set('tipoDocumento', e.target.value)}
                  options={[
                    { value: 'V', label: 'V — Venezolano' },
                    { value: 'E', label: 'E — Extranjero' },
                    { value: 'P', label: 'P — Pasaporte' },
                  ]}
                />
                <Campo
                  label="Número *"
                  value={datos.numeroDocumento}
                  onChange={(e) => {
                    set('numeroDocumento', e.target.value);
                    // El RIF se deduce de la cédula; el usuario puede corregirlo.
                    if (datos.tipoDocumento !== 'P') {
                      const derivado = derivarRIF(`${datos.tipoDocumento}${e.target.value}`);
                      if (derivado) set('rif', derivado);
                    }
                  }}
                  error={errores.numeroDocumento}
                  placeholder="12345678"
                />
              </Rejilla>
              <Campo
                label="RIF personal (se deduce de tu cédula, puedes corregirlo)"
                value={datos.rif}
                onChange={(e) => set('rif', e.target.value)}
                error={errores.rif}
                placeholder="V-12345678-0"
              />
            </Bloque>

            <Bloque titulo="Datos personales">
              <Rejilla>
                <Campo label="Nacionalidad" type="select" value={datos.nacionalidad} onChange={(e) => set('nacionalidad', e.target.value)} options={NACIONALIDADES.map((n) => ({ value: n, label: n }))} />
                <Campo label="Estado civil" type="select" value={datos.estadoCivil} onChange={(e) => set('estadoCivil', e.target.value)} options={ESTADOS_CIVILES.map((n) => ({ value: n, label: n }))} />
                <Campo label="Fecha de nacimiento *" type="date" value={datos.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} error={errores.fechaNacimiento} />
                <Campo label="Lugar de nacimiento *" value={datos.lugarNacimiento} onChange={(e) => set('lugarNacimiento', e.target.value)} error={errores.lugarNacimiento} />
                <Campo label="Nivel académico" type="select" value={datos.nivelAcademico} onChange={(e) => set('nivelAcademico', e.target.value)} options={NIVELES_ACADEMICOS.map((n) => ({ value: n, label: n }))} />
                <Campo label="Cargas familiares" type="number" value={datos.cargasFamiliares} onChange={(e) => set('cargasFamiliares', e.target.value)} error={errores.cargasFamiliares} />
              </Rejilla>
              <Campo label="Condición de vivienda *" type="select" value={datos.condicionVivienda} onChange={(e) => set('condicionVivienda', e.target.value)} options={CONDICIONES_VIVIENDA.map((n) => ({ value: n, label: n }))} />
            </Bloque>
          </>
        )}

        {/* ── Paso 2 · Ubicación y contacto ── */}
        {paso === 2 && (
          <>
            <Campo label="Dirección de habitación *" type="textarea" value={datos.direccion} onChange={(e) => set('direccion', e.target.value)} error={errores.direccion} />
            <Campo label="Punto de referencia" value={datos.puntoReferencia} onChange={(e) => set('puntoReferencia', e.target.value)} />

            <Rejilla>
              <Campo
                label="Estado *"
                type="select"
                value={datos.estado}
                onChange={(e) => {
                  set('estado', e.target.value);
                  set('municipio', '');
                }}
                error={errores.estado}
                options={[{ value: '', label: 'Selecciona…' }, ...ESTADOS.map((s) => ({ value: s, label: s }))]}
              />
              <Campo
                label="Ciudad / Municipio *"
                type="select"
                value={datos.municipio}
                onChange={(e) => set('municipio', e.target.value)}
                error={errores.municipio}
                disabled={!datos.estado || municipiosDisponibles.length === 0}
                options={[
                  { value: '', label: datos.estado ? 'Selecciona…' : 'Elige primero el estado' },
                  ...municipiosDisponibles.map((m) => ({ value: m, label: m })),
                ]}
              />
            </Rejilla>

            {datos.estado && municipiosDisponibles.length === 0 && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <NotaSimulada variante="bloque">
                  Todavía no hay catálogo oficial de municipios para {datos.estado}. En la maqueta
                  solo se cargaron los de la Gran Caracas; el resto queda pendiente del listado
                  autoritativo y por eso el paso no permite avanzar.
                </NotaSimulada>
              </div>
            )}

            <Rejilla>
              <Campo label="Código postal" value={datos.codigoPostal} onChange={(e) => set('codigoPostal', e.target.value)} />
              <Campo label="Teléfono de habitación" value={datos.telefonoHabitacion} onChange={(e) => set('telefonoHabitacion', e.target.value)} error={errores.telefonoHabitacion} placeholder="0212-1234567" />
              <Campo label="Teléfono celular *" value={datos.telefonoCelular} onChange={(e) => set('telefonoCelular', e.target.value)} error={errores.telefonoCelular} placeholder="0412-1234567" />
              <Campo label="Correo electrónico *" type="email" value={datos.correo} onChange={(e) => set('correo', e.target.value)} error={errores.correo} placeholder="tu@correo.com" />
            </Rejilla>
          </>
        )}

        {/* ── Paso 3 · Información laboral ── */}
        {paso === 3 && (
          <>
            <Campo
              label="Situación laboral *"
              type="select"
              value={datos.situacionLaboral}
              onChange={(e) => set('situacionLaboral', e.target.value)}
              options={SITUACIONES_LABORALES.map((s) => ({ value: s, label: s }))}
            />

            {(() => {
              const independiente = datos.situacionLaboral === 'Independiente o Firma Personal';
              const jubilado = datos.situacionLaboral === 'Jubilado o Pensionado';
              return (
                <>
                  <Rejilla>
                    <Campo
                      label={
                        independiente
                          ? 'Nombre de la firma personal o actividad *'
                          : jubilado
                            ? 'Ente pagador *'
                            : 'Empresa o negocio *'
                      }
                      value={datos.empresa}
                      onChange={(e) => set('empresa', e.target.value)}
                      error={errores.empresa}
                    />
                    <Campo label="RIF de la empresa" value={datos.rifEmpresa} onChange={(e) => set('rifEmpresa', e.target.value)} error={errores.rifEmpresa} placeholder="J-12345678-0" />
                  </Rejilla>

                  {!jubilado && (
                    <Campo label="Cargo desempeñado *" value={datos.cargo} onChange={(e) => set('cargo', e.target.value)} error={errores.cargo} />
                  )}

                  <Rejilla>
                    <Campo
                      label={jubilado ? 'Años de pensión *' : 'Antigüedad (años) *'}
                      type="number"
                      value={datos.antiguedadAnios}
                      onChange={(e) => set('antiguedadAnios', e.target.value)}
                      error={errores.antiguedadAnios}
                    />
                    <Campo label="Antigüedad (meses)" type="number" value={datos.antiguedadMeses} onChange={(e) => set('antiguedadMeses', e.target.value)} />
                  </Rejilla>

                  {!jubilado && (
                    <Campo label="Dirección de la empresa *" type="textarea" value={datos.direccionEmpresa} onChange={(e) => set('direccionEmpresa', e.target.value)} error={errores.direccionEmpresa} />
                  )}

                  <Rejilla>
                    <Campo label="Teléfono de oficina" value={datos.telefonoOficina} onChange={(e) => set('telefonoOficina', e.target.value)} />
                    {!independiente && !jubilado && (
                      <Campo label="Jefe directo *" value={datos.jefeDirecto} onChange={(e) => set('jefeDirecto', e.target.value)} error={errores.jefeDirecto} />
                    )}
                  </Rejilla>
                </>
              );
            })()}
          </>
        )}

        {/* ── Paso 4 · Balance financiero ── */}
        {paso === 4 && (
          <>
            <Bloque titulo="Ingresos mensuales">
              <Rejilla>
                <Campo label="Sueldo o ingreso mensual (USD) *" type="number" value={datos.sueldoMensual} onChange={(e) => set('sueldoMensual', e.target.value)} error={errores.sueldoMensual} />
                <Campo label="Otros ingresos comprobables (USD)" type="number" value={datos.otrosIngresos} onChange={(e) => set('otrosIngresos', e.target.value)} />
              </Rejilla>
              {aNumero(datos.otrosIngresos) > 0 && (
                <Campo label="Concepto de otros ingresos *" value={datos.conceptoOtrosIngresos} onChange={(e) => set('conceptoOtrosIngresos', e.target.value)} error={errores.conceptoOtrosIngresos} />
              )}
            </Bloque>

            <Bloque titulo="Egresos mensuales">
              <Rejilla>
                <Campo label="Alquiler o hipoteca (USD)" type="number" value={datos.alquilerHipoteca} onChange={(e) => set('alquilerHipoteca', e.target.value)} />
                <Campo label="Alimentación y servicios (USD) *" type="number" value={datos.alimentacionServicios} onChange={(e) => set('alimentacionServicios', e.target.value)} error={errores.alimentacionServicios} />
                <Campo label="Pagos de deudas y créditos (USD)" type="number" value={datos.pagosDeudas} onChange={(e) => set('pagosDeudas', e.target.value)} />
              </Rejilla>
            </Bloque>

            <div
              style={{
                backgroundColor: 'var(--superficie)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texto-mudo)', marginBottom: 'var(--space-sm)' }}>
                Calculado automáticamente
              </div>
              <FilaTotal etiqueta="Total ingresos" valor={financiero.totalIngresos} />
              <FilaTotal etiqueta="Total egresos" valor={financiero.totalEgresos} />
              <FilaTotal
                etiqueta={`Capacidad de pago (${Math.round(
                  PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago * 100,
                )} % del ingreso)`}
                valor={financiero.capacidadPago}
                destacado
                negativo={financiero.capacidadPago < 0}
              />
            </div>

            {financiero.cuota > 0 && financiero.cuota > financiero.capacidadPago && (
              <div
                style={{
                  backgroundColor: 'var(--aviso-fondo)',
                  border: '1px solid #EFD9AE',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  fontSize: '13px',
                  color: 'var(--aviso-texto)',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                La cuota estimada de {formatoUSD(financiero.cuota)} supera tu capacidad de pago: el{' '}
                {Math.round(PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago * 100)} % de tu ingreso mensual.
                Puedes continuar: un analista revisará tu caso y podrá proponerte otro plazo o
                una inicial mayor.
              </div>
            )}

            <NotaSimulada>
              Los totales se calculan solos y no se pueden editar. En el formato en papel eran
              casillas a rellenar a mano, de donde venían las inconsistencias. La capacidad de pago
              es el 30 % del ingreso mensual: los egresos se registran para el analista, pero no la
              reducen.
            </NotaSimulada>
          </>
        )}

        {/* ── Paso 5 · Referencias y banco ── */}
        {paso === 5 && (
          <>
            {(['Referencia personal 1', 'Referencia personal 2', 'Referencia familiar'] as const).map(
              (titulo, i) => (
                <Bloque key={titulo} titulo={titulo}>
                  <Rejilla>
                    <Campo
                      label="Nombre y apellido *"
                      value={datos.referencias[i].nombre}
                      onChange={(e) => {
                        const refs = [...datos.referencias] as Datos['referencias'];
                        refs[i] = { ...refs[i], nombre: e.target.value };
                        set('referencias', refs);
                      }}
                      error={errores[`ref${i}nombre`]}
                    />
                    <Campo
                      label="Parentesco o relación *"
                      value={datos.referencias[i].parentesco}
                      onChange={(e) => {
                        const refs = [...datos.referencias] as Datos['referencias'];
                        refs[i] = { ...refs[i], parentesco: e.target.value };
                        set('referencias', refs);
                      }}
                      error={errores[`ref${i}parentesco`]}
                    />
                  </Rejilla>
                  <Campo
                    label="Teléfono *"
                    value={datos.referencias[i].telefono}
                    onChange={(e) => {
                      const refs = [...datos.referencias] as Datos['referencias'];
                      refs[i] = { ...refs[i], telefono: e.target.value };
                      set('referencias', refs);
                    }}
                    error={errores[`ref${i}telefono`]}
                    placeholder="0412-1234567"
                  />
                </Bloque>
              ),
            )}

            <Bloque titulo="Datos bancarios">
              <Rejilla>
                <Campo
                  label="Institución bancaria *"
                  type="select"
                  value={datos.banco}
                  onChange={(e) => set('banco', e.target.value)}
                  error={errores.banco}
                  options={[
                    { value: '', label: 'Selecciona…' },
                    ...BANCOS.map((b) => ({ value: b.codigo, label: `${b.codigo} — ${b.nombre}` })),
                  ]}
                />
                <Campo label="Tipo de cuenta *" type="select" value={datos.tipoCuenta} onChange={(e) => set('tipoCuenta', e.target.value)} options={TIPOS_CUENTA.map((t) => ({ value: t, label: t }))} />
              </Rejilla>
              <Campo
                label="Número de cuenta (20 dígitos) *"
                value={datos.numeroCuenta}
                onChange={(e) => set('numeroCuenta', e.target.value)}
                error={errores.numeroCuenta}
                placeholder="0102 0000 0000 0000 0000"
              />
            </Bloque>

            <NotaSimulada>
              La lista de bancos es provisional y no está confirmada contra el listado oficial de
              Sudeban. El dígito verificador de la cuenta no se comprueba: falta el algoritmo.
            </NotaSimulada>
          </>
        )}

        {/* ── Paso 6 · Recaudos ── */}
        {paso === 6 && (
          <>
            <div style={{ display: 'grid', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              {RECAUDOS.map((r) => {
                const cargados = archivos[r.id] ?? [];
                return (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid var(--borde-claro)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-lg)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 240px' }}>
                        <strong style={{ fontSize: '14px' }}>{r.titulo}</strong>
                        <p style={{ fontSize: '12px', color: 'var(--texto-mudo)', marginTop: '2px' }}>
                          {r.detalle}
                        </p>
                      </div>
                      <span className={`badge ${cargados.length ? 'badge-exito' : 'badge-aviso'}`}>
                        {cargados.length ? 'Recibido' : 'Pendiente'}
                      </span>
                    </div>

                    <label
                      style={{
                        display: 'inline-block',
                        marginTop: 'var(--space-md)',
                        padding: '9px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--naranja-500)',
                        color: 'var(--naranja-500)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Adjuntar archivo
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const nombres = Array.from(e.target.files ?? []).map((f) => f.name);
                          if (!nombres.length) return;
                          setArchivos((a) => ({ ...a, [r.id]: [...(a[r.id] ?? []), ...nombres] }));
                        }}
                      />
                    </label>

                    {cargados.length > 0 && (
                      <ul style={{ listStyle: 'none', marginTop: 'var(--space-md)', display: 'grid', gap: '4px' }}>
                        {cargados.map((nombre, i) => (
                          <li
                            key={`${nombre}-${i}`}
                            style={{ fontSize: '12px', color: 'var(--texto-secundario)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)' }}
                          >
                            <span>📎 {nombre}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setArchivos((a) => ({
                                  ...a,
                                  [r.id]: (a[r.id] ?? []).filter((_, j) => j !== i),
                                }))
                              }
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--peligro-texto)', fontSize: '12px' }}
                            >
                              Quitar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                fontSize: '13px',
                color: 'var(--texto-secundario)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <strong>{recaudosCargados} de {RECAUDOS.length}</strong> recaudos adjuntos.
              {recaudosCargados < RECAUDOS.length &&
                ' Puedes enviar la solicitud igual y completarlos después.'}
            </div>

            <NotaSimulada>
              Los archivos no se suben a ningún servidor: solo se listan sus nombres. En la
              plataforma real cada archivo pasa por antivirus, se le calcula el hash y se cifra
              antes de guardarse en almacenamiento nacional.
            </NotaSimulada>
          </>
        )}

        {/* ── Paso 7 · Declaraciones y cierre ── */}
        {paso === 7 && (
          <>
            <div style={{ display: 'grid', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              {DECLARACIONES.map((d) => (
                <label
                  key={d.id}
                  style={{
                    display: 'flex',
                    gap: 'var(--space-md)',
                    alignItems: 'flex-start',
                    border: `1px solid ${errores[`decl-${d.id}`] ? 'var(--peligro-texto)' : 'var(--borde-claro)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-lg)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!datos.declaraciones[d.id]}
                    onChange={(e) =>
                      set('declaraciones', { ...datos.declaraciones, [d.id]: e.target.checked })
                    }
                    style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--naranja-500)', flexShrink: 0 }}
                  />
                  <span>
                    <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>
                      {d.titulo}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: 1.5 }}>
                      {d.texto}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <Bloque titulo="Persona Expuesta Políticamente (PEP)">
              <label style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start', marginBottom: 'var(--space-md)', cursor: 'pointer' }}>
                <input type="checkbox" checked={datos.esPEP} onChange={(e) => set('esPEP', e.target.checked)} style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--naranja-500)' }} />
                <span style={{ fontSize: '13px' }}>
                  ¿Es usted, o lo ha sido en los últimos cinco años, una Persona Expuesta
                  Políticamente?
                </span>
              </label>
              <label style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={datos.vinculoPEP} onChange={(e) => set('vinculoPEP', e.target.checked)} style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--naranja-500)' }} />
                <span style={{ fontSize: '13px' }}>
                  ¿Tiene vínculo familiar o de asociación cercana con una PEP?
                </span>
              </label>

              {(datos.esPEP || datos.vinculoPEP) && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <Rejilla>
                    <Campo label="Cargo o vinculación *" value={datos.cargoPEP} onChange={(e) => set('cargoPEP', e.target.value)} error={errores.cargoPEP} />
                    <Campo label="Institución" value={datos.institucionPEP} onChange={(e) => set('institucionPEP', e.target.value)} />
                  </Rejilla>
                  <Campo label="Período" value={datos.periodoPEP} onChange={(e) => set('periodoPEP', e.target.value)} placeholder="Ej. 2019 – 2023" />
                </div>
              )}
            </Bloque>

            <label
              style={{
                display: 'flex',
                gap: 'var(--space-md)',
                alignItems: 'flex-start',
                border: `1px solid ${errores.consentimientoDatos ? 'var(--peligro-texto)' : 'var(--borde-claro)'}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                marginBottom: 'var(--space-lg)',
                cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={datos.consentimientoDatos} onChange={(e) => set('consentimientoDatos', e.target.checked)} style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--naranja-500)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px' }}>
                Acepto el tratamiento de mis datos personales conforme a la política de privacidad
                de WAMMA. <em style={{ color: 'var(--texto-mudo)' }}>(Texto pendiente de aprobación legal.)</em>
              </span>
            </label>

            <Bloque titulo="Verificación por código">
              {!otpEnviado ? (
                <Boton variant="secondary" fullWidth onClick={enviarOTP}>
                  Enviar código a {datos.telefonoCelular || 'mi teléfono'}
                </Boton>
              ) : (
                <>
                  <div
                    style={{
                      backgroundColor: 'var(--info-fondo)',
                      border: '1px solid #C5DBF2',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-md)',
                      fontSize: '13px',
                      color: 'var(--info-texto)',
                      marginBottom: 'var(--space-md)',
                    }}
                  >
                    Maqueta: no se envía nada por WhatsApp. Tu código es{' '}
                    <strong style={{ letterSpacing: '0.1em' }}>{otpEnviado}</strong>
                  </div>

                  <Rejilla>
                    <Campo
                      label="Código de 6 dígitos"
                      value={otpIngresado}
                      onChange={(e) => setOtpIngresado(e.target.value)}
                      error={errores.otp}
                      disabled={otpVerificado}
                      placeholder="000000"
                    />
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 'var(--space-lg)' }}>
                      {otpVerificado ? (
                        <span className="badge badge-exito">Teléfono verificado</span>
                      ) : (
                        <Boton variant="secondary" onClick={verificarOTP} style={{ width: '100%' }}>
                          Verificar
                        </Boton>
                      )}
                    </div>
                  </Rejilla>
                </>
              )}
            </Bloque>

            <NotaSimulada variante="bloque">
              El OTP sustituye a la huella dactilar del formato en papel. En la plataforma real
              llega por WhatsApp con respaldo SMS, vence a los 5 minutos y admite 3 intentos; al
              enviar se sella el hash del expediente con IP y marca de tiempo del servidor.
            </NotaSimulada>
          </>
        )}

        {/* ── Navegación ── */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-md)',
            marginTop: 'var(--space-xl)',
            paddingTop: 'var(--space-lg)',
            borderTop: '1px solid var(--borde-claro)',
          }}
        >
          {paso > 0 && (
            <Boton variant="secondary" onClick={retroceder} style={{ flex: 1 }}>
              Atrás
            </Boton>
          )}
          {paso < PASOS.length - 1 ? (
            <Boton variant="primary" onClick={avanzar} style={{ flex: 2 }}>
              Continuar
            </Boton>
          ) : (
            <Boton variant="primary" onClick={enviarSolicitud} style={{ flex: 2 }}>
              Enviar solicitud
            </Boton>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'var(--space-lg)' }}>
        <NotaSimulada variante="bloque">
          Maqueta visual del módulo de solicitud de crédito. No hay servidor: los datos viven en
          memoria y se pierden al recargar. En la plataforma real el borrador se guarda en el
          servidor y el navegador solo conserva un token opaco, nunca datos personales.
        </NotaSimulada>
      </div>

      <style>{`
        .rejilla-sc {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
        }
        @media (max-width: 560px) {
          .rejilla-sc { grid-template-columns: 1fr; gap: 0; }
        }
      `}</style>
    </div>
  );
};
