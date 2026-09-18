import React, { useMemo, useState } from 'react';
import { Boton } from './Boton';
import {
  calcularCuota,
  formatoEUR,
  NOTA_BLOQUEO_VEHICULO,
} from '../services/financiamientoMotor';
import { useParametrosFinanciamiento } from '../services/parametrosFinanciamiento';

export interface DatosSimulacion {
  precio: number;
  inicialPct: number;
  cuotaInicialEUR: number;
  cuotaInicialUSD?: number;
  montoFinanciado: number;
  plazo: number;
  cuota: number;
}

interface SimuladorCuotaProps {
  /** Nombre del vehículo mostrado en el encabezado. */
  nombreVehiculo?: string;
  /** Precio de venta en EUR. */
  precio?: number;
  /** Permite editar el precio dentro del simulador (ej. en Home o cotizador abierto). */
  precioEditable?: boolean;
  /** Tasa oficial BCV (opcional). */
  rateBCV?: number;
  /** Acción principal al pulsar «Agendar». */
  onAgendar?: () => void;
  /** Compatibilidad: recibe los datos completos de la simulación. */
  onSolicitar?: (datos: DatosSimulacion) => void;
  /** Texto personalizado para el botón de acción (por defecto «Agendar»). */
  textoBoton?: string;
  /** Desactiva el botón de agendar (ej. vehículo vendido o con cita en curso). */
  botonDeshabilitado?: boolean;
  /** Motivo por el cual el botón está deshabilitado. */
  motivoDeshabilitado?: string;
}

export const SimuladorCuota: React.FC<SimuladorCuotaProps> = ({
  nombreVehiculo,
  precio: precioInicial = 15400,
  precioEditable = false,
  onAgendar,
  onSolicitar,
  textoBoton = 'Agendar cita',
  botonDeshabilitado = false,
  motivoDeshabilitado,
}) => {
  const { parametros, error } = useParametrosFinanciamiento();

  const [precioEditado, setPrecioEditado] = useState<number | null>(null);
  const precio = precioEditado ?? (Number.isFinite(precioInicial) && precioInicial > 0 ? precioInicial : 15400);

  // Inicial por defecto 20% (0.20)
  const [inicialPct, setInicialPct] = useState<number>(0.20);
  const [detalleAbierto, setDetalleAbierto] = useState<boolean>(false);

  // Si fallan los parámetros en Supabase/backend, no se calculan cuotas de respaldo
  const calculoDisponible = Boolean(parametros && !error);

  const opcionesInicial = parametros?.opcionesInicial || [0.20, 0.30, 0.40];
  const plazoMeses = parametros?.plazoMeses || 24;

  const {
    montoInicial,
    montoFinanciado,
    cuota,
    totalIntereses,
    costoTotal,
    cuotaDefecto20,
    inicialDefecto20,
  } = useMemo(() => {
    if (!calculoDisponible || !parametros || precio <= 0) {
      return {
        montoInicial: 0,
        montoFinanciado: 0,
        cuota: 0,
        totalIntereses: 0,
        costoTotal: 0,
        cuotaDefecto20: 0,
        inicialDefecto20: 0,
      };
    }

    const mInicial = precio * inicialPct;
    const mFinanciado = precio - mInicial;
    const cuotaCalculada = calcularCuota(precio, inicialPct, parametros);

    const ini20 = precio * 0.20;
    const cuota20 = calcularCuota(precio, 0.20, parametros);

    const cTotal = cuotaCalculada * plazoMeses;
    const tIntereses = Math.max(0, cTotal - mFinanciado);

    return {
      montoInicial: mInicial,
      montoFinanciado: mFinanciado,
      cuota: cuotaCalculada,
      totalIntereses: tIntereses,
      costoTotal: cTotal,
      cuotaDefecto20: cuota20,
      inicialDefecto20: ini20,
    };
  }, [calculoDisponible, parametros, precio, inicialPct, plazoMeses]);

  const handleAccion = () => {
    if (onAgendar) {
      onAgendar();
    } else if (onSolicitar) {
      onSolicitar({
        precio,
        inicialPct,
        cuotaInicialEUR: montoInicial,
        cuotaInicialUSD: montoInicial,
        montoFinanciado,
        plazo: plazoMeses,
        cuota,
      });
    }
  };

  return (
    <div
      className="simulador-cuota-tarjeta"
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
      {/* Encabezado con el nombre del vehículo */}
      {nombreVehiculo && (
        <div style={{ borderBottom: '1px solid var(--borde-claro)', paddingBottom: 'var(--space-md)' }}>
          <span
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: 'var(--texto-mudo)',
            }}
          >
            Plan de Financiamiento
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 0', color: 'var(--carbon)' }}>
            {nombreVehiculo}
          </h2>
        </div>
      )}

      {/* Resumen de cabecera: "$X inicial" y "$Y × 24 meses" (opción 20% por defecto) */}
      {calculoDisponible && (
        <div
          style={{
            backgroundColor: 'var(--superficie)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            border: '1px solid var(--borde-claro)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--carbon)',
            }}
          >
            <span>{formatoEUR(inicialDefecto20)} inicial</span>
            <span style={{ color: 'var(--naranja-600)', fontSize: '17px' }}>
              {formatoEUR(cuotaDefecto20)} × {plazoMeses} meses
            </span>
          </div>
        </div>
      )}

      {/* Botón principal «Agendar» con nota de bloqueo */}
      <div>
        <Boton
          variant="primary"
          fullWidth
          disabled={botonDeshabilitado || !calculoDisponible}
          onClick={handleAccion}
        >
          {textoBoton}
        </Boton>

        {botonDeshabilitado && motivoDeshabilitado ? (
          <p
            style={{
              fontSize: '12px',
              color: 'var(--texto-secundario)',
              margin: '8px 0 0',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {motivoDeshabilitado}
          </p>
        ) : (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--texto-mudo)',
              margin: '8px 0 0',
              textAlign: 'center',
              lineHeight: 1.35,
            }}
          >
            {NOTA_BLOQUEO_VEHICULO}
          </p>
        )}
      </div>

      {/* Selector de precio editable si aplica */}
      {precioEditable && (
        <label style={{ display: 'block' }}>
          <span className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
            Precio del vehículo (EUR)
          </span>
          <input
            type="number"
            className="form-input"
            min={1000}
            step={100}
            value={precio}
            onChange={(e) => setPrecioEditado(Math.max(0, Number(e.target.value)))}
          />
        </label>
      )}

      {/* Estado: Cálculo no disponible (Requisito B.5) */}
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
          <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', margin: '4px 0 0', lineHeight: 1.4 }}>
            No pudimos sincronizar los parámetros de financiamiento aprobados. Por seguridad comercial,
            no se presentan cálculos estimados sin validación oficial.
          </p>
        </div>
      )}

      {/* Sección «Simula tu cuota» */}
      {calculoDisponible && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--carbon)' }}>
              Simula tu cuota
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', margin: '2px 0 0' }}>
              Ajusta la inicial para ver cuánto pagarías al mes
            </p>
          </div>

          {/* Selector de tres opciones de inicial: 20%, 30%, 40% */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--texto-secundario)' }}>Inicial</span>
              <strong style={{ color: 'var(--carbon)' }}>
                {Math.round(inicialPct * 100)}% · {formatoEUR(montoInicial)}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              {opcionesInicial.map((pct) => {
                const seleccionado = inicialPct === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setInicialPct(pct)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: seleccionado ? 700 : 500,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${seleccionado ? 'var(--naranja-500)' : 'var(--borde)'}`,
                      backgroundColor: seleccionado ? 'var(--naranja-50)' : 'var(--blanco)',
                      color: seleccionado ? 'var(--naranja-700)' : 'var(--texto-secundario)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {Math.round(pct * 100)}%
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plazo mostrado como texto fijo: "Plazo: 24 meses" */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--superficie)',
              border: '1px solid var(--borde-claro)',
              fontSize: '12px',
            }}
          >
            <span style={{ color: 'var(--texto-secundario)', fontWeight: 500 }}>Plazo: 24 meses</span>
            <span style={{ color: 'var(--texto-mudo)', fontSize: '11px' }}>Cuotas mensuales fijas</span>
          </div>

          {/* Recuadro de resultado: Etiqueta debe decir solo "Cuota" */}
          <div
            style={{
              backgroundColor: 'var(--naranja-50)',
              border: '1px solid var(--naranja-200)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-lg)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--naranja-700)',
              }}
            >
              Cuota
            </div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 800,
                lineHeight: 1.15,
                color: 'var(--carbon)',
                margin: '4px 0',
              }}
            >
              {formatoEUR(cuota)}
            </div>
          </div>

          {/* Lo que hoy aparece debajo de la cuota se mueve al desplegable "Ver detalle" */}
          <div style={{ borderTop: '1px dashed var(--borde-claro)', paddingTop: 'var(--space-sm)' }}>
            <button
              type="button"
              onClick={() => setDetalleAbierto(!detalleAbierto)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--naranja-600)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{detalleAbierto ? '▾' : '▸'} Ver detalle de la operación</span>
              <span style={{ fontSize: '10px', color: 'var(--texto-mudo)', fontWeight: 400 }}>
                (pendiente validación legal)
              </span>
            </button>

            {detalleAbierto && (
              <div
                style={{
                  marginTop: 'var(--space-sm)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--superficie)',
                  border: '1px solid var(--borde-claro)',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--texto-secundario)' }}>Monto financiado:</span>
                  <strong>{formatoEUR(montoFinanciado)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--texto-secundario)' }}>Tasa mensual aplicada:</span>
                  <strong>4.0% (48% anual)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--texto-secundario)' }}>Total intereses estimados:</span>
                  <strong>{formatoEUR(totalIntereses)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--borde-claro)', paddingTop: '6px' }}>
                  <span style={{ color: 'var(--texto-secundario)' }}>Total a pagar (24 meses):</span>
                  <strong style={{ color: 'var(--naranja-700)' }}>{formatoEUR(costoTotal)}</strong>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--texto-mudo)',
                    marginTop: '4px',
                    lineHeight: 1.3,
                  }}
                >
                  * Cifras y desglose financiero sujetos a validación de términos por asesoría legal.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
