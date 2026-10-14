type BrandMarkProps = { compact?: boolean; dark?: boolean; label?: string };

export function BrandMark({ compact = false, dark = false, label = "CompetitionOS" }: BrandMarkProps) {
  const classes = ["brand-mark", compact ? "brand-mark--compact" : "", dark ? "brand-mark--dark" : ""].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-label={label}>
      <span className="brand-mark__glyph" aria-hidden="true">CO</span>
      <span className="brand-mark__word">{label}</span>
    </span>
  );
}
