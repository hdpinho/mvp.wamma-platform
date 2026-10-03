import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TarjetaVehiculo } from '../components/TarjetaVehiculo';
import { Boton } from '../components/Boton';
import { NotaSimulada } from '../components/NotaSimulada';
import { useFavoritos } from '../state/favoritosContexto';
import { useVehiculos } from '../state/vehiculosContexto';

/**
 * C7 · Guardados — Fase 2 (módulo 12 · Marketplace).
 *
 * Las alertas de baja de precio se retiraron por decisión del Product Owner
 * (septiembre 2026).
 */

interface C7FavoritosProps {
  rateBCV: number;
}

export const C7_Favoritos: React.FC<C7FavoritosProps> = ({ rateBCV }) => {
  const navigate = useNavigate();
  const { favoritos } = useFavoritos();
  const { vehiculos } = useVehiculos();

  // Del inventario vivo y no de los mocks: así aparecen también los vehículos
  // cargados desde el backoffice.
  const guardados = vehiculos.filter((v) => favoritos.includes(v.id));

  return (
    <div>
      <header style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontSize: '26px' }}>Mis guardados</h1>
        <p style={{ fontSize: '14px', color: 'var(--texto-secundario)' }}>
          Los vehículos que marcaste para tenerlos a mano.
        </p>
      </header>

      {guardados.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--blanco)',
            border: '1px solid var(--borde-claro)',
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
              backgroundColor: 'var(--naranja-50)',
              color: 'var(--naranja-500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-lg)',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '18px', marginBottom: 'var(--space-sm)' }}>
            Todavía no has guardado ningún vehículo
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--texto-secundario)',
              maxWidth: '42ch',
              margin: '0 auto var(--space-xl)',
            }}
          >
            Toca el corazón en cualquier vehículo del catálogo para tenerlo a mano.
          </p>
          <Boton variant="primary" onClick={() => navigate('/catalogo')}>
            Explorar el catálogo
          </Boton>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: 'var(--space-md)' }}>
            <strong>{guardados.length}</strong>{' '}
            {guardados.length === 1 ? 'vehículo guardado' : 'vehículos guardados'}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: 'var(--space-lg)',
            }}
          >
            {guardados.map((v) => (
              <TarjetaVehiculo
                key={v.id}
                vehiculo={v}
                rateBCV={rateBCV}
                onSelect={(id) => navigate(`/vehiculo/${id}`)}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 'var(--space-xl)' }}>
        <NotaSimulada variante="bloque">
          Los guardados corresponden al módulo 12 (Marketplace), planificado para la Fase 2. Se muestran
          como maqueta visual: no hay persistencia, el listado se pierde al recargar la página.
        </NotaSimulada>
      </div>
    </div>
  );
};
