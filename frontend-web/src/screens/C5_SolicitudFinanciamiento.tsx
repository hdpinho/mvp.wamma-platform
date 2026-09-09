import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mockVehiculos } from '../mocks/vehiculos';
import { Campo } from '../components/Campo';
import { Boton } from '../components/Boton';
import { PrecioMoneda } from '../components/PrecioMoneda';
import { FotoVehiculo } from '../components/FotoVehiculo';
import { calcularCuota } from '../mocks/financiamiento';

interface C5SolicitudFinanciamientoProps {
  kycLevel: 'básico' | 'verificado';
  setCreditApproved: (approved: boolean) => void;
  rateBCV: number;
}

export const C5_SolicitudFinanciamiento: React.FC<C5SolicitudFinanciamientoProps> = ({
  kycLevel,
  setCreditApproved,
  rateBCV,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get passed data from route transition if available
  const stateData = location.state as {
    vehiculoId?: string;
    montoFinanciado?: number;
    plazo?: number;
    cuotaInicialUSD?: number;
  } | null;

  // Selected Vehicle
  const [selectedVehiculoId, setSelectedVehiculoId] = useState(stateData?.vehiculoId || mockVehiculos[0].id);
  const [montoFinanciado, setMontoFinanciado] = useState(stateData?.montoFinanciado || 5000);
  const [plazo, setPlazo] = useState(stateData?.plazo || 12);

  // Form Fields
  const [actividad, setActividad] = useState('empleado');
  const [ingresos, setIngresos] = useState('');
  const [antiguedad, setAntiguedad] = useState('1');

  // Simulation Status
  const [stage, setStage] = useState<'form' | 'scoring' | 'aml' | 'decision'>('form');
  const [scoringValue, setScoringValue] = useState(680); // Default good score

  const selectedVeh = mockVehiculos.find((v) => v.id === selectedVehiculoId) || mockVehiculos[0];

  /**
   * Al cambiar de vehículo se recalcula el monto por defecto (60% del precio),
   * salvo que el monto haya llegado desde la ficha. Se hace aquí y no en un
   * efecto para no encadenar renders.
   */
  const cambiarVehiculo = (id: string) => {
    setSelectedVehiculoId(id);
    if (!stateData?.montoFinanciado) {
      const veh = mockVehiculos.find((v) => v.id === id);
      if (veh) setMontoFinanciado(Math.round(veh.precioUSD * 0.6));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingresos) return;

    setStage('scoring');

    // Step 1: Simulate Bureau Scoring check (Access Datametrics)
    setTimeout(() => {
      // Calculate a mock score based on declared income
      const incomeNum = Number(ingresos);
      let score = 400; // base poor score
      if (incomeNum > 1000) score = 710;
      else if (incomeNum > 500) score = 610;
      else if (incomeNum > 300) score = 510;

      setScoringValue(score);
      setStage('aml');

      // Step 2: Simulate AML screening (OFAC / PEP lists)
      setTimeout(() => {
        setStage('decision');
        if (score >= 500) {
          setCreditApproved(true);
        } else {
          setCreditApproved(false);
        }
      }, 1500);
    }, 2000);
  };

  const handleGenerateCredit = () => {
    // Navigate to Mi Panel (C6) and simulate activating the credit
    navigate('/panel', {
      state: {
        activateCredit: true,
        vehiculoNombre: `${selectedVeh.marca} ${selectedVeh.modelo}`,
        montoFinanciado,
        plazo,
      },
    });
  };

  // If user is not KYC-verified, enforce KYC step
  if (kycLevel === 'básico') {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Verificación KYC Requerida</h3>
        <p style={{ color: 'var(--texto-secundario)', fontSize: '14px', marginBottom: '24px' }}>
          De acuerdo a las normas de prevención de legitimación de capitales de Sudeban, debes verificar tu identidad antes de solicitar crédito.
        </p>
        <Boton variant="primary" fullWidth onClick={() => navigate('/onboarding')}>
          Iniciar Verificación de Identidad
        </Boton>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Solicitud de Financiamiento WAMMA</h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: '13px', marginTop: '4px' }}>
          Completa tu perfil financiero para evaluar tu capacidad de pago.
        </p>
      </div>

      {stage === 'form' && (
        <form onSubmit={handleSubmit} className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', borderBottom: '1px solid var(--borde-claro)', paddingBottom: '8px' }}>
            1. Vehículo y Financiamiento
          </h3>

          {/*
            Resumen de lo que llegó desde la ficha del vehículo. Confirma al
            usuario que su selección y su simulación se arrastraron hasta aquí.
          */}
          {stateData?.vehiculoId && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr',
                gap: 'var(--space-lg)',
                alignItems: 'center',
                backgroundColor: 'var(--naranja-50)',
                border: '1px solid var(--naranja-200)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                marginBottom: 'var(--space-lg)',
              }}
            >
              <FotoVehiculo vehiculo={selectedVeh} alto={72} redondeo="var(--radius-sm)" />
              <div style={{ display: 'grid', gap: '2px', fontSize: '13px' }}>
                <strong style={{ fontSize: '15px' }}>
                  {selectedVeh.marca} {selectedVeh.modelo} {selectedVeh.anio}
                </strong>
                <span style={{ color: 'var(--texto-secundario)' }}>
                  {selectedVeh.version} · {selectedVeh.sede}
                </span>
                <span style={{ color: 'var(--texto-secundario)' }}>
                  Precio ${selectedVeh.precioUSD.toLocaleString('en-US')}
                  {typeof stateData.cuotaInicialUSD === 'number' && (
                    <> · Inicial ${stateData.cuotaInicialUSD.toLocaleString('en-US')}</>
                  )}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--naranja-700)' }}>
                  Cuota estimada ${Math.round(calcularCuota(montoFinanciado, plazo)).toLocaleString('en-US')} /mes
                </span>
              </div>
            </div>
          )}

          <Campo
            label="Vehículo Seleccionado"
            type="select"
            value={selectedVehiculoId}
            onChange={(e) => cambiarVehiculo(e.target.value)}
            options={mockVehiculos.map((v) => ({
              value: v.id,
              label: `${v.marca} ${v.modelo} (${v.anio}) — $${v.precioUSD.toLocaleString()} USD`,
            }))}
            disabled={!!stateData?.vehiculoId}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Campo
              label="Monto a Financiar (USD)"
              type="number"
              value={montoFinanciado}
              onChange={(e) => setMontoFinanciado(Number(e.target.value))}
              max={selectedVeh.precioUSD}
              required
            />
            <Campo
              label="Plazo (Meses)"
              type="select"
              value={plazo}
              onChange={(e) => setPlazo(Number(e.target.value))}
              options={[
                { value: '6', label: '6 Meses' },
                { value: '12', label: '12 Meses' },
                { value: '18', label: '18 Meses' },
                { value: '24', label: '24 Meses' },
              ]}
            />
          </div>

          <h3 style={{ fontSize: '16px', margin: '20px 0 16px 0', borderBottom: '1px solid var(--borde-claro)', paddingBottom: '8px' }}>
            2. Perfil de Ingresos y Empleo
          </h3>

          <Campo
            label="Actividad Económica"
            type="select"
            value={actividad}
            onChange={(e) => setActividad(e.target.value)}
            options={[
              { value: 'empleado', label: 'Empleado (Empresa Pública o Privada)' },
              { value: 'independiente', label: 'Profesional Independiente / Autoempleo' },
              { value: 'empresario', label: 'Empresario / Dueño de Negocio' },
            ]}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Campo
              label="Ingreso Mensual Declarado (USD)"
              type="number"
              placeholder="Ej. 600"
              value={ingresos}
              onChange={(e) => setIngresos(e.target.value)}
              required
            />
            <Campo
              label="Antigüedad Laboral (Años)"
              type="select"
              value={antiguedad}
              onChange={(e) => setAntiguedad(e.target.value)}
              options={[
                { value: '0.5', label: 'Menos de 1 año' },
                { value: '1', label: '1 a 2 años' },
                { value: '3', label: '3 a 5 años' },
                { value: '5', label: 'Más de 5 años' },
              ]}
            />
          </div>

          <Boton type="submit" variant="primary" fullWidth style={{ marginTop: '16px' }}>
            Evaluar Solicitud de Crédito
          </Boton>
        </form>
      )}

      {stage === 'scoring' && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ animation: 'spin 1.5s linear infinite', fontSize: '48px', width: '64px', height: '64px', margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🌀
          </div>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Consultando Score de Crédito...</h3>
          <p style={{ color: 'var(--texto-secundario)', fontSize: '13px' }}>
            Estableciendo conexión segura con Access Datametrics (Credicard)...
          </p>
        </div>
      )}

      {stage === 'aml' && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ animation: 'pulse 1s infinite', fontSize: '48px', width: '64px', height: '64px', margin: '0 auto 24px auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🔍
          </div>
          <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Screening de Cumplimiento & AML</h3>
          <p style={{ color: 'var(--texto-secundario)', fontSize: '13px' }}>
            Verificando antecedentes en listas de control internacional (OFAC / PEP Venezuela)...
          </p>
        </div>
      )}

      {stage === 'decision' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Decision Box */}
          {scoringValue >= 500 ? (
            <div className="card" style={{ border: '2px solid var(--exito-texto)', textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--exito-texto)' }}>🎉</div>
              <h3 style={{ color: 'var(--exito-texto)', fontSize: '22px', marginBottom: '8px' }}>
                ¡Financiamiento Aprobado!
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', marginBottom: '24px' }}>
                Felicidades. Tu perfil califica para nuestra opción de financiamiento indexado.
              </p>

              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: 'var(--superficie)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  marginBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Vehículo:</span>
                  <strong>{selectedVeh.marca} {selectedVeh.modelo}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Monto Financiado:</span>
                  <strong>${montoFinanciado.toLocaleString()} USD</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Plazo:</span>
                  <strong>{plazo} meses</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tasa de Interés:</span>
                  <strong>48% anual (4% mensual)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--borde)', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Cuota Mensual Est.:</span>
                  <strong>
                    <PrecioMoneda
                      amountUSD={(montoFinanciado * 0.04 * Math.pow(1.04, plazo)) / (Math.pow(1.04, plazo) - 1)}
                      rateBCV={rateBCV}
                      showSubtitle={false}
                    />
                  </strong>
                </div>
              </div>

              {/* AML and Scoring audit details */}
              <div style={{ fontSize: '11px', color: 'var(--texto-mudo)', textAlign: 'left', marginBottom: '24px', backgroundColor: 'var(--blanco)', border: '1px solid var(--borde-claro)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div><strong>Verificación de Crédito (Access Datametrics):</strong> Aprobada (Score: {scoringValue} pts)</div>
                <div><strong>Screening de Lavado de Activos (AML/CFT):</strong> Conforme (Cero coincidencias OFAC/PEP)</div>
                <div><strong>Registro de Auditoría (UUID):</strong> {crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : 'e82b71ab'}</div>
              </div>

              <Boton variant="primary" fullWidth onClick={handleGenerateCredit}>
                Generar Crédito e ir a mi Panel
              </Boton>
            </div>
          ) : (
            <div className="card" style={{ border: '2px solid var(--peligro-texto)', textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', color: 'var(--peligro-texto)' }}>❌</div>
              <h3 style={{ color: 'var(--peligro-texto)', fontSize: '22px', marginBottom: '8px' }}>
                Solicitud Declinada
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', marginBottom: '24px' }}>
                Lo sentimos, tu perfil crediticio no califica para esta solicitud en este momento de acuerdo con nuestros parámetros de riesgo.
              </p>

              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: 'var(--superficie)',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  marginBottom: '24px',
                }}
              >
                <div><strong>Motivo principal:</strong> Capacidad de pago insuficiente o Score crediticio por debajo del umbral mínimo requerido ({scoringValue} pts obtenientes vs 500 pts exigidos).</div>
              </div>

              <Boton variant="primary" onClick={() => setStage('form')} fullWidth>
                Intentar Nuevamente (Modificar Ingresos)
              </Boton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
