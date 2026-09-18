import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boton } from './Boton';
import {
  calcularCuotaMaxima,
  formatoEUR,
} from '../services/financiamientoMotor';
import { cuotaDesde } from '../mocks/financiamiento';
import { useParametrosFinanciamiento } from '../services/parametrosFinanciamiento';
import { useVehiculos } from '../state/vehiculosContexto';

interface CalculadoraCapacidadProps {
  rateBCV?: number;
}

export const CalculadoraCapacidad: React.FC<CalculadoraCapacidadProps> = ({ rateBCV: _rateBCV = 0 }) => {
  const navigate = useNavigate();
  const { vehiculos } = useVehiculos();
  const { parametros, error } = useParametrosFinanciamiento();

  const [ingresoInput, setIngresoInput] = useState<string>('1000');

  const calculoDisponible = Boolean(parametros && !error);

  const ingresoNum = Number(ingresoInput);
  const ingresoValido = Number.isFinite(ingresoNum) && ingresoNum > 0;

  // Validación y mensaje de error claro
  const mensajeError = useMemo(() => {
    if (ingresoInput.trim() === '') {
      return 'Por favor ingresa tu ingreso mensual en euros (€).';
    }
    if (!Number.isFinite(ingresoNum) || ingresoNum <= 0) {
      return 'El ingreso mensual debe ser un número positivo mayor a €0.';
    }
    return null;
  }, [ingresoInput, ingresoNum]);

  // Cálculo de cuota máxima según el 30% de capacidad de endeudamiento
  const cuotaMaxima = useMemo(() => {
    if (!calculoDisponible || !parametros || !ingresoValido) {
      return 0;
    }
    return calcularCuotaMaxima(ingresoNum, parametros);
  }, [calculoDisponible, parametros, ingresoNum, ingresoValido]);

  // Vehículos en inventario cuya cuota mensual califica dentro de la cuota máxima
  const califican = useMemo(() => {
    if (!ingresoValido || cuotaMaxima <= 0) return 0;
    const disponibles = vehiculos.filter((v) => v.estadoDisponibilidad !== 'vendido');
    return disponibles.filter((v) => cuotaDesde(v.precio) <= cuotaMaxima).length;
  }, [vehiculos, ingresoValido, cuotaMaxima]);

  const navegarACatalogoFiltrado = (cuota: number) => {
    const redondeado = Math.round(cuota);
    navigate(`/catalogo?cuotaMax=${redondeado}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          Conoce tu límite de endeudamiento responsable y filtra los vehículos a tu alcance.
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
            No se pudieron obtener los parámetros de crédito vigentes. Los cálculos automáticos están inhabilitados.
          </p>
        </div>
      )}

      {calculoDisponible && (
        <>
          {/* Campo de ingreso mensual */}
          <div>
            <label style={{ display: 'block' }}>
              <span className="form-label" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--carbon)' }}>
                Ingreso mensual en EUR
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
                  €
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

          {/* Resultados de capacidad: Cuota mensual máxima */}
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
                <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--carbon)' }}>
                  {formatoEUR(cuotaMaxima)} /mes
                </span>
              </div>
            </div>
          )}

          {/* Botón de acción: Ver vehículos con estas cuotas */}
          {ingresoValido && (
            <div>
              <Boton
                variant="primary"
                fullWidth
                onClick={() => navegarACatalogoFiltrado(cuotaMaxima)}
              >
                Ver vehículos con estas cuotas ({califican} disponibles)
              </Boton>
            </div>
          )}

        </>
      )}
    </div>
  );
};
