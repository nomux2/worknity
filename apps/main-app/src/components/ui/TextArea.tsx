import { forwardRef } from 'react';
import type { TextareaHTMLAttributes, CSSProperties } from 'react';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className = '', containerClassName = '', containerStyle, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substring(2, 11)}`;
    return (
      <div className={`ui-input-group ${containerClassName}`} style={containerStyle}>
        {label && (
          <label htmlFor={textareaId} className="ui-label">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={`ui-textarea ${error ? 'error' : ''} ${className}`}
          {...props}
        />
        {error && <span className="ui-error-text" data-testid="textarea-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
