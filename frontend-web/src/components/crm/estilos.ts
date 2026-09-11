/**
 * Estilos compartidos por las pantallas del CRM (embudo, personas, ficha) y por
 * `MoverEtapa`. Cada pantalla los inyecta una sola vez, no una vez por tarjeta.
 *
 * Los colores de etapa progresan dentro de la paleta de marca (del neutro al
 * naranja pleno) en vez de usar un arcoíris: la etapa se lee por el texto, el
 * color solo refuerza el avance.
 */
export const ESTILOS_CRM = `
  .crm-titulo { font-size: 24px; margin: 0; font-weight: 700; }
  .crm-sub { font-size: 13px; color: var(--texto-secundario); margin: 4px 0 0; max-width: 720px; line-height: 1.45; }
  .crm-mudo { color: var(--texto-mudo); }
  .crm-count {
    font-size: 12px; font-weight: 700; color: var(--texto-secundario); background-color: var(--blanco);
    border: 1px solid var(--borde-claro); border-radius: var(--radius-pill); padding: 1px 8px;
  }
  .crm-tab {
    background-color: var(--blanco); border: 1px solid var(--borde); padding: 6px 14px;
    border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; color: var(--texto-secundario); cursor: pointer;
  }
  .crm-tab.activo { background-color: var(--naranja-500); color: var(--blanco); border-color: var(--naranja-500); }
  .crm-aviso {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    background-color: var(--exito-fondo); color: var(--exito-texto); border-radius: var(--radius-sm);
    padding: 10px 14px; font-size: 13px; margin-bottom: var(--space-lg);
  }
  .crm-aviso button { background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; }
  .crm-vacio {
    background-color: var(--blanco); border: 1px dashed var(--borde); border-radius: var(--radius-lg);
    padding: var(--space-xxxl); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .crm-vacio h3 { margin: 0; font-size: 16px; }
  .crm-vacio p { margin: 0 0 8px; max-width: 540px; font-size: 13px; color: var(--texto-secundario); line-height: 1.5; }
  .crm-nombre { font-weight: 700; font-size: 14px; color: var(--texto-primario); text-decoration: none; }
  .crm-nombre:hover { color: var(--naranja-600); text-decoration: underline; }
  .crm-enlace-boton {
    display: inline-block; background-color: var(--naranja-500); color: var(--blanco); padding: 9px 16px;
    border-radius: var(--radius-sm); text-decoration: none; font-weight: 700; font-size: 13px;
  }
  .crm-vencida { color: var(--peligro-texto); font-weight: 700; }
  .req { color: var(--naranja-600); }

  .crm-badge {
    display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px;
    border-radius: var(--radius-pill); white-space: nowrap;
  }
  .crm-badge.neutro { background-color: var(--superficie); color: var(--texto-secundario); border: 1px solid var(--borde-claro); }
  .crm-badge.estancada { background-color: var(--peligro-fondo); color: var(--peligro-texto); }
  .crm-badge.etapa-nuevo { background-color: var(--superficie); color: var(--texto-secundario); border: 1px solid var(--borde); }
  .crm-badge.etapa-contactado { background-color: var(--naranja-50); color: var(--naranja-700); }
  .crm-badge.etapa-cita_confirmada { background-color: var(--naranja-50); color: var(--naranja-700); border: 1px solid var(--naranja-200); }
  .crm-badge.etapa-visito { background-color: #FDDDC6; color: var(--naranja-700); }
  .crm-badge.etapa-negociacion { background-color: var(--naranja-500); color: var(--blanco); }
  .crm-badge.etapa-cerrado_ganado { background-color: var(--exito-fondo); color: var(--exito-texto); }
  .crm-badge.etapa-cerrado_perdido { background-color: var(--superficie); color: var(--texto-mudo); border: 1px solid var(--borde-claro); }

  .mover-etapa select, .mover-etapa input {
    width: 100%; padding: 6px 8px; border: 1px solid var(--borde); border-radius: var(--radius-sm);
    font-size: 12px; font-family: inherit; background-color: var(--blanco); box-sizing: border-box;
  }
  .mover-panel {
    display: flex; flex-direction: column; gap: 6px; background-color: var(--superficie);
    border: 1px solid var(--borde-claro); border-radius: var(--radius-sm); padding: 8px;
  }
  .mover-panel label { font-size: 11px; font-weight: 700; color: var(--texto-secundario); }
  .mover-titulo { font-size: 12px; font-weight: 700; }
  .mover-aviso { font-size: 12px; margin: 0; color: var(--texto-secundario); }
  .mover-acciones { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .mover-cancelar {
    background: none; border: 1px solid var(--borde); border-radius: var(--radius-sm);
    padding: 5px 10px; font-size: 12px; cursor: pointer; font-family: inherit;
  }
  .mover-error { margin-top: 6px; font-size: 12px; color: var(--peligro-texto); }
  .mover-terminal { font-size: 11px; color: var(--texto-mudo); }
`;
