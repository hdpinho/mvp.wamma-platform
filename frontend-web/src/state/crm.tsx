import React, { useState, useEffect } from 'react';
import type {
  CanalInteraccion,
  Cita,
  Etapa,
  EventoEtapa,
  Interaccion,
  MotivoPerdida,
  Oportunidad,
  Persona,
  PersonaAbsorbida,
  ResumenVehiculo,
} from '../types/crm';
import {
  definicionEtapa,
  evaluarTransicion,
  generarTokenFinanciamiento,
  normalizarCedula,
  normalizarTelefono,
  telefonosDe,
} from '../types/crm';
import type { VehiculoData } from '../types/vehiculo';
import { useVehiculos } from './vehiculosContexto';
import type { EstadoDisponibilidad } from './vehiculosContexto';
import type {
  DatosConfirmacion,
  DatosInteraccion,
  DatosNuevaCita,
  OpcionesTransicion,
  ResultadoConfirmacion,
  ResultadoVenta,
} from './crmContexto';
import { CORREO_NOTIFICACIONES_WAMMA, CRMContext } from './crmContexto';

/**
 * Proveedor del seguimiento comercial — `specs/010-crm-comercial/`.
 *
 * Se separó de `vehiculosContexto`, que ya cargaba inventario, imperfecciones y
 * citas: añadirle personas, oportunidades e interacciones lo habría convertido
 * en el cajón de sastre del proyecto (`plan.md` §7.1).
 *
 * Las citas viven **aquí**, no en el inventario: una cita es un evento dentro de
 * una oportunidad. El único acoplamiento con el inventario es el bloqueo del
 * vehículo, y es una llamada explícita, no estado compartido.
 */

const CLAVE_PERSONAS = 'wamma_crm_personas_v2';
const CLAVE_OPORTUNIDADES = 'wamma_crm_oportunidades_v2';
const CLAVE_INTERACCIONES = 'wamma_crm_interacciones_v2';
const CLAVE_HISTORIAL = 'wamma_crm_historial_v2';
const CLAVE_CITAS = 'wamma_crm_citas_v2';
/** Datos de la maqueta anterior, que se migran una sola vez (tarea F3). */
const CLAVE_CITAS_V1 = 'wamma_citas_v1';

const nuevoId = (prefijo: string) =>
  `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const guardado = localStorage.getItem(clave);
    if (guardado) return JSON.parse(guardado) as T;
  } catch {
    // Si el dato guardado no es legible, se arranca con el valor por defecto.
  }
  return porDefecto;
}

function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {
    console.warn(`No se pudo guardar ${clave} en localStorage`, e);
  }
}

// ── Migración v1 → v2 (tarea F3) ─────────────────────────────────────────────

/** Forma de la cita en la maqueta anterior, con el contacto embebido. */
interface CitaV1 {
  id: string;
  vehiculoId: string;
  vehiculoResumen: ResumenVehiculo;
  nombreApellido: string;
  cedula: string;
  telefonoWhatsApp: string;
  correo: string;
  diaPreferencia: string;
  franjaHoraria: 'Mañana' | 'Tarde';
  metodoPago: 'Contado' | 'Financiamiento';
  estado: 'pendiente' | 'confirmada' | 'descartada';
  fechaCreacion: string;
  notificadoA: string;
}

interface EstadoCRM {
  personas: Persona[];
  oportunidades: Oportunidad[];
  interacciones: Interaccion[];
  historial: EventoEtapa[];
  citas: Cita[];
}

const ETAPA_POR_ESTADO_V1: Record<CitaV1['estado'], Etapa> = {
  pendiente: 'nuevo',
  confirmada: 'cita_confirmada',
  descartada: 'cerrado_perdido',
};

/**
 * Agrupa las citas de la v1 por cédula y produce una persona por cédula, con
 * una oportunidad por cita. Es el ensayo en pequeño de la migración real: si no
 * funciona con 20 citas simuladas, tampoco con 2.000 reales.
 *
 * La v1 **no se borra**: queda como respaldo hasta confirmar el resultado.
 */
function migrarDesdeV1(): EstadoCRM | null {
  const citasV1 = leer<CitaV1[] | null>(CLAVE_CITAS_V1, null);
  if (!citasV1 || citasV1.length === 0) return null;

  const personas: Persona[] = [];
  const oportunidades: Oportunidad[] = [];
  const historial: EventoEtapa[] = [];
  const citas: Cita[] = [];
  const porClave = new Map<string, Persona>();

  // De la más antigua a la más reciente, para que la persona conserve la fecha
  // de su primer contacto y no la del último.
  const ordenadas = [...citasV1].sort(
    (a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime(),
  );

  for (const v1 of ordenadas) {
    const cedula = normalizarCedula(v1.cedula ?? '');
    const clave = cedula || normalizarTelefono(v1.telefonoWhatsApp);

    let persona = porClave.get(clave);
    if (!persona) {
      persona = {
        id: nuevoId('per'),
        nombreApellido: v1.nombreApellido,
        cedula: cedula || undefined,
        telefonoWhatsApp: normalizarTelefono(v1.telefonoWhatsApp),
        correo: v1.correo || undefined,
        canalOrigen: 'vitrina_web',
        criterioResolucion: cedula ? 'cedula' : 'telefono',
        fechaCreacion: v1.fechaCreacion,
      };
      porClave.set(clave, persona);
      personas.push(persona);
    }

    const etapa = ETAPA_POR_ESTADO_V1[v1.estado];
    const oportunidad: Oportunidad = {
      id: nuevoId('opo'),
      personaId: persona.id,
      vehiculoId: v1.vehiculoId,
      vehiculoResumen: v1.vehiculoResumen,
      etapa,
      modalidadPago: v1.metodoPago,
      valorEstimadoUSD: v1.vehiculoResumen?.precioUSD ?? 0,
      asesorId: null,
      fechaCreacion: v1.fechaCreacion,
      ...(etapa === 'cerrado_perdido'
        ? {
            // No se inventa un motivo comercial que nadie registró.
            motivoPerdida: 'otro' as MotivoPerdida,
            motivoPerdidaTexto: 'Migrado de la maqueta v1: cita descartada sin motivo registrado.',
            fechaCierre: v1.fechaCreacion,
          }
        : {}),
    };
    oportunidades.push(oportunidad);

    historial.push({
      id: nuevoId('evt'),
      oportunidadId: oportunidad.id,
      etapaAnterior: null,
      etapaNueva: etapa,
      nota: 'Migración de la maqueta v1.',
      actorId: null,
      ts: v1.fechaCreacion,
    });

    citas.push({
      id: v1.id,
      personaId: persona.id,
      oportunidadId: oportunidad.id,
      vehiculoId: v1.vehiculoId,
      diaPreferencia: v1.diaPreferencia,
      franjaHoraria: v1.franjaHoraria,
      estado: v1.estado,
      fechaCreacion: v1.fechaCreacion,
      notificadoA: v1.notificadoA ?? CORREO_NOTIFICACIONES_WAMMA,
    });
  }

  return { personas, oportunidades, interacciones: [], historial, citas };
}

/**
 * Las fusiones hechas antes de la corrección guardaban solo el id de la persona
 * absorbida. Se conservan como tales, rotuladas, sin inventar los datos que se
 * perdieron.
 */
function normalizarPersonas(personas: Persona[]): Persona[] {
  return personas.map((p) => {
    const previas = p.fusionadaDesde as (PersonaAbsorbida | string)[] | undefined;
    if (!previas || !previas.some((f) => typeof f === 'string')) return p;
    return {
      ...p,
      fusionadaDesde: previas.map((f) =>
        typeof f === 'string'
          ? {
              id: f,
              nombreApellido: 'Datos no conservados (fusión anterior a la corrección)',
              telefonoWhatsApp: '',
              fechaCreacion: p.fechaCreacion,
              fusionadaEn: p.fechaCreacion,
              oportunidadIds: [],
              citaIds: [],
              interaccionIds: [],
            }
          : f,
      ),
    };
  });
}

/** Carga el estado: v2 si existe, migración de v1 si no, vacío en último caso. */
function cargarEstadoInicial(): EstadoCRM {
  const personasV2 = leer<Persona[] | null>(CLAVE_PERSONAS, null);
  if (personasV2) {
    return {
      personas: normalizarPersonas(personasV2),
      oportunidades: leer<Oportunidad[]>(CLAVE_OPORTUNIDADES, []),
      interacciones: leer<Interaccion[]>(CLAVE_INTERACCIONES, []),
      historial: leer<EventoEtapa[]>(CLAVE_HISTORIAL, []),
      citas: leer<Cita[]>(CLAVE_CITAS, []),
    };
  }

  return (
    migrarDesdeV1() ?? { personas: [], oportunidades: [], interacciones: [], historial: [], citas: [] }
  );
}

// ── Datos de ejemplo para la demostración ────────────────────────────────────

interface GuionEjemplo {
  nombre: string;
  cedula?: string;
  telefono: string;
  correo?: string;
  vehiculoId: string;
  modalidad: 'Contado' | 'Financiamiento';
  /** Días atrás en que se capturó el interés. */
  capturada: number;
  /** Transiciones posteriores a "nuevo": [etapa, días atrás]. */
  ruta: [Etapa, number][];
  motivo?: MotivoPerdida;
  /** [acción, días desde hoy]. Negativo = ya vencida. */
  proxima?: [string, number];
  notas?: [string, number, CanalInteraccion][];
}

/**
 * Prospectos de ejemplo, rotulados con `canalOrigen: 'ejemplo'`, para que el
 * embudo se pueda recorrer sin agendar diez citas a mano. Cubren todas las
 * etapas, dos oportunidades estancadas (nuevo > 2 días, negociación > 14),
 * dos acciones vencidas y una persona con dos oportunidades.
 */
const GUION_EJEMPLO: GuionEjemplo[] = [
  { nombre: 'María Rodríguez', telefono: '04140000011', vehiculoId: 'veh-004', modalidad: 'Financiamiento', capturada: 3, ruta: [] },
  { nombre: 'José Hernández', telefono: '04120000012', vehiculoId: 'veh-005', modalidad: 'Contado', capturada: 0.2, ruta: [] },
  {
    nombre: 'Carmen Díaz', telefono: '04240000013', correo: 'carmen.diaz@example.com', vehiculoId: 'veh-012',
    modalidad: 'Financiamiento', capturada: 15, ruta: [['contactado', 14], ['cerrado_perdido', 13]],
    motivo: 'no_califico_financiamiento',
  },
  {
    nombre: 'Carmen Díaz', telefono: '04240000013', vehiculoId: 'veh-006', modalidad: 'Financiamiento',
    capturada: 2, ruta: [['contactado', 1]], proxima: ['Enviar simulación de cuota a 24 meses', -1],
    notas: [['Pidió simulación con 30 % de inicial. Vuelve a intentarlo tras no calificar el mes pasado.', 1, 'whatsapp']],
  },
  {
    nombre: 'Pedro Castillo', cedula: 'V20000004', telefono: '04160000014', vehiculoId: 'veh-007', modalidad: 'Contado',
    capturada: 6, ruta: [['contactado', 5], ['cita_confirmada', 4]], proxima: ['Recibirlo en sede y hacer prueba de manejo', 1],
    notas: [['Confirmó la visita para el sábado a las 10 a. m.', 4, 'whatsapp']],
  },
  {
    nombre: 'Luisa Morales', cedula: 'V20000005', telefono: '04260000015', vehiculoId: 'veh-008', modalidad: 'Financiamiento',
    capturada: 10, ruta: [['contactado', 9], ['cita_confirmada', 8], ['visito', 3]],
    notas: [['Le gustó el carro; revisará el presupuesto con su esposo.', 3, 'presencial']],
  },
  {
    nombre: 'Andrés Rivas', cedula: 'V20000006', telefono: '04140000016', vehiculoId: 'veh-009', modalidad: 'Financiamiento',
    capturada: 20, ruta: [['contactado', 19], ['cita_confirmada', 18], ['visito', 17], ['negociacion', 16]],
    proxima: ['Llamar para cerrar la oferta', -2],
  },
  {
    nombre: 'Gabriela Torres', cedula: 'V20000007', telefono: '04120000017', vehiculoId: 'veh-010', modalidad: 'Contado',
    capturada: 25, ruta: [['contactado', 24], ['cita_confirmada', 22], ['visito', 20], ['negociacion', 12], ['cerrado_ganado', 5]],
  },
  {
    nombre: 'Ricardo Silva', cedula: 'V20000008', telefono: '04240000018', vehiculoId: 'veh-011', modalidad: 'Financiamiento',
    capturada: 12, ruta: [['contactado', 11], ['cita_confirmada', 10], ['cerrado_perdido', 8]],
    motivo: 'precio_fuera_de_presupuesto',
  },
];

function construirEjemplo(vehiculos: VehiculoData[]): {
  estado: EstadoCRM;
  estadosVehiculo: [string, EstadoDisponibilidad][];
} {
  const ahora = Date.now();
  const hace = (dias: number) => new Date(ahora - dias * 86_400_000).toISOString();
  const fechaLocal = (dias: number) => {
    const d = new Date(ahora + dias * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const personas = new Map<string, Persona>();
  const oportunidades: Oportunidad[] = [];
  const historial: EventoEtapa[] = [];
  const interacciones: Interaccion[] = [];
  const citas: Cita[] = [];
  const estadosVehiculo: [string, EstadoDisponibilidad][] = [];

  for (const g of GUION_EJEMPLO) {
    const v = vehiculos.find((x) => x.id === g.vehiculoId);
    if (!v) continue;

    const telefono = normalizarTelefono(g.telefono);
    let persona = personas.get(telefono);
    if (!persona) {
      persona = {
        id: nuevoId('per'),
        nombreApellido: g.nombre,
        cedula: g.cedula,
        telefonoWhatsApp: telefono,
        correo: g.correo,
        canalOrigen: 'ejemplo',
        criterioResolucion: g.cedula ? 'cedula' : 'nueva',
        fechaCreacion: hace(g.capturada),
      };
      personas.set(telefono, persona);
    } else if (hace(g.capturada) < persona.fechaCreacion) {
      persona.fechaCreacion = hace(g.capturada);
    }
    if (g.correo && !persona.correo) persona.correo = g.correo;

    const ultima = g.ruta[g.ruta.length - 1];
    const etapa: Etapa = ultima ? ultima[0] : 'nuevo';
    const terminal = definicionEtapa(etapa).esTerminal;

    const oportunidad: Oportunidad = {
      id: nuevoId('opo'),
      personaId: persona.id,
      vehiculoId: v.id,
      vehiculoResumen: {
        marca: v.marca,
        modelo: v.modelo,
        version: v.version,
        anio: v.anio,
        precioUSD: v.precio,
        foto: v.foto,
      },
      etapa,
      modalidadPago: g.modalidad,
      valorEstimadoUSD: v.precio,
      asesorId: null,
      proximaAccion: g.proxima?.[0],
      proximaAccionFecha: g.proxima ? fechaLocal(g.proxima[1]) : undefined,
      motivoPerdida: etapa === 'cerrado_perdido' ? g.motivo : undefined,
      fechaCreacion: hace(g.capturada),
      fechaCierre: terminal && ultima ? hace(ultima[1]) : undefined,
    };
    oportunidades.push(oportunidad);

    historial.push({
      id: nuevoId('evt'),
      oportunidadId: oportunidad.id,
      etapaAnterior: null,
      etapaNueva: 'nuevo',
      nota: 'Dato de ejemplo.',
      actorId: null,
      ts: hace(g.capturada),
    });
    let anterior: Etapa = 'nuevo';
    for (const [siguiente, dias] of g.ruta) {
      historial.push({
        id: nuevoId('evt'),
        oportunidadId: oportunidad.id,
        etapaAnterior: anterior,
        etapaNueva: siguiente,
        actorId: null,
        ts: hace(dias),
      });
      anterior = siguiente;
    }

    for (const [nota, dias, canal] of g.notas ?? []) {
      interacciones.push({
        id: nuevoId('int'),
        personaId: persona.id,
        oportunidadId: oportunidad.id,
        canal,
        direccion: canal === 'presencial' ? 'entrante' : 'saliente',
        nota,
        autorId: null,
        ocurridoEn: hace(dias),
        registradoEn: hace(dias),
      });
    }

    const estadoCita: Cita['estado'] =
      etapa === 'nuevo' || etapa === 'contactado'
        ? 'pendiente'
        : etapa === 'cerrado_perdido'
          ? 'descartada'
          : 'confirmada';
    citas.push({
      id: nuevoId('cita'),
      personaId: persona.id,
      oportunidadId: oportunidad.id,
      vehiculoId: v.id,
      diaPreferencia: fechaLocal(-g.capturada + 2),
      franjaHoraria: 'Mañana',
      estado: estadoCita,
      fechaCreacion: hace(g.capturada),
      notificadoA: CORREO_NOTIFICACIONES_WAMMA,
    });

    if (etapa === 'cerrado_ganado') estadosVehiculo.push([v.id, 'vendido']);
    else if (!terminal) estadosVehiculo.push([v.id, 'cita_agendada']);
  }

  const masRecienteAntes = <T extends { fechaCreacion: string }>(a: T, b: T) =>
    b.fechaCreacion.localeCompare(a.fechaCreacion);

  return {
    estado: {
      personas: [...personas.values()],
      oportunidades: oportunidades.sort(masRecienteAntes),
      interacciones,
      historial,
      citas: citas.sort(masRecienteAntes),
    },
    estadosVehiculo,
  };
}

// ── Proveedor ────────────────────────────────────────────────────────────────

export const ProveedorCRM: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vehiculos, cambiarEstadoVehiculo } = useVehiculos();

  // Inicializador diferido: sin esto, `cargarEstadoInicial` leería localStorage
  // en cada render, no solo en el primero.
  const [inicial] = useState(cargarEstadoInicial);
  const [personas, setPersonas] = useState<Persona[]>(inicial.personas);
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>(inicial.oportunidades);
  const [interacciones, setInteracciones] = useState<Interaccion[]>(inicial.interacciones);
  const [historial, setHistorial] = useState<EventoEtapa[]>(inicial.historial);
  const [citas, setCitas] = useState<Cita[]>(inicial.citas);

  useEffect(() => guardar(CLAVE_PERSONAS, personas), [personas]);
  useEffect(() => guardar(CLAVE_OPORTUNIDADES, oportunidades), [oportunidades]);
  useEffect(() => guardar(CLAVE_INTERACCIONES, interacciones), [interacciones]);
  useEffect(() => guardar(CLAVE_HISTORIAL, historial), [historial]);
  useEffect(() => guardar(CLAVE_CITAS, citas), [citas]);

  // ── Consultas ──────────────────────────────────────────────────────────────

  const obtenerPersona = (id: string) => personas.find((p) => p.id === id);
  const obtenerOportunidad = (id: string) => oportunidades.find((o) => o.id === id);
  const oportunidadesDePersona = (personaId: string) =>
    oportunidades.filter((o) => o.personaId === personaId);

  const interaccionesDePersona = (personaId: string) =>
    interacciones
      .filter((i) => i.personaId === personaId)
      .sort((a, b) => new Date(b.ocurridoEn).getTime() - new Date(a.ocurridoEn).getTime());

  const historialDeOportunidad = (oportunidadId: string) =>
    historial
      .filter((h) => h.oportunidadId === oportunidadId)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  const ultimaActividad = (oportunidadId: string): string => {
    const oportunidad = obtenerOportunidad(oportunidadId);
    const candidatos = [
      oportunidad?.fechaCreacion,
      // Un intento de transición rechazado no es actividad con el cliente: si
      // contara, reiniciaría el reloj de estancamiento sin que nadie lo atendiera.
      ...historial
        .filter((h) => h.oportunidadId === oportunidadId && h.etapaAnterior !== h.etapaNueva)
        .map((h) => h.ts),
      ...interacciones.filter((i) => i.oportunidadId === oportunidadId).map((i) => i.ocurridoEn),
    ].filter((v): v is string => Boolean(v));

    if (candidatos.length === 0) return new Date().toISOString();
    return candidatos.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
  };

  // ── Escrituras internas ────────────────────────────────────────────────────

  const registrarEvento = (oportunidadId: string, anterior: Etapa | null, nueva: Etapa, nota?: string) => {
    setHistorial((prev) => [
      ...prev,
      {
        id: nuevoId('evt'),
        oportunidadId,
        etapaAnterior: anterior,
        etapaNueva: nueva,
        nota,
        actorId: null,
        ts: new Date().toISOString(),
      },
    ]);
  };

  /**
   * Libera el vehículo solo si ninguna otra oportunidad abierta lo reclama
   * (`plan.md` §4). Si dos personas negocian el mismo auto y una se cae, el
   * vehículo no debe volver al catálogo.
   */
  const liberarVehiculoSiNadieLoReclama = (vehiculoId: string, oportunidadExcluida: string) => {
    const reclamado = oportunidades.some(
      (o) =>
        o.vehiculoId === vehiculoId &&
        o.id !== oportunidadExcluida &&
        o.etapa !== 'cerrado_ganado' &&
        o.etapa !== 'cerrado_perdido',
    );
    if (!reclamado) cambiarEstadoVehiculo(vehiculoId, 'disponible');
  };

  // ── Embudo ─────────────────────────────────────────────────────────────────

  const cambiarEtapa = (oportunidadId: string, nueva: Etapa, opciones: OpcionesTransicion = {}) => {
    const oportunidad = obtenerOportunidad(oportunidadId);
    if (!oportunidad) return { ok: false, error: 'La oportunidad no existe.' };

    const evaluacion = evaluarTransicion(oportunidad.etapa, nueva);
    if (!evaluacion.permitida) {
      // El intento rechazado también se registra (`spec.md` CA-010.3).
      registrarEvento(
        oportunidadId,
        oportunidad.etapa,
        oportunidad.etapa,
        `Transición rechazada a "${nueva}": ${evaluacion.razon}`,
      );
      return { ok: false, error: evaluacion.razon };
    }
    if (evaluacion.exigeMotivo && !opciones.motivoPerdida) {
      return { ok: false, error: 'Cerrar como perdida exige un motivo.' };
    }
    if (evaluacion.exigeNota && !opciones.nota?.trim()) {
      return { ok: false, error: 'Retroceder de etapa exige una nota que lo explique.' };
    }

    const ahora = new Date().toISOString();
    setOportunidades((prev) =>
      prev.map((o) =>
        o.id === oportunidadId
          ? {
              ...o,
              etapa: nueva,
              motivoPerdida: nueva === 'cerrado_perdido' ? opciones.motivoPerdida : undefined,
              motivoPerdidaTexto: nueva === 'cerrado_perdido' ? opciones.motivoPerdidaTexto : undefined,
              fechaCierre: nueva === 'cerrado_ganado' || nueva === 'cerrado_perdido' ? ahora : undefined,
            }
          : o,
      ),
    );
    registrarEvento(oportunidadId, oportunidad.etapa, nueva, opciones.nota);

    // Efectos sobre el inventario (`spec.md` RF-010.12).
    if (nueva === 'cerrado_ganado') {
      cambiarEstadoVehiculo(oportunidad.vehiculoId, 'vendido');
    } else if (nueva === 'cerrado_perdido') {
      liberarVehiculoSiNadieLoReclama(oportunidad.vehiculoId, oportunidadId);
    }

    return { ok: true };
  };

  // ── Captura ────────────────────────────────────────────────────────────────

  /**
   * Resuelve la persona por teléfono normalizado. La cédula no se pide en este
   * paso, así que el teléfono es la única clave disponible (`spec.md` §8.5).
   *
   * Busca en **todos** los teléfonos de cada persona, no solo en el principal:
   * si no, una persona fusionada se volvería a partir en dos en cuanto el
   * cliente escribiera desde su otro número.
   */
  const resolverPersonaPorTelefono = (datos: DatosNuevaCita): { persona: Persona; esNueva: boolean } => {
    const telefono = normalizarTelefono(datos.telefonoWhatsApp);
    const existente = personas.find((p) => telefonosDe(p).includes(telefono));
    if (existente) return { persona: existente, esNueva: false };

    const persona: Persona = {
      id: nuevoId('per'),
      nombreApellido: datos.nombreApellido.trim(),
      telefonoWhatsApp: telefono,
      correo: datos.correo?.trim() || undefined,
      canalOrigen: 'vitrina_web',
      criterioResolucion: 'nueva',
      fechaCreacion: new Date().toISOString(),
    };
    return { persona, esNueva: true };
  };

  const agendarCita = (datos: DatosNuevaCita) => {
    const { persona, esNueva } = resolverPersonaPorTelefono(datos);
    if (esNueva) {
      setPersonas((prev) => [persona, ...prev]);
    } else if (datos.correo?.trim() && !persona.correo) {
      // Un dato nuevo que el cliente aporta no se pierde por reconocerlo.
      const correo = datos.correo.trim();
      setPersonas((prev) => prev.map((p) => (p.id === persona.id ? { ...p, correo } : p)));
    }

    const v = datos.vehiculo;
    const oportunidad: Oportunidad = {
      id: nuevoId('opo'),
      personaId: persona.id,
      vehiculoId: v.id,
      vehiculoResumen: {
        marca: v.marca,
        modelo: v.modelo,
        version: v.version,
        anio: v.anio,
        precioUSD: v.precio,
        foto: v.foto,
      },
      etapa: 'nuevo',
      modalidadPago: datos.modalidadPago,
      valorEstimadoUSD: v.precio,
      asesorId: null,
      fechaCreacion: new Date().toISOString(),
    };
    setOportunidades((prev) => [oportunidad, ...prev]);
    registrarEvento(oportunidad.id, null, 'nuevo', 'Captura desde el catálogo público.');

    const cita: Cita = {
      id: nuevoId('cita'),
      personaId: persona.id,
      oportunidadId: oportunidad.id,
      vehiculoId: v.id,
      diaPreferencia: datos.diaPreferencia,
      franjaHoraria: datos.franjaHoraria,
      estado: 'pendiente',
      fechaCreacion: new Date().toISOString(),
      notificadoA: CORREO_NOTIFICACIONES_WAMMA,
    };
    setCitas((prev) => [cita, ...prev]);

    // Se bloquea el vehículo para que otros no agenden sobre lo mismo.
    cambiarEstadoVehiculo(v.id, 'cita_agendada');

    return { cita, oportunidad, persona };
  };

  /**
   * Consolidación al llegar la cédula (`plan.md` §5.1). Tres desenlaces: se
   * adjunta, ya la tiene, o hay dos registros que son la misma gente y se fusionan.
   */
  const confirmarCita = (
    citaId: string,
    cedulaCruda: string,
    extra: DatosConfirmacion = {},
  ): ResultadoConfirmacion => {
    const cita = citas.find((c) => c.id === citaId);
    if (!cita) return { ok: false, error: 'La cita no existe.' };

    const cedula = normalizarCedula(cedulaCruda);
    if (!cedula) return { ok: false, error: 'La cédula es obligatoria para confirmar la cita.' };

    const actual = personas.find((p) => p.id === cita.personaId);
    if (!actual) return { ok: false, error: 'La persona de la cita no existe.' };

    // Un correo que el cliente aporta al confirmar no se pierde.
    const correo = extra.correo?.trim() || undefined;
    // El día y el horario acordados por WhatsApp pueden diferir de los que pidió
    // al agendar: la cita confirmada guarda los acordados.
    const confirmada = (c: Cita): Cita => ({
      ...c,
      estado: 'confirmada',
      diaPreferencia: extra.dia || c.diaPreferencia,
      franjaHoraria: extra.franja ?? c.franjaHoraria,
    });

    const otra = personas.find((p) => p.cedula === cedula && p.id !== actual.id);
    let fusionada = false;

    if (otra) {
      // Sobrevive la más antigua: su id es el que ya referencian más registros.
      const [sobrevive, absorbida] =
        new Date(otra.fechaCreacion) <= new Date(actual.fechaCreacion) ? [otra, actual] : [actual, otra];

      // El principal pasa a ser el teléfono de la cita más reciente de cualquiera
      // de las dos: si el cliente agendó con un número nuevo, por ahí quiere que
      // lo contacten. Ningún teléfono se descarta.
      const masReciente = citas
        .filter((c) => c.personaId === sobrevive.id || c.personaId === absorbida.id)
        .reduce<Cita | undefined>((a, c) => (!a || c.fechaCreacion > a.fechaCreacion ? c : a), undefined);
      const deLaMasReciente = masReciente?.personaId === absorbida.id ? absorbida : sobrevive;
      const todos = Array.from(
        new Set([...telefonosDe(deLaMasReciente), ...telefonosDe(sobrevive), ...telefonosDe(absorbida)]),
      );
      const principal = todos[0] ?? sobrevive.telefonoWhatsApp;
      const adicionales = todos.slice(1);

      // Copia íntegra de lo absorbido y de lo que se le reasigna: sin esto la
      // fusión sería irreversible (`plan.md` §5).
      const copia: PersonaAbsorbida = {
        id: absorbida.id,
        nombreApellido: absorbida.nombreApellido,
        cedula: absorbida.cedula,
        telefonoWhatsApp: absorbida.telefonoWhatsApp,
        telefonosAdicionales: absorbida.telefonosAdicionales,
        correo: absorbida.correo,
        fechaCreacion: absorbida.fechaCreacion,
        fusionadaEn: new Date().toISOString(),
        oportunidadIds: oportunidades.filter((o) => o.personaId === absorbida.id).map((o) => o.id),
        citaIds: citas.filter((c) => c.personaId === absorbida.id).map((c) => c.id),
        interaccionIds: interacciones.filter((i) => i.personaId === absorbida.id).map((i) => i.id),
      };

      setOportunidades((prev) =>
        prev.map((o) => (o.personaId === absorbida.id ? { ...o, personaId: sobrevive.id } : o)),
      );
      setInteracciones((prev) =>
        prev.map((i) => (i.personaId === absorbida.id ? { ...i, personaId: sobrevive.id } : i)),
      );
      setCitas((prev) =>
        prev.map((c) => {
          const personaId = c.personaId === absorbida.id ? sobrevive.id : c.personaId;
          const conPersona = { ...c, personaId };
          return c.id === citaId ? confirmada(conPersona) : conPersona;
        }),
      );
      setPersonas((prev) =>
        prev
          .filter((p) => p.id !== absorbida.id)
          .map((p) =>
            p.id === sobrevive.id
              ? {
                  ...p,
                  cedula,
                  criterioResolucion: 'cedula' as const,
                  telefonoWhatsApp: principal,
                  telefonosAdicionales: adicionales.length > 0 ? adicionales : undefined,
                  correo: correo ?? p.correo ?? absorbida.correo,
                  fusionadaDesde: [...(p.fusionadaDesde ?? []), ...(absorbida.fusionadaDesde ?? []), copia],
                }
              : p,
          ),
      );
      fusionada = true;
    } else {
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === actual.id
            ? { ...p, cedula, criterioResolucion: 'cedula' as const, correo: correo ?? p.correo }
            : p,
        ),
      );
      setCitas((prev) => prev.map((c) => (c.id === citaId ? confirmada(c) : c)));
    }

    const oportunidad = obtenerOportunidad(cita.oportunidadId);
    const evaluacion = oportunidad ? evaluarTransicion(oportunidad.etapa, 'cita_confirmada') : null;
    // Solo avanza: si la oportunidad ya está más adelante (p. ej. movida desde el
    // embudo), confirmar la cita no la hace retroceder sin la nota que exige un
    // retroceso.
    if (oportunidad && evaluacion?.permitida && !evaluacion.exigeNota) {
      setOportunidades((prev) =>
        prev.map((o) => (o.id === oportunidad.id ? { ...o, etapa: 'cita_confirmada' } : o)),
      );
      registrarEvento(oportunidad.id, oportunidad.etapa, 'cita_confirmada', 'Cita confirmada con el cliente.');
    }

    return { ok: true, fusionada };
  };

  const descartarCita = (citaId: string, motivo: MotivoPerdida, texto?: string) => {
    const cita = citas.find((c) => c.id === citaId);
    if (!cita) return;

    setCitas((prev) => prev.map((c) => (c.id === citaId ? { ...c, estado: 'descartada' } : c)));
    cambiarEtapa(cita.oportunidadId, 'cerrado_perdido', {
      motivoPerdida: motivo,
      motivoPerdidaTexto: texto,
    });
  };

  /**
   * «Vender Vehículo», solo después de «Asistió» (`spec.md` §8.8).
   *
   * De contado cierra la venta y el auto pasa a vendido. Financiado deja la
   * oportunidad en negociación, el auto reservado y emite el enlace personal
   * de solicitud de crédito; la venta se cierra desde el embudo cuando se
   * apruebe el crédito. La forma de pago se confirma aquí porque puede haber
   * cambiado desde que el cliente agendó.
   */
  const venderVehiculo = (oportunidadId: string, modalidad: 'Contado' | 'Financiamiento'): ResultadoVenta => {
    const oportunidad = obtenerOportunidad(oportunidadId);
    if (!oportunidad) return { ok: false, error: 'La oportunidad no existe.' };
    if (oportunidad.etapa !== 'visito' && oportunidad.etapa !== 'negociacion') {
      return { ok: false, error: 'Primero hay que registrar que el cliente asistió a la cita.' };
    }

    if (modalidad !== oportunidad.modalidadPago) {
      setOportunidades((prev) =>
        prev.map((o) => (o.id === oportunidadId ? { ...o, modalidadPago: modalidad } : o)),
      );
    }

    if (modalidad === 'Contado') {
      return cambiarEtapa(oportunidadId, 'cerrado_ganado', {
        nota: 'Venta de contado cerrada desde la bandeja de citas.',
      });
    }

    if (oportunidad.etapa === 'visito') {
      const resultado = cambiarEtapa(oportunidadId, 'negociacion', {
        nota: 'Venta acordada con financiamiento: se emitió el enlace personal de solicitud.',
      });
      if (!resultado.ok) return resultado;
    }

    // Si ya se había emitido, se reutiliza: el cliente puede tener el primero.
    const token = oportunidad.enlaceFinanciamiento?.token ?? generarTokenFinanciamiento();
    if (!oportunidad.enlaceFinanciamiento) {
      const emitidoEn = new Date().toISOString();
      setOportunidades((prev) =>
        prev.map((o) => (o.id === oportunidadId ? { ...o, enlaceFinanciamiento: { token, emitidoEn } } : o)),
      );
    }
    return { ok: true, token };
  };

  const registrarInteraccion = (datos: DatosInteraccion): Interaccion => {
    const ahora = new Date().toISOString();
    const interaccion: Interaccion = {
      id: nuevoId('int'),
      personaId: datos.personaId,
      oportunidadId: datos.oportunidadId,
      canal: datos.canal,
      direccion: datos.direccion,
      nota: datos.nota.trim(),
      autorId: null,
      ocurridoEn: ahora,
      registradoEn: ahora,
    };
    setInteracciones((prev) => [interaccion, ...prev]);
    return interaccion;
  };

  const asignarAsesor = (oportunidadId: string, asesorId: string | null) => {
    setOportunidades((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, asesorId } : o)));
  };

  const fijarProximaAccion = (oportunidadId: string, accion: string, fecha: string) => {
    setOportunidades((prev) =>
      prev.map((o) =>
        o.id === oportunidadId ? { ...o, proximaAccion: accion, proximaAccionFecha: fecha } : o,
      ),
    );
  };

  const restablecerDatosDemo = () => {
    [CLAVE_PERSONAS, CLAVE_OPORTUNIDADES, CLAVE_INTERACCIONES, CLAVE_HISTORIAL, CLAVE_CITAS].forEach(
      (c) => localStorage.removeItem(c),
    );
    setPersonas([]);
    setOportunidades([]);
    setInteracciones([]);
    setHistorial([]);
    setCitas([]);
  };

  const cargarDatosEjemplo = () => {
    const { estado, estadosVehiculo } = construirEjemplo(vehiculos);
    setPersonas((prev) => [...estado.personas, ...prev]);
    setOportunidades((prev) => [...estado.oportunidades, ...prev]);
    setInteracciones((prev) => [...estado.interacciones, ...prev]);
    setHistorial((prev) => [...prev, ...estado.historial]);
    setCitas((prev) => [...estado.citas, ...prev]);
    // Coherencia con el catálogo: una oportunidad abierta reserva el auto y una
    // venta cerrada lo marca vendido, igual que en el flujo real.
    estadosVehiculo.forEach(([id, e]) => cambiarEstadoVehiculo(id, e));
  };

  return (
    <CRMContext.Provider
      value={{
        personas,
        oportunidades,
        interacciones,
        historial,
        citas,
        obtenerPersona,
        obtenerOportunidad,
        oportunidadesDePersona,
        interaccionesDePersona,
        historialDeOportunidad,
        ultimaActividad,
        agendarCita,
        confirmarCita,
        descartarCita,
        cambiarEtapa,
        registrarInteraccion,
        asignarAsesor,
        fijarProximaAccion,
        restablecerDatosDemo,
        cargarDatosEjemplo,
        venderVehiculo,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};
