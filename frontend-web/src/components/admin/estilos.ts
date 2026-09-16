/**
 * Estilos compartidos por las pantallas del módulo 001 (Usuarios, Bitácora, Mi cuenta).
 * Cada pantalla los inyecta una vez, como hacen las del CRM con `ESTILOS_CRM`.
 */
export const ESTILOS_ADMIN = `
  .adm-cabecera {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
    flex-wrap: wrap; margin-bottom: var(--space-lg);
  }
  .adm-titulo { font-size: 24px; margin: 0; font-weight: 700; }
  .adm-sub { font-size: 13px; color: var(--texto-secundario); margin: 4px 0 0; max-width: 720px; line-height: 1.45; }
  .adm-mudo { color: var(--texto-mudo); }
  .adm-panel {
    background-color: var(--blanco); border: 1px solid var(--borde-claro); border-radius: var(--radius-lg);
    padding: var(--space-xl); margin-bottom: var(--space-lg);
  }
  .adm-panel h2 { font-size: 16px; margin: 0 0 4px; }
  .adm-panel .adm-sub { margin-bottom: 16px; }
  .adm-tabla-envoltura {
    overflow-x: auto; background-color: var(--blanco); border: 1px solid var(--borde-claro);
    border-radius: var(--radius-lg); margin-bottom: var(--space-lg);
  }
  .adm-tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
  .adm-tabla th {
    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap;
    color: var(--texto-mudo); padding: 10px 14px; border-bottom: 1px solid var(--borde-claro);
    background-color: var(--superficie);
  }
  .adm-tabla td { padding: 12px 14px; border-bottom: 1px solid var(--borde-claro); vertical-align: top; }
  .adm-tabla tbody tr.seleccionable { cursor: pointer; }
  .adm-tabla tbody tr.seleccionable:hover, .adm-tabla tbody tr.activa { background-color: #FFF6EE; }
  .adm-fuerte { font-weight: 700; color: var(--texto-primario); }
  .adm-badge {
    display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 8px; margin: 0 4px 4px 0;
    border-radius: var(--radius-pill); white-space: nowrap;
  }
  .adm-badge.neutro { background-color: var(--superficie); color: var(--texto-secundario); border: 1px solid var(--borde-claro); }
  .adm-badge.ok { background-color: var(--exito-fondo); color: var(--exito-texto); }
  .adm-badge.alerta { background-color: var(--aviso-fondo); color: var(--aviso-texto); }
  .adm-badge.peligro { background-color: var(--peligro-fondo); color: var(--peligro-texto); }
  .adm-aviso { border-radius: var(--radius-sm); padding: 10px 14px; font-size: 13px; margin-bottom: var(--space-lg); line-height: 1.5; }
  .adm-aviso.exito { background-color: var(--exito-fondo); color: var(--exito-texto); }
  .adm-aviso.error { background-color: var(--peligro-fondo); color: var(--peligro-texto); }
  .adm-aviso.info { background-color: var(--info-fondo); color: var(--info-texto); }
  .adm-aviso-cerrar { float: right; background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; }
  .adm-rejilla { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0 16px; }
  .adm-acciones { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .adm-boton-sec {
    background-color: var(--blanco); border: 1px solid var(--borde); border-radius: var(--radius-sm);
    padding: 7px 12px; font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer; color: var(--texto-primario);
  }
  .adm-boton-sec:hover:not(:disabled) { border-color: var(--naranja-500); color: var(--naranja-700); }
  .adm-boton-sec.peligro { color: var(--peligro-texto); }
  .adm-boton-sec:disabled { opacity: 0.6; cursor: not-allowed; }
  .adm-secreto {
    display: inline-block; font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; font-size: 18px;
    letter-spacing: 0.06em; background-color: var(--blanco); border: 1px dashed var(--borde);
    border-radius: var(--radius-sm); padding: 8px 14px; margin: 6px 8px 6px 0; user-select: all;
  }
  .adm-vacio {
    background-color: var(--blanco); border: 1px dashed var(--borde); border-radius: var(--radius-lg);
    padding: var(--space-xxxl); text-align: center; color: var(--texto-secundario); font-size: 13px;
  }
  .adm-roles { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .adm-rol {
    display: flex; gap: 10px; align-items: flex-start; border: 1px solid var(--borde-claro);
    border-radius: var(--radius-md); padding: 10px 12px; cursor: pointer; background-color: var(--blanco);
  }
  .adm-rol.marcado { border-color: var(--naranja-500); background-color: var(--naranja-50); }
  .adm-rol input { margin-top: 3px; accent-color: var(--naranja-500); }
  .adm-rol strong { font-size: 13px; }
  .adm-rol small { display: block; color: var(--texto-secundario); font-size: 12px; line-height: 1.4; margin-top: 2px; }
  .adm-rol .adm-permisos { color: var(--texto-mudo); }
  .adm-etiqueta-grupo { font-size: 13px; font-weight: 500; color: var(--texto-secundario); margin: 0 0 8px; }
  .adm-confirmar {
    background-color: var(--superficie); border: 1px solid var(--borde-claro); border-radius: var(--radius-md);
    padding: 10px 12px; font-size: 13px; line-height: 1.45; display: flex; flex-direction: column; gap: 8px;
  }
  .adm-separador { border: none; border-top: 1px solid var(--borde-claro); margin: 20px 0; }
  .adm-filtros { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0 12px; align-items: end; }
  .adm-detalle { font-size: 12px; color: var(--texto-secundario); line-height: 1.5; word-break: break-word; max-width: 420px; }
  .adm-codigo { font-family: ui-monospace, Consolas, monospace; font-size: 11px; color: var(--texto-mudo); }
  .adm-error-campo { font-size: 11px; color: var(--peligro-texto); margin-top: 4px; }
  .adm-ayuda { font-size: 11px; color: var(--texto-mudo); margin-top: 4px; line-height: 1.4; }
  .adm-fieldset { border: none; padding: 0; margin: 0 0 8px; min-width: 0; }
  .adm-enlace-fila {
    background: none; border: none; padding: 0; font: inherit; font-weight: 700; font-size: 14px;
    color: var(--texto-primario); cursor: pointer; text-align: left;
  }
  .adm-enlace-fila:hover { color: var(--naranja-600); text-decoration: underline; }
  .adm-ficha { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 13px; margin: 0; }
  .adm-ficha dt { color: var(--texto-mudo); }
  .adm-ficha dd { margin: 0; }
`;
