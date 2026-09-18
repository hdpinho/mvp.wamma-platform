import React from 'react';

/**
 * Precio en euros con su equivalencia informativa en bolívares (D-21).
 * La tasa la registra el backoffice a diario; sin tasa, solo se muestra el euro.
 */
interface PrecioMonedaProps {
  monto: number;
}

const formatoEUR = (valor: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(valor) ? valor : 0);

export const PrecioMoneda: React.FC<PrecioMonedaProps> = ({
  monto,
}) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--texto-primario)' }}>
      {formatoEUR(monto)}
    </span>
  </div>
);
