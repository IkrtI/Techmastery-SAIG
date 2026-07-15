import type { ButtonHTMLAttributes } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

/** Round ghost icon button (header actions). */
export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button className={'mm-iconbtn ' + className} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}
