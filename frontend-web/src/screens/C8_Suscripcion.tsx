import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockVehiculos } from '../mocks/vehiculos';
import { FotoVehiculo } from '../components/FotoVehiculo';
import { Seccion } from '../components/Seccion';
import { Boton } from '../components/Boton';
import { NotaSimulada } from '../components/NotaSimulada';
import { PatronOndas } from '../components/PatronOndas';

/**
 * C8 · Suscripción / rent-to-own (OCN) — Fase 2 (módulo 10).
 *
 * Diferenciador propio de WAMMA: no existe en el modelo de Kavak. Se adelanta a
 * la maqueta por decisión del Product Owner; las condiciones comerciales todavía
 * no están definidas.
 */

interface C8SuscripcionProps {
  rateBCV: number;
}

const formatoUSD = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

const COMPARATIVA: { concepto: string; compra: string; suscripcion: string }[] = [
  { concepto: 'Desembolso inicial', compra: 'Inicial sobre el precio', suscripcion: 'Sin inicial' },
  { concepto: 'Propiedad del vehículo', compra: 'Tuya desde el primer día', suscripcion: 'De WAMMA hasta ejercer la opción' },
  { concepto: 'Cuota mensual', compra: 'Capital + intereses', suscripcion: 'Cuota de uso' },
  { concepto: 'Al final del período', compra: 'El vehículo queda saldado', suscripcion: 'Compras, renuevas o devuelves' },
];

export const C8_Suscripcion: React.FC<C8SuscripcionProps> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const disponibles = mockVehiculos
    .filter((v) => v.suscripcionMensualUSD && v.certificado)
    .sort((a, b) => (a.suscripcionMensualUSD ?? 0) - (b.suscripcionMensualUSD ?? 0));

  return (
    <div>
      {/* Hero */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'var(--negro)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xxxl) var(--space-xl)',
          marginBottom: 'var(--space-xxl)',
          color: 'var(--blanco)',
        }}
      >
        <PatronOndas color="#D17438" opacidad={0.28} />
        <div style={{ position: 'relative', maxWidth: '600px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              backgroundColor: 'var(--naranja-500)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              marginBottom: 'var(--space-md)',
            }}
          >
            Suscripción OCN
          </span>
          <h1
            style={{
              color: 'var(--blanco)',
              fontSize: 'clamp(26px, 4vw, 38px)',
              lineHeight: 1.15,
              marginBottom: 'var(--space-md)',
            }}
          >
            Usa el carro hoy. Decide si lo compras después.
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.85, maxWidth: '52ch' }}>
            Una cuota mensual por el uso del vehículo, con opción de compra al final del período. Sin
            inicial y sin comprometerte de entrada.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-xxl)' }}>
        <NotaSimulada variante="bloque">
          Módulo 10 · Fase 2. Los montos, plazos y condiciones de la suscripción todavía no están
          definidos por WAMMA. Todo lo que ves en esta pantalla es una maqueta visual con datos
          simulados.
        </NotaSimulada>
      </div>

      {/* Comparativa */}
      <Seccion
        titulo="Comprar o suscribirse"
        bajada="Dos formas de llevarte el mismo vehículo certificado."
      >
        <div className="table-container">
          <table className="wamma-table">
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col">Compra financiada</th>
                <th scope="col">Suscripción OCN</th>
              </tr>
            </thead>
            <tbody>
              {COMPARATIVA.map((fila) => (
                <tr key={fila.concepto}>
                  <td style={{ fontWeight: 700 }}>{fila.concepto}</td>
                  <td style={{ color: 'var(--texto-secundario)' }}>{fila.compra}</td>
                  <td style={{ color: 'var(--naranja-700)', fontWeight: 700 }}>{fila.suscripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      {/* Vehículos disponibles */}
      <Seccion
        titulo="Disponibles bajo suscripción"
        bajada="Unidades certificadas con inspección de 240 puntos."
        enlace={{ texto: 'Ver toda la vitrina', a: '/catalogo' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {disponibles.map((v) => (
            <article
              key={v.id}
              style={{
                backgroundColor: 'var(--blanco)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <FotoVehiculo vehiculo={v} alto={150} />
              <div
                style={{
                  padding: 'var(--space-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-xs)',
                  flex: 1,
                }}
              >
                <h3 style={{ fontSize: '16px' }}>
                  {v.marca} {v.modelo}{' '}
                  <span style={{ color: 'var(--texto-mudo)', fontWeight: 400 }}>{v.anio}</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
                  {v.version} · {v.carroceria}
                </p>

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--texto-mudo)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Suscripción mensual
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1.2 }}>
                    {formatoUSD(v.suscripcionMensualUSD ?? 0)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                    Ref.{' '}
                    {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(
                      (v.suscripcionMensualUSD ?? 0) * rateBCV,
                    )}{' '}
                    Bs. · tasa BCV {rateBCV.toFixed(2)}
                  </div>

                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <Boton
                      variant="secondary"
                      fullWidth
                      onClick={() => navigate(`/vehiculo/${v.id}`)}
                      style={{ padding: '10px', fontSize: '13px' }}
                    >
                      Ver ficha
                    </Boton>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Seccion>
    </div>
  );
};
