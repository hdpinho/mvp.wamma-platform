import React, { useId, useState } from 'react';
import type { Etapa, MotivoPerdida, Oportunidad } from '../../types/crm';
import {
  ETAPAS,
  ETIQUETA_ESTADO_CREDITO,
  MOTIVOS_PERDIDA,
  definicionEtapa,
  evaluarTransicion,
} from '../../types/crm';
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

/** Un crédito solo respalda el cierre de la venta si está aprobado o ya se desembolsó. */
const creditoRespaldaLaVenta = (oportunidad: Oportunidad): boolean => {
  const estado = oportunidad.solicitudCredito?.estado;
  return estado === 'aprobada' || estado === 'desembolsada';
};

export const MoverEtapa: React.FC<MoverEtapaProps> = ({ oportunidad, onHecho }) => {
  const { cambiarEtapa } = useCRM();
  const [destino, setDestino] = useState<Etapa | ''>('');
  const [motivo, setMotivo] = useState<MotivoPerdida>('dejo_de_responder');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [nota, setNota] = useState('');
  // Un identificador por tarjeta: el embudo muestra varias a la vez y las etiquetas no pueden apuntar a otra.
  const idMotivo = useId();
  const idNota = useId();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (definicionEtapa(oportunidad.etapa).esTerminal) {
    return <span className="mover-terminal">Etapa final. Para retomar el contacto se abre una oportunidad nueva.</span>;
  }

  const reiniciar = () => {
    setDestino('');
    setMotivoTexto('');
    setNota('');
    setError(null);
  };

  const aplicar = async (hacia: Etapa) => {
    setEnviando(true);
    const resultado = await cambiarEtapa(oportunidad.id, hacia, {
      motivoPerdida: hacia === 'cerrado_perdido' ? motivo : undefined,
      motivoPerdidaTexto: hacia === 'cerrado_perdido' ? motivoTexto.trim() || undefined : undefined,
      nota: nota.trim() || undefined,
    });
    setEnviando(false);
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
    void aplicar(hacia);
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
              <label htmlFor={idMotivo}>
                Motivo de pérdida <span className="req">*</span>
              </label>
              <select
                id={idMotivo}
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
              <label htmlFor={idNota}>
                ¿Por qué retrocede? <span className="req">*</span>
              </label>
              <input
                id={idNota}
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
          {destino === 'cerrado_ganado' && oportunidad.modalidadPago === 'Financiamiento' && !creditoRespaldaLaVenta(oportunidad) && (
            <p className="mover-aviso" role="alert">
              <strong>El crédito de esta venta no está aprobado</strong>
              {oportunidad.solicitudCredito?.estado
                ? ` (${ETIQUETA_ESTADO_CREDITO[oportunidad.solicitudCredito.estado].toLowerCase()})`
                : ': todavía no hay solicitud de crédito enviada'}
              . Cierra la venta solo si ya está acordado de otra forma.
            </p>
          )}

          <div className="mover-acciones">
            <Boton
              variant="primary"
              size="small"
              onClick={() => void aplicar(destino)}
              disabled={!puedeConfirmar || enviando}
            >
              {enviando ? 'Guardando…' : 'Confirmar'}
            </Boton>
            <button type="button" className="mover-cancelar" onClick={reiniciar} disabled={enviando}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {error && <div className="mover-error">{error}</div>}
    </div>
  );
};
