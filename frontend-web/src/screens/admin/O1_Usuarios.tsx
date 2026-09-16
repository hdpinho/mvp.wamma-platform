import React, { useEffect, useState } from 'react';
import { ErrorApi } from '../../api/cliente';
import {
  actualizarUsuario,
  crearUsuario,
  listarRoles,
  listarUsuarios,
  restablecer2fa,
  restablecerContrasena,
  type CambiosUsuario,
  type RolVista,
  type UsuarioVista,
} from '../../api/usuarios';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/admin/CampoTexto';
import { ESTILOS_ADMIN } from '../../components/admin/estilos';
import { estaBloqueado, fechaHora, hora, mensajeDe } from '../../components/admin/formato';
import { useSesion } from '../../state/sesionContexto';
import { nombrePermiso, nombreRol, ROLES, type Rol } from '../../types/seguridad';

/**
 * O1 · Usuarios (módulo 001, plan §4.3 y §11). Solo para `usuarios.gestionar`.
 *
 * Alta con contraseña temporal, datos, roles, activar o desactivar, y restablecer la
 * contraseña o el 2FA. Cada cambio queda en la bitácora, y el servidor impide quedarse sin
 * administradores activos.
 */

type Seleccion = { tipo: 'nuevo' } | { tipo: 'editar'; id: string } | null;

interface ContrasenaTemporal {
  usuario: string;
  contrasena: string;
  motivo: 'alta' | 'restablecimiento';
}

const comoErrorApi = (e: unknown) => (e instanceof ErrorApi ? e : new ErrorApi(0, 'Error', mensajeDe(e)));

const mismosRoles = (a: Rol[], b: Rol[]) => a.length === b.length && a.every((r) => b.includes(r));

export const O1_Usuarios: React.FC = () => {
  const { perfil } = useSesion();
  const [usuarios, setUsuarios] = useState<UsuarioVista[] | null>(null);
  const [roles, setRoles] = useState<RolVista[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [temporal, setTemporal] = useState<ContrasenaTemporal | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarUsuarios(), listarRoles()])
      .then(([lista, catalogo]) => {
        if (!vigente) return;
        setUsuarios(lista);
        setRoles(catalogo);
        setErrorCarga(null);
      })
      .catch((e: unknown) => {
        if (vigente) setErrorCarga(mensajeDe(e));
      });
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const reemplazar = (actualizado: UsuarioVista) =>
    setUsuarios((lista) => (lista ?? []).map((u) => (u.id === actualizado.id ? actualizado : u)));

  const seleccionar = (s: Seleccion) => {
    setSeleccion(s);
    setAviso(null);
  };

  const seleccionado = seleccion?.tipo === 'editar' ? (usuarios?.find((u) => u.id === seleccion.id) ?? null) : null;

  // Activos primero; dentro de cada grupo, por nombre de usuario.
  const ordenados = [...(usuarios ?? [])].sort(
    (a, b) => Number(a.estado === 'inactivo') - Number(b.estado === 'inactivo') || a.usuario.localeCompare(b.usuario),
  );

  return (
    <div>
      <div className="adm-cabecera">
        <div>
          <h1 className="adm-titulo">Usuarios</h1>
          <p className="adm-sub">
            Personal con acceso al backoffice. Cada persona entra con su usuario, su contraseña y un código de su app
            autenticadora. Lo que puede hacer depende de sus roles.
          </p>
        </div>
        <Boton onClick={() => seleccionar({ tipo: 'nuevo' })}>+ Nuevo usuario</Boton>
      </div>

      {temporal && <AvisoContrasena temporal={temporal} alCerrar={() => setTemporal(null)} />}
      {aviso && (
        <div className="adm-aviso exito" role="status">
          <button type="button" className="adm-aviso-cerrar" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
          {aviso}
        </div>
      )}

      {seleccion?.tipo === 'nuevo' && (
        <FormularioAlta
          roles={roles}
          alCrear={(creado, contrasena) => {
            setUsuarios((lista) => [...(lista ?? []), creado]);
            setSeleccion(null);
            setTemporal({ usuario: creado.usuario, contrasena, motivo: 'alta' });
          }}
          alCancelar={() => setSeleccion(null)}
        />
      )}

      {seleccionado && (
        <PanelUsuario
          key={seleccionado.id}
          usuario={seleccionado}
          roles={roles}
          esPropio={seleccionado.id === perfil?.id}
          alActualizar={(actualizado, mensaje) => {
            reemplazar(actualizado);
            setAviso(mensaje);
          }}
          alRestablecerContrasena={(contrasena) => {
            setTemporal({ usuario: seleccionado.usuario, contrasena, motivo: 'restablecimiento' });
            setRecarga((n) => n + 1);
          }}
          alRestablecer2fa={() => {
            setAviso(`Se restableció el 2FA de ${seleccionado.usuario}. Lo registrará de nuevo en su próximo ingreso.`);
            setRecarga((n) => n + 1);
          }}
          alCerrar={() => setSeleccion(null)}
        />
      )}

      {errorCarga ? (
        <div className="adm-aviso error" role="alert">
          {errorCarga}
        </div>
      ) : usuarios === null ? (
        <div className="adm-vacio" role="status">
          Cargando usuarios…
        </div>
      ) : (
        <div className="adm-tabla-envoltura">
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Roles</th>
                <th>Estado</th>
                <th>2FA</th>
                <th>Último ingreso</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((u) => (
                <tr
                  key={u.id}
                  className={`seleccionable ${seleccionado?.id === u.id ? 'activa' : ''}`}
                  onClick={() => seleccionar({ tipo: 'editar', id: u.id })}
                >
                  <td>
                    <button type="button" className="adm-enlace-fila">
                      {u.usuario}
                    </button>
                    <div className="adm-mudo">
                      {u.nombre} {u.apellido}
                      {u.id === perfil?.id && ' · tú'}
                    </div>
                  </td>
                  <td>{u.correo}</td>
                  <td>
                    {u.roles.map((r) => (
                      <span key={r} className="adm-badge neutro">
                        {nombreRol(r)}
                      </span>
                    ))}
                  </td>
                  <td>
                    <EstadoCuenta usuario={u} />
                  </td>
                  <td>
                    {u.segundoFactorActivo ? (
                      <span className="adm-badge ok">Activo</span>
                    ) : (
                      <span className="adm-badge alerta" title="Lo activará en su próximo ingreso">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td>{u.ultimoIngreso ? fechaHora(u.ultimoIngreso) : <span className="adm-mudo">Nunca</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{ESTILOS_ADMIN}</style>
    </div>
  );
};

const EstadoCuenta: React.FC<{ usuario: UsuarioVista }> = ({ usuario }) => {
  if (usuario.estado === 'inactivo') return <span className="adm-badge neutro">Inactivo</span>;
  if (usuario.bloqueadoHasta && estaBloqueado(usuario.bloqueadoHasta)) {
    return (
      <span className="adm-badge peligro" title="Demasiados intentos fallidos. Se desbloquea sola.">
        Bloqueado hasta {hora(usuario.bloqueadoHasta)}
      </span>
    );
  }
  return <span className="adm-badge ok">Activo</span>;
};

const AvisoContrasena: React.FC<{ temporal: ContrasenaTemporal; alCerrar: () => void }> = ({ temporal, alCerrar }) => {
  const [copiada, setCopiada] = useState(false);
  const copiar = () => {
    navigator.clipboard
      ?.writeText(temporal.contrasena)
      .then(() => setCopiada(true))
      .catch(() => setCopiada(false));
  };
  return (
    <div className="adm-aviso info" role="status">
      <strong>
        {temporal.motivo === 'alta'
          ? `Usuario ${temporal.usuario} creado.`
          : `Contraseña de ${temporal.usuario} restablecida.`}
      </strong>{' '}
      Su contraseña temporal es:
      <div>
        <code className="adm-secreto" id="contrasena-temporal">
          {temporal.contrasena}
        </code>
        <button type="button" className="adm-boton-sec" onClick={copiar}>
          {copiada ? '✓ Copiada' : 'Copiar'}
        </button>
      </div>
      Entrégala por un canal seguro, de preferencia en persona o por teléfono. Solo se muestra esta vez: si se pierde,
      restablécela de nuevo. En su próximo ingreso deberá cambiarla
      {temporal.motivo === 'alta' ? ' y activar el 2FA' : ''}.
      <div style={{ marginTop: '10px' }}>
        <button type="button" className="adm-boton-sec" onClick={alCerrar}>
          Listo, ya la anoté
        </button>
      </div>
    </div>
  );
};

const SelectorRoles: React.FC<{
  roles: RolVista[];
  marcados: Rol[];
  alCambiar: (roles: Rol[]) => void;
  error?: string;
}> = ({ roles, marcados, alCambiar, error }) => (
  <fieldset className="adm-fieldset">
    <legend className="adm-etiqueta-grupo">Roles (al menos uno)</legend>
    <div className="adm-roles">
      {ROLES.map((rol) => {
        const marcado = marcados.includes(rol.codigo);
        const permisos = roles.find((r) => r.codigo === rol.codigo)?.permisos ?? [];
        return (
          <label key={rol.codigo} className={`adm-rol ${marcado ? 'marcado' : ''}`}>
            <input
              type="checkbox"
              checked={marcado}
              onChange={() =>
                alCambiar(marcado ? marcados.filter((c) => c !== rol.codigo) : [...marcados, rol.codigo])
              }
            />
            <span>
              <strong>{rol.nombre}</strong>
              <small>{rol.proposito}</small>
              {permisos.length > 0 && (
                <small className="adm-permisos">Puede: {permisos.map((p) => nombrePermiso(p)).join(' · ')}</small>
              )}
            </span>
          </label>
        );
      })}
    </div>
    {error && <div className="adm-error-campo">{error}</div>}
  </fieldset>
);

const FormularioAlta: React.FC<{
  roles: RolVista[];
  alCrear: (usuario: UsuarioVista, contrasenaTemporal: string) => void;
  alCancelar: () => void;
}> = ({ roles, alCrear, alCancelar }) => {
  const [usuario, setUsuario] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [marcados, setMarcados] = useState<Rol[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const creado = await crearUsuario({
        usuario: usuario.trim().toLowerCase(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correo.trim(),
        roles: marcados,
      });
      alCrear(creado.usuario, creado.contrasenaTemporal);
    } catch (err) {
      setError(comoErrorApi(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="adm-panel" onSubmit={enviar} noValidate aria-label="Nuevo usuario">
      <h2>Nuevo usuario</h2>
      <p className="adm-sub">
        Al guardar verás una contraseña temporal, una sola vez. En su primer ingreso, la persona elegirá su propia
        contraseña y activará el 2FA.
      </p>
      {error && (
        <div className="adm-aviso error" role="alert">
          {error.detalle || error.titulo}
        </div>
      )}
      <div className="adm-rejilla">
        <CampoTexto
          id="alta-usuario"
          etiqueta="Usuario"
          ayuda="3 a 50 caracteres: minúsculas, números, punto, guion o guion bajo. Con él se ingresa y no se puede cambiar."
          autoCapitalize="none"
          spellCheck={false}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          error={error?.errores.usuario}
        />
        <CampoTexto
          id="alta-correo"
          etiqueta="Correo"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={error?.errores.correo}
        />
        <CampoTexto
          id="alta-nombre"
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={error?.errores.nombre}
        />
        <CampoTexto
          id="alta-apellido"
          etiqueta="Apellido"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          error={error?.errores.apellido}
        />
      </div>
      <SelectorRoles roles={roles} marcados={marcados} alCambiar={setMarcados} error={error?.errores.roles} />
      <div className="adm-acciones">
        <Boton type="submit" loading={enviando}>
          Crear usuario
        </Boton>
        <button type="button" className="adm-boton-sec" onClick={alCancelar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
};

const PanelUsuario: React.FC<{
  usuario: UsuarioVista;
  roles: RolVista[];
  esPropio: boolean;
  alActualizar: (usuario: UsuarioVista, mensaje: string) => void;
  alRestablecerContrasena: (contrasenaTemporal: string) => void;
  alRestablecer2fa: () => void;
  alCerrar: () => void;
}> = ({ usuario, roles, esPropio, alActualizar, alRestablecerContrasena, alRestablecer2fa, alCerrar }) => {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [apellido, setApellido] = useState(usuario.apellido);
  const [correo, setCorreo] = useState(usuario.correo);
  const [marcados, setMarcados] = useState<Rol[]>(usuario.roles);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ErrorApi | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const cambios: CambiosUsuario = {};
    if (nombre.trim() !== usuario.nombre) cambios.nombre = nombre.trim();
    if (apellido.trim() !== usuario.apellido) cambios.apellido = apellido.trim();
    if (correo.trim() !== usuario.correo) cambios.correo = correo.trim();
    if (!mismosRoles(marcados, usuario.roles)) cambios.roles = marcados;
    if (Object.keys(cambios).length === 0) {
      setError(new ErrorApi(0, 'Sin cambios', 'No hay cambios que guardar.'));
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      alActualizar(await actualizarUsuario(usuario.id, cambios), `Cambios de ${usuario.usuario} guardados.`);
    } catch (err) {
      setError(comoErrorApi(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="adm-panel" onSubmit={guardar} noValidate aria-label={`Usuario ${usuario.usuario}`}>
      <div className="adm-cabecera" style={{ marginBottom: '8px' }}>
        <div>
          <h2>{usuario.usuario}</h2>
          <p className="adm-sub" style={{ marginBottom: 0 }}>
            Alta: {fechaHora(usuario.creadoEn)} · Último ingreso:{' '}
            {usuario.ultimoIngreso ? fechaHora(usuario.ultimoIngreso) : 'nunca'}
          </p>
        </div>
        <button type="button" className="adm-boton-sec" onClick={alCerrar}>
          Cerrar
        </button>
      </div>
      {error && (
        <div className="adm-aviso error" role="alert">
          {error.detalle || error.titulo}
        </div>
      )}
      <div className="adm-rejilla">
        <CampoTexto
          id="editar-nombre"
          etiqueta="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={error?.errores.nombre}
        />
        <CampoTexto
          id="editar-apellido"
          etiqueta="Apellido"
          value={apellido}
          onChange={(e) => setApellido(e.target.value)}
          error={error?.errores.apellido}
        />
        <CampoTexto
          id="editar-correo"
          etiqueta="Correo"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={error?.errores.correo}
        />
      </div>
      <SelectorRoles roles={roles} marcados={marcados} alCambiar={setMarcados} error={error?.errores.roles} />
      <Boton type="submit" loading={guardando}>
        Guardar cambios
      </Boton>

      <hr className="adm-separador" />
      <h2>Acceso</h2>
      {esPropio ? (
        <p className="adm-sub">
          Es tu propia cuenta: para cambiar tu contraseña usa <strong>Mi cuenta</strong>. No puedes desactivarte a ti
          mismo.
        </p>
      ) : (
        <div className="adm-acciones" style={{ alignItems: 'flex-start' }}>
          {usuario.estado === 'activo' ? (
            <AccionConfirmada
              key="desactivar"
              etiqueta="Desactivar usuario"
              pregunta="Se cerrarán sus sesiones abiertas y no podrá ingresar hasta que lo reactives."
              confirmar="desactivar"
              peligro
              alConfirmar={async () =>
                alActualizar(
                  await actualizarUsuario(usuario.id, { estado: 'inactivo' }),
                  `${usuario.usuario} quedó inactivo.`,
                )
              }
            />
          ) : (
            <AccionConfirmada
              key="reactivar"
              etiqueta="Reactivar usuario"
              pregunta="Podrá volver a ingresar con su contraseña y su app autenticadora."
              confirmar="reactivar"
              alConfirmar={async () =>
                alActualizar(await actualizarUsuario(usuario.id, { estado: 'activo' }), `${usuario.usuario} quedó activo.`)
              }
            />
          )}
          <AccionConfirmada
            etiqueta="Restablecer contraseña"
            pregunta="Se generará una contraseña temporal y se cerrarán sus sesiones. Deberá cambiarla en su próximo ingreso."
            confirmar="restablecer"
            alConfirmar={async () => alRestablecerContrasena((await restablecerContrasena(usuario.id)).contrasenaTemporal)}
          />
          <AccionConfirmada
            etiqueta="Restablecer 2FA"
            pregunta="Se borrarán su app autenticadora registrada y sus códigos de recuperación, y se cerrarán sus sesiones. En su próximo ingreso la registrará de nuevo."
            confirmar="restablecer"
            alConfirmar={async () => {
              await restablecer2fa(usuario.id);
              alRestablecer2fa();
            }}
          />
        </div>
      )}
    </form>
  );
};

/** Acción con un paso de confirmación en línea, sin ventanas emergentes del navegador. */
const AccionConfirmada: React.FC<{
  etiqueta: string;
  pregunta: string;
  confirmar: string;
  peligro?: boolean;
  alConfirmar: () => Promise<void>;
}> = ({ etiqueta, pregunta, confirmar, peligro = false, alConfirmar }) => {
  const [abierta, setAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clase = `adm-boton-sec ${peligro ? 'peligro' : ''}`;

  if (!abierta) {
    return (
      <button type="button" className={clase} onClick={() => setAbierta(true)}>
        {etiqueta}
      </button>
    );
  }

  const ejecutar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await alConfirmar();
      setAbierta(false);
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="adm-confirmar" role="group" aria-label={etiqueta}>
      <strong>{etiqueta}</strong>
      <span>{pregunta}</span>
      {error && <span className="adm-error-campo">{error}</span>}
      <div className="adm-acciones">
        <button type="button" className={clase} onClick={ejecutar} disabled={enviando}>
          {enviando ? 'Procesando…' : `Sí, ${confirmar}`}
        </button>
        <button type="button" className="adm-boton-sec" onClick={() => setAbierta(false)} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </div>
  );
};
