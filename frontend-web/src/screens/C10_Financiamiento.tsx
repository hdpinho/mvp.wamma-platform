import React from 'react';
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
    detalle: 'Ingresa tus ingresos mensuales para saber qué cuota máxima puedes asumir y qué vehículos califican.',
  },
  {
    numero: '2',
    titulo: 'Elige tu vehículo y agenda tu cita',
    detalle: 'Desde la vitrina agenda tu cita para conocer tu próximo vehículo.',
  },
  {
    numero: '3',
    titulo: 'Completa tu solicitud',
    detalle: 'Tras la cita, el asesor te orientará sobre la formalización de tu financiamiento.',
  },
];

export const C10_Financiamiento: React.FC<{ rateBCV: number }> = ({ rateBCV }) => {
  return (
    <div className="financiamiento-pagina">
      <header className="financiamiento-cabecera">
        <h1>Financiamiento WAMMA</h1>
      </header>

      <div className="financiamiento-rejilla">
        <section aria-label="Herramienta de capacidad">
          <CalculadoraCapacidad rateBCV={rateBCV} />
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
        </section>
      </div>

      <style>{`
        .financiamiento-pagina { max-width: 1160px; margin: 0 auto; }
        .financiamiento-cabecera { margin-bottom: var(--space-xl); }
        .financiamiento-cabecera h1 { font-size: 26px; margin: 0 0 6px; }
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
      `}</style>
    </div>
  );
};
