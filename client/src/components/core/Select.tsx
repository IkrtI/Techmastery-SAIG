import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: (string | SelectOption)[];
  placeholder?: string;
  invalid?: boolean;
  size?: 'sm' | 'md';
}

/** Styled native <select> with a chevron. Faculty/year pickers, filters. */
export function Select({
  options,
  placeholder,
  invalid = false,
  size = 'md',
  className = '',
  children,
  value,
  defaultValue,
  ...rest
}: SelectProps) {
  const cls = ['mm-select', size === 'sm' && 'mm-select--sm', className].filter(Boolean).join(' ');
  const usePlaceholder = placeholder !== undefined && value === undefined && defaultValue === undefined;
  return (
    <span className={cls} data-invalid={invalid || undefined}>
      <select required={usePlaceholder || undefined} defaultValue={usePlaceholder ? '' : defaultValue} value={value} {...rest}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options
          ? options.map((o) => {
              const v = typeof o === 'string' ? o : o.value;
              const l = typeof o === 'string' ? o : o.label;
              return (
                <option key={v} value={v}>
                  {l}
                </option>
              );
            })
          : children}
      </select>
      <span className="mm-select__chev">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </span>
  );
}
