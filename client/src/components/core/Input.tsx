import type { InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md';
}

/** Single-line field — inset dark surface, sky ring on focus. */
export function Input({ size = 'md', className = '', ...rest }: InputProps) {
  const cls = ['mm-input', size === 'sm' && 'mm-input--sm', className].filter(Boolean).join(' ');
  return <input className={cls} {...rest} />;
}
