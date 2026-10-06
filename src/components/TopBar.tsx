interface Props {
  q: string;
  onQuery: (q: string) => void;
  attrCount: number;
  srcCount: number;
}

export function TopBar({ q, onQuery, attrCount, srcCount }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden>
          <div />
        </div>
        <span className="brand-name">Lineage</span>
        <span className="brand-sep">/</span>
        <span className="brand-app">Transaction Research</span>
      </div>
      <div className="search">
        {/* Lucide `search` */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="input"
          type="search"
          aria-label="Filter by field or column name"
          value={q}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter by field or column name — e.g. amount, MERCHANT_NM"
        />
      </div>
      <div className="topbar-stats">
        <span className="topbar-stats-dot" aria-hidden />
        <span>
          {attrCount} attributes · {srcCount} source columns
        </span>
      </div>
    </header>
  );
}
