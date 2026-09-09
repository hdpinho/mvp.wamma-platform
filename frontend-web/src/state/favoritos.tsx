import React, { useCallback, useMemo, useState } from 'react';
import { FavoritosContext } from './favoritosContexto';
import type { FavoritosContextValue } from './favoritosContexto';

/**
 * Favoritos y alertas de precio — MAQUETA VISUAL, Fase 2 (módulo 12 · Marketplace).
 *
 * Se adelanta a la Fase 1 por decisión del Product Owner para completar el
 * paralelo con Kavak. No hay persistencia ni backend: el estado vive en memoria
 * y se pierde al recargar.
 */

const alternarEn = (lista: string[], id: string) =>
  lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];

export const ProveedorFavoritos: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [alertas, setAlertas] = useState<string[]>([]);

  const alternarFavorito = useCallback(
    (id: string) => setFavoritos((prev) => alternarEn(prev, id)),
    [],
  );
  const alternarAlerta = useCallback(
    (id: string) => setAlertas((prev) => alternarEn(prev, id)),
    [],
  );

  const valor = useMemo<FavoritosContextValue>(
    () => ({
      favoritos,
      alertas,
      esFavorito: (id) => favoritos.includes(id),
      alternarFavorito,
      tieneAlerta: (id) => alertas.includes(id),
      alternarAlerta,
    }),
    [favoritos, alertas, alternarFavorito, alternarAlerta],
  );

  return <FavoritosContext.Provider value={valor}>{children}</FavoritosContext.Provider>;
};
