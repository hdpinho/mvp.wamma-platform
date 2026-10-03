import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiConfigurada, mensajeDeError } from '../api/cliente';
import { PARAMETROS_APROBADOS, calcularCuota, type ParametrosFinanciamiento } from '../services/financiamientoMotor';
import { obtenerParametrosFinanciamiento } from '../services/parametrosFinanciamiento';
import { ParametrosContext } from './parametrosContexto';

/**
 * Proveedor de la política de financiamiento: una sola lectura al arrancar, compartida por todas las pantallas.
 * Antes cada simulador la pedía por su cuenta y la vitrina calculaba la cuota «desde» con constantes del código, de
 * modo que cambiar la política en el backoffice no se reflejaba en las tarjetas.
 */

const cuotaMasAlta = (precio: number, parametros: ParametrosFinanciamiento): number | null => {
  if (!Number.isFinite(precio) || precio <= 0) return null;
  const inicialMasAlta = Math.max(...parametros.opcionesInicial);
  const cuota = calcularCuota(precio, inicialMasAlta, parametros);
  return cuota > 0 ? cuota : null;
};

export const ProveedorParametros: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sin servidor no hay nada que leer: rige la política aprobada (D-26).
  const [parametros, setParametros] = useState<ParametrosFinanciamiento | null>(
    apiConfigurada ? null : PARAMETROS_APROBADOS,
  );
  const [cargando, setCargando] = useState(apiConfigurada);
  const [error, setError] = useState<string | null>(null);
  const [lectura, setLectura] = useState(0);

  // El estado cambia dentro de los callbacks de la promesa, nunca en el cuerpo del efecto.
  useEffect(() => {
    if (!apiConfigurada) return;
    let vigente = true;
    obtenerParametrosFinanciamiento()
      .then((leidos) => {
        if (!vigente) return;
        setParametros(leidos);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        // Sin valores de respaldo: si no se pueden leer, el cálculo queda no disponible.
        setParametros(null);
        setError(mensajeDeError(e, 'No se pudieron obtener los parámetros de crédito vigentes.'));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [lectura]);

  const recargar = useCallback(async () => {
    if (!apiConfigurada) return;
    setCargando(true);
    setLectura((n) => n + 1);
  }, []);

  const fijar = useCallback((nuevos: ParametrosFinanciamiento) => {
    setParametros(nuevos);
    setError(null);
  }, []);

  const valor = useMemo(
    () => ({
      parametros,
      cargando,
      error,
      recargar,
      fijar,
      cuotaDesde: (precio: number) => (parametros ? cuotaMasAlta(precio, parametros) : null),
    }),
    [parametros, cargando, error, recargar, fijar],
  );

  return <ParametrosContext.Provider value={valor}>{children}</ParametrosContext.Provider>;
};
