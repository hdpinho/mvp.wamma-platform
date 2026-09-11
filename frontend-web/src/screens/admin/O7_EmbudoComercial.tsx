import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCRM } from '../../state/crmContexto';
import { useVehiculos } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';
import { MoverEtapa } from '../../components/crm/MoverEtapa';
import { ESTILOS_CRM } from '../../components/crm/estilos';
import { fechaCorta, fechaDeAccion, formatoUSD, haceCuanto } from '../../components/crm/formato';
import {
  ETAPAS_ABIERTAS,
  MOTIVOS_PERDIDA,
  definicionEtapa,
  estaEstancada,
  proximaAccionVencida,
} from '../../types/crm';

/**
 * O7 · Embudo comercial — tarea F4 de `specs/010-crm-comercial/tasks.md`.
 *
 * Una columna por etapa abierta, con conteo y monto. Dentro de cada columna va
 * primero lo estancado y lo vencido: es lo que hay que atender hoy. Debajo, lo
 * cerrado: ventas y motivos de pérdida agregados (`spec.md` RF-010.17).
 *
 * Pendiente por C4: el filtro por asesor. Sin el módulo 001 no hay identidad
 * de asesor que filtrar; hoy todas las oportunidades están sin asignar.
 */

type Filtro = 'todas' | 'estancadas' | 'vencidas';

export const O7_EmbudoComercial: React.FC = () => {
  const {
    oportunidades,
    obtenerPersona,
    ultimaActividad,
    historialDeOportunidad,
    cargarDatosEjemplo,
    restablecerDatosDemo,
  } = useCRM();
  const { restablecerDatosDemo: restablecerInventario } = useVehiculos();

  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  const ahora = new Date();
  const fichas = oportunidades.map((o) => {
    // El momento en que entró a su etapa actual; los intentos rechazados no cuentan.
    const entrada = historialDeOportunidad(o.id)
      .filter((e) => e.etapaAnterior !== e.etapaNueva && e.etapaNueva === o.etapa)
      .pop();
    return {
      o,
      persona: obtenerPersona(o.personaId),
      estancada: estaEstancada(o, ultimaActividad(o.id), ahora),
      vencida: proximaAccionVencida(o, ahora),
      entroEnEtapa: entrada?.ts ?? o.fechaCreacion,
    };
  });

  const abiertas = fichas.filter((f) => !definicionEtapa(f.o.etapa).esTerminal);
  const ganadas = fichas.filter((f) => f.o.etapa === 'cerrado_ganado');
  const perdidas = fichas.filter((f) => f.o.etapa === 'cerrado_perdido');

  const q = busqueda.trim().toLowerCase();
  const visibles = abiertas.filter((f) => {
    if (filtro === 'estancadas' && !f.estancada) return false;
    if (filtro === 'vencidas' && !f.vencida) return false;
    if (!q) return true;
    const { marca, modelo } = f.o.vehiculoResumen;
    return `${f.persona?.nombreApellido ?? ''} ${marca} ${modelo}`.toLowerCase().includes(q);
  });

  const valorAbierto = abiertas.reduce((s, f) => s + f.o.valorEstimadoUSD, 0);
  const totalEstancadas = abiertas.filter((f) => f.estancada).length;
  const totalVencidas = abiertas.filter((f) => f.vencida).length;
  const conversion = fichas.length > 0 ? Math.round((ganadas.length / fichas.length) * 100) : 0;

  const motivos = MOTIVOS_PERDIDA.map((m) => ({
    ...m,
    cantidad: perdidas.filter((f) => f.o.motivoPerdida === m.codigo).length,
  }))
    .filter((m) => m.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  const restablecer = () => {
    const confirmado = window.confirm(
      'Se borrarán todas las personas, oportunidades, citas y notas, y el inventario volverá a su estado inicial (incluidos los vehículos creados desde el backoffice). ¿Continuar?',
    );
    if (!confirmado) return;
    restablecerDatosDemo();
    restablecerInventario();
    setAviso('Demostración restablecida.');
  };

  return (
    <div>
      <div className="embudo-header">
        <h1 className="crm-titulo">Embudo comercial</h1>
        <p className="crm-sub">
          Cada interés de compra, por etapa. Dentro de cada columna va primero lo que hay que atender hoy:
          lo estancado y las acciones vencidas.
        </p>
      </div>

      {aviso && (
        <div className="crm-aviso" role="status">
          {aviso}
          <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}

      {oportunidades.length === 0 ? (
        <div className="crm-vacio">
          <div style={{ fontSize: '32px' }}>📊</div>
          <h3>Todavía no hay oportunidades</h3>
          <p>
            Se crean solas cuando un cliente agenda una cita en el catálogo. Para recorrer el embudo sin agendar a
            mano, carga prospectos de ejemplo: cubren todas las etapas e incluyen casos estancados y acciones
            vencidas.
          </p>
          <Boton
            variant="primary"
            onClick={() => {
              cargarDatosEjemplo();
              setAviso('Se cargaron prospectos de ejemplo. En su ficha aparecen rotulados como "Dato de ejemplo".');
            }}
          >
            Cargar datos de ejemplo
          </Boton>
        </div>
      ) : (
        <>
          <div className="embudo-kpis">
            <div className="embudo-kpi">
              <div className="kpi-valor">{abiertas.length}</div>
              <div className="kpi-label">Oportunidades abiertas</div>
            </div>
            <div className="embudo-kpi">
              <div className="kpi-valor">{formatoUSD(valorAbierto)}</div>
              <div className="kpi-label">Valor en el embudo</div>
            </div>
            <div className={`embudo-kpi ${totalEstancadas ? 'alerta' : ''}`}>
              <div className="kpi-valor">{totalEstancadas}</div>
              <div className="kpi-label">Estancadas</div>
            </div>
            <div className={`embudo-kpi ${totalVencidas ? 'alerta' : ''}`}>
              <div className="kpi-valor">{totalVencidas}</div>
              <div className="kpi-label">Acciones vencidas</div>
            </div>
            <div className="embudo-kpi">
              <div className="kpi-valor">{conversion} %</div>
              <div className="kpi-label">
                {ganadas.length} de {fichas.length} terminaron en venta
              </div>
            </div>
          </div>

          <div className="embudo-filtros">
            {(['todas', 'estancadas', 'vencidas'] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`crm-tab ${filtro === f ? 'activo' : ''}`}
                onClick={() => setFiltro(f)}
              >
                {f === 'todas'
                  ? 'Todas'
                  : f === 'estancadas'
                    ? `Solo estancadas (${totalEstancadas})`
                    : `Acción vencida (${totalVencidas})`}
              </button>
            ))}
            <input
              type="search"
              className="embudo-buscar"
              placeholder="Buscar persona o vehículo"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar en el embudo"
            />
          </div>

          <div className="embudo-scroll">
            <div className="embudo-tablero">
              {ETAPAS_ABIERTAS.map((etapa) => {
                const columna = visibles
                  .filter((f) => f.o.etapa === etapa.codigo)
                  .sort(
                    (a, b) =>
                      Number(b.estancada) - Number(a.estancada) ||
                      Number(b.vencida) - Number(a.vencida) ||
                      a.entroEnEtapa.localeCompare(b.entroEnEtapa),
                  );
                const monto = columna.reduce((s, f) => s + f.o.valorEstimadoUSD, 0);

                return (
                  <section key={etapa.codigo} className="embudo-columna" aria-label={etapa.nombre}>
                    <header className="embudo-col-head">
                      <div className="embudo-col-fila">
                        <span className={`crm-badge etapa-${etapa.codigo}`}>{etapa.nombre}</span>
                        <span className="crm-count">{columna.length}</span>
                      </div>
                      <div className="embudo-col-monto">{formatoUSD(monto)}</div>
                      <div className="embudo-col-umbral">
                        Estancada tras {etapa.umbralEstancadaDias} días sin actividad
                      </div>
                    </header>

                    {columna.length === 0 && <div className="embudo-col-vacia">Sin oportunidades</div>}

                    {columna.map(({ o, persona, estancada, vencida, entroEnEtapa }) => (
                      <article key={o.id} className={`embudo-tarjeta ${estancada ? 'estancada' : ''}`}>
                        <div className="embudo-tarjeta-top">
                          <Link to={`/admin/personas/${o.personaId}`} className="crm-nombre">
                            {persona?.nombreApellido ?? 'Persona no encontrada'}
                          </Link>
                          {estancada && <span className="crm-badge estancada">⚠ Estancada</span>}
                        </div>
                        <div className="embudo-vehiculo">
                          {o.vehiculoResumen.marca} {o.vehiculoResumen.modelo} {o.vehiculoResumen.anio}
                        </div>
                        <div className="embudo-valor">
                          {formatoUSD(o.valorEstimadoUSD)}
                          <span> · {o.modalidadPago}</span>
                        </div>
                        <div className="embudo-meta">Entró a esta etapa {haceCuanto(entroEnEtapa, ahora)}</div>
                        {o.proximaAccion && (
                          <div className={`embudo-accion ${vencida ? 'crm-vencida' : ''}`}>
                            {vencida ? '⏰ Vencida: ' : '→ '}
                            {o.proximaAccion}
                            {o.proximaAccionFecha && (
                              <span className="embudo-accion-fecha"> · {fechaDeAccion(o.proximaAccionFecha)}</span>
                            )}
                          </div>
                        )}
                        <MoverEtapa
                          oportunidad={o}
                          onHecho={(m) => setAviso(`${persona?.nombreApellido ?? 'La oportunidad'} ${m}`)}
                        />
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          </div>

          <div className="embudo-cerrados">
            <section className="embudo-cerrado" aria-label="Vendidos">
              <h2>
                Vendidos <span className="crm-count">{ganadas.length}</span>
              </h2>
              <div className="embudo-col-monto">
                {formatoUSD(ganadas.reduce((s, f) => s + f.o.valorEstimadoUSD, 0))}
              </div>
              {ganadas.length === 0 ? (
                <p className="embudo-col-vacia">Aún no hay ventas cerradas.</p>
              ) : (
                <ul className="embudo-lista">
                  {ganadas.map(({ o, persona }) => (
                    <li key={o.id}>
                      <Link to={`/admin/personas/${o.personaId}`}>{persona?.nombreApellido}</Link> ·{' '}
                      {o.vehiculoResumen.marca} {o.vehiculoResumen.modelo} · {formatoUSD(o.valorEstimadoUSD)}
                      {o.fechaCierre ? ` · ${fechaCorta(o.fechaCierre)}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="embudo-cerrado" aria-label="Perdidos">
              <h2>
                Perdidos <span className="crm-count">{perdidas.length}</span>
              </h2>
              {motivos.length === 0 ? (
                <p className="embudo-col-vacia">Sin pérdidas registradas.</p>
              ) : (
                <div className="embudo-motivos">
                  {motivos.map((m) => (
                    <div key={m.codigo}>
                      <div className="embudo-motivo-fila">
                        <span>{m.nombre}</span>
                        <strong>{m.cantidad}</strong>
                      </div>
                      <div className="embudo-barra">
                        <div style={{ width: `${(m.cantidad / perdidas.length) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="embudo-pie">
            <button type="button" className="embudo-restablecer" onClick={restablecer}>
              Restablecer datos de demostración
            </button>
          </div>
        </>
      )}

      <style>{ESTILOS_CRM}</style>
      <style>{`
        .embudo-header { margin-bottom: var(--space-lg); }
        .embudo-kpis {
          display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: var(--space-lg);
        }
        @media (max-width: 1100px) { .embudo-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .embudo-kpi {
          background-color: var(--blanco); border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md); padding: 12px 14px;
        }
        .embudo-kpi.alerta { border-color: var(--peligro-texto); background-color: var(--peligro-fondo); }
        .kpi-valor { font-size: 22px; font-weight: 700; }
        .kpi-label { font-size: 12px; color: var(--texto-secundario); margin-top: 2px; }
        .embudo-filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: var(--space-md); }
        .embudo-buscar {
          margin-left: auto; min-width: 240px; padding: 7px 14px; border: 1px solid var(--borde);
          border-radius: var(--radius-pill); font-size: 13px; font-family: inherit;
        }
        .embudo-scroll { overflow-x: auto; padding-bottom: 8px; }
        .embudo-tablero { display: grid; grid-template-columns: repeat(5, minmax(210px, 1fr)); gap: 12px; min-width: 1100px; }
        .embudo-columna {
          background-color: var(--superficie); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
          padding: 10px; display: flex; flex-direction: column; gap: 10px; min-height: 220px;
        }
        .embudo-col-head { display: flex; flex-direction: column; gap: 3px; }
        .embudo-col-fila { display: flex; justify-content: space-between; align-items: center; }
        .embudo-col-monto { font-size: 13px; font-weight: 700; color: var(--naranja-700); }
        .embudo-col-umbral { font-size: 10px; color: var(--texto-mudo); }
        .embudo-col-vacia { font-size: 12px; color: var(--texto-mudo); text-align: center; padding: 12px 0; margin: 0; }
        .embudo-tarjeta {
          background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-md);
          padding: 10px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .embudo-tarjeta.estancada { border-left: 4px solid var(--peligro-texto); }
        .embudo-tarjeta-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
        .embudo-vehiculo { font-size: 12px; color: var(--texto-secundario); }
        .embudo-valor { font-size: 13px; font-weight: 700; color: var(--naranja-700); }
        .embudo-valor span { font-weight: 500; color: var(--texto-mudo); }
        .embudo-meta { font-size: 11px; color: var(--texto-mudo); }
        .embudo-accion {
          font-size: 12px; color: var(--texto-secundario); background-color: var(--superficie);
          border-radius: var(--radius-sm); padding: 4px 6px;
        }
        .embudo-accion-fecha { color: var(--texto-mudo); font-weight: 500; }
        .embudo-cerrados { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: var(--space-lg); }
        @media (max-width: 900px) { .embudo-cerrados { grid-template-columns: 1fr; } }
        .embudo-cerrado {
          background-color: var(--blanco); border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg); padding: 14px;
        }
        .embudo-cerrado h2 { font-size: 15px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
        .embudo-lista { margin: 8px 0 0; padding-left: 18px; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
        .embudo-lista a { color: var(--texto-primario); font-weight: 600; }
        .embudo-motivos { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .embudo-motivo-fila { display: flex; justify-content: space-between; font-size: 13px; }
        .embudo-barra {
          height: 6px; background-color: var(--superficie); border-radius: var(--radius-pill);
          overflow: hidden; margin-top: 3px;
        }
        .embudo-barra div { height: 100%; background-color: var(--naranja-500); }
        .embudo-pie { margin-top: var(--space-lg); text-align: right; }
        .embudo-restablecer {
          background: none; border: none; color: var(--texto-mudo); font-size: 12px;
          text-decoration: underline; cursor: pointer; font-family: inherit;
        }
      `}</style>
    </div>
  );
};
