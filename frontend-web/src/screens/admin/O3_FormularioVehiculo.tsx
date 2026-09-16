import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorApi } from '../../api/cliente';
import { Boton } from '../../components/Boton';
import { DiagramaVehiculoInteractivo } from '../../components/DiagramaVehiculoInteractivo';
import { useVehiculos } from '../../state/vehiculosContexto';
import { OPCIONES_COMBUSTIBLE, OPCIONES_ETIQUETA, OPCIONES_TRANSMISION } from '../../types/inventario';
import { CARROCERIAS } from '../../types/vehiculo';
import type {
  Carroceria,
  EstadoDisponibilidad,
  EtiquetaVehiculo,
  FotoVehiculoData,
  Imperfeccion,
  MonedaAdquisicion,
  Transmision,
  VehiculoData,
} from '../../types/vehiculo';

/** Una sola sede en esta fase (D-23). */
const SEDE = 'Distrito Capital';

const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? e.detalle || e.titulo : 'No se pudo guardar.');
const comoErrorApi = (e: unknown) => (e instanceof ErrorApi ? e : new ErrorApi(0, 'Error', mensajeDe(e)));

/**
 * Alta y edición de un vehículo del inventario.
 *
 * Con servidor, las fotos se suben al vehículo ya creado (necesitan su código), así que al
 * crear uno nuevo se vuelve a esta misma pantalla en modo edición para cargarlas y publicar.
 */
export const O3_FormularioVehiculo: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { obtenerVehiculo, cargando } = useVehiculos();
  const vehiculo = id ? obtenerVehiculo(id) : undefined;

  if (id && !vehiculo) {
    return (
      <div className="form-vehiculo-contenedor">
        <p style={{ color: 'var(--texto-secundario)' }}>
          {cargando ? 'Cargando el vehículo…' : 'Este vehículo no existe o fue eliminado.'}
        </p>
      </div>
    );
  }

  // La clave reinicia el formulario al pasar de un vehículo a otro.
  return <FormularioVehiculo key={id ?? 'nuevo'} vehiculo={vehiculo} />;
};

const FormularioVehiculo: React.FC<{ vehiculo?: VehiculoData }> = ({ vehiculo }) => {
  const navigate = useNavigate();
  const {
    obtenerImperfecciones,
    guardarVehiculo,
    publicarVehiculo,
    pausarVehiculo,
    origen,
  } = useVehiculos();

  const conServidor = origen === 'servidor';
  const esEdicion = Boolean(vehiculo);

  const [marca, setMarca] = useState(vehiculo?.marca ?? '');
  const [modelo, setModelo] = useState(vehiculo?.modelo ?? '');
  const [version, setVersion] = useState(vehiculo?.version ?? '');
  const [anio, setAnio] = useState(vehiculo?.anio ?? new Date().getFullYear());
  const [vin, setVin] = useState(vehiculo?.vin ?? '');
  const [placa, setPlaca] = useState(vehiculo?.placa ?? '');
  const [kilometraje, setKilometraje] = useState(vehiculo?.kilometraje ?? 50000);
  const [precio, setPrecio] = useState(vehiculo?.precio ?? 10000);
  const [transmision, setTransmision] = useState<Transmision>(vehiculo?.transmision ?? 'Automático');
  const [combustible, setCombustible] = useState(vehiculo?.combustible ?? 'Gasolina');
  const [carroceria, setCarroceria] = useState<Carroceria>(vehiculo?.carroceria ?? 'Sedán');
  const [puestos, setPuestos] = useState(vehiculo?.puestos ?? 5);
  const [traccion, setTraccion] = useState<'4x2' | '4x4'>(vehiculo?.traccion ?? '4x2');
  const [color, setColor] = useState(vehiculo?.color ?? '#4A4843');
  const [certificado, setCertificado] = useState(vehiculo?.certificado ?? true);
  const [etiqueta, setEtiqueta] = useState<EtiquetaVehiculo | ''>(vehiculo?.etiqueta ?? '');
  const [disponibilidad, setDisponibilidad] = useState<EstadoDisponibilidad>(
    vehiculo?.estadoDisponibilidad ?? 'disponible',
  );
  const [imperfecciones, setImperfecciones] = useState<Imperfeccion[]>(
    vehiculo ? obtenerImperfecciones(vehiculo.id) : [],
  );

  // El precio de adquisición es opcional (D-12), pero si se declara va completo.
  const [conAdquisicion, setConAdquisicion] = useState(Boolean(vehiculo?.adquisicion));
  const [adqPrecio, setAdqPrecio] = useState(vehiculo?.adquisicion?.precio ?? 0);
  const [adqMoneda, setAdqMoneda] = useState<MonedaAdquisicion>(vehiculo?.adquisicion?.moneda ?? 'EUR');
  const [adqTasa, setAdqTasa] = useState(vehiculo?.adquisicion?.tasaBcv ?? 0);
  const [adqFecha, setAdqFecha] = useState(vehiculo?.adquisicion?.fecha ?? '');

  // Lista de fotos del vehículo (entre 1 y 10 imágenes).
  const [fotosLista, setFotosLista] = useState<FotoVehiculoData[]>(() => {
    if (vehiculo?.fotos && vehiculo.fotos.length > 0) {
      return vehiculo.fotos;
    }
    if (vehiculo?.foto) {
      return [
        {
          id: `${vehiculo.id}-principal`,
          url: vehiculo.foto,
          urlMiniatura: vehiculo.foto,
          ancho: 1200,
          alto: 900,
          credito: null,
        },
      ];
    }
    return [];
  });
  const [urlManual, setUrlManual] = useState('');
  const [errorFotos, setErrorFotos] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [ocupadoFotos, setOcupadoFotos] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const errores = error?.errores ?? {};

  const agregarArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (archivos.length === 0) return;

    setErrorFotos(null);
    const disponibles = 10 - fotosLista.length;
    if (disponibles <= 0) {
      setErrorFotos('Ya has alcanzado el límite máximo de 10 imágenes por vehículo.');
      return;
    }

    const aProcesar = archivos.slice(0, disponibles);
    if (archivos.length > disponibles) {
      setAviso(`Se agregaron ${disponibles} fotos. El límite permitido es de 10 imágenes por vehículo.`);
    }

    aProcesar.forEach((archivo) => {
      const lector = new FileReader();
      lector.onloadend = () => {
        const resultado = lector.result as string;
        setFotosLista((prev) => {
          if (prev.length >= 10) return prev;
          const nuevaFoto: FotoVehiculoData = {
            id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url: resultado,
            urlMiniatura: resultado,
            ancho: 1200,
            alto: 900,
            credito: null,
          };
          return [...prev, nuevaFoto];
        });
      };
      lector.readAsDataURL(archivo);
    });
  };

  const agregarUrlManual = () => {
    const limpia = urlManual.trim();
    if (!limpia) return;
    setErrorFotos(null);
    if (fotosLista.length >= 10) {
      setErrorFotos('Ya has alcanzado el límite máximo de 10 imágenes por vehículo.');
      return;
    }
    const nuevaFoto: FotoVehiculoData = {
      id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: limpia,
      urlMiniatura: limpia,
      ancho: 1200,
      alto: 900,
      credito: null,
    };
    setFotosLista((prev) => [...prev, nuevaFoto]);
    setUrlManual('');
  };

  const moverFoto = (indice: number, paso: number) => {
    setErrorFotos(null);
    const destino = indice + paso;
    if (destino < 0 || destino >= fotosLista.length) return;
    setFotosLista((prev) => {
      const copia = [...prev];
      const [item] = copia.splice(indice, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  };

  const eliminarFoto = (indice: number) => {
    setErrorFotos(null);
    setFotosLista((prev) => prev.filter((_, i) => i !== indice));
  };

  /** Envuelve las operaciones de publicación con ocupado y error. */
  const conFotos = async (accion: () => Promise<void>, exito?: string) => {
    setOcupadoFotos(true);
    setError(null);
    setAviso(null);
    try {
      await accion();
      if (exito) setAviso(exito);
    } catch (e) {
      setError(comoErrorApi(e));
    } finally {
      setOcupadoFotos(false);
    }
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setGuardando(true);
    if (fotosLista.length === 0) {
      setErrorFotos('Debes adjuntar al menos 1 imagen del vehículo (mínimo 1, máximo 10).');
      setGuardando(false);
      return;
    }
    if (fotosLista.length > 10) {
      setErrorFotos('El límite permitido es de máximo 10 imágenes por vehículo.');
      setGuardando(false);
      return;
    }

    try {
      const datos: VehiculoData = {
        id: vehiculo?.id ?? `veh-${Date.now().toString(36)}`,
        vin: vin.trim().toUpperCase(),
        placa: placa.trim() || null,
        marca: marca.trim(),
        modelo: modelo.trim(),
        version: version.trim(),
        anio: Number(anio),
        precio: Number(precio),
        kilometraje: Number(kilometraje),
        transmision,
        combustible,
        carroceria,
        puestos: Number(puestos),
        traccion,
        certificado,
        etiqueta: etiqueta || undefined,
        fotos: fotosLista,
        foto: fotosLista[0]?.url,
        color,
        sede: SEDE,
        estadoDisponibilidad: disponibilidad,
        adquisicion: conAdquisicion
          ? { precio: Number(adqPrecio), moneda: adqMoneda, tasaBcv: Number(adqTasa), fecha: adqFecha }
          : null,
        actualizadoEn: vehiculo?.actualizadoEn,
      };
      const guardado = await guardarVehiculo(datos, imperfecciones);
      if (!esEdicion && conServidor) {
        // Las fotos se suben al vehículo ya creado: se sigue en esta pantalla, ya en edición.
        navigate(`/admin/vehiculo/editar/${guardado.id}`, { replace: true });
        return;
      }
      navigate('/admin/inventario');
    } catch (e) {
      setError(comoErrorApi(e));
    } finally {
      setGuardando(false);
    }
  };

  const publicacion = vehiculo?.publicacion;
  const falta = vehiculo?.faltaParaPublicar ?? [];

  return (
    <div className="form-vehiculo-contenedor">
      <div className="form-header">
        <button type="button" onClick={() => navigate('/admin/inventario')} className="btn-volver">
          ← Volver a inventario
        </button>
        <h1 style={{ fontSize: '22px', margin: '8px 0 4px', fontWeight: 700 }}>
          {esEdicion ? `Editar vehículo: ${marca} ${modelo}` : 'Nuevo vehículo'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: 0 }}>
          {esEdicion && vehiculo
            ? `Código ${vehiculo.id}. Los precios van en euros; la equivalencia en bolívares la calcula la tasa BCV del día.`
            : 'Registra las características y adjunta entre 1 y 10 fotografías del vehículo.'}
        </p>
      </div>

      {aviso && <div className="toast-exito">✓ {aviso}</div>}
      {error && (
        <div className="toast-error">
          <strong>{error.titulo}</strong> {error.detalle}
        </div>
      )}

      {esEdicion && conServidor && publicacion && (
        <div className="panel-publicacion">
          <div>
            <span className={`estado-publicacion ${publicacion.estado}`}>
              {publicacion.estado === 'publicado'
                ? 'En la vitrina'
                : publicacion.estado === 'pausado'
                  ? 'Pausado'
                  : 'Borrador'}
            </span>
            {publicacion.estado === 'publicado' && publicacion.tasaBcv && (
              <span className="nota-publicacion">
                Precio fijado a {publicacion.tasaBcv.toLocaleString('es-VE')} Bs. por euro
                {publicacion.fechaTasa && ` (${publicacion.fechaTasa})`}.
              </span>
            )}
            {falta.length > 0 && (
              <ul className="lista-falta">
                {falta.map((motivo) => (
                  <li key={motivo}>{motivo}</li>
                ))}
              </ul>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {publicacion.estado === 'publicado' ? (
              <Boton
                variant="secondary"
                type="button"
                disabled={ocupadoFotos}
                onClick={() => vehiculo && void conFotos(() => pausarVehiculo(vehiculo.id), 'Salió de la vitrina.')}
              >
                Pausar publicación
              </Boton>
            ) : (
              <Boton
                type="button"
                disabled={ocupadoFotos || falta.length > 0}
                onClick={() => vehiculo && void conFotos(() => publicarVehiculo(vehiculo.id), 'Ya está en la vitrina.')}
              >
                Publicar en la vitrina
              </Boton>
            )}
          </div>
        </div>
      )}

      <form onSubmit={guardar}>
        <div className="seccion-form">
          <h2 className="seccion-titulo">1. Datos del vehículo</h2>

          <div className="grid-form-3">
            <Campo id="veh-marca" etiqueta="Marca *" error={errores.marca}>
              <input id="veh-marca" type="text" placeholder="Ej. Toyota" value={marca} onChange={(e) => setMarca(e.target.value)} required />
            </Campo>
            <Campo id="veh-modelo" etiqueta="Modelo *" error={errores.modelo}>
              <input id="veh-modelo" type="text" placeholder="Ej. Corolla" value={modelo} onChange={(e) => setModelo(e.target.value)} required />
            </Campo>
            <Campo id="veh-version" etiqueta="Versión o acabado" error={errores.version}>
              <input id="veh-version" type="text" placeholder="Ej. XEI 1.8 Aut." value={version} onChange={(e) => setVersion(e.target.value)} />
            </Campo>
          </div>

          <div className="grid-form-4">
            <Campo id="veh-anio" etiqueta="Año *" error={errores.anio}>
              <input
                id="veh-anio"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                required
              />
            </Campo>
            <Campo id="veh-precio" etiqueta="Precio en euros *" error={errores.precio}>
              <input id="veh-precio" type="number" min="1" step="0.01" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} required />
            </Campo>
            <Campo id="veh-kilometraje" etiqueta="Kilometraje (km) *" error={errores.kilometraje}>
              <input id="veh-kilometraje" type="number" min="0" value={kilometraje} onChange={(e) => setKilometraje(Number(e.target.value))} required />
            </Campo>
            <Campo id="veh-vin" etiqueta="VIN o serial *" ayuda="Hasta 17 caracteres, sin espacios." error={errores.vin}>
              <input id="veh-vin" type="text" maxLength={17} value={vin} onChange={(e) => setVin(e.target.value)} required />
            </Campo>
          </div>

          <div className="grid-form-4">
            <Campo id="veh-carroceria" etiqueta="Carrocería" error={errores.carroceria}>
              <select id="veh-carroceria" value={carroceria} onChange={(e) => setCarroceria(e.target.value as Carroceria)}>
                {CARROCERIAS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="veh-transmision" etiqueta="Transmisión" error={errores.transmision}>
              <select id="veh-transmision" value={transmision} onChange={(e) => setTransmision(e.target.value as Transmision)}>
                {OPCIONES_TRANSMISION.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="veh-combustible" etiqueta="Combustible" error={errores.combustible}>
              <select id="veh-combustible" value={combustible} onChange={(e) => setCombustible(e.target.value)}>
                {OPCIONES_COMBUSTIBLE.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="veh-traccion" etiqueta="Tracción" error={errores.traccion}>
              <select id="veh-traccion" value={traccion} onChange={(e) => setTraccion(e.target.value as '4x2' | '4x4')}>
                <option value="4x2">4x2</option>
                <option value="4x4">4x4</option>
              </select>
            </Campo>
          </div>

          <div className="grid-form-4">
            <Campo id="veh-puestos" etiqueta="Puestos" error={errores.puestos}>
              <input id="veh-puestos" type="number" min="1" max="99" value={puestos} onChange={(e) => setPuestos(Number(e.target.value))} />
            </Campo>
            <Campo id="veh-placa" etiqueta="Placa" ayuda="Opcional en esta fase; no sale a la vitrina." error={errores.placa}>
              <input id="veh-placa" type="text" maxLength={10} value={placa} onChange={(e) => setPlaca(e.target.value)} />
            </Campo>
            <Campo id="veh-color" etiqueta="Color de la carrocería">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  id="veh-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: '40px', height: '36px', padding: 0, cursor: 'pointer' }}
                />
                <input
                  id="veh-color-texto"
                  aria-label="Color en hexadecimal"
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </Campo>
            <Campo id="veh-sede" etiqueta="Sede" ayuda="Única sede en esta fase.">
              <input id="veh-sede" type="text" value={SEDE} readOnly disabled />
            </Campo>
          </div>

          <div className="grid-form-3">
            <Campo id="veh-etiqueta" etiqueta="Etiqueta comercial" error={errores.etiqueta}>
              <select id="veh-etiqueta" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value as EtiquetaVehiculo | '')}>
                <option value="">Sin etiqueta</option>
                {OPCIONES_ETIQUETA.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              id="veh-disponibilidad"
              etiqueta="Disponibilidad"
              ayuda={esEdicion && conServidor ? 'Se cambia desde el inventario o el CRM.' : undefined}
            >
              <select
                id="veh-disponibilidad"
                value={disponibilidad}
                onChange={(e) => setDisponibilidad(e.target.value as EstadoDisponibilidad)}
                disabled={esEdicion && conServidor}
              >
                <option value="disponible">🟢 Disponible</option>
                <option value="cita_agendada">🟠 Con cita</option>
                <option value="vendido">⚪ Vendido</option>
              </select>
            </Campo>
            <div className="campo-form">
              <span className="etiqueta-grupo">Certificación</span>
              <label
                htmlFor="veh-certificado"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px' }}
              >
                <input
                  id="veh-certificado"
                  type="checkbox"
                  checked={certificado}
                  onChange={(e) => setCertificado(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--naranja-500)' }}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Certificado WAMMA</span>
              </label>
              <span className="ayuda-campo">Sin certificar, la ficha lo dice y no muestra el sello.</span>
            </div>
          </div>

          <label
            htmlFor="veh-adquisicion"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '12px' }}
          >
            <input
              id="veh-adquisicion"
              type="checkbox"
              checked={conAdquisicion}
              onChange={(e) => setConAdquisicion(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--naranja-500)' }}
            />
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Registrar el precio de adquisición (dato interno)</span>
          </label>
          {conAdquisicion && (
            <div className="grid-form-4" style={{ marginTop: '10px' }}>
              <Campo id="adq-precio" etiqueta="Precio pagado" error={errores['adquisicion.precio']}>
                <input id="adq-precio" type="number" min="0" step="0.01" value={adqPrecio} onChange={(e) => setAdqPrecio(Number(e.target.value))} />
              </Campo>
              <Campo id="adq-moneda" etiqueta="Moneda" error={errores['adquisicion.moneda']}>
                <select id="adq-moneda" value={adqMoneda} onChange={(e) => setAdqMoneda(e.target.value as MonedaAdquisicion)}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="VES">VES</option>
                </select>
              </Campo>
              <Campo id="adq-tasa" etiqueta="Tasa BCV usada" error={errores['adquisicion.tasaBcv']}>
                <input id="adq-tasa" type="number" min="0" step="0.00000001" value={adqTasa} onChange={(e) => setAdqTasa(Number(e.target.value))} />
              </Campo>
              <Campo id="adq-fecha" etiqueta="Fecha de la tasa" error={errores['adquisicion.fecha']}>
                <input id="adq-fecha" type="date" value={adqFecha} onChange={(e) => setAdqFecha(e.target.value)} />
              </Campo>
            </div>
          )}
        </div>

        <div className="seccion-form">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: 'var(--space-md)',
            }}
          >
            <h2 className="seccion-titulo" style={{ margin: 0, border: 'none', padding: 0 }}>
              2. Fotos del vehículo ({fotosLista.length} de 10)
            </h2>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor:
                  fotosLista.length === 0
                    ? 'var(--peligro-fondo)'
                    : fotosLista.length === 10
                      ? 'var(--aviso-fondo)'
                      : 'var(--exito-fondo)',
                color:
                  fotosLista.length === 0
                    ? 'var(--peligro-texto)'
                    : fotosLista.length === 10
                      ? 'var(--aviso-texto)'
                      : 'var(--exito-texto)',
              }}
            >
              {fotosLista.length === 0
                ? '⚠️ Requiere al menos 1 imagen'
                : fotosLista.length === 10
                  ? 'Límite alcanzado (10 / 10)'
                  : `✓ ${fotosLista.length} de 10 imágenes`}
            </span>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '0 0 16px' }}>
            Adjunta entre <strong>1 y 10 imágenes</strong> del vehículo. La primera foto (a la izquierda) será la{' '}
            <strong>imagen principal</strong> en la vitrina y cotizadores. Usa las flechas para ordenar las fotos o la
            cruz para eliminarlas.
          </p>

          {errorFotos && (
            <div
              style={{
                backgroundColor: 'var(--peligro-fondo)',
                color: 'var(--peligro-texto)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              ⚠️ {errorFotos}
            </div>
          )}

          {/* Cuadrícula de fotos cargadas */}
          {fotosLista.length > 0 && (
            <div className="fotos-grid" style={{ marginBottom: 'var(--space-lg)' }}>
              {fotosLista.map((f, indice) => (
                <figure key={f.id} className="foto-item">
                  <img src={f.urlMiniatura || f.url} alt={`Foto ${indice + 1}`} />
                  <figcaption>
                    {indice === 0 ? (
                      <span className="foto-principal" style={{ color: 'var(--naranja-600)', fontWeight: 700 }}>
                        ⭐ Principal
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--texto-secundario)', fontWeight: 600 }}>
                        Foto {indice + 1}
                      </span>
                    )}
                    <div className="foto-acciones">
                      <button
                        type="button"
                        onClick={() => moverFoto(indice, -1)}
                        disabled={indice === 0}
                        title="Mover hacia la izquierda"
                        aria-label="Mover antes"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moverFoto(indice, 1)}
                        disabled={indice === fotosLista.length - 1}
                        title="Mover hacia la derecha"
                        aria-label="Mover después"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        className="peligro"
                        onClick={() => eliminarFoto(indice)}
                        title="Eliminar esta foto"
                        aria-label="Quitar foto"
                      >
                        ✕
                      </button>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {/* Controles para adjuntar / subir fotos */}
          {fotosLista.length < 10 ? (
            <div
              style={{
                backgroundColor: 'var(--superficie)',
                border: '1px dashed var(--borde)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label
                  htmlFor="input-fotos-archivos"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--blanco)',
                    border: '1px solid var(--borde)',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--texto-primario)',
                  }}
                >
                  📁 Seleccionar imágenes del equipo (múltiples)
                </label>
                <input
                  id="input-fotos-archivos"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={agregarArchivos}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                  Puedes seleccionar varias imágenes al mismo tiempo. Quedan {10 - fotosLista.length} disponibles.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--texto-mudo)' }}>O indicar ruta o URL:</span>
                <input
                  type="text"
                  placeholder="Ej. /vehiculos/veh-001.webp o https://..."
                  value={urlManual}
                  onChange={(e) => setUrlManual(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarUrlManual();
                    }
                  }}
                  style={{
                    flex: '1 1 240px',
                    minWidth: '200px',
                    padding: '7px 12px',
                    fontSize: '13px',
                    border: '1px solid var(--borde)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
                <button
                  type="button"
                  onClick={agregarUrlManual}
                  disabled={!urlManual.trim()}
                  style={{
                    padding: '7px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--borde)',
                    backgroundColor: 'var(--blanco)',
                    cursor: urlManual.trim() ? 'pointer' : 'not-allowed',
                    opacity: urlManual.trim() ? 1 : 0.5,
                  }}
                >
                  + Agregar URL
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--superficie)',
                border: '1px solid var(--borde-claro)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--texto-secundario)',
                textAlign: 'center',
              }}
            >
              ✓ Has alcanzado el límite máximo de 10 imágenes para este vehículo.
            </div>
          )}
        </div>

        <div className="seccion-form">
          <h2 className="seccion-titulo">3. Imperfecciones declaradas</h2>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '0 0 16px' }}>
            Marca sobre la silueta los rayones, abolladuras o desgaste. El comprador los ve en la ficha: declararlos es
            lo que sostiene la certificación.
          </p>
          <DiagramaVehiculoInteractivo imperfecciones={imperfecciones} onChange={setImperfecciones} />
        </div>

        <div className="form-acciones">
          <Boton variant="secondary" type="button" onClick={() => navigate('/admin/inventario')}>
            Cancelar
          </Boton>
          <Boton variant="primary" type="submit" loading={guardando}>
            {esEdicion ? 'Guardar cambios' : 'Crear vehículo'}
          </Boton>
        </div>
      </form>

      <style>{ESTILOS}</style>
    </div>
  );
};

/** El `id` ata la etiqueta a su control: sin eso el campo no es navegable por lectores de pantalla. */
const Campo: React.FC<{
  id?: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ id, etiqueta, ayuda, error, children }) => (
  <div className="campo-form">
    <label htmlFor={id}>{etiqueta}</label>
    {children}
    {error ? <span className="error-campo">{error}</span> : ayuda && <span className="ayuda-campo">{ayuda}</span>}
  </div>
);

const ESTILOS = `
  .form-vehiculo-contenedor { max-width: 960px; margin: 0 auto; }
  .form-header { margin-bottom: var(--space-xl); }
  .btn-volver {
    background: none; border: none; color: var(--texto-secundario); font-size: 13px; cursor: pointer;
    padding: 0; font-weight: 600;
  }
  .seccion-form {
    background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
    padding: var(--space-xl); margin-bottom: var(--space-xl);
  }
  .seccion-titulo {
    font-size: 16px; font-weight: 700; margin: 0 0 var(--space-lg); padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--borde-claro);
  }
  .grid-form-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-md); }
  .grid-form-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-md); }
  @media (max-width: 768px) {
    .grid-form-3, .grid-form-4 { grid-template-columns: 1fr; }
  }
  .campo-form { display: flex; flex-direction: column; gap: 6px; }
  .campo-form label, .campo-form .etiqueta-grupo { font-size: 12px; font-weight: 600; color: var(--texto-primario); }
  .campo-form input, .campo-form select {
    padding: 8px 12px; border: 1px solid var(--borde); border-radius: var(--radius-sm); font-family: inherit;
    font-size: 13px; outline: none;
  }
  .campo-form input:focus, .campo-form select:focus { border-color: var(--naranja-500); }
  .campo-form input:disabled, .campo-form select:disabled {
    background-color: var(--superficie); color: var(--texto-secundario);
  }
  .campo-form input[type="checkbox"] { padding: 0; }
  .ayuda-campo { font-size: 11px; color: var(--texto-mudo); line-height: 1.4; }
  .error-campo { font-size: 11px; color: var(--peligro-texto); }
  .grid-foto { display: grid; grid-template-columns: 1fr 220px; gap: var(--space-xl); align-items: center; }
  @media (max-width: 640px) { .grid-foto { grid-template-columns: 1fr; } }
  .preview-foto-box {
    width: 220px; height: 150px; border: 1px dashed var(--borde); border-radius: var(--radius-md);
    display: flex; align-items: center; justify-content: center; background-color: var(--superficie); overflow: hidden;
  }
  .preview-img { width: 100%; height: 100%; object-fit: cover; }
  .fotos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-md); }
  .foto-item {
    margin: 0; border: 1px solid var(--borde-claro); border-radius: var(--radius-md); overflow: hidden;
    background-color: var(--superficie);
  }
  .foto-item img { width: 100%; height: 110px; object-fit: cover; display: block; }
  .foto-item figcaption {
    display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 8px;
    background-color: var(--blanco); min-height: 38px;
  }
  .foto-principal { font-size: 10px; font-weight: 700; color: var(--naranja-700); text-transform: uppercase; }
  .foto-acciones { display: flex; gap: 4px; margin-left: auto; }
  .foto-acciones button {
    border: 1px solid var(--borde); background-color: var(--blanco); border-radius: var(--radius-sm);
    width: 26px; height: 26px; cursor: pointer; font-size: 12px; line-height: 1;
  }
  .foto-acciones button:disabled { opacity: 0.4; cursor: not-allowed; }
  .foto-acciones .peligro { color: var(--peligro-texto); }
  .panel-publicacion {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-lg); flex-wrap: wrap;
    background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
    padding: var(--space-lg); margin-bottom: var(--space-lg);
  }
  .estado-publicacion {
    display: inline-block; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: var(--radius-pill);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .estado-publicacion.publicado { background-color: var(--exito-fondo); color: var(--exito-texto); }
  .estado-publicacion.pausado { background-color: var(--aviso-fondo); color: var(--aviso-texto); }
  .estado-publicacion.borrador { background-color: var(--superficie); color: var(--texto-secundario); }
  .nota-publicacion { display: block; margin-top: 8px; font-size: 12px; color: var(--texto-secundario); }
  .lista-falta { margin: 8px 0 0; padding-left: 18px; font-size: 12px; color: var(--texto-secundario); }
  .form-acciones { display: flex; justify-content: flex-end; gap: var(--space-md); margin-top: var(--space-xl); }
  .toast-exito {
    background-color: var(--exito-fondo); color: var(--exito-texto); padding: 12px 16px;
    border-radius: var(--radius-md); margin-bottom: var(--space-lg); font-weight: 600;
  }
  .toast-error {
    background-color: var(--peligro-fondo); color: var(--peligro-texto); padding: 12px 16px;
    border-radius: var(--radius-md); margin-bottom: var(--space-lg); font-size: 13px;
  }
`;
