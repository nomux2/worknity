import React, { forwardRef, useState, useEffect, useRef } from 'react';
import type { SelectHTMLAttributes, CSSProperties } from 'react';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  options?: Array<{ value: string | number; label: string }>;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className = '', containerClassName = '', containerStyle, id, options = [], children, value, onChange, disabled, placeholder, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const nativeSelectRef = useRef<HTMLSelectElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const selectId = id || `select-${Math.random().toString(36).substring(2, 11)}`;

    // Resolve options (either from props.options or parsing children)
    const resolvedOptions = React.useMemo(() => {
      if (options && options.length > 0) {
        return options.map(opt => ({ value: String(opt.value), label: opt.label }));
      }
      
      // Fallback: parse React children if they are option elements
      const list: Array<{ value: string; label: string }> = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
          const optChild = child as React.ReactElement<{ value?: string | number; children?: React.ReactNode }>;
          list.push({
            value: String(optChild.props.value ?? ''),
            label: String(optChild.props.children ?? ''),
          });
        }
      });
      return list;
    }, [options, children]);

    const selectedOption = resolvedOptions.find((opt) => opt.value === String(value ?? ''));

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

    const handleTriggerClick = (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsOpen((prev) => !prev);
    };

    const handleSelectOption = (optValue: string) => {
      if (disabled) return;
      
      // Update hidden native select value and trigger change event
      const nativeSelect = nativeSelectRef.current;
      if (nativeSelect) {
        nativeSelect.value = optValue;
        
        // Dispatch synthetic ChangeEvent for React
        const event = new Event('change', { bubbles: true }) as unknown as React.ChangeEvent<HTMLSelectElement>;
        Object.defineProperty(event, 'target', { writable: true, value: nativeSelect });
        Object.defineProperty(event, 'currentTarget', { writable: true, value: nativeSelect });
        
        if (onChange) {
          onChange(event);
        }
      }
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
          // Highlight current selected or first item
          const selectedIdx = resolvedOptions.findIndex(opt => opt.value === String(value ?? ''));
          setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % resolvedOptions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + resolvedOptions.length) % resolvedOptions.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < resolvedOptions.length) {
            handleSelectOption(resolvedOptions[highlightedIndex].value);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
        default:
          break;
      }
    };

    useEffect(() => {
      if (isOpen) {
        const selectedIdx = resolvedOptions.findIndex(opt => opt.value === String(value ?? ''));
        setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
      } else {
        setHighlightedIndex(-1);
      }
    }, [isOpen, value, resolvedOptions]);

    return (
      <div className={`ui-input-group ${containerClassName}`} style={containerStyle} ref={containerRef}>
        {label && (
          <label htmlFor={selectId} className="ui-label">
            {label}
          </label>
        )}
        
        {/* Hidden native select for form integration and ref forwarding */}
        <select
          id={selectId}
          ref={(node) => {
            // Update ref
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as any).current = node;
            (nativeSelectRef as any).current = node;
          }}
          value={value}
          onChange={onChange}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
          disabled={disabled}
          {...props}
        >
          {resolvedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom Custom Dropdown Trigger */}
        <button
          ref={triggerRef}
          type="button"
          className={`ui-select-trigger ${isOpen ? 'active' : ''} ${error ? 'error' : ''} ${className}`}
          onClick={handleTriggerClick}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span>{selectedOption ? selectedOption.label : (placeholder || '選択してください')}</span>
          <span className="ui-select-arrow">▼</span>
        </button>

        {/* Custom Dropdown Popover */}
        {isOpen && resolvedOptions.length > 0 && (
          <div className="ui-dropdown-popover" role="listbox">
            <ul className="ui-dropdown-options-list">
              {resolvedOptions.map((opt, index) => {
                const isSelected = opt.value === String(value ?? '');
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    className={`ui-dropdown-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => handleSelectOption(opt.value)}
                  >
                    {opt.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
