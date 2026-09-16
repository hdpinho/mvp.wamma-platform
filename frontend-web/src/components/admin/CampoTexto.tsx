import React from 'react';

interface CampoTextoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

/** Campo con su etiqueta asociada, una ayuda opcional y el error del servidor para ese campo. */
export const CampoTexto: React.FC<CampoTextoProps> = ({ id, etiqueta, ayuda, error, ...resto }) => (
  <div className="form-group">
    <label className="form-label" htmlFor={id}>
      {etiqueta}
    </label>
    <input id={id} className={`form-input ${error ? 'error' : ''}`} aria-invalid={error ? true : undefined} {...resto} />
    {error ? <div className="adm-error-campo">{error}</div> : ayuda && <div className="adm-ayuda">{ayuda}</div>}
  </div>
);
