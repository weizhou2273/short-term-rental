/** Placeholder image: grey box with an X, until real photography is wired in. */
export function Ph({ label = '', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`ph ${className}`.trim()} role={label ? 'img' : undefined} aria-label={label || undefined}>
      {label ? <span>{label}</span> : null}
    </div>
  );
}
