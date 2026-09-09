import React from 'react';

/**
 * Chip de filtro. En estado activo usa el naranja de marca; al activarse muestra
 * una equis para retirarlo, como en los filtros aplicados del catálogo.
 */

interface ChipFiltroProps {
  etiqueta: string;
  activo?: boolean;
  onClick?: () => void;
  /** Muestra la equis de "quitar" cuando está activo. */
  removible?: boolean;
}

export const ChipFiltro: React.FC<ChipFiltroProps> = ({
  etiqueta,
  activo = false,
  onClick,
  removible = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-xs)',
      padding: '7px 14px',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      fontWeight: activo ? 700 : 400,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      border: `1px solid ${activo ? 'var(--naranja-500)' : 'var(--borde)'}`,
      backgroundColor: activo ? 'var(--naranja-500)' : 'var(--blanco)',
      color: activo ? 'var(--blanco)' : 'var(--texto-secundario)',
    }}
  >
    {etiqueta}
    {removible && activo && (
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )}
  </button>
);
