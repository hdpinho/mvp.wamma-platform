import React, { useCallback, useMemo, useState } from 'react';
import { FavoritosContext } from './favoritosContexto';
import type { FavoritosContextValue } from './favoritosContexto';

/**
 * Favoritos — MAQUETA VISUAL, Fase 2 (módulo 12 · Marketplace).
 *
 * Se adelanta a la Fase 1 por decisión del Product Owner para completar el
 * paralelo con Kavak. No hay persistencia ni backend: el estado vive en memoria
 * y se pierde al recargar.
 *
 * Las alertas de baja de precio se retiraron por decisión del Product Owner
 * (septiembre 2026).
 */

export const ProveedorFavoritos: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoritos, setFavoritos] = useState<string[]>([]);

  const alternarFavorito = useCallback(
    (id: string) =>
      setFavoritos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [],
  );

  const valor = useMemo<FavoritosContextValue>(
    () => ({
      favoritos,
      esFavorito: (id) => favoritos.includes(id),
      alternarFavorito,
    }),
    [favoritos, alternarFavorito],
  );

  return <FavoritosContext.Provider value={valor}>{children}</FavoritosContext.Provider>;
};
