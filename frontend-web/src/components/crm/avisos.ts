import { telefonoParaWhatsApp } from '../../types/crm.ts';

/**
 * Avisos al cliente por WhatsApp y por correo (D-69, D-75).
 *
 * No hay proveedor de correo ni API de WhatsApp: desde la pantalla se abre WhatsApp Web o la aplicación de escritorio
 * (`wa.me`) y el programa de correo de la computadora (`mailto:`), con el mensaje ya redactado. La persona de WAMMA
 * revisa y envía. Si el navegador bloquea la ventana, las pantallas ofrecen los mismos enlaces como botones.
 *
 * Los textos son los que ya estaban en el producto; no se redactan aquí otros nuevos salvo el de los recaudos
 * pendientes, que añade el enlace al texto aprobado del aviso «falta información» (D-72).
 */

export const enlaceWhatsApp = (telefono: string, texto: string): string =>
  `https://wa.me/${telefonoParaWhatsApp(telefono)}?text=${encodeURIComponent(texto)}`;

export const enlaceCorreo = (correo: string, asunto: string, cuerpo: string): string =>
  `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

/** Un mensaje listo para salir por los dos canales; cada canal existe solo si hay dato de contacto. */
export interface MensajeAlCliente {
  telefono: string;
  correo: string;
  /** Texto de WhatsApp. */
  texto: string;
  asunto: string;
  cuerpo: string;
}

/**
 * Abre WhatsApp en una pestaña nueva. Devuelve `false` si no hay un número usable o si el navegador bloqueó la
 * ventana: la pantalla debe entonces mostrar el enlace como botón.
 */
export function abrirWhatsApp(telefono: string, texto: string): boolean {
  if (!telefonoParaWhatsApp(telefono)) return false;
  const ventana = window.open(enlaceWhatsApp(telefono, texto), '_blank');
  if (!ventana) return false;
  ventana.opener = null;
  return true;
}

/** Abre el programa de correo con el mensaje redactado. No hace nada sin correo. */
export function abrirCorreo(correo: string, asunto: string, cuerpo: string): boolean {
  if (!correo.trim()) return false;
  window.location.assign(enlaceCorreo(correo.trim(), asunto, cuerpo));
  return true;
}

export interface ResultadoAviso {
  /** WhatsApp se abrió. */
  whatsapp: boolean;
  /** Se abrió el programa de correo. */
  correo: boolean;
}

/** Abre los dos canales que se puedan. WhatsApp primero: es el que el navegador puede bloquear. */
export function abrirAviso(mensaje: MensajeAlCliente): ResultadoAviso {
  const whatsapp = abrirWhatsApp(mensaje.telefono, mensaje.texto);
  const correo = abrirCorreo(mensaje.correo, mensaje.asunto, mensaje.cuerpo);
  return { whatsapp, correo };
}

const PIE_CORREO = 'Equipo WAMMA\nby Token Pago POS';

// ── Enlace personal de financiamiento (tras la venta financiada) ────────────────────────

export function avisoEnlaceFinanciamiento(
  nombre: string,
  vehiculo: string,
  enlace: string,
  telefono: string,
  correo: string,
): MensajeAlCliente {
  return {
    telefono,
    correo,
    texto: `¡Hola ${nombre}! Gracias por tu visita a WAMMA. Este es tu enlace personal para solicitar el financiamiento del ${vehiculo}: ${enlace}`,
    asunto: 'WAMMA · Tu enlace para solicitar el financiamiento',
    cuerpo: `Hola, ${nombre}:\n\nGracias por tu visita. Con este enlace personal completas desde tu teléfono la solicitud de crédito del ${vehiculo}:\n\n${enlace}\n\nEl enlace es solo para ti; no lo compartas.\n\nEquipo comercial WAMMA\nby Token Pago POS`,
  };
}

// ── Resultado del crédito (D-72) ────────────────────────────────────────────────────────

export type EstadoAvisoCredito = 'aprobada' | 'rechazada' | 'condicionada';

/** Los tres textos aprobados por el PO (D-72) y la etiqueta del botón que los envía. */
export function textoAvisoCredito(
  estado: string,
  nombre: string,
  numero: string | null | undefined,
  vehiculo: string,
): { boton: string; texto: string } | null {
  const solicitud = numero ? ` ${numero}` : '';
  switch (estado) {
    case 'aprobada':
      return {
        boton: '💬 Avisar que el crédito fue aprobado',
        texto: `¡Hola ${nombre}! Tu solicitud de financiamiento${solicitud} para el ${vehiculo} fue aprobada. Te escribimos para coordinar los siguientes pasos de tu compra.`,
      };
    case 'rechazada':
      return {
        boton: '💬 Avisar que el crédito no fue aprobado',
        texto: `Hola ${nombre}, revisamos tu solicitud de financiamiento${solicitud} para el ${vehiculo} y no pudimos aprobarla. Si quieres, conversamos qué opciones tienes.`,
      };
    case 'condicionada':
      return {
        boton: '💬 Pedir lo que falta para el crédito',
        texto: `Hola ${nombre}, tu solicitud de financiamiento${solicitud} para el ${vehiculo} necesita información adicional para continuar. Te escribimos para indicarte qué falta.`,
      };
    default:
      return null;
  }
}

/** El aviso del dictamen, por los dos canales. Sin texto aprobado para ese estado, no hay aviso. */
export function avisoDictamen(
  estado: string,
  nombre: string,
  numero: string,
  vehiculo: string,
  telefono: string,
  correo: string,
): MensajeAlCliente | null {
  const aviso = textoAvisoCredito(estado, nombre, numero, vehiculo);
  if (!aviso) return null;
  return {
    telefono,
    correo,
    texto: aviso.texto,
    asunto: `WAMMA · Tu solicitud de financiamiento ${numero}`,
    cuerpo: `${aviso.texto}\n\n${PIE_CORREO}`,
  };
}

/** Al condicionar (D-70): el texto aprobado de «falta información» con el enlace para completar los documentos. */
export function avisoRecaudosPendientes(
  nombre: string,
  numero: string,
  vehiculo: string,
  enlace: string,
  telefono: string,
  correo: string,
): MensajeAlCliente {
  const base = textoAvisoCredito('condicionada', nombre, numero, vehiculo)?.texto ?? '';
  const texto = `${base} Con este enlace personal puedes completar tus documentos: ${enlace}`;
  return {
    telefono,
    correo,
    texto,
    asunto: `WAMMA · Documentos pendientes de tu solicitud ${numero}`,
    cuerpo: `${texto}\n\nEl enlace es solo para ti; no lo compartas.\n\n${PIE_CORREO}`,
  };
}
