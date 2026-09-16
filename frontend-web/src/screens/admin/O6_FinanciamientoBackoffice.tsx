import React, { useState, useMemo, useEffect } from 'react';
import { useVehiculos } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';
import { PARAMETROS_FINANCIAMIENTO, calcularCuota, generarAmortizacion } from '../../mocks/financiamiento';

interface O6FinanciamientoBackofficeProps {
  rateBCV: number;
}

const formatoEUR = (v: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(v) ? v : 0);

const formatoEURDecimal = (v: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);

const formatoBs = (v: number) =>
  new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0) + ' Bs.';

export const O6_FinanciamientoBackoffice: React.FC<O6FinanciamientoBackofficeProps> = ({
  rateBCV,
}) => {
  const { vehiculos } = useVehiculos();

  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string>(
    vehiculos[0]?.id || '',
  );
  const [precioPersonalizado, setPrecioPersonalizado] = useState<number>(8000);
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefonoCliente, setTelefonoCliente] = useState<string>('');

  // Sincronizar selección inicial cuando los vehículos cargan asíncronamente desde el backend
  useEffect(() => {
    if (!vehiculoSeleccionadoId && vehiculos.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVehiculoSeleccionadoId(vehiculos[0].id);
      setPrecioPersonalizado(vehiculos[0].precio);
    }
  }, [vehiculos, vehiculoSeleccionadoId]);

  // La inicial arranca en el mínimo vigente (20 %, decisión del PO).
  const [porcentajeInicial, setPorcentajeInicial] = useState<number>(
    Math.round(PARAMETROS_FINANCIAMIENTO.inicialPorcentaje * 100),
  );
  const [plazoMeses, setPlazoMeses] = useState<number>(18);
  const [tasaMensualPct, setTasaMensualPct] = useState<number>(4.0);

  // Análisis de capacidad en EUR
  const [ingresoMensualEUR, setIngresoMensualEUR] = useState<number>(1500);
  const [gastosMensualesEUR, setGastosMensualesEUR] = useState<number>(800);

  const [copiado, setCopiado] = useState(false);

  const vehiculo = vehiculos.find((v) => v.id === vehiculoSeleccionadoId);
  const precio =
    vehiculoSeleccionadoId === 'personalizado'
      ? (Number.isFinite(precioPersonalizado) && precioPersonalizado > 0 ? precioPersonalizado : 8000)
      : (vehiculo?.precio || 8000);

  const inicialEUR = Math.round((precio * porcentajeInicial) / 100);
  const montoFinanciado = Math.max(0, precio - inicialEUR);

  // Tasa mensual efectiva
  const tasaMensualRatio =
    Number.isFinite(tasaMensualPct) && tasaMensualPct >= 0
      ? tasaMensualPct / 100
      : PARAMETROS_FINANCIAMIENTO.tasaMensual;

  // Cuota sistema francés calculada con la tasa parametrizada
  const cuotaMensualEUR = useMemo(() => {
    if (montoFinanciado <= 0) return 0;
    return calcularCuota(montoFinanciado, plazoMeses, tasaMensualRatio);
  }, [montoFinanciado, plazoMeses, tasaMensualRatio]);

  const tablaAmortizacion = useMemo(() => {
    if (montoFinanciado <= 0) return [];
    return generarAmortizacion(montoFinanciado, plazoMeses, tasaMensualRatio);
  }, [montoFinanciado, plazoMeses, tasaMensualRatio]);

  const totalIntereses = tablaAmortizacion.reduce((acc, row) => acc + row.interes, 0);
  const totalPagado = montoFinanciado + totalIntereses;

  // Ratios de capacidad (30% del ingreso según Constitución WAMMA)
  const capacidadPagoDisponible = (ingresoMensualEUR || 0) * PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago;
  const ratioCuotaIngreso =
    ingresoMensualEUR > 0 ? (cuotaMensualEUR / ingresoMensualEUR) * 100 : 0;

  const copiarPropuestaWhatsApp = () => {
    const vehiculoTitulo =
      vehiculoSeleccionadoId === 'personalizado'
        ? 'Vehículo Personalizado'
        : `${vehiculo?.marca} ${vehiculo?.modelo} ${vehiculo?.version} (${vehiculo?.anio})`;

    const texto = `*PROPUESTA DE FINANCIAMIENTO WAMMA* 🚗
${nombreCliente ? `*Cliente:* ${nombreCliente}\n` : ''}
*Vehículo:* ${vehiculoTitulo}
*Precio de Venta:* ${formatoEUR(precio)} (Ref. ${formatoBs(precio * rateBCV)})
----------------------------------
*Inicial (${porcentajeInicial}%):* ${formatoEUR(inicialEUR)}
*Monto Financiado:* ${formatoEUR(montoFinanciado)}
*Plazo:* ${plazoMeses} meses
*Tasa Mensual:* ${tasaMensualPct}%
*Cuota Mensual Fija:* *${formatoEURDecimal(cuotaMensualEUR)}* (Ref. ${formatoBs(cuotaMensualEUR * rateBCV)})
----------------------------------
*Tasa Oficial BCV Aplicada:* ${rateBCV.toFixed(2)} Bs/EUR
*Requisitos Básicos:*
- Cédula de Identidad y RIF vigente
- Constancia de trabajo o certificación de ingresos
- 3 últimos estados de cuenta bancarios

_Propuesta emitida por WAMMA by Token Pago POS._`;

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="financiamiento-admin-contenedor">
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '24px', margin: 0, fontWeight: 700 }}>
            Cotizador y Estructurador de Financiamiento WAMMA
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '4px 0 0' }}>
            Herramienta interna para estructurar planes de financiamiento, generar amortizaciones exactas y enviar propuestas a clientes en Euros y Bolívares (BCV).
          </p>
        </div>
        <Boton variant="primary" onClick={copiarPropuestaWhatsApp}>
          {copiado ? '✓ ¡Copiado al Portapapeles!' : '📋 Copiar Propuesta para WhatsApp'}
        </Boton>
      </div>

      <div className="grid-financiamiento-admin">
        {/* Columna Izquierda: Parámetros */}
        <div className="panel-parametros">
          <div className="tarjeta-blanca">
            <h2 className="panel-titulo">1. Selección de Vehículo y Cliente</h2>

            <div className="campo-item">
              <label>Vehículo del Inventario</label>
              <select
                value={vehiculoSeleccionadoId}
                onChange={(e) => {
                  setVehiculoSeleccionadoId(e.target.value);
                  if (e.target.value !== 'personalizado') {
                    const sel = vehiculos.find((v) => v.id === e.target.value);
                    if (sel) setPrecioPersonalizado(sel.precio);
                  }
                }}
              >
                {vehiculos.length === 0 && (
                  <option value="">Cargando inventario...</option>
                )}
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.version} ({v.anio}) — {formatoEUR(v.precio)}
                  </option>
                ))}
                <option value="personalizado">-- Ingresar Precio Manual --</option>
              </select>
            </div>

            {vehiculoSeleccionadoId === 'personalizado' && (
              <div className="campo-item">
                <label>Precio del Vehículo (EUR)</label>
                <input
                  type="number"
                  min="500"
                  step="100"
                  value={precioPersonalizado}
                  onChange={(e) => setPrecioPersonalizado(Number(e.target.value))}
                />
              </div>
            )}

            <div className="grid-2-col">
              <div className="campo-item">
                <label>Nombre del Solicitante</label>
                <input
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                />
              </div>
              <div className="campo-item">
                <label>Teléfono WhatsApp</label>
                <input
                  type="tel"
                  placeholder="04141234567"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="tarjeta-blanca" style={{ marginTop: 'var(--space-lg)' }}>
            <h2 className="panel-titulo">2. Condiciones del Crédito</h2>

            <div className="campo-item">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label>Inicial Aportada ({porcentajeInicial}%)</label>
                <span style={{ fontWeight: 700, color: 'var(--naranja-600)' }}>
                  {formatoEUR(inicialEUR)}
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                step="5"
                value={porcentajeInicial}
                onChange={(e) => setPorcentajeInicial(Number(e.target.value))}
                style={{ accentColor: 'var(--naranja-500)', width: '100%', marginTop: '6px' }}
              />
            </div>

            <div className="grid-2-col">
              <div className="campo-item">
                <label>Plazo a Financiar</label>
                <select
                  value={plazoMeses}
                  onChange={(e) => setPlazoMeses(Number(e.target.value))}
                >
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                  <option value="18">18 meses</option>
                  <option value="24">24 meses</option>
                  <option value="36">36 meses</option>
                </select>
              </div>

              <div className="campo-item">
                <label>Tasa Mensual (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={tasaMensualPct}
                  onChange={(e) => setTasaMensualPct(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="resumen-financiamiento-caja">
              <div className="fila-resumen">
                <span>Monto financiado neto:</span>
                <strong>{formatoEUR(montoFinanciado)}</strong>
              </div>
              <div className="fila-resumen">
                <span>Total intereses estimados:</span>
                <strong>{formatoEURDecimal(totalIntereses)}</strong>
              </div>
              <div className="fila-resumen">
                <span>Total a pagar por el cliente:</span>
                <strong>{formatoEURDecimal(totalPagado)}</strong>
              </div>
              <div className="fila-resumen cuota-destacada">
                <span>Cuota Mensual Fija:</span>
                <span className="monto-cuota-grande">
                  {formatoEURDecimal(cuotaMensualEUR)}
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--texto-mudo)' }}>
                Ref. {formatoBs(cuotaMensualEUR * rateBCV)} (Tasa BCV {rateBCV.toFixed(2)} Bs/EUR)
              </div>
            </div>
          </div>

          <div className="tarjeta-blanca" style={{ marginTop: 'var(--space-lg)' }}>
            <h2 className="panel-titulo">3. Evaluación de Capacidad del Cliente</h2>
            <div className="grid-2-col">
              <div className="campo-item">
                <label>Ingreso Mensual (EUR)</label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={ingresoMensualEUR}
                  onChange={(e) => setIngresoMensualEUR(Number(e.target.value))}
                />
              </div>
              <div className="campo-item">
                <label>Gastos Fijos (EUR)</label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={gastosMensualesEUR}
                  onChange={(e) => setGastosMensualesEUR(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--superficie)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>
                  Capacidad de pago ({Math.round(PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago * 100)} % del ingreso):
                </span>
                <strong>{formatoEUR(capacidadPagoDisponible)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '6px' }}>
                <span>Ratio Cuota / Ingreso:</span>
                <strong
                  style={{
                    color:
                      ratioCuotaIngreso <= 30
                        ? '#0F6E56'
                        : ratioCuotaIngreso <= 40
                          ? 'var(--naranja-600)'
                          : '#C0392B',
                  }}
                >
                  {Number.isFinite(ratioCuotaIngreso) ? ratioCuotaIngreso.toFixed(1) : '0.0'}%{' '}
                  {ratioCuotaIngreso <= 30
                    ? '(Óptimo)'
                    : ratioCuotaIngreso <= 40
                      ? '(Aceptable)'
                      : '(Riesgo Elevado)'}
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--texto-mudo)', marginTop: '6px', lineHeight: 1.4 }}>
                Los gastos fijos se registran como referencia para el análisis; no reducen la capacidad de pago.
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tabla de Amortización */}
        <div className="panel-amortizacion">
          <div className="tarjeta-blanca">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 className="panel-titulo" style={{ margin: 0 }}>
                Tabla de Amortización (Sistema Francés)
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
                {plazoMeses} cuotas fijas · {tasaMensualPct}% mensual
              </span>
            </div>

            <div className="tabla-amortizacion-wrapper">
              <table className="tabla-amortizacion">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Cuota EUR</th>
                    <th>Capital</th>
                    <th>Interés</th>
                    <th>Saldo EUR</th>
                    <th>Ref. Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaAmortizacion.map((fila) => (
                    <tr key={fila.numero}>
                      <td style={{ fontWeight: 700 }}>#{fila.numero}</td>
                      <td style={{ fontWeight: 600 }}>{formatoEURDecimal(fila.monto)}</td>
                      <td style={{ color: '#0F6E56' }}>{formatoEURDecimal(fila.capital)}</td>
                      <td style={{ color: 'var(--naranja-600)' }}>{formatoEURDecimal(fila.interes)}</td>
                      <td style={{ fontWeight: 600 }}>{formatoEURDecimal(fila.saldo)}</td>
                      <td style={{ fontSize: '11px', color: 'var(--texto-mudo)', whiteSpace: 'nowrap' }}>
                        {formatoBs(fila.monto * rateBCV)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .financiamiento-admin-contenedor {
          max-width: 1280px;
          margin: 0 auto;
        }
        .grid-financiamiento-admin {
          display: grid;
          grid-template-columns: 460px 1fr;
          gap: var(--space-xl);
          align-items: start;
        }
        @media (max-width: 1024px) {
          .grid-financiamiento-admin {
            grid-template-columns: 1fr;
          }
        }
        .tarjeta-blanca {
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg);
          padding: var(--space-xl);
        }
        .panel-titulo {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 var(--space-md);
          padding-bottom: 6px;
          border-bottom: 1px solid var(--borde-claro);
        }
        .campo-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
        }
        .campo-item label {
          font-size: 12px;
          font-weight: 600;
          color: var(--texto-secundario);
        }
        .campo-item input,
        .campo-item select {
          padding: 8px 12px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 13px;
          outline: none;
        }
        .campo-item input:focus,
        .campo-item select:focus {
          border-color: var(--naranja-500);
        }
        .grid-2-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-md);
        }
        .resumen-financiamiento-caja {
          background-color: var(--superficie);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md);
          padding: 14px;
          margin-top: 14px;
        }
        .fila-resumen {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .cuota-destacada {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--borde);
          align-items: center;
        }
        .monto-cuota-grande {
          font-size: 20px;
          font-weight: 700;
          color: var(--naranja-600);
        }
        .tabla-amortizacion-wrapper {
          max-height: 540px;
          overflow-x: auto;
          overflow-y: auto;
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md);
        }
        .tabla-amortizacion {
          width: 100%;
          min-width: 580px;
          border-collapse: collapse;
          font-size: 12px;
          text-align: right;
        }
        .tabla-amortizacion th,
        .tabla-amortizacion td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--borde-claro);
        }
        .tabla-amortizacion th {
          background-color: var(--superficie);
          font-size: 11px;
          font-weight: 700;
          color: var(--texto-secundario);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .tabla-amortizacion td:first-child,
        .tabla-amortizacion th:first-child {
          text-align: left;
        }
      `}</style>
    </div>
  );
};
