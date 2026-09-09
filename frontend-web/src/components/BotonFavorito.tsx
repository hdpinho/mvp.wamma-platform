import React from 'react';
import { useFavoritos } from '../state/favoritosContexto';

/**
 * Corazón para guardar un vehículo. Fase 2 (módulo 12 · Marketplace).
 */

interface BotonFavoritoProps {
  vehiculoId: string;
  /** `sobreFoto` se pinta encima de la imagen; `plano` va sobre fondo claro. */
  variante?: 'sobreFoto' | 'plano';
  tamano?: number;
}

export const BotonFavorito: React.FC<BotonFavoritoProps> = ({
  vehiculoId,
  variante = 'sobreFoto',
  tamano = 18,
}) => {
  const { esFavorito, alternarFavorito } = useFavoritos();
  const activo = esFavorito(vehiculoId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        alternarFavorito(vehiculoId);
      }}
      aria-pressed={activo}
      aria-label={activo ? 'Quitar de guardados' : 'Guardar vehículo'}
      title={activo ? 'Quitar de guardados' : 'Guardar vehículo'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${tamano + 20}px`,
        height: `${tamano + 20}px`,
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        border:
          variante === 'sobreFoto' ? '1px solid rgba(255,255,255,0.45)' : '1px solid var(--borde)',
        backgroundColor: variante === 'sobreFoto' ? 'rgba(0,0,0,0.35)' : 'var(--blanco)',
        color: activo ? 'var(--naranja-500)' : variante === 'sobreFoto' ? '#FFFFFF' : 'var(--texto-mudo)',
        backdropFilter: variante === 'sobreFoto' ? 'blur(2px)' : undefined,
      }}
    >
      <svg
        width={tamano}
        height={tamano}
        viewBox="0 0 24 24"
        fill={activo ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
};
