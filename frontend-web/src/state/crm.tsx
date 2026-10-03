import React from 'react';
import { apiConfigurada } from '../api/cliente';
import { ProveedorCRMLocal } from './crmLocal';
import { ProveedorCRMServidor } from './crmServidor';

/**
 * Proveedor del seguimiento comercial — `specs/010-crm-comercial/`.
 *
 * Elige la fuente según haya servidor o no, una sola vez (`VITE_API_URL` no cambia con la página abierta):
 * <ul>
 *   <li>con servidor, `crmServidor`: el servidor es la fuente de verdad y no se guarda nada en el navegador;</li>
 *   <li>sin servidor, `crmLocal`: la demostración del embudo en el navegador.</li>
 * </ul>
 */
export const ProveedorCRM: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  apiConfigurada ? (
    <ProveedorCRMServidor>{children}</ProveedorCRMServidor>
  ) : (
    <ProveedorCRMLocal>{children}</ProveedorCRMLocal>
  );
