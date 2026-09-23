import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVehiculos } from '../state/vehiculosContexto';

import { TarjetaVehiculo } from '../components/TarjetaVehiculo';
import { ChipFiltro } from '../components/ChipFiltro';
import { Estado } from '../components/Estado';
import { NotaSimulada } from '../components/NotaSimulada';
import { cuotaDesde } from '../mocks/financiamiento';

interface C1CatalogoProps {
  rateBCV: number;
}

type Orden = 'relevancia' | 'precio-asc' | 'precio-desc' | 'km-asc' | 'anio-desc';

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: 'relevancia', etiqueta: 'Más relevantes' },
  { valor: 'precio-asc', etiqueta: 'Menor cuota mensual' },
  { valor: 'precio-desc', etiqueta: 'Mayor cuota mensual' },
  { valor: 'km-asc', etiqueta: 'Menos kilómetros' },
  { valor: 'anio-desc', etiqueta: 'Más nuevos' },
];

const MARCAS_PERMITIDAS = ['Ford', 'Chevrolet', 'Chery', 'Hyundai', 'Toyota'];

interface RangoIngreso {
  id: string;
  etiqueta: string;
  cuotaMin?: number;
  cuotaMax?: number;
  chip: string;
}

interface RangoCuota {
  id: string;
  etiqueta: string;
  cuotaMin?: number;
  cuotaMax?: number;
  chip: string;
}

const RANGOS_CUOTA: RangoCuota[] = [
  {
    id: 'hasta-390',
    etiqueta: 'Hasta 390',
    cuotaMax: 390,
    chip: 'Cuota: Hasta 390',
  },
  {
    id: '391-600',
    etiqueta: 'Desde 391 hasta 600',
    cuotaMin: 391,
    cuotaMax: 600,
    chip: 'Cuota: Desde 391 hasta 600',
  },
  {
    id: 'a-partir-de-600',
    etiqueta: 'A partir de 600',
    cuotaMin: 601,
    chip: 'Cuota: A partir de 600',
  },
];

/** Rangos de ingresos y cuotas asociadas. */
const RANGOS_INGRESO: RangoIngreso[] = [
  {
    id: '1000-1300',
    etiqueta: '€1.000 – €1.300 / mes',
    cuotaMax: 390,
    chip: 'Ingreso €1.000 – €1.300',
  },
  {
    id: '1301-2000',
    etiqueta: '€1.301 – €2.000 / mes',
    cuotaMax: 600,
    chip: 'Ingreso €1.301 – €2.000',
  },
  {
    id: '2001+',
    etiqueta: 'Más de €2.000 / mes',
    cuotaMin: 601,
    chip: 'Ingreso > €2.000',
  },
];

const alternar = <T,>(lista: T[], valor: T): T[] =>
  lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor];

/** Bloque de un filtro dentro del panel lateral. */
const GrupoFiltro: React.FC<{ titulo: string; children: React.ReactNode }> = ({
  titulo,
  children,
}) => (
  <div style={{ paddingBottom: 'var(--space-lg)', borderBottom: '1px solid var(--borde-claro)' }}>
    <h3
      style={{
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--texto-mudo)',
        marginBottom: 'var(--space-md)',
      }}
    >
      {titulo}
    </h3>
    {children}
  </div>
);

export const C1_Catalogo: React.FC<C1CatalogoProps> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { vehiculos } = useVehiculos();

  // Filtro sembrado desde el Home (?q=) o por cuota máxima (?cuotaMax=)
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [marcas, setMarcas] = useState<string[]>([]);
  const [transmisiones, setTransmisiones] = useState<string[]>([]);
  const [rangoCuota, setRangoCuota] = useState<string>('');
  const [cuotaMax, setCuotaMax] = useState(params.get('cuotaMax') ?? '');
  const [rangoIngreso, setRangoIngreso] = useState('');
  const [anioMin, setAnioMin] = useState('');
  const [orden, setOrden] = useState<Orden>('relevancia');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = vehiculos.filter((v) => {
      const nombre = `${v.marca} ${v.modelo}`.toLowerCase();
      if (texto && !nombre.includes(texto)) return false;
      if (marcas.length && !marcas.includes(v.marca)) return false;
      if (transmisiones.length && !transmisiones.includes(v.transmision)) return false;
      const cuota = cuotaDesde(v.precio);
      const rangoCuotaObj = RANGOS_CUOTA.find((r) => r.id === rangoCuota);
      const rangoObj = RANGOS_INGRESO.find((r) => r.id === rangoIngreso);
      if (rangoCuotaObj) {
        if (rangoCuotaObj.cuotaMin !== undefined && cuota < rangoCuotaObj.cuotaMin) return false;
        if (rangoCuotaObj.cuotaMax !== undefined && cuota > rangoCuotaObj.cuotaMax) return false;
      } else if (rangoObj) {
        if (rangoObj.cuotaMin !== undefined && cuota < rangoObj.cuotaMin) return false;
        if (rangoObj.cuotaMax !== undefined && cuota > rangoObj.cuotaMax) return false;
      } else if (cuotaMax && cuota > Number(cuotaMax)) {
        return false;
      }
      if (anioMin && v.anio < Number(anioMin)) return false;
      return true;
    });

    const ordenados = [...filtrados];
    switch (orden) {
      case 'precio-asc':
        ordenados.sort((a, b) => a.precio - b.precio);
        break;
      case 'precio-desc':
        ordenados.sort((a, b) => b.precio - a.precio);
        break;
      case 'km-asc':
        ordenados.sort((a, b) => a.kilometraje - b.kilometraje);
        break;
      case 'anio-desc':
        ordenados.sort((a, b) => b.anio - a.anio);
        break;
      default: {
        // Relevancia: primero los que tienen etiqueta especial, pero NUNCA mostrar Toyota primero
        ordenados.sort((a, b) => {
          const aEtiqueta = Boolean(a.etiqueta);
          const bEtiqueta = Boolean(b.etiqueta);
          const aToyota = a.marca.trim().toLowerCase() === 'toyota';
          const bToyota = b.marca.trim().toLowerCase() === 'toyota';

          // 1. Si uno tiene etiqueta y el otro no
          if (aEtiqueta !== bEtiqueta) {
            // Si el etiquetado es Toyota y el otro no, no permitir que Toyota desplace al no-Toyota
            if (bEtiqueta && bToyota && !aToyota) return 1;
            if (aEtiqueta && aToyota && !bToyota) return -1;
            return Number(bEtiqueta) - Number(aEtiqueta);
          }

          // 2. A igual condición de etiqueta: no-Toyota se muestra antes que Toyota
          if (aToyota !== bToyota) {
            return aToyota ? 1 : -1;
          }

          return 0;
        });

        // 3. Regla estricta: bajo "Más relevantes", el vehículo en posición 0 NUNCA puede ser Toyota
        // si existe al menos un vehículo de otra marca disponible en la lista filtrada.
        if (ordenados.length > 1 && ordenados[0].marca.trim().toLowerCase() === 'toyota') {
          const primerNoToyotaIdx = ordenados.findIndex(
            (v) => v.marca.trim().toLowerCase() !== 'toyota'
          );
          if (primerNoToyotaIdx > 0) {
            const [primerNoToyota] = ordenados.splice(primerNoToyotaIdx, 1);
            ordenados.unshift(primerNoToyota);
          }
        }
        break;
      }
    }
    return ordenados;
  }, [
    vehiculos,
    busqueda,
    marcas,
    transmisiones,
    rangoCuota,
    cuotaMax,
    rangoIngreso,
    anioMin,
    orden,
  ]);

  const limpiarTodo = () => {
    setBusqueda('');
    setMarcas([]);
    setTransmisiones([]);
    setRangoCuota('');
    setCuotaMax('');
    setRangoIngreso('');
    setAnioMin('');
  };

  const filtrosActivos =
    marcas.length +
    transmisiones.length +
    (rangoCuota ? 1 : cuotaMax ? 1 : 0) +
    (rangoIngreso ? 1 : 0) +
    (anioMin ? 1 : 0);

  return (
    <div>
      <header style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: '26px' }}>Vitrina WAMMA</h1>
        <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
          Todos los vehículos están certificados con Estándar WAMMA: inspeccionados en más de 200 puntos, reacondicionados y con validación legal de documentos. Disponibles ahora, listos para agendar cita.
        </p>
      </header>

      {/* Buscador y orden */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-md)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por marca o modelo"
          aria-label="Buscar vehículos"
          className="form-input"
          style={{ flex: '1 1 260px' }}
        />
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          aria-label="Ordenar resultados"
          className="form-input"
          style={{ flex: '0 1 200px' }}
        >
          {ORDENES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setFiltrosAbiertos((v) => !v)}
          className="boton-filtros"
          style={{
            display: 'none',
            padding: '12px 20px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--naranja-500)',
            backgroundColor: 'var(--blanco)',
            color: 'var(--naranja-500)',
          }}
        >
          Filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ''}
        </button>
      </div>

      {/* Chips de filtros aplicados */}
      {filtrosActivos > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {marcas.map((m) => (
            <ChipFiltro
              key={`m-${m}`}
              etiqueta={m}
              activo
              removible
              onClick={() => setMarcas((p) => alternar(p, m))}
            />
          ))}
          {transmisiones.map((t) => (
            <ChipFiltro
              key={`t-${t}`}
              etiqueta={t}
              activo
              removible
              onClick={() => setTransmisiones((p) => alternar(p, t))}
            />
          ))}
          {rangoIngreso && (
            <ChipFiltro
              etiqueta={RANGOS_INGRESO.find((r) => r.id === rangoIngreso)?.chip ?? ''}
              activo
              removible
              onClick={() => setRangoIngreso('')}
            />
          )}
          {rangoCuota && (
            <ChipFiltro
              etiqueta={RANGOS_CUOTA.find((r) => r.id === rangoCuota)?.chip ?? ''}
              activo
              removible
              onClick={() => setRangoCuota('')}
            />
          )}
          {cuotaMax && !rangoCuota && !rangoIngreso && (
            <ChipFiltro
              etiqueta={`Cuota ≤ €${cuotaMax}`}
              activo
              removible
              onClick={() => setCuotaMax('')}
            />
          )}
          {anioMin && (
            <ChipFiltro
              etiqueta={`Desde ${anioMin}`}
              activo
              removible
              onClick={() => setAnioMin('')}
            />
          )}
          <button
            type="button"
            onClick={limpiarTodo}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--naranja-700)',
              textDecoration: 'underline',
            }}
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Cuerpo: filtros + resultados */}
      <div className="catalogo-cuerpo">
        <aside className={`panel-filtros ${filtrosAbiertos ? 'abierto' : ''}`}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-lg)',
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-lg)',
              boxSizing: 'border-box',
            }}
          >
            <GrupoFiltro titulo="Cuota mensual">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {RANGOS_CUOTA.map((rango) => {
                  const activo = rangoCuota === rango.id;
                  return (
                    <ChipFiltro
                      key={rango.id}
                      etiqueta={rango.etiqueta}
                      activo={activo}
                      onClick={() => {
                        setRangoIngreso('');
                        setCuotaMax('');
                        setRangoCuota(activo ? '' : rango.id);
                      }}
                    />
                  );
                })}
                <ChipFiltro
                  etiqueta="Ver todo"
                  activo={!rangoCuota && !cuotaMax && !rangoIngreso}
                  onClick={() => {
                    setRangoCuota('');
                    setCuotaMax('');
                    setRangoIngreso('');
                  }}
                />
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Rango de ingresos">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', width: '100%' }}>
                {RANGOS_INGRESO.map((rango) => {
                  const activo = rangoIngreso === rango.id;
                  return (
                    <button
                      key={rango.id}
                      type="button"
                      aria-pressed={activo}
                      onClick={() => {
                        setCuotaMax('');
                        setRangoIngreso((prev) => (prev === rango.id ? '' : rango.id));
                      }}
                      className={`btn-rango-ingreso ${activo ? 'activo' : ''}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        border: `1.5px solid ${activo ? 'var(--naranja-500)' : 'var(--borde)'}`,
                        backgroundColor: activo ? 'var(--naranja-500)' : 'var(--blanco)',
                        color: activo ? 'var(--blanco)' : 'var(--texto-primario)',
                        transition: 'all 0.15s ease',
                        boxShadow: activo ? '0 2px 6px rgba(224, 90, 24, 0.22)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: activo ? 700 : 600, lineHeight: 1.3 }}>
                        {rango.etiqueta}
                      </span>
                    </button>
                  );
                })}
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Marca">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {MARCAS_PERMITIDAS.map((m) => (
                  <ChipFiltro
                    key={m}
                    etiqueta={m}
                    activo={marcas.includes(m)}
                    onClick={() => setMarcas((p) => alternar(p, m))}
                  />
                ))}
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Transmisión">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {['Automático', 'Manual'].map((t) => (
                  <ChipFiltro
                    key={t}
                    etiqueta={t}
                    activo={transmisiones.includes(t)}
                    onClick={() => setTransmisiones((p) => alternar(p, t))}
                  />
                ))}
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Año">
              <input
                type="number"
                className="form-input"
                placeholder="Año desde"
                min={2000}
                max={2026}
                value={anioMin}
                onChange={(e) => setAnioMin(e.target.value)}
              />
            </GrupoFiltro>
          </div>
        </aside>

        <div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--texto-secundario)',
              marginBottom: 'var(--space-md)',
            }}
          >
            <strong>{resultados.length}</strong>{' '}
            {resultados.length === 1 ? 'vehículo encontrado' : 'vehículos encontrados'}
          </p>

          {resultados.length > 0 ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: 'var(--space-lg)',
                }}
              >
                {resultados.map((veh) => (
                  <TarjetaVehiculo
                    key={veh.id}
                    vehiculo={veh}
                    rateBCV={rateBCV}
                    onSelect={(id) => navigate(`/vehiculo/${id}`)}
                  />
                ))}
              </div>

              <div style={{ marginTop: 'var(--space-xl)' }}>
                <NotaSimulada>
                  La cuota "desde" asume la inicial más alta y el plazo más largo disponibles. Sujeta
                  a aprobación crediticia.
                </NotaSimulada>
              </div>
            </>
          ) : (
            <Estado
              type="empty"
              message="Prueba quitando algún filtro o buscando otro modelo."
            />
          )}
        </div>
      </div>

      <style>{`
        .catalogo-cuerpo {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--space-xl);
          align-items: start;
        }
        .panel-filtros { position: sticky; top: 104px; }
        .btn-rango-ingreso:not(.activo):hover {
          border-color: var(--naranja-300) !important;
          background-color: var(--naranja-50, #fff7ed) !important;
        }
        @media (min-width: 1025px) and (max-width: 1279px) {
          .panel-filtros { top: 92px; }
        }

        @media (max-width: 900px) {
          .catalogo-cuerpo { grid-template-columns: 1fr; }
          .panel-filtros { display: none; position: static; }
          .panel-filtros.abierto { display: block; margin-bottom: var(--space-lg); }
          .boton-filtros { display: block !important; }
        }
      `}</style>
    </div>
  );
};
