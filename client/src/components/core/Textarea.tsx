import { useState, type ChangeEvent, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  showCount?: boolean;
  invalid?: boolean;
}

/** Multi-line field. Optional live character counter (the composer caps moods at 280). */
export function Textarea({ maxLength = 280, showCount = false, invalid = false, value, defaultValue, onChange, className = '', ...rest }: TextareaProps) {
  const [internal, setInternal] = useState(String(defaultValue ?? '').length);
  const len = value !== undefined ? String(value).length : internal;
  const handle = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) setInternal(e.target.value.length);
    onChange?.(e);
  };
  const over = maxLength != null && len > maxLength;
  const cls = ['mm-ta', showCount && 'mm-ta--count', className].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <textarea
        className="mm-ta__field"
        aria-invalid={invalid || over || undefined}
        value={value}
        defaultValue={defaultValue}
        onChange={handle}
        maxLength={maxLength}
        {...rest}
      />
      {showCount && (
        <span className={'mm-ta__count' + (over ? ' mm-ta__count--over' : '')}>
          {len}/{maxLength}
        </span>
      )}
    </div>
  );
}
