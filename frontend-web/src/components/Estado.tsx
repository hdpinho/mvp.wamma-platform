import React from 'react';
import { Boton } from './Boton';

interface EstadoProps {
  type: 'empty' | 'loading' | 'error';
  message?: string;
  onRetry?: () => void;
}

export const Estado: React.FC<EstadoProps> = ({
  type,
  message,
  onRetry,
}) => {
  if (type === 'loading') {
    return (
      <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton" style={{ height: '32px', width: '40%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '150px', width: '100%', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '20px', width: '80%', borderRadius: '4px' }} />
        <div className="skeleton" style={{ height: '20px', width: '60%', borderRadius: '4px' }} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
        backgroundColor: 'var(--blanco)',
        border: '1px solid var(--borde-claro)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: type === 'error' ? 'var(--peligro-fondo)' : 'var(--superficie)',
          color: type === 'error' ? 'var(--peligro-texto)' : 'var(--texto-mudo)',
          marginBottom: '16px',
        }}
      >
        {type === 'error' ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </div>

      <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>
        {type === 'error' ? 'Ocurrió un error' : 'No se encontraron resultados'}
      </h3>
      
      <p style={{ fontSize: '14px', color: 'var(--texto-secundario)', maxWidth: '300px', marginBottom: '24px' }}>
        {message || (type === 'error' ? 'Por favor intente nuevamente más tarde.' : 'Intente cambiar los criterios de búsqueda o filtros.')}
      </p>

      {type === 'error' && onRetry && (
        <Boton variant="primary" onClick={onRetry}>
          Reintentar
        </Boton>
      )}
    </div>
  );
};
