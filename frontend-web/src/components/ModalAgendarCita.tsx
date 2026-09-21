import React, { useState } from 'react';
import type { VehiculoData } from '../types/vehiculo';
import { useCRM, CORREO_NOTIFICACIONES_WAMMA } from '../state/crmContexto';
import { Boton } from './Boton';
import { validarMovil, validarCorreo } from '../validacion/venezuela';
import { cuotaDesde } from '../mocks/financiamiento';

interface ModalAgendarCitaProps {
  vehiculo: VehiculoData;
  rateBCV: number;
  interesFinanciamientoInicial?: boolean;
  onCerrar: () => void;
  onExito?: () => void;
}

export const ModalAgendarCita: React.FC<ModalAgendarCitaProps> = ({
  vehiculo,
  // rateBCV ya no se usa: eliminados los montos en Bs
  interesFinanciamientoInicial: _interesFinanciamientoInicial = false,
  onCerrar,
  onExito,
}) => {
  const { agendarCita } = useCRM();

  const [nombreApellido, setNombreApellido] = useState('');
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState('');
  const [correo, setCorreo] = useState('');

  // Fecha por defecto mañana
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fechaDefecto = manana.toISOString().split('T')[0];
  const [diaPreferencia, setDiaPreferencia] = useState(fechaDefecto);

  const [franjaHoraria, setFranjaHoraria] = useState<'Mañana' | 'Tarde'>('Mañana');
  const [metodoPago] = useState<'Contado' | 'Financiamiento'>('Financiamiento');
  const [rangoIngresos, setRangoIngresos] = useState('');
  const [tabRequisitos, setTabRequisitos] = useState<'digital' | 'fisico'>('digital');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [citaConfirmada, setCitaConfirmada] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!nombreApellido.trim() || nombreApellido.trim().length < 4) {
      nuevosErrores.nombreApellido = 'Por favor ingresa tu nombre y apellido completos.';
    }

    const errorTel = validarMovil(telefonoWhatsApp);
    if (errorTel) {
      nuevosErrores.telefonoWhatsApp = errorTel;
    }

    // El correo es opcional en este paso: el canal real de contacto es WhatsApp.
    if (correo.trim()) {
      const errorCor = validarCorreo(correo);
      if (errorCor) {
        nuevosErrores.correo = errorCor;
      }
    }

    if (!diaPreferencia) {
      nuevosErrores.diaPreferencia = 'Selecciona una fecha preferida.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    setEnviando(true);

    // Simular un breve tiempo de red
    setTimeout(() => {
      // La cédula NO se pide aquí: llega al confirmar la cita (spec 010 §8.5).
      // La persona se resuelve por teléfono normalizado hasta entonces.
      agendarCita({
        nombreApellido: nombreApellido.trim(),
        telefonoWhatsApp: telefonoWhatsApp.trim(),
        correo: correo.trim() || undefined,
        diaPreferencia,
        franjaHoraria,
        modalidadPago: metodoPago,
        vehiculo,
      });

      setEnviando(false);
      setCitaConfirmada(true);
      if (onExito) {
        onExito();
      }
    }, 600);
  };

  const formatoEUR = (v: number) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(v) ? v : 0);

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenedor" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del modal */}
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
              {citaConfirmada ? '¡Cita Agendada Exitosamente!' : 'Agendar Cita para Ver el Vehículo'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
              {vehiculo.marca} {vehiculo.modelo} {vehiculo.version} ({vehiculo.anio})
            </p>
          </div>
          <button
            type="button"
            className="modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Resumen visual del vehículo */}
        <div className="modal-vehiculo-resumen">
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--naranja-700)' }}>
            Cuota desde {formatoEUR(cuotaDesde(vehiculo.precio))} /mes
          </div>
          <div style={{ fontSize: '12px', color: 'var(--naranja-600)', fontWeight: 600 }}>
            ✓ Inspección 240 puntos
          </div>
        </div>

        {!citaConfirmada ? (
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-group">
              <label htmlFor="nombreApellido">Nombre y Apellido *</label>
              <input
                id="nombreApellido"
                type="text"
                placeholder="Ej. Carlos Mendoza"
                value={nombreApellido}
                onChange={(e) => setNombreApellido(e.target.value)}
                className={errores.nombreApellido ? 'input-error' : ''}
              />
              {errores.nombreApellido && (
                <span className="error-texto">{errores.nombreApellido}</span>
              )}
            </div>

            {/*
              La cédula se pide al confirmar la cita, no aquí (spec 010 §8.5):
              exigirla para *mirar* un carro es fricción alta en la captación.
            */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="telefonoWhatsApp">Teléfono WhatsApp *</label>
                <input
                  id="telefonoWhatsApp"
                  type="tel"
                  placeholder="04121234567"
                  value={telefonoWhatsApp}
                  onChange={(e) => setTelefonoWhatsApp(e.target.value)}
                  className={errores.telefonoWhatsApp ? 'input-error' : ''}
                />
                {errores.telefonoWhatsApp && (
                  <span className="error-texto">{errores.telefonoWhatsApp}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="correo">Correo Electrónico (opcional)</label>
                <input
                  id="correo"
                  type="email"
                  placeholder="carlos@ejemplo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className={errores.correo ? 'input-error' : ''}
                />
                {errores.correo && <span className="error-texto">{errores.correo}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="diaPreferencia">Fecha sugerida de visita *</label>
                <input
                  id="diaPreferencia"
                  type="date"
                  min={fechaDefecto}
                  value={diaPreferencia}
                  onChange={(e) => setDiaPreferencia(e.target.value)}
                  className={errores.diaPreferencia ? 'input-error' : ''}
                />
                {errores.diaPreferencia && (
                  <span className="error-texto">{errores.diaPreferencia}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="franjaHoraria">Horario preferido</label>
                <select
                  id="franjaHoraria"
                  value={franjaHoraria}
                  onChange={(e) => setFranjaHoraria(e.target.value as 'Mañana' | 'Tarde')}
                >
                  <option value="Mañana">Mañana (9:00 AM - 1:00 PM)</option>
                  <option value="Tarde">Tarde (2:00 PM - 5:00 PM)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="rangoIngresos">Rango de ingresos mensuales (opcional)</label>
              <select
                id="rangoIngresos"
                value={rangoIngresos}
                onChange={(e) => setRangoIngresos(e.target.value)}
              >
                <option value="">Selecciona tu rango</option>
                <option value="1000-1300">€1.000 – €1.300 / mes</option>
                <option value="1301-2000">€1.301 – €2.000 / mes</option>
                <option value="2001+">Más de €2.000 / mes</option>
              </select>
            </div>

            {/* Sección de Requisitos para el Financiamiento (Digital y Físico) */}
            <div className="seccion-requisitos-financiamiento">
              <div className="requisitos-header">
                <div className="requisitos-header-top">
                  <span className="requisitos-tag">Financiamiento WAMMA</span>
                  <span className="requisitos-badge-alerta">Cuotas fijas · Sin sorpresas</span>
                </div>
                <h4 className="requisitos-titulo">
                  Requisitos para aplicar al financiamiento
                </h4>
                <p className="requisitos-intro">
                  Si deseas optar por financiamiento en cuotas fijas tras inspeccionar el vehículo, ten preparados los siguientes recaudos:
                </p>
              </div>

              {/* Selector de Pestañas Digital / Físico */}
              <div className="requisitos-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tabRequisitos === 'digital'}
                  className={`tab-requisito ${tabRequisitos === 'digital' ? 'activo' : ''}`}
                  onClick={() => setTabRequisitos('digital')}
                >
                  <span className="tab-icono">📱</span>
                  <div className="tab-texto">
                    <strong>Requisitos Digitales</strong>
                    <small>Para la solicitud online</small>
                  </div>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tabRequisitos === 'fisico'}
                  className={`tab-requisito ${tabRequisitos === 'fisico' ? 'activo' : ''}`}
                  onClick={() => setTabRequisitos('fisico')}
                >
                  <span className="tab-icono">🏛️</span>
                  <div className="tab-texto">
                    <strong>Requisitos Físicos</strong>
                    <small>Para llevar a tu cita en sede</small>
                  </div>
                </button>
              </div>

              {/* Contenido de la pestaña */}
              <div className="requisitos-caja-contenido">
                {tabRequisitos === 'digital' ? (
                  <div className="requisitos-lista">
                    <div className="requisito-item">
                      <div className="requisito-check">✓</div>
                      <div>
                        <strong>Cédula o Pasaporte vigente:</strong> Archivo PDF o imagen nítida y legible por ambas caras.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check">✓</div>
                      <div>
                        <strong>RIF personal actualizado:</strong> Comprobante digital descargado del portal del SENIAT con tu domicilio actual.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check">✓</div>
                      <div>
                        <strong>Constancia de Trabajo o Certificación de Ingresos:</strong> Empleados: constancia membretada, sellada y con sueldo mensual. Independientes: certificación firmada por contador público colegiado (CPC).
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check">✓</div>
                      <div>
                        <strong>Estados de cuenta bancarios (últimos 3 a 6 meses):</strong> En PDF descargado directamente del banco donde se reflejen los ingresos.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check">✓</div>
                      <div>
                        <strong>Comprobante de domicilio:</strong> Recibo de servicio público (luz, agua, gas o telefonía) o contrato de arrendamiento vigente.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check">✓</div>
                      <div>
                        <strong>Referencias:</strong> Datos de contacto (nombre, teléfono y parentesco) de 2 referencias personales y 1 familiar.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="requisitos-lista">
                    <div className="requisito-item">
                      <div className="requisito-check requisito-check-fisico">✓</div>
                      <div>
                        <strong>Cédula de Identidad original laminada:</strong> Indispensable presentarla en físico para acceder a las instalaciones y validar tu identidad.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check requisito-check-fisico">✓</div>
                      <div>
                        <strong>Copia física impresa del RIF:</strong> Documento impreso con dirección de domicilio actualizada para el expediente.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check requisito-check-fisico">✓</div>
                      <div>
                        <strong>Original de Constancia laboral o Certificación CPC:</strong> Con sello húmedo y firmas autógrafas / visado colegiado con timbre fiscal.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check requisito-check-fisico">✓</div>
                      <div>
                        <strong>Copia física de recibo de servicio o contrato de alquiler:</strong> Para el expediente físico de validación de residencia.
                      </div>
                    </div>
                    <div className="requisito-item">
                      <div className="requisito-check requisito-check-fisico">✓</div>
                      <div>
                        <strong>Teléfono móvil con WhatsApp activo:</strong> Para recibir y validar en el momento el código de seguridad OTP.
                      </div>
                    </div>
                  </div>
                )}

                <div className="requisitos-pie-nota">
                  💡 <em>Tras tu visita y prueba del auto, tu asesor comercial te enviará tu enlace personal para completar la solicitud y cargar los recaudos digitales.</em>
                </div>
              </div>
            </div>

            <div className="alerta-reserva">
              ℹ️ Al agendar esta cita, el vehículo quedará reservado temporalmente y el botón de agendar
              se desactivará para otros usuarios mientras coordinamos tu visita.
            </div>

            <div className="modal-acciones">
              <Boton variant="secondary" type="button" onClick={onCerrar} disabled={enviando}>
                Cancelar
              </Boton>
              <Boton variant="primary" type="submit" disabled={enviando}>
                {enviando ? 'Enviando solicitud...' : 'Confirmar y Agendar Cita'}
              </Boton>
            </div>
          </form>
        ) : (
          <div className="modal-exito">
            <div className="icono-exito">✓</div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
              ¡Tu solicitud ha sido recibida!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', lineHeight: 1.5 }}>
              Hemos registrado tu cita para el <strong>{diaPreferencia}</strong> en turno{' '}
              <strong>{franjaHoraria.toLowerCase()}</strong>.
            </p>

            <div className="caja-notificacion-email">
              <div style={{ fontWeight: 600, color: 'var(--naranja-700)', marginBottom: '4px' }}>
                📧 Notificación enviada al equipo WAMMA
              </div>
              <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                Se despachó el reporte inmediato a <code>{CORREO_NOTIFICACIONES_WAMMA}</code> con
                todos tus datos y el detalle del vehículo.
              </div>
            </div>

              <div className="caja-whatsapp">
                <div style={{ fontWeight: 600, color: '#0F6E56', marginBottom: '4px' }}>
                  📱 Siguiente paso: Confirmación vía WhatsApp
                </div>
                <div style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>
                  Un asesor de WAMMA te escribirá directamente a tu número{' '}
                  <strong>{telefonoWhatsApp}</strong> para validar la hora exacta y darte las
                  indicaciones de llegada a la sede.
                </div>
              </div>

              {/* Recordatorio de requisitos en la pantalla de confirmación */}
              <div className="caja-recordatorio-requisitos">
                <div className="recordatorio-header">
                  <span style={{ fontSize: '18px' }}>📋</span>
                  <strong>Documentos a tener listos para tu cita y financiamiento</strong>
                </div>
                <div className="recordatorio-grid">
                  <div className="recordatorio-col">
                    <span className="recordatorio-sub">🏛️ En Físico (Llevar a la Sede)</span>
                    <ul>
                      <li>Cédula laminada original vigente</li>
                      <li>Copia impresa del RIF vigente</li>
                      <li>Original de constancia de trabajo o certificación CPC</li>
                      <li>Celular con WhatsApp activo para validación OTP</li>
                    </ul>
                  </div>
                  <div className="recordatorio-col">
                    <span className="recordatorio-sub">📱 En Digital (Para Solicitud Online)</span>
                    <ul>
                      <li>Fotos/PDF de cédula y RIF digital</li>
                      <li>PDF de últimos 3 meses de cuenta bancaria</li>
                      <li>Recibo de servicio público o alquiler</li>
                      <li>2 referencias personales y 1 familiar</li>
                    </ul>
                  </div>
                </div>
              </div>

            <div style={{ marginTop: 'var(--space-xl)' }}>
              <Boton variant="primary" fullWidth onClick={onCerrar}>
                Entendido, volver a la ficha
              </Boton>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: var(--space-md);
        }
        .modal-contenedor {
          background-color: var(--blanco);
          border-radius: var(--radius-lg);
          max-width: 580px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          animation: fadeInScale 0.2s ease-out;
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: var(--space-xl) var(--space-xl) var(--space-md);
          border-bottom: 1px solid var(--borde-claro);
        }
        .modal-cerrar {
          background: none;
          border: none;
          font-size: 18px;
          color: var(--texto-mudo);
          cursor: pointer;
          padding: 4px;
        }
        .modal-cerrar:hover {
          color: var(--texto-primario);
        }
        .modal-vehiculo-resumen {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-md) var(--space-xl);
          background-color: var(--superficie);
          border-bottom: 1px solid var(--borde-claro);
        }
        .modal-form {
          padding: var(--space-xl);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
        }
        @media (max-width: 500px) {
          .form-row { grid-template-columns: 1fr; }
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: var(--texto-primario);
        }
        .form-group input,
        .form-group select {
          padding: 10px 12px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 14px;
          color: var(--texto-primario);
          outline: none;
          transition: border-color 0.2s;
        }
        .form-group input:focus,
        .form-group select:focus {
          border-color: var(--naranja-500);
        }
        .input-error {
          border-color: var(--peligro-texto) !important;
        }
        .error-texto {
          font-size: 11px;
          color: var(--peligro-texto);
          margin-top: 2px;
        }
        .radio-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          cursor: pointer;
        }
        .alerta-reserva {
          background-color: var(--naranja-50);
          border: 1px solid var(--naranja-200);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          color: var(--naranja-700);
          line-height: 1.4;
        }
        .modal-acciones {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-md);
          margin-top: var(--space-md);
        }
        .modal-exito {
          padding: var(--space-xxl) var(--space-xl);
          text-align: center;
        }
        .icono-exito {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background-color: var(--exito-fondo);
          color: var(--exito-texto);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          margin: 0 auto var(--space-lg);
        }
        .caja-notificacion-email {
          background-color: #FFF6EE;
          border: 1px solid #FDDDC6;
          border-radius: var(--radius-md);
          padding: 12px 14px;
          text-align: left;
          margin: var(--space-lg) 0 var(--space-md);
        }
        .caja-whatsapp {
          background-color: var(--exito-fondo);
          border: 1px solid #BEE7D7;
          border-radius: var(--radius-md);
          padding: 12px 14px;
          text-align: left;
        }
        .seccion-requisitos-financiamiento {
          background-color: #FCFAF8;
          border: 1px solid rgba(209, 116, 56, 0.2);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          margin-top: 4px;
        }
        .requisitos-header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .requisitos-tag {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--naranja-600);
          background: #FFF0E6;
          padding: 3px 8px;
          border-radius: var(--radius-pill);
        }
        .requisitos-badge-alerta {
          font-size: 11px;
          font-weight: 600;
          color: var(--texto-secundario);
        }
        .requisitos-titulo {
          font-size: 14px;
          font-weight: 700;
          color: var(--texto-primario);
          margin: 0 0 4px;
        }
        .requisitos-intro {
          font-size: 12px;
          color: var(--texto-secundario);
          margin: 0 0 10px;
          line-height: 1.4;
        }
        .requisitos-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .tab-requisito {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          background: var(--blanco);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-family: inherit;
        }
        .tab-requisito:hover {
          border-color: var(--naranja-300);
          background: #FFFDFB;
        }
        .tab-requisito.activo {
          background: #FFF5EE;
          border-color: var(--naranja-500);
          box-shadow: 0 2px 6px rgba(209, 116, 56, 0.15);
        }
        .tab-icono {
          font-size: 18px;
          flex-shrink: 0;
        }
        .tab-texto {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .tab-texto strong {
          font-size: 12px;
          font-weight: 700;
          color: var(--texto-primario);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .tab-requisito.activo .tab-texto strong {
          color: var(--naranja-700);
        }
        .tab-texto small {
          font-size: 10px;
          color: var(--texto-secundario);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .requisitos-caja-contenido {
          background: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
        }
        .requisitos-lista {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .requisito-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          line-height: 1.45;
          color: var(--texto-primario);
        }
        .requisito-check {
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #E8F5E9;
          color: #2E7D32;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .requisito-check-fisico {
          background: #EDE7F6;
          color: #512DA8;
        }
        .requisito-item strong {
          color: var(--texto-primario);
          font-weight: 600;
        }
        .requisitos-pie-nota {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed var(--borde);
          font-size: 11px;
          color: var(--texto-secundario);
          line-height: 1.4;
        }
        .caja-recordatorio-requisitos {
          background: #FCFAF8;
          border: 1px solid var(--naranja-200);
          border-radius: var(--radius-md);
          padding: 14px;
          margin: var(--space-md) 0;
          text-align: left;
        }
        .recordatorio-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--naranja-800);
          margin-bottom: 8px;
        }
        .recordatorio-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .recordatorio-sub {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--texto-primario);
          margin-bottom: 4px;
        }
        .recordatorio-col ul {
          margin: 0;
          padding-left: 16px;
          font-size: 11px;
          color: var(--texto-secundario);
          line-height: 1.45;
        }
        @media (max-width: 520px) {
          .requisitos-tabs {
            grid-template-columns: 1fr;
          }
          .recordatorio-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
