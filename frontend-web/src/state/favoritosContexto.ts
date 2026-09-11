import { createContext, useContext } from 'react';

/**
 * Contexto y hook de favoritos. Vive aparte del proveedor para que el archivo
 * de componentes exporte solo componentes (requisito de Fast Refresh).
 */

export interface FavoritosContextValue {
  favoritos: string[];
  esFavorito: (id: string) => boolean;
  alternarFavorito: (id: string) => void;
}

export const FavoritosContext = createContext<FavoritosContextValue | null>(null);

export function useFavoritos(): FavoritosContextValue {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos debe usarse dentro de <ProveedorFavoritos>');
  return ctx;
}
