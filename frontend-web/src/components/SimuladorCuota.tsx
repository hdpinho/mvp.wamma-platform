import React, { useMemo, useState } from 'react';
import { Boton } from './Boton';
import { NotaSimulada } from './NotaSimulada';
import { PARAMETROS_FINANCIAMIENTO, calcularCuota } from '../mocks/financiamiento';

/**
 * Simulador de cuota. Sin lógica de negocio real: el cálculo es el sistema
 * francés con los parámetros simulados de `mocks/financiamiento.ts`.
 * El motor real vive en los módulos 006 y 007, aún no construidos.
 */

/** Valores con los que el usuario dejó el simulador al pulsar el botón. */
export interface DatosSimulacion {
  precioUSD: number;
  inicialPct: number;
  cuotaInicialUSD: number;
  montoFinanciado: number;
  plazo: number;
  cuota: number;
}

interface SimuladorCuotaProps {
  /** Precio de partida. Si se omite, el usuario lo escribe. */
  precioUSD?: number;
  /** Permite editar el precio dentro del simulador (uso en Home). */
  precioEditable?: boolean;
  rateBCV?: number;
  /** Recibe la simulación actual para arrastrarla a la solicitud (C5). */
  onSolicitar?: (datos: DatosSimulacion) => void;
  textoBoton?: string;
}

const formatoUSD = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

export const SimuladorCuota: React.FC<SimuladorCuotaProps> = ({
  precioUSD = 12000,
  precioEditable = false,
  rateBCV = 36.5,
  onSolicitar,
  textoBoton = 'Solicitar financiamiento',
}) => {
  const [precio, setPrecio] = useState(precioUSD);
  const [inicialPct, setInicialPct] = useState<number>(PARAMETROS_FINANCIAMIENTO.inicialPorcentaje);
  const [plazo, setPlazo] = useState<number>(PARAMETROS_FINANCIAMIENTO.plazoPorDefecto);

  const { inicial, montoFinanciado, cuota } = useMemo(() => {
    const ini = precio * inicialPct;
    const financiado = precio - ini;
    return { inicial: ini, montoFinanciado: financiado, cuota: calcularCuota(financiado, plazo) };
  }, [precio, inicialPct, plazo]);

  return (
    <div
      style={{
        backgroundColor: 'var(--blanco)',
        border: '1px solid var(--borde-claro)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
      }}
    >
      <div>
        <h3 style={{ fontSize: '18px' }}>Simula tu cuota</h3>
        <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
          Ajusta la inicial y el plazo para ver cuánto pagarías al mes.
        </p>
      </div>

      {precioEditable && (
        <label style={{ display: 'block' }}>
          <span className="form-label">Precio del vehículo (USD)</span>
          <input
            type="number"
            className="form-input"
            min={1000}
            step={100}
            value={precio}
            onChange={(e) => setPrecio(Math.max(0, Number(e.target.value)))}
          />
        </label>
      )}

      {/* Inicial */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            marginBottom: 'var(--space-sm)',
          }}
        >
          <span className="form-label" style={{ margin: 0 }}>
            Inicial
          </span>
          <strong>
            {Math.round(inicialPct * 100)}% · {formatoUSD(inicial)}
          </strong>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {PARAMETROS_FINANCIAMIENTO.inicialesDisponibles.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setInicialPct(pct)}
              style={{
                flex: '1 1 60px',
                padding: '8px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: inicialPct === pct ? 700 : 400,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${inicialPct === pct ? 'var(--naranja-500)' : 'var(--borde)'}`,
                backgroundColor: inicialPct === pct ? 'var(--naranja-50)' : 'var(--blanco)',
                color: inicialPct === pct ? 'var(--naranja-700)' : 'var(--texto-secundario)',
              }}
            >
              {Math.round(pct * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Plazo */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            marginBottom: 'var(--space-sm)',
          }}
        >
          <span className="form-label" style={{ margin: 0 }}>
            Plazo
          </span>
          <strong>{plazo} meses</strong>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          {PARAMETROS_FINANCIAMIENTO.plazosMeses.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPlazo(m)}
              style={{
                flex: '1 1 60px',
                padding: '8px',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: plazo === m ? 700 : 400,
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${plazo === m ? 'var(--naranja-500)' : 'var(--borde)'}`,
                backgroundColor: plazo === m ? 'var(--naranja-50)' : 'var(--blanco)',
                color: plazo === m ? 'var(--naranja-700)' : 'var(--texto-secundario)',
              }}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Resultado */}
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
            letterSpacing: '0.06em',
            color: 'var(--naranja-700)',
          }}
        >
          Cuota mensual estimada
        </div>
        <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.2 }}>
          {formatoUSD(cuota)}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
          Ref. {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(cuota * rateBCV)}{' '}
          Bs. · tasa BCV {rateBCV.toFixed(2)}
        </div>
        <div
          style={{
            marginTop: 'var(--space-md)',
            paddingTop: 'var(--space-md)',
            borderTop: '1px solid var(--naranja-200)',
            fontSize: '12px',
            color: 'var(--texto-secundario)',
            display: 'grid',
            gap: '2px',
          }}
        >
          <span>Monto a financiar: {formatoUSD(montoFinanciado)}</span>
          <span>
            Tasa {(PARAMETROS_FINANCIAMIENTO.tasaMensual * 100).toFixed(1)}% mensual ·{' '}
            {(PARAMETROS_FINANCIAMIENTO.tasaAnual * 100).toFixed(0)}% anual
          </span>
        </div>
      </div>

      {onSolicitar && (
        <Boton
          variant="primary"
          fullWidth
          onClick={() =>
            onSolicitar({
              precioUSD: precio,
              inicialPct,
              cuotaInicialUSD: inicial,
              montoFinanciado,
              plazo,
              cuota,
            })
          }
        >
          {textoBoton}
        </Boton>
      )}

      <NotaSimulada>
        Tasas y plazos aún no confirmados por WAMMA. Sujeto a aprobación crediticia; no constituye
        una oferta.
      </NotaSimulada>
    </div>
  );
};
