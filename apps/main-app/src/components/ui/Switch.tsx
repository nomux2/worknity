import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  containerClassName?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className = '', containerClassName = '', children, ...props }, ref) => {
    return (
      <label className={`ui-switch-wrapper ${containerClassName}`}>
        <input
          type="checkbox"
          ref={ref}
          className={`ui-switch-input ${className}`}
          {...props}
        />
        <span className="ui-switch-track">
          <span className="ui-switch-thumb"></span>
        </span>
        {label || children}
      </label>
    );
  }
);

Switch.displayName = 'Switch';
