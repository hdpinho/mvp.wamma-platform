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
 * Municipios por estado — Catálogo oficial de los 335 municipios de Venezuela (23 estados y Distrito Capital).
 */
export const MUNICIPIOS: Record<string, string[]> = {
  Amazonas: [
    'Alto Orinoco',
    'Atabapo',
    'Atures',
    'Autana',
    'Manapiare',
    'Maroa',
    'Río Negro',
  ],
  Anzoátegui: [
    'Anaco',
    'Aragua',
    'Diego Bautista Urbaneja',
    'Francisco del Carmen Carvajal',
    'Francisco de Miranda',
    'Guanta',
    'Independencia',
    'José Gregorio Monagas',
    'Juan Antonio Sotillo',
    'Juan Manuel Cajigal',
    'Libertad',
    'Manuel Ezequiel Bruzual',
    'Pedro María Freites',
    'Píritu',
    'San Fernando de Peñalver',
    'San Juan de Capistrano',
    'Santa Ana',
    'Simón Bolívar',
    'Simón Rodríguez',
    'Sir Arthur McGregor',
    'Turístico Diego Bautista Urbaneja',
  ],
  Apure: [
    'Achaguas',
    'Biruaca',
    'Muñoz',
    'Páez',
    'Pedro Camejo',
    'Rómulo Gallegos',
    'San Fernando',
  ],
  Aragua: [
    'Bolívar',
    'Camatagua',
    'Francisco Linares Alcántara',
    'Girardot',
    'José Ángel Lamas',
    'José Félix Ribas',
    'José Rafael Revenga',
    'Libertador',
    'Mario Briceño Iragorry',
    'Ocumare de la Costa de Oro',
    'San Casimiro',
    'San Sebastián',
    'Santiago Mariño',
    'Santos Michelena',
    'Sucre',
    'Tovar',
    'Urdaneta',
    'Zamora',
  ],
  Barinas: [
    'Alberto Arvelo Torrealba',
    'Andrés Eloy Blanco',
    'Antonio José de Sucre',
    'Arismendi',
    'Barinas',
    'Bolívar',
    'Cruz Paredes',
    'Ezequiel Zamora',
    'Obispos',
    'Pedraza',
    'Rojas',
    'Sosa',
  ],
  Bolívar: [
    'Angostura',
    'Angostura del Orinoco',
    'Caroní',
    'Cedeño',
    'El Callao',
    'Gran Sabana',
    'Padre Pedro Chien',
    'Piar',
    'Roscio',
    'Sifontes',
    'Sucre',
  ],
  Carabobo: [
    'Bejuma',
    'Carlos Arvelo',
    'Diego Ibarra',
    'Guacara',
    'Juan José Mora',
    'Libertador',
    'Los Guayos',
    'Miranda',
    'Montalbán',
    'Naguanagua',
    'Puerto Cabello',
    'San Diego',
    'San Joaquín',
    'Valencia',
  ],
  Cojedes: [
    'Anzoátegui',
    'Girardot',
    'Lima Blanco',
    'Pao de San Juan Bautista',
    'Ricaurte',
    'Rómulo Gallegos',
    'San Carlos',
    'Tinaco',
    'Tinaquillo',
  ],
  'Delta Amacuro': [
    'Antonio Díaz',
    'Casacoima',
    'Pedernales',
    'Tucupita',
  ],
  'Distrito Capital': [
    'Libertador',
  ],
  Falcón: [
    'Acosta',
    'Bolívar',
    'Buchivacoa',
    'Cacique Manaure',
    'Carirubana',
    'Colina',
    'Dabajuro',
    'Democracia',
    'Falcón',
    'Federación',
    'Jacura',
    'Los Taques',
    'Mauroa',
    'Miranda',
    'Monseñor Iturriza',
    'Palmasola',
    'Petit',
    'Píritu',
    'San Francisco',
    'Silva',
    'Sucre',
    'Tocópero',
    'Unión',
    'Urumaco',
    'Zamora',
  ],
  Guárico: [
    'Camaguán',
    'Chaguaramas',
    'El Socorro',
    'Francisco de Miranda',
    'José Félix Ribas',
    'José Tadeo Monagas',
    'Juan Germán Roscio',
    'Juan José Rondón',
    'Julián Mellado',
    'Leonardo Infante',
    'Ortiz',
    'San Gerónimo de Guayabal',
    'San José de Guaribe',
    'Santa María de Ipire',
    'Zaraza',
  ],
  'La Guaira': [
    'Vargas',
  ],
  Lara: [
    'Andrés Eloy Blanco',
    'Crespo',
    'Iribarren',
    'Jiménez',
    'Morán',
    'Palavecino',
    'Simón Planas',
    'Torres',
    'Urdaneta',
  ],
  Mérida: [
    'Alberto Adriani',
    'Andrés Bello',
    'Antonio Pinto Salinas',
    'Aricagua',
    'Arzobispo Chacón',
    'Campo Elías',
    'Caracciolo Parra Olmedo',
    'Cardenal Quintero',
    'Guaraque',
    'Julio César Salas',
    'Justo Briceño',
    'Libertador',
    'Miranda',
    'Obispo Ramos de Lora',
    'Padre Noguera',
    'Pueblo Llano',
    'Rangel',
    'Rivas Dávila',
    'Santos Marquina',
    'Sucre',
    'Tovar',
    'Tulio Febres Cordero',
    'Zea',
  ],
  Miranda: [
    'Acevedo',
    'Andrés Bello',
    'Baruta',
    'Bolívar',
    'Brión',
    'Buroz',
    'Carrizal',
    'Chacao',
    'Cristóbal Rojas',
    'El Hatillo',
    'Guaicaipuro',
    'Independencia',
    'Los Salias',
    'Páez',
    'Paz Castillo',
    'Pedro Gual',
    'Plaza',
    'Sucre',
    'Tomás Lander',
    'Urdaneta',
    'Zamora',
  ],
  Monagas: [
    'Acosta',
    'Aguasay',
    'Bolívar',
    'Caripe',
    'Cedeño',
    'Ezequiel Zamora',
    'Libertador',
    'Maturín',
    'Piar',
    'Punceres',
    'Santa Bárbara',
    'Sotillo',
    'Uracoa',
  ],
  'Nueva Esparta': [
    'Antolín del Campo',
    'Arismendi',
    'Díaz',
    'García',
    'Gómez',
    'Maneiro',
    'Marcano',
    'Mariño',
    'Península de Macanao',
    'Tubores',
    'Villalba',
  ],
  Portuguesa: [
    'Agua Blanca',
    'Araure',
    'Esteller',
    'Guanare',
    'Guanarito',
    'Monseñor José Vicente de Unda',
    'Ospino',
    'Páez',
    'Papelón',
    'San Genaro de Boconoíto',
    'San Rafael de Onoto',
    'Santa Rosalía',
    'Sucre',
    'Turén',
  ],
  Sucre: [
    'Andrés Eloy Blanco',
    'Andrés Mata',
    'Arismendi',
    'Benítez',
    'Bermúdez',
    'Bolívar',
    'Cajigal',
    'Cruz Salmerón Acosta',
    'Libertador',
    'Mariño',
    'Mejía',
    'Montes',
    'Ribero',
    'Sucre',
    'Valdez',
  ],
  Táchira: [
    'Andrés Bello',
    'Antonio Rómulo Costa',
    'Ayacucho',
    'Bolívar',
    'Cárdenas',
    'Córdoba',
    'Fernández Feo',
    'Francisco de Miranda',
    'García de Hevia',
    'Guásimos',
    'Independencia',
    'Jáuregui',
    'José María Vargas',
    'Junín',
    'Libertad',
    'Libertador',
    'Lobatera',
    'Michelena',
    'Panamericano',
    'Pedro María Ureña',
    'Rafael Urdaneta',
    'Samuel Darío Maldonado',
    'San Cristóbal',
    'San Judas Tadeo',
    'Seboruco',
    'Simón Rodríguez',
    'Sucre',
    'Torbes',
    'Uribante',
  ],
  Trujillo: [
    'Andrés Bello',
    'Boconó',
    'Bolívar',
    'Candelaria',
    'Carache',
    'Escuque',
    'José Felipe Márquez Cañizales',
    'Juan Vicente Campo Elías',
    'La Ceiba',
    'Miranda',
    'Monte Carmelo',
    'Motatán',
    'Pampán',
    'Pampanito',
    'Rafael Rangel',
    'San Rafael de Carvajal',
    'Sucre',
    'Trujillo',
    'Urdaneta',
    'Valera',
  ],
  Yaracuy: [
    'Arístides Bastidas',
    'Bolívar',
    'Bruzual',
    'Cocorote',
    'Independencia',
    'José Antonio Páez',
    'La Trinidad',
    'Manuel Monge',
    'Nirgua',
    'Peña',
    'San Felipe',
    'Sucre',
    'Urachiche',
    'Veroes',
  ],
  Zulia: [
    'Almirante Padilla',
    'Baralt',
    'Cabimas',
    'Catatumbo',
    'Colón',
    'Francisco Javier Pulgar',
    'Guajira',
    'Jesús Enrique Lossada',
    'Jesús María Semprún',
    'La Cañada de Urdaneta',
    'Lagunillas',
    'Machiques de Perijá',
    'Mara',
    'Maracaibo',
    'Miranda',
    'Rosario de Perijá',
    'San Francisco',
    'Santa Rita',
    'Simón Bolívar',
    'Sucre',
    'Valmore Rodríguez',
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

/**
 * Versión del texto de las declaraciones que se muestra y se acepta. Viaja con la solicitud y queda en la evidencia de
 * aceptación (D-57): si el texto cambia, cambia esta versión. Sin OTP, esto y la fecha, la IP y el agente son la prueba.
 */
export const VERSION_TEXTO_DECLARACIONES = 'WMA-F-FIN-001 v1';

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
  'Lee y acepta cada declaración. Al enviar, tu solicitud queda registrada con la fecha y la hora de la aceptación.',
];

/** Genera un número de solicitud con el formato del expediente. */
export function generarNumeroSolicitud(): string {
  const año = new Date().getFullYear();
  const secuencia = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0');
  return `WMA-SC-${año}-${secuencia}`;
}
