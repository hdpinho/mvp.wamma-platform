import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockVehiculos } from '../mocks/vehiculos';
import { FotoVehiculo } from '../components/FotoVehiculo';
import { BotonFavorito } from '../components/BotonFavorito';
import { SelloCertificado } from '../components/SelloCertificado';
import { SimuladorCuota } from '../components/SimuladorCuota';
import { Boton } from '../components/Boton';
import { Estado } from '../components/Estado';
import { TarjetaVehiculo } from '../components/TarjetaVehiculo';
import { Seccion } from '../components/Seccion';
import { Imperfecciones } from '../components/Imperfecciones';
import { useVehiculos } from '../state/vehiculosContexto';
import { ModalAgendarCita } from '../components/ModalAgendarCita';
import { creditosFotos } from '../mocks/creditosFotos';

interface C2FichaVehiculoProps {
  rateBCV: number;
}


/** Bloques de la inspección de 240 puntos (módulo 004). */
const AREAS_INSPECCION = [
  { area: 'Motor y transmisión', puntos: 62 },
  { area: 'Carrocería y pintura', puntos: 48 },
  { area: 'Suspensión y frenos', puntos: 40 },
  { area: 'Sistema eléctrico', puntos: 35 },
  { area: 'Interior y confort', puntos: 30 },
  { area: 'Documentación legal', puntos: 25 },
];

const formatoUSD = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

export const C2_FichaVehiculo: React.FC<C2FichaVehiculoProps> = ({ rateBCV }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vehiculos, obtenerImperfecciones } = useVehiculos();

  const [modalCitaAbierto, setModalCitaAbierto] = React.useState(false);
  const [interesFinanciamiento, setInteresFinanciamiento] = React.useState(false);

  const vehiculo = vehiculos.find((v) => v.id === id);

  if (!vehiculo) {
    return (
      <Estado
        type="error"
        message="El vehículo que buscas no existe o ya fue vendido."
        onRetry={() => navigate('/catalogo')}
      />
    );
  }

  const imperfecciones = obtenerImperfecciones(vehiculo.id);
  const credito = creditosFotos[vehiculo.id];

  /**
   * Abre el modal para agendar cita para este vehículo.
   */
  const abrirAgendarCita = (financiamiento = false) => {
    setInteresFinanciamiento(financiamiento);
    setModalCitaAbierto(true);
  };

  const similares = mockVehiculos
    .filter((v) => v.id !== vehiculo.id && v.carroceria === vehiculo.carroceria)
    .slice(0, 4);

  const ESPECIFICACIONES: [string, string][] = [
    ['Año', String(vehiculo.anio)],
    ['Kilometraje', `${vehiculo.kilometraje.toLocaleString('es-VE')} km`],
    ['Transmisión', vehiculo.transmision],
    ['Combustible', vehiculo.combustible],
    ['Carrocería', vehiculo.carroceria],
    ['Tracción', vehiculo.traccion],
    ['Puestos', String(vehiculo.puestos)],
    ['Sede', vehiculo.sede],
    ['VIN', vehiculo.vin],
  ];

  return (
    <div>
      {/* Migas */}
      <button
        type="button"
        onClick={() => navigate('/catalogo')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: 'var(--texto-secundario)',
          padding: 0,
          marginBottom: 'var(--space-lg)',
        }}
      >
        ← Volver al catálogo
      </button>

      <div className="ficha-cuerpo">
        {/* ── Columna izquierda ──────────────────────────────── */}
        <div>
          <div style={{ position: 'relative', marginBottom: 'var(--space-sm)' }}>
            <FotoVehiculo vehiculo={vehiculo} alto={420} redondeo="var(--radius-lg)" />
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <BotonFavorito vehiculoId={vehiculo.id} tamano={22} />
            </div>
            {vehiculo.etiqueta && (
              <span
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '18px',
                  backgroundColor: 'var(--naranja-500)',
                  color: 'var(--blanco)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                {vehiculo.etiqueta}
              </span>
            )}
          </div>

          {/* Atribución de la fotografía (exigida por las licencias CC BY-SA) */}
          {credito && (
            <p
              style={{
                fontSize: '11px',
                color: 'var(--texto-mudo)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              Foto referencial del modelo, no de esta unidad. {credito.autor} ·{' '}
              {credito.licencia} ·{' '}
              <a
                href={credito.pagina}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--texto-secundario)' }}
              >
                Wikimedia Commons
              </a>
            </p>
          )}

          {/* Especificaciones */}
          <div
            style={{
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-xl)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-lg)' }}>Especificaciones</h2>
            <dl
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 'var(--space-lg)',
                margin: 0,
              }}
            >
              {ESPECIFICACIONES.map(([clave, valor]) => (
                <div key={clave}>
                  <dt style={{ fontSize: '11px', color: 'var(--texto-mudo)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {clave}
                  </dt>
                  <dd style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>{valor}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Inspección 240 puntos */}
          <div
            style={{
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-xl)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                flexWrap: 'wrap',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <h2 style={{ fontSize: '18px' }}>Inspección de 240 puntos</h2>
              {vehiculo.certificado && <SelloCertificado />}
            </div>

            {vehiculo.certificado ? (
              <>
                <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                  {AREAS_INSPECCION.map(({ area, puntos }) => (
                    <div
                      key={area}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-md)',
                        paddingBottom: 'var(--space-md)',
                        borderBottom: '1px solid var(--borde-claro)',
                        fontSize: '14px',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--exito-texto)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {area}
                      </span>
                      <span style={{ color: 'var(--texto-mudo)', fontSize: '13px' }}>
                        {puntos} puntos
                      </span>
                    </div>
                  ))}
                </div>
                <p
                  style={{
                    marginTop: 'var(--space-lg)',
                    fontSize: '13px',
                    color: 'var(--texto-secundario)',
                  }}
                >
                  Documentación verificada contra registro de robo y deudas pendientes.
                </p>
              </>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
                Este vehículo aún no ha completado la certificación de 240 puntos. Se publica sin
                sello de certificación.
              </p>
            )}
          </div>

          {/* Hallazgos cosméticos declarados por la inspección (módulo 004) */}
          <Imperfecciones vehiculo={vehiculo} listaImperfecciones={imperfecciones} />
        </div>

        {/* ── Columna derecha: precio y acción ───────────────── */}
        <aside className="ficha-lateral">
          <div
            style={{
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-xl)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            <h1 style={{ fontSize: '22px', lineHeight: 1.25 }}>
              {vehiculo.marca} {vehiculo.modelo}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
              {vehiculo.version} · {vehiculo.anio}
            </p>

            <div style={{ margin: 'var(--space-lg) 0' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, lineHeight: 1.15 }}>
                {formatoUSD(vehiculo.precioUSD)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
                Ref.{' '}
                {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(
                  vehiculo.precioUSD * rateBCV,
                )}{' '}
                Bs. · tasa BCV {rateBCV.toFixed(2)}
              </div>
            </div>

            {vehiculo.estadoDisponibilidad === 'cita_agendada' ? (
              <div
                style={{
                  backgroundColor: 'var(--naranja-50)',
                  border: '1px solid var(--naranja-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-md)',
                }}
              >
                <div
                  style={{
                    color: 'var(--naranja-700)',
                    fontWeight: 700,
                    fontSize: '14px',
                    marginBottom: '4px',
                  }}
                >
                  ⏱️ Cita en Curso / Reservado
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--texto-secundario)',
                    lineHeight: 1.4,
                    marginBottom: 'var(--space-sm)',
                  }}
                >
                  Este vehículo ya tiene una cita agendada. El agendamiento está desactivado para otros usuarios.
                </div>
                <Boton variant="secondary" fullWidth disabled>
                  Vehículo Reservado Temporalmente
                </Boton>
              </div>
            ) : vehiculo.estadoDisponibilidad === 'vendido' ? (
              <div
                style={{
                  backgroundColor: 'var(--superficie)',
                  border: '1px solid var(--borde)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  color: 'var(--texto-mudo)',
                  fontWeight: 700,
                  marginBottom: 'var(--space-md)',
                }}
              >
                Vehículo Vendido
              </div>
            ) : (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Boton
                  variant="primary"
                  fullWidth
                  onClick={() => abrirAgendarCita(false)}
                >
                  Agendar cita
                </Boton>
              </div>
            )}
          </div>

          {/*
            Con una cita en curso, «Solicitar financiamiento» también se desactiva:
            antes reabría el formulario de agendar y el mismo auto se podía
            reservar dos veces. Quien agendó recibe luego un enlace personal
            (specs/010-crm-comercial/spec.md §8.8).
          */}
          <SimuladorCuota
            precioUSD={vehiculo.precioUSD}
            rateBCV={rateBCV}
            onSolicitar={() => abrirAgendarCita(true)}
            botonDeshabilitado={
              vehiculo.estadoDisponibilidad === 'cita_agendada' || vehiculo.estadoDisponibilidad === 'vendido'
            }
            motivoDeshabilitado={
              vehiculo.estadoDisponibilidad === 'vendido'
                ? 'Este vehículo ya fue vendido.'
                : 'Este vehículo tiene una cita en curso. Quien lo agendó recibirá de su asesor un enlace personal para solicitar el crédito.'
            }
          />
        </aside>
      </div>

      {/* Similares */}
      {similares.length > 0 && (
        <div style={{ marginTop: 'var(--space-xxxl)' }}>
          <Seccion
            titulo="Otros vehículos parecidos"
            bajada={`Más opciones de carrocería ${vehiculo.carroceria.toLowerCase()}.`}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-lg)',
              }}
            >
              {similares.map((v) => (
                <TarjetaVehiculo
                  key={v.id}
                  vehiculo={v}
                  rateBCV={rateBCV}
                  onSelect={(vid) => navigate(`/vehiculo/${vid}`)}
                />
              ))}
            </div>
          </Seccion>
        </div>
      )}

      <style>{`
        .ficha-cuerpo {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: var(--space-xl);
          align-items: start;
        }
        .ficha-lateral { position: sticky; top: 104px; }
        @media (min-width: 1025px) and (max-width: 1279px) {
          .ficha-lateral { top: 92px; }
        }

        @media (max-width: 900px) {
          .ficha-cuerpo { grid-template-columns: 1fr; }
          .ficha-lateral { position: static; }
        }
      `}</style>

      {modalCitaAbierto && (
        <ModalAgendarCita
          vehiculo={vehiculo}
          rateBCV={rateBCV}
          interesFinanciamientoInicial={interesFinanciamiento}
          onCerrar={() => setModalCitaAbierto(false)}
        />
      )}
    </div>
  );
};
