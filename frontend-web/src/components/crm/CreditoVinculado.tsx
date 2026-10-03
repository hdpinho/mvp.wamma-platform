import React from 'react';
import type { Oportunidad } from '../../types/crm';
import { ETIQUETA_ESTADO_CREDITO } from '../../types/crm';

/**
 * Estado del crédito de una oportunidad: la capa comercial ve el número y el estado de la solicitud, nada más
 * (spec 010 CA-010.7). Las pantallas inyectan `ESTILOS_CRM`, donde viven sus estilos.
 */
export const CreditoVinculado: React.FC<{ oportunidad: Oportunidad }> = ({ oportunidad }) => {
  const credito = oportunidad.solicitudCredito;
  if (!credito?.estado) return null;
  return (
    <span className={`crm-credito ${credito.estado}`} title={credito.numero ? `Solicitud ${credito.numero}` : undefined}>
      {ETIQUETA_ESTADO_CREDITO[credito.estado]}
      {credito.numero ? ` · ${credito.numero}` : ''}
    </span>
  );
};
