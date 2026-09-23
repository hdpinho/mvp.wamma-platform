import React from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export const PiePagina: React.FC = () => {
  return (
    <footer className="pie-pagina">
      <div className="pie-contenedor">
        {/* Fila superior: Marca y propuesta */}
        <div className="pie-cabecera">
          <div className="pie-marca">
            <Link to="/" aria-label="WAMMA Inicio">
              <Logo articulacion="horizontal" variante="blanco" alto={32} />
            </Link>
            <p className="pie-slogan">
              Plataforma de venta, certificación con Estándar WAMMA y financiamiento de vehículos usados
              garantizados en Venezuela. Todo bajo un mismo techo.
            </p>
          </div>

          <div className="pie-sede-contacto">
            <div className="pie-item-contacto">
              <span className="pie-icono" aria-hidden="true">📍</span>
              <div>
                <strong>Sede Distrito Capital</strong>
                <span>Gran Caracas, Venezuela</span>
              </div>
            </div>
            <div className="pie-item-contacto">
              <span className="pie-icono" aria-hidden="true">🕒</span>
              <div>
                <strong>Horario de atención</strong>
                <span>Lunes a Viernes: 9:00 AM – 5:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fila intermedia: Columnas de enlaces (Sitemap estructurado estilo Kavak) */}
        <div className="pie-grid">
          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Comprar auto</h4>
            <ul className="pie-lista">
              <li><Link to="/catalogo">Explorar vitrina completa</Link></li>
              <li><Link to="/catalogo?q=Toyota">Toyota en Caracas</Link></li>
              <li><Link to="/catalogo?q=Chevrolet">Chevrolet en Caracas</Link></li>
              <li><Link to="/catalogo?q=Ford">Ford en Caracas</Link></li>
              <li><Link to="/catalogo?q=Hyundai">Hyundai en Caracas</Link></li>
              <li><Link to="/catalogo?q=Chery">Chery en Caracas</Link></li>
            </ul>
          </div>

          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Financiamiento</h4>
            <ul className="pie-lista">
              <li><Link to="/financiamiento">Calcula tu capacidad de pago</Link></li>
              <li><Link to="/financiamiento">Planes fijos a 24 meses</Link></li>
              <li><Link to="/financiamiento">Cuotas en Euros (EUR)</Link></li>
              <li><Link to="/catalogo">Vehículos con financiamiento</Link></li>
              <li><Link to="/solicitud-credito">Solicitud de crédito</Link></li>
            </ul>
          </div>

          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Estándar WAMMA</h4>
            <ul className="pie-lista">
              <li><Link to="/catalogo">Certificado con Estándar WAMMA</Link></li>
              <li><Link to="/catalogo">Validación legal de documentos</Link></li>
              <li><Link to="/catalogo">Fotografías reales de estudio</Link></li>
              <li><Link to="/catalogo">Garantía WAMMA</Link></li>
              <li><Link to="/favoritos">Vehículos guardados</Link></li>
            </ul>
          </div>

          <div className="pie-columna">
            <h4 className="pie-titulo-columna">Atención al cliente</h4>
            <ul className="pie-lista">
              <li><a href="https://wa.me/584120000000" target="_blank" rel="noopener noreferrer">WhatsApp de atención</a></li>
              <li><Link to="/catalogo">Agendar cita presencial</Link></li>
              <li><span className="pie-texto-mudo">soporte@wamma.com</span></li>
              <li><Link to="/admin/ingresar">Acceso Backoffice</Link></li>
            </ul>
          </div>
        </div>

        {/* Fila inferior: Derechos y advertencia legal */}
        <div className="pie-legal">
          <div className="pie-copyright">
            <span>© {new Date().getFullYear()} WAMMA by Token Pago POS. Todos los derechos reservados.</span>
            <div className="pie-enlaces-legales">
              <span className="enlace-legal">Términos y condiciones</span>
              <span className="separador">·</span>
              <span className="enlace-legal">Política de privacidad</span>
              <span className="separador">·</span>
              <span className="enlace-legal">Transparencia</span>
            </div>
          </div>

          <p className="pie-disclaimer">
            * Las cuotas mensuales presentadas son estimaciones referenciales expresadas en Euros (EUR).
            El financiamiento propio es evaluado y aprobado por WAMMA bajo políticas de capacidad crediticia
            responsable (máximo 30 % del ingreso comprobable). Sujeto a disponibilidad y verificación de documentos.
          </p>
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

        .pie-cabecera {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: var(--space-xl);
          padding-bottom: var(--space-xl);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pie-marca {
          max-width: 440px;
        }

        .pie-slogan {
          margin-top: var(--space-md);
          font-size: 14px;
          line-height: 1.6;
          color: #A8A29A;
        }

        .pie-sede-contacto {
          display: flex;
          gap: var(--space-xl);
          flex-wrap: wrap;
        }

        .pie-item-contacto {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          font-size: 13px;
          color: #D1CBC3;
        }

        .pie-item-contacto strong {
          display: block;
          color: var(--blanco);
          font-size: 13px;
        }

        .pie-icono {
          font-size: 20px;
        }

        .pie-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-xl);
        }

        .pie-columna {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .pie-titulo-columna {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.5px;
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
          gap: 10px;
        }

        .pie-lista a {
          color: #A8A29A;
          text-decoration: none;
          font-size: 13px;
          transition: color 0.15s ease;
        }

        .pie-lista a:hover {
          color: var(--blanco);
          text-decoration: underline;
        }

        .pie-texto-mudo {
          color: #7A756D;
          font-size: 13px;
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
          gap: var(--space-sm);
        }

        .pie-enlaces-legales {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .enlace-legal {
          color: #A8A29A;
          cursor: pointer;
        }

        .enlace-legal:hover {
          color: var(--blanco);
        }

        .separador {
          color: #555;
        }

        .pie-disclaimer {
          line-height: 1.5;
          font-size: 11px;
          color: #635E57;
        }

        @media (max-width: 900px) {
          .pie-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .pie-grid {
            grid-template-columns: 1fr;
          }
          .pie-cabecera {
            flex-direction: column;
          }
          .pie-sede-contacto {
            flex-direction: column;
            gap: var(--space-md);
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
