import type { ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'info' | 'outline' | 'danger' | 'danger-solid' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

/** Action button — rose primary CTA, sky info, quiet outline, danger for destructive. */
export function Button({ variant = 'primary', size = 'md', fullWidth = false, className = '', children, ...rest }: ButtonProps) {
  const cls = ['mm-btn', 'mm-btn--' + variant, size !== 'md' && 'mm-btn--' + size, fullWidth && 'mm-btn--full', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
