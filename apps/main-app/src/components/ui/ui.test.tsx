// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { useState, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Input } from './Input';
import { TextArea } from './TextArea';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { Switch } from './Switch';
import { NumberInput } from './NumberInput';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';
import { Combobox } from './Combobox';

describe('UI Components', () => {
  let container: HTMLDivElement | null = null;
  let root: any = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root.unmount();
      });
      root = null;
    }
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  // Helper to simulate React input typing
  const setInputValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const prototype = Object.getPrototypeOf(input);
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  it('Input renders, displays label/error/helper text, and fires onChange', () => {
    let value = '';
    const handleChange = vi.fn((e) => {
      value = e.target.value;
    });

    root = createRoot(container!);
    act(() => {
      root.render(
        <Input
          label="Name Label"
          error="Name is required"
          helperText="Enter your name"
          value={value}
          onChange={handleChange}
        />
      );
    });

    const label = container!.querySelector('label');
    expect(label?.textContent).toBe('Name Label');

    const input = container!.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();

    const errorText = container!.querySelector('[data-testid="input-error"]');
    expect(errorText?.textContent).toBe('Name is required');

    act(() => {
      setInputValue(input, 'John Doe');
    });

    expect(handleChange).toHaveBeenCalled();
    expect(value).toBe('John Doe');
  });

  it('TextArea renders, displays label/error/helper text, and fires onChange', () => {
    let value = '';
    const handleChange = vi.fn((e) => {
      value = e.target.value;
    });

    root = createRoot(container!);
    act(() => {
      root.render(
        <TextArea
          label="Description"
          error="Description is too short"
          helperText="Write description here"
          value={value}
          onChange={handleChange}
        />
      );
    });

    const label = container!.querySelector('label');
    expect(label?.textContent).toBe('Description');

    const textarea = container!.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();

    const errorText = container!.querySelector('[data-testid="textarea-error"]');
    expect(errorText?.textContent).toBe('Description is too short');

    act(() => {
      setInputValue(textarea, 'Some description text');
    });

    expect(handleChange).toHaveBeenCalled();
    expect(value).toBe('Some description text');
  });

  it('Select renders options and fires onChange', () => {
    let value = '2';
    const handleChange = vi.fn((e) => {
      value = e.target.value;
    });

    const options = [
      { value: '1', label: 'Option 1' },
      { value: '2', label: 'Option 2' },
      { value: '3', label: 'Option 3' }
    ];

    root = createRoot(container!);
    act(() => {
      root.render(
        <Select
          label="Select Option"
          value={value}
          onChange={handleChange}
          options={options}
        />
      );
    });

    const select = container!.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('2');

    const optionElements = container!.querySelectorAll('option');
    expect(optionElements.length).toBe(3);
    expect(optionElements[0].textContent).toBe('Option 1');

    act(() => {
      select.value = '3';
      const event = new Event('change', { bubbles: true });
      select.dispatchEvent(event);
    });

    expect(handleChange).toHaveBeenCalled();
    expect(value).toBe('3');
  });

  it('Select supports size="sm" prop and adds sm class to trigger', () => {
    root = createRoot(container!);
    act(() => {
      root.render(
        <Select
          label="Compact Select"
          value="1"
          size="sm"
          options={[{ value: '1', label: 'Item 1' }]}
        />
      );
    });

    const trigger = container!.querySelector('.ui-select-trigger');
    expect(trigger?.classList.contains('sm')).toBe(true);
  });

  it('Checkbox renders and toggles state', () => {
    let checked = false;
    const handleChange = vi.fn((e) => {
      checked = e.target.checked;
    });

    root = createRoot(container!);
    act(() => {
      root.render(
        <Checkbox
          label="Agree"
          checked={checked}
          onChange={handleChange}
        />
      );
    });

    const input = container!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.checked).toBe(false);

    act(() => {
      input.click();
    });

    expect(handleChange).toHaveBeenCalled();
    expect(checked).toBe(true);
  });

  it('Switch renders and toggles state', () => {
    let checked = false;
    const handleChange = vi.fn((e) => {
      checked = e.target.checked;
    });

    root = createRoot(container!);
    act(() => {
      root.render(
        <Switch
          label="Enable Feature"
          checked={checked}
          onChange={handleChange}
        />
      );
    });

    const input = container!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.checked).toBe(false);

    act(() => {
      input.click();
    });

    expect(handleChange).toHaveBeenCalled();
    expect(checked).toBe(true);
  });

  it('NumberInput renders and handles click increments/decrements within bounds', () => {
    const TestWrapper = () => {
      const [val, setVal] = useState<number>(5);
      return (
        <NumberInput
          label="Quantity"
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          min={2}
          max={8}
          step={2}
        />
      );
    };

    root = createRoot(container!);
    act(() => {
      root.render(<TestWrapper />);
    });

    const input = container!.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('5');

    const buttons = container!.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    const minusBtn = buttons[0];
    const plusBtn = buttons[1];

    // Increment (+2) -> 7
    act(() => {
      plusBtn.click();
    });
    expect(input.value).toBe('7');

    // Increment (+2) -> 9 (exceeds max 8, caps at 8)
    act(() => {
      plusBtn.click();
    });
    expect(input.value).toBe('8');

    // Decrement (-2) -> 6
    act(() => {
      minusBtn.click();
    });
    expect(input.value).toBe('6');

    // Decrement (-2) -> 4
    act(() => {
      minusBtn.click();
    });
    expect(input.value).toBe('4');

    // Decrement (-2) -> 2
    act(() => {
      minusBtn.click();
    });
    expect(input.value).toBe('2');

    // Decrement (-2) -> 0 (exceeds min 2, caps at 2)
    act(() => {
      minusBtn.click();
    });
    expect(input.value).toBe('2');
  });

  it('DatePicker opens calendar popover and selects a date', () => {
    const TestWrapper = () => {
      const [val, setVal] = useState('2026-06-04');
      return (
        <DatePicker
          label="Date"
          value={val}
          onChange={setVal}
        />
      );
    };

    root = createRoot(container!);
    act(() => {
      root.render(<TestWrapper />);
    });

    const input = container!.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('2026-06-04');

    // Popover should be closed initially
    expect(container!.querySelector('[data-testid="datepicker-popover"]')).toBeNull();

    // Click input to open popover
    act(() => {
      input.click();
    });

    const popover = container!.querySelector('[data-testid="datepicker-popover"]');
    expect(popover).toBeTruthy();

    const dayButtons = container!.querySelectorAll('.ui-datepicker-day:not(.other-month)');
    const day15Button = Array.from(dayButtons).find(btn => btn.textContent === '15') as HTMLButtonElement;
    expect(day15Button).toBeTruthy();

    act(() => {
      day15Button.click();
    });

    expect(input.value).toBe('2026-06-15');
    // Popover should close
    expect(container!.querySelector('[data-testid="datepicker-popover"]')).toBeNull();
  });

  it('TimePicker opens popover and selects hour and minute', () => {
    const TestWrapper = () => {
      const [time, setTime] = useState('12:30');
      return (
        <TimePicker
          label="Time"
          value={time}
          onChange={setTime}
        />
      );
    };

    root = createRoot(container!);
    act(() => {
      root.render(<TestWrapper />);
    });

    const input = container!.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('12:30');

    // Popover should be closed initially
    expect(container!.querySelector('[data-testid="timepicker-popover"]')).toBeNull();

    // Click input to open popover
    act(() => {
      input.click();
    });

    const popover = container!.querySelector('[data-testid="timepicker-popover"]');
    expect(popover).toBeTruthy();

    // Choose hour 14
    const hourCol = container!.querySelector('[data-testid="hour-column"]');
    const hour14Btn = Array.from(hourCol!.querySelectorAll('.ui-timepicker-option')).find(
      (btn) => btn.textContent === '14'
    ) as HTMLButtonElement;
    expect(hour14Btn).toBeTruthy();

    act(() => {
      hour14Btn.click();
    });

    expect(input.value).toBe('14:30');

    // Choose minute 45
    const minCol = container!.querySelector('[data-testid="minute-column"]');
    const min45Btn = Array.from(minCol!.querySelectorAll('.ui-timepicker-option')).find(
      (btn) => btn.textContent === '45'
    ) as HTMLButtonElement;
    expect(min45Btn).toBeTruthy();

    act(() => {
      min45Btn.click();
    });

    expect(input.value).toBe('14:45');
  });

  it('Combobox renders, displays label, handles typing and selection', () => {
    let val = '';
    const handleChange = vi.fn((v) => {
      val = v;
    });

    const options = [
      { value: 'proj-1', label: 'Project Alpha' },
      { value: 'proj-2', label: 'Project Beta' },
      { value: 'proj-3', label: 'Project Gamma' },
    ];

    root = createRoot(container!);
    act(() => {
      root.render(
        <Combobox
          label="Select Project"
          value={val}
          onChange={handleChange}
          options={options}
          placeholder="Type to filter..."
        />
      );
    });

    const input = container!.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('Type to filter...');

    // Trigger focus to open popover
    act(() => {
      input.focus();
    });

    // Check if dropdown contains options
    const optionElements = container!.querySelectorAll('.ui-dropdown-option');
    expect(optionElements.length).toBe(3);
    expect(optionElements[0].textContent).toBe('Project Alpha');

    // Simulate typing
    act(() => {
      setInputValue(input, 'Beta');
    });

    expect(handleChange).toHaveBeenCalledWith('Beta');

    // Re-render with new value to simulate controlled component
    act(() => {
      root.render(
        <Combobox
          label="Select Project"
          value="Beta"
          onChange={handleChange}
          options={options}
        />
      );
    });

    // Option list should be filtered (only Project Beta should remain)
    const filteredOptions = container!.querySelectorAll('.ui-dropdown-option');
    expect(filteredOptions.length).toBe(1);
    expect(filteredOptions[0].textContent).toBe('Project Beta');

    // Click to select the option
    act(() => {
      (filteredOptions[0] as HTMLElement).click();
    });

    // Selection should trigger onChange with the option label
    expect(handleChange).toHaveBeenLastCalledWith('Project Beta');
  });
});

