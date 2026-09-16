import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCRM, CORREO_NOTIFICACIONES_WAMMA } from '../../state/crmContexto';
import { useVehiculos } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';
import { correoConfirmacionCita } from '../../components/crm/correoCita';
import { fechaHora } from '../../components/crm/formato';
import type { Cita, MotivoPerdida } from '../../types/crm';
import {
  MOTIVOS_PERDIDA,
  definicionEtapa,
  estaEstancada,
  rutaSolicitudFinanciamiento,
  telefonoParaWhatsApp,
} from '../../types/crm';
import { validarCedula, validarCorreo } from '../../validacion/venezuela';

/**
 * O3 · Bandeja de citas y solicitudes de visita.
 *
 * Aquí ocurre el **segundo paso de la captura** (`spec.md` §8.5): la cédula no
 * se pide en el catálogo, se pide al confirmar. Confirmar sin cédula no es
 * posible, y al llegar consolida o fusiona la persona (`plan.md` §5.1). Si hay
 * correo, confirmar abre el correo del asesor con la confirmación ya redactada.
 *
 * Después de la visita: «Asistió» y «Vender Vehículo» (`spec.md` §8.8). De
 * contado cierra la venta; financiado emite el enlace personal de solicitud.
 */

type TipoAccion = 'confirmar' | 'descartar' | 'interaccion' | 'vender';
type AccionAbierta = { citaId: string; tipo: TipoAccion } | null;
type Aviso = { texto: string; mailto?: string; tono?: 'exito' | 'alerta' } | null;
type Modalidad = 'Contado' | 'Financiamiento';

export const O3_GestionCitas: React.FC = () => {
  const {
    citas,
    obtenerPersona,
    obtenerOportunidad,
    ultimaActividad,
    confirmarCita,
    descartarCita,
    registrarInteraccion,
    cambiarEtapa,
    venderVehiculo,
  } = useCRM();
  const { obtenerVehiculo } = useVehiculos();

  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'confirmada' | 'descartada'>('todas');
  const [accion, setAccion] = useState<AccionAbierta>(null);
  const [aviso, setAviso] = useState<Aviso>(null);

  // Borradores de los formularios en línea.
  const [cedula, setCedula] = useState('');
  const [correo, setCorreo] = useState('');
  const [dia, setDia] = useState('');
  const [franja, setFranja] = useState<Cita['franjaHoraria']>('Mañana');
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerdida>('dejo_de_responder');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [nota, setNota] = useState('');
  const [modalidadVenta, setModalidadVenta] = useState<Modalidad>('Contado');
  const [copiado, setCopiado] = useState<string | null>(null);

  const citasFiltradas = citas.filter((c) => (filtro === 'todas' ? true : c.estado === filtro));

  const cerrarAccion = () => {
    setAccion(null);
    setCedula('');
    setCorreo('');
    setErrorConfirmar(null);
    setMotivoTexto('');
    setNota('');
  };

  const abrirConfirmar = (cita: Cita, correoConocido?: string) => {
    cerrarAccion();
    setAccion({ citaId: cita.id, tipo: 'confirmar' });
    setCorreo(correoConocido ?? '');
    setDia(cita.diaPreferencia);
    setFranja(cita.franjaHoraria);
  };

  const abrirVender = (citaId: string, modalidad: Modalidad) => {
    cerrarAccion();
    setAccion({ citaId, tipo: 'vender' });
    setModalidadVenta(modalidad);
  };

  const enlaceWhatsApp = (telefono: string, texto: string) =>
    `https://wa.me/${telefonoParaWhatsApp(telefono)}?text=${encodeURIComponent(texto)}`;

  const urlSolicitud = (vehiculoId: string, token: string) =>
    `${window.location.origin}${rutaSolicitudFinanciamiento(vehiculoId, token)}`;

  const alConfirmar = (cita: Cita) => {
    const persona = obtenerPersona(cita.personaId);
    const oportunidad = obtenerOportunidad(cita.oportunidadId);
    if (!persona || !oportunidad) return;

    const errorCedula = validarCedula(cedula);
    if (errorCedula) {
      setErrorConfirmar(errorCedula);
      return;
    }
    const correoLimpio = correo.trim();
    if (correoLimpio) {
      const errorCorreo = validarCorreo(correoLimpio);
      if (errorCorreo) {
        setErrorConfirmar(errorCorreo);
        return;
      }
    }
    if (!dia) {
      setErrorConfirmar('Indica el día acordado con el cliente.');
      return;
    }

    const resultado = confirmarCita(cita.id, cedula, { correo: correoLimpio || undefined, dia, franja });
    if (!resultado.ok) {
      setErrorConfirmar(resultado.error ?? 'No se pudo confirmar la cita.');
      return;
    }

    const base = resultado.fusionada
      ? 'Cita confirmada. Esta cédula ya existía en otro registro: los dos se fusionaron en una sola persona, con su historial unificado y todos sus teléfonos conservados. WhatsApp usará el más reciente.'
      : 'Cita confirmada. La cédula quedó asociada a la persona.';

    const correoDestino = correoLimpio || persona.correo;
    const mensaje = correoDestino
      ? correoConfirmacionCita(
          { ...persona, correo: correoDestino },
          oportunidad,
          { ...cita, diaPreferencia: dia, franjaHoraria: franja },
          obtenerVehiculo(cita.vehiculoId)?.sede,
        )
      : null;

    cerrarAccion();
    if (mensaje) {
      setAviso({
        texto: `${base} Se abrió tu correo con la confirmación para ${mensaje.para}: revísala y envíala.`,
        mailto: mensaje.mailto,
      });
      // Decisión del PO: el correo sale del programa de correo del asesor.
      window.location.assign(mensaje.mailto);
    } else {
      setAviso({ texto: `${base} El cliente no dejó correo: confírmale la cita por WhatsApp.`, tono: 'alerta' });
    }
  };

  const alDescartar = (citaId: string) => {
    const exigeTexto = MOTIVOS_PERDIDA.find((m) => m.codigo === motivo)?.exigeTexto;
    if (exigeTexto && !motivoTexto.trim()) return;

    descartarCita(citaId, motivo, motivoTexto.trim() || undefined);
    setAviso({ texto: 'Cita descartada. La oportunidad quedó cerrada como perdida con su motivo.' });
    cerrarAccion();
  };

  const alRegistrarInteraccion = (personaId: string, oportunidadId: string) => {
    if (!nota.trim()) return;
    registrarInteraccion({ personaId, oportunidadId, canal: 'whatsapp', direccion: 'saliente', nota });
    setAviso({ texto: 'Interacción registrada en el historial de la persona.' });
    cerrarAccion();
  };

  const alMarcarAsistencia = (oportunidadId: string) => {
    const resultado = cambiarEtapa(oportunidadId, 'visito', { nota: 'El cliente asistió a la cita.' });
    setAviso(
      resultado.ok
        ? { texto: 'Asistencia registrada. Ya puedes cerrar la venta con «Vender Vehículo».' }
        : { texto: resultado.error ?? 'No se pudo registrar la asistencia.', tono: 'alerta' },
    );
  };

  const alVender = (oportunidadId: string) => {
    const resultado = venderVehiculo(oportunidadId, modalidadVenta);
    if (!resultado.ok) {
      setAviso({ texto: resultado.error ?? 'No se pudo registrar la venta.', tono: 'alerta' });
      return;
    }
    setAviso({
      texto:
        modalidadVenta === 'Contado'
          ? 'Venta de contado cerrada. El vehículo pasó a Vendido y salió del catálogo.'
          : 'Venta acordada con financiamiento. Envía al cliente su enlace personal para que solicite el crédito.',
    });
    cerrarAccion();
  };

  const copiar = async (texto: string, clave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setAviso({ texto: 'No se pudo copiar automáticamente: selecciona el enlace y cópialo a mano.', tono: 'alerta' });
    }
  };

  return (
    <div>
      <div className="citas-header">
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 700 }}>
            Citas y Solicitudes de Visita
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
            Bandeja de citas agendadas por clientes en la web. Notificaciones despachadas a{' '}
            <strong>{CORREO_NOTIFICACIONES_WAMMA}</strong> para seguimiento vía WhatsApp.
          </p>
        </div>

        <div className="filtro-citas">
          {(['todas', 'pendiente', 'confirmada', 'descartada'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn-citas-tab ${filtro === f ? 'activo' : ''}`}
              onClick={() => setFiltro(f)}
            >
              {f === 'todas' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1) + 's'} (
              {f === 'todas' ? citas.length : citas.filter((c) => c.estado === f).length})
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <div className={`aviso-crm ${aviso.tono === 'alerta' ? 'aviso-crm-alerta' : ''}`} role="status">
          <span>
            {aviso.texto}
            {aviso.mailto && (
              <>
                {' '}
                <a href={aviso.mailto} className="aviso-enlace">
                  Abrir de nuevo el correo
                </a>
              </>
            )}
          </span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      {citasFiltradas.length === 0 ? (
        <div className="caja-vacia-citas">
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
          <h3 style={{ fontSize: '16px', margin: 0 }}>No hay citas con este estado</h3>
          <p style={{ fontSize: '13px', color: 'var(--texto-mudo)', marginTop: '4px' }}>
            Cuando un cliente presione "Agendar cita" en el catálogo público, aparecerá listado aquí inmediatamente.
          </p>
        </div>
      ) : (
        <div className="grid-citas">
          {citasFiltradas.map((cita) => {
            const persona = obtenerPersona(cita.personaId);
            const oportunidad = obtenerOportunidad(cita.oportunidadId);
            if (!persona || !oportunidad) return null;

            const vRes = oportunidad.vehiculoResumen;
            const vehiculoTitulo = `${vRes.marca} ${vRes.modelo} ${vRes.version} (${vRes.anio})`;
            const primerNombre = persona.nombreApellido.split(' ')[0] || persona.nombreApellido;
            const etapa = definicionEtapa(oportunidad.etapa);
            // La etiqueta de etapa solo aparece cuando dice algo que el estado de
            // la cita no dice ya ("Cita confirmada" junto a "✓ Cita Confirmada").
            const etapaRepite =
              (cita.estado === 'pendiente' && oportunidad.etapa === 'nuevo') ||
              (cita.estado === 'confirmada' && oportunidad.etapa === 'cita_confirmada') ||
              (cita.estado === 'descartada' && oportunidad.etapa === 'cerrado_perdido');
            const estancada = estaEstancada(oportunidad, ultimaActividad(oportunidad.id));
            const abierta = accion?.citaId === cita.id ? accion.tipo : null;

            const vendida = oportunidad.etapa === 'cerrado_ganado';
            const puedeAsistir = cita.estado === 'confirmada' && oportunidad.etapa === 'cita_confirmada';
            const puedeVender =
              cita.estado === 'confirmada' &&
              (oportunidad.etapa === 'visito' ||
                (oportunidad.etapa === 'negociacion' && !oportunidad.enlaceFinanciamiento));
            const enlace = oportunidad.enlaceFinanciamiento
              ? urlSolicitud(oportunidad.vehiculoId, oportunidad.enlaceFinanciamiento.token)
              : null;

            return (
              <div key={cita.id} className={`tarjeta-cita ${cita.estado}`}>
                <div className="cita-top">
                  <div>
                    <span className={`badge-estado-cita ${cita.estado}`}>
                      {cita.estado === 'pendiente'
                        ? '⏳ Pendiente por Confirmar'
                        : cita.estado === 'confirmada'
                          ? '✓ Cita Confirmada'
                          : '✕ Descartada / Auto Liberado'}
                    </span>
                    {!etapaRepite && <span className="badge-etapa">{etapa.nombre}</span>}
                    {estancada && <span className="badge-estancada">⚠ Estancada</span>}
                    <span style={{ fontSize: '11px', color: 'var(--texto-mudo)', marginLeft: '8px' }}>
                      Solicitada:{' '}
                      {new Date(cita.fechaCreacion).toLocaleDateString('es-VE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                    ID: <code>{cita.id}</code>
                  </div>
                </div>

                <div className="cita-cuerpo">
                  <div className="bloque-info-cliente">
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>
                      <Link
                        to={`/admin/personas/${persona.id}`}
                        className="enlace-persona"
                        title="Ver la ficha de la persona"
                      >
                        {persona.nombreApellido}
                      </Link>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                      {persona.cedula ? (
                        <>
                          Cédula: <strong>{persona.cedula}</strong>
                        </>
                      ) : (
                        <em>Sin cédula — se solicita al confirmar la cita</em>
                      )}
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '13px' }}>
                      <div>
                        📱 WhatsApp: <strong>{persona.telefonoWhatsApp}</strong>
                      </div>
                      {persona.telefonosAdicionales && persona.telefonosAdicionales.length > 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
                          También: {persona.telefonosAdicionales.join(' · ')}
                        </div>
                      )}
                      {persona.correo && (
                        <div>
                          ✉️ Correo: <strong>{persona.correo}</strong>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--naranja-700)' }}>
                      Modalidad de compra:{' '}
                      <strong>
                        {oportunidad.modalidadPago === 'Financiamiento'
                          ? '💳 Financiamiento WAMMA'
                          : '💵 Pago de Contado'}
                      </strong>
                    </div>
                  </div>

                  <div className="bloque-info-vehiculo">
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--texto-mudo)', fontWeight: 700 }}>
                      Vehículo Solicitado
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>{vehiculoTitulo}</div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--naranja-600)' }}>
                      {vRes.precioUSD.toLocaleString('es-VE')} €
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', background: 'var(--superficie)', padding: '6px 10px', borderRadius: '4px' }}>
                      📅 <strong>{cita.estado === 'confirmada' ? 'Visita acordada:' : 'Preferencia de visita:'}</strong>{' '}
                      {cita.diaPreferencia} ({cita.franjaHoraria})
                    </div>
                    {oportunidad.motivoPerdida && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--peligro-texto)' }}>
                        <strong>Motivo de pérdida:</strong>{' '}
                        {MOTIVOS_PERDIDA.find((m) => m.codigo === oportunidad.motivoPerdida)?.nombre}
                        {oportunidad.motivoPerdidaTexto ? ` — ${oportunidad.motivoPerdidaTexto}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {enlace && oportunidad.enlaceFinanciamiento && (
                  <div className="bloque-financiamiento">
                    <div className="bf-titulo">
                      💳 Financiamiento habilitado · enlace emitido el {fechaHora(oportunidad.enlaceFinanciamiento.emitidoEn)}
                    </div>
                    <code className="bf-enlace">{enlace}</code>
                    <div className="bf-acciones">
                      <button type="button" className="btn-secundario-crm" onClick={() => copiar(enlace, oportunidad.id)}>
                        {copiado === oportunidad.id ? '✓ Copiado' : '📋 Copiar enlace'}
                      </button>
                      <a
                        className="btn-whatsapp"
                        href={enlaceWhatsApp(
                          persona.telefonoWhatsApp,
                          `¡Hola ${primerNombre}! Gracias por tu visita a WAMMA. Este es tu enlace personal para solicitar el financiamiento del ${vehiculoTitulo}: ${enlace}`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        💬 Enviar por WhatsApp
                      </a>
                      {persona.correo && (
                        <a
                          className="btn-secundario-crm"
                          href={`mailto:${persona.correo}?subject=${encodeURIComponent(
                            'WAMMA · Tu enlace para solicitar el financiamiento',
                          )}&body=${encodeURIComponent(
                            `Hola, ${primerNombre}:\n\nGracias por tu visita. Con este enlace personal completas desde tu teléfono la solicitud de crédito del ${vehiculoTitulo}:\n\n${enlace}\n\nEl enlace es solo para ti; no lo compartas.\n\nEquipo comercial WAMMA\nby Token Pago POS`,
                          )}`}
                        >
                          ✉️ Enviar por correo
                        </a>
                      )}
                    </div>
                    <div className="ayuda-inline">
                      Cuando se apruebe el crédito, cierra la venta desde el{' '}
                      <Link to="/admin/embudo">Embudo comercial</Link>.
                    </div>
                  </div>
                )}

                <div className="cita-notificacion-meta">
                  📧 Notificación despachada a: <code>{cita.notificadoA}</code>
                </div>

                {/* Formularios en línea: el mínimo de campos obligatorios (plan §7.4). */}
                {abierta === 'confirmar' && (
                  <div className="form-inline-crm">
                    <div className="fila-campos">
                      <div className="campo-crm">
                        <label htmlFor={`ced-${cita.id}`}>
                          Cédula del cliente <span className="req">*</span>
                        </label>
                        <input
                          id={`ced-${cita.id}`}
                          type="text"
                          placeholder="V-12345678"
                          value={cedula}
                          onChange={(e) => {
                            setCedula(e.target.value);
                            setErrorConfirmar(null);
                          }}
                          className={errorConfirmar ? 'input-error' : ''}
                          autoFocus
                        />
                      </div>
                      <div className="campo-crm">
                        <label htmlFor={`cor-${cita.id}`}>Correo del cliente</label>
                        <input
                          id={`cor-${cita.id}`}
                          type="email"
                          placeholder="Para enviarle la confirmación"
                          value={correo}
                          onChange={(e) => {
                            setCorreo(e.target.value);
                            setErrorConfirmar(null);
                          }}
                        />
                      </div>
                      <div className="campo-crm">
                        <label htmlFor={`dia-${cita.id}`}>Día acordado</label>
                        <input id={`dia-${cita.id}`} type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
                      </div>
                      <div className="campo-crm">
                        <label htmlFor={`fra-${cita.id}`}>Horario</label>
                        <select
                          id={`fra-${cita.id}`}
                          value={franja}
                          onChange={(e) => setFranja(e.target.value as Cita['franjaHoraria'])}
                        >
                          <option value="Mañana">Mañana (9:00 AM - 1:00 PM)</option>
                          <option value="Tarde">Tarde (2:00 PM - 5:00 PM)</option>
                        </select>
                      </div>
                    </div>
                    {errorConfirmar && <span className="error-texto">{errorConfirmar}</span>}
                    <span className="ayuda-inline">
                      Día y horario vienen de lo que pidió el cliente: cámbialos si acordaron otra cosa. Si hay correo,
                      al confirmar se abre tu correo con la confirmación lista para enviar.
                    </span>
                    <div className="form-inline-acciones">
                      <Boton variant="primary" size="small" onClick={() => alConfirmar(cita)}>
                        Confirmar cita
                      </Boton>
                      <button type="button" className="btn-descartar" onClick={cerrarAccion}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {abierta === 'descartar' && (
                  <div className="form-inline-crm">
                    <label htmlFor={`mot-${cita.id}`}>
                      Motivo de pérdida <span className="req">*</span>
                    </label>
                    <select
                      id={`mot-${cita.id}`}
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value as MotivoPerdida)}
                      autoFocus
                    >
                      {MOTIVOS_PERDIDA.map((m) => (
                        <option key={m.codigo} value={m.codigo}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                    {MOTIVOS_PERDIDA.find((m) => m.codigo === motivo)?.exigeTexto && (
                      <input
                        type="text"
                        placeholder="Describe el motivo"
                        value={motivoTexto}
                        onChange={(e) => setMotivoTexto(e.target.value)}
                      />
                    )}
                    <div className="form-inline-acciones">
                      <Boton variant="primary" size="small" onClick={() => alDescartar(cita.id)}>
                        Descartar y liberar auto
                      </Boton>
                      <button type="button" className="btn-descartar" onClick={cerrarAccion}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {abierta === 'interaccion' && (
                  <div className="form-inline-crm">
                    <label htmlFor={`nota-${cita.id}`}>
                      ¿Qué hablaron? <span className="req">*</span>
                    </label>
                    <input
                      id={`nota-${cita.id}`}
                      type="text"
                      placeholder="Ej. Confirmó que viene el sábado en la mañana"
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      autoFocus
                    />
                    <span className="ayuda-inline">Canal WhatsApp, saliente y fecha de hoy se registran solos.</span>
                    <div className="form-inline-acciones">
                      <Boton
                        variant="primary"
                        size="small"
                        onClick={() => alRegistrarInteraccion(persona.id, oportunidad.id)}
                      >
                        Guardar nota
                      </Boton>
                      <button type="button" className="btn-descartar" onClick={cerrarAccion}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {abierta === 'vender' && (
                  <div className="form-inline-crm">
                    <span className="etiqueta-crm">
                      ¿Cómo paga el cliente? <span className="req">*</span>
                    </span>
                    <div className="opciones-pago" role="radiogroup" aria-label="Forma de pago">
                      {(['Contado', 'Financiamiento'] as const).map((m) => (
                        <label key={m} className="opcion-pago">
                          <input
                            type="radio"
                            name={`pago-${cita.id}`}
                            value={m}
                            checked={modalidadVenta === m}
                            onChange={() => setModalidadVenta(m)}
                          />
                          {m === 'Contado' ? 'Contado' : 'Financiamiento WAMMA'}
                        </label>
                      ))}
                    </div>
                    <span className="ayuda-inline">
                      {modalidadVenta === 'Contado'
                        ? 'Se cerrará la venta y el vehículo pasará a Vendido: saldrá del catálogo.'
                        : 'Se emitirá un enlace personal para que el cliente complete la solicitud de crédito desde su teléfono. El vehículo sigue reservado hasta que se apruebe.'}
                    </span>
                    <div className="form-inline-acciones">
                      <Boton variant="primary" size="small" onClick={() => alVender(oportunidad.id)}>
                        {modalidadVenta === 'Contado' ? 'Cerrar venta de contado' : 'Emitir enlace de financiamiento'}
                      </Boton>
                      <button type="button" className="btn-descartar" onClick={cerrarAccion}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="cita-acciones">
                  <a
                    href={enlaceWhatsApp(
                      persona.telefonoWhatsApp,
                      `¡Hola ${persona.nombreApellido}! Te contactamos del equipo comercial de WAMMA respecto a tu solicitud de cita para ver el vehículo ${vehiculoTitulo} (preferencia: ${cita.diaPreferencia}, turno ${cita.franjaHoraria.toLowerCase()}). Queremos coordinar la hora exacta de tu visita a nuestra sede.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-whatsapp"
                    onClick={() => setAccion({ citaId: cita.id, tipo: 'interaccion' })}
                  >
                    💬 Contactar por WhatsApp
                  </a>

                  {!abierta && cita.estado === 'pendiente' && (
                    <>
                      <Boton variant="primary" size="small" onClick={() => abrirConfirmar(cita, persona.correo)}>
                        ✓ Confirmar Cita
                      </Boton>
                      <button
                        type="button"
                        className="btn-descartar"
                        onClick={() => setAccion({ citaId: cita.id, tipo: 'descartar' })}
                      >
                        ✕ Descartar y Liberar Auto
                      </button>
                    </>
                  )}

                  {!abierta && puedeAsistir && (
                    <Boton variant="primary" size="small" onClick={() => alMarcarAsistencia(oportunidad.id)}>
                      ✓ Asistió a la cita
                    </Boton>
                  )}

                  {!abierta && puedeVender && (
                    <Boton
                      variant="primary"
                      size="small"
                      onClick={() => abrirVender(cita.id, oportunidad.modalidadPago)}
                    >
                      💰 Vender Vehículo
                    </Boton>
                  )}

                  {!abierta && cita.estado === 'confirmada' && !vendida && (
                    <button
                      type="button"
                      className="btn-descartar"
                      onClick={() => setAccion({ citaId: cita.id, tipo: 'descartar' })}
                    >
                      Liberar Vehículo
                    </button>
                  )}

                  {vendida && <span className="cita-vendida">✓ Vehículo vendido</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .citas-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-md);
          margin-bottom: var(--space-xl);
          flex-wrap: wrap;
        }
        .filtro-citas { display: flex; gap: 6px; flex-wrap: wrap; }
        .btn-citas-tab {
          background-color: var(--blanco);
          border: 1px solid var(--borde);
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 600;
          color: var(--texto-secundario);
          cursor: pointer;
        }
        .btn-citas-tab.activo {
          background-color: var(--naranja-500);
          color: var(--blanco);
          border-color: var(--naranja-500);
        }
        .aviso-crm {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-md);
          background-color: var(--exito-fondo);
          color: var(--exito-texto);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          font-size: 13px;
          margin-bottom: var(--space-lg);
        }
        .aviso-crm.aviso-crm-alerta { background-color: var(--naranja-50); color: var(--naranja-700); }
        .aviso-crm button { background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; }
        .aviso-enlace { color: inherit; font-weight: 700; text-decoration: underline; }
        .caja-vacia-citas {
          background-color: var(--blanco);
          border: 1px dashed var(--borde);
          border-radius: var(--radius-lg);
          padding: var(--space-xxxl);
          text-align: center;
        }
        .grid-citas { display: flex; flex-direction: column; gap: var(--space-lg); }
        .tarjeta-cita {
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg);
          padding: var(--space-lg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.03);
        }
        .tarjeta-cita.pendiente { border-left: 4px solid var(--naranja-500); }
        .tarjeta-cita.confirmada { border-left: 4px solid #0F6E56; }
        .tarjeta-cita.descartada { border-left: 4px solid var(--texto-mudo); opacity: 0.8; }
        .cita-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--borde-claro);
          margin-bottom: 12px;
          gap: var(--space-sm);
          flex-wrap: wrap;
        }
        .badge-estado-cita {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: var(--radius-pill);
        }
        .badge-estado-cita.pendiente { background-color: var(--naranja-50); color: var(--naranja-700); }
        .badge-estado-cita.confirmada { background-color: var(--exito-fondo); color: var(--exito-texto); }
        .badge-estado-cita.descartada { background-color: var(--superficie); color: var(--texto-mudo); }
        .badge-etapa {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          margin-left: 6px;
          border-radius: var(--radius-pill);
          background-color: var(--superficie);
          color: var(--texto-secundario);
          border: 1px solid var(--borde-claro);
        }
        .badge-estancada {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          margin-left: 6px;
          border-radius: var(--radius-pill);
          background-color: var(--peligro-fondo);
          color: var(--peligro-texto);
        }
        .cita-cuerpo { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xl); }
        @media (max-width: 640px) { .cita-cuerpo { grid-template-columns: 1fr; } }
        .cita-notificacion-meta {
          background-color: #FFF6EE;
          border: 1px solid #FDDDC6;
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 12px;
          color: var(--naranja-700);
          margin: 12px 0;
        }
        .bloque-financiamiento {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
          padding: 12px;
          border: 1px solid var(--naranja-200);
          border-left: 4px solid var(--naranja-500);
          border-radius: var(--radius-sm);
          background-color: var(--naranja-50);
        }
        .bf-titulo { font-size: 13px; font-weight: 700; color: var(--naranja-700); }
        .bf-enlace {
          display: block;
          word-break: break-all;
          font-size: 12px;
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-sm);
          padding: 6px 8px;
        }
        .bf-acciones { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .bloque-financiamiento .ayuda-inline a { color: var(--naranja-700); font-weight: 700; }
        .btn-secundario-crm {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: var(--blanco);
          border: 1px solid var(--borde);
          color: var(--texto-primario);
          font-size: 13px;
          font-weight: 600;
          padding: 7px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-decoration: none;
          font-family: inherit;
        }
        .form-inline-crm {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background-color: var(--superficie);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-sm);
          padding: var(--space-md);
          margin-bottom: 12px;
        }
        .form-inline-crm label, .etiqueta-crm { font-size: 12px; font-weight: 700; color: var(--texto-secundario); }
        .form-inline-crm .req { color: var(--naranja-600); }
        .form-inline-crm input,
        .form-inline-crm select {
          padding: 8px 10px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-family: inherit;
        }
        .form-inline-crm input[type=radio] { padding: 0; }
        .form-inline-crm input.input-error { border-color: var(--peligro-texto); }
        .form-inline-crm .error-texto { font-size: 12px; color: var(--peligro-texto); }
        .form-inline-crm .ayuda-inline, .bloque-financiamiento .ayuda-inline { font-size: 11px; color: var(--texto-mudo); }
        .fila-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
        .campo-crm { display: flex; flex-direction: column; gap: 4px; }
        .opciones-pago { display: flex; gap: 18px; flex-wrap: wrap; }
        .form-inline-crm .opcion-pago {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--texto-primario);
          cursor: pointer;
        }
        .form-inline-acciones { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
        .cita-acciones {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 10px;
          border-top: 1px solid var(--borde-claro);
        }
        .btn-whatsapp {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background-color: #25D366;
          color: white;
          font-size: 13px;
          font-weight: 700;
          padding: 8px 14px;
          border-radius: var(--radius-sm);
          text-decoration: none;
          transition: opacity 0.2s;
        }
        .btn-whatsapp:hover { opacity: 0.9; }
        .enlace-persona { color: var(--texto-primario); text-decoration: none; }
        .enlace-persona:hover { color: var(--naranja-600); text-decoration: underline; }
        .cita-vendida { font-size: 13px; font-weight: 700; color: var(--exito-texto); }
        .btn-descartar {
          background: none;
          border: 1px solid var(--borde);
          color: var(--peligro-texto);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .btn-descartar:hover { background-color: var(--peligro-fondo); border-color: var(--peligro-texto); }
      `}</style>
    </div>
  );
};
