import type { TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number;
  showCount?: boolean;
}

/** Multi-line field with a mono character counter (moods cap at 280). */
export function Textarea({ maxLength = 280, showCount = true, value, className = '', ...rest }: TextareaProps) {
  const len = String(value ?? '').length;
  return (
    <div className={'mm-ta ' + className}>
      <textarea className="mm-ta__field" value={value} maxLength={maxLength} {...rest} />
      {showCount && (
        <span className="mm-ta__count">
          {len}/{maxLength}
        </span>
      )}
    </div>
  );
}
