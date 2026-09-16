import React, { useState } from 'react';
import { Logo } from '../../components/Logo';
import { WAMMA_VERSION } from '../../version';

export const O1_AcercaDe: React.FC = () => {
  const [copiado, setCopiado] = useState(false);

  const infoSistema = `WAMMA Platform Backoffice
Versión: ${WAMMA_VERSION.versionTexto}
Release: ${WAMMA_VERSION.release}
Fecha de Build: ${WAMMA_VERSION.fecha}
Moneda Base: EUR / Tasa BCV Dinámica
Constitución de Ingeniería: ${WAMMA_VERSION.componentes.constitucion.version}
Copyright: (c) 2026 WAMMA by Token Pago POS`;

  const copiarAlPortapapeles = async () => {
    try {
      await navigator.clipboard.writeText(infoSistema);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  return (
    <div className="acerca-admin-wrapper">
      <div className="acerca-admin-card">
        {/* Encabezado compacto con Logo oficial */}
        <div className="acerca-admin-header">
          <Logo articulacion="horizontal" variante="naranja" alto={42} />
          <span className="acerca-tag-release">{WAMMA_VERSION.versionTexto}</span>
        </div>

        <div className="acerca-admin-titulo-bloque">
          <h2 className="acerca-admin-nombre">WAMMA Platform</h2>
          <p className="acerca-admin-subtitulo">Panel de Administración y Operaciones</p>
        </div>

        {/* Tabla de especificaciones del sistema */}
        <div className="acerca-admin-datos">
          <div className="acerca-dato-fila">
            <span className="dato-clave">Versión de Plataforma</span>
            <span className="dato-valor destacado">{WAMMA_VERSION.versionTexto}</span>
          </div>

          <div className="acerca-dato-fila">
            <span className="dato-clave">Release</span>
            <span className="dato-valor">{WAMMA_VERSION.release}</span>
          </div>

          <div className="acerca-dato-fila">
            <span className="dato-clave">Moneda Base / Tasa</span>
            <span className="dato-valor">EUR / Tasa BCV Dinámica</span>
          </div>

          <div className="acerca-dato-fila">
            <span className="dato-clave">Constitución de Ingeniería</span>
            <span className="dato-valor">{WAMMA_VERSION.componentes.constitucion.version} (Septiembre 2026)</span>
          </div>
        </div>

        {/* Acciones de diagnóstico / soporte */}
        <div className="acerca-admin-footer">
          <button
            type="button"
            className="btn-copiar-diagnostico"
            onClick={() => void copiarAlPortapapeles()}
          >
            {copiado ? '✓ Información copiada' : '📋 Copiar información del sistema'}
          </button>
          <div className="acerca-admin-copyright">
            © 2026 WAMMA by Token Pago POS. Todos los derechos reservados.
            <br />
            Caracas, Venezuela.
          </div>
        </div>
      </div>

      <style>{`
        .acerca-admin-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-xl) var(--space-md);
          min-height: calc(100vh - 120px);
          font-family: var(--font-sans);
        }

        .acerca-admin-card {
          width: 100%;
          max-width: 520px;
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg);
          padding: 28px 32px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }

        .acerca-admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--borde-claro);
          margin-bottom: 16px;
        }

        .acerca-tag-release {
          background-color: var(--naranja-50, #fff7ed);
          color: var(--naranja-700);
          border: 1px solid var(--naranja-300);
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: var(--radius-pill);
        }

        .acerca-admin-titulo-bloque {
          margin-bottom: 20px;
        }

        .acerca-admin-nombre {
          font-size: 20px;
          font-weight: 800;
          color: var(--texto-primario);
          margin: 0 0 4px;
        }

        .acerca-admin-subtitulo {
          font-size: 13px;
          color: var(--texto-mudo);
          margin: 0;
        }

        .acerca-admin-datos {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: var(--radius-md);
          padding: 14px 16px;
          margin-bottom: 22px;
        }

        .acerca-dato-fila {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;
          padding: 3px 0;
          border-bottom: 1px dashed #e2e8f0;
        }

        .acerca-dato-fila:last-child {
          border-bottom: none;
        }

        .dato-clave {
          color: var(--texto-secundario);
          font-weight: 500;
        }

        .dato-valor {
          color: var(--texto-primario);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          text-align: right;
        }

        .dato-valor.destacado {
          color: var(--naranja-700);
          font-weight: 700;
        }

        .dato-valor small {
          color: var(--texto-mudo);
          font-weight: 400;
          font-size: 11px;
        }

        .punto-estado {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        .punto-estado.verde {
          background-color: #10b981;
        }

        .punto-estado.azul {
          background-color: #3b82f6;
        }

        .acerca-admin-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
        }

        .btn-copiar-diagnostico {
          background-color: var(--blanco);
          border: 1px solid var(--borde);
          color: var(--texto-secundario);
          padding: 7px 14px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-copiar-diagnostico:hover {
          background-color: #f1f5f9;
          color: var(--texto-primario);
          border-color: #cbd5e1;
        }

        .acerca-admin-copyright {
          font-size: 11px;
          line-height: 1.4;
          color: var(--texto-mudo);
        }
      `}</style>
    </div>
  );
};
