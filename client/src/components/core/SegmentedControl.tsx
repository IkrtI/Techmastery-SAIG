export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

/** Pill segmented control — the TH/EN language toggle. */
export function SegmentedControl({ options, value, onChange, className = '' }: SegmentedControlProps) {
  return (
    <div className={'mm-seg ' + className} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={'mm-seg__opt' + (o.value === value ? ' is-active' : '')}
          aria-pressed={o.value === value}
          onClick={() => onChange?.(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
