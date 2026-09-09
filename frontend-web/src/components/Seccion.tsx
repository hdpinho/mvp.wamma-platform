import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Encabezado de sección con título, bajada opcional y enlace de "ver todo".
 * Unifica el ritmo vertical del Home y de las pantallas largas.
 */

interface SeccionProps {
  titulo: string;
  bajada?: string;
  enlace?: { texto: string; a: string };
  children: React.ReactNode;
}

export const Seccion: React.FC<SeccionProps> = ({ titulo, bajada, enlace, children }) => (
  <section style={{ marginBottom: 'var(--space-xxxl)' }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h2 style={{ fontSize: '22px', lineHeight: 1.25 }}>{titulo}</h2>
        {bajada && (
          <p
            style={{
              fontSize: '14px',
              color: 'var(--texto-secundario)',
              marginTop: 'var(--space-xs)',
              maxWidth: '62ch',
            }}
          >
            {bajada}
          </p>
        )}
      </div>

      {enlace && (
        <Link
          to={enlace.a}
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--naranja-700)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {enlace.texto} →
        </Link>
      )}
    </div>

    {children}
  </section>
);
