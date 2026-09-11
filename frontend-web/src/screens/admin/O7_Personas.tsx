import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCRM } from '../../state/crmContexto';
import { ESTILOS_CRM } from '../../components/crm/estilos';
import { haceCuanto } from '../../components/crm/formato';
import { definicionEtapa, normalizarCedula, telefonosDe } from '../../types/crm';

/**
 * O7 · Personas — índice de la tarea F5 de `specs/010-crm-comercial/tasks.md`.
 *
 * Una fila por persona, no por cita: es lo que la deduplicación hace posible.
 * Se busca por nombre, cédula o cualquiera de sus teléfonos.
 */
export const O7_Personas: React.FC = () => {
  const { personas, oportunidadesDePersona, interaccionesDePersona, ultimaActividad } = useCRM();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');

  const q = busqueda.trim();
  const qTexto = q.toLowerCase();
  const qCedula = normalizarCedula(q);
  // Los teléfonos se comparan por dígitos, sin prefijo de país ni 0 inicial,
  // para que "0414 111 2233", "4141112233" y "1112233" encuentren lo mismo.
  const qDigitos = q.replace(/\D/g, '').replace(/^58/, '').replace(/^0/, '');

  const filas = personas
    .map((p) => {
      const ops = oportunidadesDePersona(p.id);
      const actividad = [
        p.fechaCreacion,
        ...ops.map((o) => ultimaActividad(o.id)),
        ...interaccionesDePersona(p.id).map((i) => i.ocurridoEn),
      ].reduce((a, b) => (a > b ? a : b));
      return {
        p,
        total: ops.length,
        abiertas: ops.filter((o) => !definicionEtapa(o.etapa).esTerminal).length,
        actividad,
      };
    })
    .filter(({ p }) => {
      if (!q) return true;
      if (p.nombreApellido.toLowerCase().includes(qTexto)) return true;
      if (qCedula.length >= 3 && p.cedula?.includes(qCedula)) return true;
      if (qDigitos.length >= 4 && telefonosDe(p).some((t) => t.replace(/\D/g, '').includes(qDigitos))) return true;
      return false;
    })
    .sort((a, b) => b.actividad.localeCompare(a.actividad));

  return (
    <div>
      <div className="personas-header">
        <div>
          <h1 className="crm-titulo">Personas</h1>
          <p className="crm-sub">
            Clientes y prospectos. Una persona por cédula: si alguien agenda dos veces, aparece una sola vez con todo
            su historial.
          </p>
        </div>
        <input
          type="search"
          className="personas-buscar"
          placeholder="Nombre, cédula o teléfono"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar personas"
        />
      </div>

      {personas.length === 0 ? (
        <div className="crm-vacio">
          <div style={{ fontSize: '32px' }}>👤</div>
          <h3>Aún no hay personas</h3>
          <p>
            Se crean cuando un cliente agenda una cita en el catálogo. Si quieres ver cómo luce con datos, puedes
            cargar prospectos de ejemplo desde el embudo.
          </p>
          <Link to="/admin/embudo" className="crm-enlace-boton">
            Ir al embudo comercial
          </Link>
        </div>
      ) : filas.length === 0 ? (
        <div className="crm-vacio">
          <h3>Sin resultados</h3>
          <p>Ninguna persona coincide con «{q}».</p>
        </div>
      ) : (
        <div className="personas-tabla-envoltura">
          <table className="personas-tabla">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Cédula</th>
                <th>Teléfonos</th>
                <th>Oportunidades</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ p, total, abiertas, actividad }) => (
                <tr key={p.id} onClick={() => navigate(`/admin/personas/${p.id}`)}>
                  <td>
                    <Link to={`/admin/personas/${p.id}`} className="crm-nombre" onClick={(e) => e.stopPropagation()}>
                      {p.nombreApellido}
                    </Link>
                    <div className="personas-badges">
                      {p.fusionadaDesde && p.fusionadaDesde.length > 0 && (
                        <span className="crm-badge neutro">Fusionada ×{p.fusionadaDesde.length}</span>
                      )}
                      {p.canalOrigen === 'ejemplo' && <span className="crm-badge neutro">Dato de ejemplo</span>}
                    </div>
                  </td>
                  <td>{p.cedula ?? <span className="crm-mudo">Pendiente</span>}</td>
                  <td>
                    {p.telefonoWhatsApp}
                    {p.telefonosAdicionales && p.telefonosAdicionales.length > 0 && (
                      <span className="crm-mudo"> +{p.telefonosAdicionales.length}</span>
                    )}
                  </td>
                  <td>
                    <strong>{abiertas}</strong> abiertas · {total} en total
                  </td>
                  <td>{haceCuanto(actividad)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{ESTILOS_CRM}</style>
      <style>{`
        .personas-header {
          display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
          flex-wrap: wrap; margin-bottom: var(--space-lg);
        }
        .personas-buscar {
          min-width: 280px; padding: 8px 14px; border: 1px solid var(--borde);
          border-radius: var(--radius-pill); font-size: 13px; font-family: inherit;
        }
        .personas-tabla-envoltura {
          overflow-x: auto; background-color: var(--blanco); border: 1px solid var(--borde-claro);
          border-radius: var(--radius-lg);
        }
        .personas-tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
        .personas-tabla th {
          text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--texto-mudo); padding: 10px 14px; border-bottom: 1px solid var(--borde-claro);
          background-color: var(--superficie);
        }
        .personas-tabla td { padding: 12px 14px; border-bottom: 1px solid var(--borde-claro); vertical-align: top; }
        .personas-tabla tbody tr { cursor: pointer; }
        .personas-tabla tbody tr:hover { background-color: #FFF6EE; }
        .personas-badges { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
      `}</style>
    </div>
  );
};
