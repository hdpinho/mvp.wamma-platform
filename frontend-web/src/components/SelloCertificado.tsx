import React from 'react';

export const SelloCertificado: React.FC = () => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'var(--naranja-50)',
        border: '1px solid var(--naranja-200)',
        padding: '6px 12px',
        borderRadius: 'var(--radius-pill)',
        color: 'var(--naranja-700)',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {/* Tiny ascending arrow symbol in SVG matching the WAMMA brand concept */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
      Certificado · 240 Puntos
    </div>
  );
};
