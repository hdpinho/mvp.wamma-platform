import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useVehiculos } from '../../state/vehiculosContexto';
import { CARROCERIAS } from '../../types/vehiculo';
import type { VehiculoData, Imperfeccion, Carroceria, EtiquetaVehiculo } from '../../types/vehiculo';
import { DiagramaVehiculoInteractivo } from '../../components/DiagramaVehiculoInteractivo';
import { Boton } from '../../components/Boton';

const SEDES_DISPONIBLES = [
  'Caracas - Las Mercedes',
  'Caracas - La Castellana',
  'Caracas - Los Ruices',
  'Caracas - La Trinidad',
  'Guatire',
];

export const O3_FormularioVehiculo: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { obtenerVehiculo, obtenerImperfecciones, guardarVehiculo } = useVehiculos();

  const esEdicion = Boolean(id);
  const vehiculoExistente = id ? obtenerVehiculo(id) : undefined;

  // Estado del formulario
  const [marca, setMarca] = useState(vehiculoExistente?.marca ?? '');
  const [modelo, setModelo] = useState(vehiculoExistente?.modelo ?? '');
  const [version, setVersion] = useState(vehiculoExistente?.version ?? '');
  const [anio, setAnio] = useState(vehiculoExistente?.anio ?? new Date().getFullYear());
  const [vin, setVin] = useState(vehiculoExistente?.vin ?? '');
  const [kilometraje, setKilometraje] = useState(vehiculoExistente?.kilometraje ?? 50000);
  const [precioUSD, setPrecioUSD] = useState(vehiculoExistente?.precioUSD ?? 10000);
  const [transmision, setTransmision] = useState<'Automático' | 'Manual'>(
    vehiculoExistente?.transmision ?? 'Automático',
  );
  const [combustible, setCombustible] = useState(vehiculoExistente?.combustible ?? 'Gasolina');
  const [carroceria, setCarroceria] = useState<Carroceria>(
    vehiculoExistente?.carroceria ?? 'Sedán',
  );
  const [puestos, setPuestos] = useState(vehiculoExistente?.puestos ?? 5);
  const [traccion, setTraccion] = useState<'4x2' | '4x4'>(vehiculoExistente?.traccion ?? '4x2');
  const [color, setColor] = useState(vehiculoExistente?.color ?? '#4A4843');
  const [sede, setSede] = useState(vehiculoExistente?.sede ?? SEDES_DISPONIBLES[0]);
  const [certificado, setCertificado] = useState(vehiculoExistente?.certificado ?? true);
  const [etiqueta, setEtiqueta] = useState<EtiquetaVehiculo | ''>(
    vehiculoExistente?.etiqueta ?? '',
  );
  const [estadoDisponibilidad, setEstadoDisponibilidad] = useState<
    'disponible' | 'cita_agendada' | 'vendido'
  >(vehiculoExistente?.estadoDisponibilidad ?? 'disponible');

  // Foto (URL o archivo local)
  const [foto, setFoto] = useState(vehiculoExistente?.foto ?? '');
  const [fotoPreview, setFotoPreview] = useState(vehiculoExistente?.foto ?? '');

  // Imperfecciones interactivas
  const [imperfecciones, setImperfecciones] = useState<Imperfeccion[]>(
    id ? obtenerImperfecciones(id) : [],
  );

  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);

  useEffect(() => {
    if (vehiculoExistente) {
      setMarca(vehiculoExistente.marca);
      setModelo(vehiculoExistente.modelo);
      setVersion(vehiculoExistente.version);
      setAnio(vehiculoExistente.anio);
      setVin(vehiculoExistente.vin);
      setKilometraje(vehiculoExistente.kilometraje);
      setPrecioUSD(vehiculoExistente.precioUSD);
      setTransmision(vehiculoExistente.transmision);
      setCombustible(vehiculoExistente.combustible);
      setCarroceria(vehiculoExistente.carroceria);
      setPuestos(vehiculoExistente.puestos);
      setTraccion(vehiculoExistente.traccion);
      setColor(vehiculoExistente.color);
      setSede(vehiculoExistente.sede);
      setCertificado(vehiculoExistente.certificado);
      setEtiqueta(vehiculoExistente.etiqueta ?? '');
      setEstadoDisponibilidad(vehiculoExistente.estadoDisponibilidad ?? 'disponible');
      setFoto(vehiculoExistente.foto ?? '');
      setFotoPreview(vehiculoExistente.foto ?? '');
      setImperfecciones(obtenerImperfecciones(vehiculoExistente.id));
    }
  }, [vehiculoExistente]);

  const handleFotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setFoto(result);
        setFotoPreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!marca || !modelo) {
      alert('Por favor indica al menos la marca y el modelo del vehículo.');
      return;
    }

    setGuardando(true);

    const vehiculoId =
      id || `veh-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;

    const datosVehiculo: VehiculoData = {
      id: vehiculoId,
      vin: vin.trim() || `VIN-${Date.now().toString(36).toUpperCase()}`,
      marca: marca.trim(),
      modelo: modelo.trim(),
      version: version.trim() || 'Estándar',
      anio: Number(anio),
      precioUSD: Number(precioUSD),
      kilometraje: Number(kilometraje),
      transmision,
      combustible,
      carroceria,
      puestos: Number(puestos),
      traccion,
      certificado,
      etiqueta: etiqueta ? (etiqueta as EtiquetaVehiculo) : undefined,
      foto: foto || undefined,
      color,
      sede,
      estadoDisponibilidad,
    };

    guardarVehiculo(datosVehiculo, imperfecciones);

    setGuardando(false);
    setMensajeExito(true);

    setTimeout(() => {
      navigate('/admin/inventario');
    }, 800);
  };

  return (
    <div className="form-vehiculo-contenedor">
      <div className="form-header">
        <button
          type="button"
          onClick={() => navigate('/admin/inventario')}
          className="btn-volver"
        >
          ← Volver a inventario
        </button>
        <h1 style={{ fontSize: '22px', margin: '8px 0 4px', fontWeight: 700 }}>
          {esEdicion ? `Editar Vehículo: ${marca} ${modelo}` : 'Publicar Nuevo Vehículo'}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: 0 }}>
          Ingresa las características, sube las fotos e indica los detalles o imperfecciones en el diagrama.
        </p>
      </div>

      {mensajeExito && (
        <div className="toast-exito">
          ✓ Vehículo guardado correctamente. Redirigiendo al catálogo...
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Bloque 1: Identificación y Especificaciones */}
        <div className="seccion-form">
          <h2 className="seccion-titulo">1. Datos Principales y Mecánicos</h2>
          <div className="grid-form-3">
            <div className="campo-form">
              <label>Marca *</label>
              <input
                type="text"
                placeholder="Ej. Toyota"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                required
              />
            </div>

            <div className="campo-form">
              <label>Modelo *</label>
              <input
                type="text"
                placeholder="Ej. Corolla"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                required
              />
            </div>

            <div className="campo-form">
              <label>Versión / Acabado</label>
              <input
                type="text"
                placeholder="Ej. XEI 1.8 Aut."
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-form-4">
            <div className="campo-form">
              <label>Año *</label>
              <input
                type="number"
                min="1990"
                max={new Date().getFullYear() + 1}
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                required
              />
            </div>

            <div className="campo-form">
              <label>Precio en USD *</label>
              <input
                type="number"
                min="500"
                step="50"
                value={precioUSD}
                onChange={(e) => setPrecioUSD(Number(e.target.value))}
                required
              />
            </div>

            <div className="campo-form">
              <label>Kilometraje (km) *</label>
              <input
                type="number"
                min="0"
                value={kilometraje}
                onChange={(e) => setKilometraje(Number(e.target.value))}
                required
              />
            </div>

            <div className="campo-form">
              <label>VIN / Serial</label>
              <input
                type="text"
                placeholder="17 caracteres"
                value={vin}
                onChange={(e) => setVin(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-form-4">
            <div className="campo-form">
              <label>Carrocería</label>
              <select
                value={carroceria}
                onChange={(e) => setCarroceria(e.target.value as Carroceria)}
              >
                {CARROCERIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-form">
              <label>Transmisión</label>
              <select
                value={transmision}
                onChange={(e) => setTransmision(e.target.value as 'Automático' | 'Manual')}
              >
                <option value="Automático">Automático</option>
                <option value="Manual">Manual (Sincrónico)</option>
              </select>
            </div>

            <div className="campo-form">
              <label>Combustible</label>
              <select
                value={combustible}
                onChange={(e) => setCombustible(e.target.value)}
              >
                <option value="Gasolina">Gasolina</option>
                <option value="Diésel">Diésel</option>
                <option value="Híbrido">Híbrido</option>
              </select>
            </div>

            <div className="campo-form">
              <label>Tracción</label>
              <select
                value={traccion}
                onChange={(e) => setTraccion(e.target.value as '4x2' | '4x4')}
              >
                <option value="4x2">4x2</option>
                <option value="4x4">4x4</option>
              </select>
            </div>
          </div>

          <div className="grid-form-3">
            <div className="campo-form">
              <label>Sede WAMMA</label>
              <select value={sede} onChange={(e) => setSede(e.target.value)}>
                {SEDES_DISPONIBLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo-form">
              <label>Color Carrocería</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: '40px', height: '36px', padding: 0, cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="campo-form">
              <label>Etiqueta Comercial</label>
              <select
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value as EtiquetaVehiculo | '')}
              >
                <option value="">Sin etiqueta</option>
                <option value="Recién ingresado">Recién ingresado</option>
                <option value="Difícil de conseguir">Difícil de conseguir</option>
                <option value="Listo para entrega">Listo para entrega</option>
              </select>
            </div>
          </div>

          <div className="grid-form-2" style={{ marginTop: '8px' }}>
            <div className="campo-form">
              <label>Estado de Disponibilidad (Control de Agendar Cita)</label>
              <select
                value={estadoDisponibilidad}
                onChange={(e) =>
                  setEstadoDisponibilidad(
                    e.target.value as 'disponible' | 'cita_agendada' | 'vendido',
                  )
                }
              >
                <option value="disponible">🟢 Disponible (Botón activo para clientes)</option>
                <option value="cita_agendada">
                  🟠 Cita Agendada / Reservado (Botón bloqueado para otros clientes)
                </option>
                <option value="vendido">⚪ Vendido (Fuera de venta)</option>
              </select>
            </div>

            <div className="campo-form" style={{ justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  checked={certificado}
                  onChange={(e) => setCertificado(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--naranja-500)' }}
                />
                <span style={{ fontWeight: 600 }}>Certificado WAMMA (Inspección 240 Puntos)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Bloque 2: Fotografía */}
        <div className="seccion-form">
          <h2 className="seccion-titulo">2. Fotografía del Vehículo</h2>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '0 0 12px' }}>
            Selecciona una imagen desde tu equipo o indica una ruta estática en el servidor.
          </p>

          <div className="grid-foto">
            <div className="campo-form">
              <label>Subir imagen desde equipo (guardado local):</label>
              <input type="file" accept="image/*" onChange={handleFotoFileChange} />

              <div style={{ marginTop: '10px' }}>
                <label>O indicar ruta / URL de imagen existente:</label>
                <input
                  type="text"
                  placeholder="Ej. /vehiculos/veh-001.webp"
                  value={foto}
                  onChange={(e) => {
                    setFoto(e.target.value);
                    setFotoPreview(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="preview-foto-box">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Vista previa del auto" className="preview-img" />
              ) : (
                <div style={{ color: 'var(--texto-mudo)', fontSize: '13px', textAlign: 'center' }}>
                  Sin imagen cargada
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bloque 3: Imperfecciones e Inspección Visual */}
        <div className="seccion-form">
          <h2 className="seccion-titulo">3. Detalles e Imperfecciones (Diagrama Interactivo)</h2>
          <p style={{ fontSize: '13px', color: 'var(--texto-secundario)', margin: '0 0 16px' }}>
            Haz clic en la silueta del vehículo para registrar rayones, abolladuras o desgaste. Estos puntos se mostrarán transparentemente al cliente en la ficha pública.
          </p>

          <DiagramaVehiculoInteractivo
            imperfecciones={imperfecciones}
            onChange={setImperfecciones}
          />
        </div>

        {/* Botones de acción */}
        <div className="form-acciones">
          <Boton
            variant="secondary"
            type="button"
            onClick={() => navigate('/admin/inventario')}
          >
            Cancelar
          </Boton>
          <Boton variant="primary" type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : esEdicion ? 'Actualizar Vehículo' : 'Guardar y Publicar'}
          </Boton>
        </div>
      </form>

      <style>{`
        .form-vehiculo-contenedor {
          max-width: 960px;
          margin: 0 auto;
        }
        .form-header {
          margin-bottom: var(--space-xl);
        }
        .btn-volver {
          background: none;
          border: none;
          color: var(--texto-secundario);
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          font-weight: 600;
        }
        .seccion-form {
          background-color: var(--blanco);
          border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg);
          padding: var(--space-xl);
          margin-bottom: var(--space-xl);
        }
        .seccion-titulo {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 var(--space-lg);
          padding-bottom: var(--space-sm);
          border-bottom: 1px solid var(--borde-claro);
        }
        .grid-form-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-md);
          margin-bottom: var(--space-md);
        }
        .grid-form-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-md);
          margin-bottom: var(--space-md);
        }
        .grid-form-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-md);
        }
        @media (max-width: 768px) {
          .grid-form-3, .grid-form-4, .grid-form-2 {
            grid-template-columns: 1fr;
          }
        }
        .campo-form {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .campo-form label {
          font-size: 12px;
          font-weight: 600;
          color: var(--texto-primario);
        }
        .campo-form input,
        .campo-form select {
          padding: 8px 12px;
          border: 1px solid var(--borde);
          border-radius: var(--radius-sm);
          font-family: inherit;
          font-size: 13px;
          outline: none;
        }
        .campo-form input:focus,
        .campo-form select:focus {
          border-color: var(--naranja-500);
        }
        .grid-foto {
          display: grid;
          grid-template-columns: 1fr 220px;
          gap: var(--space-xl);
          align-items: center;
        }
        @media (max-width: 640px) {
          .grid-foto { grid-template-columns: 1fr; }
        }
        .preview-foto-box {
          width: 220px;
          height: 150px;
          border: 1px dashed var(--borde);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--superficie);
          overflow: hidden;
        }
        .preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .form-acciones {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-md);
          margin-top: var(--space-xl);
        }
        .toast-exito {
          background-color: var(--exito-fondo);
          color: var(--exito-texto);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          margin-bottom: var(--space-lg);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};
