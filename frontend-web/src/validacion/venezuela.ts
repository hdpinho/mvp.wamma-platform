/**
 * Validadores venezolanos — espejo en TypeScript de `backend/internal/creditapp/validation`.
 *
 * La validación del cliente es **solo de experiencia de usuario**: la
 * autoritativa es la del servidor. Este archivo existe para que el asistente
 * avise en el momento y no al enviar.
 *
 * Los algoritmos son idénticos a los de Go a propósito. Si alguno cambia, hay
 * que cambiarlo en ambos lados; el plan técnico (§6) prevé sustituir esta
 * duplicación por un JSON de reglas compartido cuando exista el backend real.
 */

/** Pesos del algoritmo módulo 11 del RIF: el primero aplica a la letra. */
const PESOS_RIF = [4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Valor de cada letra de RIF en el cálculo del dígito verificador. */
const LETRAS_RIF: Record<string, number> = { V: 1, E: 2, J: 3, P: 4, G: 5 };

/** Códigos de operadora móvil admitidos. */
const OPERADORAS_MOVILES = ['12', '14', '16', '24', '26'];

/** Quita separadores de escritura y pasa a mayúsculas. */
function normalizarDocumento(valor: string): string {
  return valor.toUpperCase().replace(/[-.\s]/g, '');
}

/** Deja solo los dígitos. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Valida una cédula: prefijo V o E y de 6 a 9 dígitos. */
export function validarCedula(valor: string): string | null {
  const limpio = normalizarDocumento(valor);
  if (!limpio) return 'La cédula es obligatoria';

  const prefijo = limpio[0];
  if (prefijo !== 'V' && prefijo !== 'E') return 'El prefijo debe ser V o E';

  const digitos = limpio.slice(1);
  if (!/^\d+$/.test(digitos)) return 'La cédula solo admite dígitos tras el prefijo';
  if (digitos.length < 6 || digitos.length > 9) return 'La cédula debe tener entre 6 y 9 dígitos';
  return null;
}

/**
 * Calcula el dígito verificador de un RIF por el algoritmo módulo 11.
 *
 * Verificado contra el RIF de Corporación Token Pago POS, J-40242154-0.
 */
export function digitoVerificadorRIF(letra: string, cuerpo: string): number | null {
  const peso = LETRAS_RIF[letra];
  if (peso === undefined) return null;
  if (!/^\d{8}$/.test(cuerpo)) return null;

  let suma = peso * PESOS_RIF[0];
  for (let i = 0; i < 8; i++) {
    suma += Number(cuerpo[i]) * PESOS_RIF[i + 1];
  }

  const dv = 11 - (suma % 11);
  // Tanto 10 como 11 se representan como 0.
  return dv > 9 ? 0 : dv;
}

/** Valida un RIF completo, comprobando su dígito verificador. */
export function validarRIF(valor: string): string | null {
  const limpio = normalizarDocumento(valor);
  if (!limpio) return 'El RIF es obligatorio';
  if (limpio.length !== 10) return 'El RIF debe tener una letra, 8 dígitos y el verificador';

  const letra = limpio[0];
  const cuerpo = limpio.slice(1, 9);
  const ultimo = limpio[9];
  if (!/^\d$/.test(ultimo)) return 'El dígito verificador debe ser numérico';

  const esperado = digitoVerificadorRIF(letra, cuerpo);
  if (esperado === null) return 'El RIF no tiene un formato válido';
  if (Number(ultimo) !== esperado) return 'El dígito verificador del RIF no es correcto';
  return null;
}

/**
 * Deriva el RIF de una persona natural a partir de su cédula.
 *
 * Evita que el solicitante transcriba a mano un dato que se puede deducir, que
 * era una fuente de error frecuente en el formato en papel. El resultado sigue
 * siendo editable.
 */
export function derivarRIF(cedula: string): string | null {
  if (validarCedula(cedula)) return null;

  const limpio = normalizarDocumento(cedula);
  const letra = limpio[0];
  const cuerpo = limpio.slice(1).padStart(8, '0');
  if (cuerpo.length > 8) return null;

  const dv = digitoVerificadorRIF(letra, cuerpo);
  return dv === null ? null : `${letra}-${cuerpo}-${dv}`;
}

/** Reduce un teléfono a sus 10 dígitos nacionales. */
export function normalizarTelefono(valor: string): string {
  let d = soloDigitos(valor);
  if (d.startsWith('58') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return d;
}

/** Valida un celular: 4 + operadora + 7 dígitos. */
export function validarMovil(valor: string): string | null {
  const d = normalizarTelefono(valor);
  if (!d) return 'El teléfono celular es obligatorio';
  if (d.length !== 10) return 'Un celular tiene 10 dígitos';
  if (d[0] !== '4') return 'Un celular empieza por 4';
  if (!OPERADORAS_MOVILES.includes(d.slice(1, 3))) {
    return `${d.slice(1, 3)} no es un código de operadora válido`;
  }
  return null;
}

/** Valida un teléfono fijo: 2 + código de área + 7 dígitos. */
export function validarFijo(valor: string): string | null {
  const d = normalizarTelefono(valor);
  if (!d) return null; // El fijo es opcional.
  if (d.length !== 10) return 'Un teléfono fijo tiene 10 dígitos';
  if (d[0] !== '2') return 'Un teléfono fijo empieza por 2';
  return null;
}

/** Indica si dos teléfonos son el mismo abonado, sin importar la grafía. */
export function mismoTelefono(a: string, b: string): boolean {
  const na = normalizarTelefono(a);
  const nb = normalizarTelefono(b);
  return na !== '' && na === nb;
}

/** Valida la forma de un correo. La existencia del dominio la comprueba el servidor. */
export function validarCorreo(valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'El correo es obligatorio';
  if (/\s/.test(v)) return 'El correo no admite espacios';

  const arroba = v.lastIndexOf('@');
  if (arroba <= 0 || arroba === v.length - 1) return 'Falta la parte local o el dominio';

  const local = v.slice(0, arroba);
  const dominio = v.slice(arroba + 1);
  if (local.length > 64 || v.length > 254) return 'La dirección es demasiado larga';
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return 'La parte local tiene puntos mal colocados';
  }

  const etiquetas = dominio.split('.');
  if (etiquetas.length < 2) return 'El dominio debe incluir una extensión';
  for (const e of etiquetas) {
    if (!e || e.length > 63) return 'El dominio no es válido';
    if (e.startsWith('-') || e.endsWith('-')) return 'El dominio no es válido';
    if (!/^[a-zA-Z0-9-]+$/.test(e)) return 'El dominio tiene caracteres no admitidos';
  }
  if (!/^[a-zA-Z]{2,}$/.test(etiquetas[etiquetas.length - 1])) {
    return 'La extensión del dominio no es válida';
  }
  return null;
}

/** Largo obligatorio de una cuenta bancaria venezolana. */
export const LARGO_CUENTA = 20;

/** Valida la estructura de una cuenta: exactamente 20 dígitos. */
export function validarCuentaEstructura(valor: string): string | null {
  const d = soloDigitos(valor);
  if (!d) return 'El número de cuenta es obligatorio';
  if (d.length !== LARGO_CUENTA) {
    return `La cuenta debe tener ${LARGO_CUENTA} dígitos y tiene ${d.length}`;
  }
  return null;
}

/** Extrae el código de banco: los cuatro primeros dígitos. */
export function codigoBancoDe(valor: string): string {
  return soloDigitos(valor).slice(0, 4);
}

/** Mayoría de edad en Venezuela. */
export const MAYORIA_DE_EDAD = 18;

/**
 * Años cumplidos en la fecha de referencia.
 *
 * Compara mes y día, no el día del año: entre un año bisiesto y uno que no lo
 * es, el mismo día del calendario cae en ordinales distintos y el cálculo se
 * equivocaría justo en el límite de la mayoría de edad.
 */
export function edad(nacimiento: Date, referencia: Date = new Date()): number {
  let años = referencia.getFullYear() - nacimiento.getFullYear();
  const mesRef = referencia.getMonth();
  const mesNac = nacimiento.getMonth();
  if (mesRef < mesNac || (mesRef === mesNac && referencia.getDate() < nacimiento.getDate())) {
    años--;
  }
  return años;
}

/** Valida que el solicitante sea mayor de edad. */
export function validarFechaNacimiento(valor: string): string | null {
  if (!valor) return 'La fecha de nacimiento es obligatoria';

  const fecha = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return 'La fecha no es válida';
  if (fecha > new Date()) return 'La fecha de nacimiento no puede estar en el futuro';
  if (edad(fecha) < MAYORIA_DE_EDAD) return 'El solicitante debe ser mayor de edad';
  return null;
}

/** Valida un campo de texto obligatorio. */
export function requerido(valor: string, etiqueta: string): string | null {
  return valor.trim() ? null : `${etiqueta} es obligatorio`;
}
