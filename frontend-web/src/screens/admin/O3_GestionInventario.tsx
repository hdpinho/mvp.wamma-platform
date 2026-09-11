import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVehiculos } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';
import { FotoVehiculo } from '../../components/FotoVehiculo';

interface O3GestionInventarioProps {
  rateBCV: number;
}

export const O3_GestionInventario: React.FC<O3GestionInventarioProps> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const { vehiculos, cambiarEstadoVehiculo, eliminarVehiculo, obtenerImperfecciones } =
    useVehiculos();

  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');

  const vehiculosFiltrados = vehiculos.filter((v) => {
    const estado = v.estadoDisponibilidad || 'disponible';
    if (filtroEstado !== 'todos' && estado !== filtroEstado) return false;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      const coincide =
        v.marca.toLowerCase().includes(q) ||
        v.modelo.toLowerCase().includes(q) ||
        v.version.toLowerCase().includes(q) ||
        v.vin.toLowerCase().includes(q);
      if (!coincide) return false;
    }

    return true;
  });

  const conteo = {
    total: vehiculos.length,
    disponibles: vehiculos.filter((v) => (v.estadoDisponibilidad || 'disponible') === 'disponible')
      .length,
    conCita: vehiculos.filter((v) => v.estadoDisponibilidad === 'cita_agendada').length,
    vendidos: vehiculos.filter((v) => v.estadoDisponibilidad === 'vendido').length,
  };

  const handleEliminar = (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el vehículo ${nombre}?`)) {
      eliminarVehiculo(id);
    }
  };

  return (
    <div>
      {/* Cabecera y botón de acción */}
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 700 }}>
            Inventario y Venta de Vehículos
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
            Gestiona los vehículos publicados, actualiza disponibilidad, fotos y detalles de inspección.
          </p>
        </div>
        <Boton
          variant="primary"
          onClick={() => navigate('/admin/vehiculo/nuevo')}
        >
          ➕ Publicar Nuevo Vehículo
        </Boton>
      </div>

      {/* Tarjetas de métricas rápidas */}
      <div className="metricas-grid">
        <div className="metrica-card">
          <div className="metrica-label">Total en Catálogo</div>
          <div className="metrica-valor">{conteo.total}</div>
        </div>
        <div className="metrica-card" style={{ borderLeft: '4px solid #0F6E56' }}>
          <div className="metrica-label">Disponibles para Cita</div>
          <div className="metrica-valor" style={{ color: '#0F6E56' }}>
            {conteo.disponibles}
          </div>
        </div>
        <div className="metrica-card" style={{ borderLeft: '4px solid var(--naranja-500)' }}>
          <div className="metrica-label">Con Cita en Curso (Reservados)</div>
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
      </div>

      {/* Filtros de búsqueda */}
      <div className="filtros-barra">
        <input
          type="text"
          placeholder="Buscar por marca, modelo o VIN..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-busqueda"
        />

        <div className="botones-filtro">
          <button
            type="button"
            className={`btn-tag ${filtroEstado === 'todos' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('todos')}
          >
            Todos ({conteo.total})
          </button>
          <button
            type="button"
            className={`btn-tag ${filtroEstado === 'disponible' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('disponible')}
          >
            Disponibles ({conteo.disponibles})
          </button>
          <button
            type="button"
            className={`btn-tag ${filtroEstado === 'cita_agendada' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('cita_agendada')}
          >
            Con Cita ({conteo.conCita})
          </button>
          <button
            type="button"
            className={`btn-tag ${filtroEstado === 'vendido' ? 'activo' : ''}`}
            onClick={() => setFiltroEstado('vendido')}
          >
            Vendidos ({conteo.vendidos})
          </button>
        </div>
      </div>

      {/* Tabla de vehículos */}
      <div className="tabla-contenedor">
        <table className="tabla-vehiculos">
          <thead>
            <tr>
              <th>Vehículo</th>
              <th>Año / Sede</th>
              <th>Precio USD / Bs</th>
              <th>Imperfecciones</th>
              <th>Estado Comercial (Control)</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-xxl)' }}>
                  No se encontraron vehículos que coincidan con el filtro.
                </td>
              </tr>
            ) : (
              vehiculosFiltrados.map((v) => {
                const estado = v.estadoDisponibilidad || 'disponible';
                const imperfecciones = obtenerImperfecciones(v.id);
                const precioBs = (v.precioUSD * rateBCV).toLocaleString('es-VE', {
                  maximumFractionDigits: 0,
                });

                return (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '60px', height: '45px', borderRadius: '4px', overflow: 'hidden' }}>
                          <FotoVehiculo vehiculo={v} alto={45} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>
                            {v.marca} {v.modelo}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                            {v.version} · {v.kilometraje.toLocaleString()} km
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{v.anio}</div>
                      <div style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>{v.sede}</div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>
                        ${v.precioUSD.toLocaleString()} USD
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                        Ref. {precioBs} Bs.
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor:
                            imperfecciones.length > 0 ? 'var(--aviso-fondo)' : 'var(--superficie)',
                          color:
                            imperfecciones.length > 0 ? 'var(--aviso-texto)' : 'var(--texto-mudo)',
                        }}
                      >
                        {imperfecciones.length} declaradas
                      </span>
                    </td>

                    <td>
                      <select
                        value={estado}
                        onChange={(e) =>
                          cambiarEstadoVehiculo(
                            v.id,
                            e.target.value as 'disponible' | 'cita_agendada' | 'vendido',
                          )
                        }
                        className={`select-estado ${estado}`}
                      >
                        <option value="disponible">🟢 Disponible (Botón Activo)</option>
                        <option value="cita_agendada">🟠 Cita en Curso (Botón Bloqueado)</option>
                        <option value="vendido">⚪ Vendido</option>
                      </select>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-accion"
                          onClick={() => navigate(`/admin/vehiculo/editar/${v.id}`)}
                          title="Editar datos, fotos e imperfecciones"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn-accion"
                          onClick={() => navigate(`/vehiculo/${v.id}`)}
                          title="Ver en el catálogo público"
                        >
                          👁️ Ver
                        </button>
                        <button
                          type="button"
                          className="btn-accion peligro"
                          onClick={() => handleEliminar(v.id, `${v.marca} ${v.modelo}`)}
                          title="Eliminar vehículo"
                        >
                          🗑️
                        </button>
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
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-xl);
        }
        .metricas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-md);
          margin-bottom: var(--space-xl);
        }
        .metrica-card {
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md);
          padding: 16px;
        }
        .metrica-label {
          font-size: 12px;
          color: var(--texto-secundario);
          font-weight: 600;
        }
        .metrica-valor {
          font-size: 28px;
          font-weight: 700;
          margin-top: 4px;
        }
        .filtros-barra {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-md);
          margin-bottom: var(--space-lg);
          flex-wrap: wrap;
        }
        .input-busqueda {
          padding: 8px 12px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          font-size: 13px;
          min-width: 280px;
          outline: none;
        }
        .input-busqueda:focus {
          border-color: var(--naranja-500);
        }
        .botones-filtro {
          display: flex;
          gap: 6px;
        }
        .btn-tag {
          background-color: var(--blanco);
          border: 1px solid var(--borde);
          padding: 6px 12px;
          border-radius: var(--radius-pill);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          color: var(--texto-secundario);
        }
        .btn-tag.activo {
          background-color: var(--naranja-500);
          color: var(--blanco);
          border-color: var(--naranja-500);
        }
        .tabla-contenedor {
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg);
          overflow-x: auto;
        }
        .tabla-vehiculos {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .tabla-vehiculos th {
          padding: 12px 16px;
          background-color: var(--superficie);
          border-bottom: 1px solid var(--borde-claro);
          font-size: 12px;
          font-weight: 700;
          color: var(--texto-mudo);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tabla-vehiculos td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--borde-claro);
          font-size: 13px;
        }
        .select-estado {
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--borde);
          outline: none;
          cursor: pointer;
        }
        .select-estado.disponible {
          background-color: var(--exito-fondo);
          color: var(--exito-texto);
          border-color: #BEE7D7;
        }
        .select-estado.cita_agendada {
          background-color: var(--naranja-50);
          color: var(--naranja-700);
          border-color: var(--naranja-200);
        }
        .select-estado.vendido {
          background-color: var(--superficie);
          color: var(--texto-mudo);
        }
        .btn-accion {
          background: none;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          color: var(--texto-secundario);
        }
        .btn-accion:hover {
          background-color: var(--superficie);
          color: var(--texto-primario);
        }
        .btn-accion.peligro:hover {
          background-color: var(--peligro-fondo);
          border-color: var(--peligro-texto);
          color: var(--peligro-texto);
        }
      `}</style>
    </div>
  );
};
