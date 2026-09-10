import React, { useState, useEffect } from 'react';
import type { Cita, Etapa, EventoEtapa, Interaccion, MotivoPerdida, Oportunidad, Persona, ResumenVehiculo } from '../types/crm';
import { evaluarTransicion, normalizarCedula, normalizarTelefono } from '../types/crm';
import { useVehiculos } from './vehiculosContexto';
import type {
  DatosInteraccion,
  DatosNuevaCita,
  OpcionesTransicion,
  ResultadoConfirmacion,
} from './crmContexto';
import { CORREO_NOTIFICACIONES_WAMMA, CRMContext } from './crmContexto';

/**
 * Proveedor del seguimiento comercial — tarea F1 de `specs/010-crm-comercial/tasks.md`.
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

/** Carga el estado: v2 si existe, migración de v1 si no, vacío en último caso. */
function cargarEstadoInicial(): EstadoCRM {
  const personasV2 = leer<Persona[] | null>(CLAVE_PERSONAS, null);
  if (personasV2) {
    return {
      personas: personasV2,
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

// ── Proveedor ────────────────────────────────────────────────────────────────

export const ProveedorCRM: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { cambiarEstadoVehiculo } = useVehiculos();

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
      ...historial.filter((h) => h.oportunidadId === oportunidadId).map((h) => h.ts),
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
   * vehículo no debe volver a la vitrina.
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
   */
  const resolverPersonaPorTelefono = (datos: DatosNuevaCita): { persona: Persona; esNueva: boolean } => {
    const telefono = normalizarTelefono(datos.telefonoWhatsApp);
    const existente = personas.find((p) => p.telefonoWhatsApp === telefono);
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
    if (esNueva) setPersonas((prev) => [persona, ...prev]);

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
        precioUSD: v.precioUSD,
        foto: v.foto,
      },
      etapa: 'nuevo',
      modalidadPago: datos.modalidadPago,
      valorEstimadoUSD: v.precioUSD,
      asesorId: null,
      fechaCreacion: new Date().toISOString(),
    };
    setOportunidades((prev) => [oportunidad, ...prev]);
    registrarEvento(oportunidad.id, null, 'nuevo', 'Captura desde la vitrina pública.');

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
  const confirmarCita = (citaId: string, cedulaCruda: string): ResultadoConfirmacion => {
    const cita = citas.find((c) => c.id === citaId);
    if (!cita) return { ok: false, error: 'La cita no existe.' };

    const cedula = normalizarCedula(cedulaCruda);
    if (!cedula) return { ok: false, error: 'La cédula es obligatoria para confirmar la cita.' };

    const actual = personas.find((p) => p.id === cita.personaId);
    if (!actual) return { ok: false, error: 'La persona de la cita no existe.' };

    const otra = personas.find((p) => p.cedula === cedula && p.id !== actual.id);
    let fusionada = false;

    if (otra) {
      // Sobrevive la más antigua; el historial de la otra se reasigna.
      const [sobrevive, absorbida] =
        new Date(otra.fechaCreacion) <= new Date(actual.fechaCreacion) ? [otra, actual] : [actual, otra];

      setOportunidades((prev) =>
        prev.map((o) => (o.personaId === absorbida.id ? { ...o, personaId: sobrevive.id } : o)),
      );
      setInteracciones((prev) =>
        prev.map((i) => (i.personaId === absorbida.id ? { ...i, personaId: sobrevive.id } : i)),
      );
      setCitas((prev) =>
        prev.map((c) => {
          const personaId = c.personaId === absorbida.id ? sobrevive.id : c.personaId;
          const estado = c.id === citaId ? ('confirmada' as const) : c.estado;
          return { ...c, personaId, estado };
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
                  fusionadaDesde: [...(p.fusionadaDesde ?? []), absorbida.id],
                }
              : p,
          ),
      );
      fusionada = true;
    } else {
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === actual.id ? { ...p, cedula, criterioResolucion: 'cedula' as const } : p,
        ),
      );
      setCitas((prev) => prev.map((c) => (c.id === citaId ? { ...c, estado: 'confirmada' } : c)));
    }

    const oportunidad = obtenerOportunidad(cita.oportunidadId);
    if (oportunidad && evaluarTransicion(oportunidad.etapa, 'cita_confirmada').permitida) {
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
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};
