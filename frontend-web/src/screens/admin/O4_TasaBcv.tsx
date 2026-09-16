import React, { useEffect, useState } from 'react';
import { historialTasas, registrarTasa, type TasaRegistrada } from '../../api/tasaBcv';
import { Boton } from '../../components/Boton';
import { CampoTexto } from '../../components/admin/CampoTexto';
import { ESTILOS_ADMIN } from '../../components/admin/estilos';
import { fechaHora, mensajeDe } from '../../components/admin/formato';

/**
 * O4 · Tasa BCV del euro (D-13, D-21). La registran el administrador y el analista de
 * crédito; la vitrina usa siempre la más reciente para mostrar la equivalencia en bolívares.
 */

/** La fecha de hoy en Venezuela, que es la que cuenta para la tasa del día. */
const hoyEnVenezuela = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());

const formatoTasa = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 8 });

const formatoFecha = (fecha: string) => {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
};

export const O4_TasaBcv: React.FC = () => {
  const [historial, setHistorial] = useState<TasaRegistrada[] | null>(null);
  const [fecha, setFecha] = useState(hoyEnVenezuela());
  const [tasa, setTasa] = useState('');
  const [fuente, setFuente] = useState('BCV');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;
    historialTasas()
      .then((lista) => {
        if (vigente) {
          setHistorial(lista);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (vigente) setError(mensajeDe(e));
      });
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(tasa.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      setError('Escribe la tasa en bolívares por euro, mayor que cero.');
      return;
    }
    setError(null);
    setAviso(null);
    setEnviando(true);
    try {
      const respuesta = await registrarTasa(fecha, valor, fuente.trim());
      setAviso(
        respuesta.corregida
          ? `Tasa del ${formatoFecha(fecha)} corregida: ${formatoTasa.format(respuesta.tasa.tasa)} Bs. por euro.`
          : `Tasa del ${formatoFecha(fecha)} registrada: ${formatoTasa.format(respuesta.tasa.tasa)} Bs. por euro.`,
      );
      setTasa('');
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  };

  const vigente = historial?.[0] ?? null;

  return (
    <div>
      <div className="adm-cabecera">
        <div>
          <h1 className="adm-titulo">Tasa BCV del euro</h1>
          <p className="adm-sub">
            Los precios de la plataforma están en euros y la vitrina muestra su equivalencia en bolívares con la tasa
            oficial del BCV. Regístrala cada día: mientras no haya una nueva, se sigue usando la última.
          </p>
        </div>
      </div>

      {vigente && (
        <div className="adm-panel" aria-label="Tasa vigente">
          <h2>Vigente</h2>
          <div className="adm-secreto" style={{ fontSize: '22px' }}>
            {formatoTasa.format(vigente.tasa)} Bs. por euro
          </div>
          <div className="adm-ayuda">
            Del {formatoFecha(vigente.fecha)} · fuente {vigente.fuente}
            {vigente.corregidaEn && ' · corregida'}
          </div>
        </div>
      )}

      <form className="adm-panel" onSubmit={enviar} noValidate aria-label="Registrar tasa">
        <h2>Registrar la tasa del día</h2>
        <p className="adm-sub">
          Si ya hay una tasa para esa fecha, se corrige y el cambio queda en la bitácora. Los precios ya publicados
          conservan la tasa con la que se fijaron.
        </p>
        {aviso && (
          <div className="adm-aviso exito" role="status">
            {aviso}
          </div>
        )}
        {error && (
          <div className="adm-aviso error" role="alert">
            {error}
          </div>
        )}
        <div className="adm-rejilla">
          <CampoTexto
            id="tasa-fecha"
            etiqueta="Fecha"
            type="date"
            max={hoyEnVenezuela()}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <CampoTexto
            id="tasa-valor"
            etiqueta="Bolívares por euro"
            inputMode="decimal"
            placeholder="45,12"
            ayuda="Hasta 8 decimales."
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
          />
          <CampoTexto
            id="tasa-fuente"
            etiqueta="Fuente"
            ayuda="De dónde se tomó: BCV, banco, etc."
            value={fuente}
            onChange={(e) => setFuente(e.target.value)}
          />
        </div>
        <Boton type="submit" loading={enviando} disabled={!tasa || !fecha || !fuente.trim()}>
          Registrar tasa
        </Boton>
      </form>

      {historial === null ? (
        <div className="adm-vacio" role="status">
          Cargando el historial…
        </div>
      ) : historial.length === 0 ? (
        <div className="adm-vacio">Todavía no hay ninguna tasa registrada.</div>
      ) : (
        <div className="adm-tabla-envoltura">
          <table className="adm-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Bs. por euro</th>
                <th>Fuente</th>
                <th>Registrada</th>
                <th>Corregida</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((t) => (
                <tr key={t.fecha}>
                  <td className="adm-fuerte">{formatoFecha(t.fecha)}</td>
                  <td>{formatoTasa.format(t.tasa)}</td>
                  <td>{t.fuente}</td>
                  <td>
                    {fechaHora(t.registradaEn)}
                    {t.registradaPor && <div className="adm-mudo">{t.registradaPor}</div>}
                  </td>
                  <td>
                    {t.corregidaEn ? (
                      <>
                        {fechaHora(t.corregidaEn)}
                        {t.corregidaPor && <div className="adm-mudo">{t.corregidaPor}</div>}
                      </>
                    ) : (
                      <span className="adm-mudo">—</span>
                    )}
                  </td>
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
