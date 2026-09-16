import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVehiculos } from '../state/vehiculosContexto';
import { CARROCERIAS } from '../types/vehiculo';
import type { Carroceria } from '../types/vehiculo';
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
  { valor: 'precio-asc', etiqueta: 'Menor precio' },
  { valor: 'precio-desc', etiqueta: 'Mayor precio' },
  { valor: 'km-asc', etiqueta: 'Menos kilómetros' },
  { valor: 'anio-desc', etiqueta: 'Más nuevos' },
];

interface RangoIngreso {
  id: string;
  etiqueta: string;
  cuotaMin?: number;
  cuotaMax?: number;
  chip: string;
}

/** Rangos de ingresos y cuotas asociadas. */
const RANGOS_INGRESO: RangoIngreso[] = [
  {
    id: '1000-1300',
    etiqueta: '€1.000 – €1.300 (cuota máx. €390)',
    cuotaMax: 390,
    chip: '€1.000 – €1.300 (cuota máx. €390)',
  },
  {
    id: '1301-2000',
    etiqueta: '€1.301 – €2.000 (cuota máx. €600)',
    cuotaMax: 600,
    chip: '€1.301 – €2.000 (cuota máx. €600)',
  },
  {
    id: '2001+',
    etiqueta: '€2.001 en adelante (601 en adelante)',
    cuotaMin: 601,
    chip: '€2.001 en adelante (601 en adelante)',
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

  // Filtros sembrados desde el Home (?q= y ?carroceria=)
  const [busqueda, setBusqueda] = useState(params.get('q') ?? '');
  const [carrocerias, setCarrocerias] = useState<Carroceria[]>(() => {
    const inicial = params.get('carroceria') as Carroceria | null;
    return inicial && CARROCERIAS.includes(inicial) ? [inicial] : [];
  });

  const [marcas, setMarcas] = useState<string[]>([]);
  const [transmisiones, setTransmisiones] = useState<string[]>([]);
  const [precioMax, setPrecioMax] = useState('');
  const [cuotaMax, setCuotaMax] = useState('');
  const [rangoIngreso, setRangoIngreso] = useState('');
  const [anioMin, setAnioMin] = useState('');
  const [kmMax, setKmMax] = useState('');
  const [soloCertificados, setSoloCertificados] = useState(false);
  const [orden, setOrden] = useState<Orden>('relevancia');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const marcasDisponibles = useMemo(
    () => Array.from(new Set(vehiculos.map((v) => v.marca))).sort(),
    [vehiculos],
  );

  const resultados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = vehiculos.filter((v) => {
      const nombre = `${v.marca} ${v.modelo} ${v.version}`.toLowerCase();
      if (texto && !nombre.includes(texto)) return false;
      if (marcas.length && !marcas.includes(v.marca)) return false;
      if (carrocerias.length && !carrocerias.includes(v.carroceria)) return false;
      if (transmisiones.length && !transmisiones.includes(v.transmision)) return false;
      if (precioMax && v.precio > Number(precioMax)) return false;
      const cuota = cuotaDesde(v.precio);
      const rangoObj = RANGOS_INGRESO.find((r) => r.id === rangoIngreso);
      if (rangoObj) {
        if (rangoObj.cuotaMin !== undefined && cuota < rangoObj.cuotaMin) return false;
        if (rangoObj.cuotaMax !== undefined && cuota > rangoObj.cuotaMax) return false;
      } else if (cuotaMax && cuota > Number(cuotaMax)) {
        return false;
      }
      if (anioMin && v.anio < Number(anioMin)) return false;
      if (kmMax && v.kilometraje > Number(kmMax)) return false;
      if (soloCertificados && !v.certificado) return false;
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
      default:
        // Relevancia: primero los certificados, luego los etiquetados.
        ordenados.sort(
          (a, b) =>
            Number(b.certificado) - Number(a.certificado) ||
            Number(Boolean(b.etiqueta)) - Number(Boolean(a.etiqueta)),
        );
    }
    return ordenados;
  }, [
    vehiculos,
    busqueda,
    marcas,
    carrocerias,
    transmisiones,
    precioMax,
    cuotaMax,
    rangoIngreso,
    anioMin,
    kmMax,
    soloCertificados,
    orden,
  ]);

  const limpiarTodo = () => {
    setBusqueda('');
    setMarcas([]);
    setCarrocerias([]);
    setTransmisiones([]);
    setPrecioMax('');
    setCuotaMax('');
    setRangoIngreso('');
    setAnioMin('');
    setKmMax('');
    setSoloCertificados(false);
  };

  const filtrosActivos =
    marcas.length +
    carrocerias.length +
    transmisiones.length +
    (precioMax ? 1 : 0) +
    (cuotaMax ? 1 : 0) +
    (rangoIngreso ? 1 : 0) +
    (anioMin ? 1 : 0) +
    (kmMax ? 1 : 0) +
    (soloCertificados ? 1 : 0);

  return (
    <div>
      <header style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: '26px' }}>Vitrina WAMMA</h1>
        <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
          Vehículos usados con inspección de 240 puntos y validación legal de documentos.
          Todo el inventario está disponible en la <strong>Gran Caracas</strong>.
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
          placeholder="Buscar por marca, modelo o versión"
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
          {carrocerias.map((c) => (
            <ChipFiltro
              key={`c-${c}`}
              etiqueta={c}
              activo
              removible
              onClick={() => setCarrocerias((p) => alternar(p, c))}
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
          {precioMax && (
            <ChipFiltro
              etiqueta={`Hasta €${Number(precioMax).toLocaleString('de-DE')}`}
              activo
              removible
              onClick={() => setPrecioMax('')}
            />
          )}
          {rangoIngreso && (
            <ChipFiltro
              etiqueta={RANGOS_INGRESO.find((r) => r.id === rangoIngreso)?.chip ?? ''}
              activo
              removible
              onClick={() => setRangoIngreso('')}
            />
          )}
          {cuotaMax && !rangoIngreso && (
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
          {kmMax && (
            <ChipFiltro
              etiqueta={`Hasta ${Number(kmMax).toLocaleString('es-VE')} km`}
              activo
              removible
              onClick={() => setKmMax('')}
            />
          )}
          {soloCertificados && (
            <ChipFiltro
              etiqueta="Solo certificados"
              activo
              removible
              onClick={() => setSoloCertificados(false)}
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
            }}
          >
            <GrupoFiltro titulo="Cuota mensual">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <ChipFiltro
                  etiqueta="Cuota menor de €390"
                  activo={cuotaMax === '390' && !rangoIngreso}
                  onClick={() => {
                    setRangoIngreso('');
                    setCuotaMax(cuotaMax === '390' ? '' : '390');
                  }}
                />
                <ChipFiltro
                  etiqueta="Cuota menor de €600"
                  activo={cuotaMax === '600' && !rangoIngreso}
                  onClick={() => {
                    setRangoIngreso('');
                    setCuotaMax(cuotaMax === '600' ? '' : '600');
                  }}
                />
                <ChipFiltro
                  etiqueta="Ver todo"
                  activo={!cuotaMax && !rangoIngreso}
                  onClick={() => {
                    setCuotaMax('');
                    setRangoIngreso('');
                  }}
                />
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Rango de ingresos">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {RANGOS_INGRESO.map((rango) => (
                  <ChipFiltro
                    key={rango.id}
                    etiqueta={rango.etiqueta}
                    activo={rangoIngreso === rango.id}
                    onClick={() => {
                      setCuotaMax('');
                      setRangoIngreso((prev) => (prev === rango.id ? '' : rango.id));
                    }}
                  />
                ))}
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Precio máximo (EUR)">
              <input
                type="number"
                className="form-input"
                placeholder="Sin límite"
                min={0}
                step={500}
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value)}
              />
            </GrupoFiltro>

            <GrupoFiltro titulo="Marca">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {marcasDisponibles.map((m) => (
                  <ChipFiltro
                    key={m}
                    etiqueta={m}
                    activo={marcas.includes(m)}
                    onClick={() => setMarcas((p) => alternar(p, m))}
                  />
                ))}
              </div>
            </GrupoFiltro>

            <GrupoFiltro titulo="Carrocería">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {CARROCERIAS.map((c) => (
                  <ChipFiltro
                    key={c}
                    etiqueta={c}
                    activo={carrocerias.includes(c)}
                    onClick={() => setCarrocerias((p) => alternar(p, c))}
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



            <GrupoFiltro titulo="Año y kilometraje">
              <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Año desde"
                  min={2000}
                  max={2026}
                  value={anioMin}
                  onChange={(e) => setAnioMin(e.target.value)}
                />
                <input
                  type="number"
                  className="form-input"
                  placeholder="Km máximo"
                  min={0}
                  step={5000}
                  value={kmMax}
                  onChange={(e) => setKmMax(e.target.value)}
                />
              </div>
            </GrupoFiltro>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={soloCertificados}
                onChange={(e) => setSoloCertificados(e.target.checked)}
                style={{ accentColor: 'var(--naranja-500)', width: '16px', height: '16px' }}
              />
              Solo certificados 240 puntos
            </label>
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
          grid-template-columns: 260px 1fr;
          gap: var(--space-xl);
          align-items: start;
        }
        .panel-filtros { position: sticky; top: 104px; }
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
