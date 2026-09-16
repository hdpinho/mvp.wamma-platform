import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimuladorCuota } from '../components/SimuladorCuota';
import { CalculadoraCapacidad } from '../components/CalculadoraCapacidad';

/**
 * C10 · Financiamiento — Centro de cálculo y asesoría financiera WAMMA.
 *
 * Expone las dos herramientas clave basadas en el motor matemático unificado:
 * 1. Calculadora de cuota máxima según ingresos (30% capacidad).
 * 2. Simulador de cuotas fijas (20%, 30%, 40% inicial a 24 meses).
 */

const PASOS = [
  {
    numero: '1',
    titulo: 'Calcula tu capacidad',
    detalle: 'Ingresa tus ingresos mensuales para saber qué cuota máxima puedes asumir y qué autos califican.',
  },
  {
    numero: '2',
    titulo: 'Elige tu auto y agenda tu visita',
    detalle: 'Desde el catálogo o ficha agenda la cita para conocer y probar el vehículo en nuestra sede.',
  },
  {
    numero: '3',
    titulo: 'Completa tu solicitud',
    detalle: 'Tras la visita, tu asesor de crédito te enviará un enlace personal para formalizar el financiamiento.',
  },
];

export const C10_Financiamiento: React.FC<{ rateBCV: number }> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const [herramientaActiva, setHerramientaActiva] = useState<'capacidad' | 'cuota'>('capacidad');

  return (
    <div className="financiamiento-pagina">
      <header className="financiamiento-cabecera">
        <h1>Financiamiento WAMMA</h1>
        <p>
          Calcula tu plan de financiamiento con cuotas fijas a 24 meses, inicial desde el 20 % y tasa del 4 % mensual.
          Sistema transparente bajo amortización francesa con respaldo oficial en Bolívares a tasa BCV.
        </p>

        {/* Pestañas de herramientas */}
        <div className="pestanas-financiamiento">
          <button
            type="button"
            className={`pestana-btn ${herramientaActiva === 'capacidad' ? 'activa' : ''}`}
            onClick={() => setHerramientaActiva('capacidad')}
          >
            📊 Cuota Máxima según Ingresos
          </button>
          <button
            type="button"
            className={`pestana-btn ${herramientaActiva === 'cuota' ? 'activa' : ''}`}
            onClick={() => setHerramientaActiva('cuota')}
          >
            🚗 Simulador de Cuota por Vehículo
          </button>
        </div>
      </header>

      <div className="financiamiento-rejilla">
        <section aria-label="Herramienta seleccionada">
          {herramientaActiva === 'capacidad' ? (
            <CalculadoraCapacidad rateBCV={rateBCV} />
          ) : (
            <SimuladorCuota
              precioEditable
              rateBCV={rateBCV}
              textoBoton="Ver vehículos del catálogo"
              onSolicitar={() => navigate('/catalogo')}
            />
          )}
        </section>

        <section aria-label="Cómo funciona" className="panel-pasos-financiamiento">
          <h2>Cómo funciona</h2>
          <ol className="financiamiento-pasos">
            {PASOS.map((p) => (
              <li key={p.numero}>
                <span className="paso-numero" aria-hidden="true">
                  {p.numero}
                </span>
                <div>
                  <strong>{p.titulo}</strong>
                  <p>{p.detalle}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="caja-politica-info">
            <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--carbon)' }}>
              Política Comercial Aprobada
            </h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: 1.5 }}>
              <li><strong>Plazo:</strong> Fijo en 24 meses.</li>
              <li><strong>Tasa:</strong> 4.0% mensual fija (48% anual).</li>
              <li><strong>Iniciales:</strong> 20%, 30% o 40% del valor del vehículo.</li>
              <li><strong>Capacidad:</strong> Máximo 30% de tus ingresos comprobables.</li>
            </ul>
          </div>
        </section>
      </div>

      <style>{`
        .financiamiento-pagina { max-width: 1160px; margin: 0 auto; }
        .financiamiento-cabecera { margin-bottom: var(--space-xl); }
        .financiamiento-cabecera h1 { font-size: 26px; margin: 0 0 6px; }
        .financiamiento-cabecera p {
          font-size: 15px; color: var(--texto-secundario); max-width: 680px; line-height: 1.5; margin: 0 0 var(--space-lg);
        }
        .pestanas-financiamiento {
          display: flex;
          gap: 10px;
          border-bottom: 2px solid var(--borde-claro);
          padding-bottom: 2px;
        }
        .pestana-btn {
          padding: 10px 18px;
          border: none;
          background: none;
          font-family: var(--font-sans);
          font-size: 14px;
          font-weight: 600;
          color: var(--texto-secundario);
          cursor: pointer;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s ease;
        }
        .pestana-btn:hover {
          color: var(--naranja-600);
        }
        .pestana-btn.activa {
          color: var(--naranja-600);
          border-bottom-color: var(--naranja-500);
        }
        .financiamiento-rejilla {
          display: grid; grid-template-columns: 1fr minmax(320px, 380px); gap: var(--space-xl); align-items: start;
        }
        @media (max-width: 960px) { .financiamiento-rejilla { grid-template-columns: 1fr; } }
        .financiamiento-rejilla h2 { font-size: 18px; margin: 0 0 var(--space-md); }
        .financiamiento-pasos { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-md); }
        .financiamiento-pasos li {
          display: flex; gap: 14px; background-color: var(--blanco); border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg); padding: 16px;
        }
        .paso-numero {
          flex: 0 0 32px; height: 32px; border-radius: 50%; background-color: var(--naranja-500);
          color: var(--blanco); font-weight: 700; display: flex; align-items: center; justify-content: center;
        }
        .financiamiento-pasos p { margin: 4px 0 0; font-size: 13px; color: var(--texto-secundario); line-height: 1.45; }
        .caja-politica-info {
          margin-top: var(--space-lg);
          padding: 16px;
          background-color: var(--superficie);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
};
