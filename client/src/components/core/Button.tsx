import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/** Standard action button — calm near-black primary, soft secondary, ghost/outline, muted destructive. */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = ['mm-btn', 'mm-btn--' + variant, size !== 'md' && 'mm-btn--' + size, fullWidth && 'mm-btn--full', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {leftIcon && <span className="mm-btn__icon">{leftIcon}</span>}
      {children != null && <span>{children}</span>}
      {rightIcon && <span className="mm-btn__icon">{rightIcon}</span>}
    </button>
  );
}
