import React, { useState } from 'react';
import type { VehiculoData } from '../types/vehiculo';

/**
 * Fotografía del vehículo.
 *
 * Las fotos de `public/vehiculos/` son **marcadores de posición** con licencia
 * libre (ver `mocks/creditosFotos.ts`): corresponden al modelo pero no son
 * unidades reales del inventario. Si la imagen falta o falla la carga, se cae
 * a una silueta teñida con el color de la carrocería.
 */

interface FotoVehiculoProps {
  vehiculo: VehiculoData;
  alto?: number | string;
  redondeo?: string;
  /** `cover` recorta para llenar; `contain` muestra el vehículo completo. */
  ajuste?: 'cover' | 'contain';
}

/** Siluetas simplificadas por tipo de carrocería, usadas como respaldo. */
const SILUETAS: Record<string, string> = {
  'Pick-up': 'M2 15h2l1-4h6l2 4h9v3h-1a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2z',
  Camioneta: 'M2 15h2l1-4h6l2 4h9v3h-1a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2z',
  SUV: 'M2 16l1-5 3-3h9l4 4 3 1v3h-1a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2z',
  Coupé: 'M2 16l2-4 5-3h6l5 4 3 1v2h-1a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2z',
  Sedán: 'M2 16l2-4 4-3h8l4 3 3 1v3h-1a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2z',
  Hatchback: 'M2 16l2-4 4-3h7l5 4 2 1v2h-1a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2z',
};

export const FotoVehiculo: React.FC<FotoVehiculoProps> = ({
  vehiculo,
  alto = 180,
  redondeo = 'var(--radius-md) var(--radius-md) 0 0',
  ajuste = 'cover',
}) => {
  const [fallo, setFallo] = useState(false);
  const descripcion = `${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`;

  const contenedor: React.CSSProperties = {
    height: typeof alto === 'number' ? `${alto}px` : alto,
    borderRadius: redondeo,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#EFEDEA',
  };

  // Respaldo: silueta sobre degradado con el color de la carrocería.
  if (!vehiculo.foto || fallo) {
    return (
      <div
        role="img"
        aria-label={`Imagen referencial de ${descripcion}`}
        style={{
          ...contenedor,
          background: `linear-gradient(140deg, ${vehiculo.color} 0%, #2A2A28 100%)`,
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="rgba(255,255,255,0.22)"
          style={{ width: '55%', maxWidth: '220px' }}
          aria-hidden="true"
        >
          <path d={SILUETAS[vehiculo.carroceria] ?? SILUETAS['Sedán']} />
          <circle cx="6" cy="18" r="2" fill="rgba(255,255,255,0.35)" />
          <circle cx="18" cy="18" r="2" fill="rgba(255,255,255,0.35)" />
        </svg>
        <span
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '12px',
            color: 'var(--blanco)',
            fontSize: '11px',
            fontWeight: 700,
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}
        >
          Imagen referencial
        </span>
      </div>
    );
  }

  return (
    <div style={contenedor}>
      <img
        src={vehiculo.foto}
        alt={`Fotografía referencial de ${descripcion}`}
        loading="lazy"
        decoding="async"
        onError={() => setFallo(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: ajuste,
          display: 'block',
        }}
      />
      {/* El aviso solo corresponde a las fotos referenciales; las propias de WAMMA son de la unidad. */}
      {vehiculo.fotos?.[0]?.credito && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '18px 12px 6px',
            color: 'var(--blanco)',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
            pointerEvents: 'none',
          }}
        >
          Foto referencial del modelo
        </span>
      )}
    </div>
  );
};
