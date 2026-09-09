import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../Logo';
import { useVehiculos, CORREO_NOTIFICACIONES_WAMMA } from '../../state/vehiculosContexto';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { citas } = useVehiculos();

  const citasPendientes = citas.filter((c) => c.estado === 'pendiente').length;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Logo articulacion="horizontal" variante="blanco" alto={34} />
          <span className="badge-admin">BACKOFFICE</span>
        </div>

        <nav className="admin-nav">
          <NavLink
            to="/admin/inventario"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'activo' : ''}`}
          >
            <span className="admin-nav-icono">🚗</span>
            <span>Inventario Vehículos</span>
          </NavLink>

          <NavLink
            to="/admin/citas"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'activo' : ''}`}
          >
            <span className="admin-nav-icono">📅</span>
            <span>Citas y Solicitudes</span>
            {citasPendientes > 0 && (
              <span className="admin-badge-count">{citasPendientes}</span>
            )}
          </NavLink>

          <NavLink
            to="/admin/financiamiento"
            className={({ isActive }) => `admin-nav-item ${isActive ? 'activo' : ''}`}
          >
            <span className="admin-nav-icono">💳</span>
            <span>Cotizador Crédito</span>
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
            Alertas de correo a:
            <div style={{ color: 'var(--blanco)', fontWeight: 600, wordBreak: 'break-all' }}>
              {CORREO_NOTIFICACIONES_WAMMA}
            </div>
          </div>
          <button
            type="button"
            className="btn-volver-web"
            onClick={() => navigate('/catalogo')}
          >
            ← Volver a Vitrina Pública
          </button>
        </div>
      </aside>

      <main className="admin-content">
        <Outlet />
      </main>

      <style>{`
        .admin-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          min-height: 100vh;
          background-color: var(--superficie);
        }
        @media (max-width: 900px) {
          .admin-layout {
            grid-template-columns: 1fr;
          }
        }
        .admin-sidebar {
          background-color: #141416;
          color: var(--blanco);
          display: flex;
          flex-direction: column;
          padding: var(--space-xl) var(--space-lg);
          border-right: 1px solid rgba(255,255,255,0.1);
        }
        .admin-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: var(--space-xl);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          margin-bottom: var(--space-xl);
        }
        .badge-admin {
          background-color: var(--naranja-500);
          color: var(--blanco);
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: var(--radius-pill);
          letter-spacing: 0.05em;
        }
        .admin-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          color: rgba(255,255,255,0.75);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }
        .admin-nav-item:hover {
          background-color: rgba(255,255,255,0.08);
          color: var(--blanco);
        }
        .admin-nav-item.activo {
          background-color: var(--naranja-500);
          color: var(--blanco);
        }
        .admin-nav-icono {
          font-size: 16px;
        }
        .admin-badge-count {
          margin-left: auto;
          background-color: #D32F2F;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: var(--radius-pill);
        }
        .admin-sidebar-footer {
          padding-top: var(--space-xl);
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .btn-volver-web {
          width: 100%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: var(--blanco);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-volver-web:hover {
          background: rgba(255,255,255,0.18);
        }
        .admin-content {
          padding: var(--space-xl);
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};
