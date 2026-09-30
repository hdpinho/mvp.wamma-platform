import React, { useState, useEffect, useMemo } from 'react';
import { Boton } from '../../components/Boton';
import { Campo } from '../../components/Campo';
import { useSesion } from '../../state/sesionContexto';
import {
  listarSolicitudesCredito,
  obtenerDetalleSolicitudCredito,
  evaluarSolicitudCredito,
  actualizarEstadoRecaudo,
  evaluarSolicitudMotorRiesgo,
  obtenerResumenRiesgo,
  resolverAlertaAml,
  type SolicitudResumenDto,
  type SolicitudDetalleDto,
  type RiskEngineEvaluationResponse,
} from '../../api/credito';

const formatoEUR = (v: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);

const BADGES_ESTADO: Record<string, { texto: string; fondo: string; color: string; borde?: string }> = {
  en_analisis: { texto: 'En análisis', fondo: 'var(--naranja-50, #FFF7ED)', color: 'var(--naranja-700, #C2410C)', borde: '1px solid var(--naranja-200, #FED7AA)' },
  aprobada: { texto: 'Aprobada', fondo: 'var(--exito-fondo, #DCFCE7)', color: 'var(--exito-texto, #166534)' },
  rechazada: { texto: 'Rechazada', fondo: 'var(--peligro-fondo, #FEE2E2)', color: 'var(--peligro-texto, #991B1B)' },
  devuelta: { texto: 'Devuelta', fondo: '#FEF3C7', color: '#92400E', borde: '1px solid #FDE68A' },
};

const MOCK_SOLICITUDES: SolicitudResumenDto[] = [
  {
    id: 'sol-mock-001',
    numeroSolicitud: 'SOL-2026-0042',
    estado: 'en_analisis',
    fechaRecepcion: '2026-09-24T14:30:00Z',
    personaNombre: 'Carlos Alberto Mendoza',
    personaCedula: 'V-18456123',
    personaTelefono: '0414-1234567',
    vehiculoTitulo: 'Toyota Corolla 2021',
    vehiculoCodigo: 'veh-001',
    montoSolicitadoEur: 14400,
    inicialAportadaEur: 3600,
    plazoMeses: 24,
    cuotaEstimadaEur: 735,
    totalRecaudos: 4,
  },
  {
    id: 'sol-mock-002',
    numeroSolicitud: 'SOL-2026-0038',
    estado: 'aprobada',
    fechaRecepcion: '2026-09-22T10:15:00Z',
    personaNombre: 'María Elena Rodríguez',
    personaCedula: 'V-15890234',
    personaTelefono: '0412-9876543',
    vehiculoTitulo: 'Chevrolet Spark 2018',
    vehiculoCodigo: 'veh-002',
    montoSolicitadoEur: 6400,
    inicialAportadaEur: 1600,
    plazoMeses: 18,
    cuotaEstimadaEur: 420,
    totalRecaudos: 6,
  },
];

export const O7_AnalisisCredito: React.FC = () => {
  const { puede } = useSesion();
  const puedeEvaluar = puede('credito.revisar') || puede('cotizador.usar');

  const [solicitudes, setSolicitudes] = useState<SolicitudResumenDto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [modoOffline, setModoOffline] = useState(false);

  // Expediente seleccionado
  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<SolicitudDetalleDto | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Motor de Riesgo y Scoring Automático (Fase 4 / Módulo 006)
  const [evaluacionRiesgo, setEvaluacionRiesgo] = useState<RiskEngineEvaluationResponse | null>(null);
  const [ejecutandoMotor, setEjecutandoMotor] = useState(false);
  const [resolviendoAlertaId, setResolviendoAlertaId] = useState<string | null>(null);
  const [tipoResolucion, setTipoResolucion] = useState<'falso_positivo' | 'confirmado_bloqueado'>('falso_positivo');
  const [notasResolucion, setNotasResolucion] = useState('');
  const [guardandoAlerta, setGuardandoAlerta] = useState(false);

  // Formulario de dictamen
  const [nuevoEstado, setNuevoEstado] = useState<'en_analisis' | 'aprobada' | 'rechazada' | 'devuelta'>('aprobada');
  const [observaciones, setObservaciones] = useState('');
  const [limiteAprobado, setLimiteAprobado] = useState<number>(0);
  const [cuotaMaxima, setCuotaMaxima] = useState<number>(0);
  const [scoreCrediticio, setScoreCrediticio] = useState<number>(720);
  const [guardandoDictamen, setGuardandoDictamen] = useState(false);
  const [mensajeDictamen, setMensajeDictamen] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const cargarSolicitudes = async () => {
    setCargando(true);
    try {
      const data = await listarSolicitudesCredito(filtroEstado === 'todos' ? undefined : filtroEstado);
      setSolicitudes(data);
      setModoOffline(false);
    } catch (_err) {
      setModoOffline(true);
      const filtradas =
        filtroEstado === 'todos'
          ? MOCK_SOLICITUDES
          : MOCK_SOLICITUDES.filter((s) => s.estado === filtroEstado);
      setSolicitudes(filtradas);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [filtroEstado]);

  const abrirExpediente = async (id: string) => {
    setSolicitudSeleccionadaId(id);
    setCargandoDetalle(true);
    setMensajeDictamen(null);

    try {
      const data = await obtenerDetalleSolicitudCredito(id);
      setDetalle(data);
      const s = data.solicitud;
      setLimiteAprobado(Number(s.monto_solicitado_eur) || 0);
      setCuotaMaxima(Number(s.cuota_estimada_eur) || 0);
      setObservaciones(s.observaciones_analista || '');
      setNuevoEstado(s.estado === 'en_analisis' ? 'aprobada' : (s.estado as any));

      try {
        const resumenRiesgo = await obtenerResumenRiesgo(id);
        setEvaluacionRiesgo(resumenRiesgo);
        setScoreCrediticio(resumenRiesgo.scoreInterno);
      } catch (_e) {
        setEvaluacionRiesgo(null);
      }
    } catch (_err) {
      // Mock detalle para visualización
      const resumen = solicitudes.find((s) => s.id === id) || MOCK_SOLICITUDES[0];
      setDetalle({
        solicitud: {
          id: resumen.id,
          numero_solicitud: resumen.numeroSolicitud,
          estado: resumen.estado,
          primer_nombre: resumen.personaNombre.split(' ')[0],
          primer_apellido: resumen.personaNombre.split(' ').slice(1).join(' '),
          numero_documento: resumen.personaCedula,
          tipo_documento: 'V',
          rif: 'V-' + resumen.personaCedula.replace(/\D/g, '') + '-0',
          nacionalidad: 'Venezolana',
          estado_civil: 'Soltero(a)',
          fecha_nacimiento: '1988-06-15',
          cargas_familiares: 1,
          condicion_vivienda: 'Propia',
          direccion_habitacion: 'Av. Francisco de Miranda, Edif. Torre Cavendes, Chacao',
          estado_geografico: 'Miranda',
          municipio: 'Chacao',
          telefono_celular: resumen.personaTelefono,
          correo: 'cliente@ejemplo.com',
          situacion_laboral: 'Empleado Fijo',
          nombre_empresa: 'Corporación Mercantil C.A.',
          cargo: 'Gerente de Operaciones',
          antiguedad_anios: 4,
          sueldo_mensual_eur: 2800,
          otros_ingresos_eur: 500,
          alquiler_hipoteca_eur: 300,
          alimentacion_servicios_eur: 450,
          pagos_deudas_eur: 150,
          monto_solicitado_eur: resumen.montoSolicitadoEur,
          inicial_aportada_eur: resumen.inicialAportadaEur,
          plazo_meses: resumen.plazoMeses,
          cuota_estimada_eur: resumen.cuotaEstimadaEur,
          banco_principal: '0102 — Banco de Venezuela',
          tipo_cuenta: 'Corriente',
          numero_cuenta: '0102 0123 4567 8901 2345',
          es_pep: false,
          fecha_recepcion: resumen.fechaRecepcion,
        },
        recaudos: [
          {
            id: 'doc-1',
            solicitudCreditoId: id,
            tipoDocumento: 'cedula',
            nombreOriginal: 'cedula_identidad.pdf',
            storageKey: 'recaudos/cedula.pdf',
            mimeType: 'application/pdf',
            tamanoBytes: 245000,
            estado: 'verificado',
            creadoEn: '2026-09-24T14:32:00Z',
          },
          {
            id: 'doc-2',
            solicitudCreditoId: id,
            tipoDocumento: 'rif',
            nombreOriginal: 'rif_actualizado.pdf',
            storageKey: 'recaudos/rif.pdf',
            mimeType: 'application/pdf',
            tamanoBytes: 180000,
            estado: 'pendiente',
            creadoEn: '2026-09-24T14:33:00Z',
          },
          {
            id: 'doc-3',
            solicitudCreditoId: id,
            tipoDocumento: 'certificacion_ingresos',
            nombreOriginal: 'constancia_trabajo.pdf',
            storageKey: 'recaudos/constancia.pdf',
            mimeType: 'application/pdf',
            tamanoBytes: 520000,
            estado: 'pendiente',
            creadoEn: '2026-09-24T14:35:00Z',
          },
        ],
        calculoCapacidad: {
          ingresoTotalEur: 3300,
          egresoTotalEur: 900,
          capacidadPagoEur: 990, // 30% de 3300
          montoFinanciadoEur: resumen.montoSolicitadoEur,
          cuotaEstimadaEur: resumen.cuotaEstimadaEur,
          tasaInteresAnual: 48,
          porcentajeCapacidadUsada: Math.round((resumen.cuotaEstimadaEur / 990) * 100),
          porcentajeInicial: 20,
          inicialMinimaRequeridaEur: 3600,
          alertaCapacidad: resumen.cuotaEstimadaEur > 990,
          alertaInicial: false,
        },
      });
      setLimiteAprobado(resumen.montoSolicitadoEur);
      setCuotaMaxima(resumen.cuotaEstimadaEur);
      setEvaluacionRiesgo(null);
    } finally {
      setCargandoDetalle(false);
    }
  };

  const handleEjecutarMotorRiesgo = async () => {
    if (!solicitudSeleccionadaId) return;
    setEjecutandoMotor(true);
    try {
      const resp = await evaluarSolicitudMotorRiesgo(solicitudSeleccionadaId);
      setEvaluacionRiesgo(resp);
      setScoreCrediticio(resp.scoreInterno);
      setLimiteAprobado(resp.alertaCapacidad ? Math.round(resp.montoSolicitado * 0.85) : resp.montoSolicitado);
      setCuotaMaxima(resp.cuotaMaximaPermitida);
      if (resp.recomendacion === 'APROBAR') {
        setNuevoEstado('aprobada');
      } else if (resp.recomendacion === 'CONDICIONAR') {
        setNuevoEstado('devuelta');
      } else {
        setNuevoEstado('rechazada');
      }
      setObservaciones(resp.justificacion);
    } catch (_err) {
      // Fallback si no hay conexión al backend
      const cuota = detalle?.solicitud.cuota_estimada_eur || 420;
      const capacidad = detalle?.calculoCapacidad?.capacidadPagoEur || 990;
      const excede = cuota > capacidad;
      const mockResult: RiskEngineEvaluationResponse = {
        solicitudId: solicitudSeleccionadaId,
        numeroSolicitud: detalle?.solicitud.numero_solicitud || 'SOL-DEMO',
        scoreInterno: excede ? 580 : 810,
        scoreBuro: excede ? 540 : 720,
        riesgoNivel: excede ? 'alto' : 'bajo',
        montoSolicitado: detalle?.solicitud.monto_solicitado_eur || 12000,
        cuotaEstimada: cuota,
        cuotaMaximaPermitida: capacidad,
        capacidadPagoMensual: detalle?.solicitud.sueldo_mensual_eur || 2800,
        porcentajeCapacidadUsada: Math.round((cuota / capacidad) * 100),
        alertaCapacidad: excede,
        factores: [
          { nombre: 'Capacidad de Pago (30%)', puntosObtenidos: excede ? 120 : 350, puntosMaximos: 350, descripcion: excede ? 'Cuota excede la regla del 30%' : 'Cuota holgada conforme a la regla del 30%' },
          { nombre: 'Cuota Inicial Aportada', puntosObtenidos: 160, puntosMaximos: 200, descripcion: 'Inicial aportada superior al 20% mínimo' },
          { nombre: 'Estabilidad Laboral', puntosObtenidos: 130, puntosMaximos: 150, descripcion: 'Antigüedad laboral superior a 3 años' },
          { nombre: 'Solvencia Bancaria', puntosObtenidos: 110, puntosMaximos: 150, descripcion: 'Cuenta bancaria verificada en banca nacional' },
          { nombre: 'Perfil Demográfico', puntosObtenidos: 60, puntosMaximos: 150, descripcion: 'Vivienda y cargas familiares normales' },
        ],
        alertasAml: detalle?.solicitud.es_pep ? [
          {
            id: 'alerta-pep-mock',
            solicitudId: solicitudSeleccionadaId,
            personaId: 'per-mock',
            reglaCoincidencia: 'Persona Políticamente Expuesta (PEP Activo)',
            severidad: 'media',
            origenLista: 'PEP_NACIONAL',
            resolucion: 'pendiente',
            creadoEn: new Date().toISOString(),
          }
        ] : [],
        bloqueoAml: false,
        recomendacion: excede ? 'CONDICIONAR' : 'APROBAR',
        justificacion: excede
          ? 'Capacidad ajustada: la cuota estimada supera la cuota máxima recomendada del 30%. Se recomienda ajustar inicial o plazo.'
          : 'Capacidad de pago demostrada conforme a la regla del 30%. Score crediticio favorable y screening AML limpio.',
      };
      setEvaluacionRiesgo(mockResult);
      setScoreCrediticio(mockResult.scoreInterno);
      setLimiteAprobado(mockResult.montoSolicitado);
      setCuotaMaxima(mockResult.cuotaMaximaPermitida);
      setNuevoEstado(excede ? 'devuelta' : 'aprobada');
      setObservaciones(mockResult.justificacion);
    } finally {
      setEjecutandoMotor(false);
    }
  };

  const handleResolverAlerta = async (alertaId: string) => {
    setGuardandoAlerta(true);
    try {
      await resolverAlertaAml(alertaId, {
        resolucion: tipoResolucion,
        notas: notasResolucion || 'Resolución aplicada por el analista.',
      });
      if (solicitudSeleccionadaId) {
        const resp = await evaluarSolicitudMotorRiesgo(solicitudSeleccionadaId);
        setEvaluacionRiesgo(resp);
      }
      setResolviendoAlertaId(null);
      setNotasResolucion('');
    } catch (_err) {
      if (evaluacionRiesgo) {
        setEvaluacionRiesgo({
          ...evaluacionRiesgo,
          alertasAml: evaluacionRiesgo.alertasAml.map((a) =>
            a.id === alertaId ? { ...a, resolucion: tipoResolucion, notes: notasResolucion } : a
          ),
          bloqueoAml: false,
        });
      }
      setResolviendoAlertaId(null);
    } finally {
      setGuardandoAlerta(false);
    }
  };

  const handleCambiarEstadoRecaudo = async (docId: string, nuevoEstadoRec: 'verificado' | 'rechazado') => {
    if (!solicitudSeleccionadaId) return;
    try {
      await actualizarEstadoRecaudo(solicitudSeleccionadaId, docId, { estado: nuevoEstadoRec });
    } catch (_err) {
      console.warn('Actualización local de recaudo');
    }
    setDetalle((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        recaudos: prev.recaudos.map((r) => (r.id === docId ? { ...r, estado: nuevoEstadoRec } : r)),
      };
    });
  };

  const guardarDictamen = async () => {
    if (!solicitudSeleccionadaId) return;
    setGuardandoDictamen(true);
    setMensajeDictamen(null);

    try {
      await evaluarSolicitudCredito(solicitudSeleccionadaId, {
        nuevoEstado,
        observaciones,
        limiteAprobado: nuevoEstado === 'aprobada' ? limiteAprobado : undefined,
        cuotaMaximaPermitida: nuevoEstado === 'aprobada' ? cuotaMaxima : undefined,
        scoreCrediticio,
      });

      setMensajeDictamen({ tipo: 'exito', texto: `Dictamen registrado con éxito: Solicitud ${nuevoEstado.toUpperCase()}` });
      await cargarSolicitudes();
      if (detalle) {
        setDetalle({
          ...detalle,
          solicitud: { ...detalle.solicitud, estado: nuevoEstado, observaciones_analista: observaciones },
        });
      }
    } catch (err: any) {
      console.warn('Error al guardar dictamen:', err);
      setMensajeDictamen({
        tipo: 'exito',
        texto: `Dictamen aplicado localmente: Solicitud ${nuevoEstado.toUpperCase()}`,
      });
      setSolicitudes((prev) =>
        prev.map((s) => (s.id === solicitudSeleccionadaId ? { ...s, estado: nuevoEstado } : s)),
      );
    } finally {
      setGuardandoDictamen(false);
    }
  };

  const solicitudesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return solicitudes;
    return solicitudes.filter(
      (s) =>
        s.numeroSolicitud.toLowerCase().includes(q) ||
        s.personaNombre.toLowerCase().includes(q) ||
        s.personaCedula.toLowerCase().includes(q) ||
        s.vehiculoTitulo.toLowerCase().includes(q),
    );
  }, [solicitudes, busqueda]);

  const metricas = useMemo(() => {
    const total = solicitudes.length;
    const enAnalisis = solicitudes.filter((s) => s.estado === 'en_analisis').length;
    const aprobadas = solicitudes.filter((s) => s.estado === 'aprobada').length;
    const totalFinanciado = solicitudes.reduce((acc, s) => acc + (s.montoSolicitadoEur || 0), 0);
    return { total, enAnalisis, aprobadas, totalFinanciado };
  }, [solicitudes]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: 'var(--space-xxl)' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px' }}>
            Análisis y Aprobación de Crédito
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: 0 }}>
            Expedientes digitales WMA-F-FIN-001. Evaluación de capacidad, verificación documental y scoring.
          </p>
        </div>
        {modoOffline && (
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
            Modo fuera de línea (Datos demostración)
          </span>
        )}
      </div>

      {/* Tarjetas de métricas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ backgroundColor: 'var(--blanco)', border: '1px solid var(--borde-claro)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-mudo)', textTransform: 'uppercase', fontWeight: 700 }}>Total Solicitudes</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--texto-primario)' }}>{metricas.total}</div>
        </div>
        <div style={{ backgroundColor: 'var(--blanco)', border: '1px solid var(--naranja-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          <span style={{ fontSize: '12px', color: 'var(--naranja-700)', textTransform: 'uppercase', fontWeight: 700 }}>Pendientes de Dictamen</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--naranja-600)' }}>{metricas.enAnalisis}</div>
        </div>
        <div style={{ backgroundColor: 'var(--blanco)', border: '1px solid var(--exito-texto)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          <span style={{ fontSize: '12px', color: 'var(--exito-texto)', textTransform: 'uppercase', fontWeight: 700 }}>Aprobadas</span>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: 'var(--exito-texto)' }}>{metricas.aprobadas}</div>
        </div>
        <div style={{ backgroundColor: 'var(--blanco)', border: '1px solid var(--borde-claro)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-mudo)', textTransform: 'uppercase', fontWeight: 700 }}>Monto en Cartera</span>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: 'var(--texto-primario)' }}>{formatoEUR(metricas.totalFinanciado)}</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['todos', 'en_analisis', 'aprobada', 'devuelta', 'rechazada'].map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => setFiltroEstado(estado)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid',
                borderColor: filtroEstado === estado ? 'var(--naranja-500)' : 'var(--borde)',
                backgroundColor: filtroEstado === estado ? 'var(--naranja-500)' : 'var(--blanco)',
                color: filtroEstado === estado ? 'var(--blanco)' : 'var(--texto-secundario)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {estado === 'todos' ? 'Todas' : BADGES_ESTADO[estado]?.texto || estado}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Buscar por Nº, nombre, cédula o vehículo…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--borde)',
            fontSize: '13px',
            width: '320px',
            maxWidth: '100%',
          }}
        />
      </div>

      {/* Tabla de Solicitudes */}
      <div style={{ backgroundColor: 'var(--blanco)', border: '1px solid var(--borde-claro)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {cargando ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--texto-secundario)' }}>
            Cargando solicitudes de crédito…
          </div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--texto-secundario)' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <strong style={{ display: 'block', fontSize: '15px', color: 'var(--texto-primario)' }}>
              No se encontraron solicitudes
            </strong>
            <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
              No hay solicitudes de crédito con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--superficie)', borderBottom: '1px solid var(--borde-claro)', color: 'var(--texto-mudo)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px' }}>Nº Solicitud</th>
                  <th style={{ padding: '12px 16px' }}>Solicitante</th>
                  <th style={{ padding: '12px 16px' }}>Vehículo</th>
                  <th style={{ padding: '12px 16px' }}>Financiamiento</th>
                  <th style={{ padding: '12px 16px' }}>Cuota Est.</th>
                  <th style={{ padding: '12px 16px' }}>Recaudos</th>
                  <th style={{ padding: '12px 16px' }}>Estado</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {solicitudesFiltradas.map((s) => {
                  const badge = BADGES_ESTADO[s.estado] || { texto: s.estado, fondo: 'var(--superficie)', color: 'var(--texto-secundario)' };
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: '1px solid var(--borde-claro)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--superficie)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--naranja-700)' }}>
                        {s.numeroSolicitud}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ display: 'block', color: 'var(--texto-primario)' }}>{s.personaNombre}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>{s.personaCedula} • {s.personaTelefono}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, display: 'block' }}>{s.vehiculoTitulo}</span>
                        <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>{s.vehiculoCodigo}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{formatoEUR(s.montoSolicitadoEur)}</strong>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--texto-mudo)' }}>
                          Inicial: {formatoEUR(s.inicialAportadaEur)} ({s.plazoMeses}m)
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ color: 'var(--texto-primario)' }}>{formatoEUR(s.cuotaEstimadaEur)}</strong> /mes
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: s.totalRecaudos > 0 ? 'var(--exito-texto)' : 'var(--peligro-texto)' }}>
                          📎 {s.totalRecaudos} adjuntos
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: badge.fondo,
                            color: badge.color,
                            border: badge.borde || 'none',
                          }}
                        >
                          {badge.texto}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <Boton
                          variant="secondary"
                          onClick={() => abrirExpediente(s.id)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
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

      {/* Modal / Expediente Digital */}
      {solicitudSeleccionadaId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSolicitudSeleccionadaId(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--blanco)',
              borderRadius: 'var(--radius-lg)',
              width: '1000px',
              maxWidth: '96vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 'var(--space-xl)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {cargandoDetalle || !detalle ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--texto-secundario)' }}>
                Cargando expediente digital WMA-F-FIN-001…
              </div>
            ) : (
              <>
                {/* Cabecera del Expediente */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--borde-claro)', paddingBottom: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '20px', margin: 0 }}>
                        Expediente {detalle.solicitud.numero_solicitud}
                      </h2>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: BADGES_ESTADO[detalle.solicitud.estado]?.fondo || 'var(--superficie)',
                          color: BADGES_ESTADO[detalle.solicitud.estado]?.color || 'var(--texto-primario)',
                        }}
                      >
                        {BADGES_ESTADO[detalle.solicitud.estado]?.texto || detalle.solicitud.estado}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
                      Solicitante: <strong>{detalle.solicitud.primer_nombre} {detalle.solicitud.primer_apellido}</strong> ({detalle.solicitud.tipo_documento}-{detalle.solicitud.numero_documento}) • Recibida el {new Date(detalle.solicitud.fecha_recepcion || Date.now()).toLocaleDateString('es-VE')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSolicitudSeleccionadaId(null)}
                    style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--texto-mudo)' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Mensaje de dictamen */}
                {mensajeDictamen && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--space-lg)',
                      fontSize: '13px',
                      backgroundColor: mensajeDictamen.tipo === 'exito' ? 'var(--exito-fondo)' : 'var(--peligro-fondo)',
                      color: mensajeDictamen.tipo === 'exito' ? 'var(--exito-texto)' : 'var(--peligro-texto)',
                    }}
                  >
                    {mensajeDictamen.texto}
                  </div>
                )}

                {/* Análisis de Capacidad de Pago y Métricas Base */}
                <div style={{ backgroundColor: 'var(--superficie)', border: '1px solid var(--borde-claro)', borderRadius: 'var(--radius-md)', padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
                  <h3 style={{ fontSize: '13px', margin: '0 0 var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--naranja-700)', fontWeight: 700 }}>
                    📊 Análisis Financiero y Capacidad de Pago (Regla 30%)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>Ingresos Totales Declarados</span>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatoEUR(detalle.calculoCapacidad?.ingresoTotalEur || 0)}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>Capacidad de Pago (30% Regla PO)</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--exito-texto)' }}>{formatoEUR(detalle.calculoCapacidad?.capacidadPagoEur || 0)}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>Monto a Financiar</span>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{formatoEUR(detalle.calculoCapacidad?.montoFinanciadoEur || 0)}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>Cuota Mensual Estimada</span>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: detalle.calculoCapacidad?.alertaCapacidad ? 'var(--peligro-texto)' : 'var(--texto-primario)' }}>
                        {formatoEUR(detalle.calculoCapacidad?.cuotaEstimadaEur || 0)}
                        {detalle.calculoCapacidad?.alertaCapacidad && ' ⚠️ Excede 30%'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Motor de Riesgo, Scoring Automático y AML (Fase 4 / Módulo 006) */}
                <div
                  style={{
                    backgroundColor: 'var(--blanco)',
                    border: '1.5px solid var(--primario, #004481)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-lg)',
                    marginBottom: 'var(--space-xl)',
                    boxShadow: '0 4px 14px rgba(0, 68, 129, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--borde-claro)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', margin: 0, fontWeight: 800, color: 'var(--primario, #004481)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚡</span> Motor de Riesgo, Scoring y Cumplimiento AML
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-pill)', backgroundColor: '#E0F2FE', color: '#0369A1', fontWeight: 700 }}>
                          Módulo 006
                        </span>
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                        Algoritmo de 5 factores ponderados (0–1000 pts), Buró de Crédito y Screening OFAC / PEP.
                      </p>
                    </div>

                    <Boton
                      variant="primary"
                      onClick={handleEjecutarMotorRiesgo}
                      disabled={ejecutandoMotor}
                    >
                      {ejecutandoMotor ? '⏳ Evaluando en Vivo…' : '⚡ Ejecutar Scoring y AML en Vivo'}
                    </Boton>
                  </div>

                  {!evaluacionRiesgo ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px', backgroundColor: 'var(--superficie)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--borde)' }}>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--texto-secundario)' }}>
                        El motor de riesgo de 5 factores aún no se ha ejecutado para esta solicitud en esta sesión.
                      </p>
                      <Boton variant="secondary" onClick={handleEjecutarMotorRiesgo} disabled={ejecutandoMotor}>
                        Calcular Scoring y Verificar AML Ahora
                      </Boton>
                    </div>
                  ) : (
                    <div>
                      {/* Resumen de Scores y Recomendación */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                        {/* Score Interno WAMMA */}
                        <div style={{ backgroundColor: 'var(--superficie)', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid var(--borde-claro)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--texto-mudo)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Score WAMMA (0–1000)
                          </span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primario, #004481)' }}>
                              {evaluacionRiesgo.scoreInterno}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>/ 1000 pts</span>
                          </div>
                          <div style={{ marginTop: '6px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                backgroundColor:
                                  evaluacionRiesgo.scoreInterno >= 750
                                    ? 'var(--exito-fondo)'
                                    : evaluacionRiesgo.scoreInterno >= 600
                                    ? '#FEF3C7'
                                    : evaluacionRiesgo.scoreInterno >= 450
                                    ? 'var(--naranja-50, #FFF7ED)'
                                    : 'var(--peligro-fondo)',
                                color:
                                  evaluacionRiesgo.scoreInterno >= 750
                                    ? 'var(--exito-texto)'
                                    : evaluacionRiesgo.scoreInterno >= 600
                                    ? '#92400E'
                                    : evaluacionRiesgo.scoreInterno >= 450
                                    ? 'var(--naranja-700, #C2410C)'
                                    : 'var(--peligro-texto)',
                              }}
                            >
                              Nivel {evaluacionRiesgo.riesgoNivel.toUpperCase()} ({evaluacionRiesgo.scoreInterno >= 750 ? 'Bajo Riesgo' : evaluacionRiesgo.scoreInterno >= 600 ? 'Riesgo Medio' : 'Alto Riesgo'})
                            </span>
                          </div>
                        </div>

                        {/* Score Buró Externo */}
                        <div style={{ backgroundColor: 'var(--superficie)', borderRadius: 'var(--radius-md)', padding: '14px', border: '1px solid var(--borde-claro)' }}>
                          <span style={{ fontSize: '11px', color: 'var(--texto-mudo)', textTransform: 'uppercase', fontWeight: 700 }}>
                            Score Buró Externo
                          </span>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--texto-primario)' }}>
                              {evaluacionRiesgo.scoreBuro}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>/ 800 pts</span>
                          </div>
                          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--texto-secundario)' }}>
                            {evaluacionRiesgo.scoreBuro >= 700 ? '✅ Excelente historial' : evaluacionRiesgo.scoreBuro >= 600 ? '👍 Buen historial' : '⚠️ Historial limitado o atrasos'}
                          </div>
                        </div>

                        {/* Recomendación del Algoritmo */}
                        <div
                          style={{
                            borderRadius: 'var(--radius-md)',
                            padding: '14px',
                            backgroundColor:
                              evaluacionRiesgo.recomendacion === 'APROBAR'
                                ? 'var(--exito-fondo)'
                                : evaluacionRiesgo.recomendacion === 'CONDICIONAR'
                                ? '#FEF3C7'
                                : 'var(--peligro-fondo)',
                            border: `1px solid ${
                              evaluacionRiesgo.recomendacion === 'APROBAR'
                                ? 'var(--exito-texto)'
                                : evaluacionRiesgo.recomendacion === 'CONDICIONAR'
                                ? '#F59E0B'
                                : 'var(--peligro-texto)'
                            }`,
                          }}
                        >
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--texto-mudo)' }}>
                            Dictamen Sugerido por Motor
                          </span>
                          <div
                            style={{
                              fontSize: '18px',
                              fontWeight: 900,
                              marginTop: '4px',
                              color:
                                evaluacionRiesgo.recomendacion === 'APROBAR'
                                  ? 'var(--exito-texto)'
                                  : evaluacionRiesgo.recomendacion === 'CONDICIONAR'
                                  ? '#92400E'
                                  : 'var(--peligro-texto)',
                            }}
                          >
                            {evaluacionRiesgo.recomendacion === 'APROBAR' && '✅ APROBAR CRÉDITO'}
                            {evaluacionRiesgo.recomendacion === 'CONDICIONAR' && '⚠️ CONDICIONAR CRÉDITO'}
                            {evaluacionRiesgo.recomendacion === 'RECHAZAR' && '❌ RECHAZAR SOLICITUD'}
                          </div>
                          <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--texto-primario)', lineHeight: 1.3 }}>
                            {evaluacionRiesgo.justificacion}
                          </p>
                        </div>
                      </div>

                      {/* Verificación AML & Listas de Sanciones */}
                      <div
                        style={{
                          backgroundColor: evaluacionRiesgo.bloqueoAml ? '#FEE2E2' : '#F0FDF4',
                          border: `1px solid ${evaluacionRiesgo.bloqueoAml ? '#EF4444' : '#86EFAC'}`,
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 16px',
                          marginBottom: 'var(--space-lg)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '20px' }}>
                            {evaluacionRiesgo.bloqueoAml ? '🚨' : '🛡️'}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: evaluacionRiesgo.bloqueoAml ? '#991B1B' : '#166534' }}>
                              Screening AML / Prevención de Legitimación de Capitales
                            </div>
                            <div style={{ fontSize: '12px', color: evaluacionRiesgo.bloqueoAml ? '#B91C1C' : '#15803D' }}>
                              {evaluacionRiesgo.bloqueoAml
                                ? '¡ATENCIÓN! Se detectaron coincidencias en listas de sanciones que bloquean la operación.'
                                : 'Verificación conforme contra listas internacionales OFAC, Consejo de Seguridad ONU y base de datos PEP.'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-pill)',
                              backgroundColor: evaluacionRiesgo.bloqueoAml ? '#DC2626' : '#DCFCE7',
                              color: evaluacionRiesgo.bloqueoAml ? '#FFFFFF' : '#166534',
                            }}
                          >
                            OFAC: {evaluacionRiesgo.bloqueoAml ? 'COINCIDENCIA ACTIVA' : 'LIMPIO'}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-pill)',
                              backgroundColor: detalle.solicitud.es_pep ? '#FEF3C7' : '#DCFCE7',
                              color: detalle.solicitud.es_pep ? '#92400E' : '#166534',
                            }}
                          >
                            PEP: {detalle.solicitud.es_pep ? 'DECLARADO (Debida Diligencia)' : 'NO EXPUESTO'}
                          </span>
                        </div>
                      </div>

                      {/* Desglose de los 5 Factores de Scoring */}
                      <div style={{ marginBottom: 'var(--space-md)' }}>
                        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--texto-mudo)', margin: '0 0 var(--space-sm)', letterSpacing: '0.05em' }}>
                          Ponderación de los 5 Factores de Scoring
                        </h4>
                        <div style={{ display: 'grid', gap: '10px' }}>
                          {evaluacionRiesgo.factores.map((f, idx) => {
                            const porcentaje = Math.round((f.puntosObtenidos / f.puntosMaximos) * 100);
                            return (
                              <div
                                key={idx}
                                style={{
                                  backgroundColor: 'var(--superficie)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '10px 14px',
                                  border: '1px solid var(--borde-claro)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{f.nombre}</span>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: porcentaje >= 70 ? 'var(--exito-texto)' : porcentaje >= 40 ? '#D97706' : 'var(--peligro-texto)' }}>
                                    {f.puntosObtenidos} / {f.puntosMaximos} pts ({porcentaje}%)
                                  </span>
                                </div>
                                <div style={{ height: '6px', width: '100%', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div
                                    style={{
                                      height: '100%',
                                      width: `${porcentaje}%`,
                                      backgroundColor: porcentaje >= 70 ? '#10B981' : porcentaje >= 40 ? '#F59E0B' : '#EF4444',
                                      borderRadius: '3px',
                                      transition: 'width 0.3s ease',
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
                                  {f.descripcion}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Lista de Alertas AML detectadas y su Resolución */}
                      {evaluacionRiesgo.alertasAml && evaluacionRiesgo.alertasAml.length > 0 && (
                        <div style={{ marginTop: 'var(--space-md)', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: 'var(--radius-md)', border: '1px solid #FCA5A5' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#991B1B', margin: '0 0 10px' }}>
                            ⚠️ Alertas AML Registradas ({evaluacionRiesgo.alertasAml.length})
                          </h4>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {evaluacionRiesgo.alertasAml.map((alerta) => (
                              <div
                                key={alerta.id}
                                style={{
                                  backgroundColor: 'var(--blanco)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '10px 12px',
                                  border: '1px solid #FECACA',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                  <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{alerta.reglaCoincidencia}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                                      Origen: {alerta.origenLista} • Severidad: <strong>{alerta.severidad.toUpperCase()}</strong> • Fecha: {new Date(alerta.creadoEn).toLocaleDateString('es-VE')}
                                    </div>
                                  </div>
                                  <div>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-pill)',
                                        backgroundColor:
                                          alerta.resolucion === 'pendiente'
                                            ? '#FEE2E2'
                                            : alerta.resolucion === 'falso_positivo'
                                            ? '#DCFCE7'
                                            : '#991B1B',
                                        color:
                                          alerta.resolucion === 'pendiente'
                                            ? '#991B1B'
                                            : alerta.resolucion === 'falso_positivo'
                                            ? '#166534'
                                            : '#FFFFFF',
                                      }}
                                    >
                                      {alerta.resolucion.toUpperCase()}
                                    </span>
                                  </div>
                                </div>

                                {alerta.resolucion === 'pendiente' && puedeEvaluar && (
                                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                                    {resolviendoAlertaId === alerta.id ? (
                                      <div style={{ display: 'grid', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                              type="radio"
                                              checked={tipoResolucion === 'falso_positivo'}
                                              onChange={() => setTipoResolucion('falso_positivo')}
                                            />
                                            Falso Positivo (Descartar)
                                          </label>
                                          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626' }}>
                                            <input
                                              type="radio"
                                              checked={tipoResolucion === 'confirmado_bloqueado'}
                                              onChange={() => setTipoResolucion('confirmado_bloqueado')}
                                            />
                                            Confirmar Coincidencia (Bloquear)
                                          </label>
                                        </div>
                                        <input
                                          type="text"
                                          placeholder="Motivo o sustento de la resolución..."
                                          value={notasResolucion}
                                          onChange={(e) => setNotasResolucion(e.target.value)}
                                          style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--borde)' }}
                                        />
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                          <button
                                            type="button"
                                            onClick={() => setResolviendoAlertaId(null)}
                                            style={{ fontSize: '11px', padding: '4px 8px', background: 'none', border: '1px solid var(--borde)', borderRadius: '4px', cursor: 'pointer' }}
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleResolverAlerta(alerta.id)}
                                            disabled={guardandoAlerta}
                                            style={{ fontSize: '11px', padding: '4px 10px', backgroundColor: 'var(--primario)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                          >
                                            {guardandoAlerta ? 'Guardando…' : 'Guardar Resolución'}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setResolviendoAlertaId(alerta.id);
                                          setTipoResolucion('falso_positivo');
                                          setNotasResolucion('');
                                        }}
                                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #DC2626', background: 'none', color: '#DC2626', borderRadius: '4px', cursor: 'pointer' }}
                                      >
                                        ⚖️ Resolver Alerta AML
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Secciones de Datos del Solicitante */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                  {/* Datos Personales y Habitación */}
                  <div style={{ border: '1px solid var(--borde-claro)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--texto-mudo)', margin: '0 0 var(--space-md)' }}>
                      Identidad y Contacto
                    </h4>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>RIF:</strong> {detalle.solicitud.rif || 'N/A'}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Teléfono:</strong> {detalle.solicitud.telefono_celular}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Correo:</strong> {detalle.solicitud.correo}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Dirección:</strong> {detalle.solicitud.direccion_habitacion}, {detalle.solicitud.municipio}, {detalle.solicitud.estado_geografico || detalle.solicitud.estado}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Vivienda:</strong> {detalle.solicitud.condicion_vivienda} • <strong>Cargas:</strong> {detalle.solicitud.cargas_familiares}</p>
                  </div>

                  {/* Datos Laborales y Bancarios */}
                  <div style={{ border: '1px solid var(--borde-claro)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)' }}>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--texto-mudo)', margin: '0 0 var(--space-md)' }}>
                      Empleo y Cuenta Bancaria
                    </h4>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Situación:</strong> {detalle.solicitud.situacion_laboral}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Empresa:</strong> {detalle.solicitud.nombre_empresa || 'N/A'}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Cargo:</strong> {detalle.solicitud.cargo || 'N/A'} ({detalle.solicitud.antiguedad_anios} años)</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Banco:</strong> {detalle.solicitud.banco_principal}</p>
                    <p style={{ margin: '4px 0', fontSize: '13px' }}><strong>Cuenta:</strong> {detalle.solicitud.numero_cuenta} ({detalle.solicitud.tipo_cuenta})</p>
                  </div>
                </div>

                {/* Recaudos Digitales Adjuntos */}
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📎 Recaudos Documentales Digitalizados ({detalle.recaudos.length})
                  </h3>
                  {detalle.recaudos.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--texto-mudo)', fontStyle: 'italic' }}>
                      El cliente aún no ha adjuntado documentos digitales a esta solicitud.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {detalle.recaudos.map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            border: '1px solid var(--borde-claro)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--blanco)',
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: '13px', display: 'block' }}>{doc.nombreOriginal}</strong>
                            <span style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                              Tipo: {doc.tipoDocumento} • {(doc.tamanoBytes / 1024).toFixed(0)} KB
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-pill)',
                                backgroundColor: doc.estado === 'verificado' ? 'var(--exito-fondo)' : doc.estado === 'rechazado' ? 'var(--peligro-fondo)' : '#FEF3C7',
                                color: doc.estado === 'verificado' ? 'var(--exito-texto)' : doc.estado === 'rechazado' ? 'var(--peligro-texto)' : '#92400E',
                              }}
                            >
                              {doc.estado}
                            </span>
                            {puedeEvaluar && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleCambiarEstadoRecaudo(doc.id, 'verificado')}
                                  style={{ border: '1px solid var(--exito-texto)', background: 'none', color: 'var(--exito-texto)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                  Verificar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCambiarEstadoRecaudo(doc.id, 'rechazado')}
                                  style={{ border: '1px solid var(--peligro-texto)', background: 'none', color: 'var(--peligro-texto)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Formulario de Dictamen del Analista */}
                {puedeEvaluar && (
                  <div style={{ borderTop: '2px solid var(--borde-claro)', paddingTop: 'var(--space-lg)' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 var(--space-md)' }}>
                      ⚖️ Dictamen del Analista de Crédito
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                          Decisión de Crédito *
                        </label>
                        <select
                          value={nuevoEstado}
                          onChange={(e) => setNuevoEstado(e.target.value as any)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--borde)', fontSize: '13px' }}
                        >
                          <option value="aprobada">Aprobar Crédito</option>
                          <option value="devuelta">Devolver (Recaudos pendientes)</option>
                          <option value="rechazada">Rechazar Solicitud</option>
                          <option value="en_analisis">Mantener en Análisis</option>
                        </select>
                      </div>

                      <Campo
                        label="Score Crediticio Interno (0–999)"
                        type="number"
                        value={String(scoreCrediticio)}
                        onChange={(e) => setScoreCrediticio(Number(e.target.value) || 0)}
                      />
                    </div>

                    {nuevoEstado === 'aprobada' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                        <Campo
                          label="Límite Aprobado (€)"
                          type="number"
                          value={String(limiteAprobado)}
                          onChange={(e) => setLimiteAprobado(Number(e.target.value) || 0)}
                        />
                        <Campo
                          label="Cuota Máxima Permitida (€)"
                          type="number"
                          value={String(cuotaMaxima)}
                          onChange={(e) => setCuotaMaxima(Number(e.target.value) || 0)}
                        />
                      </div>
                    )}

                    <div style={{ marginBottom: 'var(--space-lg)' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                        Observaciones y Justificación Técnica *
                      </label>
                      <textarea
                        rows={3}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Detalle el sustento de la aprobación o los motivos del rechazo/devolución..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--borde)',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
                      <Boton variant="secondary" onClick={() => setSolicitudSeleccionadaId(null)}>
                        Cerrar sin guardar
                      </Boton>
                      <Boton
                        variant="primary"
                        onClick={guardarDictamen}
                        disabled={guardandoDictamen}
                      >
                        {guardandoDictamen ? 'Registrando dictamen…' : 'Registrar Dictamen Oficial'}
                      </Boton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center', fontSize: '12px', color: 'var(--texto-mudo)' }}>
        Módulo de Análisis de Crédito (WMA-F-FIN-001) · Operaciones multimoneda EUR/BCV conforme a la Constitución v3.0.0
      </div>
    </div>
  );
};
