export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Colour of the 7×7 square dot; omit for no dot. */
  dot?: string;
}

interface Props<T extends string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segmented-item"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.dot !== undefined && <span className="segmented-dot" style={{ background: o.dot }} />}
          {o.label}
          {o.count !== undefined && <span className="segmented-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
