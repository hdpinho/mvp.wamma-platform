import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockCredito } from '../mocks/credito';
import type { CreditoData } from '../mocks/credito';
import { PrecioMoneda } from '../components/PrecioMoneda';
import { SelloGPS } from '../components/SelloGPS';
import { FilaAmortizacion } from '../components/FilaAmortizacion';
import type { CuotaData } from '../components/FilaAmortizacion';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';

interface C6MiPanelProps {
  rateBCV: number;
  activeCredit: CreditoData | null;
  setActiveCredit: (cred: CreditoData | null) => void;
  creditMoraToggle: boolean;
}

export const C6_MiPanel: React.FC<C6MiPanelProps> = ({
  rateBCV,
  activeCredit,
  setActiveCredit,
  creditMoraToggle,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Route state capture to activate credit from financing approval
  const routeState = location.state as {
    activateCredit?: boolean;
    vehiculoNombre?: string;
    montoFinanciado?: number;
    plazo?: number;
  } | null;

  // Payment UI States
  const [selectedCuota, setSelectedCuota] = useState<CuotaData | null>(null);
  const [banco, setBanco] = useState('0128'); // Banesco
  const [telefono, setTelefono] = useState('+58 412-1234567');
  const [cedula, setCedula] = useState('V-18456789');
  const [otp, setOtp] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  // Ledger log output for visual demo
  const [ledgerLog, setLedgerLog] = useState<{
    idempotencyKey: string;
    asiento: string;
    debe: string;
    haber: string;
    tasa: number;
  } | null>(null);

  // Initialize or activate credit
  useEffect(() => {
    if (routeState?.activateCredit && !activeCredit) {
      const p = routeState.montoFinanciado || 8000;
      const term = routeState.plazo || 12;
      const cuotaFija = (p * 0.04 * Math.pow(1.04, term)) / (Math.pow(1.04, term) - 1);
      
      const newCuotas: CuotaData[] = Array.from({ length: term }, (_, i) => {
        const num = i + 1;
        const interest = (p - (i * (p / term))) * 0.04;
        const principal = cuotaFija - interest;
        return {
          numero: num,
          vencimiento: new Date(Date.now() + num * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          capital: Math.round(principal * 100) / 100,
          interes: Math.round(interest * 100) / 100,
          monto: Math.round(cuotaFija * 100) / 100,
          estado: 'pendiente',
        };
      });

      setActiveCredit({
        id: 'cred-new',
        vehiculoId: 'veh-custom',
        vehiculoNombre: routeState.vehiculoNombre || 'Vehículo Adquirido',
        montoFinanciado: p,
        plazoMeses: term,
        tasaMensual: 0.04,
        tasaAnual: 0.48,
        cuotaFija: Math.round(cuotaFija * 100) / 100,
        deudaRestante: p,
        estado: 'activo',
        cuotas: newCuotas,
      });
    } else if (!activeCredit && routeState === null) {
      // Set the default mock credit for demonstration if no active credit exists
      setActiveCredit({
        ...mockCredito,
        cuotas: mockCredito.cuotas.map((c) => {
          if (c.numero === 3) {
            return {
              ...c,
              estado: creditMoraToggle ? 'mora' : 'pendiente',
            };
          }
          return c;
        }),
      });
    }
  }, [routeState, creditMoraToggle]);

  // Handle Mora state changes triggered from Demo Control Panel
  useEffect(() => {
    if (activeCredit) {
      const updatedCuotas = activeCredit.cuotas.map((c) => {
        if (c.numero === 3 && c.estado !== 'pagada') {
          return {
            ...c,
            estado: creditMoraToggle ? ('mora' as const) : ('pendiente' as const),
          };
        }
        return c;
      });
      
      const hasMora = updatedCuotas.some((c) => c.estado === 'mora');

      setActiveCredit({
        ...activeCredit,
        estado: hasMora ? 'mora' : 'activo',
        cuotas: updatedCuotas,
      });
    }
  }, [creditMoraToggle]);

  if (!activeCredit) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Sin Créditos Activos</h3>
        <p style={{ color: 'var(--texto-secundario)', fontSize: '14px', marginBottom: '24px' }}>
          Actualmente no posees ningún crédito registrado. Te invitamos a navegar nuestro catálogo y solicitar financiamiento.
        </p>
        <Boton variant="primary" fullWidth onClick={() => navigate('/')}>
          Ver Vitrina de Vehículos
        </Boton>
      </div>
    );
  }

  const handleOpenPayment = (cuota: CuotaData) => {
    setSelectedCuota(cuota);
    setPaymentSuccess(false);
    setLedgerLog(null);
    setOtp('');
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCuota || !otp) return;

    setIsPaying(true);

    // Simulate C2P / Pago Móvil banking clearing lag (2.5s)
    setTimeout(() => {
      // 1. GenerateContable Ledger Seat Double-Entry Mock
      const keyIdem = 'idem-' + Math.random().toString(36).substring(2, 11);
      const vesAmount = selectedCuota.monto * rateBCV;

      // Update local state credit
      const updatedCuotas = activeCredit.cuotas.map((c) => {
        if (c.numero === selectedCuota.numero) {
          return { ...c, estado: 'pagada' as const };
        }
        return c;
      });

      const nextDebt = Math.max(activeCredit.deudaRestante - selectedCuota.capital, 0);
      const hasMora = updatedCuotas.some((c) => c.estado === 'mora');

      setActiveCredit({
        ...activeCredit,
        deudaRestante: Math.round(nextDebt * 100) / 100,
        estado: hasMora ? 'mora' : 'activo',
        cuotas: updatedCuotas,
      });

      setLedgerLog({
        idempotencyKey: keyIdem,
        asiento: `AS-${Math.floor(1000 + Math.random() * 9000)}`,
        debe: `Caja/Banco (VES): +${vesAmount.toLocaleString('es-VE')} Bs.`,
        haber: `Créditos por Cobrar (VES): -${vesAmount.toLocaleString('es-VE')} Bs. (Ref: $${selectedCuota.monto} USD a tasa ${rateBCV})`,
        tasa: rateBCV,
      });

      setIsPaying(false);
      setPaymentSuccess(true);
    }, 2500);
  };

  const nextCuota = activeCredit.cuotas.find((c) => c.estado !== 'pagada');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      
      {/* Title + GPS Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>Mi Panel WAMMA</h2>
          <p style={{ color: 'var(--texto-secundario)', fontSize: '13px' }}>
            Financiamiento activo: <strong>{activeCredit.vehiculoNombre}</strong>
          </p>
        </div>
        <div>
          <SelloGPS />
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-mudo)', fontWeight: 500 }}>Deuda Restante</span>
          <div style={{ marginTop: '8px' }}>
            <PrecioMoneda amountUSD={activeCredit.deudaRestante} rateBCV={rateBCV} />
          </div>
        </div>

        <div className="card" style={{ padding: '16px', border: activeCredit.estado === 'mora' ? '1px solid var(--peligro-texto)' : '1px solid var(--borde-claro)' }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-mudo)', fontWeight: 500 }}>Próxima Cuota</span>
          <div style={{ marginTop: '8px' }}>
            {nextCuota ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <PrecioMoneda amountUSD={nextCuota.monto} rateBCV={rateBCV} />
                <span className={nextCuota.estado === 'mora' ? 'badge badge-peligro' : 'badge badge-aviso'}>
                  Vence: {nextCuota.vencimiento}
                </span>
              </div>
            ) : (
              <strong style={{ color: 'var(--exito-texto)' }}>Crédito Cancelado</strong>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '12px', color: 'var(--texto-mudo)', fontWeight: 500 }}>Condiciones</span>
          <div style={{ marginTop: '8px' }}>
            <p style={{ fontSize: '16px', fontWeight: 700 }}>{activeCredit.tasaAnual * 100}% Anual</p>
            <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>Plazo: {activeCredit.plazoMeses} meses</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Amortization Schedule vs Payment Form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-lg)' }} className="panel-grid">
        
        {/* Amortization Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Tabla de Amortización</h3>
          <div className="table-container">
            <table className="wamma-table">
              <thead>
                <tr>
                  <th>Cuota</th>
                  <th>Vence</th>
                  <th>Composición</th>
                  <th>Monto (USD)</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {activeCredit.cuotas.map((cuota) => (
                  <FilaAmortizacion
                    key={cuota.numero}
                    cuota={cuota}
                    onPagar={handleOpenPayment}
                    rateBCV={rateBCV}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Area Overlay or Side Panel */}
        {selectedCuota && (
          <div className="card" style={{ border: '2px solid var(--naranja-500)', height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--borde-claro)', paddingBottom: '8px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px' }}>Pasarela C2P / Pago Móvil — Cuota #{selectedCuota.numero}</h3>
              <Boton variant="text" onClick={() => setSelectedCuota(null)} style={{ padding: 0, fontSize: '18px', fontWeight: 700 }}>✕</Boton>
            </div>

            {!paymentSuccess ? (
              <form onSubmit={handlePaySubmit}>
                <div style={{ backgroundColor: 'var(--superficie)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Cuota #{selectedCuota.numero}:</span>
                    <strong>${selectedCuota.monto} USD</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--borde-claro)', paddingTop: '4px', marginTop: '4px' }}>
                    <span>Conversión VES:</span>
                    <strong>{(selectedCuota.monto * rateBCV).toLocaleString('es-VE')} Bs.</strong>
                  </div>
                </div>

                <Campo
                  label="Banco Destino"
                  type="select"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  options={[
                    { value: '0128', label: 'Banesco Banco Universal' },
                    { value: '0105', label: 'Banco Mercantil' },
                    { value: '0108', label: 'Banco Provincial' },
                    { value: '0102', label: 'Banco de Venezuela' },
                  ]}
                />

                <Campo
                  label="Teléfono Celular Emisor"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  required
                />

                <Campo
                  label="Cédula del Titular"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  required
                />

                <Campo
                  label="Clave de Pago Móvil / Token SMS (C2P)"
                  placeholder="Ej. 123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />

                <Boton type="submit" variant="primary" fullWidth loading={isPaying} style={{ marginTop: '8px' }}>
                  Procesar Pago
                </Boton>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--exito-fondo)', color: 'var(--exito-texto)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', fontSize: '20px' }}>✓</div>
                <h4 style={{ color: 'var(--exito-texto)', marginBottom: '8px' }}>¡Pago Procesado Exitosamente!</h4>
                <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginBottom: '16px' }}>
                  La cuota #{selectedCuota.numero} ha sido registrada como Pagada en el sistema.
                </p>

                {/* Double entry seat description */}
                {ledgerLog && (
                  <div style={{ textAlign: 'left', backgroundColor: 'var(--superficie)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '10px', fontFamily: 'monospace', color: 'var(--texto-secundario)', border: '1px solid var(--borde)' }}>
                    <div style={{ fontWeight: 700, borderBottom: '1px solid var(--borde)', paddingBottom: '4px', marginBottom: '6px', fontSize: '11px', fontFamily: 'var(--font-sans)' }}>
                      📖 Registro en Libro Contable (Ledger)
                    </div>
                    <div><strong>Idempotencia:</strong> {ledgerLog.idempotencyKey}</div>
                    <div><strong>Nro Asiento:</strong> {ledgerLog.asiento} (Partida Doble)</div>
                    <div style={{ margin: '4px 0' }}>
                      <div style={{ color: 'var(--exito-texto)' }}><strong>[DEBE]</strong> {ledgerLog.debe}</div>
                      <div style={{ color: 'var(--naranja-700)' }}><strong>[HABER]</strong> {ledgerLog.haber}</div>
                    </div>
                    <div>Tasa BCV del día: {ledgerLog.tasa.toFixed(2)} Bs/USD</div>
                  </div>
                )}

                <Boton variant="secondary" onClick={() => setSelectedCuota(null)} fullWidth style={{ marginTop: '16px' }}>
                  Cerrar
                </Boton>
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`
        @media (min-width: 1025px) {
          .panel-grid {
            grid-template-columns: ${selectedCuota ? '2fr 1fr' : '1fr'} !important;
          }
        }
      `}</style>
    </div>
  );
};
