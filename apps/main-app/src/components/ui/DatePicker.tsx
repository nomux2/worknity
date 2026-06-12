import React, { useState, useEffect, useRef, forwardRef } from 'react';

export interface DatePickerProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  value?: string; // YYYY-MM-DD
  onChange?: (value: string) => void;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, helperText, className = '', containerClassName = '', value = '', onChange, placeholder = 'YYYY-MM-DD', disabled, readOnly, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Track local display state (for calendar navigation)
    const [currentYear, setCurrentYear] = useState<number>(() => {
      const parsed = parseDate(value);
      return parsed ? parsed.getFullYear() : new Date().getFullYear();
    });
    const [currentMonth, setCurrentMonth] = useState<number>(() => {
      const parsed = parseDate(value);
      return parsed ? parsed.getMonth() : new Date().getMonth();
    });

    // Update currentYear and currentMonth when value changes externally
    useEffect(() => {
      const parsed = parseDate(value);
      if (parsed) {
        setCurrentYear(parsed.getFullYear());
        setCurrentMonth(parsed.getMonth());
      }
    }, [value]);

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

    const handleInputClick = () => {
      if (disabled || readOnly) return;
      setIsOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (onChange) {
        onChange(val);
      }
    };

    const selectDate = (date: Date) => {
      if (disabled || readOnly) return;
      const formatted = formatDate(date);
      if (onChange) {
        onChange(formatted);
      }
      setIsOpen(false);
    };

    const handlePrevMonth = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCurrentMonth((prev) => {
        if (prev === 0) {
          setCurrentYear((y) => y - 1);
          return 11;
        }
        return prev - 1;
      });
    };

    const handleNextMonth = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setCurrentMonth((prev) => {
        if (prev === 11) {
          setCurrentYear((y) => y + 1);
          return 0;
        }
        return prev + 1;
      });
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setCurrentYear(parseInt(e.target.value, 10));
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setCurrentMonth(parseInt(e.target.value, 10));
    };

    // Calculate calendar grid days
    const getDaysInMonth = (year: number, month: number) => {
      return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
      return new Date(year, month, 1).getDay();
    };

    const generateDays = () => {
      const daysList: Array<{ date: Date; isCurrentMonth: boolean; key: string }> = [];
      const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
      
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevMonthDaysCount = getDaysInMonth(prevYear, prevMonth);

      // Trailing days of previous month
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = new Date(prevYear, prevMonth, prevMonthDaysCount - i);
        daysList.push({ date: d, isCurrentMonth: false, key: `prev-${prevMonthDaysCount - i}` });
      }

      // Days of current month
      const currentMonthDaysCount = getDaysInMonth(currentYear, currentMonth);
      for (let i = 1; i <= currentMonthDaysCount; i++) {
        const d = new Date(currentYear, currentMonth, i);
        daysList.push({ date: d, isCurrentMonth: true, key: `curr-${i}` });
      }

      // Leading days of next month
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const remaining = 42 - daysList.length;
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(nextYear, nextMonth, i);
        daysList.push({ date: d, isCurrentMonth: false, key: `next-${i}` });
      }

      return daysList;
    };

    const days = generateDays();
    const parsedSelectedDate = parseDate(value);
    const formattedSelectedDate = parsedSelectedDate ? formatDate(parsedSelectedDate) : '';

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    // Generate year range for dropdown: current year +/- 10 years
    const startYear = currentYear - 10;
    const yearsRange = Array.from({ length: 21 }, (_, i) => startYear + i);
    const monthsRange = Array.from({ length: 12 }, (_, i) => i);

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
        {error && <span className="ui-error-text" data-testid="datepicker-error">{error}</span>}
        {!error && helperText && (
          <span className="ui-helper-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {helperText}
          </span>
        )}

        {isOpen && (
          <div className="ui-datepicker-popover" data-testid="datepicker-popover">
            <div className="ui-datepicker-header">
              <button
                type="button"
                className="btn btn-icon"
                onClick={handlePrevMonth}
                style={{ padding: '0.2rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
                aria-label="前月"
              >
                ◀
              </button>
              
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <select
                  value={currentYear}
                  onChange={handleYearChange}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                  aria-label="年"
                >
                  {yearsRange.map((y) => (
                    <option key={y} value={y}>{y}年</option>
                  ))}
                </select>
                <select
                  value={currentMonth}
                  onChange={handleMonthChange}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
                  aria-label="月"
                >
                  {monthsRange.map((m) => (
                    <option key={m} value={m}>{m + 1}月</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-icon"
                onClick={handleNextMonth}
                style={{ padding: '0.2rem 0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
                aria-label="翌月"
              >
                ▶
              </button>
            </div>

            <div className="ui-datepicker-grid">
              {weekDays.map((wd) => (
                <div key={wd} className="ui-datepicker-day-name">
                  {wd}
                </div>
              ))}

              {days.map(({ date, isCurrentMonth, key }) => {
                const isSelected = formattedSelectedDate === formatDate(date);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`ui-datepicker-day ${isCurrentMonth ? '' : 'other-month'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectDate(date)}
                    aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`}
                  >
                    {date.getDate()}
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

DatePicker.displayName = 'DatePicker';

// Helper functions
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDate = (str: string) => {
  if (!str) return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
};
