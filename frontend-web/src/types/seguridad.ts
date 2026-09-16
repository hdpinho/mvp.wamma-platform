/**
 * Roles y permisos del backoffice (módulo 001, plan §9, aprobado en D-24).
 *
 * Los códigos deben coincidir con `Permission.java` y `Role.java`. El servidor aplica los
 * permisos en cada endpoint; el frontend solo los usa para ocultar lo que no corresponde.
 */

export type Permiso =
  | 'usuarios.gestionar'
  | 'auditoria.ver'
  | 'parametros.gestionar'
  | 'tasa_bcv.registrar'
  | 'inventario.ver'
  | 'inventario.gestionar'
  | 'crm.ver_propias'
  | 'crm.ver_todas'
  | 'crm.operar'
  | 'crm.asignar'
  | 'cotizador.usar'
  | 'credito.revisar'
  | 'credito.ver';

export type Rol =
  | 'ADMINISTRADOR'
  | 'ASESOR_COMERCIAL'
  | 'COORDINADOR_COMERCIAL'
  | 'INVENTARIO'
  | 'ANALISTA_CREDITO'
  | 'AUDITOR';

export const ROLES: { codigo: Rol; nombre: string; proposito: string }[] = [
  { codigo: 'ADMINISTRADOR', nombre: 'Administrador', proposito: 'Gestiona usuarios y roles, y la configuración de la plataforma.' },
  { codigo: 'ASESOR_COMERCIAL', nombre: 'Asesor comercial', proposito: 'Atiende a las personas y lleva sus oportunidades: citas, contactos y ventas.' },
  { codigo: 'COORDINADOR_COMERCIAL', nombre: 'Coordinador comercial', proposito: 'Supervisa el embudo y reparte las oportunidades entre asesores.' },
  { codigo: 'INVENTARIO', nombre: 'Inventario', proposito: 'Da de alta y mantiene los vehículos, sus fotos e imperfecciones.' },
  { codigo: 'ANALISTA_CREDITO', nombre: 'Analista de crédito', proposito: 'Revisa las solicitudes de crédito y sus recaudos.' },
  { codigo: 'AUDITOR', nombre: 'Auditor', proposito: 'Consulta sin modificar nada, incluida la bitácora.' },
];

export const nombreRol = (codigo: string): string => ROLES.find((r) => r.codigo === codigo)?.nombre ?? codigo;

export const NOMBRES_PERMISO: Record<Permiso, string> = {
  'usuarios.gestionar': 'Gestionar usuarios y roles',
  'auditoria.ver': 'Consultar la bitácora',
  'parametros.gestionar': 'Editar los parámetros de financiamiento',
  'tasa_bcv.registrar': 'Registrar la tasa BCV',
  'inventario.ver': 'Ver el inventario',
  'inventario.gestionar': 'Gestionar el inventario',
  'crm.ver_propias': 'Ver sus oportunidades y las sin asignar',
  'crm.ver_todas': 'Ver todas las oportunidades',
  'crm.operar': 'Operar citas, contactos, etapas y ventas',
  'crm.asignar': 'Asignar oportunidades',
  'cotizador.usar': 'Usar el cotizador',
  'credito.revisar': 'Revisar solicitudes de crédito',
  'credito.ver': 'Ver solicitudes de crédito',
};

export const nombrePermiso = (codigo: string): string => NOMBRES_PERMISO[codigo as Permiso] ?? codigo;
