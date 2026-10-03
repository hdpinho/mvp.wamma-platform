import React, { useCallback, useEffect, useState } from 'react';
import { ErrorApi, mensajeDeError } from '../api/cliente';
import { crmApi } from '../api/crm';
import {
  citaDesdeApi,
  fichaDesdeApi,
  franjaDesdeApi,
  franjaParaApi,
  oportunidadDesdeApi,
  personaDesdeResumenApi,
  type Ficha,
} from '../api/crmAdaptadores';
import type { Cita, EventoEtapa, Interaccion, Oportunidad, Persona } from '../types/crm';
import type {
  Asesor,
  DatosConfirmacion,
  DatosInteraccion,
  DatosNuevaCita,
  EnlaceEmitido,
  OpcionesTransicion,
  ResultadoAgendamiento,
  ResultadoConfirmacion,
  ResultadoOperacion,
  ResultadoVenta,
} from './crmContexto';
import { CRMContext } from './crmContexto';
import { useSesion } from './sesionContexto';
import { useVehiculos } from './vehiculosContexto';
import type { Etapa, MotivoPerdida } from '../types/crm';

/**
 * Proveedor del seguimiento comercial **con servidor** — `specs/010-crm-comercial/`.
 *
 * El servidor es la fuente de verdad (hallazgos F-03, F-05 y F-06 del informe QA): esta capa solo muestra lo que él
 * devuelve. Cada acción se envía, se espera su respuesta y, si el servidor la rechaza (409, 422…), se muestra su
 * motivo; nada se da por hecho en pantalla antes de que el servidor lo confirme. Tras cada acción se relee lo
 * que puede haber cambiado, incluidos cambios de otras personas: por eso también se relee cada minuto mientras la
 * pestaña está a la vista.
 *
 * No guarda nada en el navegador (Principio I, hallazgo S-10): los datos personales existen en memoria solo mientras
 * dura la sesión, y al cerrarla se vacían. El enlace personal de financiamiento es la única excepción
 * deliberada en memoria: el servidor guarda su huella y solo lo entrega al emitirlo.
 */

const CLAVES_ANTERIORES = [
  'wamma_crm_personas_v2',
  'wamma_crm_oportunidades_v2',
  'wamma_crm_interacciones_v2',
  'wamma_crm_historial_v2',
  'wamma_crm_citas_v2',
  'wamma_citas_v1',
];

/** Borra la copia que dejaron versiones anteriores, que guardaban personas en el navegador. */
function borrarCopiaLocal() {
  for (const clave of CLAVES_ANTERIORES) {
    try {
      localStorage.removeItem(clave);
    } catch {
      // Navegador sin almacenamiento: no hay nada que borrar.
    }
  }
}

const RELECTURA_MS = 60_000;

interface Datos {
  personas: Persona[];
  oportunidades: Oportunidad[];
  citas: Cita[];
  asesores: Asesor[];
}

const VACIO: Datos = { personas: [], oportunidades: [], citas: [], asesores: [] };

export const ProveedorCRMServidor: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { estado, puede } = useSesion();
  const { recargar: recargarVehiculos } = useVehiculos();
  const activa = estado === 'activa';
  const puedeVerCrm = activa && puede('crm.ver_propias', 'crm.ver_todas');
  const puedeRepartir = activa && puede('crm.asignar');

  const [datos, setDatos] = useState<Datos>(VACIO);
  const [fichas, setFichas] = useState<Record<string, Ficha>>({});
  const [enlaces, setEnlaces] = useState<Record<string, EnlaceEmitido>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relectura, setRelectura] = useState(0);

  // Al cerrar la sesión no queda nada en memoria del usuario anterior (S-10): quien ingrese después en la misma pestaña
  // parte de cero y ve solo lo que el servidor le muestre. Se ajusta durante el render, no en un efecto.
  const [puedeVerAntes, setPuedeVerAntes] = useState(puedeVerCrm);
  if (puedeVerCrm !== puedeVerAntes) {
    setPuedeVerAntes(puedeVerCrm);
    if (puedeVerCrm) {
      setCargando(true);
    } else {
      setDatos(VACIO);
      setFichas({});
      setEnlaces({});
      setError(null);
    }
  }

  useEffect(() => {
    borrarCopiaLocal();
  }, [estado]);

  /** Lee todo lo que la bandeja, el embudo y las personas necesitan. No toca el estado: quien la llama decide. */
  const leer = useCallback(async (): Promise<Datos> => {
    const [citasApi, oportunidadesApi, personasApi, asesoresApi] = await Promise.all([
      crmApi.listarCitas(),
      crmApi.listarOportunidades({ limit: 1000 }),
      crmApi.buscarPersonas(undefined, 1000),
      puedeRepartir ? crmApi.listarAsesores() : Promise.resolve([]),
    ]);
    return {
      citas: citasApi.map(citaDesdeApi),
      oportunidades: oportunidadesApi.map(oportunidadDesdeApi),
      personas: personasApi.map(personaDesdeResumenApi),
      asesores: asesoresApi.map((a) => ({ id: a.id, nombre: a.nombre })),
    };
  }, [puedeRepartir]);

  // Carga inicial y relectura periódica. El estado cambia dentro de los callbacks de la promesa, nunca en el cuerpo del efecto.
  useEffect(() => {
    if (!puedeVerCrm) return;
    let vigente = true;
    leer()
      .then((leidos) => {
        if (!vigente) return;
        setDatos(leidos);
        setError(null);
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDeError(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [puedeVerCrm, leer, relectura]);

  useEffect(() => {
    if (!puedeVerCrm) return;
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') setRelectura((n) => n + 1);
    }, RELECTURA_MS);
    return () => clearInterval(intervalo);
  }, [puedeVerCrm]);

  /** Relee ahora mismo lo que cambió y devuelve lo leído, para decidir con datos frescos. */
  const refrescar = useCallback(async (): Promise<Datos | null> => {
    if (!puedeVerCrm) return null;
    try {
      const leidos = await leer();
      setDatos(leidos);
      setError(null);
      // Las fichas abiertas también pueden haber cambiado (una nota, una etapa, una fusión). Una que ya no se puede
      // leer (la persona se fusionó o dejó de ser visible) se quita: la pantalla la vuelve a pedir y dice por qué.
      await Promise.all(
        Object.keys(fichas).map(async (id) => {
          try {
            const detalle = await crmApi.obtenerPersona(id);
            setFichas((f) => ({ ...f, [id]: fichaDesdeApi(detalle) }));
          } catch {
            setFichas((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== id)));
          }
        }),
      );
      return leidos;
    } catch (e: unknown) {
      setError(mensajeDeError(e));
      return null;
    }
  }, [puedeVerCrm, leer, fichas]);

  const recargar = useCallback(async () => {
    setCargando(true);
    await refrescar();
    setCargando(false);
  }, [refrescar]);

  const cargarFicha = useCallback(async (personaId: string): Promise<ResultadoOperacion> => {
    try {
      const detalle = await crmApi.obtenerPersona(personaId);
      setFichas((f) => ({ ...f, [personaId]: fichaDesdeApi(detalle) }));
      return { ok: true };
    } catch (e: unknown) {
      // 404: la persona no existe o es de otro asesor; el servidor no distingue, y la pantalla tampoco.
      setFichas((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== personaId)));
      return { ok: false, error: mensajeDeError(e), estado: e instanceof ErrorApi ? e.estado : 0 };
    }
  }, []);

  // ── Consultas ──────────────────────────────────────────────────────────────

  const { personas, oportunidades, citas, asesores } = datos;

  const interacciones: Interaccion[] = Object.values(fichas).flatMap((f) => f.interacciones);
  const historial: EventoEtapa[] = Object.values(fichas).flatMap((f) => f.historial);

  // La ficha, cuando está cargada, trae todos los teléfonos y las fusiones; la lista solo el resumen.
  const obtenerPersona = (id: string): Persona | undefined => fichas[id]?.persona ?? personas.find((p) => p.id === id);
  const obtenerOportunidad = (id: string) => oportunidades.find((o) => o.id === id);
  const oportunidadesDePersona = (personaId: string) => oportunidades.filter((o) => o.personaId === personaId);

  const interaccionesDePersona = (personaId: string): Interaccion[] =>
    [...(fichas[personaId]?.interacciones ?? [])].sort(
      (a, b) => new Date(b.ocurridoEn).getTime() - new Date(a.ocurridoEn).getTime(),
    );

  const historialDeOportunidad = (oportunidadId: string): EventoEtapa[] =>
    historial
      .filter((h) => h.oportunidadId === oportunidadId)
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  /** La calcula el servidor: el último cambio de etapa, nota o la alta de la oportunidad. */
  const ultimaActividad = (oportunidadId: string): string => {
    const o = obtenerOportunidad(oportunidadId);
    return o?.ultimaActividadEn ?? o?.fechaCreacion ?? new Date().toISOString();
  };

  // ── Acciones ───────────────────────────────────────────────────────────────

  /**
   * Toda acción igual: se envía, se relee lo que pudo cambiar (con datos de otros también) y, si falló, se devuelve
   * el motivo del servidor. Tras un rechazo también se relee: un 409 o un 404 suelen significar que la pantalla
   * estaba desfasada.
   */
  const operar = async <T,>(
    accion: () => Promise<T>,
    { vehiculos = false }: { vehiculos?: boolean } = {},
  ): Promise<{ ok: true; valor: T; datos: Datos | null } | { ok: false; error: string }> => {
    try {
      const valor = await accion();
      const frescos = await refrescar();
      if (vehiculos) recargarVehiculos();
      return { ok: true, valor, datos: frescos };
    } catch (e: unknown) {
      await refrescar();
      if (vehiculos) recargarVehiculos();
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const agendarCita = async (d: DatosNuevaCita): Promise<ResultadoAgendamiento> => {
    // La captura pública no tiene sesión ni toca las listas del backoffice: solo envía y cuenta lo que el servidor confirmó.
    try {
      const r = await crmApi.agendarCitaPublica({
        nombreApellido: d.nombreApellido,
        telefonoWhatsApp: d.telefonoWhatsApp,
        correo: d.correo,
        modalidadPago: d.modalidadPago === 'Contado' ? 'contado' : 'financiamiento',
        vehiculoCodigo: d.vehiculo.id,
        diaPreferencia: d.diaPreferencia,
        franjaHoraria: franjaParaApi(d.franjaHoraria),
      });
      // El vehículo quedó reservado en el servidor: la vitrina lo relee para mostrarlo así.
      recargarVehiculos();
      return {
        ok: true,
        cita: { id: r.id, diaPreferencia: r.diaPreferencia, franjaHoraria: franjaDesdeApi(r.franjaHoraria) },
      };
    } catch (e: unknown) {
      if (e instanceof ErrorApi && e.estado === 409) recargarVehiculos();
      return { ok: false, error: mensajeDeError(e) };
    }
  };

  const confirmarCita = async (
    citaId: string,
    cedula: string,
    extra: DatosConfirmacion = {},
  ): Promise<ResultadoConfirmacion> => {
    const antes = citas.find((c) => c.id === citaId);
    const r = await operar(() =>
      crmApi.confirmarCita(citaId, {
        cedula,
        correo: extra.correo,
        dia: extra.dia,
        franja: extra.franja ? franjaParaApi(extra.franja) : undefined,
      }),
    );
    if (!r.ok) return r;
    // Si la cita pasó a otra persona, el servidor fusionó dos registros con la misma cédula.
    const despues = r.datos?.citas.find((c) => c.id === citaId);
    return { ok: true, fusionada: Boolean(antes && despues && antes.personaId !== despues.personaId) };
  };

  const descartarCita = async (citaId: string, motivo: MotivoPerdida, texto?: string): Promise<ResultadoOperacion> => {
    const r = await operar(() => crmApi.descartarCita(citaId, motivo, texto), { vehiculos: true });
    return r.ok ? { ok: true } : r;
  };

  const registrarAsistencia = async (citaId: string): Promise<ResultadoOperacion> => {
    const r = await operar(() => crmApi.registrarAsistenciaCita(citaId));
    return r.ok ? { ok: true } : r;
  };

  const cambiarEtapa = async (
    oportunidadId: string,
    nueva: Etapa,
    opciones: OpcionesTransicion = {},
  ): Promise<ResultadoOperacion> => {
    const oportunidad = obtenerOportunidad(oportunidadId);
    if (!oportunidad) return { ok: false, error: 'La oportunidad no existe.' };
    const r = await operar(
      () =>
        crmApi.cambiarEtapa(oportunidadId, oportunidad.version ?? 0, {
          etapa: nueva,
          motivo: opciones.motivoPerdida,
          detalle: opciones.motivoPerdidaTexto,
          nota: opciones.nota,
        }),
      // Cerrar una oportunidad reserva o libera el vehículo.
      { vehiculos: nueva === 'cerrado_ganado' || nueva === 'cerrado_perdido' },
    );
    return r.ok ? { ok: true } : r;
  };

  const venderVehiculo = async (
    oportunidadId: string,
    modalidad: 'Contado' | 'Financiamiento',
  ): Promise<ResultadoVenta> => {
    const r = await operar(() => crmApi.venderVehiculo(oportunidadId, modalidad === 'Contado' ? 'contado' : 'financiamiento'), {
      vehiculos: true,
    });
    if (!r.ok) return r;
    const token = r.valor.tokenFinanciamiento ?? undefined;
    if (token) {
      const emitidoEn = r.valor.oportunidad.enlaceEmitidoEn ?? new Date().toISOString();
      setEnlaces((actuales) => ({ ...actuales, [oportunidadId]: { token, emitidoEn } }));
    }
    return { ok: true, token };
  };

  const registrarInteraccion = async (d: DatosInteraccion): Promise<ResultadoOperacion> => {
    const r = await operar(() =>
      crmApi.registrarInteraccion(
        d.personaId,
        { oportunidadId: d.oportunidadId, canal: d.canal, direccion: d.direccion, nota: d.nota.trim() },
        crypto.randomUUID(),
      ),
    );
    return r.ok ? { ok: true } : r;
  };

  const tomarOportunidad = async (oportunidadId: string): Promise<ResultadoOperacion> => {
    const r = await operar(() => crmApi.asignarAsesor(oportunidadId));
    return r.ok ? { ok: true } : r;
  };

  const asignarAsesor = async (oportunidadId: string, asesorId: string): Promise<ResultadoOperacion> => {
    const r = await operar(() => crmApi.asignarAsesor(oportunidadId, asesorId));
    return r.ok ? { ok: true } : r;
  };

  const fijarProximaAccion = async (oportunidadId: string, accion: string, fecha: string): Promise<ResultadoOperacion> => {
    const r = await operar(() => crmApi.fijarProximaAccion(oportunidadId, accion, fecha));
    return r.ok ? { ok: true } : r;
  };

  return (
    <CRMContext.Provider
      value={{
        origen: 'servidor',
        cargando,
        error,
        recargar,
        personas,
        oportunidades,
        interacciones,
        historial,
        citas,
        asesores,
        obtenerPersona,
        obtenerOportunidad,
        oportunidadesDePersona,
        interaccionesDePersona,
        historialDeOportunidad,
        ultimaActividad,
        cargarFicha,
        enlaceEmitido: (oportunidadId) => enlaces[oportunidadId],
        agendarCita,
        confirmarCita,
        descartarCita,
        registrarAsistencia,
        cambiarEtapa,
        venderVehiculo,
        registrarInteraccion,
        tomarOportunidad,
        asignarAsesor,
        fijarProximaAccion,
        // Con servidor no hay demostración que restablecer ni datos de ejemplo que cargar.
        restablecerDatosDemo: () => {},
        cargarDatosEjemplo: () => {},
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};
