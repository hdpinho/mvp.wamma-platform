import React, { useEffect, useMemo, useState } from 'react';
import { Boton } from '../../components/Boton';
import { Campo } from '../../components/Campo';
import {
  abrirAviso,
  avisoDictamen,
  avisoRecaudosPendientes,
  enlaceCorreo,
  enlaceWhatsApp,
  type MensajeAlCliente,
} from '../../components/crm/avisos';
import { fechaHora } from '../../components/crm/formato';
import { ErrorApi, mensajeDeError } from '../../api/cliente';
import {
  actualizarEstadoRecaudo,
  emitirEnlaceRecaudos,
  evaluarSolicitudCredito,
  listarSolicitudesCredito,
  obtenerDetalleSolicitudCredito,
  obtenerEnlaceRecaudo,
  reabrirSolicitudCredito,
  type DetalleSolicitudApi,
  type EstadoRecaudo,
  type ResultadoDictamen,
  type ResumenSolicitudApi,
} from '../../api/credito';
import {
  NO_INFORMADO,
  documentoDe,
  monto,
  nombreCompleto,
  resumenFinanciero,
  texto,
  tituloDeRecaudo,
} from '../../api/creditoAdaptadores';
import { BANCOS } from '../../mocks/solicitudCredito';
import { formatoEUR } from '../../services/financiamientoMotor';
import { useParametros } from '../../state/parametrosContexto';
import { useSesion } from '../../state/sesionContexto';
import { rutaSolicitudFinanciamiento } from '../../types/crm';

/**
 * O7 · Análisis y dictamen de crédito (WMA-F-FIN-001).
 *
 * El analista revisa el expediente que la persona envió con su enlace, verifica los recaudos y dictamina a mano
 * (D-17, D-63): aprobar, condicionar o rechazar, siempre con su justificación, que queda con su usuario en la bitácora.
 * Tras dictaminar se abren solos WhatsApp y el correo del solicitante con el aviso aprobado (D-69, D-72, D-75); al
 * condicionar, el mensaje lleva el enlace para completar los documentos (D-70). Un expediente aprobado o rechazado se
 * puede reabrir con justificación (D-71).
 * El scoring, el «AML» y el «Score Buró» están fuera de alcance hasta tener convenios (D-01, D-63); el código del motor
 * se conserva en el servidor y en `api/riesgo.ts`, pero esta pantalla no lo usa.
 *
 * Todo sale del servidor. Si no se puede leer, la pantalla lo dice y permite reintentar: no hay datos de relleno.
 */

const eur2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Insignia {
  texto: string;
  fondo: string;
  color: string;
  borde?: string;
}

/** Estados que el servidor maneja para una solicitud (`solicitud_credito.estado`). */
const ESTADOS: Record<string, Insignia> = {
  enviada: { texto: 'Nueva', fondo: 'var(--naranja-50, #FFF7ED)', color: 'var(--naranja-700, #C2410C)', borde: '1px solid var(--naranja-200, #FED7AA)' },
  en_evaluacion: { texto: 'En evaluación', fondo: 'var(--naranja-50, #FFF7ED)', color: 'var(--naranja-700, #C2410C)', borde: '1px solid var(--naranja-200, #FED7AA)' },
  aprobada: { texto: 'Aprobada', fondo: 'var(--exito-fondo, #DCFCE7)', color: 'var(--exito-texto, #166534)' },
  condicionada: { texto: 'Condicionada', fondo: '#FEF3C7', color: '#92400E', borde: '1px solid #FDE68A' },
  rechazada: { texto: 'Rechazada', fondo: 'var(--peligro-fondo, #FEE2E2)', color: 'var(--peligro-texto, #991B1B)' },
  desembolsada: { texto: 'Desembolsada', fondo: 'var(--exito-fondo, #DCFCE7)', color: 'var(--exito-texto, #166534)' },
};

const FILTROS: { valor: string; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todas' },
  { valor: 'enviada', etiqueta: 'Nuevas' },
  { valor: 'aprobada', etiqueta: 'Aprobadas' },
  { valor: 'condicionada', etiqueta: 'Condicionadas' },
  { valor: 'rechazada', etiqueta: 'Rechazadas' },
];

/** Una solicitud con dictamen final no se vuelve a dictaminar desde aquí. */
const ESTADOS_FINALES = ['aprobada', 'rechazada', 'desembolsada'];

const RESULTADOS: { valor: ResultadoDictamen; etiqueta: string }[] = [
  { valor: 'aprobado', etiqueta: 'Aprobar crédito' },
  { valor: 'condicionado', etiqueta: 'Condicionar (pedir información o documentos)' },
  { valor: 'rechazado', etiqueta: 'Rechazar solicitud' },
];

const ETIQUETA_RESULTADO: Record<string, string> = {
  aprobado: 'Aprobado',
  condicionado: 'Condicionado',
  rechazado: 'Rechazado',
};

const ESTADOS_RECAUDO: Record<string, Insignia> = {
  pendiente: { texto: 'Por revisar', fondo: '#FEF3C7', color: '#92400E' },
  conforme: { texto: 'Conforme', fondo: 'var(--exito-fondo)', color: 'var(--exito-texto)' },
  ilegible: { texto: 'Ilegible', fondo: '#FEF3C7', color: '#92400E' },
  rechazado: { texto: 'Rechazado', fondo: 'var(--peligro-fondo)', color: 'var(--peligro-texto)' },
};

const insigniaDe = (estado: string): Insignia =>
  ESTADOS[estado] ?? { texto: estado, fondo: 'var(--superficie)', color: 'var(--texto-secundario)' };

const Dato: React.FC<{ etiqueta: string; valor?: React.ReactNode }> = ({ etiqueta, valor }) => {
  const vacio = valor === undefined || valor === null || valor === '' || valor === false;
  return (
    <p className="cred-dato">
      <strong>{etiqueta}:</strong> {vacio ? <em className="cred-mudo">{NO_INFORMADO}</em> : valor}
    </p>
  );
};

const Bloque: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="cred-bloque">
    <h4>{titulo}</h4>
    {children}
  </section>
);

export const O7_AnalisisCredito: React.FC = () => {
  const { puede } = useSesion();
  const { parametros } = useParametros();
  // El dictamen es del analista; el auditor (credito.ver) solo consulta.
  const puedeEvaluar = puede('credito.revisar');

  const [solicitudes, setSolicitudes] = useState<ResumenSolicitudApi[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Expediente seleccionado
  const [solicitudId, setSolicitudId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleSolicitudApi | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Apertura y verificación de recaudos (D-59)
  const [abriendoRecaudoId, setAbriendoRecaudoId] = useState<string | null>(null);
  const [actualizandoRecaudoId, setActualizandoRecaudoId] = useState<string | null>(null);
  const [avisoRecaudo, setAvisoRecaudo] = useState<{ docId: string; url: string | null; texto: string } | null>(null);

  // Formulario de dictamen
  const [resultado, setResultado] = useState<ResultadoDictamen>('aprobado');
  const [justificacion, setJustificacion] = useState('');
  const [limiteAprobado, setLimiteAprobado] = useState('');
  const [cuotaMaxima, setCuotaMaxima] = useState('');
  const [guardandoDictamen, setGuardandoDictamen] = useState(false);
  const [mensajeDictamen, setMensajeDictamen] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Aviso al solicitante tras el dictamen (D-69, D-75): se abren solos WhatsApp y el correo, con el mensaje ya redactado.
  // Si el navegador bloquea la ventana, el aviso ofrece los mismos botones. `enlace` solo existe al pedir recaudos.
  const [avisoCliente, setAvisoCliente] = useState<{
    mensaje: MensajeAlCliente;
    enlace: string | null;
    whatsappAbierto: boolean;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Reapertura de un expediente con dictamen final (D-71)
  const [justificacionReapertura, setJustificacionReapertura] = useState('');
  const [reabriendo, setReabriendo] = useState(false);
  const [emitiendoEnlace, setEmitiendoEnlace] = useState(false);

  // Cada cambio de filtro, o `recargarLista()`, vuelve a pedir la bandeja al servidor.
  const [recargaLista, setRecargaLista] = useState(0);
  const recargarLista = () => {
    setCargando(true);
    setRecargaLista((n) => n + 1);
  };
  const cambiarFiltro = (estado: string) => {
    if (estado === filtroEstado) return;
    setCargando(true);
    setFiltroEstado(estado);
  };

  useEffect(() => {
    let vigente = true;
    listarSolicitudesCredito(filtroEstado === 'todos' ? undefined : filtroEstado)
      .then((data) => {
        if (!vigente) return;
        setSolicitudes(data);
        setErrorLista(null);
      })
      .catch((e: unknown) => {
        // Sin datos de respaldo: una bandeja vacía por un fallo no debe pasar por «no hay solicitudes».
        if (vigente) setErrorLista(mensajeDeError(e, 'No se pudo leer la bandeja de crédito.'));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [filtroEstado, recargaLista]);

  /** Lee el expediente. `conservarMensaje` mantiene el aviso del dictamen recién guardado. */
  const cargarDetalle = async (id: string, conservarMensaje = false) => {
    setSolicitudId(id);
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setAvisoRecaudo(null);
    if (!conservarMensaje) {
      setMensajeDictamen(null);
      setAvisoCliente(null);
      setJustificacionReapertura('');
    }
    try {
      const data = await obtenerDetalleSolicitudCredito(id);
      setDetalle(data);
      // El dictamen propone lo que la persona pidió; el analista lo ajusta.
      setLimiteAprobado(String(monto(data.decisionRiesgo?.approvedLimit ?? data.montoSolicitado)));
      setCuotaMaxima(String(monto(data.decisionRiesgo?.maxAllowedPayment ?? data.cuotaEstimada)));
      if (!conservarMensaje) {
        setResultado('aprobado');
        setJustificacion('');
      }
    } catch (e: unknown) {
      setDetalle(null);
      setErrorDetalle(mensajeDeError(e, 'No se pudo leer el expediente.'));
    } finally {
      setCargandoDetalle(false);
    }
  };

  const cerrarExpediente = () => {
    setSolicitudId(null);
    setDetalle(null);
    setErrorDetalle(null);
  };

  /**
   * Abre un recaudo del contenedor privado (D-59) con un enlace firmado que vence en minutos.
   * La pestaña se abre en el mismo clic, para que el navegador no la bloquee, y recibe la
   * dirección cuando llega; si aun así se bloquea, se ofrece el enlace para abrirlo a mano.
   */
  const abrirRecaudo = async (docId: string) => {
    if (!solicitudId) return;
    const pestana = window.open('', '_blank');
    setAbriendoRecaudoId(docId);
    setAvisoRecaudo(null);
    try {
      const url = await obtenerEnlaceRecaudo(solicitudId, docId);
      if (pestana) {
        pestana.opener = null;
        pestana.location.href = url;
      } else {
        setAvisoRecaudo({ docId, url, texto: 'El navegador bloqueó la pestaña nueva.' });
      }
    } catch (err: unknown) {
      pestana?.close();
      const detalleError = err instanceof ErrorApi && err.detalle ? err.detalle : 'No se pudo abrir el recaudo.';
      setAvisoRecaudo({ docId, url: null, texto: detalleError });
    } finally {
      setAbriendoRecaudoId(null);
    }
  };

  /** El estado del recaudo solo cambia en pantalla cuando el servidor lo confirmó. */
  const cambiarEstadoRecaudo = async (docId: string, estado: EstadoRecaudo) => {
    if (!solicitudId) return;
    setActualizandoRecaudoId(docId);
    setAvisoRecaudo(null);
    try {
      await actualizarEstadoRecaudo(solicitudId, docId, estado);
      setDetalle((previo) =>
        previo
          ? {
              ...previo,
              recaudos: (previo.recaudos ?? []).map((r) => (r.id === docId ? { ...r, validationStatus: estado } : r)),
            }
          : previo,
      );
    } catch (err: unknown) {
      setAvisoRecaudo({ docId, url: null, texto: mensajeDeError(err, 'No se pudo actualizar el recaudo.') });
    } finally {
      setActualizandoRecaudoId(null);
    }
  };

  const guardarDictamen = async () => {
    if (!solicitudId || !detalle) return;
    const motivo = justificacion.trim();
    if (motivo.length < 10) {
      setMensajeDictamen({ tipo: 'error', texto: 'Escribe la justificación del dictamen (al menos 10 caracteres).' });
      return;
    }
    const aprobando = resultado === 'aprobado';
    const limite = Number(limiteAprobado);
    const cuota = Number(cuotaMaxima);
    if (aprobando && (!(limite > 0) || !(cuota > 0))) {
      setMensajeDictamen({ tipo: 'error', texto: 'Indica el límite aprobado y la cuota máxima permitida, mayores que cero.' });
      return;
    }

    setGuardandoDictamen(true);
    setMensajeDictamen(null);
    try {
      await evaluarSolicitudCredito(solicitudId, {
        resultado,
        justificacion: motivo,
        limiteAprobado: aprobando ? limite : undefined,
        cuotaMaximaPermitida: aprobando ? cuota : undefined,
      });
      setMensajeDictamen({
        tipo: 'exito',
        texto: `Dictamen registrado: solicitud ${ETIQUETA_RESULTADO[resultado].toLowerCase()}.`,
      });
      setAvisoCliente(null);
      // El aviso se abre en el mismo flujo del clic, antes de recargar: es lo que el navegador deja pasar.
      await avisarDictamen(detalle, resultado);
      recargarLista();
      await cargarDetalle(solicitudId, true);
    } catch (err: unknown) {
      // Nada se da por guardado si el servidor no lo confirmó.
      setMensajeDictamen({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo registrar el dictamen.') });
    } finally {
      setGuardandoDictamen(false);
    }
  };

  /** Datos del solicitante para el aviso: lo que él mismo escribió en su expediente. */
  const contactoDe = (d: DetalleSolicitudApi) => ({
    nombre: texto(d.datosPersonales?.primerNombre) || 'cliente',
    telefono: texto(d.datosContacto?.telefonoCelular),
    correo: texto(d.datosContacto?.correo),
    vehiculo: d.vehiculo ? `${d.vehiculo.brand} ${d.vehiculo.model} ${d.vehiculo.year}` : 'vehículo',
  });

  const avisarAlCliente = (mensaje: MensajeAlCliente, enlace: string | null) => {
    const abierto = abrirAviso(mensaje);
    setCopiado(false);
    setAvisoCliente({ mensaje, enlace, whatsappAbierto: abierto.whatsapp });
  };

  /**
   * Emite el enlace para que el cliente complete sus recaudos (D-70) y lo manda por WhatsApp y correo. El servidor solo
   * guarda su huella: el texto completo existe aquí y ahora.
   */
  const avisarRecaudosPendientes = async (d: DetalleSolicitudApi) => {
    const { nombre, telefono, correo, vehiculo } = contactoDe(d);
    const emitido = await emitirEnlaceRecaudos(d.id);
    const url = `${window.location.origin}${rutaSolicitudFinanciamiento(d.vehiculoId ?? '', emitido.token)}`;
    avisarAlCliente(avisoRecaudosPendientes(nombre, d.numeroSolicitud, vehiculo, url, telefono, correo), url);
  };

  /** Tras el dictamen, el aviso aprobado (D-72). Condicionar además pide los recaudos con su enlace. */
  const avisarDictamen = async (d: DetalleSolicitudApi, dictamen: ResultadoDictamen) => {
    try {
      if (dictamen === 'condicionado') {
        await avisarRecaudosPendientes(d);
        return;
      }
      const { nombre, telefono, correo, vehiculo } = contactoDe(d);
      const estado = dictamen === 'aprobado' ? 'aprobada' : 'rechazada';
      const mensaje = avisoDictamen(estado, nombre, d.numeroSolicitud, vehiculo, telefono, correo);
      if (mensaje) avisarAlCliente(mensaje, null);
    } catch (err: unknown) {
      // El dictamen ya está guardado: solo falló el aviso, y eso se dice.
      setMensajeDictamen({
        tipo: 'error',
        texto: `El dictamen quedó registrado, pero no se pudo preparar el aviso al cliente: ${mensajeDeError(err, 'error desconocido')}`,
      });
    }
  };

  /** Vuelve a mandar el enlace de recaudos de una solicitud condicionada. El enlace anterior deja de servir. */
  const reenviarEnlaceRecaudos = async () => {
    if (!detalle) return;
    setEmitiendoEnlace(true);
    try {
      await avisarRecaudosPendientes(detalle);
    } catch (err: unknown) {
      setMensajeDictamen({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo emitir el enlace de recaudos.') });
    } finally {
      setEmitiendoEnlace(false);
    }
  };

  /** Reabre un expediente aprobado o rechazado para dictaminarlo de nuevo (D-71). Queda en la bitácora. */
  const reabrirExpediente = async () => {
    if (!solicitudId) return;
    const motivo = justificacionReapertura.trim();
    if (motivo.length < 10) {
      setMensajeDictamen({ tipo: 'error', texto: 'Escribe por qué se reabre el expediente (al menos 10 caracteres).' });
      return;
    }
    setReabriendo(true);
    setMensajeDictamen(null);
    try {
      await reabrirSolicitudCredito(solicitudId, motivo);
      setJustificacionReapertura('');
      setAvisoCliente(null);
      setMensajeDictamen({
        tipo: 'exito',
        texto: 'Expediente reabierto: vuelve a estar en evaluación y ya puedes dictaminarlo de nuevo.',
      });
      recargarLista();
      await cargarDetalle(solicitudId, true);
    } catch (err: unknown) {
      setMensajeDictamen({ tipo: 'error', texto: mensajeDeError(err, 'No se pudo reabrir el expediente.') });
    } finally {
      setReabriendo(false);
    }
  };

  const copiarEnlaceRecaudos = async (enlace: string) => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
    } catch {
      setMensajeDictamen({ tipo: 'error', texto: 'No se pudo copiar: selecciona el enlace y cópialo a mano.' });
    }
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return solicitudes;
    return solicitudes.filter((s) =>
      [s.numeroSolicitud, s.solicitanteNombre, s.solicitanteDocumento, s.vehiculoDescripcion, s.vehiculoCodigo]
        .map((valor) => (valor ?? '').toLowerCase())
        .some((valor) => valor.includes(q)),
    );
  }, [solicitudes, busqueda]);

  const metricas = useMemo(() => {
    const porDictaminar = solicitudes.filter((s) => s.estado === 'enviada' || s.estado === 'en_evaluacion').length;
    const aprobadas = solicitudes.filter((s) => s.estado === 'aprobada' || s.estado === 'desembolsada');
    return {
      total: solicitudes.length,
      porDictaminar,
      aprobadas: aprobadas.length,
      montoAprobado: aprobadas.reduce((acc, s) => acc + monto(s.montoSolicitado), 0),
    };
  }, [solicitudes]);

  const resumen = detalle ? resumenFinanciero(detalle, parametros?.inicialMinima) : null;
  const recaudos = detalle?.recaudos ?? [];
  const recaudosSinConforme = recaudos.filter((r) => r.validationStatus !== 'conforme').length;
  const esFinal = detalle ? ESTADOS_FINALES.includes(detalle.estado) : false;
  // Un crédito desembolsado ya tiene consecuencias de dinero: no se reabre (D-71).
  const puedeReabrir = detalle ? detalle.estado === 'aprobada' || detalle.estado === 'rechazada' : false;
  const dictamenVigente = detalle?.decisionRiesgo ?? null;

  const personales = detalle?.datosPersonales ?? {};
  const contacto = detalle?.datosContacto ?? {};
  const laboral = detalle?.datosLaborales ?? {};
  const financieros = detalle?.datosFinancieros ?? {};
  const bancarios = detalle?.datosBancarios ?? {};
  const declaraciones = detalle?.declaraciones ?? {};
  const evidencia = detalle?.evidenciaAceptacion ?? {};
  const banco = BANCOS.find((b) => b.codigo === texto(bancarios.banco));

  return (
    <div className="cred-pagina">
      {/* Encabezado */}
      <div className="cred-encabezado">
        <div>
          <h1>Análisis y Aprobación de Crédito</h1>
          <p>Expedientes digitales WMA-F-FIN-001. Revisión de documentos y dictamen del analista.</p>
        </div>
      </div>

      {errorLista && (
        <div className="cred-aviso cred-aviso-error" role="alert">
          <span>No se pudo leer la bandeja del servidor: {errorLista}</span>
          <button type="button" onClick={recargarLista}>
            Reintentar
          </button>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="cred-metricas">
        <div className="cred-metrica">
          <span>Total solicitudes</span>
          <strong>{metricas.total}</strong>
        </div>
        <div className="cred-metrica cred-metrica-naranja">
          <span>Por dictaminar</span>
          <strong>{metricas.porDictaminar}</strong>
        </div>
        <div className="cred-metrica cred-metrica-verde">
          <span>Aprobadas</span>
          <strong>{metricas.aprobadas}</strong>
        </div>
        <div className="cred-metrica">
          <span>Monto aprobado</span>
          <strong>{formatoEUR(metricas.montoAprobado)}</strong>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="cred-filtros">
        <div className="cred-chips">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`cred-chip ${filtroEstado === f.valor ? 'activo' : ''}`}
              onClick={() => cambiarFiltro(f.valor)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Buscar por Nº, nombre, cédula o vehículo…"
          aria-label="Buscar solicitudes"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="cred-buscar"
        />
      </div>

      {/* Bandeja */}
      <div className="cred-tabla-caja">
        {cargando ? (
          <div className="cred-vacio">Cargando solicitudes de crédito…</div>
        ) : errorLista && solicitudes.length === 0 ? (
          <div className="cred-vacio">No se pudo leer la bandeja. Usa «Reintentar».</div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div className="cred-vacio">
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <strong>No se encontraron solicitudes</strong>
            <p>No hay solicitudes de crédito con los filtros seleccionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cred-tabla">
              <thead>
                <tr>
                  <th>Nº Solicitud</th>
                  <th>Solicitante</th>
                  <th>Vehículo</th>
                  <th>Financiamiento</th>
                  <th>Cuota est.</th>
                  <th>Recaudos</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((s) => {
                  const insignia = insigniaDe(s.estado);
                  return (
                    <tr key={s.id}>
                      <td className="cred-numero">{s.numeroSolicitud}</td>
                      <td>
                        <strong>{s.solicitanteNombre || NO_INFORMADO}</strong>
                        <span className="cred-sub">
                          {s.solicitanteDocumento || NO_INFORMADO} • {s.solicitanteTelefono || NO_INFORMADO}
                        </span>
                      </td>
                      <td>
                        <strong>{s.vehiculoDescripcion || 'Vehículo'}</strong>
                        <span className="cred-sub">{s.vehiculoCodigo ?? ''}</span>
                      </td>
                      <td>
                        <strong>{formatoEUR(monto(s.montoSolicitado))}</strong>
                        <span className="cred-sub">
                          Inicial: {formatoEUR(monto(s.cuotaInicial))} ({s.plazoMeses} meses)
                        </span>
                      </td>
                      <td>
                        <strong>{formatoEUR(monto(s.cuotaEstimada))}</strong> /mes
                      </td>
                      <td>
                        <span className={s.totalRecaudos > 0 ? 'cred-ok' : 'cred-mal'}>📎 {s.totalRecaudos} adjuntos</span>
                      </td>
                      <td>
                        <span
                          className="cred-insignia"
                          style={{ backgroundColor: insignia.fondo, color: insignia.color, border: insignia.borde ?? 'none' }}
                        >
                          {insignia.texto}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Boton variant="secondary" onClick={() => void cargarDetalle(s.id)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Revisar
                        </Boton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expediente digital */}
      {solicitudId && (
        <div className="cred-fondo" onClick={cerrarExpediente}>
          <div className="cred-modal" role="dialog" aria-modal="true" aria-label="Expediente de crédito" onClick={(e) => e.stopPropagation()}>
            {cargandoDetalle && !detalle ? (
              <div className="cred-vacio">Cargando expediente digital WMA-F-FIN-001…</div>
            ) : errorDetalle || !detalle || !resumen ? (
              <div className="cred-vacio" role="alert">
                <p>{errorDetalle ?? 'No se pudo leer el expediente.'}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <Boton variant="primary" onClick={() => void cargarDetalle(solicitudId)}>
                    Reintentar
                  </Boton>
                  <Boton variant="secondary" onClick={cerrarExpediente}>
                    Cerrar
                  </Boton>
                </div>
              </div>
            ) : (
              <>
                {/* Cabecera */}
                <div className="cred-cabecera">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2>Expediente {detalle.numeroSolicitud}</h2>
                      <span
                        className="cred-insignia"
                        style={{
                          backgroundColor: insigniaDe(detalle.estado).fondo,
                          color: insigniaDe(detalle.estado).color,
                          border: insigniaDe(detalle.estado).borde ?? 'none',
                        }}
                      >
                        {insigniaDe(detalle.estado).texto}
                      </span>
                    </div>
                    <p className="cred-sub" style={{ marginTop: '4px' }}>
                      Solicitante: <strong>{nombreCompleto(detalle.datosPersonales) || NO_INFORMADO}</strong> (
                      {documentoDe(detalle.datosPersonales) || NO_INFORMADO}) • Recibida el{' '}
                      {detalle.enviadaEn ? fechaHora(detalle.enviadaEn) : NO_INFORMADO}
                    </p>
                  </div>
                  <button type="button" className="cred-cerrar" onClick={cerrarExpediente} aria-label="Cerrar expediente">
                    ✕
                  </button>
                </div>

                {mensajeDictamen && (
                  <div className={`cred-aviso ${mensajeDictamen.tipo === 'exito' ? 'cred-aviso-exito' : 'cred-aviso-error'}`} role={mensajeDictamen.tipo === 'error' ? 'alert' : 'status'}>
                    {mensajeDictamen.texto}
                  </div>
                )}

                {avisoCliente && (
                  <div className="cred-aviso cred-aviso-alerta cred-aviso-cliente" role="status">
                    <div>
                      <strong>Aviso al cliente.</strong>{' '}
                      {avisoCliente.mensaje.telefono
                        ? avisoCliente.whatsappAbierto
                          ? 'Se abrió WhatsApp con el mensaje: revísalo y envíalo.'
                          : 'El navegador no abrió WhatsApp: usa el botón.'
                        : 'El expediente no trae un teléfono: avísale por otro medio.'}
                      {avisoCliente.mensaje.correo && ' También se abrió tu programa de correo.'}
                      {avisoCliente.enlace && (
                        <>
                          <br />
                          Enlace para que complete sus documentos: <code>{avisoCliente.enlace}</code>
                          <br />
                          Solo se muestra ahora. Si lo pierdes, usa «Volver a enviar el enlace de recaudos».
                        </>
                      )}
                    </div>
                    <div className="cred-aviso-botones">
                      {avisoCliente.mensaje.telefono && (
                        <a
                          href={enlaceWhatsApp(avisoCliente.mensaje.telefono, avisoCliente.mensaje.texto)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      {avisoCliente.mensaje.correo && (
                        <a href={enlaceCorreo(avisoCliente.mensaje.correo, avisoCliente.mensaje.asunto, avisoCliente.mensaje.cuerpo)}>
                          ✉️ Correo
                        </a>
                      )}
                      {avisoCliente.enlace && (
                        <button type="button" onClick={() => void copiarEnlaceRecaudos(avisoCliente.enlace ?? '')}>
                          {copiado ? '✓ Copiado' : '📋 Copiar enlace'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Operación y capacidad de pago */}
                <div className="cred-operacion">
                  <h3>📊 Operación y capacidad de pago</h3>
                  <div className="cred-rejilla">
                    <div>
                      <span>Vehículo</span>
                      <strong>
                        {detalle.vehiculo
                          ? `${detalle.vehiculo.brand} ${detalle.vehiculo.model} ${detalle.vehiculo.year}`
                          : NO_INFORMADO}
                      </strong>
                      <small>{detalle.vehiculo?.code ?? ''}</small>
                    </div>
                    <div>
                      <span>Precio del vehículo</span>
                      <strong>{eur2.format(detalle.vehiculo ? monto(detalle.vehiculo.priceEur) : resumen.precio)}</strong>
                    </div>
                    <div>
                      <span>Inicial aportada</span>
                      <strong>{eur2.format(resumen.inicial)}</strong>
                      <small className={resumen.inicialInsuficiente ? 'cred-mal' : undefined}>
                        {Math.round(resumen.porcentajeInicial * 1000) / 10} % del precio
                        {resumen.inicialInsuficiente && ' ⚠️ por debajo del mínimo vigente'}
                      </small>
                    </div>
                    <div>
                      <span>Monto a financiar</span>
                      <strong>{eur2.format(resumen.financiado)}</strong>
                      <small>
                        {detalle.plazoMeses} cuotas mensuales
                      </small>
                    </div>
                    <div>
                      <span>Cuota mensual estimada</span>
                      <strong className={resumen.excedeCapacidad ? 'cred-mal' : undefined}>{eur2.format(resumen.cuota)}</strong>
                      {resumen.excedeCapacidad && <small className="cred-mal">⚠️ Supera la capacidad de pago</small>}
                    </div>
                    <div>
                      <span>Ingresos declarados</span>
                      <strong>{eur2.format(resumen.ingresos)}</strong>
                      <small>Egresos declarados: {eur2.format(resumen.egresos)}</small>
                    </div>
                    <div>
                      <span>Capacidad de pago</span>
                      <strong className="cred-ok">{eur2.format(resumen.capacidadPago)}</strong>
                      <small>
                        {resumen.cuotaSobreCapacidad !== null
                          ? `La cuota usa el ${Math.round(resumen.cuotaSobreCapacidad * 100)} %`
                          : 'Sin ingresos declarados'}
                      </small>
                    </div>
                  </div>
                  <p className="cred-nota">
                    Los ingresos y egresos son los que la persona declaró; la cuota y la capacidad son referenciales y se
                    confirman en el contrato. Moneda de la operación: {detalle.moneda}.
                  </p>
                </div>

                {/* Datos del solicitante */}
                <div className="cred-datos">
                  <Bloque titulo="Identidad">
                    <Dato etiqueta="Documento" valor={documentoDe(detalle.datosPersonales)} />
                    <Dato etiqueta="RIF" valor={texto(personales.rif)} />
                    <Dato etiqueta="Nacionalidad" valor={texto(personales.nacionalidad)} />
                    <Dato etiqueta="Estado civil" valor={texto(personales.estadoCivil)} />
                    <Dato
                      etiqueta="Nacimiento"
                      valor={[texto(personales.fechaNacimiento), texto(personales.lugarNacimiento)].filter(Boolean).join(' · ')}
                    />
                    <Dato etiqueta="Nivel académico" valor={texto(personales.nivelAcademico)} />
                    <Dato etiqueta="Cargas familiares" valor={texto(personales.cargasFamiliares)} />
                    <Dato etiqueta="Vivienda" valor={texto(personales.condicionVivienda)} />
                  </Bloque>

                  <Bloque titulo="Contacto">
                    <Dato etiqueta="Celular" valor={texto(contacto.telefonoCelular)} />
                    <Dato etiqueta="Teléfono de habitación" valor={texto(contacto.telefonoHabitacion)} />
                    <Dato etiqueta="Correo" valor={texto(contacto.correo)} />
                    <Dato
                      etiqueta="Dirección"
                      valor={[texto(contacto.direccionHabitacion), texto(contacto.municipio), texto(contacto.estado)]
                        .filter(Boolean)
                        .join(', ')}
                    />
                    <Dato etiqueta="Punto de referencia" valor={texto(contacto.puntoReferencia)} />
                    <Dato etiqueta="Código postal" valor={texto(contacto.codigoPostal)} />
                  </Bloque>

                  <Bloque titulo="Situación laboral">
                    <Dato etiqueta="Situación" valor={texto(laboral.situacionLaboral)} />
                    <Dato etiqueta="Empresa o ente pagador" valor={texto(laboral.empresa)} />
                    <Dato etiqueta="RIF de la empresa" valor={texto(laboral.rifEmpresa)} />
                    <Dato etiqueta="Cargo" valor={texto(laboral.cargo)} />
                    <Dato
                      etiqueta="Antigüedad"
                      valor={`${texto(laboral.antiguedadAnios) || '0'} años, ${texto(laboral.antiguedadMeses) || '0'} meses`}
                    />
                    <Dato etiqueta="Dirección de la empresa" valor={texto(laboral.direccionEmpresa)} />
                    <Dato etiqueta="Teléfono de oficina" valor={texto(laboral.telefonoOficina)} />
                    <Dato etiqueta="Jefe inmediato" valor={texto(laboral.nombreJefeInmediato)} />
                  </Bloque>

                  <Bloque titulo="Ingresos y egresos declarados">
                    <Dato etiqueta="Sueldo o ingreso mensual" valor={eur2.format(monto(financieros.sueldoMensual))} />
                    <Dato
                      etiqueta="Otros ingresos"
                      valor={
                        monto(financieros.otrosIngresos) > 0
                          ? `${eur2.format(monto(financieros.otrosIngresos))} (${texto(financieros.conceptoOtrosIngresos) || NO_INFORMADO})`
                          : eur2.format(0)
                      }
                    />
                    <Dato etiqueta="Alquiler o hipoteca" valor={eur2.format(monto(financieros.alquilerHipoteca))} />
                    <Dato etiqueta="Alimentación y servicios" valor={eur2.format(monto(financieros.alimentacionServicios))} />
                    <Dato etiqueta="Pagos de deudas y créditos" valor={eur2.format(monto(financieros.pagosDeudas))} />
                  </Bloque>

                  <Bloque titulo="Referencias">
                    {(detalle.referencias ?? []).length === 0 ? (
                      <p className="cred-mudo">{NO_INFORMADO}</p>
                    ) : (
                      (detalle.referencias ?? []).map((r, i) => (
                        <p key={i} className="cred-dato">
                          <strong>{texto(r.nombre) || NO_INFORMADO}</strong> · {texto(r.parentesco) || NO_INFORMADO} ·{' '}
                          {texto(r.telefono) || NO_INFORMADO}
                        </p>
                      ))
                    )}
                  </Bloque>

                  <Bloque titulo="Cuenta bancaria">
                    <Dato etiqueta="Banco" valor={banco ? `${banco.codigo} — ${banco.nombre}` : texto(bancarios.banco)} />
                    <Dato etiqueta="Tipo de cuenta" valor={texto(bancarios.tipoCuenta)} />
                    <Dato etiqueta="Número de cuenta" valor={texto(bancarios.numeroCuenta)} />
                  </Bloque>

                  <Bloque titulo="Declaraciones y aceptación">
                    <Dato
                      etiqueta="Persona expuesta políticamente"
                      valor={declaraciones.esPep ? 'Sí, declarada' : 'No declarada'}
                    />
                    <Dato
                      etiqueta="Vínculo con una PEP"
                      valor={declaraciones.vinculoPep ? 'Sí, declarado' : 'No declarado'}
                    />
                    {(declaraciones.esPep || declaraciones.vinculoPep) && (
                      <Dato
                        etiqueta="Cargo o vinculación"
                        valor={[texto(declaraciones.cargoPep), texto(declaraciones.institucionPep), texto(declaraciones.periodoPep)]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    )}
                    <Dato etiqueta="Aceptó el tratamiento de datos" valor={declaraciones.consentimientoDatos ? 'Sí' : 'No'} />
                    <Dato etiqueta="Aceptada el" valor={evidencia.aceptadoEn ? fechaHora(evidencia.aceptadoEn) : ''} />
                    <Dato etiqueta="Desde la IP" valor={texto(evidencia.ip)} />
                    <Dato etiqueta="Versión del texto" valor={texto(evidencia.versionTexto)} />
                  </Bloque>
                </div>

                {/* Recaudos */}
                <div className="cred-recaudos">
                  <h3>📎 Recaudos documentales ({recaudos.length})</h3>
                  {recaudos.length === 0 ? (
                    <p className="cred-mudo">La persona no adjuntó documentos digitales a esta solicitud.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {recaudos.map((doc) => {
                        const estado = ESTADOS_RECAUDO[doc.validationStatus ?? 'pendiente'] ?? ESTADOS_RECAUDO.pendiente;
                        return (
                          <div key={doc.id} className="cred-recaudo">
                            <div>
                              <strong>{tituloDeRecaudo(doc.documentType)}</strong>
                              <span className="cred-sub">
                                {doc.fileName ?? 'documento'} • {Math.max(1, Math.round(monto(doc.fileSizeBytes) / 1024))} KB
                              </span>
                            </div>
                            <div className="cred-recaudo-acciones">
                              <button
                                type="button"
                                onClick={() => void abrirRecaudo(doc.id)}
                                disabled={abriendoRecaudoId === doc.id}
                                aria-label={`Ver ${doc.fileName ?? 'documento'}`}
                                className="cred-boton-mini"
                              >
                                {abriendoRecaudoId === doc.id ? 'Abriendo…' : 'Ver'}
                              </button>
                              <span className="cred-insignia" style={{ backgroundColor: estado.fondo, color: estado.color }}>
                                {estado.texto}
                              </span>
                              {puedeEvaluar && (
                                <>
                                  <button
                                    type="button"
                                    className="cred-boton-mini cred-boton-verde"
                                    disabled={actualizandoRecaudoId === doc.id}
                                    onClick={() => void cambiarEstadoRecaudo(doc.id, 'conforme')}
                                  >
                                    Conforme
                                  </button>
                                  <button
                                    type="button"
                                    className="cred-boton-mini"
                                    disabled={actualizandoRecaudoId === doc.id}
                                    onClick={() => void cambiarEstadoRecaudo(doc.id, 'ilegible')}
                                  >
                                    Ilegible
                                  </button>
                                  <button
                                    type="button"
                                    className="cred-boton-mini cred-boton-rojo"
                                    disabled={actualizandoRecaudoId === doc.id}
                                    onClick={() => void cambiarEstadoRecaudo(doc.id, 'rechazado')}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {avisoRecaudo && (
                    <p role="alert" className={avisoRecaudo.url ? 'cred-nota' : 'cred-mal'} style={{ marginTop: '8px' }}>
                      {avisoRecaudo.texto}{' '}
                      {avisoRecaudo.url && (
                        <a href={avisoRecaudo.url} target="_blank" rel="noopener noreferrer">
                          Abrir el recaudo (el enlace vence en minutos)
                        </a>
                      )}
                    </p>
                  )}
                </div>

                {/* Dictamen vigente */}
                {dictamenVigente && (
                  <div className="cred-dictamen-vigente">
                    <h3>Dictamen registrado</h3>
                    <p>
                      <strong>{ETIQUETA_RESULTADO[dictamenVigente.result] ?? dictamenVigente.result}</strong>
                      {dictamenVigente.evaluatedAt && <> · {fechaHora(dictamenVigente.evaluatedAt)}</>}
                    </p>
                    {dictamenVigente.result === 'aprobado' && (
                      <p className="cred-sub">
                        Límite aprobado: {eur2.format(monto(dictamenVigente.approvedLimit))} · Cuota máxima permitida:{' '}
                        {eur2.format(monto(dictamenVigente.maxAllowedPayment))}
                      </p>
                    )}
                    <p>{dictamenVigente.justification || <em className="cred-mudo">Sin justificación registrada.</em>}</p>
                    {/* Solicitud condicionada: el cliente completa sus documentos con un enlace (D-70). */}
                    {puedeEvaluar && detalle.estado === 'condicionada' && (
                      <div className="cred-dictamen-acciones" style={{ justifyContent: 'flex-start', marginTop: '8px' }}>
                        <Boton variant="secondary" onClick={() => void reenviarEnlaceRecaudos()} disabled={emitiendoEnlace}>
                          {emitiendoEnlace ? 'Emitiendo enlace…' : 'Volver a enviar el enlace de recaudos'}
                        </Boton>
                      </div>
                    )}
                  </div>
                )}

                {/* Dictamen del analista */}
                {puedeEvaluar && !esFinal && (
                  <div className="cred-dictamen">
                    <h3>⚖️ Dictamen del analista de crédito</h3>
                    <div className="cred-dictamen-campos">
                      <div>
                        <label htmlFor="cred-resultado">Decisión *</label>
                        <select
                          id="cred-resultado"
                          value={resultado}
                          onChange={(e) => setResultado(e.target.value as ResultadoDictamen)}
                        >
                          {RESULTADOS.map((r) => (
                            <option key={r.valor} value={r.valor}>
                              {r.etiqueta}
                            </option>
                          ))}
                        </select>
                      </div>
                      {resultado === 'aprobado' && (
                        <>
                          <Campo
                            label="Límite aprobado (€)"
                            type="number"
                            value={limiteAprobado}
                            onChange={(e) => setLimiteAprobado(e.target.value)}
                          />
                          <Campo
                            label="Cuota máxima permitida (€)"
                            type="number"
                            value={cuotaMaxima}
                            onChange={(e) => setCuotaMaxima(e.target.value)}
                          />
                        </>
                      )}
                    </div>

                    {resultado === 'aprobado' && (resumen.excedeCapacidad || recaudosSinConforme > 0) && (
                      <div className="cred-aviso cred-aviso-alerta" role="status">
                        Antes de aprobar ten en cuenta:
                        {resumen.excedeCapacidad && ' la cuota estimada supera la capacidad de pago declarada.'}
                        {recaudosSinConforme > 0 &&
                          ` ${recaudosSinConforme} de ${recaudos.length} recaudo(s) no están marcados como conformes.`}{' '}
                        Tu justificación debe explicarlo.
                      </div>
                    )}

                    <div>
                      <label htmlFor="cred-justificacion">Justificación del dictamen *</label>
                      <textarea
                        id="cred-justificacion"
                        rows={3}
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                        placeholder="Sustento de la aprobación, o motivo del rechazo o de la información que falta…"
                      />
                      <span className="cred-nota">Queda registrada con tu usuario en la bitácora.</span>
                    </div>

                    <div className="cred-dictamen-acciones">
                      <Boton variant="secondary" onClick={cerrarExpediente}>
                        Cerrar sin guardar
                      </Boton>
                      <Boton variant="primary" onClick={() => void guardarDictamen()} disabled={guardandoDictamen}>
                        {guardandoDictamen ? 'Registrando dictamen…' : 'Registrar dictamen'}
                      </Boton>
                    </div>
                  </div>
                )}

                {esFinal && puedeEvaluar && puedeReabrir && (
                  <div className="cred-dictamen">
                    <h3>🔓 Reabrir expediente</h3>
                    <p className="cred-nota" style={{ marginTop: 0 }}>
                      Esta solicitud ya tiene un dictamen final. Si hace falta cambiarlo, reábrela: vuelve a «En
                      evaluación», el dictamen anterior queda en la bitácora y tu justificación también.
                    </p>
                    <div>
                      <label htmlFor="cred-reapertura">Justificación de la reapertura *</label>
                      <textarea
                        id="cred-reapertura"
                        rows={2}
                        value={justificacionReapertura}
                        onChange={(e) => setJustificacionReapertura(e.target.value)}
                        placeholder="Por qué se vuelve a revisar este expediente…"
                      />
                    </div>
                    <div className="cred-dictamen-acciones">
                      <Boton variant="secondary" onClick={() => void reabrirExpediente()} disabled={reabriendo}>
                        {reabriendo ? 'Reabriendo…' : 'Reabrir expediente'}
                      </Boton>
                    </div>
                  </div>
                )}
                {esFinal && !(puedeEvaluar && puedeReabrir) && (
                  <p className="cred-nota">
                    Esta solicitud ya tiene un dictamen final
                    {detalle.estado === 'desembolsada' ? ' y el crédito ya se desembolsó: no se reabre.' : '.'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="cred-pie">
        Módulo de Análisis de Crédito (WMA-F-FIN-001) · Operaciones en euros conforme a la Constitución v3.0.0
      </div>

      <style>{`
        .cred-pagina { max-width: 1200px; margin: 0 auto; padding-bottom: var(--space-xxl); }
        .cred-encabezado { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-xl); }
        .cred-encabezado h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
        .cred-encabezado p { font-size: 13px; color: var(--texto-secundario); margin: 0; }
        .cred-aviso { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-radius: var(--radius-md); padding: 12px 16px; font-size: 13px; margin-bottom: var(--space-lg); }
        .cred-aviso button { background: none; border: none; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; font-size: 13px; }
        .cred-aviso-error { background-color: var(--peligro-fondo); color: var(--peligro-texto); }
        .cred-aviso-exito { background-color: var(--exito-fondo); color: var(--exito-texto); }
        .cred-aviso-alerta { background-color: #FEF3C7; color: #92400E; margin-bottom: var(--space-md); }
        .cred-aviso-cliente code { word-break: break-all; font-size: 12px; }
        .cred-aviso-botones { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
        .cred-aviso-botones a { color: inherit; font-weight: 700; font-size: 13px; }
        .cred-metricas { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-xl); }
        .cred-metrica { background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-md); padding: var(--space-md); }
        .cred-metrica span { display: block; font-size: 12px; color: var(--texto-mudo); text-transform: uppercase; font-weight: 700; }
        .cred-metrica strong { display: block; font-size: 24px; font-weight: 800; margin-top: 4px; }
        .cred-metrica-naranja { border-color: var(--naranja-200); }
        .cred-metrica-naranja span, .cred-metrica-naranja strong { color: var(--naranja-700); }
        .cred-metrica-verde { border-color: var(--exito-texto); }
        .cred-metrica-verde span, .cred-metrica-verde strong { color: var(--exito-texto); }
        .cred-filtros { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
        .cred-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .cred-chip { padding: 6px 14px; border-radius: var(--radius-pill); border: 1px solid var(--borde); background-color: var(--blanco); color: var(--texto-secundario); font-size: 13px; font-weight: 600; cursor: pointer; }
        .cred-chip.activo { border-color: var(--naranja-500); background-color: var(--naranja-500); color: var(--blanco); }
        .cred-buscar { padding: 8px 14px; border-radius: var(--radius-md); border: 1px solid var(--borde); font-size: 13px; width: 320px; max-width: 100%; }
        .cred-tabla-caja { background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg); overflow: hidden; }
        .cred-vacio { padding: 40px 20px; text-align: center; color: var(--texto-secundario); font-size: 14px; }
        .cred-vacio strong { display: block; font-size: 15px; color: var(--texto-primario); }
        .cred-vacio p { font-size: 13px; margin: 4px 0 0; }
        .cred-tabla { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
        .cred-tabla th { padding: 12px 16px; background-color: var(--superficie); border-bottom: 1px solid var(--borde-claro); color: var(--texto-mudo); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
        .cred-tabla td { padding: 12px 16px; border-bottom: 1px solid var(--borde-claro); vertical-align: top; }
        .cred-tabla tbody tr:hover { background-color: var(--superficie); }
        .cred-numero { font-weight: 700; color: var(--naranja-700); white-space: nowrap; }
        .cred-sub { display: block; font-size: 11px; color: var(--texto-mudo); font-weight: 400; }
        .cred-mudo { color: var(--texto-mudo); }
        .cred-ok { color: var(--exito-texto); font-weight: 600; }
        .cred-mal { color: var(--peligro-texto); font-weight: 600; }
        .cred-insignia { display: inline-block; padding: 3px 9px; border-radius: var(--radius-pill); font-size: 11px; font-weight: 700; white-space: nowrap; }
        .cred-fondo { position: fixed; inset: 0; background-color: rgba(0,0,0,0.55); backdrop-filter: blur(3px); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; }
        .cred-modal { background-color: var(--blanco); border-radius: var(--radius-lg); width: 1000px; max-width: 96vw; max-height: 92vh; overflow-y: auto; padding: var(--space-xl); box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
        .cred-cabecera { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--borde-claro); padding-bottom: var(--space-lg); margin-bottom: var(--space-lg); }
        .cred-cabecera h2 { font-size: 20px; margin: 0; }
        .cred-cerrar { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--texto-mudo); }
        .cred-operacion { background-color: var(--superficie); border: 1px solid var(--borde-claro); border-radius: var(--radius-md); padding: var(--space-lg); margin-bottom: var(--space-lg); }
        .cred-operacion h3, .cred-recaudos h3, .cred-dictamen h3, .cred-dictamen-vigente h3 { font-size: 13px; margin: 0 0 var(--space-md); text-transform: uppercase; letter-spacing: 0.05em; color: var(--naranja-700); font-weight: 700; }
        .cred-rejilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md); }
        .cred-rejilla span { display: block; font-size: 11px; color: var(--texto-mudo); }
        .cred-rejilla strong { display: block; font-size: 16px; font-weight: 700; }
        .cred-rejilla small { display: block; font-size: 11px; color: var(--texto-secundario); }
        .cred-nota { font-size: 12px; color: var(--texto-secundario); margin: 10px 0 0; line-height: 1.4; }
        .cred-datos { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); margin-bottom: var(--space-xl); }
        @media (max-width: 800px) { .cred-datos { grid-template-columns: 1fr; } }
        .cred-bloque { border: 1px solid var(--borde-claro); border-radius: var(--radius-md); padding: var(--space-md); }
        .cred-bloque h4 { font-size: 12px; text-transform: uppercase; color: var(--texto-mudo); margin: 0 0 var(--space-md); }
        .cred-dato { margin: 4px 0; font-size: 13px; }
        .cred-recaudos { margin-bottom: var(--space-xl); }
        .cred-recaudos h3 { color: var(--texto-primario); font-size: 14px; }
        .cred-recaudo { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid var(--borde-claro); border-radius: var(--radius-md); background-color: var(--blanco); }
        .cred-recaudo strong { font-size: 13px; display: block; }
        .cred-recaudo-acciones { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .cred-boton-mini { border: 1px solid var(--borde); background: none; color: var(--texto-primario); padding: 3px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; font-family: inherit; }
        .cred-boton-mini:disabled { opacity: 0.5; cursor: default; }
        .cred-boton-verde { border-color: var(--exito-texto); color: var(--exito-texto); }
        .cred-boton-rojo { border-color: var(--peligro-texto); color: var(--peligro-texto); }
        .cred-dictamen-vigente { background-color: var(--superficie); border: 1px solid var(--borde-claro); border-radius: var(--radius-md); padding: var(--space-md) var(--space-lg); margin-bottom: var(--space-lg); font-size: 13px; }
        .cred-dictamen-vigente p { margin: 4px 0; }
        .cred-dictamen { border-top: 2px solid var(--borde-claro); padding-top: var(--space-lg); }
        .cred-dictamen h3 { color: var(--texto-primario); font-size: 15px; text-transform: none; letter-spacing: 0; }
        .cred-dictamen-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-md); }
        .cred-dictamen label { display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
        .cred-dictamen select, .cred-dictamen textarea { width: 100%; padding: 8px 10px; border-radius: var(--radius-md); border: 1px solid var(--borde); font-size: 13px; font-family: inherit; box-sizing: border-box; }
        .cred-dictamen-acciones { display: flex; justify-content: flex-end; gap: var(--space-md); margin-top: var(--space-md); }
        .cred-pie { margin-top: var(--space-xl); text-align: center; font-size: 12px; color: var(--texto-mudo); }
      `}</style>
    </div>
  );
};
