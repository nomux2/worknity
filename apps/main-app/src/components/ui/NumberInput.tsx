import { forwardRef, useRef, useEffect, useState } from 'react';
import type { InputHTMLAttributes, ChangeEvent, CSSProperties } from 'react';

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  min?: number;
  max?: number;
  step?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, error, helperText, className = '', containerClassName = '', containerStyle, id, min, max, step = 1, value, defaultValue, onChange, disabled, readOnly, ...props }, ref) => {
    const inputId = id || `number-input-${Math.random().toString(36).substring(2, 11)}`;
    
    // Internal state to handle button clicks when the value is not fully controlled
    // or to keep track of local changes for validation.
    const [localValue, setLocalValue] = useState<number>(() => {
      if (value !== undefined) return Number(value) || 0;
      if (defaultValue !== undefined) return Number(defaultValue) || 0;
      return 0;
    });

    useEffect(() => {
      if (value !== undefined) {
        setLocalValue(Number(value) || 0);
      }
    }, [value]);

    const inputRef = useRef<HTMLInputElement | null>(null);

    // Combine forwardRef and local ref
    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    const triggerChange = (newValue: number) => {
      if (disabled || readOnly) return;
      
      // Enforce min/max boundaries
      let finalValue = newValue;
      if (min !== undefined && finalValue < min) finalValue = min;
      if (max !== undefined && finalValue > max) finalValue = max;

      setLocalValue(finalValue);

      // Trigger onChange event
      if (inputRef.current) {
        // Set the value directly to the element first
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(inputRef.current, String(finalValue));
        } else {
          inputRef.current.value = String(finalValue);
        }
        
        // Dispatch events
        const inputEvent = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(inputEvent);
        const changeEvent = new Event('change', { bubbles: true });
        inputRef.current.dispatchEvent(changeEvent);
      }
    };

    const handleIncrement = () => {
      triggerChange(localValue + step);
    };

    const handleDecrement = () => {
      triggerChange(localValue - step);
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setLocalValue(isNaN(val) ? 0 : val);
      if (onChange) {
        onChange(e);
      }
    };

    // Calculate disabled status for buttons
    const isDecrementDisabled = disabled || readOnly || (min !== undefined && localValue <= min);
    const isIncrementDisabled = disabled || readOnly || (max !== undefined && localValue >= max);

    return (
      <div className={`ui-input-group ${containerClassName}`} style={containerStyle}>
        {label && (
          <label htmlFor={inputId} className="ui-label">
            {label}
          </label>
        )}
        
        <div className={`ui-number-input-wrapper ${error ? 'error' : ''}`}>
          <button
            type="button"
            className="ui-number-input-btn"
            onClick={handleDecrement}
            disabled={isDecrementDisabled}
            aria-label="値を減らす"
          >
            －
          </button>
          
          <input
            id={inputId}
            type="number"
            ref={setRefs}
            className={`ui-number-input-field ${className}`}
            min={min}
            max={max}
            step={step}
            value={value !== undefined ? value : localValue}
            onChange={handleInputChange}
            disabled={disabled}
            readOnly={readOnly}
            {...props}
          />
          
          <button
            type="button"
            className="ui-number-input-btn"
            onClick={handleIncrement}
            disabled={isIncrementDisabled}
            aria-label="値を増やす"
          >
            ＋
          </button>
        </div>
        
        {error && <span className="ui-error-text" data-testid="number-input-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';
