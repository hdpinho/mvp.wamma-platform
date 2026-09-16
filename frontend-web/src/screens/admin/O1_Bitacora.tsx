import React, { useEffect, useState } from 'react';
import { consultarBitacora, type EventoBitacora, type FiltrosBitacora } from '../../api/auditoria';
import { Boton } from '../../components/Boton';
import { ESTILOS_ADMIN } from '../../components/admin/estilos';
import { fechaHora, mensajeDe } from '../../components/admin/formato';
import { nombreRol } from '../../types/seguridad';

/**
 * O1 · Bitácora de auditoría (módulo 001, plan §8). Para `auditoria.ver`: auditor y
 * administrador. Solo lectura: el motor de la base rechaza modificar o borrar eventos.
 */

/** Acciones que registra la plataforma, con su nombre para las personas. */
const ACCIONES: Record<string, string> = {
  'sesion.iniciada': 'Inicio de sesión',
  'sesion.fallida': 'Ingreso fallido',
  'sesion.cerrada': 'Cierre de sesión',
  '2fa.activado': '2FA activado',
  '2fa.restablecido': '2FA restablecido',
  '2fa.recuperacion_usada': 'Código de recuperación usado',
  'contrasena.cambiada': 'Contraseña cambiada',
  'contrasena.restablecida': 'Contraseña restablecida',
  'usuario.creado': 'Usuario creado',
  'usuario.actualizado': 'Usuario actualizado',
  'usuario.desactivado': 'Usuario desactivado',
  'usuario.reactivado': 'Usuario reactivado',
  'rol.asignado': 'Rol asignado',
  'rol.retirado': 'Rol retirado',
  'acceso.denegado': 'Acceso denegado',
};

const ENTIDADES_CONOCIDAS = ['usuario', 'sesion'];

function claseAccion(accion: string): string {
  if (accion === 'sesion.fallida' || accion === 'acceso.denegado') return 'peligro';
  if (accion.endsWith('restablecida') || accion.endsWith('restablecido') || accion === 'usuario.desactivado') {
    return 'alerta';
  }
  return 'neutro';
}

function valorLegible(clave: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (Array.isArray(valor)) {
    return valor.map((v) => (clave === 'roles' ? nombreRol(String(v)) : String(v))).join(', ') || '—';
  }
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

/** Una línea por dato: "campo: antes → después" cuando cambió, o su valor si solo hay uno. */
function lineasDeDetalle(evento: EventoBitacora): string[] {
  const antes = evento.antes ?? {};
  const despues = evento.despues ?? {};
  const claves = Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)]));
  return claves.map((clave) => {
    const etiqueta = clave.replace(/_/g, ' ');
    const a = clave in antes ? valorLegible(clave, antes[clave]) : null;
    const d = clave in despues ? valorLegible(clave, despues[clave]) : null;
    if (a !== null && d !== null && a !== d) return `${etiqueta}: ${a} → ${d}`;
    return `${etiqueta}: ${d ?? a}`;
  });
}

export const O1_Bitacora: React.FC = () => {
  const [borrador, setBorrador] = useState<FiltrosBitacora>({});
  const [filtros, setFiltros] = useState<FiltrosBitacora>({});
  const [eventos, setEventos] = useState<EventoBitacora[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    consultarBitacora(filtros)
      .then((pagina) => {
        if (!vigente) return;
        setEventos(pagina.eventos);
        setCursor(pagina.siguienteCursor);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        setError(mensajeDe(e));
        setEventos([]);
      });
    return () => {
      vigente = false;
    };
  }, [filtros]);

  const cambiar = (clave: keyof FiltrosBitacora) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setBorrador((actual) => ({ ...actual, [clave]: e.target.value }));

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (borrador.desde && borrador.hasta && borrador.hasta < borrador.desde) {
      setError('La fecha «hasta» es anterior a «desde».');
      return;
    }
    setEventos(null);
    setFiltros({ ...borrador });
  };

  const limpiar = () => {
    setBorrador({});
    setEventos(null);
    setFiltros({});
  };

  const cargarMas = async () => {
    if (!cursor) return;
    setCargandoMas(true);
    try {
      const pagina = await consultarBitacora(filtros, cursor);
      setEventos((actuales) => [...(actuales ?? []), ...pagina.eventos]);
      setCursor(pagina.siguienteCursor);
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setCargandoMas(false);
    }
  };

  return (
    <div>
      <div className="adm-cabecera">
        <div>
          <h1 className="adm-titulo">Bitácora de auditoría</h1>
          <p className="adm-sub">
            Quién hizo qué y cuándo en el backoffice, empezando por lo más reciente. Nadie puede modificarla ni borrarla.
            No guarda contraseñas, códigos ni tokens, y los datos personales aparecen enmascarados.
          </p>
        </div>
      </div>

      <form className="adm-panel" onSubmit={buscar} aria-label="Filtros de la bitácora">
        <div className="adm-filtros">
          <div className="form-group">
            <label className="form-label" htmlFor="filtro-desde">
              Desde
            </label>
            <input id="filtro-desde" type="date" className="form-input" value={borrador.desde ?? ''} onChange={cambiar('desde')} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="filtro-hasta">
              Hasta
            </label>
            <input id="filtro-hasta" type="date" className="form-input" value={borrador.hasta ?? ''} onChange={cambiar('hasta')} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="filtro-usuario">
              Usuario
            </label>
            <input
              id="filtro-usuario"
              className="form-input"
              placeholder="nombre de usuario"
              autoCapitalize="none"
              spellCheck={false}
              value={borrador.usuario ?? ''}
              onChange={cambiar('usuario')}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="filtro-accion">
              Acción
            </label>
            <select id="filtro-accion" className="form-input" value={borrador.accion ?? ''} onChange={cambiar('accion')}>
              <option value="">Todas</option>
              {Object.entries(ACCIONES).map(([codigo, nombre]) => (
                <option key={codigo} value={codigo}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="filtro-entidad">
              Entidad
            </label>
            <input
              id="filtro-entidad"
              className="form-input"
              list="entidades-bitacora"
              placeholder="usuario, sesion…"
              value={borrador.entidad ?? ''}
              onChange={cambiar('entidad')}
            />
            <datalist id="entidades-bitacora">
              {ENTIDADES_CONOCIDAS.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="adm-acciones">
          <Boton type="submit">Buscar</Boton>
          <button type="button" className="adm-boton-sec" onClick={limpiar}>
            Limpiar
          </button>
          <span className="adm-ayuda" style={{ marginTop: 0 }}>
            Las fechas se interpretan en la hora de Venezuela.
          </span>
        </div>
      </form>

      {error && (
        <div className="adm-aviso error" role="alert">
          {error}
        </div>
      )}

      {eventos === null ? (
        <div className="adm-vacio" role="status">
          Cargando la bitácora…
        </div>
      ) : eventos.length === 0 ? (
        !error && <div className="adm-vacio">No hay eventos con estos filtros.</div>
      ) : (
        <>
          <div className="adm-tabla-envoltura">
            <table className="adm-tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evento) => (
                  <tr key={evento.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fechaHora(evento.fecha, true)}</td>
                    <td>{evento.usuario ?? <span className="adm-mudo">—</span>}</td>
                    <td>
                      <span className={`adm-badge ${claseAccion(evento.accion)}`}>
                        {ACCIONES[evento.accion] ?? evento.accion}
                      </span>
                      <div className="adm-codigo">{evento.accion}</div>
                    </td>
                    <td>
                      {evento.entidad}
                      {evento.entidadId && (
                        <div className="adm-codigo" title={evento.entidadId}>
                          {evento.entidadId.slice(0, 8)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="adm-detalle">
                        {lineasDeDetalle(evento).map((linea, i) => (
                          <div key={`${i}-${linea}`}>{linea}</div>
                        ))}
                      </div>
                    </td>
                    <td className="adm-codigo">{evento.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursor && (
            <button type="button" className="adm-boton-sec" onClick={cargarMas} disabled={cargandoMas}>
              {cargandoMas ? 'Cargando…' : 'Cargar más eventos'}
            </button>
          )}
        </>
      )}

      <style>{ESTILOS_ADMIN}</style>
    </div>
  );
};
