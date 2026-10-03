import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Boton } from '../components/Boton';
import { Campo } from '../components/Campo';
import { NotaSimulada } from '../components/NotaSimulada';
import { useVehiculos } from '../state/vehiculosContexto';
import { esTokenFinanciamientoValido } from '../types/crm';
import { PARAMETROS_APROBADOS, formatoEUR } from '../services/financiamientoMotor';
import {
  BANCOS,
  CONDICIONES_VIVIENDA,
  DECLARACIONES,
  ESTADOS,
  ESTADOS_CIVILES,
  MOTIVOS,
  MUNICIPIOS,
  NACIONALIDADES,
  NIVELES_ACADEMICOS,
  PASOS,
  RECAUDOS,
  SITUACIONES_LABORALES,
  TIPOS_CUENTA,
  VERSION_TEXTO_DECLARACIONES,
  generarNumeroSolicitud,
} from '../mocks/solicitudCredito';
import { ErrorApi, apiConfigurada, mensajeDeError } from '../api/cliente';
import {
  validarEnlaceFinanciamiento,
  subirRecaudoDigital,
  enviarSolicitudCredito,
  completarRecaudos,
  type RecaudoEnvioApi,
} from '../api/credito';
import {
  calcularResumen,
  construirEnvio,
  contextoDesdeEnlace,
  datosIniciales,
  mensajeEnlaceNoValido,
  precargarSolicitante,
  type ContextoSolicitud,
  type DatosSolicitud as Datos,
} from '../services/solicitudCredito';
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
 * C9 · Solicitud de crédito en autoservicio.
 *
 * Digitaliza el formato en papel WMA-F-FIN-001 como asistente de 8 pasos.
 * Especificación completa en `specs/solicitud-credito/`.
 *
 * Con servidor (`VITE_API_URL`) se llega **solo con el enlace personal** que emite el asesor: el servidor lo valida y
 * trae el vehículo, la política vigente y lo que ya sabe de la persona; los recaudos van al contenedor privado (D-59)
 * y la solicitud se envía de verdad. Sin OTP (D-57): la aceptación queda registrada con fecha, IP, agente y la versión
 * del texto aceptado. Si algo falla, la pantalla lo dice y deja reintentar: nunca simula un envío con servidor.
 *
 * Sin servidor es una demostración en el navegador: el estado vive en memoria y el envío es simulado y rotulado.
 */

type Errores = Record<string, string>;

const aNumero = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

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

/** Foto del vehículo del enlace; sin foto, o si falla, una caja neutra con su nombre. */
const FotoDelEnlace: React.FC<{ url: string | null; descripcion: string }> = ({ url, descripcion }) => {
  const [fallo, setFallo] = useState(false);
  const cajaNeutra: React.CSSProperties = {
    height: '78px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: '#EFEDEA',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  };
  if (!url || fallo) {
    return (
      <div role="img" aria-label={`Imagen referencial de ${descripcion}`} style={cajaNeutra}>
        🚗
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={descripcion}
      onError={() => setFallo(true)}
      style={{ width: '100%', height: '78px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
    />
  );
};

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
      {formatoEUR(valor)}
    </strong>
  </div>
);

/** Límite por archivo del servidor (`spring.servlet.multipart.max-file-size`). */
const TAMANO_MAXIMO_RECAUDO = 10 * 1024 * 1024;

/**
 * Archivo adjunto a un recaudo. `cargado` es lo que devolvió el servidor al guardarlo en el
 * contenedor privado; es nulo en la demostración, donde el archivo no sale del navegador.
 */
interface Adjunto {
  id: string;
  recaudoId: string;
  nombre: string;
  cargado: RecaudoEnvioApi | null;
}

/**
 * El estado del enlace personal. Con servidor, la solicitud existe solo si el servidor valida el enlace: mientras no
 * responda se dice que se está validando, y si no responde se ofrece reintentar (no se abre «en modo local»).
 */
type EstadoEnlace =
  | { tipo: 'sin_enlace' }
  | { tipo: 'validando' }
  | { tipo: 'no_valido'; mensaje: string }
  | { tipo: 'sin_conexion'; mensaje: string }
  | { tipo: 'listo'; contexto: ContextoSolicitud };

/** Lo que se sabe del enlace de la dirección, junto al token y al intento a que corresponde. */
interface ResultadoValidacion {
  token: string;
  intento: number;
  estado: Exclude<EstadoEnlace, { tipo: 'sin_enlace' } | { tipo: 'validando' }>;
}

/** El vehículo del enlace, con su foto y su precio: el paso 0 y la pantalla de recaudos pendientes lo muestran igual. */
const resumenDelVehiculo = (contexto: ContextoSolicitud) => (
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
    <FotoDelEnlace url={contexto.vehiculo.fotoUrl} descripcion={contexto.vehiculo.titulo} />
    <div style={{ display: 'grid', gap: '2px', fontSize: '13px' }}>
      <strong style={{ fontSize: '15px' }}>{contexto.vehiculo.titulo}</strong>
      <span style={{ color: 'var(--texto-secundario)' }}>{contexto.vehiculo.version}</span>
      <span style={{ color: 'var(--texto-secundario)' }}>Precio {formatoEUR(contexto.vehiculo.precio)}</span>
    </div>
  </div>
);

// ── Pantalla ─────────────────────────────────────────────────────────

export const C9_SolicitudCredito: React.FC<{ rateBCV: number }> = ({ rateBCV: _rateBCV }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Solo para la demostración: con servidor el vehículo llega con el enlace. Un vehículo reservado para esta venta ya
  // no está en la vitrina, así que buscarlo ahí lo daría por «no disponible».
  const { vehiculos } = useVehiculos();

  // Acceso por enlace personal (spec 010 §8.8): la solicitud requiere token emitido por el asesor.
  const tokenUrl = params.get('enlace');

  const [resultadoValidacion, setResultadoValidacion] = useState<ResultadoValidacion | null>(null);
  const [intento, setIntento] = useState(0);

  const [subiendoRecaudo, setSubiendoRecaudo] = useState<Record<string, boolean>>({});
  // Una sola lista: lo que se ve adjunto es exactamente lo que se envía.
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [errorRecaudo, setErrorRecaudo] = useState<Record<string, string>>({});
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // `origen` distingue una solicitud que el servidor confirmó de una registrada solo en pantalla.
  const [solicitudExitosa, setSolicitudExitosa] = useState<{
    numero: string;
    mensaje?: string;
    origen: 'servidor' | 'local';
    /** Se completaron los recaudos de una solicitud que ya existía (D-70), no se envió una nueva. */
    complemento?: boolean;
  } | null>(null);

  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(datosIniciales);

  // Con servidor, el servidor valida el enlace y de él salen el vehículo, la política y lo que ya sabe de la persona.
  // El estado cambia dentro de los callbacks de la promesa, nunca en el cuerpo del efecto.
  useEffect(() => {
    if (!apiConfigurada || !tokenUrl) return;
    let cancelado = false;
    validarEnlaceFinanciamiento(tokenUrl)
      .then((dto) => {
        if (cancelado) return;
        const contexto = contextoDesdeEnlace(dto);
        if (!contexto) {
          setResultadoValidacion({
            token: tokenUrl,
            intento,
            estado: { tipo: 'no_valido', mensaje: mensajeEnlaceNoValido(dto.valid ? 'incompleto' : dto.invalidReason) },
          });
          return;
        }
        setDatos((d) => ({ ...d, ...contexto.precargado }));
        setResultadoValidacion({ token: tokenUrl, intento, estado: { tipo: 'listo', contexto } });
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        // Sin respuesta del servidor no se sabe si el enlace sirve: se ofrece reintentar. Una respuesta de rechazo
        // (404: no existe; 400: mal formado) sí es una respuesta: el enlace no es válido.
        const sinRespuesta = !(e instanceof ErrorApi) || e.estado === 0 || e.estado >= 500;
        setResultadoValidacion({
          token: tokenUrl,
          intento,
          estado: sinRespuesta
            ? {
                tipo: 'sin_conexion',
                mensaje: 'No pudimos validar tu enlace. Revisa tu conexión e inténtalo de nuevo.',
              }
            : { tipo: 'no_valido', mensaje: mensajeEnlaceNoValido(null) },
        });
      });
    return () => {
      cancelado = true;
    };
  }, [tokenUrl, intento]);

  // Demostración: el vehículo sale del inventario del navegador y el enlace solo se comprueba en su forma.
  const contextoDemostracion = useMemo<ContextoSolicitud | null>(() => {
    if (apiConfigurada || !esTokenFinanciamientoValido(tokenUrl)) return null;
    const v = vehiculos.find((x) => x.id === params.get('vehiculo'));
    if (!v) return null;
    return {
      vehiculo: {
        codigo: v.id,
        titulo: `${v.marca} ${v.modelo} ${v.anio}`,
        version: v.version,
        precio: v.precio,
        fotoUrl: v.foto ?? null,
      },
      politica: PARAMETROS_APROBADOS,
      precargado: precargarSolicitante(null, v.precio, PARAMETROS_APROBADOS),
      complemento: null,
    };
  }, [tokenUrl, vehiculos, params]);

  // La inicial de la demostración arranca en el mínimo vigente, una sola vez.
  const [inicialDemoFijada, setInicialDemoFijada] = useState(false);
  if (contextoDemostracion && !inicialDemoFijada) {
    setInicialDemoFijada(true);
    setDatos((d) => ({ ...d, ...contextoDemostracion.precargado }));
  }

  const validacionVigente =
    resultadoValidacion !== null && resultadoValidacion.token === tokenUrl && resultadoValidacion.intento === intento
      ? resultadoValidacion.estado
      : null;
  const estadoEnlace: EstadoEnlace = !apiConfigurada
    ? contextoDemostracion
      ? { tipo: 'listo', contexto: contextoDemostracion }
      : { tipo: 'sin_enlace' }
    : tokenUrl === null
      ? { tipo: 'sin_enlace' }
      : (validacionVigente ?? { tipo: 'validando' });
  const contexto = estadoEnlace.tipo === 'listo' ? estadoEnlace.contexto : null;

  const [errores, setErrores] = useState<Errores>({});

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

  const municipiosDisponibles = MUNICIPIOS[datos.estado] ?? [];

  // ── Cálculos en vivo ──────────────────────────────────────────────
  // Sin enlace listo no hay precio ni política: la cuenta queda en cero y la pantalla ni se muestra.
  const politica = contexto?.politica ?? PARAMETROS_APROBADOS;
  const financiero = useMemo(
    () => calcularResumen(datos, contexto?.vehiculo.precio ?? 0, politica),
    [datos, contexto, politica],
  );
  const porcentajeCapacidad = Math.round(politica.ratioCuotaIngreso * 100);
  const porcentajeInicialMinimo = Math.round(politica.inicialMinima * 100);

  // ── Validación por paso ───────────────────────────────────────────
  const validarPaso = (n: number): Errores => {
    const e: Errores = {};
    const exigir = (campo: keyof Datos, etiqueta: string) => {
      const err = requerido(String(datos[campo] ?? ''), etiqueta);
      if (err) e[campo as string] = err;
    };

    if (n === 0) {
      if (financiero.inicial > financiero.precio) {
        e.inicialAportado = 'La inicial no puede superar el precio del vehículo';
      } else if (financiero.precio > 0 && financiero.inicial + 0.005 < financiero.inicialMinima) {
        e.inicialAportado = `La inicial mínima es el ${porcentajeInicialMinimo} % del precio: ${formatoEUR(financiero.inicialMinima)}`;
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

  const manejarSubidaArchivo = async (recaudoId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const listaArchivos = Array.from(files);
    const rechazos: string[] = [];

    setSubiendoRecaudo((s) => ({ ...s, [recaudoId]: true }));
    for (const f of listaArchivos) {
      // Sin servidor (maqueta) el archivo no sale del navegador: solo se lista su nombre.
      if (!apiConfigurada || !tokenUrl) {
        setAdjuntos((prev) => [...prev, { id: crypto.randomUUID(), recaudoId, nombre: f.name, cargado: null }]);
        continue;
      }
      if (f.size > TAMANO_MAXIMO_RECAUDO) {
        rechazos.push(`${f.name}: supera el máximo de 10 MB.`);
        continue;
      }
      try {
        const cargado = await subirRecaudoDigital(f, recaudoId, tokenUrl);
        setAdjuntos((prev) => [
          ...prev,
          { id: crypto.randomUUID(), recaudoId, nombre: cargado.fileName, cargado },
        ]);
      } catch (err: unknown) {
        // Con servidor, un archivo rechazado no se da por adjunto: el cliente ve por qué.
        const detalle =
          err instanceof ErrorApi && err.estado !== 0 && err.detalle
            ? err.detalle
            : 'No se pudo subir el archivo. Revisa tu conexión e inténtalo de nuevo.';
        rechazos.push(`${f.name}: ${detalle}`);
      }
    }
    setErrorRecaudo((e) => {
      const resto = { ...e };
      if (rechazos.length > 0) resto[recaudoId] = rechazos.join(' ');
      else delete resto[recaudoId];
      return resto;
    });
    setSubiendoRecaudo((s) => ({ ...s, [recaudoId]: false }));
  };

  const enviarSolicitud = async () => {
    const e = validarPaso(7);
    setErrores(e);
    if (Object.keys(e).length > 0 || !contexto) return;

    setEnviandoSolicitud(true);
    setErrorEnvio(null);

    try {
      if (apiConfigurada && tokenUrl) {
        const res = await enviarSolicitudCredito(
          construirEnvio({
            token: tokenUrl,
            datos,
            precio: contexto.vehiculo.precio,
            politica,
            // Solo lo que el servidor guardó en el contenedor privado.
            recaudos: adjuntos.flatMap((a) => (a.cargado ? [a.cargado] : [])),
            versionTexto: VERSION_TEXTO_DECLARACIONES,
          }),
        );
        setNumeroSolicitud(res.numeroSolicitud);
        setSolicitudExitosa({ numero: res.numeroSolicitud, mensaje: res.mensaje, origen: 'servidor' });
      } else {
        // Demostración: no hay servidor al que enviar. La pantalla de cierre lo rotula como simulado.
        const numLocal = generarNumeroSolicitud();
        setNumeroSolicitud(numLocal);
        setSolicitudExitosa({ numero: numLocal, origen: 'local' });
      }
    } catch (err: unknown) {
      // Con servidor, un envío que falla no se da por hecho: la persona ve por qué y reintenta con lo que ya escribió.
      setErrorEnvio(mensajeDeError(err, 'No se pudo contactar al servidor. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setEnviandoSolicitud(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const recaudosCargados = RECAUDOS.filter((r) => adjuntos.some((a) => a.recaudoId === r.id)).length;

  /**
   * El cliente completa los recaudos de su solicitud condicionada (D-70): el servidor la reabre con el mismo número y
   * un recaudo del mismo tipo reemplaza al anterior. Solo viaja lo que el servidor guardó en el contenedor privado.
   */
  const enviarComplemento = async () => {
    if (!tokenUrl) return;
    const recaudos = adjuntos.flatMap((a) => (a.cargado ? [a.cargado] : []));
    if (recaudos.length === 0) {
      setErrorEnvio('Adjunta al menos un documento para completar tu solicitud.');
      return;
    }
    setEnviandoSolicitud(true);
    setErrorEnvio(null);
    try {
      const res = await completarRecaudos(tokenUrl, recaudos);
      setNumeroSolicitud(res.numeroSolicitud);
      setSolicitudExitosa({ numero: res.numeroSolicitud, mensaje: res.mensaje, origen: 'servidor', complemento: true });
    } catch (err: unknown) {
      setErrorEnvio(mensajeDeError(err, 'No se pudo contactar al servidor. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      setEnviandoSolicitud(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /** Las tarjetas de los recaudos: las mismas en el paso 6 y en la pantalla de recaudos pendientes. */
  const tarjetasDeRecaudos = () => (
    <div style={{ display: 'grid', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
      {RECAUDOS.map((r) => {
        const cargados = adjuntos.filter((a) => a.recaudoId === r.id);
        // Solo en un enlace de recaudos: lo que la solicitud ya tiene. Cargarlo de nuevo lo reemplaza.
        const yaEnviado = contexto?.complemento?.tiposCargados.includes(r.id) ?? false;
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
                <p style={{ fontSize: '12px', color: 'var(--texto-mudo)', marginTop: '2px' }}>{r.detalle}</p>
              </div>
              <span className={`badge ${cargados.length || yaEnviado ? 'badge-exito' : 'badge-aviso'}`}>
                {cargados.length ? 'Recibido' : yaEnviado ? 'Ya enviado' : 'Pendiente'}
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
                opacity: subiendoRecaudo[r.id] ? 0.6 : 1,
              }}
            >
              {subiendoRecaudo[r.id] ? 'Subiendo…' : yaEnviado ? 'Reemplazar archivo' : 'Adjuntar archivo'}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                disabled={subiendoRecaudo[r.id]}
                style={{ display: 'none' }}
                onChange={(e) => {
                  manejarSubidaArchivo(r.id, e.target.files);
                }}
              />
            </label>

            {errorRecaudo[r.id] && (
              <p role="alert" style={{ fontSize: '12px', color: 'var(--peligro-texto)', marginTop: 'var(--space-sm)' }}>
                {errorRecaudo[r.id]}
              </p>
            )}

            {cargados.length > 0 && (
              <ul style={{ listStyle: 'none', marginTop: 'var(--space-md)', display: 'grid', gap: '4px' }}>
                {cargados.map((a) => (
                  <li
                    key={a.id}
                    style={{ fontSize: '12px', color: 'var(--texto-secundario)', display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)' }}
                  >
                    <span>📎 {a.nombre}</span>
                    {/* Quitar lo saca de la solicitud: lo que no está en la lista no se envía. */}
                    <button
                      type="button"
                      onClick={() => setAdjuntos((prev) => prev.filter((x) => x.id !== a.id))}
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
  );

  // ── Validación de enlace en progreso ──────────────────────────────
  if (estadoEnlace.tipo === 'validando') {
    return (
      <div style={{ maxWidth: '640px', margin: '60px auto', textAlign: 'center' }}>
        <p role="status" style={{ fontSize: '16px', color: 'var(--texto-secundario)' }}>
          Validando enlace de financiamiento…
        </p>
      </div>
    );
  }

  // ── Acceso por enlace personal ────────────────────────────────────
  // La solicitud no está abierta al público (spec 010 §8.8): se llega con el enlace que emite el asesor al vender con
  // financiamiento. Sin un enlace que el servidor valide, no hay formulario.
  if (!contexto) {
    const sinConexion = estadoEnlace.tipo === 'sin_conexion';
    const noValido = estadoEnlace.tipo === 'no_valido';
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
            {sinConexion ? '📡' : '🔒'}
          </div>
          <h1 style={{ fontSize: '22px', marginBottom: 'var(--space-sm)' }}>
            {sinConexion
              ? 'No pudimos validar tu enlace'
              : noValido
                ? 'Enlace no disponible'
                : 'La solicitud de financiamiento se habilita después de tu visita'}
          </h1>
          <p
            role={sinConexion || noValido ? 'alert' : undefined}
            style={{
              fontSize: '14px',
              color: 'var(--texto-secundario)',
              lineHeight: 1.5,
              margin: '0 auto var(--space-xl)',
              maxWidth: '46ch',
            }}
          >
            {sinConexion || noValido
              ? estadoEnlace.mensaje
              : 'Primero conoces el vehículo en la sede. Si decides comprarlo financiado, tu asesor te envía un enlace personal para completar esta solicitud desde tu teléfono.'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {sinConexion && (
              <Boton variant="primary" onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </Boton>
            )}
            <Boton variant={sinConexion ? 'secondary' : 'primary'} onClick={() => navigate('/catalogo')}>
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

          <h1 style={{ fontSize: '22px', marginBottom: 'var(--space-sm)' }}>
            {solicitudExitosa?.complemento ? 'Documentos recibidos' : 'Solicitud recibida'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', marginBottom: 'var(--space-lg)' }}>
            {solicitudExitosa?.mensaje || 'Guarda este número: con él puedes consultar el estado de tu solicitud.'}
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

          {!solicitudExitosa?.complemento && recaudosCargados < RECAUDOS.length && (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <span className="badge badge-aviso">Recaudos incompletos</span>
              <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginTop: 'var(--space-sm)' }}>
                Faltan {RECAUDOS.length - recaudosCargados} de {RECAUDOS.length} documentos. Tu asesor se
                comunicará contigo para completarlos.
              </p>
            </div>
          )}

          {!solicitudExitosa?.complemento && (datos.esPEP || datos.vinculoPEP) && (
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

        {solicitudExitosa?.origen !== 'servidor' && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <NotaSimulada variante="bloque">
              Demostración: la solicitud no se envió a ningún servidor y el número es aleatorio.
            </NotaSimulada>
          </div>
        )}
      </div>
    );
  }

  // ── Recaudos pendientes (D-70, E3) ────────────────────────────────
  // El analista condicionó la solicitud y mandó este enlace: no se vuelve a llenar el formulario, solo se completan los
  // documentos de la misma solicitud.
  if (contexto.complemento) {
    const porEnviar = adjuntos.filter((a) => a.cargado).length;
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <header style={{ marginBottom: 'var(--space-lg)' }}>
          <h1 style={{ fontSize: '24px' }}>Completa los documentos de tu solicitud</h1>
          <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
            Solicitud <strong>{contexto.complemento.numero}</strong>. Tu analista de crédito necesita documentos
            adicionales para continuar. Adjunta los que te indicó; si vuelves a cargar uno que ya enviaste, reemplaza
            al anterior.
          </p>
        </header>

        <div
          style={{
            backgroundColor: 'var(--blanco)',
            border: '1px solid var(--borde-claro)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xl)',
          }}
        >
          {resumenDelVehiculo(contexto)}
          {tarjetasDeRecaudos()}

          {errorEnvio && (
            <p role="alert" style={{ fontSize: '13px', color: 'var(--peligro-texto)', marginBottom: 'var(--space-md)' }}>
              {errorEnvio}
            </p>
          )}

          <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--texto-mudo)', margin: '0 0 var(--space-lg)' }}>
            Solo PDF, JPG o PNG, de hasta 10 MB cada uno. Se guardan en un contenedor privado: solo el área de crédito
            los abre, con un enlace que vence en minutos. Al enviarlos, este enlace deja de admitir archivos.
          </p>

          <Boton variant="primary" fullWidth onClick={() => void enviarComplemento()} disabled={enviandoSolicitud}>
            {enviandoSolicitud
              ? 'Enviando documentos…'
              : porEnviar > 0
                ? `Enviar ${porEnviar} documento${porEnviar === 1 ? '' : 's'}`
                : 'Enviar documentos'}
          </Boton>
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
            {/* El vehículo es el del enlace: no se elige otro ni se cambia su precio. */}
            {resumenDelVehiculo(contexto)}

            <Rejilla>
              <Campo
                label="Inicial aportado (EUR)"
                type="number"
                value={datos.inicialAportado}
                onChange={(e) => set('inicialAportado', e.target.value)}
                error={errores.inicialAportado}
              />
              {/* D-55: el plazo es uno solo (el de la política vigente) y las cuotas son mensuales. */}
              <Campo label="Plazo (fijo)" value={`${politica.plazoMeses} meses`} readOnly />
              <Campo label="Frecuencia de pago" value="Mensual" readOnly />
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
                {formatoEUR(financiero.cuota)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                A financiar {formatoEUR(financiero.aFinanciar)}
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
                <Campo label="Sueldo o ingreso mensual (EUR) *" type="number" value={datos.sueldoMensual} onChange={(e) => set('sueldoMensual', e.target.value)} error={errores.sueldoMensual} />
                <Campo label="Otros ingresos comprobables (EUR)" type="number" value={datos.otrosIngresos} onChange={(e) => set('otrosIngresos', e.target.value)} />
              </Rejilla>
              {aNumero(datos.otrosIngresos) > 0 && (
                <Campo label="Concepto de otros ingresos *" value={datos.conceptoOtrosIngresos} onChange={(e) => set('conceptoOtrosIngresos', e.target.value)} error={errores.conceptoOtrosIngresos} />
              )}
            </Bloque>

            <Bloque titulo="Egresos mensuales">
              <Rejilla>
                <Campo label="Alquiler o hipoteca (EUR)" type="number" value={datos.alquilerHipoteca} onChange={(e) => set('alquilerHipoteca', e.target.value)} />
                <Campo label="Alimentación y servicios (EUR) *" type="number" value={datos.alimentacionServicios} onChange={(e) => set('alimentacionServicios', e.target.value)} error={errores.alimentacionServicios} />
                <Campo label="Pagos de deudas y créditos (EUR)" type="number" value={datos.pagosDeudas} onChange={(e) => set('pagosDeudas', e.target.value)} />
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
                etiqueta={`Capacidad de pago (${porcentajeCapacidad} % del ingreso)`}
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
                La cuota estimada de {formatoEUR(financiero.cuota)} supera tu capacidad de pago: el{' '}
                {porcentajeCapacidad} % de tu ingreso mensual. Puedes continuar: un analista revisará tu caso
                y podrá proponerte una inicial mayor.
              </div>
            )}

            <NotaSimulada>
              Los totales se calculan solos y no se pueden editar. En el formato en papel eran
              casillas a rellenar a mano, de donde venían las inconsistencias. La capacidad de pago
              es el {porcentajeCapacidad} % del ingreso mensual: los egresos se registran para el
              analista, pero no la reducen.
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
            {tarjetasDeRecaudos()}

            <div
              style={{
                fontSize: '13px',
                color: 'var(--texto-secundario)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <strong>{recaudosCargados} de {RECAUDOS.length}</strong> recaudos adjuntos.
              {recaudosCargados < RECAUDOS.length && ' Puedes enviar la solicitud sin todos.'}
              {apiConfigurada && ' Al enviarla, este enlace deja de admitir archivos.'}
            </div>

            {apiConfigurada ? (
              <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--texto-mudo)', margin: 0 }}>
                Solo PDF, JPG o PNG, de hasta 10 MB cada uno. Se guardan en un contenedor privado:
                solo el área de crédito los abre, con un enlace que vence en minutos.
              </p>
            ) : (
              <NotaSimulada>
                Los archivos no se suben a ningún servidor: solo se listan sus nombres.
              </NotaSimulada>
            )}
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

            <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--texto-mudo)', margin: 0 }}>
              Al enviar la solicitud quedan registrados la fecha y la hora, la dirección desde la que la envías y la
              versión de estas declaraciones que aceptaste.
            </p>
          </>
        )}

        {errorEnvio && (
          <div
            style={{
              marginTop: 'var(--space-md)',
              padding: 'var(--space-md)',
              backgroundColor: 'var(--peligro-fondo, #FEE2E2)',
              color: 'var(--peligro-texto, #991B1B)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
            }}
          >
            {errorEnvio}
          </div>
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
            <Boton variant="secondary" onClick={retroceder} disabled={enviandoSolicitud} style={{ flex: 1 }}>
              Atrás
            </Boton>
          )}
          {paso < PASOS.length - 1 ? (
            <Boton variant="primary" onClick={avanzar} style={{ flex: 2 }}>
              Continuar
            </Boton>
          ) : (
            <Boton
              variant="primary"
              onClick={enviarSolicitud}
              disabled={enviandoSolicitud}
              style={{ flex: 2 }}
            >
              {enviandoSolicitud ? 'Enviando solicitud…' : 'Enviar solicitud'}
            </Boton>
          )}
        </div>
      </div>

      {!apiConfigurada && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <NotaSimulada variante="bloque">
            Demostración del módulo de solicitud de crédito: la solicitud no llega a ningún servidor. Los datos viven
            en memoria y se pierden al recargar.
          </NotaSimulada>
        </div>
      )}

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
