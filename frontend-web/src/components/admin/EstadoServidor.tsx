import React, { useEffect, useState } from 'react';
import { apiConfigurada, consultarSalud } from '../../api/cliente';

type Estado = 'verificando' | 'despertando' | 'en_linea' | 'sin_conexion' | 'sin_configurar';

const TEXTOS: Record<Estado, string> = {
  verificando: 'Conectando con el servidor…',
  despertando: 'Despertando el servidor; puede tardar un minuto…',
  en_linea: 'Servidor en línea',
  sin_conexion: 'Sin conexión con el servidor',
  sin_configurar: 'Sin servidor (modo maqueta)',
};

const COLORES: Record<Estado, string> = {
  verificando: '#9E9E9E',
  despertando: 'var(--naranja-500)',
  en_linea: '#2E7D32',
  sin_conexion: '#D32F2F',
  sin_configurar: '#9E9E9E',
};

/** Pasados estos milisegundos sin respuesta, se avisa de que el servidor está despertando. */
const AVISO_DESPERTAR_MS = 3000;

/**
 * Indicador del estado del backend en el backoffice.
 *
 * En el plan gratuito de Render el servidor se apaga tras 15 minutos sin tráfico y
 * tarda cerca de un minuto en volver. Sin este aviso, esa espera parece un fallo.
 */
export const EstadoServidor: React.FC = () => {
  const [estado, setEstado] = useState<Estado>(apiConfigurada ? 'verificando' : 'sin_configurar');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!apiConfigurada) return;
    let vigente = true;
    const aviso = setTimeout(() => {
      if (vigente) setEstado('despertando');
    }, AVISO_DESPERTAR_MS);
    consultarSalud()
      .then(() => {
        if (vigente) setEstado('en_linea');
      })
      .catch(() => {
        if (vigente) setEstado('sin_conexion');
      })
      .finally(() => clearTimeout(aviso));
    return () => {
      vigente = false;
      clearTimeout(aviso);
    };
  }, [intento]);

  const reintentar = () => {
    setEstado('verificando');
    setIntento((n) => n + 1);
  };

  return (
    <div className="estado-servidor" role="status" aria-live="polite">
      <span className="estado-servidor-punto" style={{ backgroundColor: COLORES[estado] }} />
      <span>{TEXTOS[estado]}</span>
      {estado === 'sin_conexion' && (
        <button type="button" className="estado-servidor-reintentar" onClick={reintentar}>
          Reintentar
        </button>
      )}
      <style>{`
        .estado-servidor {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 11px;
          color: rgba(255,255,255,0.75);
          margin-bottom: 12px;
        }
        .estado-servidor-punto {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .estado-servidor-reintentar {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.3);
          color: var(--blanco);
          font-size: 11px;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
