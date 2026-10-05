import React from 'react';
import { Link } from 'react-router-dom';

export const PiePagina: React.FC = () => {
  return (
    <footer className="pie-pagina">
      <div className="pie-contenedor">
        {/* Grid estructurado de 3 columnas equilibradas */}
        <div className="pie-grid">
          {/* Columna 1: Comprar auto */}
          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Comprar auto</h4>
            <ul className="pie-lista">
              <li>
                <Link to="/catalogo">Explorar vitrina completa</Link>
              </li>
              <li>
                <Link to="/favoritos">Mi Favorito</Link>
              </li>
              <li>
                <Link to="/catalogo">Agendar cita presencial</Link>
              </li>
            </ul>
          </div>

          {/* Columna 2: Financiamiento */}
          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Financiamiento</h4>
            <ul className="pie-lista">
              <li>
                <Link to="/financiamiento">Calcula tu capacidad de pago</Link>
              </li>
              <li>
                <span className="pie-texto-mudo">Planes fijos a 24 meses</span>
              </li>
              <li>
                <span className="pie-texto-mudo">Cuotas fijadas en Euros (EUR)</span>
              </li>
              <li>
                <span className="pie-texto-mudo">Solicitud de crédito digital</span>
              </li>
            </ul>
          </div>

          {/* Columna 3: Atención y Sede */}
          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Atención y Sede</h4>
            <ul className="pie-lista pie-lista-contacto">
              <li>
                <a
                  href="https://wa.me/584120000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pie-enlace-contacto"
                >
                  <svg className="pie-icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>WhatsApp de atención</span>
                </a>
              </li>
              <li>
                <a href="mailto:soporte@wamma.com" className="pie-enlace-contacto">
                  <svg className="pie-icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <span>soporte@wamma.com</span>
                </a>
              </li>
              <li className="pie-item-datos">
                <svg className="pie-icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <div>
                  <strong className="pie-dato-titulo">Sede Distrito Capital</strong>
                  <span className="pie-dato-sub">Gran Caracas, Venezuela</span>
                </div>
              </li>
              <li className="pie-item-datos">
                <svg className="pie-icono-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  <strong className="pie-dato-titulo">Horario de atención</strong>
                  <span className="pie-dato-sub">Lun a Vie: 9:00 AM – 5:00 PM</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Fila inferior: Derechos y accesos legales / administrativos */}
        <div className="pie-legal">
          <div className="pie-copyright">
            <span>© {new Date().getFullYear()} WAMMA by Token Pago POS. Todos los derechos reservados.</span>
            <div className="pie-enlaces-legales">
              <span className="enlace-legal">Términos y condiciones</span>
              <span className="separador">·</span>
              <span className="enlace-legal">Política de privacidad</span>
              <span className="separador">·</span>
              <span className="enlace-legal">Transparencia</span>
              <span className="separador">·</span>
              <Link to="/admin/ingresar" className="enlace-backoffice-discreto" title="Acceso al portal administrativo">
                Acceso Backoffice
              </Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .pie-pagina {
          background-color: #181512;
          color: #ECEAE6;
          padding: var(--space-xxxl) var(--space-lg) var(--space-xl);
          margin-top: auto;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-family: var(--font-sans);
        }

        .pie-contenedor {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-xxl);
        }

        .pie-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-xxl);
        }

        .pie-columna {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .pie-titulo-columna {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.75px;
          text-transform: uppercase;
          color: var(--naranja-500);
          margin-bottom: var(--space-xs);
        }

        .pie-lista {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pie-lista a {
          color: #A8A29A;
          text-decoration: none;
          font-size: 13px;
          line-height: 1.4;
          transition: color 0.15s ease;
        }

        .pie-lista a:hover {
          color: var(--blanco);
          text-decoration: underline;
        }

        .pie-texto-mudo {
          color: #8C867E;
          font-size: 13px;
          line-height: 1.4;
          cursor: default;
        }

        .pie-lista-contacto {
          gap: 14px;
        }

        .pie-enlace-contacto {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .pie-item-datos {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: #A8A29A;
          font-size: 13px;
        }

        .pie-icono-svg {
          width: 16px;
          height: 16px;
          color: var(--naranja-500);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .pie-dato-titulo {
          display: block;
          color: #ECEAE6;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.3;
        }

        .pie-dato-sub {
          display: block;
          color: #8C867E;
          font-size: 12px;
          margin-top: 2px;
        }

        .pie-legal {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          padding-top: var(--space-xl);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 12px;
          color: #7A756D;
        }

        .pie-copyright {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-md);
        }

        .pie-enlaces-legales {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: var(--space-sm);
        }

        .enlace-legal {
          color: #A8A29A;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .enlace-legal:hover {
          color: var(--blanco);
        }

        .separador {
          color: #44403C;
        }

        .enlace-backoffice-discreto {
          color: #A8A29A;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .enlace-backoffice-discreto:hover {
          color: var(--naranja-500);
          text-decoration: underline;
        }

        @media (max-width: 900px) {
          .pie-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-xl);
          }
        }

        @media (max-width: 600px) {
          .pie-grid {
            grid-template-columns: 1fr;
            gap: var(--space-xl);
          }
          .pie-copyright {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </footer>
  );
};

