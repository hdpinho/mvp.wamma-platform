import React, { useState } from 'react';
import { useCRM, CORREO_NOTIFICACIONES_WAMMA } from '../../state/crmContexto';
import { Boton } from '../../components/Boton';
import type { MotivoPerdida } from '../../types/crm';
import {
  MOTIVOS_PERDIDA,
  definicionEtapa,
  estaEstancada,
  telefonoParaWhatsApp,
} from '../../types/crm';
import { validarCedula } from '../../validacion/venezuela';

/**
 * O3 · Bandeja de citas y solicitudes de visita.
 *
 * Aquí ocurre el **segundo paso de la captura** (`spec.md` §8.5): la cédula no
 * se pide en la vitrina, se pide al confirmar. Confirmar sin cédula no es
 * posible, y al llegar consolida o fusiona la persona (`plan.md` §5.1).
 */

type AccionAbierta =
  | { citaId: string; tipo: 'confirmar' | 'descartar' | 'interaccion' }
  | null;

export const O3_GestionCitas: React.FC = () => {
  const {
    citas,
    obtenerPersona,
    obtenerOportunidad,
    ultimaActividad,
    confirmarCita,
    descartarCita,
    registrarInteraccion,
  } = useCRM();

  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'confirmada' | 'descartada'>('todas');
  const [accion, setAccion] = useState<AccionAbierta>(null);

  // Borradores de los formularios en línea.
  const [cedula, setCedula] = useState('');
  const [errorCedula, setErrorCedula] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerdida>('dejo_de_responder');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const citasFiltradas = citas.filter((c) => (filtro === 'todas' ? true : c.estado === filtro));

  const cerrarAccion = () => {
    setAccion(null);
    setCedula('');
    setErrorCedula(null);
    setMotivoTexto('');
    setNota('');
  };

  const enlaceWhatsApp = (telefono: string, nombre: string, vehiculo: string, dia: string, turno: string) => {
    const texto = encodeURIComponent(
      `¡Hola ${nombre}! Te contactamos del equipo comercial de WAMMA respecto a tu solicitud de cita para ver el vehículo ${vehiculo} (preferencia: ${dia}, turno ${turno.toLowerCase()}). Queremos coordinar la hora exacta de tu visita a nuestra sede.`,
    );
    return `https://wa.me/${telefonoParaWhatsApp(telefono)}?text=${texto}`;
  };

  const alConfirmar = (citaId: string) => {
    const error = validarCedula(cedula);
    if (error) {
      setErrorCedula(error);
      return;
    }

    const resultado = confirmarCita(citaId, cedula);
    if (!resultado.ok) {
      setErrorCedula(resultado.error ?? 'No se pudo confirmar la cita.');
      return;
    }

    setAviso(
      resultado.fusionada
        ? 'Cita confirmada. Esta cédula ya existía en otro registro: los dos se fusionaron en una sola persona y su historial quedó unificado.'
        : 'Cita confirmada. La cédula quedó asociada a la persona.',
    );
    cerrarAccion();
  };

  const alDescartar = (citaId: string) => {
    const exigeTexto = MOTIVOS_PERDIDA.find((m) => m.codigo === motivo)?.exigeTexto;
    if (exigeTexto && !motivoTexto.trim()) return;

    descartarCita(citaId, motivo, motivoTexto.trim() || undefined);
    setAviso('Cita descartada. La oportunidad quedó cerrada como perdida con su motivo.');
    cerrarAccion();
  };

  const alRegistrarInteraccion = (personaId: string, oportunidadId: string) => {
    if (!nota.trim()) return;
    registrarInteraccion({
      personaId,
      oportunidadId,
      canal: 'whatsapp',
      direccion: 'saliente',
      nota,
    });
    setAviso('Interacción registrada en el historial de la persona.');
    cerrarAccion();
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
        <div className="aviso-crm" role="status">
          {aviso}
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
            Cuando un cliente presione "Agendar cita" en la vitrina pública, aparecerá listado aquí inmediatamente.
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
            const etapa = definicionEtapa(oportunidad.etapa);
            const estancada = estaEstancada(oportunidad, ultimaActividad(oportunidad.id));
            const abierta = accion?.citaId === cita.id ? accion.tipo : null;

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
                    <span className="badge-etapa">{etapa.nombre}</span>
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
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--texto-primario)' }}>
                      {persona.nombreApellido}
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
                    <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px' }}>
                      {vehiculoTitulo}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--naranja-600)' }}>
                      ${vRes.precioUSD.toLocaleString()} USD
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', background: 'var(--superficie)', padding: '6px 10px', borderRadius: '4px' }}>
                      📅 <strong>Preferencia de visita:</strong> {cita.diaPreferencia} ({cita.franjaHoraria})
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

                <div className="cita-notificacion-meta">
                  📧 Notificación despachada a: <code>{cita.notificadoA}</code>
                </div>

                {/* Formularios en línea. Un solo campo obligatorio cada uno (plan §7.4). */}
                {abierta === 'confirmar' && (
                  <div className="form-inline-crm">
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
                        setErrorCedula(null);
                      }}
                      className={errorCedula ? 'input-error' : ''}
                      autoFocus
                    />
                    {errorCedula && <span className="error-texto">{errorCedula}</span>}
                    <div className="form-inline-acciones">
                      <Boton variant="primary" size="small" onClick={() => alConfirmar(cita.id)}>
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
                    <span className="ayuda-inline">
                      Canal WhatsApp, saliente y fecha de hoy se registran solos.
                    </span>
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

                <div className="cita-acciones">
                  <a
                    href={enlaceWhatsApp(
                      persona.telefonoWhatsApp,
                      persona.nombreApellido,
                      vehiculoTitulo,
                      cita.diaPreferencia,
                      cita.franjaHoraria,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-whatsapp"
                    onClick={() => setAccion({ citaId: cita.id, tipo: 'interaccion' })}
                  >
                    💬 Contactar por WhatsApp
                  </a>

                  {cita.estado === 'pendiente' && !abierta && (
                    <>
                      <Boton
                        variant="primary"
                        size="small"
                        onClick={() => setAccion({ citaId: cita.id, tipo: 'confirmar' })}
                      >
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

                  {cita.estado === 'confirmada' && !abierta && (
                    <button
                      type="button"
                      className="btn-descartar"
                      onClick={() => setAccion({ citaId: cita.id, tipo: 'descartar' })}
                    >
                      Liberar Vehículo
                    </button>
                  )}
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
        .filtro-citas {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
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
        .aviso-crm button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 14px;
        }
        .caja-vacia-citas {
          background-color: var(--blanco);
          border: 1px dashed var(--borde);
          border-radius: var(--radius-lg);
          padding: var(--space-xxxl);
          text-align: center;
        }
        .grid-citas {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }
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
        .cita-cuerpo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-xl);
        }
        @media (max-width: 640px) {
          .cita-cuerpo { grid-template-columns: 1fr; }
        }
        .cita-notificacion-meta {
          background-color: #FFF6EE;
          border: 1px solid #FDDDC6;
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          font-size: 12px;
          color: var(--naranja-700);
          margin: 12px 0;
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
        .form-inline-crm label {
          font-size: 12px;
          font-weight: 700;
          color: var(--texto-secundario);
        }
        .form-inline-crm .req { color: var(--naranja-600); }
        .form-inline-crm input,
        .form-inline-crm select {
          padding: 8px 10px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          font-size: 13px;
          font-family: inherit;
        }
        .form-inline-crm input.input-error { border-color: var(--peligro-texto); }
        .form-inline-crm .error-texto { font-size: 12px; color: var(--peligro-texto); }
        .form-inline-crm .ayuda-inline { font-size: 11px; color: var(--texto-mudo); }
        .form-inline-acciones {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
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
        .btn-descartar:hover {
          background-color: var(--peligro-fondo);
          border-color: var(--peligro-texto);
        }
      `}</style>
    </div>
  );
};
