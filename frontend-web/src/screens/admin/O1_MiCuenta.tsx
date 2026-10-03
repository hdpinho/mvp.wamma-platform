import React, { useState } from 'react';
import { cambiarContrasena } from '../../api/auth';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/admin/CampoTexto';
import { ESTILOS_ADMIN } from '../../components/admin/estilos';
import { mensajeDe } from '../../components/admin/formato';
import { useSesion } from '../../state/sesionContexto';
import { nombrePermiso, nombreRol } from '../../types/seguridad';

/** O1 · Mi cuenta (módulo 001): datos propios, lo que el rol permite y cambio de contraseña. */
export const O1_MiCuenta: React.FC = () => {
  const { perfil } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  if (!perfil) {
    return (
      <div className="adm-vacio">
        En modo maqueta no hay cuentas de usuario: el backoffice se usa sin iniciar sesión.
        <style>{ESTILOS_ADMIN}</style>
      </div>
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setExito(false);
    if (nueva.length < 12) {
      setError('La nueva contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await cambiarContrasena(actual, nueva);
      setActual('');
      setNueva('');
      setRepetida('');
      setExito(true);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <div className="adm-cabecera">
        <div>
          <h1 className="adm-titulo">Mi cuenta</h1>
          <p className="adm-sub">Tus datos y lo que tu rol te permite hacer. Para corregir tus datos, pide ayuda a un administrador.</p>
        </div>
      </div>

      <section className="adm-panel" aria-label="Mis datos">
        <dl className="adm-ficha">
          <dt>Nombre</dt>
          <dd>
            {perfil.nombre} {perfil.apellido}
          </dd>
          <dt>Usuario</dt>
          <dd>{perfil.usuario}</dd>
          <dt>Correo</dt>
          <dd>{perfil.correo}</dd>
          <dt>Roles</dt>
          <dd>
            {perfil.roles.map((r) => (
              <span key={r} className="adm-badge neutro">
                {nombreRol(r)}
              </span>
            ))}
          </dd>
          <dt>Puedes</dt>
          <dd>
            {[...perfil.permisos]
              .sort()
              .map((p) => nombrePermiso(p))
              .join(' · ')}
          </dd>
        </dl>
      </section>

      <form className="adm-panel" onSubmit={enviar} noValidate aria-label="Cambiar contraseña">
        <h2>Cambiar contraseña</h2>
        <p className="adm-sub">
          Al menos 12 caracteres; una frase fácil de recordar funciona bien. No puede contener tu usuario ni ser una
          contraseña común. Al cambiarla se cierran tus otras sesiones abiertas.
        </p>
        {exito && (
          <div className="adm-aviso exito" role="status">
            Contraseña actualizada. Se cerraron tus otras sesiones abiertas.
          </div>
        )}
        {error && (
          <div className="adm-aviso error" role="alert">
            {error}
          </div>
        )}
        <div className="adm-rejilla">
          <CampoTexto
            id="cuenta-actual"
            etiqueta="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
          />
          <CampoTexto
            id="cuenta-nueva"
            etiqueta="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
          />
          <CampoTexto
            id="cuenta-repetida"
            etiqueta="Repite la nueva contraseña"
            type="password"
            autoComplete="new-password"
            value={repetida}
            onChange={(e) => setRepetida(e.target.value)}
          />
        </div>
        <Boton type="submit" loading={enviando} disabled={!actual || !nueva || !repetida}>
          Cambiar contraseña
        </Boton>
      </form>

      <section className="adm-panel" aria-label="Si pierdes el teléfono">
        <h2>Si pierdes el teléfono</h2>
        <p className="adm-sub" style={{ marginBottom: 0 }}>
          En el ingreso, elige «Usa un código de recuperación» y escribe uno de los 10 códigos que guardaste al activar
          el 2FA; después registrarás de nuevo tu app autenticadora. Si ya no tienes códigos, pide a un administrador que
          restablezca tu 2FA.
        </p>
      </section>

      <style>{ESTILOS_ADMIN}</style>
    </div>
  );
};
