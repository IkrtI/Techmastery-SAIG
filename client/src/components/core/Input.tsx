import type { InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
  invalid?: boolean;
}

/** Single-line text field. Calm hairline border; soft ring on focus; brick-red ring when invalid. */
export function Input({ size = 'md', invalid = false, className = '', ...rest }: InputProps) {
  const cls = ['mm-input', size === 'sm' && 'mm-input--sm', className].filter(Boolean).join(' ');
  return <input className={cls} aria-invalid={invalid || undefined} {...rest} />;
}
