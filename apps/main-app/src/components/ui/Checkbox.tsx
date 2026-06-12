import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  containerClassName?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', containerClassName = '', children, ...props }, ref) => {
    return (
      <label className={`ui-checkbox-wrapper ${containerClassName}`}>
        <input
          type="checkbox"
          ref={ref}
          className={`ui-checkbox-input ${className}`}
          {...props}
        />
        <span className="ui-checkbox-box"></span>
        {label || children}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
