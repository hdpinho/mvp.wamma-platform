import React from 'react';

interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label: string;
  error?: string;
  type?: string;
  options?: { value: string; label: string }[];
}

export const Campo: React.FC<CampoProps> = ({
  label,
  error,
  type = 'text',
  options = [],
  ...props
}) => {
  const isSelect = type === 'select';
  const isTextarea = type === 'textarea';

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      
      {isSelect ? (
        <select
          className={`form-input ${error ? 'error' : ''}`}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
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
        />
      ) : (
        <input
          type={type}
          className={`form-input ${error ? 'error' : ''}`}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && <div className="form-error-text">{error}</div>}
    </div>
  );
};
