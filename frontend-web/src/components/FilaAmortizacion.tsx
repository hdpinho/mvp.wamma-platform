import React from 'react';
import { PrecioMoneda } from './PrecioMoneda';
import { Boton } from './Boton';

export interface CuotaData {
  numero: number;
  vencimiento: string;
  capital: number;
  interes: number;
  monto: number;
  estado: 'pagada' | 'pendiente' | 'mora';
}

interface FilaAmortizacionProps {
  cuota: CuotaData;
  onPagar?: (cuota: CuotaData) => void;
  rateBCV?: number;
}

export const FilaAmortizacion: React.FC<FilaAmortizacionProps> = ({
  cuota,
  onPagar,
  rateBCV,
}) => {
  const getBadgeClass = (estado: string) => {
    switch (estado) {
      case 'pagada':
        return 'badge badge-exito';
      case 'mora':
        return 'badge badge-peligro';
      default:
        return 'badge badge-aviso';
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'pagada':
        return 'Pagada';
      case 'mora':
        return 'En Mora';
      default:
        return 'Pendiente';
    }
  };

  return (
    <tr>
      <td style={{ fontWeight: 700 }}>#{cuota.numero}</td>
      <td style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>{cuota.vencimiento}</td>
      <td>
        <span style={{ fontSize: '13px', color: 'var(--texto-secundario)' }}>
          ${cuota.capital} + ${cuota.interes} int.
        </span>
      </td>
      <td>
        <PrecioMoneda amountUSD={cuota.monto} rateBCV={rateBCV} showSubtitle={false} />
      </td>
      <td>
        <span className={getBadgeClass(cuota.estado)}>
          {getEstadoLabel(cuota.estado)}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        {cuota.estado !== 'pagada' && onPagar && (
          <Boton
            variant="primary"
            onClick={() => onPagar(cuota)}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: cuota.estado === 'mora' ? 'var(--peligro-texto)' : 'var(--naranja-500)',
              borderColor: cuota.estado === 'mora' ? 'var(--peligro-texto)' : 'var(--naranja-500)',
            }}
          >
            Pagar
          </Boton>
        )}
      </td>
    </tr>
  );
};
