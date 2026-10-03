import React from 'react';

/**
 * Rótulo obligatorio para todo dato que no proviene de una fuente oficial.
 *
 * La Constitución prohíbe presentar cifras inventadas como si fueran datos de
 * negocio. Cualquier monto, cuota o condición mostrada en la maqueta debe ir
 * acompañada de este rótulo.
 */

interface NotaSimuladaProps {
  children: React.ReactNode;
  /** `inline` para una línea al pie de un dato; `bloque` para avisos destacados. */
  variante?: 'inline' | 'bloque';
}

export const NotaSimulada: React.FC<NotaSimuladaProps> = ({ children, variante = 'inline' }) => {
  if (variante === 'inline') {
    return (
      <p
        style={{
          fontSize: '11px',
          lineHeight: 1.4,
          color: 'var(--texto-mudo)',
          margin: 0,
        }}
      >
        <span style={{ fontWeight: 700 }}>* Dato simulado. </span>
        {children}
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-sm)',
        alignItems: 'flex-start',
        backgroundColor: 'var(--aviso-fondo)',
        border: '1px solid #EFD9AE',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        fontSize: '12px',
        lineHeight: 1.5,
        color: 'var(--aviso-texto)',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        style={{ flexShrink: 0, marginTop: '1px' }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>{children}</span>
    </div>
  );
};
