import type { ReactNode } from "react";
import { BackButton } from "./back-button";
import { BrandMark } from "./brand-mark";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  fallback?: string;
};

export function AuthShell({ children, eyebrow, title, description, fallback = "/" }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <BackButton fallback={fallback} />
      <section className="auth-story" aria-label="CompetitionOS introduction">
        <BrandMark dark />
        <div className="auth-story__copy">
          <span className="eyebrow" style={{ color: "#B8FF3D" }}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span style={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,.4)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Competition command center / 2026
        </span>
      </section>
      <section className="auth-panel">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}
