import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { mockUsuario } from './mocks/usuario';
import type { UsuarioData } from './mocks/usuario';
import { mockCredito } from './mocks/credito';
import type { CreditoData } from './mocks/credito';
import { BarraNavegacion } from './components/BarraNavegacion';
import { ProveedorFavoritos } from './state/favoritos';
import { C0_Home } from './screens/C0_Home';
import { C1_Catalogo } from './screens/C1_Catalogo';
import { C2_FichaVehiculo } from './screens/C2_FichaVehiculo';
import { C3_VendeTuAuto } from './screens/C3_VendeTuAuto';
import { C4_OnboardingKYC } from './screens/C4_OnboardingKYC';
import { C5_SolicitudFinanciamiento } from './screens/C5_SolicitudFinanciamiento';
import { C6_MiPanel } from './screens/C6_MiPanel';
import { C7_Favoritos } from './screens/C7_Favoritos';
import { C8_Suscripcion } from './screens/C8_Suscripcion';
import { C9_SolicitudCredito } from './screens/C9_SolicitudCredito';

function App() {
  // Global Simulation States
  const [rateBCV, setRateBCV] = useState(36.50);
  const [usuario, setUsuario] = useState<UsuarioData>(mockUsuario);
  const [activeCredit, setActiveCredit] = useState<CreditoData | null>(null);
  const [creditMoraToggle, setCreditMoraToggle] = useState(false);
  const [, setCreditApproved] = useState(false);
  
  // Demo Panel Collapsed State
  const [demoCollapsed, setDemoCollapsed] = useState(false);

  // Sync KYC level between states
  const setKycLevel = (level: 'básico' | 'verificado') => {
    setUsuario((prev) => ({ ...prev, kycLevel: level }));
  };

  const handleToggleCredit = (status: 'none' | 'mock') => {
    if (status === 'none') {
      setActiveCredit(null);
    } else {
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
  };

  return (
    <BrowserRouter>
      <ProveedorFavoritos>
      <div className="app-container">
        {/* Navigation Header */}
        <BarraNavegacion kycLevel={usuario.kycLevel} />

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<C0_Home rateBCV={rateBCV} />} />
            <Route path="/catalogo" element={<C1_Catalogo rateBCV={rateBCV} />} />
            <Route path="/favoritos" element={<C7_Favoritos rateBCV={rateBCV} />} />
            <Route path="/suscripcion" element={<C8_Suscripcion rateBCV={rateBCV} />} />
            <Route path="/solicitud-credito" element={<C9_SolicitudCredito rateBCV={rateBCV} />} />
            <Route path="/vehiculo/:id" element={<C2_FichaVehiculo rateBCV={rateBCV} />} />
            <Route path="/vender" element={<C3_VendeTuAuto rateBCV={rateBCV} />} />
            <Route
              path="/onboarding"
              element={
                <C4_OnboardingKYC
                  setKycLevel={setKycLevel}
                  usuario={usuario}
                  setUsuario={setUsuario}
                />
              }
            />
            <Route
              path="/financiamiento"
              element={
                <C5_SolicitudFinanciamiento
                  kycLevel={usuario.kycLevel}
                  setCreditApproved={setCreditApproved}
                  rateBCV={rateBCV}
                />
              }
            />
            <Route
              path="/panel"
              element={
                <C6_MiPanel
                  rateBCV={rateBCV}
                  activeCredit={activeCredit}
                  setActiveCredit={setActiveCredit}
                  creditMoraToggle={creditMoraToggle}
                />
              }
            />
          </Routes>
        </main>

        {/* Demo Control Panel (Floats on bottom right) */}
        <div className={`demo-control-panel ${demoCollapsed ? 'collapsed' : ''}`}>
          {demoCollapsed ? (
            <div onClick={() => setDemoCollapsed(false)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⚙️
            </div>
          ) : (
            <>
              <div className="demo-header" onClick={() => setDemoCollapsed(true)}>
                <span>🛠️ Panel de Simulación</span>
                <span>▼</span>
              </div>
              <div className="demo-body">
                <div className="demo-section-title">Usuario & KYC</div>
                <div className="demo-row">
                  <span>Nivel KYC:</span>
                  <div className="demo-btn-group">
                    <button
                      className={`demo-btn ${usuario.kycLevel === 'básico' ? 'active' : ''}`}
                      onClick={() => setKycLevel('básico')}
                    >
                      Básico
                    </button>
                    <button
                      className={`demo-btn ${usuario.kycLevel === 'verificado' ? 'active' : ''}`}
                      onClick={() => setKycLevel('verificado')}
                    >
                      Verificado
                    </button>
                  </div>
                </div>

                <div className="demo-section-title">Crédito & Pagos</div>
                <div className="demo-row">
                  <span>Crédito Activo:</span>
                  <div className="demo-btn-group">
                    <button
                      className={`demo-btn ${activeCredit === null ? 'active' : ''}`}
                      onClick={() => handleToggleCredit('none')}
                    >
                      Ninguno
                    </button>
                    <button
                      className={`demo-btn ${activeCredit !== null ? 'active' : ''}`}
                      onClick={() => handleToggleCredit('mock')}
                    >
                      Activo
                    </button>
                  </div>
                </div>

                <div className="demo-row">
                  <span>Mora Cuota 3:</span>
                  <div className="demo-btn-group">
                    <button
                      className={`demo-btn ${!creditMoraToggle ? 'active' : ''}`}
                      onClick={() => setCreditMoraToggle(false)}
                    >
                      Normal
                    </button>
                    <button
                      className={`demo-btn ${creditMoraToggle ? 'active' : ''}`}
                      onClick={() => setCreditMoraToggle(true)}
                    >
                      Mora
                    </button>
                  </div>
                </div>

                <div className="demo-section-title">Tasa de Cambio BCV</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Bs/USD:</span>
                    <span>{rateBCV.toFixed(2)} Bs.</span>
                  </div>
                  <input
                    type="range"
                    min="35.00"
                    max="45.00"
                    step="0.10"
                    value={rateBCV}
                    onChange={(e) => setRateBCV(parseFloat(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--naranja-500)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </ProveedorFavoritos>
    </BrowserRouter>
  );
}

export default App;
