import React from 'react';

export const SelloGPS: React.FC = () => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'var(--exito-fondo)',
        border: '1px solid #BCE5D9',
        padding: '6px 12px',
        borderRadius: 'var(--radius-pill)',
        color: 'var(--exito-texto)',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          backgroundColor: 'var(--exito-texto)',
          borderRadius: '50%',
          animation: 'pulse 2s infinite',
        }}
      />
      GPS Activo · Vehículo Localizado
    </div>
  );
};
