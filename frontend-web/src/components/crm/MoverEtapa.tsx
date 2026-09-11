import React, { useState } from 'react';
import type { Etapa, MotivoPerdida, Oportunidad } from '../../types/crm';
import { ETAPAS, MOTIVOS_PERDIDA, definicionEtapa, evaluarTransicion } from '../../types/crm';
import { useCRM } from '../../state/crmContexto';
import { Boton } from '../Boton';

/**
 * Cambio de etapa de una oportunidad, compartido por el embudo y la ficha.
 *
 * La máquina de estados manda también en la interfaz (tarea F4), no solo en el
 * modelo: cerrar en perdido pide motivo, retroceder pide nota, y marcar vendido
 * pide confirmación porque saca el vehículo del catálogo. Los avances simples
 * se aplican al elegirlos, sin pasos de más.
 *
 * Los estilos viven en `ESTILOS_CRM`, que cada pantalla inyecta una vez.
 */

interface MoverEtapaProps {
  oportunidad: Oportunidad;
  onHecho?: (mensaje: string) => void;
}

export const MoverEtapa: React.FC<MoverEtapaProps> = ({ oportunidad, onHecho }) => {
  const { cambiarEtapa } = useCRM();
  const [destino, setDestino] = useState<Etapa | ''>('');
  const [motivo, setMotivo] = useState<MotivoPerdida>('dejo_de_responder');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (definicionEtapa(oportunidad.etapa).esTerminal) {
    return <span className="mover-terminal">Etapa final. Para retomar el contacto se abre una oportunidad nueva.</span>;
  }

  const reiniciar = () => {
    setDestino('');
    setMotivoTexto('');
    setNota('');
    setError(null);
  };

  const aplicar = (hacia: Etapa) => {
    const resultado = cambiarEtapa(oportunidad.id, hacia, {
      motivoPerdida: hacia === 'cerrado_perdido' ? motivo : undefined,
      motivoPerdidaTexto: hacia === 'cerrado_perdido' ? motivoTexto.trim() || undefined : undefined,
      nota: nota.trim() || undefined,
    });
    if (!resultado.ok) {
      setError(resultado.error ?? 'No se pudo cambiar la etapa.');
      return;
    }
    onHecho?.(`pasó a "${definicionEtapa(hacia).nombre}".`);
    reiniciar();
  };

  const alElegir = (valor: string) => {
    setError(null);
    if (!valor) return;
    const hacia = valor as Etapa;
    const evaluacion = evaluarTransicion(oportunidad.etapa, hacia);
    if (!evaluacion.permitida) {
      setError(evaluacion.razon ?? 'Transición no permitida.');
      return;
    }
    if (evaluacion.exigeMotivo || evaluacion.exigeNota || hacia === 'cerrado_ganado') {
      setDestino(hacia);
      return;
    }
    aplicar(hacia);
  };

  const evaluacion = destino ? evaluarTransicion(oportunidad.etapa, destino) : null;
  const exigeTextoMotivo = MOTIVOS_PERDIDA.find((m) => m.codigo === motivo)?.exigeTexto ?? false;
  const puedeConfirmar = !evaluacion
    ? false
    : evaluacion.exigeMotivo
      ? !exigeTextoMotivo || motivoTexto.trim().length > 0
      : evaluacion.exigeNota
        ? nota.trim().length > 0
        : true;

  return (
    <div className="mover-etapa">
      {!destino ? (
        <select aria-label="Mover a otra etapa" value="" onChange={(e) => alElegir(e.target.value)}>
          <option value="">Mover a…</option>
          {ETAPAS.filter((e) => e.codigo !== oportunidad.etapa).map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nombre}
            </option>
          ))}
        </select>
      ) : (
        <div className="mover-panel">
          <div className="mover-titulo">→ {definicionEtapa(destino).nombre}</div>

          {evaluacion?.exigeMotivo && (
            <>
              <label>
                Motivo de pérdida <span className="req">*</span>
              </label>
              <select
                aria-label="Motivo de pérdida"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as MotivoPerdida)}
              >
                {MOTIVOS_PERDIDA.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              {exigeTextoMotivo && (
                <input
                  type="text"
                  placeholder="Describe el motivo"
                  value={motivoTexto}
                  onChange={(e) => setMotivoTexto(e.target.value)}
                />
              )}
            </>
          )}

          {evaluacion?.exigeNota && (
            <>
              <label>
                ¿Por qué retrocede? <span className="req">*</span>
              </label>
              <input
                type="text"
                aria-label="Nota del retroceso"
                placeholder="Ej. Se enfrió: pospone la compra al mes próximo"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
            </>
          )}

          {destino === 'cerrado_ganado' && (
            <p className="mover-aviso">
              El vehículo pasará a <strong>Vendido</strong> y saldrá del catálogo.
            </p>
          )}

          <div className="mover-acciones">
            <Boton variant="primary" size="small" onClick={() => aplicar(destino)} disabled={!puedeConfirmar}>
              Confirmar
            </Boton>
            <button type="button" className="mover-cancelar" onClick={reiniciar}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <div className="mover-error">{error}</div>}
    </div>
  );
};
