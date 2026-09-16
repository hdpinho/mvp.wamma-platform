import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../../state/sesionContexto';
import type { Permiso } from '../../types/seguridad';
import { MENU_ADMIN } from './menu';

const estiloAviso: React.CSSProperties = {
  backgroundColor: 'var(--blanco)',
  border: '1px dashed var(--borde)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-xxxl)',
  textAlign: 'center',
  color: 'var(--texto-secundario)',
  fontSize: '14px',
  lineHeight: 1.5,
};

/** Todo `/admin/*` exige sesión (plan 001 §11). En modo maqueta no hay ingreso. */
export const RequiereSesion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { estado, motivoSalida } = useSesion();
  const location = useLocation();

  if (estado === 'verificando') {
    return (
      <div style={{ ...estiloAviso, margin: '48px auto', maxWidth: '480px' }} role="status">
        Verificando tu sesión… Si el servidor estaba dormido, puede tardar cerca de un minuto.
      </div>
    );
  }
  if (estado === 'anonima') {
    // Tras un vencimiento se vuelve a la misma página al ingresar; tras un cierre voluntario,
    // no: quien ingrese después en esa pestaña empieza desde el inicio.
    const state = motivoSalida === 'voluntaria' ? undefined : { desde: `${location.pathname}${location.search}` };
    return <Navigate to="/admin/ingresar" replace state={state} />;
  }
  return <>{children}</>;
};

/** El menú ya oculta lo que el rol no permite; esto cubre a quien escribe la dirección a mano. */
export const RequierePermiso: React.FC<{ permisos: Permiso[]; children: React.ReactNode }> = ({
  permisos,
  children,
}) => {
  const { puede } = useSesion();
  if (puede(...permisos)) return <>{children}</>;
  return (
    <div style={estiloAviso} role="alert">
      <div style={{ fontSize: '28px' }}>🔒</div>
      <h3 style={{ margin: '8px 0', color: 'var(--texto-primario)' }}>Sin acceso a esta sección</h3>
      Tu rol no incluye esta sección. Si la necesitas, pide a un administrador que te asigne el rol correspondiente.
    </div>
  );
};

/** `/admin` lleva a la primera sección que el usuario puede ver. */
export const InicioAdmin: React.FC = () => {
  const { puede } = useSesion();
  const primera = MENU_ADMIN.find((entrada) => puede(...entrada.permisos));
  if (primera) return <Navigate to={primera.ruta} replace />;
  return (
    <div style={estiloAviso} role="status">
      <h3 style={{ margin: '0 0 8px', color: 'var(--texto-primario)' }}>Todavía no tienes secciones asignadas</h3>
      Pide a un administrador que te asigne un rol.
    </div>
  );
};
