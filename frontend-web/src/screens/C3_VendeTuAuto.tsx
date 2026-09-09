import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';
import { NotaSimulada } from '../components/NotaSimulada';
import { FotoVehiculo } from '../components/FotoVehiculo';
import { mockVehiculos, SEDES } from '../mocks/vehiculos';
import { PARAMETROS_FINANCIAMIENTO } from '../mocks/financiamiento';

interface C3VendeTuAutoProps {
  rateBCV: number;
}

/** Vender el auto, o entregarlo como parte de pago de otro (permuta). */
type Modo = 'venta' | 'cambio';

const formatoUSD = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

/**
 * Cotizador K-Price — MOTOR SIMULADO.
 *
 * El K-Price real es el módulo 003 y aún no existe. Esta función es una
 * heurística de maqueta; no representa ninguna tabla de referencia de WAMMA.
 */
function cotizarSimulado(
  marca: string,
  anio: number,
  kilometraje: number,
  condicion: string,
): number {
  const basePorMarca: Record<string, number> = {
    toyota: 10000,
    chevrolet: 7000,
    ford: 8000,
    hyundai: 8500,
    kia: 8500,
    jeep: 11000,
    renault: 6500,
    mitsubishi: 7500,
  };

  let valor = basePorMarca[marca.trim().toLowerCase()] ?? 9000;
  valor -= (2026 - anio) * 400;

  if (condicion === 'excelente') valor *= 1.05;
  else if (condicion === 'regular') valor *= 0.8;

  if (kilometraje > 120000) valor -= 2000;
  else if (kilometraje > 80000) valor -= 1000;

  return Math.max(Math.round(valor), 4000);
}

export const C3_VendeTuAuto: React.FC<C3VendeTuAutoProps> = ({ rateBCV }) => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [modo, setModo] = useState<Modo>(params.get('modo') === 'cambio' ? 'cambio' : 'venta');

  // Datos del vehículo a cotizar
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('2018');
  const [kilometraje, setKilometraje] = useState('');
  const [condicion, setCondicion] = useState('bueno');

  // Flujo
  const [calculando, setCalculando] = useState(false);
  const [oferta, setOferta] = useState<number | null>(null);
  const [objetivoId, setObjetivoId] = useState('');

  // Cita de inspección
  const [sede, setSede] = useState(SEDES[0] ?? '');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [citaConfirmada, setCitaConfirmada] = useState(false);

  const objetivo = mockVehiculos.find((v) => v.id === objetivoId);
  const diferencia = objetivo && oferta ? objetivo.precioUSD - oferta : null;

  const cotizar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!marca || !modelo || !kilometraje) return;

    setCalculando(true);
    // Retardo artificial para que la cotización se sienta como un cálculo.
    setTimeout(() => {
      setOferta(cotizarSimulado(marca, Number(anio), Number(kilometraje), condicion));
      setCalculando(false);
    }, 1200);
  };

  const reiniciar = () => {
    setMarca('');
    setModelo('');
    setAnio('2018');
    setKilometraje('');
    setCondicion('bueno');
    setOferta(null);
    setObjetivoId('');
    setFecha('');
    setHora('');
    setCitaConfirmada(false);
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto' }}>
      <header style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: '26px' }}>
          {modo === 'venta' ? 'Vende tu auto' : 'Cambia tu auto'}
        </h1>
        <p style={{ color: 'var(--texto-secundario)', marginTop: 'var(--space-xs)' }}>
          {modo === 'venta'
            ? 'Cotiza en minutos con K-Price y agenda tu inspección de 240 puntos.'
            : 'Cotiza el tuyo, elige el próximo y paga solo la diferencia.'}
        </p>
      </header>

      {/* Selector de modo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-xs)',
          padding: '4px',
          backgroundColor: 'var(--superficie)',
          border: '1px solid var(--borde-claro)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        {(
          [
            ['venta', 'Vender mi auto'],
            ['cambio', 'Cambiarlo por otro'],
          ] as [Modo, string][]
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModo(valor)}
            style={{
              padding: '10px',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: modo === valor ? 'var(--blanco)' : 'transparent',
              color: modo === valor ? 'var(--naranja-700)' : 'var(--texto-secundario)',
              boxShadow: modo === valor ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/* Paso 1 · Cotización */}
      {!oferta && (
        <form
          onSubmit={cotizar}
          style={{
            backgroundColor: 'var(--blanco)',
            border: '1px solid var(--borde-claro)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xl)',
          }}
        >
          <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-lg)' }}>
            Datos de tu vehículo
          </h2>

          <div className="rejilla-form">
            <Campo
              label="Marca"
              placeholder="Ej. Toyota"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              required
            />
            <Campo
              label="Modelo"
              placeholder="Ej. Corolla"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              required
            />
          </div>

          <div className="rejilla-form">
            <Campo
              label="Año"
              type="select"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              options={Array.from({ length: 17 }, (_, i) => 2010 + i).map((y) => ({
                value: String(y),
                label: String(y),
              }))}
            />
            <Campo
              label="Kilometraje"
              type="number"
              placeholder="Ej. 85000"
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              required
            />
          </div>

          <Campo
            label="Condición declarada"
            type="select"
            value={condicion}
            onChange={(e) => setCondicion(e.target.value)}
            options={[
              { value: 'excelente', label: 'Excelente · pintura impecable, motor al día' },
              { value: 'bueno', label: 'Bueno · detalles menores de uso, mecánicamente sano' },
              { value: 'regular', label: 'Regular · detalles visibles, requiere mantenimiento' },
            ]}
          />

          <Boton type="submit" variant="primary" fullWidth loading={calculando}>
            Obtener cotización K-Price
          </Boton>

          <div style={{ marginTop: 'var(--space-lg)' }}>
            <NotaSimulada>
              El motor K-Price real es el módulo 003 y todavía no está construido. Esta cotización
              usa una heurística de maqueta.
            </NotaSimulada>
          </div>
        </form>
      )}

      {/* Paso 2 · Resultado */}
      {oferta && !citaConfirmada && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div
            style={{
              backgroundColor: 'var(--blanco)',
              border: '2px dashed var(--naranja-500)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-xxl) var(--space-xl)',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--texto-mudo)',
              }}
            >
              Oferta preliminar por tu {marca} {modelo} {anio}
            </span>
            <div style={{ fontSize: '38px', fontWeight: 700, lineHeight: 1.15, margin: 'var(--space-sm) 0' }}>
              {formatoUSD(oferta)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--texto-mudo)', marginBottom: 'var(--space-lg)' }}>
              Ref. {new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(oferta * rateBCV)} Bs. ·
              tasa BCV {rateBCV.toFixed(2)}
            </div>

            <p
              style={{
                fontSize: '13px',
                color: 'var(--texto-secundario)',
                maxWidth: '46ch',
                margin: '0 auto',
              }}
            >
              Sujeta a la inspección de 240 puntos y a la validación legal de los documentos del
              vehículo.
            </p>
          </div>

          {/* Modo cambio: elegir el vehículo destino */}
          {modo === 'cambio' && (
            <div
              style={{
                backgroundColor: 'var(--blanco)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-xl)',
              }}
            >
              <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-lg)' }}>
                Elige tu próximo vehículo
              </h2>

              <Campo
                label="Vehículo de la vitrina"
                type="select"
                value={objetivoId}
                onChange={(e) => setObjetivoId(e.target.value)}
                options={[
                  { value: '', label: 'Selecciona un vehículo…' },
                  ...mockVehiculos.map((v) => ({
                    value: v.id,
                    label: `${v.marca} ${v.modelo} ${v.anio} — ${formatoUSD(v.precioUSD)}`,
                  })),
                ]}
              />

              {objetivo && diferencia !== null && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr',
                    gap: 'var(--space-lg)',
                    alignItems: 'center',
                    backgroundColor: 'var(--superficie)',
                    border: '1px solid var(--borde-claro)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-lg)',
                  }}
                >
                  <FotoVehiculo vehiculo={objetivo} alto={80} redondeo="var(--radius-sm)" />
                  <div style={{ display: 'grid', gap: '4px', fontSize: '14px' }}>
                    <strong>
                      {objetivo.marca} {objetivo.modelo} {objetivo.anio}
                    </strong>
                    <span style={{ color: 'var(--texto-secundario)' }}>
                      Precio: {formatoUSD(objetivo.precioUSD)}
                    </span>
                    <span style={{ color: 'var(--texto-secundario)' }}>
                      Tu auto en parte de pago: −{formatoUSD(oferta)}
                    </span>
                    <span
                      style={{
                        marginTop: 'var(--space-xs)',
                        paddingTop: 'var(--space-xs)',
                        borderTop: '1px solid var(--borde)',
                        fontWeight: 700,
                        fontSize: '16px',
                        color: diferencia >= 0 ? 'var(--texto-primario)' : 'var(--exito-texto)',
                      }}
                    >
                      {diferencia >= 0
                        ? `Diferencia a pagar: ${formatoUSD(diferencia)}`
                        : `A tu favor: ${formatoUSD(Math.abs(diferencia))}`}
                    </span>
                  </div>
                </div>
              )}

              {objetivo && diferencia !== null && diferencia > 0 && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <Boton
                    variant="secondary"
                    fullWidth
                    onClick={() =>
                      navigate('/financiamiento', {
                        state: {
                          vehiculoId: objetivo.id,
                          // Su auto entra como inicial; se financia la diferencia
                          montoFinanciado: Math.round(diferencia),
                          cuotaInicialUSD: Math.round(oferta),
                          plazo: PARAMETROS_FINANCIAMIENTO.plazoPorDefecto,
                        },
                      })
                    }
                  >
                    Financiar la diferencia
                  </Boton>
                </div>
              )}
            </div>
          )}

          {/* Agendar inspección */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (fecha && hora) setCitaConfirmada(true);
            }}
            style={{
              backgroundColor: 'var(--blanco)',
              border: '1px solid var(--borde-claro)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-xl)',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-lg)' }}>
              Agenda tu inspección de 240 puntos
            </h2>

            <Campo
              label="Sede"
              type="select"
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              options={SEDES.map((s) => ({ value: s, label: s }))}
            />

            <div className="rejilla-form">
              <Campo
                label="Fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
              <Campo
                label="Hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <Boton type="button" variant="secondary" onClick={reiniciar} style={{ flex: 1 }}>
                Volver a cotizar
              </Boton>
              <Boton type="submit" variant="primary" style={{ flex: 2 }}>
                Confirmar cita
              </Boton>
            </div>
          </form>
        </div>
      )}

      {/* Paso 3 · Confirmación */}
      {citaConfirmada && (
        <div
          style={{
            backgroundColor: 'var(--blanco)',
            border: '1px solid var(--exito-texto)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xxxl) var(--space-xl)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--exito-fondo)',
              color: 'var(--exito-texto)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-lg)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h2 style={{ color: 'var(--exito-texto)', fontSize: '20px', marginBottom: 'var(--space-sm)' }}>
            Inspección agendada
          </h2>

          <p
            style={{
              fontSize: '14px',
              color: 'var(--texto-secundario)',
              maxWidth: '44ch',
              margin: '0 auto var(--space-xl)',
            }}
          >
            Te esperamos en <strong>{sede}</strong> el <strong>{fecha}</strong> a las{' '}
            <strong>{hora}</strong>. Trae el título de propiedad original, tu cédula y el RIF.
          </p>

          <Boton variant="primary" onClick={reiniciar}>
            Cotizar otro vehículo
          </Boton>
        </div>
      )}

      <style>{`
        .rejilla-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
        }
        @media (max-width: 560px) {
          .rejilla-form { grid-template-columns: 1fr; gap: 0; }
        }
      `}</style>
    </div>
  );
};
