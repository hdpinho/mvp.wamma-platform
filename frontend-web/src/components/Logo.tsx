import React from 'react';

/**
 * Logo oficial de WAMMA.
 *
 * Los assets viven en `public/marca/` y provienen del Manual de Marca
 * (`docs/marca/WAMMA-manual-de-marca.pdf`). Reglas estrictas:
 * - No deformar, recolorear ni recomponer el logo.
 * - Sobre fondo oscuro se usa la variante `blanco`, nunca una recoloreada.
 * - Respetar el área de respeto: no pegar texto ni elementos al borde del logo.
 */

type Articulacion = 'horizontal' | 'vertical' | 'isotipo';
type Variante = 'naranja' | 'negro' | 'blanco' | 'gris';

/** Relación ancho/alto de cada articulación, según los archivos originales. */
const PROPORCIONES: Record<Articulacion, number> = {
  horizontal: 1440 / 315,
  vertical: 1440 / 1080,
  isotipo: 1440 / 1080,
};

interface LogoProps {
  /** Composición del identificador. Por defecto, la horizontal. */
  articulacion?: Articulacion;
  /** Versión cromática válida por marca. */
  variante?: Variante;
  /** Alto en píxeles; el ancho se deriva de la proporción original. */
  alto?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  articulacion = 'horizontal',
  variante = 'naranja',
  alto = 28,
  className,
}) => (
  <img
    src={`/marca/wamma-${articulacion}-${variante}.png`}
    alt="wamma by Token Pago Pos"
    className={className}
    width={Math.round(alto * PROPORCIONES[articulacion])}
    height={alto}
    style={{ height: `${alto}px`, width: 'auto', display: 'block' }}
  />
);
