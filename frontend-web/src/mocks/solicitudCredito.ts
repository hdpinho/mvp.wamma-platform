/**
 * Catálogos y textos de la solicitud de crédito — MAQUETA.
 *
 * Digitaliza el formato en papel WMA-F-FIN-001. Ver `specs/solicitud-credito/`.
 *
 * Los textos de las declaraciones son los del formato original y se reproducen
 * literalmente: son la pieza con valor probatorio. En la plataforma real viven
 * en la tabla `textos_legales`, versionados, y cada aceptación apunta a la
 * versión exacta que leyó el cliente.
 */

/** Los 23 estados más el Distrito Capital. */
export const ESTADOS = [
  'Amazonas',
  'Anzoátegui',
  'Apure',
  'Aragua',
  'Barinas',
  'Bolívar',
  'Carabobo',
  'Cojedes',
  'Delta Amacuro',
  'Distrito Capital',
  'Falcón',
  'Guárico',
  'La Guaira',
  'Lara',
  'Mérida',
  'Miranda',
  'Monagas',
  'Nueva Esparta',
  'Portuguesa',
  'Sucre',
  'Táchira',
  'Trujillo',
  'Yaracuy',
  'Zulia',
] as const;

/**
 * Municipios por estado — **CATÁLOGO PARCIAL**.
 *
 * Solo se cargaron los de la Gran Caracas, que es donde está el inventario del
 * demo. El resto queda deliberadamente vacío: sin la fuente oficial (D14) no se
 * inventa un listado. Un estado sin municipios muestra un aviso y no deja
 * avanzar, que es el comportamiento correcto ante un insumo ausente.
 */
export const MUNICIPIOS: Record<string, string[]> = {
  'Distrito Capital': ['Libertador'],
  Miranda: [
    'Baruta',
    'Chacao',
    'El Hatillo',
    'Sucre',
    'Guaicaipuro',
    'Plaza',
    'Zamora',
    'Carrizal',
    'Los Salias',
  ],
};

/**
 * Bancos con su código de cuatro dígitos — **LISTA PROVISIONAL**.
 *
 * Recoge las instituciones de uso corriente, pero **no está confirmada contra
 * la lista oficial de Sudeban** (D13). Antes de producción debe sustituirse por
 * el catálogo oficial: un código equivocado rechaza cuentas legítimas.
 */
export const BANCOS: { codigo: string; nombre: string }[] = [
  { codigo: '0102', nombre: 'Banco de Venezuela' },
  { codigo: '0104', nombre: 'Venezolano de Crédito' },
  { codigo: '0105', nombre: 'Mercantil' },
  { codigo: '0108', nombre: 'BBVA Provincial' },
  { codigo: '0114', nombre: 'Bancaribe' },
  { codigo: '0115', nombre: 'Banco Exterior' },
  { codigo: '0128', nombre: 'Banco Caroní' },
  { codigo: '0134', nombre: 'Banesco' },
  { codigo: '0138', nombre: 'Banco Plaza' },
  { codigo: '0151', nombre: 'BFC Banco Fondo Común' },
  { codigo: '0156', nombre: '100% Banco' },
  { codigo: '0163', nombre: 'Banco del Tesoro' },
  { codigo: '0166', nombre: 'Banco Agrícola de Venezuela' },
  { codigo: '0169', nombre: 'Mi Banco' },
  { codigo: '0171', nombre: 'Banco Activo' },
  { codigo: '0172', nombre: 'Bancamiga' },
  { codigo: '0174', nombre: 'Banplus' },
  { codigo: '0175', nombre: 'Banco Bicentenario' },
  { codigo: '0177', nombre: 'Banfanb' },
  { codigo: '0191', nombre: 'Banco Nacional de Crédito' },
];

/** Situación laboral declarada; condiciona qué campos se piden. */
export const SITUACIONES_LABORALES = [
  'Empleado Fijo',
  'Contratado',
  'Independiente o Firma Personal',
  'Jubilado o Pensionado',
] as const;

export type SituacionLaboral = (typeof SITUACIONES_LABORALES)[number];

export const ESTADOS_CIVILES = ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)'] as const;
export const NIVELES_ACADEMICOS = ['Primaria', 'Bachiller', 'T.S.U.', 'Universitario', 'Postgrado'] as const;
export const CONDICIONES_VIVIENDA = ['Propia', 'Alquilada', 'Familiar', 'Hipoteca'] as const;
export const NACIONALIDADES = ['Venezolana', 'Extranjera'] as const;
export const TIPOS_CUENTA = ['Corriente', 'Ahorros'] as const;
export const FRECUENCIAS_PAGO = ['Semanal', 'Quincenal', 'Mensual'] as const;
export const PLAZOS_MESES = [6, 12, 18, 24, 36] as const;

/** Los seis recaudos del formato original. */
export const RECAUDOS = [
  {
    id: 'cedula',
    titulo: 'Cédula de Identidad o Pasaporte',
    detalle: 'Vigente y legible, por ambas caras.',
  },
  {
    id: 'rif',
    titulo: 'RIF actualizado',
    detalle: 'Con la dirección de domicilio actual.',
  },
  {
    id: 'ingresos',
    titulo: 'Constancia de trabajo o certificación de ingresos',
    detalle: 'Original, o certificación firmada por contador público.',
  },
  {
    id: 'bancario',
    titulo: 'Estado de cuenta bancario',
    detalle: 'De los últimos seis (6) meses.',
  },
  {
    id: 'domicilio',
    titulo: 'Recibo de servicio público o contrato de arrendamiento',
    detalle: 'Luz, agua, gas o teléfono a nombre del solicitante.',
  },
  {
    id: 'referencias',
    titulo: 'Dos referencias personales',
    detalle: 'Con copia de la C.I. y teléfono de contacto.',
  },
] as const;

/**
 * Declaraciones del formato WMA-F-FIN-001, reproducidas literalmente.
 *
 * Cada una lleva casilla independiente y obligatoria. No se resume ni se
 * parafrasea: el valor probatorio depende de que el texto sea el exacto.
 */
export const DECLARACIONES = [
  {
    id: 'veracidad',
    titulo: 'Veracidad de la Información',
    texto:
      'Declaro bajo fe de juramento que todos los datos consignados en esta solicitud son veraces, exactos y completos. Acepto que cualquier omisión, falsedad o inexactitud en la información suministrada anulará de pleno derecho la presente solicitud, reservándose Corporación Token Pago POS, C.A. (Wamma) el derecho de iniciar las acciones legales correspondientes.',
  },
  {
    id: 'centrales-riesgo',
    titulo: 'Autorización de Consulta a Centrales de Riesgo',
    texto:
      'Autorizo de manera expresa e irrevocable a Wamma a verificar, consultar, solicitar y suministrar información relativa a mi historial crediticio, transaccional y comportamiento de pago ante las Centrales de Información Crediticia, entes reguladores e instituciones bancarias del país.',
  },
  {
    id: 'origen-fondos',
    titulo: 'Origen de Fondos',
    texto:
      'Declaro formalmente que los fondos con los que atenderé el pago del crédito solicitado provienen de actividades lícitas de conformidad con la legislación venezolana contra la Delincuencia Organizada y Financiamiento al Terrorismo.',
  },
  {
    id: 'compromiso-pago',
    titulo: 'Compromiso de Pago',
    texto:
      'En caso de ser aprobada la presente solicitud, me comprometo a cumplir estrictamente con el cronograma de amortización de cuotas estipulado en el contrato respectivo.',
  },
] as const;

/** Título de cada paso del asistente. */
export const PASOS = [
  'Vehículo y condiciones',
  'Identificación',
  'Ubicación y contacto',
  'Información laboral',
  'Balance financiero',
  'Referencias y banco',
  'Recaudos',
  'Declaraciones y envío',
] as const;

/**
 * Por qué se pide cada bloque de datos.
 *
 * El solicitante venezolano desconfía de los formularios que piden datos
 * financieros. Explicar el motivo de cada paso es lo que sostiene la tasa de
 * finalización.
 */
export const MOTIVOS: string[] = [
  'Con el vehículo y las condiciones calculamos tu cuota estimada. Aún no es una oferta.',
  'Necesitamos identificarte para cumplir con las normas de prevención que nos exige el regulador.',
  'La dirección y el contacto nos permiten ubicarte y coordinar la entrega.',
  'Tu situación laboral nos ayuda a entender la estabilidad de tus ingresos.',
  'Comparamos ingresos y egresos para proponerte una cuota que puedas sostener.',
  'Las referencias y la cuenta son requisitos del expediente de crédito.',
  'Estos documentos respaldan lo que declaraste. Puedes enviarlos después si no los tienes ahora.',
  'Lee y acepta cada declaración. Al final verificamos tu teléfono con un código.',
];

/** Genera un número de solicitud con el formato del expediente. */
export function generarNumeroSolicitud(): string {
  const año = new Date().getFullYear();
  const secuencia = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0');
  return `WMA-SC-${año}-${secuencia}`;
}
