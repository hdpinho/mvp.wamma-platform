import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import './App.css';
import { apiConfigurada } from './api/cliente';
import { BarraNavegacion } from './components/BarraNavegacion';
import { ProveedorFavoritos } from './state/favoritos';
import { ProveedorVehiculos } from './state/vehiculos';
import { useVehiculos } from './state/vehiculosContexto';
import { ProveedorCRM } from './state/crm';
import { ProveedorSesion } from './state/sesion';
import { C0_Home } from './screens/C0_Home';
import { C1_Catalogo } from './screens/C1_Catalogo';
import { C2_FichaVehiculo } from './screens/C2_FichaVehiculo';
import { C7_Favoritos } from './screens/C7_Favoritos';
import { C9_SolicitudCredito } from './screens/C9_SolicitudCredito';
import { C10_Financiamiento } from './screens/C10_Financiamiento';

// Admin / Backoffice
import { AdminLayout } from './components/admin/AdminLayout';
import { InicioAdmin, RequierePermiso, RequiereSesion } from './components/admin/Guardas';
import { PERMISOS_CRM } from './components/admin/menu';
import { O1_Ingreso } from './screens/admin/O1_Ingreso';
import { O1_Usuarios } from './screens/admin/O1_Usuarios';
import { O1_Bitacora } from './screens/admin/O1_Bitacora';
import { O1_MiCuenta } from './screens/admin/O1_MiCuenta';
import { O1_AcercaDe } from './screens/admin/O1_AcercaDe';
import { O3_GestionInventario } from './screens/admin/O3_GestionInventario';
import { O3_FormularioVehiculo } from './screens/admin/O3_FormularioVehiculo';
import { O3_GestionCitas } from './screens/admin/O3_GestionCitas';
import { O4_TasaBcv } from './screens/admin/O4_TasaBcv';
import { O6_FinanciamientoBackoffice } from './screens/admin/O6_FinanciamientoBackoffice';
import { O7_EmbudoComercial } from './screens/admin/O7_EmbudoComercial';
import { O7_Personas } from './screens/admin/O7_Personas';
import { O7_FichaPersona } from './screens/admin/O7_FichaPersona';

function AppRutas({ rateBCV }: { rateBCV: number }) {
  const location = useLocation();
  const esAdmin = location.pathname.startsWith('/admin');

  return (
    <div className={`app-container ${esAdmin ? 'app-container-admin' : ''}`}>
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
          <Route path="/acerca" element={<Navigate to="/admin/acerca" replace />} />

          {/* Rutas Backoffice WAMMA: todas exigen sesión (módulo 001), salvo el ingreso. */}
          <Route path="/admin/ingresar" element={<O1_Ingreso />} />
          <Route
            path="/admin"
            element={
              <RequiereSesion>
                <AdminLayout />
              </RequiereSesion>
            }
          >
            <Route index element={<InicioAdmin />} />
            <Route
              path="inventario"
              element={
                <RequierePermiso permisos={['inventario.ver']}>
                  <O3_GestionInventario rateBCV={rateBCV} />
                </RequierePermiso>
              }
            />
            <Route
              path="vehiculo/nuevo"
              element={
                <RequierePermiso permisos={['inventario.gestionar']}>
                  <O3_FormularioVehiculo />
                </RequierePermiso>
              }
            />
            <Route
              path="vehiculo/editar/:id"
              element={
                <RequierePermiso permisos={['inventario.gestionar']}>
                  <O3_FormularioVehiculo />
                </RequierePermiso>
              }
            />
            <Route
              path="citas"
              element={
                <RequierePermiso permisos={PERMISOS_CRM}>
                  <O3_GestionCitas />
                </RequierePermiso>
              }
            />
            <Route
              path="embudo"
              element={
                <RequierePermiso permisos={PERMISOS_CRM}>
                  <O7_EmbudoComercial />
                </RequierePermiso>
              }
            />
            <Route
              path="personas"
              element={
                <RequierePermiso permisos={PERMISOS_CRM}>
                  <O7_Personas />
                </RequierePermiso>
              }
            />
            <Route
              path="personas/:id"
              element={
                <RequierePermiso permisos={PERMISOS_CRM}>
                  <O7_FichaPersona />
                </RequierePermiso>
              }
            />
            <Route
              path="financiamiento"
              element={
                <RequierePermiso permisos={['cotizador.usar']}>
                  <O6_FinanciamientoBackoffice rateBCV={rateBCV} />
                </RequierePermiso>
              }
            />
            <Route
              path="tasa-bcv"
              element={
                <RequierePermiso permisos={['tasa_bcv.registrar']}>
                  <O4_TasaBcv />
                </RequierePermiso>
              }
            />
            <Route
              path="usuarios"
              element={
                <RequierePermiso permisos={['usuarios.gestionar']}>
                  <O1_Usuarios />
                </RequierePermiso>
              }
            />
            <Route
              path="bitacora"
              element={
                <RequierePermiso permisos={['auditoria.ver']}>
                  <O1_Bitacora />
                </RequierePermiso>
              }
            />
            <Route path="cuenta" element={<O1_MiCuenta />} />
            <Route path="acerca" element={<O1_AcercaDe />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

/**
 * Con servidor, la tasa BCV del euro es la que registra el backoffice (D-13). Sin servidor,
 * la maqueta la simula con el panel flotante.
 */
function Contenido() {
  const { tasa } = useVehiculos();
  const [tasaSimulada, setTasaSimulada] = useState(36.5);
  const tasaVigente = tasa?.valor ?? tasaSimulada;

  return (
    <>
      <AppRutas rateBCV={tasaVigente} />
      {!apiConfigurada && <PanelTasaDemo rateBCV={tasaSimulada} setRateBCV={setTasaSimulada} />}
    </>
  );
}

/** Simulador de la tasa BCV de la maqueta (flota abajo a la derecha). */
function PanelTasaDemo({ rateBCV, setRateBCV }: { rateBCV: number; setRateBCV: (tasa: number) => void }) {
  const location = useLocation();
  const [demoCollapsed, setDemoCollapsed] = useState(false);

  // En el ingreso al backoffice no aporta nada y tapa el formulario.
  if (location.pathname === '/admin/ingresar') return null;

  return (
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
            <span>🛠️ Tasa Euro BCV</span>
            <span>▼</span>
          </div>
          <div className="demo-body">
            <div className="demo-section-title">Ajuste Dinámico Tasa Euro BCV</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Tasa EUR/Bs:</span>
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
                Ajusta la tasa para ver reflejada la conversión Tasa Euro BCV en la vitrina, las cuotas y el cotizador.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* La sesión envuelve todo: el backoffice la exige y la pantalla de ingreso la inicia. */}
      <ProveedorSesion>
        {/* El CRM va dentro del inventario: necesita bloquear y liberar vehículos. */}
        <ProveedorVehiculos>
          <ProveedorCRM>
            <ProveedorFavoritos>
              <Contenido />
            </ProveedorFavoritos>
          </ProveedorCRM>
        </ProveedorVehiculos>
      </ProveedorSesion>
    </BrowserRouter>
  );
}

export default App;
