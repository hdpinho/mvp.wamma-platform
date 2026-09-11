import type { Cita, Oportunidad, Persona } from '../../types/crm';

/**
 * Correo de confirmación de cita (`specs/010-crm-comercial/spec.md` §10).
 *
 * Decisión del Product Owner: el correo sale del programa de correo del propio
 * asesor, mediante un enlace `mailto:` que lo abre con el mensaje ya redactado.
 * No hay proveedor ni dominio que configurar.
 *
 * Límite de `mailto:`: solo admite texto plano. El formato es la estructura del
 * mensaje —secciones y datos de la cita—; un correo con diseño y logo exige
 * envío desde servidor, que quedó fuera de esta etapa.
 */

/** Los mismos rangos que ofrece el formulario de agendar. */
const HORARIOS: Record<Cita['franjaHoraria'], string> = {
  Mañana: 'en la mañana, de 9:00 a. m. a 1:00 p. m.',
  Tarde: 'en la tarde, de 2:00 p. m. a 5:00 p. m.',
};

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Se ancla al mediodía para que la zona horaria no corra la fecha al día anterior. */
const fechaLarga = (aaaammdd: string) =>
  new Date(`${aaaammdd}T12:00:00`).toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export interface CorreoCita {
  para: string;
  asunto: string;
  cuerpo: string;
  mailto: string;
}

export function correoConfirmacionCita(
  persona: Persona,
  oportunidad: Oportunidad,
  cita: Cita,
  sede?: string,
): CorreoCita | null {
  if (!persona.correo) return null;

  const v = oportunidad.vehiculoResumen;
  const nombre = persona.nombreApellido.split(' ')[0] || persona.nombreApellido;
  const asunto = `WAMMA · Tu cita está confirmada: ${v.marca} ${v.modelo} ${v.anio}`;

  const lineas = [
    `Hola, ${nombre}:`,
    '',
    'Tu cita para conocer el vehículo quedó confirmada. Estos son los datos:',
    '',
    'VEHÍCULO',
    `${v.marca} ${v.modelo} ${v.version} (${v.anio})`,
    `Precio: US$ ${v.precioUSD.toLocaleString('es-VE')}`,
    '',
    'FECHA Y HORARIO',
    `${capitalizar(fechaLarga(cita.diaPreferencia))}, ${HORARIOS[cita.franjaHoraria]}.`,
    '',
    ...(sede ? ['SEDE', sede, ''] : []),
    'QUÉ TRAER',
    '• Tu cédula de identidad.',
    ...(oportunidad.modalidadPago === 'Financiamiento'
      ? [
          '• Si vas a financiar: después de tu visita, tu asesor te enviará un enlace personal para completar la solicitud de crédito desde tu teléfono.',
        ]
      : []),
    '',
    '¿Necesitas cambiar la cita? Responde a este correo y la reprogramamos.',
    '',
    'Equipo comercial WAMMA',
    'by Token Pago POS',
  ];
  const cuerpo = lineas.join('\n');

  return {
    para: persona.correo,
    asunto,
    cuerpo,
    mailto: `mailto:${persona.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`,
  };
}
