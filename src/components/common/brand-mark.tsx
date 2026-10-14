import { CompetitionLogo } from "./competition-logo";

type BrandMarkProps = { compact?: boolean; dark?: boolean; label?: string };

export function BrandMark({ compact = false, dark = false, label = "CompetitionOS" }: BrandMarkProps) {
  const classes = ["brand-mark", compact ? "brand-mark--compact" : "", dark ? "brand-mark--dark" : ""].filter(Boolean).join(" ");
  return (
    <span className={classes} role="img" aria-label={label}>
      <span className="brand-mark__glyph"><CompetitionLogo size={36} /></span>
      <span className="brand-mark__word">{label}</span>
    </span>
  );
}
