import React, { useState, useMemo } from 'react';
import { useVehiculos } from '../../state/vehiculosContexto';
import { Boton } from '../../components/Boton';
import { PARAMETROS_FINANCIAMIENTO, calcularCuota, generarAmortizacion } from '../../mocks/financiamiento';
import { actualizarParametrosFinanciamiento } from '../../services/parametrosFinanciamiento';
import { mensajeDeError } from '../../api/cliente';
import { useParametros } from '../../state/parametrosContexto';
import { useSesion } from '../../state/sesionContexto';

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

export const O6_FinanciamientoBackoffice: React.FC<O6FinanciamientoBackofficeProps> = ({
  rateBCV: _rateBCV,
}) => {
  const { vehiculos } = useVehiculos();
  const {
    parametros: parametrosBackend,
    cargando: cargandoParametros,
    recargar: recargarParametros,
    fijar: fijarParametros,
  } = useParametros();
  const { puede, estado: estadoSesion } = useSesion();
  // Con servidor, sin la política oficial esta pantalla sigue sirviendo para estructurar, pero sus cifras no son las
  // vigentes y no deben ofrecerse a un cliente.
  const sinParametrosOficiales = !parametrosBackend && !cargandoParametros;

  // Cotizar no da permiso para cambiar la política de toda la plataforma (D-14, D-26).
  const puedeEditarParametros = estadoSesion === 'sin_servidor' || puede('parametros.gestionar');

  const [mostrarGestionParametros, setMostrarGestionParametros] = useState(false);
  const [guardandoParametros, setGuardandoParametros] = useState(false);
  const [mensajeParametros, setMensajeParametros] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const [cfgTasaMensual, setCfgTasaMensual] = useState<number>(4.0);
  const [cfgPlazoMeses, setCfgPlazoMeses] = useState<number>(24);
  const [cfgRatioCapacidad, setCfgRatioCapacidad] = useState<number>(30);
  const [cfgInicialMinima, setCfgInicialMinima] = useState<number>(20);

  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState<string>(
    vehiculos[0]?.id || '',
  );
  const [precioPersonalizado, setPrecioPersonalizado] = useState<number>(8000);
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefonoCliente, setTelefonoCliente] = useState<string>('');

  // La inicial arranca en el mínimo vigente (20 %, decisión del PO).
  const [porcentajeInicial, setPorcentajeInicial] = useState<number>(
    Math.round(PARAMETROS_FINANCIAMIENTO.inicialPorcentaje * 100),
  );
  const [plazoMeses, setPlazoMeses] = useState<number>(24);
  const [tasaMensualPct, setTasaMensualPct] = useState<number>(4.0);

  // Sincronizar selección inicial cuando los vehículos cargan asíncronamente desde el backend.
  // Se ajusta durante el render, con guarda (patrón de React para derivar estado de props).
  if (!vehiculoSeleccionadoId && vehiculos.length > 0) {
    setVehiculoSeleccionadoId(vehiculos[0].id);
    setPrecioPersonalizado(vehiculos[0].precio);
  }

  // Sincronizar campos de cotización con parámetros activos del backend al recibirlos
  const [parametrosSincronizados, setParametrosSincronizados] = useState(false);

  if (parametrosBackend && !parametrosSincronizados) {
    const tasaPct = +(parametrosBackend.tasaMensual * 100).toFixed(2);
    const inicialPct = Math.round(parametrosBackend.inicialMinima * 100);
    setParametrosSincronizados(true);
    setPorcentajeInicial(inicialPct);
    setPlazoMeses(parametrosBackend.plazoMeses);
    setTasaMensualPct(tasaPct);

    setCfgTasaMensual(tasaPct);
    setCfgPlazoMeses(parametrosBackend.plazoMeses);
    setCfgRatioCapacidad(Math.round(parametrosBackend.ratioCuotaIngreso * 100));
    setCfgInicialMinima(inicialPct);
  }

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

  // Ratios de capacidad (30% del ingreso según Constitución WAMMA o parametrizado en BD)
  const ratioCapacidad = parametrosBackend
    ? parametrosBackend.ratioCuotaIngreso
    : PARAMETROS_FINANCIAMIENTO.porcentajeCapacidadPago;
  const capacidadPagoDisponible = (ingresoMensualEUR || 0) * ratioCapacidad;
  const ratioCuotaIngreso =
    ingresoMensualEUR > 0 ? (cuotaMensualEUR / ingresoMensualEUR) * 100 : 0;

  const guardarParametrosBd = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoParametros(true);
    setMensajeParametros(null);
    try {
      const payload = {
        tasa_mensual: Number((cfgTasaMensual / 100).toFixed(4)),
        plazo_meses: 24, // D-55: el servidor no admite otro plazo
        ratio_cuota_ingreso: Number((cfgRatioCapacidad / 100).toFixed(2)),
        opciones_inicial: [
          Number((cfgInicialMinima / 100).toFixed(2)),
          Number(((cfgInicialMinima + 10) / 100).toFixed(2)),
          Number(((cfgInicialMinima + 20) / 100).toFixed(2)),
        ],
        inicial_minima: Number((cfgInicialMinima / 100).toFixed(2)),
        moneda_base: 'EUR',
      };
      // El servidor devuelve la política ya vigente: es la que pasa a regir en toda la aplicación, sin releerla.
      const vigentes = await actualizarParametrosFinanciamiento(payload);
      fijarParametros(vigentes);
      setTasaMensualPct(cfgTasaMensual);
      setPlazoMeses(cfgPlazoMeses);
      setPorcentajeInicial(cfgInicialMinima);
      setMensajeParametros({
        tipo: 'exito',
        texto: '✓ Parámetros actualizados exitosamente en la base de datos y registrados en auditoría inmutable.',
      });
      setTimeout(() => setMensajeParametros(null), 5000);
    } catch (err: unknown) {
      setMensajeParametros({
        tipo: 'error',
        texto: mensajeDeError(err, 'Error al guardar los parámetros'),
      });
    } finally {
      setGuardandoParametros(false);
    }
  };

  const copiarPropuestaWhatsApp = () => {
    const vehiculoTitulo =
      vehiculoSeleccionadoId === 'personalizado'
        ? 'Vehículo Personalizado'
        : `${vehiculo?.marca} ${vehiculo?.modelo} ${vehiculo?.version} (${vehiculo?.anio})`;

    const texto = `*PROPUESTA DE FINANCIAMIENTO WAMMA* 🚗
${nombreCliente ? `*Cliente:* ${nombreCliente}\n` : ''}
*Vehículo:* ${vehiculoTitulo}
*Precio de Venta:* ${formatoEUR(precio)}
----------------------------------
*Inicial (${porcentajeInicial}%):* ${formatoEUR(inicialEUR)}
*Monto Financiado:* ${formatoEUR(montoFinanciado)}
*Plazo:* ${plazoMeses} meses
*Tasa Mensual:* ${tasaMensualPct}%
*Cuota Mensual Fija:* *${formatoEURDecimal(cuotaMensualEUR)}*
----------------------------------
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {puedeEditarParametros && (
            <Boton
              variant="secondary"
              onClick={() => setMostrarGestionParametros(!mostrarGestionParametros)}
            >
              ⚙️ {mostrarGestionParametros ? 'Ocultar Parámetros BD' : 'Parámetros del Sistema (BD)'}
            </Boton>
          )}
          <Boton variant="primary" onClick={copiarPropuestaWhatsApp} disabled={sinParametrosOficiales}>
            {copiado ? '✓ ¡Copiado al Portapapeles!' : '📋 Copiar Propuesta para WhatsApp'}
          </Boton>
        </div>
      </div>

      {sinParametrosOficiales && (
        <div
          role="alert"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-md)',
            backgroundColor: '#FFF7ED',
            border: '1px solid #FDBA74',
            color: 'var(--naranja-700)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            fontSize: '13px',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <span>
            <strong>No se pudieron leer los parámetros oficiales.</strong> Las cifras de esta pantalla son solo de
            trabajo: no se puede copiar una propuesta para el cliente hasta que carguen.
          </span>
          <Boton variant="secondary" size="small" onClick={() => void recargarParametros()}>
            Reintentar
          </Boton>
        </div>
      )}

      {mostrarGestionParametros && (
        <form onSubmit={guardarParametrosBd} className="tarjeta-blanca" style={{ marginBottom: 'var(--space-xl)', border: '2px solid var(--naranja-400)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 className="panel-titulo" style={{ margin: 0, color: 'var(--naranja-600)' }}>
                ⚙️ Configuración Oficial de Financiamiento (Base de Datos)
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
                Tabla parametros_financiamiento · Los cambios se aplican de inmediato en la vitrina, el cotizador y la ficha técnica.
              </span>
            </div>
            {cargandoParametros && <span style={{ fontSize: '12px', color: 'var(--naranja-600)' }}>Sincronizando...</span>}
          </div>

          {mensajeParametros && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '14px',
              backgroundColor: mensajeParametros.tipo === 'exito' ? '#E8F5E9' : '#FFEBEE',
              color: mensajeParametros.tipo === 'exito' ? '#2E7D32' : '#C62828',
              fontSize: '13px',
              fontWeight: 600,
            }}>
              {mensajeParametros.texto}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="campo-item">
              <label htmlFor="o6-cfg-tasa">Tasa Mensual Oficial (%)</label>
              <input
                id="o6-cfg-tasa"
                type="number"
                step="0.01"
                min="0.1"
                max="20"
                value={cfgTasaMensual}
                onChange={(e) => setCfgTasaMensual(Number(e.target.value))}
                required
              />
            </div>
            <div className="campo-item">
              <label htmlFor="o6-cfg-plazo">Plazo Oficial (meses)</label>
              {/* D-55: 24 meses, como mínimo y como máximo; el servidor no admite otro plazo. */}
              <input id="o6-cfg-plazo" type="number" value={24} readOnly aria-readonly="true" title="Fijo por decisión del PO (D-55)" />
            </div>
            <div className="campo-item">
              <label htmlFor="o6-cfg-ratio">Ratio Cuota / Ingreso (%)</label>
              <input
                id="o6-cfg-ratio"
                type="number"
                step="1"
                min="5"
                max="60"
                value={cfgRatioCapacidad}
                onChange={(e) => setCfgRatioCapacidad(Number(e.target.value))}
                required
              />
            </div>
            <div className="campo-item">
              <label htmlFor="o6-cfg-inicial">Inicial Mínima Oficial (%)</label>
              <input
                id="o6-cfg-inicial"
                type="number"
                step="1"
                min="5"
                max="90"
                value={cfgInicialMinima}
                onChange={(e) => setCfgInicialMinima(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
            <Boton
              type="button"
              variant="secondary"
              onClick={() => {
                if (parametrosBackend) {
                  setCfgTasaMensual(+(parametrosBackend.tasaMensual * 100).toFixed(2));
                  setCfgPlazoMeses(parametrosBackend.plazoMeses);
                  setCfgRatioCapacidad(Math.round(parametrosBackend.ratioCuotaIngreso * 100));
                  setCfgInicialMinima(Math.round(parametrosBackend.inicialMinima * 100));
                }
                setMostrarGestionParametros(false);
              }}
            >
              Cancelar
            </Boton>
            <Boton type="submit" variant="primary" disabled={guardandoParametros}>
              {guardandoParametros ? 'Guardando en BD...' : '💾 Guardar Parámetros en Base de Datos'}
            </Boton>
          </div>
        </form>
      )}

      <div className="grid-financiamiento-admin">
        {/* Columna Izquierda: Parámetros */}
        <div className="panel-parametros">
          <div className="tarjeta-blanca">
            <h2 className="panel-titulo">1. Selección de Vehículo y Cliente</h2>

            <div className="campo-item">
              <label htmlFor="o6-vehiculo">Vehículo del Inventario</label>
              <select
                id="o6-vehiculo"
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
                <label htmlFor="o6-precio">Precio del Vehículo (EUR)</label>
                <input
                  id="o6-precio"
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
                <label htmlFor="o6-nombre">Nombre del Solicitante</label>
                <input
                  id="o6-nombre"
                  type="text"
                  placeholder="Ej. Juan Pérez"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                />
              </div>
              <div className="campo-item">
                <label htmlFor="o6-telefono">Teléfono WhatsApp</label>
                <input
                  id="o6-telefono"
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
                <label htmlFor="o6-inicial">Inicial Aportada ({porcentajeInicial}%)</label>
                <span style={{ fontWeight: 700, color: 'var(--naranja-600)' }}>
                  {formatoEUR(inicialEUR)}
                </span>
              </div>
              <input
                id="o6-inicial"
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
                <label htmlFor="o6-plazo">Plazo a Financiar</label>
                <select
                  id="o6-plazo"
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
                <label htmlFor="o6-tasa">Tasa Mensual (%)</label>
                <input
                  id="o6-tasa"
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
            </div>
          </div>

          <div className="tarjeta-blanca" style={{ marginTop: 'var(--space-lg)' }}>
            <h2 className="panel-titulo">3. Evaluación de Capacidad del Cliente</h2>
            <div className="grid-2-col">
              <div className="campo-item">
                <label htmlFor="o6-ingreso">Ingreso Mensual (EUR)</label>
                <input
                  id="o6-ingreso"
                  type="number"
                  step="50"
                  min="0"
                  value={ingresoMensualEUR}
                  onChange={(e) => setIngresoMensualEUR(Number(e.target.value))}
                />
              </div>
              <div className="campo-item">
                <label htmlFor="o6-gastos">Gastos Fijos (EUR)</label>
                <input
                  id="o6-gastos"
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
                  Capacidad de pago ({Math.round(ratioCapacidad * 100)} % del ingreso):
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
