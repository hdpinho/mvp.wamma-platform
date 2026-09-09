import React from 'react';
import { FotoVehiculo } from './FotoVehiculo';
import { BotonFavorito } from './BotonFavorito';
import { cuotaDesde } from '../mocks/financiamiento';
import type { VehiculoData } from '../types/vehiculo';

export type { VehiculoData };

interface TarjetaVehiculoProps {
  vehiculo: VehiculoData;
  onSelect: (id: string) => void;
  rateBCV?: number;
}

const formatoUSD = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);

const formatoBs = (v: number) =>
  new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(v);

export const TarjetaVehiculo: React.FC<TarjetaVehiculoProps> = ({
  vehiculo,
  onSelect,
  rateBCV = 36.5,
}) => {
  const cuota = cuotaDesde(vehiculo.precioUSD);

  return (
    <article
      onClick={() => onSelect(vehiculo.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(vehiculo.id);
        }
      }}
      role="button"
      tabIndex={0}
      className="tarjeta-vehiculo"
      style={{
        backgroundColor: 'var(--blanco)',
        border: '1px solid var(--borde-claro)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Fotografía y sobreimpresos */}
      <div style={{ position: 'relative' }}>
        <FotoVehiculo vehiculo={vehiculo} alto={180} />

        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <BotonFavorito vehiculoId={vehiculo.id} />
        </div>

        {vehiculo.etiqueta && (
          <span
            style={{
              position: 'absolute',
              top: '14px',
              left: '12px',
              backgroundColor: 'var(--naranja-500)',
              color: 'var(--blanco)',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '5px 10px',
              borderRadius: 'var(--radius-pill)',
            }}
          >
            {vehiculo.etiqueta}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div
        style={{
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          gap: 'var(--space-xs)',
        }}
      >
        <h3 style={{ fontSize: '16px', lineHeight: 1.3 }}>
          {vehiculo.marca} {vehiculo.modelo}{' '}
          <span style={{ color: 'var(--texto-mudo)', fontWeight: 400 }}>{vehiculo.anio}</span>
        </h3>

        <p style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>{vehiculo.version}</p>

        <p style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>
          {vehiculo.kilometraje.toLocaleString('es-VE')} km · {vehiculo.transmision} ·{' '}
          {vehiculo.carroceria}
        </p>

        {/* Precio y cuota */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.2 }}>
            {formatoUSD(vehiculo.precioUSD)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--texto-mudo)' }}>
            Ref. {formatoBs(vehiculo.precioUSD * rateBCV)} Bs. · tasa BCV {rateBCV.toFixed(2)}
          </div>

          <div
            style={{
              marginTop: 'var(--space-sm)',
              paddingTop: 'var(--space-sm)',
              borderTop: '1px dashed var(--borde-claro)',
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--naranja-700)',
            }}
          >
            Desde {formatoUSD(cuota)} /mes*
          </div>
        </div>

        {/* Pie: certificación y sede */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
            marginTop: 'var(--space-md)',
            paddingTop: 'var(--space-md)',
            borderTop: '1px solid var(--borde-claro)',
            fontSize: '11px',
            color: 'var(--texto-mudo)',
          }}
        >
          {vehiculo.certificado ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--naranja-700)',
                fontWeight: 700,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Certificado 240 pts
            </span>
          ) : (
            <span>Sin certificar</span>
          )}
          {/* Todo el inventario está en la Gran Caracas: se muestra la zona, no la ciudad */}
          <span style={{ textAlign: 'right' }}>{vehiculo.sede.split(' - ')[1] ?? vehiculo.sede}</span>
        </div>
      </div>
    </article>
  );
};
