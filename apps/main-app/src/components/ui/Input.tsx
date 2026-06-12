import { forwardRef } from 'react';
import type { InputHTMLAttributes, CSSProperties } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', containerClassName = '', containerStyle, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 11)}`;
    return (
      <div className={`ui-input-group ${containerClassName}`} style={containerStyle}>
        {label && (
          <label htmlFor={inputId} className="ui-label">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`ui-input ${error ? 'error' : ''} ${className}`}
          {...props}
        />
        {error && <span className="ui-error-text" data-testid="input-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
