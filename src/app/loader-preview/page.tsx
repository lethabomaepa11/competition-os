import { notFound } from "next/navigation";
import { Spin } from "antd";
import { BrandMark } from "@/components/common/brand-mark";
import { CompetitionLogo } from "@/components/common/competition-logo";

export default function LoaderPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main style={{ minHeight: "100vh", padding: "32px clamp(20px, 6vw, 88px) 64px", background: "#f1f5fb", color: "#14243a" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1120, margin: "0 auto 72px" }}>
        <BrandMark />
        <span style={{ color: "#52627a", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>Local preview</span>
      </header>
      <section style={{ maxWidth: 1120, margin: "0 auto" }}>
        <span className="eyebrow">CompetitionOS identity</span>
        <h1 style={{ maxWidth: 740, margin: "0 0 14px", fontSize: "clamp(36px, 6vw, 64px)", letterSpacing: "-.055em", lineHeight: .98 }}>A little movement while the competition comes together.</h1>
        <p style={{ maxWidth: 620, margin: 0, color: "#60718a", fontSize: 16, lineHeight: 1.7 }}>The same tournament crest now carries through the brand and every loading state. The badge lifts and spins while the orbit rings cycle around it.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18, marginTop: 42 }}>
          <article style={{ minHeight: 300, display: "grid", placeItems: "center", padding: 28, border: "1px solid #dce5f1", borderRadius: 18, background: "#fff", boxShadow: "0 16px 42px rgba(18, 51, 94, .07)" }}>
            <div style={{ textAlign: "center" }}><Spin size="large" /><h2 style={{ margin: "20px 0 4px", fontSize: 16 }}>Workspace loading</h2><p style={{ margin: 0, color: "#74839a", fontSize: 13 }}>Full motion</p></div>
          </article>
          <article style={{ minHeight: 300, display: "grid", placeItems: "center", padding: 28, border: "1px solid #dce5f1", borderRadius: 18, background: "#102744", color: "#fff", boxShadow: "0 16px 42px rgba(18, 51, 94, .12)" }}>
            <div style={{ textAlign: "center" }}><CompetitionLogo size={76} /><h2 style={{ margin: "14px 0 4px", fontSize: 16 }}>Tournament crest</h2><p style={{ margin: 0, color: "#b9c9df", fontSize: 13 }}>Static brand mark</p></div>
          </article>
          <article style={{ minHeight: 300, display: "grid", placeItems: "center", padding: 28, border: "1px solid #dce5f1", borderRadius: 18, background: "#fff", boxShadow: "0 16px 42px rgba(18, 51, 94, .07)" }}>
            <div style={{ textAlign: "center" }}><Spin size="small" /><h2 style={{ margin: "20px 0 4px", fontSize: 16 }}>Compact loading</h2><p style={{ margin: 0, color: "#74839a", fontSize: 13 }}>Inline scale</p></div>
          </article>
        </div>
      </section>
    </main>
  );
}
