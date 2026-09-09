import React from 'react';
import type { Imperfeccion } from '../types/vehiculo';

/**
 * Diagrama esquemático del vehículo con los hallazgos marcados.
 *
 * Se dibuja en un espacio normalizado de 100×100, así las coordenadas `x`/`y`
 * de cada `Imperfeccion` son porcentajes y no dependen del tamaño en pantalla.
 * El exterior muestra planta y perfil; el interior, la cabina desde arriba.
 */

interface DiagramaVehiculoProps {
  zona: 'exterior' | 'interior';
  imperfecciones: Imperfeccion[];
  /** Hallazgo resaltado; el resto se atenúa. */
  seleccionadaId?: string;
  onSeleccionar: (id: string) => void;
}

/** Trazo común. No incluye `fill`: cada figura declara el suyo. */
const TRAZO = { stroke: 'var(--borde)', strokeWidth: 0.9 } as const;
const RELLENO = 'var(--superficie)';

/** Planta y perfil del vehículo. */
const Exterior: React.FC = () => (
  <g>
    {/* ── Planta (vista desde arriba) ── */}
    <rect x="26" y="6" width="48" height="34" rx="11" fill={RELLENO} {...TRAZO} />
    {/* Parabrisas y luneta */}
    <path d="M32 16 h36" fill="none" {...TRAZO} />
    <path d="M32 30 h36" fill="none" {...TRAZO} />
    {/* Techo */}
    <rect x="34" y="17" width="32" height="12" rx="3" fill="var(--blanco)" {...TRAZO} />
    {/* Espejos */}
    <path d="M26 19 h-3 M74 19 h3" fill="none" {...TRAZO} />

    {/* ── Perfil (vista lateral) ── */}
    <path
      d="M8 70 L12 58 Q14 54 20 53 L36 51 Q44 44 56 44 Q70 44 78 52 L88 55 Q92 57 92 63 L92 70 Z"
      fill={RELLENO}
      {...TRAZO}
    />
    {/* Ventanas */}
    <path d="M40 51 Q46 46 55 46 Q64 46 70 51 Z" fill="var(--blanco)" {...TRAZO} />
    {/* Ruedas */}
    <circle cx="26" cy="70" r="6.5" fill="var(--blanco)" {...TRAZO} />
    <circle cx="74" cy="70" r="6.5" fill="var(--blanco)" {...TRAZO} />
    <circle cx="26" cy="70" r="2.6" fill="var(--borde-claro)" {...TRAZO} />
    <circle cx="74" cy="70" r="2.6" fill="var(--borde-claro)" {...TRAZO} />
    {/* Suelo */}
    <path d="M4 78 h92" stroke="var(--borde-claro)" strokeWidth="0.8" />
  </g>
);

/** Cabina vista desde arriba. */
const Interior: React.FC = () => (
  <g>
    <rect x="22" y="14" width="56" height="72" rx="14" fill={RELLENO} {...TRAZO} />
    {/* Tablero y parabrisas */}
    <path d="M28 24 h44" fill="none" {...TRAZO} />
    {/* Volante */}
    <circle cx="34" cy="29" r="4.4" fill="var(--blanco)" {...TRAZO} />
    <path d="M29.6 29 h8.8" fill="none" {...TRAZO} />
    {/* Consola central */}
    <rect x="44" y="34" width="9" height="18" rx="2.5" fill="var(--blanco)" {...TRAZO} />
    {/* Asientos delanteros */}
    <rect x="27" y="36" width="13" height="16" rx="4" fill="var(--blanco)" {...TRAZO} />
    <rect x="57" y="36" width="13" height="16" rx="4" fill="var(--blanco)" {...TRAZO} />
    {/* Banco trasero */}
    <rect x="28" y="60" width="42" height="16" rx="4" fill="var(--blanco)" {...TRAZO} />
    <path d="M42 60 v16 M56 60 v16" fill="none" {...TRAZO} />
  </g>
);

export const DiagramaVehiculo: React.FC<DiagramaVehiculoProps> = ({
  zona,
  imperfecciones,
  seleccionadaId,
  onSeleccionar,
}) => (
  <svg
    viewBox="0 0 100 100"
    role="img"
    aria-label={`Diagrama ${zona} con ${imperfecciones.length} hallazgos marcados`}
    style={{ width: '100%', maxWidth: '340px', display: 'block', margin: '0 auto' }}
  >
    {zona === 'exterior' ? <Exterior /> : <Interior />}

    {imperfecciones.map((imp, i) => {
      const activa = imp.id === seleccionadaId;
      return (
        <g
          key={imp.id}
          onClick={() => onSeleccionar(imp.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSeleccionar(imp.id);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Hallazgo ${i + 1}: ${imp.tipo} en ${imp.ubicacion}`}
          style={{ cursor: 'pointer' }}
        >
          {activa && (
            <circle cx={imp.x} cy={imp.y} r="6.4" fill="var(--naranja-500)" opacity="0.25" />
          )}
          <circle
            cx={imp.x}
            cy={imp.y}
            r="4"
            fill={activa ? 'var(--naranja-500)' : 'var(--blanco)'}
            stroke="var(--naranja-500)"
            strokeWidth="1.2"
          />
          <text
            x={imp.x}
            y={imp.y + 1.6}
            textAnchor="middle"
            fontSize="4.4"
            fontWeight="700"
            fontFamily="var(--font-sans)"
            fill={activa ? 'var(--blanco)' : 'var(--naranja-700)'}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {i + 1}
          </text>
        </g>
      );
    })}
  </svg>
);
