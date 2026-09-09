/**
 * Créditos de las fotografías del catálogo.
 *
 * FOTOS DE MARCADOR DE POSICIÓN. Provienen de Wikimedia Commons bajo licencias
 * libres (dominio público y Creative Commons). Corresponden al modelo indicado,
 * pero NO son unidades reales del inventario de WAMMA.
 *
 * Las licencias CC BY-SA exigen atribución y son "compartir igual": la obra
 * derivada (nuestro recorte a 4:3) hereda la misma licencia. Antes de salir a
 * producción deben sustituirse por fotografías propias de las unidades reales.
 * Ver `[NEEDS CLARIFICATION: fotografía real de inventario]` en ui-design.md.
 */

export interface CreditoFoto {
  /** Nombre del archivo en `public/vehiculos/`. */
  archivo: string;
  /** Título original del archivo en Commons. */
  titulo: string;
  autor: string;
  licencia: string;
  /** Página de origen, para verificar la licencia. */
  pagina: string;
}

export const creditosFotos: Record<string, CreditoFoto> = {
  'veh-001': {
    archivo: 'veh-001.webp',
    titulo: '\'16-\'18 Toyota Yaris R -- Front.jpg',
    autor: 'Bull-Doser',
    licencia: 'Public domain',
    pagina: 'https://commons.wikimedia.org/wiki/File:%2716-%2718_Toyota_Yaris_R_--_Front.jpg',
  },
  'veh-002': {
    archivo: 'veh-002.webp',
    titulo: 'FSO Chevrolet Aveo II Sedan front - PSM 2009.jpg',
    autor: 'Michge',
    licencia: 'CC BY-SA 3.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:FSO_Chevrolet_Aveo_II_Sedan_front_-_PSM_2009.jpg',
  },
  'veh-003': {
    archivo: 'veh-003.webp',
    titulo: 'Ford Fiesta VI hatch facelift 01 China 2016-04-12.jpg',
    autor: 'Navigator84',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:Ford_Fiesta_VI_hatch_facelift_01_China_2016-04-12.jpg',
  },
  'veh-004': {
    archivo: 'veh-004.webp',
    titulo: '2020 Toyota Corolla Altis petrol version front.jpg',
    autor: 'LuvsMG481',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2020_Toyota_Corolla_Altis_petrol_version_front.jpg',
  },
  'veh-005': {
    archivo: 'veh-005.webp',
    titulo: 'Toyota Fortuner 4x2 G 2019.jpg',
    autor: 'Captainmorlypogi1959',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:Toyota_Fortuner_4x2_G_2019.jpg',
  },
  'veh-006': {
    archivo: 'veh-006.webp',
    titulo: '2015 Chevrolet Silverado 1500 LTZ, front 2.29.20.jpg',
    autor: 'Kevauto',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2015_Chevrolet_Silverado_1500_LTZ,_front_2.29.20.jpg',
  },
  'veh-007': {
    archivo: 'veh-007.webp',
    titulo: '2018 Hyundai Tucson Elite front.jpg',
    autor: 'LuvsMG481',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2018_Hyundai_Tucson_Elite_front.jpg',
  },
  'veh-008': {
    archivo: 'veh-008.webp',
    titulo: 'Kia Rio5 1.4 LX 2018 (38923614811).jpg',
    autor: 'RL GNZLZ from Chile',
    licencia: 'CC BY-SA 2.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:Kia_Rio5_1.4_LX_2018_(38923614811).jpg',
  },
  'veh-009': {
    archivo: 'veh-009.webp',
    titulo: '2011–2016 Ford Explorer Front.jpg',
    autor: 'Vauxford',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2011%E2%80%932016_Ford_Explorer_Front.jpg',
  },
  'veh-010': {
    archivo: 'veh-010.webp',
    titulo: '2017 Dacia Logan Ambiance 1.5 dCi 90 Facelift.jpg',
    autor: 'KGC626',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2017_Dacia_Logan_Ambiance_1.5_dCi_90_Facelift.jpg',
  },
  'veh-011': {
    archivo: 'veh-011.webp',
    titulo: 'Toyota Hilux FX 2018.jpg',
    autor: 'Captainmorlypogi1959',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:Toyota_Hilux_FX_2018.jpg',
  },
  'veh-012': {
    archivo: 'veh-012.webp',
    titulo: '2004 Chevrolet Optra 1.6 LS, front left, 06-21-2024.jpg',
    autor: 'Ethan Llamas',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2004_Chevrolet_Optra_1.6_LS,_front_left,_06-21-2024.jpg',
  },
  'veh-013': {
    archivo: 'veh-013.webp',
    titulo: '0 Jeep Grand Cherokee (WK2, 2017) 1.jpg',
    autor: 'Benespit',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:0_Jeep_Grand_Cherokee_(WK2,_2017)_1.jpg',
  },
  'veh-014': {
    archivo: 'veh-014.webp',
    titulo: '2019 Ford EcoSport.jpg',
    autor: 'DestinationFearFan',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2019_Ford_EcoSport.jpg',
  },
  'veh-015': {
    archivo: 'veh-015.webp',
    titulo: '2016 Hyundai Accent (RB4 MY17) Active sedan (2018-08-20).jpg',
    autor: 'EurovisionNim',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:2016_Hyundai_Accent_(RB4_MY17)_Active_sedan_(2018-08-20).jpg',
  },
  'veh-016': {
    archivo: 'veh-016.webp',
    titulo: '12-15 Mitsubishi Lancer GT sedan.jpg',
    autor: 'MercurySable99',
    licencia: 'CC BY-SA 4.0',
    pagina: 'https://commons.wikimedia.org/wiki/File:12-15_Mitsubishi_Lancer_GT_sedan.jpg',
  },
};
