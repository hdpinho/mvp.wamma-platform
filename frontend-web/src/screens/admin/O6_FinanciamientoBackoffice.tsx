import React, { useState, useMemo } from 'react';
import { useVehiculos } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';
import { PARAMETROS_FINANCIAMIENTO, calcularCuota, generarAmortizacion } from '../../mocks/financiamiento';

interface O6FinanciamientoBackofficeProps {
  rateBCV: number;
}

export const O6_FinanciamientoBackoffice: React.FC<O6FinanciamientoBackofficeProps> = ({
  rateBCV,
}) => {
  const { vehiculos } = useVehiculos();

  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string>(
    vehiculos[0]?.id || '',
  );
  const [precioPersonalizado, setPrecioPersonalizado] = useState<number>(0);
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefonoCliente, setTelefonoCliente] = useState<string>('');

  // La inicial arranca en el mínimo vigente (20 %, decisión del PO).
  const [porcentajeInicial, setPorcentajeInicial] = useState<number>(
    Math.round(PARAMETROS_FINANCIAMIENTO.inicialPorcentaje * 100),
  );
  const [plazoMeses, setPlazoMeses] = useState<number>(18);
  const [tasaMensualPct, setTasaMensualPct] = useState<number>(4.0);

  // Análisis de capacidad
  const [ingresoMensualUSD, setIngresoMensualUSD] = useState<number>(1500);
  const [gastosMensualesUSD, setGastosMensualesUSD] = useState<number>(800);

  const [copiado, setCopiado] = useState(false);

  const vehiculo = vehiculos.find((v) => v.id === vehiculoSeleccionadoId);
  const precio =
    vehiculoSeleccionadoId === 'personalizado'
      ? precioPersonalizado
      : vehiculo?.precio || 8000;

  const inicialUSD = Math.round((precio * porcentajeInicial) / 100);
  const montoFinanciado = Math.max(0, precio - inicialUSD);

  // Cuota sistema francés
  const cuotaMensualUSD = useMemo(() => {
    if (montoFinanciado <= 0) return 0;
    return calcularCuota(montoFinanciado, plazoMeses);
  }, [montoFinanciado, plazoMeses]);

  const tablaAmortizacion = useMemo(() => {
    if (montoFinanciado <= 0) return [];
    return generarAmortizacion(montoFinanciado, plazoMeses);
  }, [montoFinanciado, plazoMeses]);

  const totalIntereses = tablaAmortizacion.reduce((acc, row) => acc + row.interes, 0);
  const totalPagado = montoFinanciado + totalIntereses;

  // Ratios de capacidad
  // Decisión del PO: la capacidad es el 30 % del ingreso mensual; los gastos se
  // registran como referencia, pero no restan. Misma regla que el núcleo Go.
  const capacidadPagoDisponible = ingresoMensualUSD * PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago;
  const ratioCuotaIngreso =
    ingresoMensualUSD > 0 ? (cuotaMensualUSD / ingresoMensualUSD) * 100 : 0;

  const copiarPropuestaWhatsApp = () => {
    const vehiculoTitulo =
      vehiculoSeleccionadoId === 'personalizado'
        ? 'Vehículo Personalizado'
        : `${vehiculo?.marca} ${vehiculo?.modelo} ${vehiculo?.version} (${vehiculo?.anio})`;

    const texto = `*PROPUESTA DE FINANCIAMIENTO WAMMA* 🚗
${nombreCliente ? `*Cliente:* ${nombreCliente}\n` : ''}
*Vehículo:* ${vehiculoTitulo}
*Precio de Venta:* $${precio.toLocaleString()} USD (Ref. ${(precio * rateBCV).toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs.)
----------------------------------
*Inicial (${porcentajeInicial}%):* $${inicialUSD.toLocaleString()} USD
*Monto Financiado:* $${montoFinanciado.toLocaleString()} USD
*Plazo:* ${plazoMeses} meses
*Cuota Mensual Fija:* *$${cuotaMensualUSD.toFixed(2)} USD* (Ref. ${(cuotaMensualUSD * rateBCV).toFixed(2)} Bs.)
----------------------------------
*Tasa Oficial BCV Aplicada:* ${rateBCV.toFixed(2)} Bs/USD
*Requisitos Básicos:*
- Cédula de Identidad y RIF vigente
- Constancia de trabajo o certificación de ingresos
- 3 últimos estados de cuenta bancarios

_Propuesta emitida por Corporación Token Pago POS / WAMMA._`;

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
            Herramienta interna para estructurar planes de financiamiento, generar amortizaciones exactas y enviar propuestas a clientes.
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
                {vehiculos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.marca} {v.modelo} {v.version} ({v.anio}) — ${v.precio.toLocaleString()} USD
                  </option>
                ))}
                <option value="personalizado">-- Ingresar Precio Manual --</option>
              </select>
            </div>

            {vehiculoSeleccionadoId === 'personalizado' && (
              <div className="campo-item">
                <label>Precio del Vehículo (USD)</label>
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
                  ${inicialUSD.toLocaleString()} USD
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
                  value={tasaMensualPct}
                  onChange={(e) => setTasaMensualPct(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="resumen-financiamiento-caja">
              <div className="fila-resumen">
                <span>Monto financiado neto:</span>
                <strong>${montoFinanciado.toLocaleString()} USD</strong>
              </div>
              <div className="fila-resumen">
                <span>Total intereses estimados:</span>
                <strong>${totalIntereses.toFixed(2)} USD</strong>
              </div>
              <div className="fila-resumen">
                <span>Total a pagar por el cliente:</span>
                <strong>${totalPagado.toFixed(2)} USD</strong>
              </div>
              <div className="fila-resumen cuota-destacada">
                <span>Cuota Mensual Fija:</span>
                <span className="monto-cuota-grande">
                  ${cuotaMensualUSD.toFixed(2)} USD
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--texto-mudo)' }}>
                Ref. {(cuotaMensualUSD * rateBCV).toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs. (Tasa BCV {rateBCV.toFixed(2)})
              </div>
            </div>
          </div>

          <div className="tarjeta-blanca" style={{ marginTop: 'var(--space-lg)' }}>
            <h2 className="panel-titulo">3. Evaluación de Capacidad del Cliente</h2>
            <div className="grid-2-col">
              <div className="campo-item">
                <label>Ingreso Mensual (USD)</label>
                <input
                  type="number"
                  step="50"
                  value={ingresoMensualUSD}
                  onChange={(e) => setIngresoMensualUSD(Number(e.target.value))}
                />
              </div>
              <div className="campo-item">
                <label>Gastos Fijos (USD)</label>
                <input
                  type="number"
                  step="50"
                  value={gastosMensualesUSD}
                  onChange={(e) => setGastosMensualesUSD(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--superficie)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>
                  Capacidad de pago ({Math.round(PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago * 100)} % del ingreso):
                </span>
                <strong>${Math.round(capacidadPagoDisponible).toLocaleString()} USD</strong>
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
                  {ratioCuotaIngreso.toFixed(1)}%{' '}
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
                {plazoMeses} cuotas fijas
              </span>
            </div>

            <div className="tabla-amortizacion-wrapper">
              <table className="tabla-amortizacion">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Cuota USD</th>
                    <th>Capital USD</th>
                    <th>Interés USD</th>
                    <th>Saldo USD</th>
                    <th>Ref. Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {tablaAmortizacion.map((fila) => (
                    <tr key={fila.numero}>
                      <td style={{ fontWeight: 700 }}>#{fila.numero}</td>
                      <td style={{ fontWeight: 600 }}>${fila.monto.toFixed(2)}</td>
                      <td style={{ color: '#0F6E56' }}>${fila.capital.toFixed(2)}</td>
                      <td style={{ color: 'var(--naranja-600)' }}>${fila.interes.toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>${fila.saldo.toFixed(2)}</td>
                      <td style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
                        {(fila.monto * rateBCV).toLocaleString('es-VE', { maximumFractionDigits: 0 })}
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
          max-width: 1200px;
          margin: 0 auto;
        }
        .grid-financiamiento-admin {
          display: grid;
          grid-template-columns: 460px 1fr;
          gap: var(--space-xl);
          align-items: start;
        }
        @media (max-width: 980px) {
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
          max-height: 520px;
          overflow-y: auto;
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-md);
        }
        .tabla-amortizacion {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: right;
        }
        .tabla-amortizacion th,
        .tabla-amortizacion td {
          padding: 8px 10px;
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
