import React, { createContext, useContext, useState, useEffect } from 'react';
import type { VehiculoData, Imperfeccion } from '../types/vehiculo';
import { mockVehiculos } from '../mocks/vehiculos';
import { imperfeccionesPorVehiculo as mockImperfecciones } from '../mocks/imperfecciones';

/**
 * Contexto del inventario: vehículos publicados y sus imperfecciones.
 *
 * Las citas y todo el seguimiento comercial viven en `crmContexto`
 * (tarea F1 de `specs/010-crm-comercial/tasks.md`). Este contexto llevaba
 * tres responsabilidades y añadirle personas y oportunidades lo habría
 * convertido en el cajón de sastre del proyecto (`plan.md` §7.1).
 */

const STORAGE_KEY_VEHICULOS = 'wamma_inventario_vehiculos_v1';
const STORAGE_KEY_IMPERFECCIONES = 'wamma_imperfecciones_v1';

export type EstadoDisponibilidad = 'disponible' | 'cita_agendada' | 'vendido';

interface VehiculosContextType {
  vehiculos: VehiculoData[];
  obtenerVehiculo: (id: string) => VehiculoData | undefined;
  obtenerImperfecciones: (vehiculoId: string) => Imperfeccion[];
  cambiarEstadoVehiculo: (vehiculoId: string, nuevoEstado: EstadoDisponibilidad) => void;
  guardarVehiculo: (vehiculo: VehiculoData, imperfecciones?: Imperfeccion[]) => void;
  eliminarVehiculo: (vehiculoId: string) => void;
  restablecerDatosDemo: () => void;
}

const VehiculosContext = createContext<VehiculosContextType | undefined>(undefined);

export const ProveedorVehiculos: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const obtenerVehiculo = (id: string) => {
    return vehiculos.find((v) => v.id === id);
  };

  const obtenerImperfecciones = (vehiculoId: string): Imperfeccion[] => {
    return imperfecciones[vehiculoId] || [];
  };

  /**
   * Estado de disponibilidad del auto. Es un eje distinto de la etapa de la
   * oportunidad y no deben fusionarse (`spec.md` §8.4): un mismo auto puede
   * tener una oportunidad perdida y otra en negociación.
   */
  const cambiarEstadoVehiculo = (vehiculoId: string, nuevoEstado: EstadoDisponibilidad) => {
    setVehiculos((prev) =>
      prev.map((v) => (v.id === vehiculoId ? { ...v, estadoDisponibilidad: nuevoEstado } : v)),
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

  const restablecerDatosDemo = () => {
    localStorage.removeItem(STORAGE_KEY_VEHICULOS);
    localStorage.removeItem(STORAGE_KEY_IMPERFECCIONES);
    setVehiculos(
      mockVehiculos.map((v) => ({
        ...v,
        estadoDisponibilidad: 'disponible',
      })),
    );
    setImperfecciones(mockImperfecciones);
  };

  return (
    <VehiculosContext.Provider
      value={{
        vehiculos,
        obtenerVehiculo,
        obtenerImperfecciones,
        cambiarEstadoVehiculo,
        guardarVehiculo,
        eliminarVehiculo,
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
