export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Flow Focus">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="brand-name">Flow <strong>Focus</strong></span>}
    </div>
  );
}
