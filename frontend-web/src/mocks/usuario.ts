export interface UsuarioData {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  cedula?: string;
  rif?: string;
  kycLevel: 'básico' | 'verificado';
  creditApproved: boolean;
  creditLimit: number;
}

export const mockUsuario: UsuarioData = {
  id: 'usr-481',
  nombre: 'Humberto Pinho',
  correo: 'h.pinho@wamma.com.ve',
  telefono: '+58 412-1234567',
  cedula: 'V-18.456.789',
  rif: 'J-41234567-8',
  kycLevel: 'básico', // Can be changed dynamically via the Demo Control Panel
  creditApproved: false,
  creditLimit: 8500,
};
