import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import QRCode from 'qrcode';
import { Logo } from '../../components/Logo';
import { Boton } from '../../components/Boton';
import { ErrorApi } from '../../api/cliente';
import {
  cambiarContrasenaInicial,
  confirmarActivacion2fa,
  ingresar,
  iniciarActivacion2fa,
  verificarSegundoFactor,
  type ActivacionTotp,
  type Perfil,
  type RespuestaSesion,
  type SiguientePaso,
} from '../../api/auth';
import { useSesion, type MotivoSalida } from '../../state/sesionContexto';
import { mensajeDe } from '../../components/admin/formato';

/**
 * O1 · Ingreso al backoffice con 2FA (módulo 001, plan §4.1 y §11).
 *
 * Contraseña → (primer ingreso: contraseña propia → activación del 2FA → códigos de
 * recuperación) → código de 6 dígitos. El token temporal de cada paso vive 5 minutos en
 * el servidor y aquí solo existe en memoria: nunca se guarda en el navegador.
 */

interface SesionLista {
  token: string;
  perfil: Perfil;
  codigos: string[];
}

type Paso =
  | { tipo: 'credenciales' }
  | { tipo: 'cambiar_contrasena'; token: string }
  | { tipo: 'activar_2fa'; token: string; porRecuperacion: boolean }
  | { tipo: 'codigo_2fa'; token: string }
  | { tipo: 'codigos'; sesion: SesionLista };

const AVISOS_SALIDA: Record<NonNullable<MotivoSalida>, string> = {
  voluntaria: 'Cerraste tu sesión.',
  vencida: 'Tu sesión terminó: venció o la cerró un administrador. Ingresa de nuevo.',
  inactividad: 'Cerramos tu sesión tras 30 minutos sin actividad.',
  sin_conexion: 'No pudimos confirmar tu sesión con el servidor. Ingresa de nuevo.',
};

/** Pasados estos milisegundos sin respuesta, se avisa de que el servidor está despertando. */
const AVISO_DESPERTAR_MS = 3000;

const esVencimiento = (e: unknown) => e instanceof ErrorApi && e.estado === 401;

/** Tras ingresar, solo se vuelve a rutas del backoffice: nada de redirecciones abiertas. */
function destinoSeguro(desde: string | undefined): string {
  return desde && desde.startsWith('/admin') && !desde.startsWith('/admin/ingresar') ? desde : '/admin';
}

function sesionDe(respuesta: RespuestaSesion): SesionLista {
  if (!respuesta.token || !respuesta.usuario) {
    throw new ErrorApi(0, 'Respuesta incompleta', 'El servidor no devolvió la sesión. Intenta de nuevo.');
  }
  return { token: respuesta.token, perfil: respuesta.usuario, codigos: respuesta.codigosRecuperacion ?? [] };
}

const soloDigitos = (valor: string) => valor.replace(/\D/g, '').slice(0, 6);

export const O1_Ingreso: React.FC = () => {
  const { estado, motivoSalida, iniciar } = useSesion();
  const location = useLocation();
  const [paso, setPaso] = useState<Paso>({ tipo: 'credenciales' });
  const [aviso, setAviso] = useState<string | null>(null);

  if (estado === 'activa') {
    return <Navigate to={destinoSeguro((location.state as { desde?: string } | null)?.desde)} replace />;
  }

  const avanzar = (token: string, siguiente: SiguientePaso) => {
    setAviso(null);
    if (siguiente === 'CAMBIAR_CONTRASENA') setPaso({ tipo: 'cambiar_contrasena', token });
    else if (siguiente === 'ACTIVAR_2FA') setPaso({ tipo: 'activar_2fa', token, porRecuperacion: false });
    else setPaso({ tipo: 'codigo_2fa', token });
  };

  const vencido = () => {
    setPaso({ tipo: 'credenciales' });
    setAviso('Pasaron más de 5 minutos desde que escribiste tu contraseña. Empieza de nuevo.');
  };

  const avisoVisible = aviso ?? (paso.tipo === 'credenciales' && motivoSalida ? AVISOS_SALIDA[motivoSalida] : null);

  let contenido: React.ReactNode;
  if (estado === 'sin_servidor') {
    contenido = <SinServidor />;
  } else if (estado === 'verificando') {
    contenido = (
      <p className="ingreso-sub" role="status">
        Verificando tu sesión…
      </p>
    );
  } else if (paso.tipo === 'credenciales') {
    contenido = <FormCredenciales alAvanzar={avanzar} />;
  } else if (paso.tipo === 'cambiar_contrasena') {
    contenido = (
      <FormContrasenaInicial token={paso.token} alAvanzar={(s) => avanzar(paso.token, s)} alVencer={vencido} />
    );
  } else if (paso.tipo === 'activar_2fa') {
    contenido = (
      <ActivarDosPasos
        key={`${paso.token}-${paso.porRecuperacion}`}
        token={paso.token}
        porRecuperacion={paso.porRecuperacion}
        alActivar={(sesion) => setPaso({ tipo: 'codigos', sesion })}
        alVencer={vencido}
      />
    );
  } else if (paso.tipo === 'codigo_2fa') {
    contenido = (
      <FormCodigo
        token={paso.token}
        alEntrar={(sesion) => iniciar(sesion.token, sesion.perfil)}
        alReactivar={() => setPaso({ tipo: 'activar_2fa', token: paso.token, porRecuperacion: true })}
        alVencer={vencido}
      />
    );
  } else {
    const { sesion } = paso;
    contenido = <CodigosRecuperacion sesion={sesion} alContinuar={() => iniciar(sesion.token, sesion.perfil)} />;
  }

  return (
    <div className="ingreso-pagina">
      <div className="ingreso-tarjeta">
        <div className="ingreso-cabecera">
          <Logo articulacion="horizontal" variante="blanco" alto={30} />
          <span className="ingreso-badge">BACKOFFICE</span>
        </div>
        <div className="ingreso-cuerpo">
          {avisoVisible && <Mensaje tipo="info">{avisoVisible}</Mensaje>}
          {contenido}
        </div>
        <div className="ingreso-pie">
          <Link to="/">← Volver al sitio público</Link>
        </div>
      </div>
      <style>{ESTILOS_INGRESO}</style>
    </div>
  );
};

const Mensaje: React.FC<{ tipo: 'error' | 'info'; children: React.ReactNode }> = ({ tipo, children }) => (
  <div className={`ingreso-mensaje ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
    {children}
  </div>
);

const SinServidor: React.FC = () => (
  <div>
    <h1 className="ingreso-titulo">Modo maqueta</h1>
    <p className="ingreso-sub">
      Esta copia del sitio no está conectada a un servidor, así que el backoffice se abre sin inicio de sesión.
    </p>
    <Link to="/admin" className="ingreso-boton-enlace">
      Abrir el backoffice
    </Link>
  </div>
);

const FormCredenciales: React.FC<{ alAvanzar: (token: string, siguiente: SiguientePaso) => void }> = ({
  alAvanzar,
}) => {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [despertando, setDespertando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const aviso = setTimeout(() => setDespertando(true), AVISO_DESPERTAR_MS);
    try {
      const paso = await ingresar(usuario.trim().toLowerCase(), contrasena);
      alAvanzar(paso.tokenTemporal, paso.siguiente);
    } catch (err) {
      setError(mensajeDe(err));
      setContrasena('');
    } finally {
      clearTimeout(aviso);
      setDespertando(false);
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <h1 className="ingreso-titulo">Ingresa al backoffice</h1>
      <p className="ingreso-sub">Con tu usuario y contraseña. Después te pediremos el código de tu app autenticadora.</p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="form-group">
        <label className="form-label" htmlFor="ingreso-usuario">
          Usuario
        </label>
        <input
          id="ingreso-usuario"
          className="form-input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoFocus
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="ingreso-contrasena">
          Contraseña
        </label>
        <input
          id="ingreso-contrasena"
          type="password"
          className="form-input"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
      </div>
      <Boton type="submit" fullWidth loading={enviando} disabled={!usuario.trim() || !contrasena}>
        Ingresar
      </Boton>
      {despertando && (
        <p className="ingreso-nota" role="status">
          Despertando el servidor; puede tardar cerca de un minuto…
        </p>
      )}
    </form>
  );
};

const FormContrasenaInicial: React.FC<{
  token: string;
  alAvanzar: (siguiente: SiguientePaso) => void;
  alVencer: () => void;
}> = ({ token, alAvanzar, alVencer }) => {
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const respuesta = await cambiarContrasenaInicial(token, nueva);
      alAvanzar(respuesta.siguiente);
    } catch (err) {
      if (esVencimiento(err)) alVencer();
      else setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <h1 className="ingreso-titulo">Crea tu contraseña</h1>
      <p className="ingreso-sub">
        Es tu primer ingreso, o un administrador restableció tu contraseña. Elige una propia de al menos 12
        caracteres; una frase fácil de recordar funciona bien. No puede contener tu usuario ni ser una contraseña
        común.
      </p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="form-group">
        <label className="form-label" htmlFor="contrasena-nueva">
          Nueva contraseña
        </label>
        <input
          id="contrasena-nueva"
          type="password"
          className="form-input"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          autoFocus
        />
        <div className="ingreso-nota">{nueva.length} caracteres (mínimo 12)</div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="contrasena-repetida">
          Repite la nueva contraseña
        </label>
        <input
          id="contrasena-repetida"
          type="password"
          className="form-input"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
      </div>
      <Boton type="submit" fullWidth loading={enviando} disabled={!nueva || !repetida}>
        Guardar contraseña
      </Boton>
    </form>
  );
};

type ActivacionConQr = ActivacionTotp & { qr: string };

const ActivarDosPasos: React.FC<{
  token: string;
  porRecuperacion: boolean;
  alActivar: (sesion: SesionLista) => void;
  alVencer: () => void;
}> = ({ token, porRecuperacion, alActivar, alVencer }) => {
  const [activacion, setActivacion] = useState<ActivacionConQr | null>(null);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // En desarrollo React monta dos veces: se pide un solo secreto por token temporal.
  const peticion = useRef<{ token: string; promesa: Promise<ActivacionConQr> } | null>(null);

  useEffect(() => {
    if (peticion.current?.token !== token) {
      peticion.current = {
        token,
        promesa: iniciarActivacion2fa(token).then(async (a) => ({
          ...a,
          qr: await QRCode.toDataURL(a.uriOtpauth, { margin: 1, width: 200, errorCorrectionLevel: 'M' }),
        })),
      };
    }
    let vigente = true;
    peticion.current.promesa
      .then((a) => {
        if (vigente) setActivacion(a);
      })
      .catch((e: unknown) => {
        if (!vigente) return;
        if (esVencimiento(e)) alVencer();
        else setError(mensajeDe(e));
      });
    return () => {
      vigente = false;
    };
  }, [token, alVencer]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      alActivar(sesionDe(await confirmarActivacion2fa(token, codigo)));
    } catch (err) {
      if (esVencimiento(err)) {
        alVencer();
      } else {
        setError(mensajeDe(err));
        setCodigo('');
      }
    } finally {
      setEnviando(false);
    }
  };

  const clave = activacion?.secreto.match(/.{1,4}/g)?.join(' ') ?? '';

  return (
    <form onSubmit={confirmar} noValidate>
      <h1 className="ingreso-titulo">Activa la verificación en dos pasos</h1>
      {porRecuperacion ? (
        <Mensaje tipo="info">
          Usaste un código de recuperación. Registra de nuevo tu app autenticadora: al terminar recibirás 10 códigos
          nuevos y los anteriores dejarán de servir.
        </Mensaje>
      ) : (
        <p className="ingreso-sub">
          Desde ahora, cada ingreso te pedirá además un código que genera tu teléfono. Así nadie entra solo con tu
          contraseña.
        </p>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <ol className="ingreso-pasos">
        <li>
          Abre en tu teléfono una app autenticadora: Google Authenticator, Microsoft Authenticator, Authy u otra
          compatible.
        </li>
        <li>
          Agrega una cuenta y escanea este código QR:
          <div className="ingreso-qr">
            {activacion ? (
              <img
                src={activacion.qr}
                alt="Código QR para registrar WAMMA en la app autenticadora"
                width={200}
                height={200}
              />
            ) : (
              <span className="ingreso-nota">Generando el código…</span>
            )}
          </div>
          {activacion && (
            <>
              ¿No puedes escanearlo? Escribe esta clave en la app:
              <code id="clave-2fa" className="ingreso-clave">
                {clave}
              </code>
            </>
          )}
        </li>
        <li>
          <label htmlFor="codigo-activacion">Escribe el código de 6 dígitos que muestra la app:</label>
          <input
            id="codigo-activacion"
            className="form-input ingreso-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(soloDigitos(e.target.value))}
            disabled={!activacion}
          />
        </li>
      </ol>
      <Boton type="submit" fullWidth loading={enviando} disabled={!activacion || codigo.length !== 6}>
        Activar y continuar
      </Boton>
    </form>
  );
};

const FormCodigo: React.FC<{
  token: string;
  alEntrar: (sesion: SesionLista) => void;
  alReactivar: () => void;
  alVencer: () => void;
}> = ({ token, alEntrar, alReactivar, alVencer }) => {
  const [modo, setModo] = useState<'app' | 'recuperacion'>('app');
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const respuesta = await verificarSegundoFactor(
        token,
        modo === 'app' ? { codigo } : { codigoRecuperacion: codigo.trim() },
      );
      if (respuesta.siguiente === 'ACTIVAR_2FA') alReactivar();
      else alEntrar(sesionDe(respuesta));
    } catch (err) {
      if (esVencimiento(err)) {
        alVencer();
      } else {
        setError(mensajeDe(err));
        setCodigo('');
      }
    } finally {
      setEnviando(false);
    }
  };

  const cambiarModo = () => {
    setModo((actual) => (actual === 'app' ? 'recuperacion' : 'app'));
    setCodigo('');
    setError(null);
  };

  return (
    <form onSubmit={enviar} noValidate>
      <h1 className="ingreso-titulo">Verificación en dos pasos</h1>
      <p className="ingreso-sub">
        {modo === 'app'
          ? 'Escribe el código de 6 dígitos que muestra tu app autenticadora.'
          : 'Escribe uno de tus códigos de recuperación (formato XXXXX-XXXXX). Cada código sirve una sola vez; después tendrás que registrar de nuevo tu app autenticadora.'}
      </p>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="form-group">
        <label className="form-label" htmlFor="codigo-2fa">
          {modo === 'app' ? 'Código de la app' : 'Código de recuperación'}
        </label>
        {modo === 'app' ? (
          <input
            key="app"
            id="codigo-2fa"
            className="form-input ingreso-codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(soloDigitos(e.target.value))}
            autoFocus
          />
        ) : (
          <input
            key="recuperacion"
            id="codigo-2fa"
            className="form-input ingreso-codigo"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={13}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            autoFocus
          />
        )}
      </div>
      <Boton
        type="submit"
        fullWidth
        loading={enviando}
        disabled={modo === 'app' ? codigo.length !== 6 : codigo.trim().length < 10}
      >
        Verificar
      </Boton>
      <button type="button" className="ingreso-enlace" onClick={cambiarModo}>
        {modo === 'app' ? '¿No tienes el teléfono? Usa un código de recuperación' : 'Usar el código de la app'}
      </button>
    </form>
  );
};

const CodigosRecuperacion: React.FC<{ sesion: SesionLista; alContinuar: () => void }> = ({ sesion, alContinuar }) => {
  const [guardados, setGuardados] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const texto = [
    'WAMMA · Códigos de recuperación del backoffice',
    `Usuario: ${sesion.perfil.usuario}`,
    'Cada código sirve una sola vez. Guárdalos fuera de este equipo.',
    '',
    ...sesion.codigos,
  ].join('\n');

  const copiar = () => {
    navigator.clipboard
      ?.writeText(texto)
      .then(() => setCopiado(true))
      .catch(() => setCopiado(false));
  };

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `wamma-codigos-recuperacion-${sesion.perfil.usuario}.txt`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <h1 className="ingreso-titulo">Guarda tus códigos de recuperación</h1>
      <p className="ingreso-sub">
        Si pierdes o cambias el teléfono, cada código te deja entrar <strong>una sola vez</strong>. Guárdalos fuera de
        este equipo: impresos o en un gestor de contraseñas. <strong>No volverás a verlos.</strong>
      </p>
      <ul className="ingreso-codigos" aria-label="Códigos de recuperación">
        {sesion.codigos.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="ingreso-acciones">
        <button type="button" className="ingreso-secundario" onClick={copiar}>
          {copiado ? '✓ Copiados' : 'Copiar'}
        </button>
        <button type="button" className="ingreso-secundario" onClick={descargar}>
          Descargar (.txt)
        </button>
      </div>
      <label className="ingreso-check">
        <input type="checkbox" checked={guardados} onChange={(e) => setGuardados(e.target.checked)} />
        Guardé los códigos en un lugar seguro.
      </label>
      <Boton type="button" fullWidth disabled={!guardados} onClick={alContinuar}>
        Entrar al backoffice
      </Boton>
    </div>
  );
};

const ESTILOS_INGRESO = `
  .ingreso-pagina {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px 16px; box-sizing: border-box; background-color: var(--superficie);
  }
  .ingreso-tarjeta {
    width: 100%; max-width: 460px; background-color: var(--blanco); border: 1px solid var(--borde-claro);
    border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); overflow: hidden;
  }
  .ingreso-cabecera {
    background-color: #141416; padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;
  }
  .ingreso-badge {
    background-color: var(--naranja-500); color: var(--blanco); font-size: 10px; font-weight: 700;
    padding: 3px 8px; border-radius: var(--radius-pill); letter-spacing: 0.05em;
  }
  .ingreso-cuerpo { padding: 24px; }
  .ingreso-titulo { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
  .ingreso-sub { font-size: 13px; color: var(--texto-secundario); margin: 0 0 18px; line-height: 1.5; }
  .ingreso-nota { font-size: 12px; color: var(--texto-mudo); margin-top: 6px; }
  .ingreso-mensaje { border-radius: var(--radius-sm); padding: 10px 12px; font-size: 13px; line-height: 1.45; margin-bottom: 16px; }
  .ingreso-mensaje.error { background-color: var(--peligro-fondo); color: var(--peligro-texto); }
  .ingreso-mensaje.info { background-color: var(--info-fondo); color: var(--info-texto); }
  .ingreso-pasos { padding-left: 20px; margin: 0 0 18px; font-size: 13px; line-height: 1.5; color: var(--texto-secundario); }
  .ingreso-pasos li { margin-bottom: 12px; }
  .ingreso-pasos label { display: block; margin-bottom: 6px; }
  .ingreso-qr { display: flex; justify-content: center; align-items: center; min-height: 200px; margin: 10px 0; }
  .ingreso-clave {
    display: block; margin-top: 6px; padding: 8px 10px; text-align: center; font-size: 14px; letter-spacing: 0.08em;
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; color: var(--texto-primario);
    background-color: var(--superficie); border: 1px dashed var(--borde); border-radius: var(--radius-sm);
    user-select: all; word-break: break-all;
  }
  .ingreso-codigo { font-size: 20px; letter-spacing: 0.25em; text-align: center; font-family: ui-monospace, Consolas, monospace; }
  .ingreso-codigos {
    list-style: none; padding: 12px; margin: 0 0 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
    font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 15px; text-align: center;
    background-color: var(--superficie); border: 1px dashed var(--borde); border-radius: var(--radius-sm);
  }
  .ingreso-acciones { display: flex; gap: 8px; margin-bottom: 16px; }
  .ingreso-secundario {
    flex: 1; background-color: var(--blanco); border: 1px solid var(--borde); border-radius: var(--radius-sm);
    padding: 8px 10px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
  }
  .ingreso-secundario:hover { border-color: var(--naranja-500); color: var(--naranja-700); }
  .ingreso-check { display: flex; gap: 8px; align-items: center; font-size: 13px; margin-bottom: 16px; cursor: pointer; }
  .ingreso-check input { accent-color: var(--naranja-500); width: 16px; height: 16px; }
  .ingreso-enlace {
    display: block; margin: 14px auto 0; background: none; border: none; padding: 0; cursor: pointer;
    color: var(--naranja-700); font-size: 13px; font-family: inherit; text-decoration: underline;
  }
  .ingreso-boton-enlace {
    display: inline-block; background-color: var(--naranja-500); color: var(--blanco); padding: 10px 18px;
    border-radius: var(--radius-md); text-decoration: none; font-weight: 700; font-size: 14px;
  }
  .ingreso-pie { border-top: 1px solid var(--borde-claro); padding: 12px 24px; font-size: 12px; }
  .ingreso-pie a { color: var(--texto-secundario); text-decoration: none; }
  .ingreso-pie a:hover { color: var(--naranja-700); }
`;
