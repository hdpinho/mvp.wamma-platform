import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Logo } from '../Logo';
import { useCRM, CORREO_NOTIFICACIONES_WAMMA } from '../../state/crmContexto';
import { useSesion } from '../../state/sesionContexto';
import { estaEstancada } from '../../types/crm';
import { nombreRol } from '../../types/seguridad';
import { EstadoServidor } from './EstadoServidor';
import { MENU_ADMIN } from './menu';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const { citas, oportunidades, ultimaActividad } = useCRM();
  const { estado, perfil, puede, cerrar } = useSesion();

  const citasPendientes = citas.filter((c) => c.estado === 'pendiente').length;
  const estancadas = oportunidades.filter((o) => estaEstancada(o, ultimaActividad(o.id))).length;
  const contadores: Record<string, { valor: number; titulo?: string } | undefined> = {
    '/admin/citas': { valor: citasPendientes },
    '/admin/embudo': { valor: estancadas, titulo: 'Oportunidades estancadas' },
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Logo articulacion="horizontal" variante="blanco" alto={34} />
          <span className="badge-admin">BACKOFFICE</span>
        </div>

        {/* Solo las secciones que el rol permite (plan 001 §9); el servidor aplica lo mismo. */}
        <nav className="admin-nav">
          {MENU_ADMIN.filter((entrada) => entrada.permisos.length === 0 || puede(...entrada.permisos)).map((entrada) => {
            const contador = contadores[entrada.ruta];
            return (
              <NavLink
                key={entrada.ruta}
                to={entrada.ruta}
                className={({ isActive }) => `admin-nav-item ${isActive ? 'activo' : ''}`}
              >
                <span className="admin-nav-icono">{entrada.icono}</span>
                <span>{entrada.texto}</span>
                {contador && contador.valor > 0 && (
                  <span className="admin-badge-count" title={contador.titulo}>
                    {contador.valor}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          {estado === 'activa' && perfil && (
            <div className="admin-cuenta">
              <div className="admin-cuenta-nombre">
                {perfil.nombre} {perfil.apellido}
              </div>
              <div className="admin-cuenta-detalle">
                {perfil.usuario} · {perfil.roles.map((r) => nombreRol(r)).join(', ')}
              </div>
              <div className="admin-cuenta-acciones">
                <NavLink
                  to="/admin/cuenta"
                  className={({ isActive }) => `admin-cuenta-enlace ${isActive ? 'activo' : ''}`}
                >
                  Mi cuenta
                </NavLink>
                <button type="button" className="admin-cuenta-salir" onClick={() => void cerrar()}>
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
          {estado === 'sin_servidor' && (
            <div className="admin-cuenta-detalle" style={{ marginBottom: '10px' }}>
              Modo maqueta: sin inicio de sesión.
            </div>
          )}
          <EstadoServidor />
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
            ← Volver al Catálogo Público
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>V 3.0 Release 1</span>
            <NavLink to="/admin/acerca" style={{ fontSize: '11px', color: '#fb923c', textDecoration: 'none' }}>
              Acerca de →
            </NavLink>
          </div>
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
        .admin-cuenta {
          background-color: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          margin-bottom: 12px;
        }
        .admin-cuenta-nombre {
          font-size: 13px;
          font-weight: 700;
          color: var(--blanco);
        }
        .admin-cuenta-detalle {
          font-size: 11px;
          color: rgba(255,255,255,0.6);
          margin-top: 2px;
          line-height: 1.4;
        }
        .admin-cuenta-acciones {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .admin-cuenta-enlace,
        .admin-cuenta-salir {
          flex: 1;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          padding: 6px 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-decoration: none;
          color: var(--blanco);
        }
        .admin-cuenta-enlace {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .admin-cuenta-enlace.activo {
          background-color: var(--naranja-500);
          border-color: var(--naranja-500);
        }
        .admin-cuenta-salir {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.3);
        }
        .admin-cuenta-salir:hover,
        .admin-cuenta-enlace:hover {
          background-color: rgba(255,255,255,0.18);
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
