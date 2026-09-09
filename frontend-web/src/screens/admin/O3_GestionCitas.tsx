import React, { useState } from 'react';
import { useVehiculos, CORREO_NOTIFICACIONES_WAMMA } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';

export const O3_GestionCitas: React.FC = () => {
  const { citas, actualizarCita, descartarCitaYLiberarVehiculo } = useVehiculos();
  const [filtro, setFiltro] = useState<'todas' | 'pendiente' | 'confirmada' | 'descartada'>('todas');

  const citasFiltradas = citas.filter((c) => (filtro === 'todas' ? true : c.estado === filtro));

  const generarEnlaceWhatsApp = (
    telefono: string,
    nombre: string,
    vehiculoNombre: string,
    dia: string,
    turno: string,
  ) => {
    // Normalizar número venezolano para enlace wa.me (quitar + y espacios)
    let numLimpio = telefono.replace(/\D/g, '');
    if (numLimpio.startsWith('0')) {
      numLimpio = '58' + numLimpio.substring(1);
    } else if (!numLimpio.startsWith('58')) {
      numLimpio = '58' + numLimpio;
    }

    const texto = encodeURIComponent(
      `¡Hola ${nombre}! Te contactamos del equipo comercial de WAMMA respecto a tu solicitud de cita para ver el vehículo ${vehiculoNombre} (preferencia: ${dia}, turno ${turno.toLowerCase()}). Queremos coordinar la hora exacta de tu visita a nuestra sede.`,
    );
    return `https://wa.me/${numLimpio}?text=${texto}`;
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
          <button
            type="button"
            className={`btn-citas-tab ${filtro === 'todas' ? 'activo' : ''}`}
            onClick={() => setFiltro('todas')}
          >
            Todas ({citas.length})
          </button>
          <button
            type="button"
            className={`btn-citas-tab ${filtro === 'pendiente' ? 'activo' : ''}`}
            onClick={() => setFiltro('pendiente')}
          >
            Pendientes ({citas.filter((c) => c.estado === 'pendiente').length})
          </button>
          <button
            type="button"
            className={`btn-citas-tab ${filtro === 'confirmada' ? 'activo' : ''}`}
            onClick={() => setFiltro('confirmada')}
          >
            Confirmadas ({citas.filter((c) => c.estado === 'confirmada').length})
          </button>
          <button
            type="button"
            className={`btn-citas-tab ${filtro === 'descartada' ? 'activo' : ''}`}
            onClick={() => setFiltro('descartada')}
          >
            Descartadas ({citas.filter((c) => c.estado === 'descartada').length})
          </button>
        </div>
      </div>

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
            const vRes = cita.vehiculoResumen;
            const vehiculoTitulo = `${vRes.marca} ${vRes.modelo} ${vRes.version} (${vRes.anio})`;

            return (
              <div key={cita.id} className={`tarjeta-cita ${cita.estado}`}>
                {/* Cabecera de la cita */}
                <div className="cita-top">
                  <div>
                    <span className={`badge-estado-cita ${cita.estado}`}>
                      {cita.estado === 'pendiente'
                        ? '⏳ Pendiente por Confirmar'
                        : cita.estado === 'confirmada'
                          ? '✓ Cita Confirmada'
                          : '✕ Descartada / Auto Liberado'}
                    </span>
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
                  {/* Info del cliente */}
                  <div className="bloque-info-cliente">
                    <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--texto-primario)' }}>
                      {cita.nombreApellido}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                      Cédula: <strong>{cita.cedula}</strong>
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '13px' }}>
                      <div>
                        📱 WhatsApp: <strong>{cita.telefonoWhatsApp}</strong>
                      </div>
                      <div>
                        ✉️ Correo: <strong>{cita.correo}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--naranja-700)' }}>
                      Modalidad de compra:{' '}
                      <strong>{cita.metodoPago === 'Financiamiento' ? '💳 Financiamiento WAMMA' : '💵 Pago de Contado'}</strong>
                    </div>
                  </div>

                  {/* Info del vehículo */}
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
                  </div>
                </div>

                {/* Notificación despachada */}
                <div className="cita-notificacion-meta">
                  📧 Notificación despachada a: <code>{cita.notificadoA}</code>
                </div>

                {/* Acciones para el asesor */}
                <div className="cita-acciones">
                  <a
                    href={generarEnlaceWhatsApp(
                      cita.telefonoWhatsApp,
                      cita.nombreApellido,
                      vehiculoTitulo,
                      cita.diaPreferencia,
                      cita.franjaHoraria,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-whatsapp"
                  >
                    💬 Contactar por WhatsApp
                  </a>

                  {cita.estado === 'pendiente' && (
                    <>
                      <Boton
                        variant="primary"
                        size="small"
                        onClick={() => actualizarCita(cita.id, 'confirmada')}
                      >
                        ✓ Confirmar Cita
                      </Boton>
                      <button
                        type="button"
                        className="btn-descartar"
                        onClick={() => {
                          if (
                            window.confirm(
                              '¿Deseas descartar esta cita y rehabilitar el botón para que el vehículo vuelva a estar Disponible para otros clientes?',
                            )
                          ) {
                            descartarCitaYLiberarVehiculo(cita.id);
                          }
                        }}
                      >
                        ✕ Descartar y Liberar Auto
                      </button>
                    </>
                  )}

                  {cita.estado === 'confirmada' && (
                    <button
                      type="button"
                      className="btn-descartar"
                      onClick={() => descartarCitaYLiberarVehiculo(cita.id)}
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
        .tarjeta-cita.pendiente {
          border-left: 4px solid var(--naranja-500);
        }
        .tarjeta-cita.confirmada {
          border-left: 4px solid #0F6E56;
        }
        .tarjeta-cita.descartada {
          border-left: 4px solid var(--texto-mudo);
          opacity: 0.8;
        }
        .cita-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--borde-claro);
          margin-bottom: 12px;
        }
        .badge-estado-cita {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: var(--radius-pill);
        }
        .badge-estado-cita.pendiente {
          background-color: var(--naranja-50);
          color: var(--naranja-700);
        }
        .badge-estado-cita.confirmada {
          background-color: var(--exito-fondo);
          color: var(--exito-texto);
        }
        .badge-estado-cita.descartada {
          background-color: var(--superficie);
          color: var(--texto-mudo);
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
        .btn-whatsapp:hover {
          opacity: 0.9;
        }
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
