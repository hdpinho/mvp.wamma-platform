import type { CuotaData } from '../components/FilaAmortizacion';

export interface CreditoData {
  id: string;
  vehiculoId: string;
  vehiculoNombre: string;
  montoFinanciado: number;
  plazoMeses: number;
  tasaMensual: number; // 4% mensual
  tasaAnual: number;   // 48% anual
  cuotaFija: number;   // Fixed monthly quota
  deudaRestante: number;
  estado: 'activo' | 'mora' | 'pagado';
  cuotas: CuotaData[];
}

export const mockCredito: CreditoData = {
  id: 'cred-983',
  vehiculoId: 'veh-001',
  vehiculoNombre: 'Toyota Yaris 2018',
  montoFinanciado: 8000,
  plazoMeses: 12,
  tasaMensual: 0.04, // 4%
  tasaAnual: 0.48,   // 48%
  cuotaFija: 852.42, // PMT del sistema francés sobre 8000 a 12 meses al 4%
  deudaRestante: 6913.86,
  estado: 'activo',
  cuotas: [
    {
      numero: 1,
      vencimiento: '2026-04-15',
      capital: 532.42,
      interes: 320.00,
      monto: 852.42,
      estado: 'pagada',
    },
    {
      numero: 2,
      vencimiento: '2026-05-15',
      capital: 553.72,
      interes: 298.70,
      monto: 852.42,
      estado: 'pagada',
    },
    {
      numero: 3,
      vencimiento: '2026-06-15',
      capital: 575.87,
      interes: 276.55,
      monto: 852.42,
      // Se alterna a 'mora' o 'pagada' desde App.tsx
      estado: 'pendiente',
    },
    {
      numero: 4,
      vencimiento: '2026-07-15',
      capital: 598.90,
      interes: 253.52,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 5,
      vencimiento: '2026-08-15',
      capital: 622.86,
      interes: 229.56,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 6,
      vencimiento: '2026-09-15',
      capital: 647.77,
      interes: 204.65,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 7,
      vencimiento: '2026-10-15',
      capital: 673.68,
      interes: 178.74,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 8,
      vencimiento: '2026-11-15',
      capital: 700.63,
      interes: 151.79,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 9,
      vencimiento: '2026-12-15',
      capital: 728.65,
      interes: 123.77,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 10,
      vencimiento: '2027-01-15',
      capital: 757.80,
      interes: 94.62,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 11,
      vencimiento: '2027-02-15',
      capital: 788.11,
      interes: 64.31,
      monto: 852.42,
      estado: 'pendiente',
    },
    {
      numero: 12,
      vencimiento: '2027-03-15',
      capital: 819.59,
      interes: 32.78,
      monto: 852.37,
      estado: 'pendiente',
    },
  ],
};
