import React, { useId } from 'react';

interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label: string;
  error?: string;
  type?: string;
  options?: { value: string; label: string }[];
}

/**
 * Campo de formulario. La etiqueta queda **enlazada** a su control (`htmlFor` ↔ `id`) y el error, a su campo
 * (`aria-describedby`): un lector de pantalla dice qué se pide y qué falló, un clic en la etiqueta lleva el cursor al
 * campo y las pruebas lo encuentran por su nombre (R4.5). Visualmente no cambia nada.
 */
export const Campo: React.FC<CampoProps> = ({
  label,
  error,
  type = 'text',
  options = [],
  id: idDado,
  ...props
}) => {
  const isSelect = type === 'select';
  const isTextarea = type === 'textarea';
  const idAuto = useId();
  const id = idDado ?? idAuto;
  const idError = `${id}-error`;
  const accesibilidad = {
    id,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? idError : undefined,
  };

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>

      {isSelect ? (
        <select
          className={`form-input ${error ? 'error' : ''}`}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
          {...accesibilidad}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : isTextarea ? (
        <textarea
          className={`form-input ${error ? 'error' : ''}`}
          style={{ minHeight: '80px', resize: 'vertical' }}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          {...accesibilidad}
        />
      ) : (
        <input
          type={type}
          className={`form-input ${error ? 'error' : ''}`}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          {...accesibilidad}
        />
      )}

      {error && (
        <div id={idError} className="form-error-text" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
