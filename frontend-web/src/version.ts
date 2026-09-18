export interface InfoComponente {
  nombre: string;
  version: string;
  tecnologia: string;
}

export interface ReleaseLog {
  version: string;
  etiqueta: string;
  fecha: string;
  hitos: string[];
}

export const WAMMA_VERSION = {
  version: '3.0.0',
  release: 'MVP Release 1',
  versionTexto: 'V 3.0 Release 1',
  fecha: 'Septiembre 2026',
  nombre: 'WAMMA by Token Pago POS',
  descripcion:
    'Plataforma propia de venta, inspección de 240 puntos bajo Estándar WAMMA y financiamiento de vehículos usados en Venezuela.',
  componentes: {
    frontend: {
      nombre: 'Frontend Web',
      version: 'v3.0.1',
      tecnologia: 'React 19 · TypeScript · Vite',
    },
    backend: {
      nombre: 'Backend API',
      version: 'v0.1.0-SNAPSHOT',
      tecnologia: 'Java 21 · Spring Boot 4.1',
    },
    baseDatos: {
      nombre: 'Base de Datos',
      version: 'Flyway V0012',
      tecnologia: 'PostgreSQL administrado en Supabase',
    },
    constitucion: {
      nombre: 'Constitución de Ingeniería',
      version: 'v3.0.0',
      tecnologia: 'SDD Estricto · Multi-moneda EUR/BCV',
    },
  },
  changelog: [
    {
      version: 'V 3.0 Release 1',
      etiqueta: 'Versión actual en despliegue',
      fecha: 'Septiembre 2026',
      hitos: [
        'Precios y cuotas oficiales en Euros (EUR).',
        'Vitrina virtual con filtros de rango de ingresos, cuota mensual y marca.',
        'Soporte completo para cargar y previsualizar de 1 a 10 fotos por vehículo con galería y miniaturas interactivas.',
        'Simulador y cotizador de crédito con capacidad de pago basada en el 30 % del ingreso mensual.',
        'Módulo CRM con embudo comercial, gestión de personas, registro de visitas y asignación de financiamiento.',
        'Navegación global con botón "Inicio" accesible desde todas las pantallas y scroll automático al tope.',
        'Protección robusta contra valores no numéricos en precios y cuotas.',
      ],
    },
    {
      version: 'V 2.0 Enmienda Cloud',
      etiqueta: 'Arquitectura e infraestructura',
      fecha: 'Septiembre 2026',
      hitos: [
        'Arquitectura portable para despliegue en Vercel (Frontend), Render (Backend) y Supabase (Datos).',
        'Migraciones idempotentes en Flyway (V0001 a V0012) para esquema relacional.',
        'Control de accesos y seguridad (RBAC) con separación estricta de funciones.',
        'Bitácora de auditoría inmutable para operaciones administrativas.',
      ],
    },
    {
      version: 'V 1.0 Especificación Inicial',
      etiqueta: 'Fundación del proyecto',
      fecha: 'Junio 2026',
      hitos: [
        'Especificación funcional del modelo Kavak adaptado al mercado venezolano.',
        'Diseño del ledger contable sagrado de partida doble sin coma flotante.',
        'Integración con el ecosistema de medios de pago Token Pago POS.',
      ],
    },
  ],
};
