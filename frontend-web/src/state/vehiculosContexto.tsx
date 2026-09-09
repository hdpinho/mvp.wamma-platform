import React, { createContext, useContext, useState, useEffect } from 'react';
import type { VehiculoData, Imperfeccion, CitaSolicitud } from '../types/vehiculo';
import { mockVehiculos } from '../mocks/vehiculos';
import { imperfeccionesPorVehiculo as mockImperfecciones } from '../mocks/imperfecciones';

const STORAGE_KEY_VEHICULOS = 'wamma_inventario_vehiculos_v1';
const STORAGE_KEY_IMPERFECCIONES = 'wamma_imperfecciones_v1';
const STORAGE_KEY_CITAS = 'wamma_citas_v1';

export const CORREO_NOTIFICACIONES_WAMMA = 'pjjulio@gmail.com';

interface VehiculosContextType {
  vehiculos: VehiculoData[];
  citas: CitaSolicitud[];
  notificacionReciente: CitaSolicitud | null;
  limpiarNotificacion: () => void;
  obtenerVehiculo: (id: string) => VehiculoData | undefined;
  obtenerImperfecciones: (vehiculoId: string) => Imperfeccion[];
  agendarCita: (
    datos: Omit<CitaSolicitud, 'id' | 'fechaCreacion' | 'estado' | 'notificadoA'>,
  ) => CitaSolicitud;
  cambiarEstadoVehiculo: (
    vehiculoId: string,
    nuevoEstado: 'disponible' | 'cita_agendada' | 'vendido',
  ) => void;
  guardarVehiculo: (vehiculo: VehiculoData, imperfecciones?: Imperfeccion[]) => void;
  eliminarVehiculo: (vehiculoId: string) => void;
  actualizarCita: (
    citaId: string,
    nuevoEstado: 'pendiente' | 'confirmada' | 'descartada',
  ) => void;
  descartarCitaYLiberarVehiculo: (citaId: string) => void;
  restablecerDatosDemo: () => void;
}

const VehiculosContext = createContext<VehiculosContextType | undefined>(undefined);

export const ProveedorVehiculos: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inicialización desde localStorage o mocks
  const [vehiculos, setVehiculos] = useState<VehiculoData[]>(() => {
    try {
      const guardados = localStorage.getItem(STORAGE_KEY_VEHICULOS);
      if (guardados) {
        return JSON.parse(guardados);
      }
    } catch {
      // Fallback a mocks
    }
    return mockVehiculos.map((v) => ({
      ...v,
      estadoDisponibilidad: v.estadoDisponibilidad || 'disponible',
    }));
  });

  const [imperfecciones, setImperfecciones] = useState<Record<string, Imperfeccion[]>>(() => {
    try {
      const guardadas = localStorage.getItem(STORAGE_KEY_IMPERFECCIONES);
      if (guardadas) {
        return JSON.parse(guardadas);
      }
    } catch {
      // Fallback
    }
    return mockImperfecciones;
  });

  const [citas, setCitas] = useState<CitaSolicitud[]>(() => {
    try {
      const guardadas = localStorage.getItem(STORAGE_KEY_CITAS);
      if (guardadas) {
        return JSON.parse(guardadas);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [notificacionReciente, setNotificacionReciente] = useState<CitaSolicitud | null>(null);

  // Sincronización persistente en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VEHICULOS, JSON.stringify(vehiculos));
    } catch (e) {
      console.warn('No se pudo guardar vehiculos en localStorage', e);
    }
  }, [vehiculos]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_IMPERFECCIONES, JSON.stringify(imperfecciones));
    } catch (e) {
      console.warn('No se pudo guardar imperfecciones en localStorage', e);
    }
  }, [imperfecciones]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CITAS, JSON.stringify(citas));
    } catch (e) {
      console.warn('No se pudo guardar citas en localStorage', e);
    }
  }, [citas]);

  const obtenerVehiculo = (id: string) => {
    return vehiculos.find((v) => v.id === id);
  };

  const obtenerImperfecciones = (vehiculoId: string): Imperfeccion[] => {
    return imperfecciones[vehiculoId] || [];
  };

  const limpiarNotificacion = () => setNotificacionReciente(null);

  /**
   * Registra una cita, actualiza el estado del auto a 'cita_agendada'
   * deshabilitando el botón para otros usuarios y despacha la notificación a WAMMA.
   */
  const agendarCita = (
    datos: Omit<CitaSolicitud, 'id' | 'fechaCreacion' | 'estado' | 'notificadoA'>,
  ): CitaSolicitud => {
    const nuevaCita: CitaSolicitud = {
      ...datos,
      id: `cita-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      fechaCreacion: new Date().toISOString(),
      estado: 'pendiente',
      notificadoA: CORREO_NOTIFICACIONES_WAMMA,
    };

    setCitas((prev) => [nuevaCita, ...prev]);

    // Marcar vehículo con cita_agendada para bloquear agendamiento a otros
    setVehiculos((prev) =>
      prev.map((v) =>
        v.id === datos.vehiculoId
          ? { ...v, estadoDisponibilidad: 'cita_agendada' as const }
          : v,
      ),
    );

    // Activar notificación para feedback visual y simulación de correo
    setNotificacionReciente(nuevaCita);

    return nuevaCita;
  };

  const cambiarEstadoVehiculo = (
    vehiculoId: string,
    nuevoEstado: 'disponible' | 'cita_agendada' | 'vendido',
  ) => {
    setVehiculos((prev) =>
      prev.map((v) =>
        v.id === vehiculoId ? { ...v, estadoDisponibilidad: nuevoEstado } : v,
      ),
    );
  };

  const guardarVehiculo = (vehiculo: VehiculoData, nuevasImperfecciones?: Imperfeccion[]) => {
    setVehiculos((prev) => {
      const existe = prev.some((v) => v.id === vehiculo.id);
      if (existe) {
        return prev.map((v) => (v.id === vehiculo.id ? vehiculo : v));
      }
      return [vehiculo, ...prev];
    });

    if (nuevasImperfecciones) {
      setImperfecciones((prev) => ({
        ...prev,
        [vehiculo.id]: nuevasImperfecciones,
      }));
    }
  };

  const eliminarVehiculo = (vehiculoId: string) => {
    setVehiculos((prev) => prev.filter((v) => v.id !== vehiculoId));
    setImperfecciones((prev) => {
      const copia = { ...prev };
      delete copia[vehiculoId];
      return copia;
    });
  };

  const actualizarCita = (
    citaId: string,
    nuevoEstado: 'pendiente' | 'confirmada' | 'descartada',
  ) => {
    setCitas((prev) =>
      prev.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c)),
    );
  };

  /**
   * Si la cita no se concreta, el backoffice puede descartarla
   * y rehabilitar el vehículo para que vuelva a estar 'disponible'.
   */
  const descartarCitaYLiberarVehiculo = (citaId: string) => {
    const cita = citas.find((c) => c.id === citaId);
    if (!cita) return;

    actualizarCita(citaId, 'descartada');
    cambiarEstadoVehiculo(cita.vehiculoId, 'disponible');
  };

  const restablecerDatosDemo = () => {
    localStorage.removeItem(STORAGE_KEY_VEHICULOS);
    localStorage.removeItem(STORAGE_KEY_IMPERFECCIONES);
    localStorage.removeItem(STORAGE_KEY_CITAS);
    setVehiculos(
      mockVehiculos.map((v) => ({
        ...v,
        estadoDisponibilidad: 'disponible',
      })),
    );
    setImperfecciones(mockImperfecciones);
    setCitas([]);
    setNotificacionReciente(null);
  };

  return (
    <VehiculosContext.Provider
      value={{
        vehiculos,
        citas,
        notificacionReciente,
        limpiarNotificacion,
        obtenerVehiculo,
        obtenerImperfecciones,
        agendarCita,
        cambiarEstadoVehiculo,
        guardarVehiculo,
        eliminarVehiculo,
        actualizarCita,
        descartarCitaYLiberarVehiculo,
        restablecerDatosDemo,
      }}
    >
      {children}
    </VehiculosContext.Provider>
  );
};

export const useVehiculos = () => {
  const context = useContext(VehiculosContext);
  if (!context) {
    throw new Error('useVehiculos debe usarse dentro de un ProveedorVehiculos');
  }
  return context;
};
