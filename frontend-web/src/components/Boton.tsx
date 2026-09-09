import React from 'react';

interface BotonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Boton: React.FC<BotonProps> = ({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  children,
  style,
  ...props
}) => {
  const getStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      fontSize: '14px',
      padding: '12px 24px',
      borderRadius: 'var(--radius-md)',
      border: '1px solid transparent',
      cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
      width: fullWidth ? '100%' : 'auto',
      opacity: props.disabled || loading ? 0.6 : 1,
      transition: 'all 0.2s ease',
      textDecoration: 'none',
      outline: 'none',
      ...style,
    };

    if (variant === 'primary') {
      return {
        ...baseStyle,
        backgroundColor: 'var(--naranja-500)',
        color: 'var(--blanco)',
        borderColor: 'var(--naranja-500)',
      };
    } else if (variant === 'secondary') {
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        color: 'var(--naranja-500)',
        borderColor: 'var(--naranja-500)',
      };
    } else {
      return {
        ...baseStyle,
        backgroundColor: 'transparent',
        color: 'var(--naranja-700)',
        padding: '8px 12px',
      };
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (props.disabled || loading) return;
    const target = e.currentTarget;
    if (variant === 'primary') {
      target.style.backgroundColor = 'var(--naranja-600)';
      target.style.borderColor = 'var(--naranja-600)';
    } else if (variant === 'secondary') {
      target.style.backgroundColor = 'var(--naranja-50)';
    } else {
      target.style.textDecoration = 'underline';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (props.disabled || loading) return;
    const target = e.currentTarget;
    if (variant === 'primary') {
      target.style.backgroundColor = 'var(--naranja-500)';
      target.style.borderColor = 'var(--naranja-500)';
    } else if (variant === 'secondary') {
      target.style.backgroundColor = 'transparent';
    } else {
      target.style.textDecoration = 'none';
    }
  };

  return (
    <button
      style={getStyle()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <svg
            style={{ animation: 'spin 1s linear infinite', width: '16px', height: '16px' }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Procesando...
        </span>
      ) : (
        children
      )}
    </button>
  );
};
