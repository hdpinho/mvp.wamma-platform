import React, { useMemo, useState } from 'react';
import { DiagramaVehiculo } from './DiagramaVehiculo';
import { NotaSimulada } from './NotaSimulada';
import { imperfeccionesDe } from '../mocks/imperfecciones';
import { useVehiculos } from '../state/vehiculosContexto';
import type { VehiculoData, Imperfeccion } from '../types/vehiculo';

/**
 * Sección "Imperfecciones" de la ficha del vehículo.
 *
 * Declara los hallazgos cosméticos de la inspección de 240 puntos (módulo 004)
 * sobre un diagrama del vehículo. Es la pieza que convierte la certificación en
 * algo verificable: en vez de afirmar que el auto está bien, se muestra
 * exactamente qué desgaste tiene y dónde.
 */

interface ImperfeccionesProps {
  vehiculo: VehiculoData;
  listaImperfecciones?: Imperfeccion[];
}

type Zona = 'exterior' | 'interior';

const COLOR_SEVERIDAD = {
  leve: { fondo: 'var(--aviso-fondo)', texto: 'var(--aviso-texto)' },
  moderada: { fondo: 'var(--peligro-fondo)', texto: 'var(--peligro-texto)' },
} as const;

export const Imperfecciones: React.FC<ImperfeccionesProps> = ({ vehiculo, listaImperfecciones }) => {
  let contextImperfecciones: Imperfeccion[] = [];
  try {
    const { obtenerImperfecciones } = useVehiculos();
    contextImperfecciones = obtenerImperfecciones(vehiculo.id);
  } catch {
    contextImperfecciones = imperfeccionesDe(vehiculo.id);
  }

  const todas = useMemo(
    () => listaImperfecciones ?? (contextImperfecciones.length > 0 ? contextImperfecciones : imperfeccionesDe(vehiculo.id)),
    [listaImperfecciones, contextImperfecciones, vehiculo.id],
  );
  const [zona, setZona] = useState<Zona>('exterior');
  const [indice, setIndice] = useState(0);

  const deZona = useMemo(() => todas.filter((i) => i.zona === zona), [todas, zona]);
  const actual = deZona[Math.min(indice, deZona.length - 1)];

  const cambiarZona = (nueva: Zona) => {
    setZona(nueva);
    setIndice(0);
  };

  const mover = (paso: number) => {
    if (deZona.length === 0) return;
    setIndice((i) => (i + paso + deZona.length) % deZona.length);
  };

  const conteo = {
    exterior: todas.filter((i) => i.zona === 'exterior').length,
    interior: todas.filter((i) => i.zona === 'interior').length,
  };

  return (
    <section
      style={{
        backgroundColor: 'var(--blanco)',
        border: '1px solid var(--borde-claro)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-xl)',
        marginTop: 'var(--space-lg)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontSize: '18px' }}>Imperfecciones</h2>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--texto-secundario)',
            marginTop: 'var(--space-xs)',
            maxWidth: '62ch',
          }}
        >
          {todas.length === 0
            ? 'La inspección no registró hallazgos cosméticos en este vehículo.'
            : `La inspección de 240 puntos declaró ${todas.length} ${
                todas.length === 1 ? 'hallazgo' : 'hallazgos'
              }. Los mostramos todos: preferimos que los veas aquí y no al llegar a la sede.`}
        </p>
      </header>

      {todas.length > 0 && (
        <>
          {/* Selector de zona */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-lg)',
              flexWrap: 'wrap',
            }}
          >
            {(['exterior', 'interior'] as Zona[]).map((z) => {
              const activa = zona === z;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => cambiarZona(z)}
                  aria-pressed={activa}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-pill)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    border: `1px solid ${activa ? 'var(--negro)' : 'var(--borde)'}`,
                    backgroundColor: activa ? 'var(--negro)' : 'var(--blanco)',
                    color: activa ? 'var(--blanco)' : 'var(--texto-secundario)',
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: `2px solid ${activa ? 'var(--blanco)' : 'var(--borde)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {activa && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--blanco)',
                        }}
                      />
                    )}
                  </span>
                  {z} ({conteo[z]})
                </button>
              );
            })}
          </div>

          <div className="imperfecciones-cuerpo">
            {/* Diagrama con los marcadores */}
            <div
              style={{
                backgroundColor: 'var(--superficie)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
              }}
            >
              <DiagramaVehiculo
                zona={zona}
                imperfecciones={deZona}
                seleccionadaId={actual?.id}
                onSeleccionar={(id) => setIndice(deZona.findIndex((i) => i.id === id))}
              />
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--texto-mudo)',
                  textAlign: 'center',
                  marginTop: 'var(--space-sm)',
                }}
              >
                Toca un número para ver el detalle
              </p>
            </div>

            {/* Detalle del hallazgo seleccionado */}
            {actual ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    backgroundColor: '#1A1A18',
                    minHeight: '220px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {vehiculo.foto ? (
                    <div
                      aria-label={`Acercamiento simulado de: ${actual.tipo}`}
                      role="img"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${vehiculo.foto})`,
                        backgroundSize: '320%',
                        // El punto del diagrama fija el encuadre del acercamiento
                        backgroundPosition: `${actual.x}% ${actual.y}%`,
                        filter: 'grayscale(1) contrast(1.08)',
                      }}
                    />
                  ) : (
                    <span style={{ color: 'var(--texto-mudo)', fontSize: '13px' }}>
                      Sin evidencia fotográfica
                    </span>
                  )}

                  {/* Contador y navegación, como en una galería */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      color: 'var(--blanco)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '4px 9px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {deZona.indexOf(actual) + 1} / {deZona.length}
                  </span>

                  {deZona.length > 1 && (
                    <>
                      <BotonGaleria direccion="anterior" onClick={() => mover(-1)} />
                      <BotonGaleria direccion="siguiente" onClick={() => mover(1)} />
                    </>
                  )}
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      flexWrap: 'wrap',
                      marginBottom: 'var(--space-xs)',
                    }}
                  >
                    <strong style={{ fontSize: '15px' }}>{actual.tipo}</strong>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: COLOR_SEVERIDAD[actual.severidad].fondo,
                        color: COLOR_SEVERIDAD[actual.severidad].texto,
                      }}
                    >
                      {actual.severidad}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--texto-mudo)' }}>{actual.ubicacion}</p>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'var(--texto-secundario)',
                      marginTop: 'var(--space-sm)',
                    }}
                  >
                    {actual.descripcion}
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 'var(--space-xxl)',
                  border: '1px dashed var(--borde)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  color: 'var(--texto-secundario)',
                }}
              >
                Sin hallazgos declarados en el {zona}.
              </div>
            )}
          </div>

          <div style={{ marginTop: 'var(--space-lg)' }}>
            <NotaSimulada>
              El acercamiento se genera sobre la foto referencial del modelo. En la plataforma real
              cada hallazgo lleva la fotografía que toma el inspector (`evidencia_url`, módulo 004).
            </NotaSimulada>
          </div>
        </>
      )}

      <style>{`
        .imperfecciones-cuerpo {
          display: grid;
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
          gap: var(--space-xl);
          align-items: start;
        }
        @media (max-width: 700px) {
          .imperfecciones-cuerpo { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
};

/** Flecha de la galería de evidencias. */
const BotonGaleria: React.FC<{ direccion: 'anterior' | 'siguiente'; onClick: () => void }> = ({
  direccion,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={direccion === 'anterior' ? 'Hallazgo anterior' : 'Hallazgo siguiente'}
    style={{
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      [direccion === 'anterior' ? 'left' : 'right']: 0,
      width: '38px',
      height: '64px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: 'rgba(0,0,0,0.45)',
      color: 'var(--blanco)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direccion === 'anterior' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  </button>
);
