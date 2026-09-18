import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiConfigurada, ErrorApi } from '../api/cliente';
import { consultarCatalogo, type FotoApi, type ImperfeccionApi, type VehiculoVitrina } from '../api/catalogo';
import {
  actualizarVehiculo,
  cambiarDisponibilidad,
  crearVehiculo,
  eliminarVehiculo as eliminarEnServidor,
  listarInventario,
  obtenerVehiculoInventario,
  ordenarFotos as ordenarFotosEnServidor,
  pausarVehiculo as pausarEnServidor,
  publicarListos as publicarListosEnServidor,
  publicarVehiculo as publicarEnServidor,
  quitarFoto as quitarFotoEnServidor,
  subirFoto as subirFotoEnServidor,
  type VehiculoEntrada,
  type VehiculoInventario,
} from '../api/inventario';
import { mockVehiculos } from '../mocks/vehiculos';
import { imperfeccionesPorVehiculo as mockImperfecciones } from '../mocks/imperfecciones';
import { creditosFotos } from '../mocks/creditosFotos';
import {
  carroceriaAApi,
  carroceriaDesdeApi,
  combustibleAApi,
  combustibleDesdeApi,
  etiquetaAApi,
  etiquetaDesdeApi,
  transmisionAApi,
  transmisionDesdeApi,
} from '../types/inventario';
import type { FotoVehiculoData, Imperfeccion, VehiculoData, VehiculoMaqueta } from '../types/vehiculo';
import { useSesion } from './sesionContexto';
import {
  VehiculosContext,
  type EstadoDisponibilidad,
  type ResultadoPublicacionEnLote,
  type TasaVigente,
} from './vehiculosContexto';

/**
 * Proveedor del inventario, con dos fuentes:
 * <ul>
 *   <li><b>servidor</b>: la vitrina se lee de `/v1/catalogo` y, con sesión e `inventario.ver`,
 *       se añade el inventario completo (incluidos borradores y pausados);</li>
 *   <li><b>maqueta</b>: sin `VITE_API_URL`, sigue con los datos de ejemplo en el navegador.</li>
 * </ul>
 * Mientras el servidor despierta (plan gratuito de Render), la vitrina muestra la última
 * copia guardada en el navegador.
 *
 * Las citas y el seguimiento comercial viven en `crmContexto`.
 */

const CLAVE_VEHICULOS = 'wamma_inventario_vehiculos_v1';
const CLAVE_IMPERFECCIONES = 'wamma_imperfecciones_v1';
const CLAVE_CACHE = 'wamma_catalogo_cache_v2';

interface Cache {
  vehiculos: VehiculoData[];
  tasa: TasaVigente | null;
}

const leerCache = (): Cache | null => {
  try {
    const guardado = localStorage.getItem(CLAVE_CACHE);
    return guardado ? (JSON.parse(guardado) as Cache) : null;
  } catch {
    return null;
  }
};

const guardarCache = (cache: Cache) => {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(cache));
  } catch {
    // Sin almacenamiento, la vitrina simplemente espera al servidor.
  }
};

// ── Traducción entre la API y el modelo de las pantallas ─────────────────────

const fotoDesdeApi = (foto: FotoApi): FotoVehiculoData => ({
  id: foto.id,
  url: foto.url,
  urlMiniatura: foto.urlMiniatura,
  ancho: foto.ancho,
  alto: foto.alto,
  credito: foto.credito,
});

const imperfeccionDesdeApi = (imperfeccion: ImperfeccionApi): Imperfeccion => ({
  id: imperfeccion.id,
  zona: imperfeccion.zona,
  tipo: imperfeccion.tipo,
  descripcion: imperfeccion.descripcion ?? '',
  severidad: imperfeccion.severidad,
  ubicacion: imperfeccion.ubicacion ?? '',
  x: imperfeccion.x,
  y: imperfeccion.y,
});

const precioValido = (id: string, precioOriginal: unknown): number => {
  if (typeof precioOriginal === 'number' && Number.isFinite(precioOriginal) && precioOriginal > 0) {
    return precioOriginal;
  }
  const ref = mockVehiculos.find((m) => m.id === id);
  if (ref && typeof ref.precio === 'number' && Number.isFinite(ref.precio) && ref.precio > 0) {
    return ref.precio;
  }
  return 8900;
};

const comun = (v: VehiculoVitrina | VehiculoInventario) => ({
  id: v.codigo,
  vin: v.vin,
  marca: v.marca,
  modelo: v.modelo,
  version: v.version ?? '',
  anio: v.anio,
  precio: precioValido(v.codigo, v.precio),
  kilometraje: v.kilometraje,
  transmision: transmisionDesdeApi(v.transmision),
  combustible: combustibleDesdeApi(v.combustible),
  carroceria: carroceriaDesdeApi(v.carroceria),
  puestos: v.puestos,
  traccion: v.traccion,
  certificado: v.certificado,
  etiqueta: etiquetaDesdeApi(v.etiqueta),
  fotos: v.fotos.map(fotoDesdeApi),
  foto: v.fotos[0]?.url,
  color: v.color,
  sede: v.sede,
  estadoDisponibilidad: v.disponibilidad,
  imperfecciones: v.imperfecciones.map(imperfeccionDesdeApi),
});

const desdeVitrina = (v: VehiculoVitrina): VehiculoData => ({ ...comun(v), precioVes: v.precioVes });

const desdeInventario = (v: VehiculoInventario): VehiculoData => ({
  ...comun(v),
  placa: v.placa,
  publicacion: v.publicacion,
  faltaParaPublicar: v.faltaParaPublicar,
  fotosMinimas: v.fotosMinimas,
  esDemostracion: v.esDemostracion,
  adquisicion: v.adquisicion,
  actualizadoEn: v.actualizadoEn,
});

const desdeMaqueta = (v: VehiculoMaqueta): VehiculoData => {
  const credito = creditosFotos[v.id];
  return {
    ...v,
    precio: precioValido(v.id, v.precio),
    estadoDisponibilidad: v.estadoDisponibilidad ?? 'disponible',
    fotos: v.foto
      ? [
          {
            id: `${v.id}-principal`,
            url: v.foto,
            urlMiniatura: v.foto,
            ancho: 1000,
            alto: 750,
            credito: credito
              ? { autor: credito.autor, licencia: credito.licencia, origen: credito.pagina }
              : null,
          },
        ]
      : [],
  };
};

const aEntrada = (vehiculo: VehiculoData, imperfecciones: Imperfeccion[]): VehiculoEntrada => ({
  vin: vehiculo.vin,
  placa: vehiculo.placa ?? null,
  marca: vehiculo.marca,
  modelo: vehiculo.modelo,
  version: vehiculo.version || null,
  anio: vehiculo.anio,
  kilometraje: vehiculo.kilometraje,
  transmision: transmisionAApi(vehiculo.transmision),
  combustible: combustibleAApi(vehiculo.combustible),
  carroceria: carroceriaAApi(vehiculo.carroceria),
  puestos: vehiculo.puestos,
  traccion: vehiculo.traccion,
  color: vehiculo.color,
  precio: vehiculo.precio,
  etiqueta: etiquetaAApi(vehiculo.etiqueta),
  certificado: vehiculo.certificado,
  imperfecciones: imperfecciones.map((i) => ({
    zona: i.zona,
    tipo: i.tipo,
    descripcion: i.descripcion || null,
    severidad: i.severidad,
    ubicacion: i.ubicacion || null,
    x: i.x,
    y: i.y,
  })),
  adquisicion: vehiculo.adquisicion ?? null,
  ...(vehiculo.actualizadoEn
    ? { actualizadoEn: vehiculo.actualizadoEn }
    : { disponibilidad: vehiculo.estadoDisponibilidad ?? 'disponible' }),
});

const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? e.detalle || e.titulo : 'No se pudo contactar al servidor.');

/**
 * Lee la vitrina y, con permiso, el inventario completo (que incluye borradores y pausados).
 * No toca el estado de React: quien la llama decide qué hacer con el resultado.
 */
const leerDelServidor = async (conInventario: boolean) => {
  const catalogo = await consultarCatalogo();
  const tasa: TasaVigente | null = catalogo.tasa
    ? { valor: catalogo.tasa.tasa, fecha: catalogo.tasa.fecha, fuente: catalogo.tasa.fuente }
    : null;
  let lista = catalogo.vehiculos.map(desdeVitrina);
  if (conInventario) {
    // La equivalencia en bolívares solo la calcula la vitrina; el inventario la hereda.
    const equivalencias = new Map(lista.map((v) => [v.id, v.precioVes ?? null]));
    lista = (await listarInventario())
      .map(desdeInventario)
      .map((v) => ({ ...v, precioVes: equivalencias.get(v.id) ?? null }));
  }
  return { lista, tasa };
};

export const ProveedorVehiculos: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { estado, puede } = useSesion();
  const conServidor = apiConfigurada;
  const puedeVerInventario = conServidor && estado === 'activa' && puede('inventario.ver');
  const puedeEscribir = conServidor && estado === 'activa';

  const [vehiculos, setVehiculos] = useState<VehiculoData[]>(() => {
    if (!conServidor) {
      try {
        const guardados = localStorage.getItem(CLAVE_VEHICULOS);
        if (guardados) return (JSON.parse(guardados) as VehiculoMaqueta[]).map(desdeMaqueta);
      } catch {
        // Se cae a los datos de ejemplo.
      }
      return mockVehiculos.map(desdeMaqueta);
    }
    return leerCache()?.vehiculos ?? [];
  });

  const [imperfecciones, setImperfecciones] = useState<Record<string, Imperfeccion[]>>(() => {
    if (conServidor) return {};
    try {
      const guardadas = localStorage.getItem(CLAVE_IMPERFECCIONES);
      if (guardadas) return JSON.parse(guardadas) as Record<string, Imperfeccion[]>;
    } catch {
      // Se cae a los datos de ejemplo.
    }
    return mockImperfecciones;
  });

  const [tasa, setTasa] = useState<TasaVigente | null>(() => (conServidor ? (leerCache()?.tasa ?? null) : null));
  const [cargando, setCargando] = useState(conServidor);
  const [error, setError] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  // Modo maqueta: el inventario vive en el navegador, como hasta ahora.
  useEffect(() => {
    if (conServidor) return;
    try {
      localStorage.setItem(CLAVE_VEHICULOS, JSON.stringify(vehiculos));
    } catch (e) {
      console.warn('No se pudo guardar el inventario en el navegador', e);
    }
  }, [conServidor, vehiculos]);

  useEffect(() => {
    if (conServidor) return;
    try {
      localStorage.setItem(CLAVE_IMPERFECCIONES, JSON.stringify(imperfecciones));
    } catch (e) {
      console.warn('No se pudieron guardar las imperfecciones en el navegador', e);
    }
  }, [conServidor, imperfecciones]);

  /**
   * Carga desde el servidor. El estado se cambia dentro de los callbacks de la promesa, nunca
   * en el cuerpo del efecto: hacerlo de forma síncrona provoca renderizados en cascada.
   * Quien pide una recarga es el que enciende el indicador de carga.
   */
  useEffect(() => {
    if (!conServidor) return;
    let vigente = true;
    leerDelServidor(puedeVerInventario)
      .then(({ lista, tasa: tasaVigente }) => {
        if (!vigente) return;
        setVehiculos(lista);
        setTasa(tasaVigente);
        setError(null);
        setCargando(false);
        guardarCache({ vehiculos: lista, tasa: tasaVigente });
      })
      .catch((e: unknown) => {
        // Se conserva lo que ya se mostraba: una copia vieja es mejor que una vitrina vacía.
        if (!vigente) return;
        setError(mensajeDe(e));
        setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [conServidor, puedeVerInventario, recarga]);

  const reemplazar = useCallback((actualizado: VehiculoInventario) => {
    setVehiculos((lista) => {
      const nuevo = desdeInventario(actualizado);
      const previo = lista.find((v) => v.id === nuevo.id);
      const conEquivalencia = { ...nuevo, precioVes: previo?.precioVes ?? null };
      return previo
        ? lista.map((v) => (v.id === nuevo.id ? conEquivalencia : v))
        : [conEquivalencia, ...lista];
    });
    return desdeInventario(actualizado);
  }, []);

  const refrescarVehiculo = useCallback(
    async (codigo: string) => {
      reemplazar(await obtenerVehiculoInventario(codigo));
    },
    [reemplazar],
  );

  const obtenerVehiculo = useCallback((id: string) => vehiculos.find((v) => v.id === id), [vehiculos]);

  const obtenerImperfecciones = useCallback(
    (vehiculoId: string): Imperfeccion[] => {
      const delVehiculo = vehiculos.find((v) => v.id === vehiculoId)?.imperfecciones;
      if (delVehiculo) return delVehiculo;
      return imperfecciones[vehiculoId] ?? [];
    },
    [imperfecciones, vehiculos],
  );

  /**
   * La disponibilidad es un eje distinto de la etapa de la oportunidad y no deben
   * fusionarse (`spec.md` §8.4): un mismo auto puede tener una oportunidad perdida y otra
   * en negociación. Sin sesión (un visitante que agenda), el cambio se queda en su
   * navegador hasta que el CRM pase al servidor en la etapa 3.
   */
  const cambiarEstadoVehiculo = useCallback(
    async (vehiculoId: string, nuevoEstado: EstadoDisponibilidad) => {
      if (puedeEscribir) {
        reemplazar(await cambiarDisponibilidad(vehiculoId, nuevoEstado));
        return;
      }
      setVehiculos((prev) =>
        prev.map((v) => (v.id === vehiculoId ? { ...v, estadoDisponibilidad: nuevoEstado } : v)),
      );
    },
    [puedeEscribir, reemplazar],
  );

  const guardarVehiculo = useCallback(
    async (vehiculo: VehiculoData, nuevasImperfecciones?: Imperfeccion[]) => {
      const vehiculoSaneado: VehiculoData = {
        ...vehiculo,
        precio: precioValido(vehiculo.id, vehiculo.precio),
      };
      const lista = nuevasImperfecciones ?? vehiculoSaneado.imperfecciones ?? [];
      if (conServidor) {
        const entrada = aEntrada(vehiculoSaneado, lista);
        const guardado = vehiculoSaneado.actualizadoEn
          ? await actualizarVehiculo(vehiculoSaneado.id, entrada)
          : await crearVehiculo(entrada);
        return reemplazar(guardado);
      }
      setVehiculos((prev) => {
        const existe = prev.some((v) => v.id === vehiculoSaneado.id);
        return existe
          ? prev.map((v) => (v.id === vehiculoSaneado.id ? vehiculoSaneado : v))
          : [vehiculoSaneado, ...prev];
      });
      if (nuevasImperfecciones) {
        setImperfecciones((prev) => ({ ...prev, [vehiculoSaneado.id]: nuevasImperfecciones }));
      }
      return vehiculoSaneado;
    },
    [conServidor, reemplazar],
  );

  const eliminarVehiculo = useCallback(
    async (vehiculoId: string) => {
      if (conServidor) {
        await eliminarEnServidor(vehiculoId);
      }
      setVehiculos((prev) => prev.filter((v) => v.id !== vehiculoId));
      setImperfecciones((prev) => {
        const copia = { ...prev };
        delete copia[vehiculoId];
        return copia;
      });
    },
    [conServidor],
  );

  const publicarVehiculo = useCallback(
    async (vehiculoId: string) => {
      reemplazar(await publicarEnServidor(vehiculoId));
    },
    [reemplazar],
  );

  const pausarVehiculo = useCallback(
    async (vehiculoId: string) => {
      reemplazar(await pausarEnServidor(vehiculoId));
    },
    [reemplazar],
  );

  const publicarListos = useCallback(async (): Promise<ResultadoPublicacionEnLote> => {
    const resultado = await publicarListosEnServidor();
    // Publicar en lote toca muchos vehículos a la vez: sale más barato releer la lista entera.
    setCargando(true);
    setRecarga((n) => n + 1);
    return resultado;
  }, []);

  const subirFoto = useCallback(
    async (vehiculoId: string, archivo: File) => {
      await subirFotoEnServidor(vehiculoId, archivo);
      await refrescarVehiculo(vehiculoId);
    },
    [refrescarVehiculo],
  );

  const quitarFoto = useCallback(
    async (vehiculoId: string, fotoId: string) => {
      await quitarFotoEnServidor(vehiculoId, fotoId);
      await refrescarVehiculo(vehiculoId);
    },
    [refrescarVehiculo],
  );

  const ordenarFotos = useCallback(
    async (vehiculoId: string, fotos: string[]) => {
      await ordenarFotosEnServidor(vehiculoId, fotos);
      await refrescarVehiculo(vehiculoId);
    },
    [refrescarVehiculo],
  );

  const restablecerDatosDemo = useCallback(() => {
    if (conServidor) {
      setCargando(true);
      setRecarga((n) => n + 1);
      return;
    }
    localStorage.removeItem(CLAVE_VEHICULOS);
    localStorage.removeItem(CLAVE_IMPERFECCIONES);
    setVehiculos(mockVehiculos.map(desdeMaqueta));
    setImperfecciones(mockImperfecciones);
  }, [conServidor]);

  const valor = useMemo(
    () => ({
      vehiculos,
      origen: conServidor ? ('servidor' as const) : ('maqueta' as const),
      cargando,
      error,
      tasa,
      recargar: () => {
        setCargando(true);
        setRecarga((n) => n + 1);
      },
      obtenerVehiculo,
      obtenerImperfecciones,
      cambiarEstadoVehiculo,
      guardarVehiculo,
      eliminarVehiculo,
      publicarVehiculo,
      pausarVehiculo,
      publicarListos,
      subirFoto,
      quitarFoto,
      ordenarFotos,
      restablecerDatosDemo,
    }),
    [
      vehiculos,
      conServidor,
      cargando,
      error,
      tasa,
      obtenerVehiculo,
      obtenerImperfecciones,
      cambiarEstadoVehiculo,
      guardarVehiculo,
      eliminarVehiculo,
      publicarVehiculo,
      pausarVehiculo,
      publicarListos,
      subirFoto,
      quitarFoto,
      ordenarFotos,
      restablecerDatosDemo,
    ],
  );

  return <VehiculosContext.Provider value={valor}>{children}</VehiculosContext.Provider>;
};
