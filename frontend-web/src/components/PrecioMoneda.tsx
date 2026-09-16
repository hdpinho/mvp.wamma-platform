import React from 'react';

/**
 * Precio en euros con su equivalencia informativa en bolívares (D-21).
 * La tasa la registra el backoffice a diario; sin tasa, solo se muestra el euro.
 */
interface PrecioMonedaProps {
  monto: number;
  /** Bolívares por euro. */
  tasaBcv?: number | null;
  mostrarEquivalencia?: boolean;
}

const formatoEUR = (valor: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);

const formatoBs = (valor: number) =>
  `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor)} Bs.`;

export const PrecioMoneda: React.FC<PrecioMonedaProps> = ({
  monto,
  tasaBcv,
  mostrarEquivalencia = true,
}) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--texto-primario)' }}>
      {formatoEUR(monto)}
    </span>
    {mostrarEquivalencia && tasaBcv ? (
      <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
        Ref. {formatoBs(monto * tasaBcv)}{' '}
        <span style={{ color: 'var(--texto-mudo)' }}>· tasa BCV {tasaBcv.toFixed(2)}</span>
      </span>
    ) : null}
  </div>
);
