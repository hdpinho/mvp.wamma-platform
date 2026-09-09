import React from 'react';

interface PrecioMonedaProps {
  amountUSD: number;
  rateBCV?: number;
  showSubtitle?: boolean;
}

export const PrecioMoneda: React.FC<PrecioMonedaProps> = ({
  amountUSD,
  rateBCV = 36.50,
  showSubtitle = true,
}) => {
  const amountVES = amountUSD * rateBCV;

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatVES = (val: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + ' Bs.';
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
      <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--texto-primario)' }}>
        {formatUSD(amountUSD)}
      </span>
      {showSubtitle && (
        <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
          Ref. {formatVES(amountVES)} <span style={{ color: 'var(--texto-mudo)' }}>· tasa BCV {rateBCV.toFixed(2)}</span>
        </span>
      )}
    </div>
  );
};
