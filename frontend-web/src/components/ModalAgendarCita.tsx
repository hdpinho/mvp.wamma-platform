import React, { useState } from 'react';
import type { VehiculoData } from '../types/vehiculo';
import { useVehiculos, CORREO_NOTIFICACIONES_WAMMA } from '../state/vehiculosContexto';
import { Boton } from './Boton';
import { validarCedula, validarMovil, validarCorreo } from '../validacion/venezuela';

interface ModalAgendarCitaProps {
  vehiculo: VehiculoData;
  rateBCV: number;
  interesFinanciamientoInicial?: boolean;
  onCerrar: () => void;
  onExito?: () => void;
}

export const ModalAgendarCita: React.FC<ModalAgendarCitaProps> = ({
  vehiculo,
  rateBCV,
  interesFinanciamientoInicial = false,
  onCerrar,
  onExito,
}) => {
  const { agendarCita } = useVehiculos();

  const [nombreApellido, setNombreApellido] = useState('');
  const [cedula, setCedula] = useState('');
  const [telefonoWhatsApp, setTelefonoWhatsApp] = useState('');
  const [correo, setCorreo] = useState('');

  // Fecha por defecto mañana
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fechaDefecto = manana.toISOString().split('T')[0];
  const [diaPreferencia, setDiaPreferencia] = useState(fechaDefecto);

  const [franjaHoraria, setFranjaHoraria] = useState<'Mañana' | 'Tarde'>('Mañana');
  const [metodoPago, setMetodoPago] = useState<'Contado' | 'Financiamiento'>(
    interesFinanciamientoInicial ? 'Financiamiento' : 'Contado',
  );

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [citaConfirmada, setCitaConfirmada] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);

  const validar = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!nombreApellido.trim() || nombreApellido.trim().length < 4) {
      nuevosErrores.nombreApellido = 'Por favor ingresa tu nombre y apellido completos.';
    }

    const errorCedula = validarCedula(cedula);
    if (errorCedula) {
      nuevosErrores.cedula = errorCedula;
    }

    const errorTel = validarMovil(telefonoWhatsApp);
    if (errorTel) {
      nuevosErrores.telefonoWhatsApp = errorTel;
    }

    const errorCor = validarCorreo(correo);
    if (errorCor) {
      nuevosErrores.correo = errorCor;
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
      agendarCita({
        vehiculoId: vehiculo.id,
        vehiculoResumen: {
          marca: vehiculo.marca,
          modelo: vehiculo.modelo,
          version: vehiculo.version,
          anio: vehiculo.anio,
          precioUSD: vehiculo.precioUSD,
          foto: vehiculo.foto,
        },
        nombreApellido: nombreApellido.trim(),
        cedula: cedula.trim().toUpperCase(),
        telefonoWhatsApp: telefonoWhatsApp.trim(),
        correo: correo.trim(),
        diaPreferencia,
        franjaHoraria,
        metodoPago,
      });

      setEnviando(false);
      setCitaConfirmada(true);
      if (onExito) {
        onExito();
      }
    }, 600);
  };

  const precioBs = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(
    vehiculo.precioUSD * rateBCV,
  );

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
              {vehiculo.marca} {vehiculo.modelo} {vehiculo.version} ({vehiculo.anio}) · Sede:{' '}
              {vehiculo.sede}
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
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            ${vehiculo.precioUSD.toLocaleString()} USD
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--texto-mudo)', marginLeft: '8px' }}>
              (Ref. {precioBs} Bs.)
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--naranja-600)', fontWeight: 600 }}>
            {vehiculo.certificado ? '✓ Certificado 240 Puntos' : 'Inspeccionado WAMMA'}
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

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cedula">Cédula de Identidad *</label>
                <input
                  id="cedula"
                  type="text"
                  placeholder="V-12345678"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  className={errores.cedula ? 'input-error' : ''}
                />
                {errores.cedula && <span className="error-texto">{errores.cedula}</span>}
              </div>

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
            </div>

            <div className="form-group">
              <label htmlFor="correo">Correo Electrónico *</label>
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
              <label>Modalidad de compra prevista:</label>
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: '6px' }}>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="metodoPago"
                    value="Contado"
                    checked={metodoPago === 'Contado'}
                    onChange={() => setMetodoPago('Contado')}
                  />
                  <span>Pago de Contado</span>
                </label>

                <label className="radio-label">
                  <input
                    type="radio"
                    name="metodoPago"
                    value="Financiamiento"
                    checked={metodoPago === 'Financiamiento'}
                    onChange={() => setMetodoPago('Financiamiento')}
                  />
                  <span>Financiamiento WAMMA</span>
                </label>
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
          max-width: 540px;
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
      `}</style>
    </div>
  );
};
