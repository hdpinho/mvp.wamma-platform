import React from 'react';
import { NavLink } from 'react-router-dom';
import { Logo } from './Logo';
import { useFavoritos } from '../state/favoritosContexto';

interface BarraNavegacionProps {
  kycLevel: 'básico' | 'verificado';
}

/** Menú principal de escritorio. */
const MENU = [
  { a: '/catalogo', texto: 'Comprar' },
  { a: '/vender', texto: 'Vender' },
  { a: '/vender?modo=cambio', texto: 'Cambiar' },
  { a: '/suscripcion', texto: 'Suscripción' },
  { a: '/solicitud-credito', texto: 'Financiamiento' },
];

/** Pestañas inferiores en móvil. */
const TABS = [
  {
    a: '/catalogo',
    texto: 'Vitrina',
    icono: (
      <>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </>
    ),
  },
  {
    a: '/vender',
    texto: 'Vender',
    icono: (
      <>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </>
    ),
  },
  {
    a: '/favoritos',
    texto: 'Guardados',
    icono: (
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    ),
  },
  {
    a: '/panel',
    texto: 'Mi Panel',
    icono: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
];

export const BarraNavegacion: React.FC<BarraNavegacionProps> = ({ kycLevel }) => {
  const { favoritos } = useFavoritos();

  return (
    <>
      {/* ── Barra superior (escritorio) ─────────────────────── */}
      <header className="barra-escritorio">
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          {/* Logo oficial: articulación horizontal sobre fondo blanco (manual de marca) */}
          <Logo articulacion="horizontal" variante="naranja" alto={46} className="logo-nav" />
        </NavLink>

        <nav className="menu-escritorio">
          {MENU.map((item) => (
            <NavLink
              key={item.a}
              to={item.a}
              className={({ isActive }) => `enlace-nav ${isActive ? 'activo' : ''}`}
            >
              {item.texto}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <NavLink
            to="/favoritos"
            aria-label={`Guardados (${favoritos.length})`}
            style={{ position: 'relative', display: 'flex', color: 'var(--texto-secundario)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {favoritos.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-8px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--naranja-500)',
                  color: 'var(--blanco)',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {favoritos.length}
              </span>
            )}
          </NavLink>

          <NavLink to="/panel" className={({ isActive }) => `enlace-nav ${isActive ? 'activo' : ''}`}>
            Mi Panel
          </NavLink>

          <NavLink to="/onboarding" style={{ textDecoration: 'none' }}>
            <span
              className={`badge ${kycLevel === 'verificado' ? 'badge-exito' : 'badge-naranja'}`}
              style={{ fontSize: '10px' }}
            >
              KYC: {kycLevel}
            </span>
          </NavLink>
        </div>
      </header>

      {/* ── Pestañas inferiores (móvil) ─────────────────────── */}
      <nav className="barra-movil">
        {TABS.map((tab) => (
          <NavLink
            key={tab.a}
            to={tab.a}
            className={({ isActive }) => `pestana-movil ${isActive ? 'activa' : ''}`}
          >
            <span style={{ position: 'relative', display: 'flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tab.icono}
              </svg>
              {tab.a === '/favoritos' && favoritos.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-7px',
                    minWidth: '14px',
                    height: '14px',
                    padding: '0 3px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--naranja-500)',
                    color: 'var(--blanco)',
                    fontSize: '9px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {favoritos.length}
                </span>
              )}
            </span>
            <span>{tab.texto}</span>
          </NavLink>
        ))}
      </nav>

      <style>{`
        .barra-escritorio {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 88px;
          z-index: 900;
          background-color: var(--blanco);
          border-bottom: 2px solid var(--borde-claro);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-lg);
          padding: 0 var(--space-xxl);
        }
        .menu-escritorio { display: flex; gap: var(--space-xs); align-items: center; }

        /* Menú principal: Montserrat Bold, tamaño destacado (manual de marca) */
        .enlace-nav {
          font-family: var(--font-sans);
          font-size: 17px;
          font-weight: 700;
          color: var(--texto-primario);
          text-decoration: none;
          padding: 10px 16px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
          position: relative;
          transition: color 0.2s ease, background-color 0.2s ease;
        }
        .enlace-nav:hover { color: var(--naranja-500); background-color: var(--naranja-50); }
        .enlace-nav.activo { color: var(--naranja-500); }

        /* Subrayado naranja de la sección activa */
        .enlace-nav.activo::after {
          content: '';
          position: absolute;
          left: 16px; right: 16px; bottom: -2px;
          height: 3px;
          border-radius: 2px 2px 0 0;
          background-color: var(--naranja-500);
        }

        /* Entre 1025 y 1279 px se compacta todo para que la barra no desborde */
        @media (min-width: 1025px) and (max-width: 1279px) {
          .barra-escritorio { padding: 0 var(--space-lg); height: 76px; }
          .enlace-nav { font-size: 15px; padding: 10px 10px; }
          .enlace-nav.activo::after { left: 10px; right: 10px; }
          .logo-nav { height: 36px !important; }
        }

        .barra-movil {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 64px;
          z-index: 900;
          background-color: var(--blanco);
          border-top: 1px solid var(--borde-claro);
          display: flex;
          justify-content: space-around;
          align-items: center;
        }
        .pestana-movil {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          flex: 1;
          height: 100%;
          font-size: 10px;
          color: var(--texto-mudo);
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .pestana-movil.activa { color: var(--naranja-500); font-weight: 700; }

        @media (max-width: 1024px) { .barra-escritorio { display: none; } }
        @media (min-width: 1025px) { .barra-movil { display: none; } }
      `}</style>
    </>
  );
};
