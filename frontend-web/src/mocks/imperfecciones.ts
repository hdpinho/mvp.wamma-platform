import type { Imperfeccion } from '../types/vehiculo';

/**
 * Hallazgos cosméticos declarados por la inspección de 240 puntos.
 *
 * DATOS SIMULADOS. Corresponden a la entidad `inspeccion_punto` con resultado
 * no conforme (data-model, módulo 004). En la plataforma real los genera el
 * inspector desde la app de inspección y cada uno lleva su `evidencia_url`;
 * aquí el acercamiento se simula sobre la propia fotografía del vehículo.
 *
 * Publicar el desgaste real es lo que sostiene el Principio de confianza: el
 * comprador ve lo que va a encontrar antes de ir a la sede. Un vehículo sin
 * entrada en este mapa se muestra como "sin hallazgos declarados", que es
 * distinto de "sin inspeccionar".
 */

/** Catálogo de hallazgos por vehículo. La clave es el `id` del vehículo. */
export const imperfeccionesPorVehiculo: Record<string, Imperfeccion[]> = {
  'veh-001': [
    {
      id: 'imp-001-a',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Rayón de pintura que no llega a la base. No requiere repintado.',
      severidad: 'leve',
      ubicacion: 'Puerta delantera derecha',
      x: 46,
      y: 58,
    },
    {
      id: 'imp-001-b',
      zona: 'interior',
      tipo: 'Desgaste de tapicería',
      descripcion: 'Brillo por uso en el lateral del asiento del conductor.',
      severidad: 'leve',
      ubicacion: 'Asiento del conductor',
      x: 33,
      y: 44,
    },
  ],

  'veh-002': [
    {
      id: 'imp-002-a',
      zona: 'exterior',
      tipo: 'Abolladura',
      descripcion: 'Abolladura sin daño de pintura, del tamaño de una moneda.',
      severidad: 'moderada',
      ubicacion: 'Guardafango trasero izquierdo',
      x: 74,
      y: 55,
    },
    {
      id: 'imp-002-b',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Marcas finas de uso en el paragolpes trasero.',
      severidad: 'leve',
      ubicacion: 'Paragolpes trasero',
      x: 86,
      y: 62,
    },
    {
      id: 'imp-002-c',
      zona: 'interior',
      tipo: 'Desgaste de mandos',
      descripcion: 'Pérdida de brillo en la palanca de cambios por uso.',
      severidad: 'leve',
      ubicacion: 'Consola central',
      x: 48,
      y: 43,
    },
  ],

  'veh-003': [
    {
      id: 'imp-003-a',
      zona: 'exterior',
      tipo: 'Pintura opaca',
      descripcion: 'Techo con pérdida de brillo por exposición al sol.',
      severidad: 'moderada',
      ubicacion: 'Techo',
      x: 50,
      y: 22,
    },
    {
      id: 'imp-003-b',
      zona: 'exterior',
      tipo: 'Rayón profundo',
      descripcion: 'Rayón que alcanza la base. Se recomienda retoque de pintura.',
      severidad: 'moderada',
      ubicacion: 'Puerta trasera izquierda',
      x: 62,
      y: 58,
    },
    {
      id: 'imp-003-c',
      zona: 'exterior',
      tipo: 'Rin rozado',
      descripcion: 'Roce de acera en el borde del rin.',
      severidad: 'leve',
      ubicacion: 'Rin delantero derecho',
      x: 26,
      y: 70,
    },
    {
      id: 'imp-003-d',
      zona: 'interior',
      tipo: 'Rasgadura de tapicería',
      descripcion: 'Descosido de 3 cm en la costura del asiento trasero.',
      severidad: 'moderada',
      ubicacion: 'Asiento trasero',
      x: 56,
      y: 68,
    },
  ],

  'veh-004': [
    {
      id: 'imp-004-a',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Marca fina en el paragolpes delantero, apenas perceptible.',
      severidad: 'leve',
      ubicacion: 'Paragolpes delantero',
      x: 14,
      y: 64,
    },
  ],

  'veh-005': [
    {
      id: 'imp-005-a',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Roces propios del uso en la platina del estribo lateral.',
      severidad: 'leve',
      ubicacion: 'Estribo lateral derecho',
      x: 50,
      y: 72,
    },
    {
      id: 'imp-005-b',
      zona: 'interior',
      tipo: 'Desgaste de alfombra',
      descripcion: 'Alfombra del conductor con desgaste visible por el talón.',
      severidad: 'leve',
      ubicacion: 'Piso del conductor',
      x: 33,
      y: 56,
    },
  ],

  'veh-006': [
    {
      id: 'imp-006-a',
      zona: 'exterior',
      tipo: 'Abolladura',
      descripcion: 'Hundimiento leve en la pared del platón, sin fisura.',
      severidad: 'moderada',
      ubicacion: 'Platón lateral izquierdo',
      x: 78,
      y: 54,
    },
    {
      id: 'imp-006-b',
      zona: 'exterior',
      tipo: 'Pintura descascarada',
      descripcion: 'Saltaduras de pintura en el borde del capó por piedras.',
      severidad: 'moderada',
      ubicacion: 'Borde del capó',
      x: 22,
      y: 53,
    },
    {
      id: 'imp-006-c',
      zona: 'interior',
      tipo: 'Desgaste de tapicería',
      descripcion: 'Tela del asiento del conductor con brillo y pelusa.',
      severidad: 'moderada',
      ubicacion: 'Asiento del conductor',
      x: 33,
      y: 44,
    },
  ],

  'veh-007': [
    {
      id: 'imp-007-a',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Rayón corto en la manilla de la puerta del conductor.',
      severidad: 'leve',
      ubicacion: 'Puerta del conductor',
      x: 40,
      y: 56,
    },
  ],

  'veh-008': [
    {
      id: 'imp-008-a',
      zona: 'interior',
      tipo: 'Mancha en tapicería',
      descripcion: 'Mancha tratada en la alfombra trasera; permanece sombra leve.',
      severidad: 'leve',
      ubicacion: 'Piso trasero',
      x: 60,
      y: 79,
    },
  ],

  'veh-009': [
    {
      id: 'imp-009-a',
      zona: 'exterior',
      tipo: 'Pintura opaca',
      descripcion: 'Capó y techo con oxidación superficial del barniz.',
      severidad: 'moderada',
      ubicacion: 'Capó y techo',
      x: 50,
      y: 12,
    },
    {
      id: 'imp-009-b',
      zona: 'exterior',
      tipo: 'Abolladura',
      descripcion: 'Dos abolladuras contiguas en la puerta trasera derecha.',
      severidad: 'moderada',
      ubicacion: 'Puerta trasera derecha',
      x: 66,
      y: 57,
    },
    {
      id: 'imp-009-c',
      zona: 'exterior',
      tipo: 'Faro opaco',
      descripcion: 'Policarbonato del faro derecho amarillento.',
      severidad: 'leve',
      ubicacion: 'Faro delantero derecho',
      x: 16,
      y: 60,
    },
    {
      id: 'imp-009-d',
      zona: 'interior',
      tipo: 'Desgaste de mandos',
      descripcion: 'Letras del climatizador desgastadas por el uso.',
      severidad: 'leve',
      ubicacion: 'Consola central',
      x: 48,
      y: 43,
    },
  ],

  'veh-010': [
    {
      id: 'imp-010-a',
      zona: 'exterior',
      tipo: 'Rin rozado',
      descripcion: 'Roce de acera en dos rines del lado derecho.',
      severidad: 'leve',
      ubicacion: 'Rines lado derecho',
      x: 74,
      y: 70,
    },
    {
      id: 'imp-010-b',
      zona: 'interior',
      tipo: 'Desgaste de tapicería',
      descripcion: 'Costura del asiento del conductor con hilos flojos.',
      severidad: 'leve',
      ubicacion: 'Asiento del conductor',
      x: 33,
      y: 44,
    },
  ],

  'veh-011': [
    {
      id: 'imp-011-a',
      zona: 'exterior',
      tipo: 'Rayón profundo',
      descripcion: 'Rayón de rama en el lateral, llega a la base.',
      severidad: 'moderada',
      ubicacion: 'Lateral derecho',
      x: 58,
      y: 54,
    },
    {
      id: 'imp-011-b',
      zona: 'exterior',
      tipo: 'Pintura descascarada',
      descripcion: 'Saltaduras en el paragolpes delantero por uso fuera de asfalto.',
      severidad: 'leve',
      ubicacion: 'Paragolpes delantero',
      x: 14,
      y: 66,
    },
  ],

  'veh-012': [
    {
      id: 'imp-012-a',
      zona: 'exterior',
      tipo: 'Pintura opaca',
      descripcion: 'Barniz deteriorado en todo el techo y los espejos.',
      severidad: 'moderada',
      ubicacion: 'Techo',
      x: 50,
      y: 22,
    },
    {
      id: 'imp-012-b',
      zona: 'exterior',
      tipo: 'Abolladura',
      descripcion: 'Abolladura en la puerta trasera izquierda con pintura marcada.',
      severidad: 'moderada',
      ubicacion: 'Puerta trasera izquierda',
      x: 66,
      y: 57,
    },
    {
      id: 'imp-012-c',
      zona: 'exterior',
      tipo: 'Faro opaco',
      descripcion: 'Ambos faros con amarilleo pronunciado.',
      severidad: 'moderada',
      ubicacion: 'Faros delanteros',
      x: 16,
      y: 60,
    },
    {
      id: 'imp-012-d',
      zona: 'interior',
      tipo: 'Rasgadura de tapicería',
      descripcion: 'Rasgadura de 5 cm en el lateral del asiento del conductor.',
      severidad: 'moderada',
      ubicacion: 'Asiento del conductor',
      x: 33,
      y: 44,
    },
  ],

  'veh-013': [
    {
      id: 'imp-013-a',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Marcas de lavado en el capó, visibles a contraluz.',
      severidad: 'leve',
      ubicacion: 'Capó',
      x: 50,
      y: 11,
    },
    {
      id: 'imp-013-b',
      zona: 'interior',
      tipo: 'Desgaste de cuero',
      descripcion: 'Cuero del volante con brillo en las posiciones de agarre.',
      severidad: 'leve',
      ubicacion: 'Volante',
      x: 34,
      y: 29,
    },
  ],

  'veh-014': [
    {
      id: 'imp-014-a',
      zona: 'exterior',
      tipo: 'Rayón superficial',
      descripcion: 'Rayón leve en la tapa del baúl, junto a la manilla.',
      severidad: 'leve',
      ubicacion: 'Tapa del baúl',
      x: 85,
      y: 58,
    },
  ],

  'veh-015': [
    {
      id: 'imp-015-a',
      zona: 'exterior',
      tipo: 'Abolladura',
      descripcion: 'Abolladura pequeña en la puerta delantera izquierda.',
      severidad: 'leve',
      ubicacion: 'Puerta delantera izquierda',
      x: 44,
      y: 58,
    },
    {
      id: 'imp-015-b',
      zona: 'interior',
      tipo: 'Desgaste de alfombra',
      descripcion: 'Alfombras delanteras con desgaste parejo por uso.',
      severidad: 'leve',
      ubicacion: 'Piso delantero',
      x: 36,
      y: 56,
    },
  ],

  'veh-016': [
    {
      id: 'imp-016-a',
      zona: 'exterior',
      tipo: 'Pintura descascarada',
      descripcion: 'Saltaduras en el borde del guardafango delantero derecho.',
      severidad: 'moderada',
      ubicacion: 'Guardafango delantero derecho',
      x: 28,
      y: 60,
    },
    {
      id: 'imp-016-b',
      zona: 'exterior',
      tipo: 'Rin rozado',
      descripcion: 'Roce marcado en el rin trasero izquierdo.',
      severidad: 'leve',
      ubicacion: 'Rin trasero izquierdo',
      x: 74,
      y: 70,
    },
    {
      id: 'imp-016-c',
      zona: 'interior',
      tipo: 'Desgaste de mandos',
      descripcion: 'Botones del volante con letras desgastadas.',
      severidad: 'leve',
      ubicacion: 'Volante',
      x: 34,
      y: 29,
    },
  ],
};

/** Hallazgos de un vehículo, o lista vacía si no tiene ninguno declarado. */
export function imperfeccionesDe(vehiculoId: string): Imperfeccion[] {
  return imperfeccionesPorVehiculo[vehiculoId] ?? [];
}
