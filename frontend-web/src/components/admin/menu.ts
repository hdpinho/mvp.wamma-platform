import type { Permiso } from '../../types/seguridad';

export interface EntradaMenu {
  ruta: string;
  icono: string;
  texto: string;
  /** Basta con uno de ellos (plan 001 §9). */
  permisos: Permiso[];
}

export const PERMISOS_CRM: Permiso[] = ['crm.ver_propias', 'crm.ver_todas'];

/**
 * Menú lateral del backoffice. Cada usuario ve solo las entradas que su rol permite; el
 * servidor aplica los mismos permisos en cada endpoint.
 */
export const MENU_ADMIN: EntradaMenu[] = [
  { ruta: '/admin/inventario', icono: '🚗', texto: 'Inventario Vehículos', permisos: ['inventario.ver'] },
  { ruta: '/admin/citas', icono: '📅', texto: 'Citas y Solicitudes', permisos: PERMISOS_CRM },
  { ruta: '/admin/embudo', icono: '📊', texto: 'Embudo Comercial', permisos: PERMISOS_CRM },
  { ruta: '/admin/personas', icono: '👤', texto: 'Personas', permisos: PERMISOS_CRM },
  { ruta: '/admin/financiamiento', icono: '💳', texto: 'Cotizador Crédito', permisos: ['cotizador.usar'] },
  { ruta: '/admin/tasa-bcv', icono: '💱', texto: 'Tasa BCV', permisos: ['tasa_bcv.registrar'] },
  { ruta: '/admin/usuarios', icono: '🔑', texto: 'Usuarios', permisos: ['usuarios.gestionar'] },
  { ruta: '/admin/bitacora', icono: '📜', texto: 'Bitácora', permisos: ['auditoria.ver'] },
  { ruta: '/admin/acerca', icono: 'ℹ️', texto: 'Acerca de', permisos: [] },
];
