export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: (string | SegmentedOption)[];
  value: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

/** Pill segmented control — the TH/EN language toggle and other short exclusive options. */
export function SegmentedControl({ options, value, onChange, size = 'md', className = '' }: SegmentedControlProps) {
  return (
    <div className={'mm-seg mm-seg--' + size + ' ' + className} role="group">
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} type="button" className={'mm-seg__opt' + (active ? ' is-active' : '')} aria-pressed={active} onClick={() => onChange?.(v)}>
            {l}
          </button>
        );
      })}
    </div>
  );
}
