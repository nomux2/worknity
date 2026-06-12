import React, { useState, useEffect, useRef, forwardRef } from 'react';

export interface TimePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  value?: string; // HH:MM
  onChange?: (value: string) => void;
  minuteStep?: number;
}

export const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ label, error, helperText, className = '', containerClassName = '', value = '', onChange, placeholder = 'HH:MM', disabled, readOnly, minuteStep = 1, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hourColRef = useRef<HTMLDivElement>(null);
    const minuteColRef = useRef<HTMLDivElement>(null);

    const { hour, minute } = parseTime(value);

    // Click outside handler
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    // Auto scroll selected option into view when popover opens
    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          if (hourColRef.current) {
            const selectedHour = hourColRef.current.querySelector('.selected');
            if (selectedHour) {
              selectedHour.scrollIntoView({ block: 'center' });
            }
          }
          if (minuteColRef.current) {
            const selectedMin = minuteColRef.current.querySelector('.selected');
            if (selectedMin) {
              selectedMin.scrollIntoView({ block: 'center' });
            }
          }
        }, 50); // slight delay to ensure render is complete
      }
    }, [isOpen]);

    const handleInputClick = () => {
      if (disabled || readOnly) return;
      setIsOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    const handleHourSelect = (h: string) => {
      if (disabled || readOnly) return;
      const newVal = `${h}:${minute}`;
      if (onChange) {
        onChange(newVal);
      }
    };

    const handleMinuteSelect = (m: string) => {
      if (disabled || readOnly) return;
      const newVal = `${hour}:${m}`;
      if (onChange) {
        onChange(newVal);
      }
    };

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    
    // Generate minutes based on minuteStep
    const minutes: string[] = [];
    for (let i = 0; i < 60; i += minuteStep) {
      minutes.push(String(i).padStart(2, '0'));
    }

    return (
      <div className={`ui-input-group ${containerClassName}`} ref={containerRef} style={{ position: 'relative' }}>
        {label && (
          <label className="ui-label">
            {label}
          </label>
        )}
        <input
          ref={(node) => {
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as any).current = node;
            (inputRef as any).current = node;
          }}
          type="text"
          className={`ui-input ${error ? 'error' : ''} ${className}`}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onFocus={handleInputClick}
          disabled={disabled}
          readOnly={readOnly}
          {...props}
        />
        {error && <span className="ui-error-text" data-testid="timepicker-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}

        {isOpen && (
          <div className="ui-timepicker-popover" data-testid="timepicker-popover">
            <div className="ui-timepicker-col" ref={hourColRef} data-testid="hour-column">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.25rem', fontWeight: 'bold' }}>時</div>
              {hours.map((h) => {
                const isSelected = h === hour;
                return (
                  <button
                    key={h}
                    type="button"
                    className={`ui-timepicker-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleHourSelect(h)}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <div className="ui-timepicker-col" ref={minuteColRef} data-testid="minute-column">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.25rem', fontWeight: 'bold' }}>分</div>
              {minutes.map((m) => {
                const isSelected = m === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    className={`ui-timepicker-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleMinuteSelect(m)}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
);

TimePicker.displayName = 'TimePicker';

// Helper function
const parseTime = (val: string) => {
  if (!val) return { hour: '00', minute: '00' };
  const parts = val.split(':');
  const h = parts[0] || '00';
  const m = parts[1] || '00';
  return { hour: h.padStart(2, '0'), minute: m.padStart(2, '0') };
};
