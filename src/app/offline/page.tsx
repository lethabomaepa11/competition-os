import Link from "next/link";
import { BrandMark } from "@/components/common/brand-mark";

export default function OfflinePage() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#07111f", color: "#fff" }}><section style={{ width: "min(100%, 520px)" }}><BrandMark dark /><p style={{ marginTop: 64, color: "#75aeff", fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>Connection unavailable</p><h1 style={{ margin: "12px 0", fontSize: "clamp(36px, 8vw, 64px)", lineHeight: 1 }}>Competition data needs a live connection.</h1><p style={{ color: "rgba(255,255,255,.68)", lineHeight: 1.7 }}>Your private workspace and live scoring are never served from a stale cache. Reconnect to continue operating, or read the saved product guide.</p><div style={{ display: "flex", marginTop: 28, gap: 12 }}><Link href="/app" style={{ padding: "12px 16px", borderRadius: 8, background: "#2d7ff9", textDecoration: "none" }}>Try workspace again</Link><Link href="/how-to" style={{ padding: "12px 16px", border: "1px solid rgba(255,255,255,.3)", borderRadius: 8, textDecoration: "none" }}>Open how to</Link></div></section></main>;
}
