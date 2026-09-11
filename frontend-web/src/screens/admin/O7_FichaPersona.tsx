import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCRM } from '../../state/crmContexto';
import { Boton } from '../../components/Boton';
import { MoverEtapa } from '../../components/crm/MoverEtapa';
import { ESTILOS_CRM } from '../../components/crm/estilos';
import { CANALES, fechaCorta, fechaDeAccion, fechaHora, formatoUSD, haceCuanto } from '../../components/crm/formato';
import type { CanalInteraccion, DireccionInteraccion } from '../../types/crm';
import {
  MOTIVOS_PERDIDA,
  definicionEtapa,
  estaEstancada,
  proximaAccionVencida,
  telefonoParaWhatsApp,
} from '../../types/crm';

/**
 * O7 · Ficha 360 de la persona — tarea F5 de `specs/010-crm-comercial/tasks.md`.
 *
 * Contacto, todas sus oportunidades (abiertas y cerradas, con motivo) e
 * historial de interacciones. Muestra también las fusiones: qué registros se
 * absorbieron y qué se les reasignó, que es lo que las hace auditables.
 *
 * Por `spec.md` §8.3 aquí NO aparece nada del expediente de crédito: ingresos,
 * cuentas bancarias y recaudos pertenecen a otra capa y a otro rol.
 */

const ESTILOS_FICHA = `
  .ficha-volver {
    display: inline-block; font-size: 13px; color: var(--texto-secundario);
    text-decoration: none; margin-bottom: var(--space-md);
  }
  .ficha-volver:hover { color: var(--naranja-600); }
  .ficha-cabecera {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
    flex-wrap: wrap; margin-bottom: var(--space-md);
  }
  .ficha-badges { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .ficha-whatsapp {
    display: inline-flex; align-items: center; gap: 6px; background-color: #25D366; color: #fff;
    font-size: 13px; font-weight: 700; padding: 9px 16px; border-radius: var(--radius-sm); text-decoration: none;
  }
  .ficha-datos {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;
    background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
    padding: 14px 16px; margin-bottom: var(--space-lg); font-size: 13px;
  }
  @media (max-width: 1000px) { .ficha-datos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .ficha-etiqueta {
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--texto-mudo);
    font-weight: 700; margin-bottom: 3px;
  }
  .ficha-seccion {
    background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
    padding: 16px; margin-bottom: var(--space-lg); display: flex; flex-direction: column; gap: 10px;
  }
  .ficha-seccion h2 { font-size: 16px; margin: 0; display: flex; align-items: center; gap: 8px; }
  .ficha-seccion > p { margin: 0; font-size: 12px; }
  .ficha-fusion { border-left: 4px solid var(--naranja-500); }
  .ficha-fusiones { margin: 0; padding-left: 18px; font-size: 13px; display: flex; flex-direction: column; gap: 6px; }
  .ficha-oportunidad {
    border: 1px solid var(--borde-claro); border-radius: var(--radius-md); padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .ficha-oportunidad.cerrada { background-color: var(--superficie); }
  .ficha-op-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .ficha-op-vehiculo { font-weight: 700; font-size: 14px; }
  .ficha-op-valor { font-size: 13px; color: var(--naranja-700); font-weight: 600; }
  .ficha-op-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .ficha-op-fechas { font-size: 12px; }
  .ficha-op-motivo { font-size: 12px; color: var(--peligro-texto); }
  .ficha-accion-ver { display: flex; align-items: center; gap: 10px; font-size: 13px; flex-wrap: wrap; }
  .ficha-accion-form { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .ficha-accion-form input[type=text] { flex: 1; min-width: 220px; }
  .ficha-accion-form input, .ficha-nota-form input, .ficha-nota-form select {
    padding: 7px 10px; border: 1px solid var(--borde); border-radius: var(--radius-sm);
    font-size: 13px; font-family: inherit; background-color: var(--blanco);
  }
  .ficha-link {
    background: none; border: none; color: var(--naranja-600); font-weight: 700;
    font-size: 12px; cursor: pointer; padding: 0; font-family: inherit;
  }
  .ficha-op-mover { max-width: 340px; }
  .ficha-historial summary { font-size: 12px; color: var(--texto-secundario); cursor: pointer; }
  .ficha-historial ol { margin: 6px 0 0; padding-left: 18px; font-size: 12px; display: flex; flex-direction: column; gap: 3px; }
  .ficha-historial li.rechazado { color: var(--peligro-texto); }
  .ficha-nota-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .ficha-nota-form input { flex: 1; min-width: 240px; }
  .ficha-interacciones { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .ficha-interacciones li { border-left: 3px solid var(--naranja-200); padding: 4px 10px; font-size: 13px; }
  .ficha-int-meta { font-size: 11px; color: var(--texto-mudo); margin-bottom: 2px; }
`;

export const O7_FichaPersona: React.FC = () => {
  const { id = '' } = useParams();
  const {
    personas,
    obtenerPersona,
    oportunidadesDePersona,
    interaccionesDePersona,
    historialDeOportunidad,
    ultimaActividad,
    registrarInteraccion,
    fijarProximaAccion,
  } = useCRM();

  const [aviso, setAviso] = useState<string | null>(null);
  const [canal, setCanal] = useState<CanalInteraccion>('whatsapp');
  const [direccion, setDireccion] = useState<DireccionInteraccion>('saliente');
  const [nota, setNota] = useState('');
  const [oportunidadNota, setOportunidadNota] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [accionTexto, setAccionTexto] = useState('');
  const [accionFecha, setAccionFecha] = useState('');

  const persona = obtenerPersona(id);

  if (!persona) {
    // Un id absorbido en una fusión no es un error: lleva a quien lo absorbió.
    const absorbidaPor = personas.find((p) => p.fusionadaDesde?.some((f) => f.id === id));
    return (
      <div>
        <Link to="/admin/personas" className="ficha-volver">
          ← Personas
        </Link>
        <div className="crm-vacio">
          {absorbidaPor ? (
            <>
              <h3>Este registro se fusionó con otra persona</h3>
              <p>
                Tenía la misma cédula que <strong>{absorbidaPor.nombreApellido}</strong>. Su historial completo está
                ahora en esa ficha, junto con la copia original de este registro.
              </p>
              <Link to={`/admin/personas/${absorbidaPor.id}`} className="crm-enlace-boton">
                Ir a la ficha de {absorbidaPor.nombreApellido}
              </Link>
            </>
          ) : (
            <>
              <h3>No se encontró la persona</h3>
              <p>Puede que se hayan restablecido los datos de demostración.</p>
            </>
          )}
        </div>
        <style>{ESTILOS_CRM}</style>
        <style>{ESTILOS_FICHA}</style>
      </div>
    );
  }

  const ahora = new Date();
  // Primero las abiertas; dentro de cada grupo, la más reciente arriba.
  const oportunidades = oportunidadesDePersona(persona.id).sort(
    (a, b) =>
      Number(definicionEtapa(a.etapa).esTerminal) - Number(definicionEtapa(b.etapa).esTerminal) ||
      b.fechaCreacion.localeCompare(a.fechaCreacion),
  );
  const interacciones = interaccionesDePersona(persona.id);

  const vehiculoDe = (oportunidadId?: string) => {
    const o = oportunidades.find((x) => x.id === oportunidadId);
    return o ? `${o.vehiculoResumen.marca} ${o.vehiculoResumen.modelo}` : null;
  };

  const guardarNota = () => {
    if (!nota.trim()) return;
    registrarInteraccion({
      personaId: persona.id,
      oportunidadId: oportunidadNota || undefined,
      canal,
      direccion,
      nota,
    });
    setNota('');
    setAviso('Interacción registrada.');
  };

  const abrirEdicion = (oportunidadId: string, texto?: string, fecha?: string) => {
    setEditando(oportunidadId);
    setAccionTexto(texto ?? '');
    setAccionFecha(fecha ?? '');
  };

  const guardarAccion = (oportunidadId: string) => {
    if (!accionTexto.trim() || !accionFecha) return;
    fijarProximaAccion(oportunidadId, accionTexto.trim(), accionFecha);
    setEditando(null);
    setAviso('Próxima acción guardada.');
  };

  return (
    <div>
      <Link to="/admin/personas" className="ficha-volver">
        ← Personas
      </Link>

      {aviso && (
        <div className="crm-aviso" role="status">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      <section className="ficha-cabecera">
        <div>
          <h1 className="crm-titulo">{persona.nombreApellido}</h1>
          <div className="ficha-badges">
            {persona.cedula ? (
              <span className="crm-badge etapa-cerrado_ganado">Identificada por cédula</span>
            ) : (
              <span className="crm-badge neutro">Sin cédula</span>
            )}
            {persona.canalOrigen === 'ejemplo' && <span className="crm-badge neutro">Dato de ejemplo</span>}
          </div>
        </div>
        <a
          href={`https://wa.me/${telefonoParaWhatsApp(persona.telefonoWhatsApp)}`}
          target="_blank"
          rel="noreferrer"
          className="ficha-whatsapp"
          onClick={() => {
            setCanal('whatsapp');
            setDireccion('saliente');
          }}
        >
          💬 Escribir por WhatsApp
        </a>
      </section>

      <div className="ficha-datos">
        <div>
          <div className="ficha-etiqueta">Cédula</div>
          <div>{persona.cedula ?? <span className="crm-mudo">Pendiente: se pide al confirmar la cita</span>}</div>
        </div>
        <div>
          <div className="ficha-etiqueta">Teléfonos</div>
          <div>
            {persona.telefonoWhatsApp} <span className="crm-badge neutro">WhatsApp</span>
          </div>
          {persona.telefonosAdicionales?.map((t) => (
            <div key={t} className="crm-mudo">
              {t}
            </div>
          ))}
        </div>
        <div>
          <div className="ficha-etiqueta">Correo</div>
          <div>{persona.correo ?? <span className="crm-mudo">No indicado</span>}</div>
        </div>
        <div>
          <div className="ficha-etiqueta">Cliente desde</div>
          <div>{fechaCorta(persona.fechaCreacion)}</div>
          <div className="crm-mudo">{persona.canalOrigen === 'ejemplo' ? 'Dato de ejemplo' : 'Catálogo web'}</div>
        </div>
      </div>

      {persona.fusionadaDesde && persona.fusionadaDesde.length > 0 && (
        <section className="ficha-seccion ficha-fusion">
          <h2>Registros fusionados en esta persona</h2>
          <p className="crm-mudo">
            Se conserva la copia completa de cada registro absorbido y la lista de lo que se le reasignó: la fusión se
            puede auditar y revertir.
          </p>
          <ul className="ficha-fusiones">
            {persona.fusionadaDesde.map((f) => (
              <li key={f.id}>
                <strong>{f.nombreApellido}</strong>
                {f.telefonoWhatsApp && <> · {f.telefonoWhatsApp}</>}
                {f.correo && <> · {f.correo}</>}
                <div className="crm-mudo">
                  Registrada el {fechaCorta(f.fechaCreacion)} · fusionada el {fechaHora(f.fusionadaEn)} · se le
                  reasignaron {f.oportunidadIds.length} oportunidad(es), {f.citaIds.length} cita(s) y{' '}
                  {f.interaccionIds.length} nota(s)
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ficha-seccion">
        <h2>
          Oportunidades <span className="crm-count">{oportunidades.length}</span>
        </h2>
        {oportunidades.length === 0 ? (
          <p className="crm-mudo">Sin oportunidades.</p>
        ) : (
          oportunidades.map((o) => {
            const def = definicionEtapa(o.etapa);
            const estancada = estaEstancada(o, ultimaActividad(o.id), ahora);
            const vencida = proximaAccionVencida(o, ahora);
            const eventos = historialDeOportunidad(o.id);
            const motivo = MOTIVOS_PERDIDA.find((m) => m.codigo === o.motivoPerdida)?.nombre;

            return (
              <article key={o.id} className={`ficha-oportunidad ${def.esTerminal ? 'cerrada' : ''}`}>
                <div className="ficha-op-top">
                  <div>
                    <div className="ficha-op-vehiculo">
                      {o.vehiculoResumen.marca} {o.vehiculoResumen.modelo} {o.vehiculoResumen.version} (
                      {o.vehiculoResumen.anio})
                    </div>
                    <div className="ficha-op-valor">
                      {formatoUSD(o.valorEstimadoUSD)} · {o.modalidadPago}
                    </div>
                  </div>
                  <div className="ficha-op-badges">
                    <span className={`crm-badge etapa-${o.etapa}`}>{def.nombre}</span>
                    {estancada && <span className="crm-badge estancada">⚠ Estancada</span>}
                  </div>
                </div>

                <div className="crm-mudo ficha-op-fechas">
                  Abierta el {fechaCorta(o.fechaCreacion)}
                  {o.fechaCierre
                    ? ` · cerrada el ${fechaCorta(o.fechaCierre)}`
                    : ` · última actividad ${haceCuanto(ultimaActividad(o.id), ahora)}`}
                </div>

                {motivo && (
                  <div className="ficha-op-motivo">
                    Motivo de pérdida: <strong>{motivo}</strong>
                    {o.motivoPerdidaTexto ? ` — ${o.motivoPerdidaTexto}` : ''}
                  </div>
                )}

                {!def.esTerminal &&
                  (editando === o.id ? (
                    <div className="ficha-accion-form">
                      <input
                        type="text"
                        aria-label="Próxima acción"
                        placeholder="Ej. Llamar para confirmar la visita"
                        value={accionTexto}
                        onChange={(e) => setAccionTexto(e.target.value)}
                        autoFocus
                      />
                      <input
                        type="date"
                        aria-label="Fecha de la próxima acción"
                        value={accionFecha}
                        onChange={(e) => setAccionFecha(e.target.value)}
                      />
                      <Boton
                        variant="primary"
                        size="small"
                        onClick={() => guardarAccion(o.id)}
                        disabled={!accionTexto.trim() || !accionFecha}
                      >
                        Guardar
                      </Boton>
                      <button type="button" className="mover-cancelar" onClick={() => setEditando(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="ficha-accion-ver">
                      {o.proximaAccion ? (
                        <span className={vencida ? 'crm-vencida' : ''}>
                          {vencida ? '⏰ Vencida: ' : 'Próxima acción: '}
                          {o.proximaAccion}
                          {o.proximaAccionFecha ? ` · ${fechaDeAccion(o.proximaAccionFecha)}` : ''}
                        </span>
                      ) : (
                        <span className="crm-mudo">Sin próxima acción definida</span>
                      )}
                      <button
                        type="button"
                        className="ficha-link"
                        onClick={() => abrirEdicion(o.id, o.proximaAccion, o.proximaAccionFecha)}
                      >
                        {o.proximaAccion ? 'Cambiar' : 'Definir'}
                      </button>
                    </div>
                  ))}

                <div className="ficha-op-mover">
                  <MoverEtapa oportunidad={o} onHecho={(m) => setAviso(`La oportunidad ${m}`)} />
                </div>

                <details className="ficha-historial">
                  <summary>Historial de etapas ({eventos.length})</summary>
                  <ol>
                    {eventos.map((e) => (
                      <li key={e.id} className={e.etapaAnterior === e.etapaNueva ? 'rechazado' : ''}>
                        <span className="crm-mudo">{fechaHora(e.ts)}</span>{' '}
                        {e.etapaAnterior === e.etapaNueva ? (
                          `⛔ ${e.nota ?? 'Intento rechazado'}`
                        ) : (
                          <>
                            {e.etapaAnterior ? `${definicionEtapa(e.etapaAnterior).nombre} → ` : ''}
                            <strong>{definicionEtapa(e.etapaNueva).nombre}</strong>
                            {e.nota ? ` · ${e.nota}` : ''}
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              </article>
            );
          })
        )}
      </section>

      <section className="ficha-seccion">
        <h2>
          Interacciones <span className="crm-count">{interacciones.length}</span>
        </h2>
        <div className="ficha-nota-form">
          <select aria-label="Canal" value={canal} onChange={(e) => setCanal(e.target.value as CanalInteraccion)}>
            {Object.entries(CANALES).map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Dirección"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value as DireccionInteraccion)}
          >
            <option value="saliente">Saliente (le escribimos)</option>
            <option value="entrante">Entrante (nos escribió)</option>
          </select>
          <select
            aria-label="Oportunidad relacionada"
            value={oportunidadNota}
            onChange={(e) => setOportunidadNota(e.target.value)}
          >
            <option value="">Sin oportunidad específica</option>
            {oportunidades.map((o) => (
              <option key={o.id} value={o.id}>
                {o.vehiculoResumen.marca} {o.vehiculoResumen.modelo}
              </option>
            ))}
          </select>
          <input
            type="text"
            aria-label="Nota de la interacción"
            placeholder="¿Qué se habló?"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <Boton variant="primary" size="small" onClick={guardarNota} disabled={!nota.trim()}>
            Registrar
          </Boton>
        </div>

        {interacciones.length === 0 ? (
          <p className="crm-mudo">Todavía no hay interacciones registradas.</p>
        ) : (
          <ul className="ficha-interacciones">
            {interacciones.map((i) => (
              <li key={i.id}>
                <div className="ficha-int-meta">
                  <strong>{CANALES[i.canal]}</strong> · {i.direccion} · {fechaHora(i.ocurridoEn)}
                  {vehiculoDe(i.oportunidadId) ? ` · ${vehiculoDe(i.oportunidadId)}` : ''}
                </div>
                <div>{i.nota}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{ESTILOS_CRM}</style>
      <style>{ESTILOS_FICHA}</style>
    </div>
  );
};
