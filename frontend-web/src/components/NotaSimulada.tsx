import React from 'react';

interface NotaSimuladaProps {
  children?: React.ReactNode;
  variante?: 'inline' | 'bloque';
}

/**
 * En plataforma 100% operativa, no se presentan avisos de maqueta ni datos simulados.
 */
export const NotaSimulada: React.FC<NotaSimuladaProps> = () => null;

