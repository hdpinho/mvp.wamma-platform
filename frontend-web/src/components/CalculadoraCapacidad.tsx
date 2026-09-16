import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from './Boton';
import {
  calcularCuotaMaxima,
  calcularPrecioMaximo,
  formatoUSD,
} from '../services/financiamientoMotor';
import { useParametrosFinanciamiento } from '../services/parametrosFinanciamiento';
import { useVehiculos } from '../state/vehiculosContexto';
import { ModalAgendarCita } from './ModalAgendarCita';

interface CalculadoraCapacidadProps {
  rateBCV?: number;
}

export const CalculadoraCapacidad: React.FC<CalculadoraCapacidadProps> = ({ rateBCV = 0 }) => {
  const navigate = useNavigate();
  const { vehiculos } = useVehiculos();
  const { parametros, error } = useParametrosFinanciamiento();

  const [ingresoInput, setIngresoInput] = useState<string>('1000');
  const [modalContactoAbierto, setModalContactoAbierto] = useState<boolean>(false);

  const calculoDisponible = Boolean(parametros && !error);

  const ingresoNum = Number(ingresoInput);
  const ingresoValido = Number.isFinite(ingresoNum) && ingresoNum > 0;

  // Validación y mensaje de error claro
  const mensajeError = useMemo(() => {
    if (ingresoInput.trim() === '') {
      return 'Por favor ingresa tu ingreso mensual en dólares (USD).';
    }
    if (!Number.isFinite(ingresoNum) || ingresoNum <= 0) {
      return 'El ingreso mensual debe ser un número positivo mayor a $0.';
    }
    return null;
  }, [ingresoInput, ingresoNum]);

  // Cálculos del motor unificado
  const { cuotaMaxima, precioMax20, precioMax30, precioMax40 } = useMemo(() => {
    if (!calculoDisponible || !parametros || !ingresoValido) {
      return { cuotaMaxima: 0, precioMax20: 0, precioMax30: 0, precioMax40: 0 };
    }

    const cMax = calcularCuotaMaxima(ingresoNum, parametros);
    const pMax20 = calcularPrecioMaximo(ingresoNum, 0.20, parametros);
    const pMax30 = calcularPrecioMaximo(ingresoNum, 0.30, parametros);
    const pMax40 = calcularPrecioMaximo(ingresoNum, 0.40, parametros);

    return {
      cuotaMaxima: cMax,
      precioMax20: pMax20,
      precioMax30: pMax30,
      precioMax40: pMax40,
    };
  }, [calculoDisponible, parametros, ingresoNum, ingresoValido]);

  // Vehículos en inventario que califican con cada nivel de inicial
  const { califican20, califican30, califican40 } = useMemo(() => {
    if (!ingresoValido) return { califican20: 0, califican30: 0, califican40: 0 };

    const disponibles = vehiculos.filter((v) => v.estadoDisponibilidad !== 'vendido');
    return {
      califican20: disponibles.filter((v) => v.precio <= precioMax20).length,
      califican30: disponibles.filter((v) => v.precio <= precioMax30).length,
      califican40: disponibles.filter((v) => v.precio <= precioMax40).length,
    };
  }, [vehiculos, ingresoValido, precioMax20, precioMax30, precioMax40]);

  const navegarACatalogoFiltrado = (precioMax: number) => {
    const redondeado = Math.round(precioMax);
    navigate(`/catalogo?precioMax=${redondeado}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Vehículo de muestra para el modal de contacto si no hay vehículo específico
  const vehiculoReferencia = vehiculos[0];

  return (
    <div
      className="calculadora-capacidad-card"
      style={{
        backgroundColor: 'var(--blanco)',
        border: '1px solid var(--borde-claro)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        boxShadow: '0 2px 12px rgba(43, 43, 43, 0.04)',
      }}
    >
      <div>
        <span
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
            color: 'var(--naranja-600)',
          }}
        >
          Capacidad de Financiamiento
        </span>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 0', color: 'var(--carbon)' }}>
          Calcula tu cuota mensual máxima según tus ingresos
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
          Conoce tu límite de endeudamiento responsable (30% de tu ingreso mensual) y filtra los vehículos a tu alcance.
        </p>
      </div>

      {/* Estado: Parámetros no disponibles */}
      {!calculoDisponible && (
        <div
          style={{
            backgroundColor: '#FFF7ED',
            border: '1px solid #FDBA74',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--naranja-700)', fontWeight: 700, fontSize: '13px' }}>
            ⚠️ Cálculo no disponible
          </div>
          <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
            No se pudieron obtener los parámetros de crédito vigentes desde Supabase. Los cálculos automáticos están inhabilitados.
          </p>
        </div>
      )}

      {calculoDisponible && (
        <>
          {/* Campo de ingreso mensual */}
          <div>
            <label style={{ display: 'block' }}>
              <span className="form-label" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--carbon)' }}>
                Ingreso mensual en USD
              </span>
              <div style={{ position: 'relative', marginTop: '6px' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 700,
                    color: 'var(--texto-mudo)',
                    fontSize: '15px',
                  }}
                >
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="50"
                  placeholder="Ej. 1000"
                  value={ingresoInput}
                  onChange={(e) => setIngresoInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 28px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${mensajeError ? '#DC2626' : 'var(--borde)'}`,
                    fontSize: '16px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    backgroundColor: 'var(--blanco)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </label>

            {mensajeError && (
              <div style={{ color: '#DC2626', fontSize: '12px', marginTop: '6px', fontWeight: 500 }}>
                {mensajeError}
              </div>
            )}
          </div>

          {/* Texto fijo: Plazo: 24 meses */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              backgroundColor: 'var(--superficie)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--borde-claro)',
              fontSize: '13px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--carbon)' }}>Plazo: 24 meses</span>
            <span style={{ color: 'var(--texto-mudo)', fontSize: '12px' }}>Cuotas fijas · Amortización francesa</span>
          </div>

          {/* Resultados de capacidad */}
          {ingresoValido && (
            <div
              style={{
                backgroundColor: 'var(--naranja-50)',
                border: '1px solid var(--naranja-200)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 700,
                    color: 'var(--naranja-700)',
                  }}
                >
                  Cuota mensual máxima
                </span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--carbon)' }}>
                  {formatoUSD(cuotaMaxima)}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--naranja-200)',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: 'var(--texto-secundario)' }}>Precio máximo de vehículo (20% inicial):</span>
                <strong style={{ color: 'var(--carbon)', fontSize: '15px' }}>{formatoUSD(precioMax20)}</strong>
              </div>
            </div>
          )}

          {/* Botón de acción: Ver vehículos con estas cuotas */}
          {ingresoValido && (
            <div>
              <Boton
                variant="primary"
                fullWidth
                onClick={() => navegarACatalogoFiltrado(precioMax20)}
              >
                Ver vehículos con estas cuotas ({califican20} disponibles)
              </Boton>
            </div>
          )}

          {/* Estado sin resultados cuando ningún vehículo califica con 20% inicial */}
          {ingresoValido && califican20 === 0 && (
            <div
              style={{
                backgroundColor: 'var(--superficie)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--carbon)' }}>
                  💡 Subir la inicial amplía tus opciones
                </h4>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: 1.4 }}>
                  Con una inicial del 20% ningún vehículo del inventario actual tiene un precio menor a {formatoUSD(precioMax20)}.
                  Sin embargo, al aportar un porcentaje mayor de inicial, el valor del vehículo al que puedes aspirar se incrementa manteniendo tu cuota máxima:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                <div
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--borde)',
                    backgroundColor: 'var(--blanco)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--texto-mudo)' }}>Con 30% inicial</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--carbon)', margin: '2px 0' }}>
                    Hasta {formatoUSD(precioMax30)}
                  </div>
                  <div style={{ fontSize: '11px', color: califican30 > 0 ? 'var(--naranja-600)' : 'var(--texto-mudo)' }}>
                    {califican30} {califican30 === 1 ? 'vehículo califica' : 'vehículos califican'}
                  </div>
                  {califican30 > 0 && (
                    <button
                      type="button"
                      onClick={() => navegarACatalogoFiltrado(precioMax30)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '6px',
                        background: 'none',
                        border: '1px solid var(--naranja-500)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--naranja-600)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Ver ({califican30})
                    </button>
                  )}
                </div>

                <div
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--borde)',
                    backgroundColor: 'var(--blanco)',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--texto-mudo)' }}>Con 40% inicial</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--carbon)', margin: '2px 0' }}>
                    Hasta {formatoUSD(precioMax40)}
                  </div>
                  <div style={{ fontSize: '11px', color: califican40 > 0 ? 'var(--naranja-600)' : 'var(--texto-mudo)' }}>
                    {califican40} {califican40 === 1 ? 'vehículo califica' : 'vehículos califican'}
                  </div>
                  {califican40 > 0 && (
                    <button
                      type="button"
                      onClick={() => navegarACatalogoFiltrado(precioMax40)}
                      style={{
                        marginTop: '8px',
                        width: '100%',
                        padding: '6px',
                        background: 'none',
                        border: '1px solid var(--naranja-500)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--naranja-600)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Ver ({califican40})
                    </button>
                  )}
                </div>
              </div>

              {/* Enlace al flujo de captura de prospectos del Módulo 010 (CRM) */}
              <div style={{ borderTop: '1px dashed var(--borde-claro)', paddingTop: 'var(--space-sm)' }}>
                <p style={{ fontSize: '11px', color: 'var(--texto-secundario)', margin: '0 0 8px', lineHeight: 1.3 }}>
                  ¿Necesitas una estructura de financiamiento a tu medida? Nuestros analistas de crédito pueden evaluar tu caso.
                </p>
                {vehiculoReferencia ? (
                  <Boton
                    variant="secondary"
                    fullWidth
                    onClick={() => setModalContactoAbierto(true)}
                  >
                    Hablar con un Asesor de Crédito WAMMA
                  </Boton>
                ) : (
                  <a
                    href="https://wa.me/584140000000?text=Hola%20WAMMA,%20deseo%20asesor%C3%ADa%20para%20un%20plan%20de%20financiamiento"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      padding: '10px',
                      backgroundColor: 'var(--carbon)',
                      color: 'var(--blanco)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Contactar a un Asesor por WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Agendamiento / Captura de Prospecto CRM */}
      {modalContactoAbierto && vehiculoReferencia && (
        <ModalAgendarCita
          vehiculo={vehiculoReferencia}
          rateBCV={rateBCV}
          interesFinanciamientoInicial={true}
          onCerrar={() => setModalContactoAbierto(false)}
        />
      )}
    </div>
  );
};
