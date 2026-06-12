import { forwardRef } from 'react';
import type { SelectHTMLAttributes, CSSProperties } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  options?: Array<{ value: string | number; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className = '', containerClassName = '', containerStyle, id, options, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substring(2, 11)}`;
    return (
      <div className={`ui-input-group ${containerClassName}`} style={containerStyle}>
        {label && (
          <label htmlFor={selectId} className="ui-label">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`ui-select ${error ? 'error' : ''} ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <span className="ui-error-text" data-testid="select-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
