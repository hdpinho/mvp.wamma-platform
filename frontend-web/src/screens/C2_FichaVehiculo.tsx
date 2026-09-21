import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FotoVehiculo } from '../components/FotoVehiculo';
import { BotonFavorito } from '../components/BotonFavorito';
import { SelloCertificado } from '../components/SelloCertificado';
import { SimuladorCuota } from '../components/SimuladorCuota';
import { Estado } from '../components/Estado';
import { TarjetaVehiculo } from '../components/TarjetaVehiculo';
import { Seccion } from '../components/Seccion';
import { Imperfecciones } from '../components/Imperfecciones';
import { useVehiculos } from '../state/vehiculosContexto';
import { ModalAgendarCita } from '../components/ModalAgendarCita';

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

export const C2_FichaVehiculo: React.FC<C2FichaVehiculoProps> = ({ rateBCV }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vehiculos, obtenerImperfecciones } = useVehiculos();

  const [modalCitaAbierto, setModalCitaAbierto] = React.useState(false);
  const [interesFinanciamiento, setInteresFinanciamiento] = React.useState(false);
  const [fotoActiva, setFotoActiva] = React.useState(0);

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
  const fotos = vehiculo.fotos ?? [];
  const foto = fotos[Math.min(fotoActiva, Math.max(fotos.length - 1, 0))];
  const credito = foto?.credito;


  /**
   * Abre el modal para agendar cita para este vehículo.
   */
  const abrirAgendarCita = (financiamiento = false) => {
    setInteresFinanciamiento(financiamiento);
    setModalCitaAbierto(true);
  };

  const similares = vehiculos
    .filter((v) => {
      if (v.id === vehiculo.id) return false;
      if (v.carroceria !== vehiculo.carroceria) return false;
      // También filtrar por rango de precio ±30% para mayor relevancia
      const min = vehiculo.precio * 0.7;
      const max = vehiculo.precio * 1.3;
      return v.precio >= min && v.precio <= max;
    })
    .slice(0, 4);

  // Si no hay similares en rango de precio, caer en solo carrocería
  const similaresFinales = similares.length > 0
    ? similares
    : vehiculos
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
    ['VIN', vehiculo.vin],
  ];

  return (
    <div>
      {/* Migas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--naranja-600)',
            fontWeight: 600,
            padding: 0,
          }}
        >
          🏠 Ir a inicio
        </button>
        <span style={{ color: 'var(--texto-mudo)', fontSize: '13px' }}>·</span>
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
          }}
        >
          ← Volver a la vitrina
        </button>
      </div>

      <div className="ficha-cuerpo">
        {/* ── Columna izquierda ──────────────────────────────── */}
        <div>
          <div style={{ position: 'relative', marginBottom: 'var(--space-sm)' }}>
            {foto ? (
              <img
                src={foto.url}
                alt={`${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`}
                width={foto.ancho}
                height={foto.alto}
                style={{
                  width: '100%',
                  height: '420px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-lg)',
                  display: 'block',
                  backgroundColor: '#EFEDEA',
                }}
              />
            ) : (
              <FotoVehiculo vehiculo={vehiculo} alto={420} redondeo="var(--radius-lg)" />
            )}
            <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
              <BotonFavorito vehiculoId={vehiculo.id} tamano={22} />
            </div>
            {vehiculo.estadoDisponibilidad === 'cita_agendada' || vehiculo.etiqueta === 'Reservado para cita' ? (
              <span
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '18px',
                  backgroundColor: '#D17438',
                  color: 'var(--blanco)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: '0 2px 8px rgba(209, 116, 56, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>⏱️</span> Reservado para cita
              </span>
            ) : vehiculo.etiqueta === 'Súper oportunidad' ? (
              <span
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '18px',
                  background: 'linear-gradient(135deg, #FF6F00 0%, #FFA000 100%)',
                  color: 'var(--blanco)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: '0 2px 8px rgba(255, 111, 0, 0.4)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>⭐</span> Súper oportunidad
              </span>
            ) : vehiculo.etiqueta === 'Recién ingresado' ? (
              <span
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '18px',
                  backgroundColor: '#1E7E34',
                  color: 'var(--blanco)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-pill)',
                  boxShadow: '0 2px 6px rgba(30, 126, 52, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>✨</span> Recién ingresado
              </span>
            ) : vehiculo.etiqueta ? (
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
            ) : null}
          </div>

          {/* Galería: la primera foto es la principal */}
          {fotos.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-sm)',
                overflowX: 'auto',
                paddingBottom: '4px',
                marginBottom: 'var(--space-sm)',
              }}
            >
              {fotos.map((f, indice) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFotoActiva(indice)}
                  aria-label={`Ver la foto ${indice + 1} de ${fotos.length}`}
                  aria-current={f.id === foto?.id}
                  style={{
                    flex: '0 0 auto',
                    padding: 0,
                    border: `2px solid ${f.id === foto?.id ? 'var(--naranja-500)' : 'transparent'}`,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'none',
                    lineHeight: 0,
                  }}
                >
                  <img
                    src={f.urlMiniatura}
                    alt=""
                    loading="lazy"
                    style={{ width: '92px', height: '69px', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Atribución de la fotografía (exigida por las licencias CC BY-SA) */}
          {credito && (
            <p
              style={{
                fontSize: '11px',
                color: 'var(--texto-mudo)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              Foto referencial del modelo, no de esta unidad. {credito.autor} · {credito.licencia}
              {credito.origen && (
                <>
                  {' · '}
                  <a
                    href={credito.origen}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--texto-secundario)' }}
                  >
                    Origen
                  </a>
                </>
              )}
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
              <SelloCertificado />
            </div>

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
          </div>

          {/* Hallazgos cosméticos declarados por la inspección (módulo 004) */}
          <Imperfecciones vehiculo={vehiculo} listaImperfecciones={imperfecciones} />
        </div>

        {/* ── Columna derecha: disponibilidad y simulador de cuotas ── */}
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
            <h1 style={{ fontSize: '22px', lineHeight: 1.25, margin: 0 }}>
              {vehiculo.marca} {vehiculo.modelo}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
              {vehiculo.version} · {vehiculo.anio}
            </p>

            {vehiculo.estadoDisponibilidad === 'cita_agendada' && (
              <div
                style={{
                  backgroundColor: 'var(--naranja-50)',
                  border: '1px solid var(--naranja-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  marginTop: 'var(--space-md)',
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
                  ⏱️ Reservado para cita
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--texto-secundario)',
                    lineHeight: 1.4,
                  }}
                >
                  Este vehículo ya tiene una cita agendada y se encuentra reservado. El agendamiento está desactivado para otros usuarios.
                </div>
              </div>
            )}
            {vehiculo.estadoDisponibilidad === 'vendido' && (
              <div
                style={{
                  backgroundColor: 'var(--superficie)',
                  border: '1px solid var(--borde)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  color: 'var(--texto-mudo)',
                  fontWeight: 700,
                  marginTop: 'var(--space-md)',
                }}
              >
                Vehículo Vendido
              </div>
            )}
          </div>

          <SimuladorCuota
            precio={vehiculo.precio}
            rateBCV={rateBCV}
            textoBoton="Agendar cita"
            onAgendar={() => abrirAgendarCita(true)}
            onSolicitar={() => abrirAgendarCita(true)}
            botonDeshabilitado={
              vehiculo.estadoDisponibilidad === 'cita_agendada' || vehiculo.estadoDisponibilidad === 'vendido'
            }
            motivoDeshabilitado={
              vehiculo.estadoDisponibilidad === 'vendido'
                ? 'Este vehículo ya fue vendido.'
                : 'Este vehículo está reservado para cita. Quien lo agendó recibirá de su asesor un enlace personal para solicitar el crédito.'
            }
          />
        </aside>
      </div>

      {/* Similares */}
      {similaresFinales.length > 0 && (
        <div style={{ marginTop: 'var(--space-xxxl)' }}>
          <Seccion
            titulo="Otros vehículos parecidos"
            bajada="Más opciones recomendadas para ti."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: 'var(--space-lg)',
              }}
            >
              {similaresFinales.map((v) => (
                <TarjetaVehiculo
                  key={v.id}
                  vehiculo={v}
                  rateBCV={rateBCV}
                  onSelect={(vid) => { navigate(`/vehiculo/${vid}`); window.scrollTo(0, 0); }}
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
