/**
 * Lectura del expediente de crédito, sin red ni `import.meta.env`, para probarla con los mismos archivos que fijan el
 * contrato en el backend. El expediente son mapas libres: cualquier campo puede faltar, y lo que falta se muestra como
 * «no informado», nunca se rellena con un valor que la persona no declaró (hallazgo F-07 del informe QA).
 */
import type { DatosPersonalesApi, DetalleSolicitudApi } from './credito';

export const NO_INFORMADO = 'No informado';

/** Texto de un campo libre; lo que no es texto ni número cuenta como vacío. */
export const texto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : '';

/** Texto o «No informado». */
export const textoOInformado = (valor: unknown): string => texto(valor) || NO_INFORMADO;

/** Monto de un campo libre: número o texto numérico; cualquier otra cosa es cero. */
export const monto = (valor: unknown): number => {
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' ? Number(valor) : NaN;
  return Number.isFinite(n) ? n : 0;
};

export function nombreCompleto(p: DatosPersonalesApi | null | undefined): string {
  if (!p) return '';
  return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido]
    .map(texto)
    .filter(Boolean)
    .join(' ');
}

/** Cédula como la escribe el formulario: tipo y número. */
export function documentoDe(p: DatosPersonalesApi | null | undefined): string {
  if (!p) return '';
  const numero = texto(p.numeroDocumento);
  return numero ? `${texto(p.tipoDocumento)}${texto(p.tipoDocumento) ? '-' : ''}${numero}` : '';
}

export interface ResumenFinanciero {
  /** Precio del vehículo: lo financiado más la inicial. */
  precio: number;
  inicial: number;
  financiado: number;
  /** La inicial sobre el precio, en tanto por uno. */
  porcentajeInicial: number;
  ingresos: number;
  egresos: number;
  capacidadPago: number;
  cuota: number;
  /** La cuota sobre la capacidad de pago, en tanto por uno; nulo si no hay capacidad declarada. */
  cuotaSobreCapacidad: number | null;
  /** La cuota supera la capacidad de pago: el analista lo ve antes de aprobar. */
  excedeCapacidad: boolean;
  /** La inicial no llega al mínimo vigente; nulo si no se conoce el mínimo. */
  inicialInsuficiente: boolean | null;
}

/**
 * Las cifras que el analista compara antes de dictaminar. Los ingresos y egresos son **lo que la persona declaró**;
 * la capacidad y la cuota son las que el servidor calculó al recibir la solicitud.
 */
export function resumenFinanciero(detalle: DetalleSolicitudApi, inicialMinima?: number): ResumenFinanciero {
  const fin = detalle.datosFinancieros ?? {};
  const financiado = monto(detalle.montoSolicitado);
  const inicial = monto(detalle.cuotaInicial);
  const precio = financiado + inicial;
  const cuota = monto(detalle.cuotaEstimada);
  const capacidadPago = monto(detalle.capacidadPagoMensual);
  return {
    precio,
    inicial,
    financiado,
    porcentajeInicial: precio > 0 ? inicial / precio : 0,
    ingresos: monto(fin.sueldoMensual) + monto(fin.otrosIngresos),
    egresos: monto(fin.alquilerHipoteca) + monto(fin.alimentacionServicios) + monto(fin.pagosDeudas),
    capacidadPago,
    cuota,
    cuotaSobreCapacidad: capacidadPago > 0 ? cuota / capacidadPago : null,
    excedeCapacidad: capacidadPago > 0 && cuota > capacidadPago,
    inicialInsuficiente:
      inicialMinima === undefined || precio <= 0 ? null : inicial + 0.005 < precio * inicialMinima,
  };
}

/** Título de un recaudo a partir del tipo con que se cargó. */
export const TITULOS_RECAUDO: Record<string, string> = {
  cedula: 'Cédula de Identidad o Pasaporte',
  rif: 'RIF actualizado',
  ingresos: 'Constancia de trabajo o certificación de ingresos',
  bancario: 'Estado de cuenta bancario',
  domicilio: 'Recibo de servicio público o contrato de arrendamiento',
  referencias: 'Dos referencias personales',
};

export const tituloDeRecaudo = (tipo: string | null | undefined): string =>
  (tipo && TITULOS_RECAUDO[tipo]) || (tipo ? tipo.replace(/_/g, ' ') : 'Documento');
