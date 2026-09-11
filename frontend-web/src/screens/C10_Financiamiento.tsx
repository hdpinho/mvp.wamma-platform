import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SimuladorCuota } from '../components/SimuladorCuota';

/**
 * C10 · Financiamiento — página informativa.
 *
 * Por decisión del Product Owner (septiembre 2026) la solicitud de crédito ya
 * no está abierta al público: se habilita después de la visita, con un enlace
 * personal que emite el asesor al pulsar «Vender Vehículo»
 * (`specs/010-crm-comercial/spec.md` §8.8). Esta página explica el camino y
 * deja simular la cuota antes de venir.
 *
 * También resuelve un enlace roto: el menú y el simulador de la portada
 * apuntaban a una ruta de financiamiento que no existía.
 */

const PASOS = [
  {
    numero: '1',
    titulo: 'Elige tu auto',
    detalle: 'Explora el catálogo de vehículos certificados y simula tu cuota con la inicial y el plazo que prefieras.',
  },
  {
    numero: '2',
    titulo: 'Agenda tu visita',
    detalle: 'Desde la ficha del vehículo agenda la cita y conócelo en persona en la sede.',
  },
  {
    numero: '3',
    titulo: 'Solicita tu crédito',
    detalle:
      'Si decides comprarlo financiado, tu asesor te envía un enlace personal para completar la solicitud desde tu teléfono.',
  },
];

export const C10_Financiamiento: React.FC<{ rateBCV: number }> = ({ rateBCV }) => {
  const navigate = useNavigate();

  return (
    <div className="financiamiento-pagina">
      <header className="financiamiento-cabecera">
        <h1>Financiamiento WAMMA</h1>
        <p>
          Compra tu vehículo con una inicial desde el 20 % y cuotas fijas mensuales. Primero lo conoces en persona;
          después, si lo quieres financiado, completas la solicitud con un enlace personal.
        </p>
      </header>

      <div className="financiamiento-rejilla">
        <section aria-label="Cómo funciona">
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

        <SimuladorCuota
          precioEditable
          rateBCV={rateBCV}
          textoBoton="Ver vehículos del catálogo"
          onSolicitar={() => navigate('/catalogo')}
        />
      </div>

      <style>{`
        .financiamiento-pagina { max-width: 1100px; margin: 0 auto; }
        .financiamiento-cabecera { margin-bottom: var(--space-xl); }
        .financiamiento-cabecera h1 { font-size: 26px; margin: 0 0 6px; }
        .financiamiento-cabecera p {
          font-size: 15px; color: var(--texto-secundario); max-width: 640px; line-height: 1.5; margin: 0;
        }
        .financiamiento-rejilla {
          display: grid; grid-template-columns: 1fr minmax(320px, 400px); gap: var(--space-xl); align-items: start;
        }
        @media (max-width: 900px) { .financiamiento-rejilla { grid-template-columns: 1fr; } }
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
        .financiamiento-pasos p { margin: 4px 0 0; font-size: 14px; color: var(--texto-secundario); line-height: 1.45; }
      `}</style>
    </div>
  );
};
