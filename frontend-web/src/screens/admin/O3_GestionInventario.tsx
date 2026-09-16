import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorApi } from '../../api/cliente';
import { Boton } from '../../components/Boton';
import { FotoVehiculo } from '../../components/FotoVehiculo';
import { useSesion } from '../../state/sesionContexto';
import { useVehiculos } from '../../state/vehiculosContexto';
import type { EstadoDisponibilidad } from '../../types/vehiculo';

interface O3GestionInventarioProps {
  /** Tasa vigente para la referencia en bolívares de los vehículos aún sin publicar. */
  rateBCV: number;
}

type Filtro = 'todos' | EstadoDisponibilidad | 'sin_publicar';

const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? e.detalle || e.titulo : 'No se pudo completar la acción.');

const formatoEUR = (valor: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number.isFinite(valor) ? valor : 0);

const formatoBs = (valor: number) => { const s = Number.isFinite(valor) ? valor : 0; return `${s.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs.`; };

export const O3_GestionInventario: React.FC<O3GestionInventarioProps> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const {
    vehiculos,
    origen,
    cargando,
    error: errorCarga,
    tasa,
    recargar,
    cambiarEstadoVehiculo,
    eliminarVehiculo,
    publicarVehiculo,
    pausarVehiculo,
    publicarListos,
    obtenerImperfecciones,
  } = useVehiculos();

  const { puede } = useSesion();
  const conServidor = origen === 'servidor';
  /**
   * Con `inventario.ver` se mira, pero solo `inventario.gestionar` da de alta, publica y
   * retira (matriz del plan 001 §9). Sin servidor no hay sesión: la maqueta permite todo.
   */
  const puedeGestionar = !conServidor || puede('inventario.gestionar');

  const [filtroEstado, setFiltroEstado] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const conteo = {
    total: vehiculos.length,
    disponibles: vehiculos.filter((v) => (v.estadoDisponibilidad ?? 'disponible') === 'disponible').length,
    conCita: vehiculos.filter((v) => v.estadoDisponibilidad === 'cita_agendada').length,
    vendidos: vehiculos.filter((v) => v.estadoDisponibilidad === 'vendido').length,
    sinPublicar: vehiculos.filter((v) => v.publicacion && v.publicacion.estado !== 'publicado').length,
  };

  const filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todos', texto: `Todos (${conteo.total})` },
    { valor: 'disponible', texto: `Disponibles (${conteo.disponibles})` },
    { valor: 'cita_agendada', texto: `Con cita (${conteo.conCita})` },
    { valor: 'vendido', texto: `Vendidos (${conteo.vendidos})` },
    ...(conServidor ? [{ valor: 'sin_publicar' as Filtro, texto: `Sin publicar (${conteo.sinPublicar})` }] : []),
  ];

  const vehiculosFiltrados = vehiculos.filter((v) => {
    if (filtroEstado === 'sin_publicar') {
      if (!v.publicacion || v.publicacion.estado === 'publicado') return false;
    } else if (filtroEstado !== 'todos' && (v.estadoDisponibilidad ?? 'disponible') !== filtroEstado) {
      return false;
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const coincide =
        v.id.toLowerCase().includes(q) ||
        v.marca.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        v.version.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q);
      if (!coincide) return false;
    }

    return true;
  });

  /** Toda acción sobre el servidor pasa por aquí: comparte el ocupado, el aviso y el error. */
  const ejecutar = async (accion: () => Promise<string>) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      setAviso(await accion());
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = (id: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar ${nombre} (${id})? Solo se puede si nunca llegó a publicarse.`)) return;
    void ejecutar(async () => {
      await eliminarVehiculo(id);
      return `${nombre} eliminado del inventario.`;
    });
  };

  const publicarTodos = () =>
    ejecutar(async () => {
      const { publicados, pendientes } = await publicarListos();
      const hechos = `${publicados.length} ${publicados.length === 1 ? 'vehículo publicado' : 'vehículos publicados'}`;
      return pendientes.length > 0
        ? `${hechos}. Quedan ${pendientes.length} sin publicar: ${pendientes
            .map((p) => `${p.codigo} (${p.motivos.join(' ')})`)
            .join('; ')}`
        : `${hechos}.`;
    });

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 700 }}>Inventario y venta de vehículos</h1>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
            {!puedeGestionar
              ? 'Puedes consultar el inventario; darlo de alta y publicarlo corresponde al equipo de inventario.'
              : conServidor
                ? 'Los vehículos viven en el servidor: lo que publiques aquí es lo que ve el cliente en la vitrina.'
                : 'Modo maqueta: el inventario vive solo en este navegador.'}
            {tasa && ` Tasa BCV del euro: ${formatoBs(tasa.valor)} (${tasa.fecha}).`}
          </p>
        </div>
        {puedeGestionar && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {conServidor && conteo.sinPublicar > 0 && (
              <Boton variant="secondary" onClick={publicarTodos} disabled={ocupado}>
                Publicar los listos
              </Boton>
            )}
            <Boton variant="primary" onClick={() => navigate('/admin/vehiculo/nuevo')}>
              ➕ Nuevo vehículo
            </Boton>
          </div>
        )}
      </div>

      {aviso && <div className="aviso-inventario exito">{aviso}</div>}
      {(error || errorCarga) && (
        <div className="aviso-inventario error">
          {error ?? errorCarga}{' '}
          {errorCarga && !error && (
            <button type="button" onClick={recargar} className="btn-accion">
              Reintentar
            </button>
          )}
        </div>
      )}

      <div className="metricas-grid">
        <div className="metrica-card">
          <div className="metrica-label">Total</div>
          <div className="metrica-valor">{conteo.total}</div>
        </div>
        <div className="metrica-card" style={{ borderLeft: '4px solid #0F6E56' }}>
          <div className="metrica-label">Disponibles</div>
          <div className="metrica-valor" style={{ color: '#0F6E56' }}>
            {conteo.disponibles}
          </div>
        </div>
        <div className="metrica-card" style={{ borderLeft: '4px solid var(--naranja-500)' }}>
          <div className="metrica-label">Con cita</div>
          <div className="metrica-valor" style={{ color: 'var(--naranja-600)' }}>
            {conteo.conCita}
          </div>
        </div>
        <div className="metrica-card" style={{ borderLeft: '4px solid var(--texto-mudo)' }}>
          <div className="metrica-label">Vendidos</div>
          <div className="metrica-valor" style={{ color: 'var(--texto-secundario)' }}>
            {conteo.vendidos}
          </div>
        </div>
        {conServidor && (
          <div className="metrica-card" style={{ borderLeft: '4px solid var(--aviso-texto)' }}>
            <div className="metrica-label">Sin publicar</div>
            <div className="metrica-valor" style={{ color: 'var(--aviso-texto)' }}>
              {conteo.sinPublicar}
            </div>
          </div>
        )}
      </div>

      <div className="filtros-barra">
        <input
          type="text"
          placeholder="Buscar por código, marca, modelo o VIN…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-busqueda"
        />
        <div className="botones-filtro">
          {filtros.map(({ valor, texto }) => (
            <button
              key={valor}
              type="button"
              className={`btn-tag ${filtroEstado === valor ? 'activo' : ''}`}
              onClick={() => setFiltroEstado(valor)}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="tabla-contenedor">
        <table className="tabla-vehiculos">
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Año / sede</th>
              <th>Precio</th>
              <th>Fotos</th>
              <th>Imperfecciones</th>
              {conServidor && <th>Publicación</th>}
              <th>Disponibilidad</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={conServidor ? 8 : 7} style={{ textAlign: 'center', padding: 'var(--space-xxl)' }}>
                  {cargando ? 'Cargando el inventario…' : 'No hay vehículos que coincidan con el filtro.'}
                </td>
              </tr>
            ) : (
              vehiculosFiltrados.map((v) => {
                const estado = v.estadoDisponibilidad ?? 'disponible';
                const imperfecciones = obtenerImperfecciones(v.id);
                const minimas = v.fotosMinimas ?? 5;
                const cuantasFotos = v.fotos?.length ?? 0;
                const precioBs = v.precioVes ?? v.precio * rateBCV;
                const publicacion = v.publicacion;
                const falta = v.faltaParaPublicar ?? [];

                return (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '60px', height: '45px', borderRadius: '4px', overflow: 'hidden', flex: '0 0 auto' }}>
                          <FotoVehiculo vehiculo={v} alto={45} redondeo="4px" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>
                            {v.marca} {v.modelo}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                            {v.version} · {v.kilometraje.toLocaleString('es-VE')} km
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                            {v.id}
                            {v.esDemostracion && ' · ejemplo'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{v.anio}</div>
                      <div style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>{v.sede}</div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{formatoEUR(v.precio)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>Ref. {formatoBs(precioBs)}</div>
                    </td>

                    <td>
                      <span className={`pastilla ${conServidor && cuantasFotos < minimas ? 'aviso' : 'neutra'}`}>
                        {cuantasFotos}
                        {conServidor && ` / ${minimas}`}
                      </span>
                    </td>

                    <td>
                      <span className={`pastilla ${imperfecciones.length > 0 ? 'aviso' : 'neutra'}`}>
                        {imperfecciones.length} declaradas
                      </span>
                    </td>

                    {conServidor && (
                      <td>
                        {publicacion ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                            <span className={`estado-publicacion ${publicacion.estado}`}>
                              {publicacion.estado === 'publicado'
                                ? 'En la vitrina'
                                : publicacion.estado === 'pausado'
                                  ? 'Pausado'
                                  : 'Borrador'}
                            </span>
                            {!puedeGestionar ? null : publicacion.estado === 'publicado' ? (
                              <button
                                type="button"
                                className="btn-accion"
                                disabled={ocupado}
                                onClick={() =>
                                  void ejecutar(async () => {
                                    await pausarVehiculo(v.id);
                                    return `${v.id} salió de la vitrina.`;
                                  })
                                }
                              >
                                Pausar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-accion"
                                disabled={ocupado || falta.length > 0}
                                title={falta.length > 0 ? falta.join(' ') : 'Publicar en la vitrina'}
                                onClick={() =>
                                  void ejecutar(async () => {
                                    await publicarVehiculo(v.id);
                                    return `${v.id} ya está en la vitrina.`;
                                  })
                                }
                              >
                                Publicar
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="pastilla neutra">—</span>
                        )}
                      </td>
                    )}

                    <td>
                      <select
                        value={estado}
                        disabled={ocupado || !puedeGestionar}
                        onChange={(e) => {
                          const nuevo = e.target.value as EstadoDisponibilidad;
                          void ejecutar(async () => {
                            await cambiarEstadoVehiculo(v.id, nuevo);
                            return `Disponibilidad de ${v.id} actualizada.`;
                          });
                        }}
                        className={`select-estado ${estado}`}
                      >
                        <option value="disponible">🟢 Disponible</option>
                        <option value="cita_agendada">🟠 Con cita</option>
                        <option value="vendido">⚪ Vendido</option>
                      </select>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        {puedeGestionar && (
                          <button
                            type="button"
                            className="btn-accion"
                            onClick={() => navigate(`/admin/vehiculo/editar/${v.id}`)}
                            title="Editar datos, fotos e imperfecciones"
                          >
                            ✏️ Editar
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-accion"
                          onClick={() => navigate(`/vehiculo/${v.id}`)}
                          title="Ver la ficha pública"
                        >
                          👁️ Ver
                        </button>
                        {puedeGestionar && (
                          <button
                            type="button"
                            className="btn-accion peligro"
                            disabled={ocupado}
                            onClick={() => eliminar(v.id, `${v.marca} ${v.modelo}`)}
                            title="Eliminar (solo si nunca se publicó)"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        .admin-header {
          display: flex; justify-content: space-between; align-items: center; gap: var(--space-lg);
          flex-wrap: wrap; margin-bottom: var(--space-xl);
        }
        .aviso-inventario {
          border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px; margin-bottom: var(--space-lg);
        }
        .aviso-inventario.exito { background-color: var(--exito-fondo); color: var(--exito-texto); }
        .aviso-inventario.error { background-color: var(--peligro-fondo); color: var(--peligro-texto); }
        .metricas-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md);
          margin-bottom: var(--space-xl);
        }
        .metrica-card {
          background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-md);
          padding: 16px;
        }
        .metrica-label { font-size: 12px; color: var(--texto-secundario); font-weight: 600; }
        .metrica-valor { font-size: 28px; font-weight: 700; margin-top: 4px; }
        .filtros-barra {
          display: flex; justify-content: space-between; align-items: center; gap: var(--space-md);
          margin-bottom: var(--space-lg); flex-wrap: wrap;
        }
        .input-busqueda {
          padding: 8px 12px; border: 1px solid var(--borde); border-radius: var(--radius-sm); font-size: 13px;
          min-width: 280px; outline: none;
        }
        .input-busqueda:focus { border-color: var(--naranja-500); }
        .botones-filtro { display: flex; gap: 6px; flex-wrap: wrap; }
        .btn-tag {
          background-color: var(--blanco); border: 1px solid var(--borde); padding: 6px 12px;
          border-radius: var(--radius-pill); font-size: 12px; font-weight: 600; cursor: pointer;
          color: var(--texto-secundario);
        }
        .btn-tag.activo { background-color: var(--naranja-500); color: var(--blanco); border-color: var(--naranja-500); }
        .tabla-contenedor {
          background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
          overflow-x: auto;
        }
        .tabla-vehiculos { width: 100%; border-collapse: collapse; text-align: left; }
        .tabla-vehiculos th {
          padding: 12px 16px; background-color: var(--superficie); border-bottom: 1px solid var(--borde-claro);
          font-size: 12px; font-weight: 700; color: var(--texto-mudo); text-transform: uppercase;
          letter-spacing: 0.05em; white-space: nowrap;
        }
        .tabla-vehiculos td { padding: 14px 16px; border-bottom: 1px solid var(--borde-claro); font-size: 13px; }
        .pastilla {
          display: inline-block; padding: 3px 8px; border-radius: var(--radius-pill); font-size: 11px;
          font-weight: 600; white-space: nowrap;
        }
        .pastilla.neutra { background-color: var(--superficie); color: var(--texto-mudo); }
        .pastilla.aviso { background-color: var(--aviso-fondo); color: var(--aviso-texto); }
        .estado-publicacion {
          display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 9px;
          border-radius: var(--radius-pill); white-space: nowrap;
        }
        .estado-publicacion.publicado { background-color: var(--exito-fondo); color: var(--exito-texto); }
        .estado-publicacion.pausado { background-color: var(--aviso-fondo); color: var(--aviso-texto); }
        .estado-publicacion.borrador { background-color: var(--superficie); color: var(--texto-secundario); }
        .select-estado {
          padding: 6px 10px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600;
          border: 1px solid var(--borde); outline: none; cursor: pointer;
        }
        .select-estado:disabled { cursor: wait; opacity: 0.7; }
        .select-estado.disponible { background-color: var(--exito-fondo); color: var(--exito-texto); border-color: #BEE7D7; }
        .select-estado.cita_agendada { background-color: var(--naranja-50); color: var(--naranja-700); border-color: var(--naranja-200); }
        .select-estado.vendido { background-color: var(--superficie); color: var(--texto-mudo); }
        .btn-accion {
          background: none; border: 1px solid var(--borde); border-radius: var(--radius-sm); padding: 6px 10px;
          font-size: 12px; font-weight: 600; cursor: pointer; color: var(--texto-secundario);
        }
        .btn-accion:hover:not(:disabled) { background-color: var(--superficie); color: var(--texto-primario); }
        .btn-accion:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-accion.peligro:hover:not(:disabled) {
          background-color: var(--peligro-fondo); border-color: var(--peligro-texto); color: var(--peligro-texto);
        }
      `}</style>
    </div>
  );
};
