import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { BarraNavegacion } from './components/BarraNavegacion';
import { ProveedorFavoritos } from './state/favoritos';
import { ProveedorVehiculos } from './state/vehiculosContexto';
import { ProveedorCRM } from './state/crm';
import { C0_Home } from './screens/C0_Home';
import { C1_Catalogo } from './screens/C1_Catalogo';
import { C2_FichaVehiculo } from './screens/C2_FichaVehiculo';
import { C7_Favoritos } from './screens/C7_Favoritos';
import { C9_SolicitudCredito } from './screens/C9_SolicitudCredito';
import { C10_Financiamiento } from './screens/C10_Financiamiento';

// Admin / Backoffice
import { AdminLayout } from './components/admin/AdminLayout';
import { O3_GestionInventario } from './screens/admin/O3_GestionInventario';
import { O3_FormularioVehiculo } from './screens/admin/O3_FormularioVehiculo';
import { O3_GestionCitas } from './screens/admin/O3_GestionCitas';
import { O6_FinanciamientoBackoffice } from './screens/admin/O6_FinanciamientoBackoffice';
import { O7_EmbudoComercial } from './screens/admin/O7_EmbudoComercial';
import { O7_Personas } from './screens/admin/O7_Personas';
import { O7_FichaPersona } from './screens/admin/O7_FichaPersona';

function AppRutas({ rateBCV }: { rateBCV: number }) {
  const location = useLocation();
  const esAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="app-container">
      {/* Navigation Header solo para la vista pública */}
      {!esAdmin && <BarraNavegacion />}

      {/* Main Content Area */}
      <main className={esAdmin ? 'main-content-admin' : 'main-content'}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<C0_Home rateBCV={rateBCV} />} />
          <Route path="/catalogo" element={<C1_Catalogo rateBCV={rateBCV} />} />
          <Route path="/favoritos" element={<C7_Favoritos rateBCV={rateBCV} />} />
          <Route path="/solicitud-credito" element={<C9_SolicitudCredito rateBCV={rateBCV} />} />
          <Route path="/financiamiento" element={<C10_Financiamiento rateBCV={rateBCV} />} />
          <Route path="/vehiculo/:id" element={<C2_FichaVehiculo rateBCV={rateBCV} />} />

          {/* Rutas Backoffice WAMMA */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/inventario" replace />} />
            <Route path="inventario" element={<O3_GestionInventario rateBCV={rateBCV} />} />
            <Route path="vehiculo/nuevo" element={<O3_FormularioVehiculo />} />
            <Route path="vehiculo/editar/:id" element={<O3_FormularioVehiculo />} />
            <Route path="citas" element={<O3_GestionCitas />} />
            <Route path="embudo" element={<O7_EmbudoComercial />} />
            <Route path="personas" element={<O7_Personas />} />
            <Route path="personas/:id" element={<O7_FichaPersona />} />
            <Route path="financiamiento" element={<O6_FinanciamientoBackoffice rateBCV={rateBCV} />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

function App() {
  // Tasa de cambio BCV oficial simulada
  const [rateBCV, setRateBCV] = useState(36.5);

  // Demo Panel Collapsed State
  const [demoCollapsed, setDemoCollapsed] = useState(false);

  return (
    <BrowserRouter>
      {/* El CRM va dentro del inventario: necesita bloquear y liberar vehículos. */}
      <ProveedorVehiculos>
        <ProveedorCRM>
          <ProveedorFavoritos>
          <AppRutas rateBCV={rateBCV} />

          {/* Demo Control Panel (Floats on bottom right) */}
          <div className={`demo-control-panel ${demoCollapsed ? 'collapsed' : ''}`}>
            {demoCollapsed ? (
              <div
                onClick={() => setDemoCollapsed(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Abrir simulador BCV"
              >
                ⚙️
              </div>
            ) : (
              <>
                <div className="demo-header" onClick={() => setDemoCollapsed(true)}>
                  <span>🛠️ Tasa Oficial BCV</span>
                  <span>▼</span>
                </div>
                <div className="demo-body">
                  <div className="demo-section-title">Ajuste Dinámico de Divisas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Tasa Bs/USD:</span>
                      <span style={{ color: 'var(--naranja-600)' }}>{rateBCV.toFixed(2)} Bs.</span>
                    </div>
                    <input
                      type="range"
                      min="35.00"
                      max="60.00"
                      step="0.10"
                      value={rateBCV}
                      onChange={(e) => setRateBCV(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--naranja-500)', cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--texto-mudo)', lineHeight: 1.3 }}>
                      Ajusta la tasa para ver reflejada la conversión oficial en el catálogo, las cuotas y el cotizador.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          </ProveedorFavoritos>
        </ProveedorCRM>
      </ProveedorVehiculos>
    </BrowserRouter>
  );
}

export default App;
