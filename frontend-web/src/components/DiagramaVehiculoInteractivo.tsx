import React, { useState, useRef } from 'react';
import type { Imperfeccion } from '../types/vehiculo';
import { Boton } from './Boton';

interface DiagramaVehiculoInteractivoProps {
  imperfecciones: Imperfeccion[];
  onChange: (imperfecciones: Imperfeccion[]) => void;
}

const TRAZO = { stroke: 'var(--borde)', strokeWidth: 0.9 } as const;
const RELLENO = 'var(--superficie)';

export const DiagramaVehiculoInteractivo: React.FC<DiagramaVehiculoInteractivoProps> = ({
  imperfecciones,
  onChange,
}) => {
  const [zona, setZona] = useState<'exterior' | 'interior'>('exterior');
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<{ x: number; y: number } | null>(null);

  // Formulario del nuevo hallazgo
  const [tipo, setTipo] = useState('Rayón superficial');
  const [ubicacion, setUbicacion] = useState('Puerta delantera izquierda');
  const [severidad, setSeveridad] = useState<'leve' | 'moderada'>('leve');
  const [descripcion, setDescripcion] = useState('');

  const svgRef = useRef<SVGSVGElement>(null);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRaw = ((e.clientX - rect.left) / rect.width) * 100;
    const yRaw = ((e.clientY - rect.top) / rect.height) * 100;
    const x = Math.max(2, Math.min(98, Math.round(xRaw)));
    const y = Math.max(2, Math.min(98, Math.round(yRaw)));
    setPuntoSeleccionado({ x, y });
  };

  const agregarImperfeccion = () => {
    if (!puntoSeleccionado) return;

    const nuevo: Imperfeccion = {
      id: `imp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      zona,
      tipo,
      ubicacion,
      severidad,
      descripcion:
        descripcion.trim() || `${tipo} registrado en ${ubicacion.toLowerCase()}.`,
      x: puntoSeleccionado.x,
      y: puntoSeleccionado.y,
    };

    onChange([...imperfecciones, nuevo]);
    setPuntoSeleccionado(null);
    setDescripcion('');
  };

  const eliminarImperfeccion = (id: string) => {
    onChange(imperfecciones.filter((i) => i.id !== id));
  };

  const imperfeccionesZona = imperfecciones.filter((i) => i.zona === zona);

  return (
    <div className="diagrama-interactivo-contenedor">
      <div className="diagrama-tabs">
        <button
          type="button"
          className={`tab-btn ${zona === 'exterior' ? 'activo' : ''}`}
          onClick={() => {
            setZona('exterior');
            setPuntoSeleccionado(null);
          }}
        >
          Carrocería Exterior
        </button>
        <button
          type="button"
          className={`tab-btn ${zona === 'interior' ? 'activo' : ''}`}
          onClick={() => {
            setZona('interior');
            setPuntoSeleccionado(null);
          }}
        >
          Cabina Interior
        </button>
      </div>

      <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '8px 0 16px' }}>
        👆 <strong>Haz clic en cualquier punto del diagrama</strong> del vehículo para fijar la ubicación exacta del detalle o imperfección.
      </p>

      <div className="diagrama-grid">
        {/* SVG Interactivo */}
        <div className="svg-wrapper">
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            className="svg-plano"
            onClick={handleSvgClick}
          >
            {zona === 'exterior' ? (
              <g>
                {/* Planta */}
                <rect x="26" y="6" width="48" height="34" rx="11" fill={RELLENO} {...TRAZO} />
                <path d="M32 16 h36" fill="none" {...TRAZO} />
                <path d="M32 30 h36" fill="none" {...TRAZO} />
                <rect x="34" y="17" width="32" height="12" rx="3" fill="var(--blanco)" {...TRAZO} />
                <path d="M26 19 h-3 M74 19 h3" fill="none" {...TRAZO} />

                {/* Perfil */}
                <path
                  d="M8 70 L12 58 Q14 54 20 53 L36 51 Q44 44 56 44 Q70 44 78 52 L88 55 Q92 57 92 63 L92 70 Z"
                  fill={RELLENO}
                  {...TRAZO}
                />
                <path d="M40 51 Q46 46 55 46 Q64 46 70 51 Z" fill="var(--blanco)" {...TRAZO} />
                <circle cx="26" cy="70" r="6.5" fill="var(--blanco)" {...TRAZO} />
                <circle cx="74" cy="70" r="6.5" fill="var(--blanco)" {...TRAZO} />
                <circle cx="26" cy="70" r="2.6" fill="var(--borde-claro)" {...TRAZO} />
                <circle cx="74" cy="70" r="2.6" fill="var(--borde-claro)" {...TRAZO} />
                <path d="M4 78 h92" stroke="var(--borde-claro)" strokeWidth="0.8" />
              </g>
            ) : (
              <g>
                <rect x="22" y="14" width="56" height="72" rx="14" fill={RELLENO} {...TRAZO} />
                <path d="M28 24 h44" fill="none" {...TRAZO} />
                <circle cx="34" cy="29" r="4.4" fill="var(--blanco)" {...TRAZO} />
                <path d="M29.6 29 h8.8" fill="none" {...TRAZO} />
                <rect x="44" y="34" width="9" height="18" rx="2.5" fill="var(--blanco)" {...TRAZO} />
                <rect x="27" y="36" width="13" height="16" rx="4" fill="var(--blanco)" {...TRAZO} />
                <rect x="57" y="36" width="13" height="16" rx="4" fill="var(--blanco)" {...TRAZO} />
                <rect x="28" y="60" width="42" height="16" rx="4" fill="var(--blanco)" {...TRAZO} />
              </g>
            )}

            {/* Marcadores ya registrados */}
            {imperfeccionesZona.map((imp, idx) => (
              <g key={imp.id} transform={`translate(${imp.x}, ${imp.y})`}>
                <circle
                  r="4"
                  fill={imp.severidad === 'moderada' ? 'var(--peligro-fondo)' : 'var(--aviso-fondo)'}
                  stroke={imp.severidad === 'moderada' ? 'var(--peligro-texto)' : 'var(--aviso-texto)'}
                  strokeWidth="1"
                />
                <text
                  textAnchor="middle"
                  dy="1.6"
                  fontSize="3.2"
                  fontWeight="bold"
                  fill={imp.severidad === 'moderada' ? 'var(--peligro-texto)' : 'var(--aviso-texto)'}
                >
                  {idx + 1}
                </text>
              </g>
            ))}

            {/* Marcador temporal recién cliqueado */}
            {puntoSeleccionado && (
              <g transform={`translate(${puntoSeleccionado.x}, ${puntoSeleccionado.y})`}>
                <circle r="6" fill="rgba(209, 116, 56, 0.3)" />
                <circle r="3.5" fill="var(--naranja-500)" stroke="white" strokeWidth="1" />
              </g>
            )}
          </svg>
        </div>

        {/* Panel lateral para completar el detalle del punto */}
        <div className="editor-detalle">
          {puntoSeleccionado ? (
            <div className="formulario-nuevo-punto">
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '8px', color: 'var(--naranja-700)' }}>
                📍 Coordenadas: X={puntoSeleccionado.x}%, Y={puntoSeleccionado.y}% ({zona})
              </div>

              <div className="form-item">
                <label>Tipo de detalle / imperfección:</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="Rayón superficial">Rayón superficial</option>
                  <option value="Abolladura">Abolladura sin pintura</option>
                  <option value="Desgaste de pintura">Desgaste de pintura</option>
                  <option value="Fisura o marca en cristal">Fisura o marca en cristal</option>
                  <option value="Desgaste de tapicería">Desgaste de tapicería</option>
                  <option value="Desgaste de mandos/volante">Desgaste de mandos o volante</option>
                  <option value="Otro detalle menor">Otro detalle menor</option>
                </select>
              </div>

              <div className="form-item">
                <label>Ubicación de la pieza:</label>
                <input
                  type="text"
                  placeholder="Ej. Puerta delantera derecha"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                />
              </div>

              <div className="form-item">
                <label>Severidad:</label>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="severidad"
                      value="leve"
                      checked={severidad === 'leve'}
                      onChange={() => setSeveridad('leve')}
                    />
                    Leve (cosmético)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    <input
                      type="radio"
                      name="severidad"
                      value="moderada"
                      checked={severidad === 'moderada'}
                      onChange={() => setSeveridad('moderada')}
                    />
                    Moderada
                  </label>
                </div>
              </div>

              <div className="form-item">
                <label>Descripción detallada:</label>
                <textarea
                  rows={2}
                  placeholder="Describe el hallazgo para que el cliente lo entienda antes de ir..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <Boton variant="primary" size="small" type="button" onClick={agregarImperfeccion}>
                  Guardar Detalle
                </Boton>
                <Boton
                  variant="secondary"
                  size="small"
                  type="button"
                  onClick={() => setPuntoSeleccionado(null)}
                >
                  Cancelar
                </Boton>
              </div>
            </div>
          ) : (
            <div className="caja-vacia">
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>🎯</div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>Ningún punto seleccionado</div>
              <div style={{ fontSize: '12px', color: 'var(--texto-mudo)', marginTop: '4px' }}>
                Haz clic en el diagrama de la izquierda para registrar una nueva imperfección en esa posición exacta.
              </div>
            </div>
          )}

          {/* Listado de imperfecciones de este vehículo */}
          <div style={{ marginTop: 'var(--space-md)' }}>
            <h4 style={{ fontSize: '13px', margin: '0 0 8px', color: 'var(--texto-primario)' }}>
              Detalles registrados en {zona} ({imperfeccionesZona.length})
            </h4>

            {imperfeccionesZona.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--texto-mudo)', fontStyle: 'italic' }}>
                Sin imperfecciones declaradas en {zona}.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {imperfeccionesZona.map((imp, idx) => (
                  <div key={imp.id} className="item-imperfeccion">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>
                        #{idx + 1} {imp.tipo} — {imp.ubicacion}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>
                        {imp.descripcion} (X: {imp.x}%, Y: {imp.y}%)
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-eliminar"
                      onClick={() => eliminarImperfeccion(imp.id)}
                      title="Eliminar detalle"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .diagrama-interactivo-contenedor {
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md);
          padding: var(--space-lg);
        }
        .diagrama-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--borde-claro);
          padding-bottom: 8px;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 6px 14px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--texto-secundario);
          cursor: pointer;
          border-radius: var(--radius-sm);
        }
        .tab-btn.activo {
          background-color: var(--naranja-50);
          color: var(--naranja-600);
        }
        .diagrama-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--space-lg);
          align-items: start;
        }
        @media (max-width: 768px) {
          .diagrama-grid { grid-template-columns: 1fr; }
        }
        .svg-wrapper {
          border: 1px dashed var(--borde);
          border-radius: var(--radius-md);
          padding: 8px;
          background-color: var(--superficie);
          cursor: crosshair;
        }
        .svg-plano {
          width: 100%;
          height: auto;
          display: block;
        }
        .editor-detalle {
          display: flex;
          flex-direction: column;
        }
        .formulario-nuevo-punto {
          background-color: var(--superficie);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-sm);
          padding: 12px;
        }
        .form-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 8px;
        }
        .form-item label {
          font-size: 12px;
          font-weight: 600;
          color: var(--texto-secundario);
        }
        .form-item input,
        .form-item select,
        .form-item textarea {
          padding: 6px 8px;
          font-size: 13px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          outline: none;
          font-family: inherit;
        }
        .form-item input:focus,
        .form-item select:focus,
        .form-item textarea:focus {
          border-color: var(--naranja-500);
        }
        .caja-vacia {
          background-color: var(--superficie);
          border: 1px dashed var(--borde);
          border-radius: var(--radius-sm);
          padding: 24px 16px;
          text-align: center;
        }
        .item-imperfeccion {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-sm);
          background-color: var(--blanco);
        }
        .btn-eliminar {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 4px;
        }
        .btn-eliminar:hover {
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
};
