import { useEffect, type ReactNode } from 'react';

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  description?: ReactNode;
  placement?: 'center' | 'sheet';
  size?: 'sm' | 'md' | 'lg';
  showClose?: boolean;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Modal surface. `placement="center"` = desktop dialog; `placement="sheet"` = mobile bottom sheet. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  placement = 'center',
  size = 'md',
  showClose = true,
  footer,
  className = '',
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={'mm-dialog mm-dialog--' + placement} role="presentation">
      <div className="mm-dialog__scrim" onClick={onClose} />
      <div
        className={'mm-dialog__panel mm-dialog__panel--' + size + ' ' + className}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {placement === 'sheet' && <div className="mm-dialog__grip" />}
        <div className="mm-dialog__inner">
          {showClose && (
            <button className="mm-dialog__close" aria-label="Close" onClick={onClose}>
              <XIcon />
            </button>
          )}
          {title && <div className="mm-dialog__title">{title}</div>}
          {description && <div className="mm-dialog__desc">{description}</div>}
          <div className="mm-dialog__body">{children}</div>
          {footer && <div className="mm-dialog__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
