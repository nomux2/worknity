import React, { forwardRef, useState, useEffect, useRef } from 'react';
import type { InputHTMLAttributes, CSSProperties } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: ComboboxOption) => void;
}

export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  ({ label, error, helperText, className = '', containerClassName = '', containerStyle, id, options = [], value = '', onChange, onSelectOption, disabled, placeholder, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const comboboxId = id || `combobox-${Math.random().toString(36).substring(2, 11)}`;

    // Filter options based on user text input
    const filteredOptions = React.useMemo(() => {
      if (!value) return options;
      
      const search = value.toLowerCase();
      return options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(search) ||
          opt.value.toLowerCase().includes(search)
      );
    }, [options, value]);

    // Handle click outside to close popover
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange(val);
      setIsOpen(true);
      setHighlightedIndex(0); // Reset highlight to first filtered item
    };

    const handleInputFocus = () => {
      if (disabled) return;
      setIsOpen(true);
    };

    const handleSelectOption = (opt: ComboboxOption) => {
      if (disabled) return;
      onChange(opt.label);
      if (onSelectOption) {
        onSelectOption(opt);
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (filteredOptions.length > 0) {
            setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (filteredOptions.length > 0) {
            setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleSelectOption(filteredOptions[highlightedIndex]);
          } else {
            // Confirm free text input
            setIsOpen(false);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
        default:
          break;
      }
    };

    return (
      <div className={`ui-input-group ${containerClassName}`} style={containerStyle} ref={containerRef}>
        {label && (
          <label htmlFor={comboboxId} className="ui-label">
            {label}
          </label>
        )}

        <div className="ui-combobox-wrapper" style={{ position: 'relative' }}>
          <input
            id={comboboxId}
            ref={(node) => {
              if (typeof ref === 'function') ref(node);
              else if (ref) (ref as any).current = node;
              (inputRef as any).current = node;
            }}
            type="text"
            className={`ui-input ui-combobox-input ${error ? 'error' : ''} ${className}`}
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
            {...props}
          />
          <span className="ui-select-arrow" style={{ pointerEvents: 'none' }}>▼</span>
        </div>

        {isOpen && filteredOptions.length > 0 && (
          <div className="ui-dropdown-popover" role="listbox">
            <ul className="ui-dropdown-options-list">
              {filteredOptions.map((opt, index) => {
                const isSelected = opt.label === value || opt.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`ui-dropdown-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => handleSelectOption(opt)}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isOpen && filteredOptions.length === 0 && (
          <div className="ui-dropdown-popover">
            <div className="ui-dropdown-empty">一致する項目がありません</div>
          </div>
        )}

        {error && <span className="ui-error-text" data-testid="combobox-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Combobox.displayName = 'Combobox';
