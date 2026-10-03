import React from 'react';
import { useCRM } from '../../state/crmContexto';

/**
 * Lo que el servidor está haciendo con la pantalla del CRM: leyendo por primera vez, o sin poder leer. Con servidor,
 * una lista vacía puede significar «no hay nada» o «no se pudo leer»: la pantalla tiene que decir cuál de las dos.
 * Sin servidor (demostración) no muestra nada. Las pantallas inyectan `ESTILOS_CRM`, donde viven sus estilos.
 */
export const AvisoCargaCRM: React.FC = () => {
  const { origen, cargando, error, recargar } = useCRM();
  if (origen !== 'servidor') return null;
  if (cargando) {
    return (
      <p className="crm-cargando" role="status">
        Cargando desde el servidor…
      </p>
    );
  }
  if (error) {
    return (
      <div className="crm-aviso error" role="alert">
        <span>No se pudo leer del servidor: {error}</span>
        <button type="button" onClick={() => void recargar()}>
          Reintentar
        </button>
      </div>
    );
  }
  return null;
};
