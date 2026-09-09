import React from 'react';

/**
 * Patrón de marca — ondas orgánicas.
 *
 * Tomado de la lámina "Patrones" del manual. Uso decorativo únicamente: nunca
 * detrás de texto de lectura, siempre a baja opacidad y sin competir con el
 * contenido. Es puramente ornamental, por eso queda oculto a lectores de pantalla.
 */

interface PatronOndasProps {
  /** Color de los trazos. Por defecto blanco, para usar sobre el naranja de marca. */
  color?: string;
  opacidad?: number;
}

export const PatronOndas: React.FC<PatronOndasProps> = ({
  color = '#FFFFFF',
  opacidad = 0.16,
}) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 1200 400"
    preserveAspectRatio="none"
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      opacity: opacidad,
    }}
  >
    <g fill="none" stroke={color} strokeWidth="14" strokeLinecap="round">
      <path d="M-60 90 C 180 -30, 420 210, 700 60 S 1120 -10, 1280 110" />
      <path d="M-60 170 C 200 40, 460 280, 740 120 S 1140 70, 1280 190" />
      <path d="M-60 330 C 220 210, 500 430, 780 280 S 1160 240, 1280 350" />
    </g>
  </svg>
);
