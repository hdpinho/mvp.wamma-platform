import React, { useState } from 'react';
import type { Oportunidad } from '../../types/crm';
import { useCRM } from '../../state/crmContexto';
import { useSesion } from '../../state/sesionContexto';

const TOMAR_HABILITADO = false;

/**
 * Quién atiende la oportunidad (D-48). El asesor ve las suyas y las que nadie ha tomado; «Tomar» se la queda. El
 * coordinador ve todas y puede repartirlas. Solo existe con servidor: en la demostración no hay identidades de asesor.
 *
 * Los estilos viven en `ESTILOS_CRM`, que cada pantalla inyecta una vez.
 */
export const AsesorDeOportunidad: React.FC<{ oportunidad: Oportunidad }> = ({ oportunidad }) => {
  const { origen, asesores, tomarOportunidad, asignarAsesor } = useCRM();
  const { puede } = useSesion();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (origen !== 'servidor') return null;

  const puedeAsignar = puede('crm.asignar') && asesores.length > 0;
  // «Tomar» no entra en el MVP (D-73, D-76): el servidor ya lo rechaza (`wamma.crm.asignacion-habilitada`). Para devolverlo,
  // cambiar esta constante a `true` junto con esa bandera.
  const puedeTomar = TOMAR_HABILITADO && puede('crm.operar') && !oportunidad.asesorId;
  const cerrada = oportunidad.etapa === 'cerrado_ganado' || oportunidad.etapa === 'cerrado_perdido';

  const ejecutar = async (accion: () => Promise<{ ok: boolean; error?: string }>) => {
    setEnviando(true);
    setError(null);
    const resultado = await accion();
    setEnviando(false);
    if (!resultado.ok) setError(resultado.error ?? 'No se pudo completar la acción.');
  };

  return (
    <div className="crm-asesor">
      <span className="crm-asesor-etiqueta">Asesor:</span>{' '}
      {oportunidad.asesorNombre ? (
        <strong>{oportunidad.asesorNombre}</strong>
      ) : (
        <em className="crm-asesor-libre">Sin asesor asignado</em>
      )}

      {!cerrada && puedeTomar && (
        <button
          type="button"
          className="crm-asesor-boton"
          disabled={enviando}
          onClick={() => void ejecutar(() => tomarOportunidad(oportunidad.id))}
        >
          {enviando ? 'Tomando…' : 'Tomar esta oportunidad'}
        </button>
      )}

      {!cerrada && puedeAsignar && (
        <select
          aria-label="Asignar a un asesor"
          className="crm-asesor-select"
          disabled={enviando}
          value=""
          onChange={(e) => {
            const asesorId = e.target.value;
            if (asesorId) void ejecutar(() => asignarAsesor(oportunidad.id, asesorId));
          }}
        >
          <option value="">{oportunidad.asesorId ? 'Reasignar a…' : 'Asignar a…'}</option>
          {asesores
            .filter((a) => a.id !== oportunidad.asesorId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
        </select>
      )}

      {error && (
        <div className="crm-asesor-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
