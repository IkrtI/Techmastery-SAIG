import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  flat?: boolean;
}

/** Base surface — white, 14px radius, soft shadow, hairline border. */
export function Card({ padding = 'md', flat = false, className = '', children, ...rest }: CardProps) {
  const cls = ['mm-card', 'mm-card--pad-' + padding, flat && 'mm-card--flat', className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
