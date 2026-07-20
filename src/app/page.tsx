"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Typography, Space, Card, Row, Col, Layout } from "antd";
import {
  ThunderboltOutlined, TeamOutlined, BulbOutlined,
  ArrowRightOutlined, TrophyOutlined, SafetyOutlined,
} from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";

const { Header, Content } = Layout;
const { Title, Paragraph, Text } = Typography;

function LandingInner() {
  const router = useRouter();
  const { currentMember } = useApp();

  useEffect(() => {
    if (currentMember) router.push("/app");
  }, [currentMember, router]);

  return (
    <Layout style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Nav */}
      <div style={{
        background: "#0F172A", borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 48 }} />
          <span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 18 }}>CompetitionOS</span>
        </div>
        <Space>
          <Button type="text" style={{ color: "rgba(255,255,255,0.7)" }} onClick={() => router.push("/login")}>Sign In</Button>
          <Button type="primary" style={{ background: "#FBBF24", borderColor: "#FBBF24", color: "#0F172A", fontWeight: 600 }} onClick={() => router.push("/register")}>Get Started</Button>
        </Space>
      </div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #1E40AF 100%)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle at 25% 50%, rgba(251, 191, 36, 0.08) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(255, 255, 255, 0.04) 0%, transparent 50%)",
        }} />
        <Content style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 24px 80px", textAlign: "center", position: "relative" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(251, 191, 36, 0.12)", border: "1px solid rgba(251, 191, 36, 0.2)",
            borderRadius: 100, padding: "6px 16px 6px 8px", marginBottom: 32,
          }}>
            <span style={{ color: "#FBBF24", fontSize: 13, fontWeight: 500 }}>⚡ Configurable competition engine</span>
          </div>

          <Title level={1} style={{ color: "#FFFFFF", fontSize: 52, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.04em", margin: "0 auto 20px", maxWidth: 680 }}>
            Run any competition.
            <span style={{ color: "#FBBF24", display: "block" }}>Not just games.</span>
          </Title>

          <Paragraph style={{ fontSize: 18, maxWidth: 520, margin: "0 auto 40px", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.7 }}>
            Leagues, tournaments, championships — for esports, sports, schools, corporate, or community.
          </Paragraph>

          <Space size="middle">
            <Button type="primary" size="large" shape="round" onClick={() => router.push("/login")}
              style={{ height: 50, paddingInline: 36, fontSize: 16, background: "#FBBF24", borderColor: "#FBBF24", color: "#0F172A", fontWeight: 600 }}>
              Get Started <ArrowRightOutlined />
            </Button>
            <Button size="large" shape="round" onClick={() => router.push("/register")}
              style={{ height: 50, paddingInline: 36, fontSize: 16, background: "rgba(255, 255, 255, 0.08)", borderColor: "rgba(255, 255, 255, 0.15)", color: "#FFFFFF" }}>
              Create Account
            </Button>
          </Space>
        </Content>
        <div style={{ height: 60, background: "linear-gradient(to top, #F8FAFC 0%, transparent 100%)" }} />
      </div>

      {/* Features */}
      <Content style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <Text style={{ color: "#1E3A8A", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>The Platform</Text>
          <Title level={2} style={{ fontSize: 32, fontWeight: 700, margin: "8px 0", color: "#0F172A" }}>
            Built for competitions, not games
          </Title>
        </div>

        <Row gutter={[24, 24]}>
          {[
            { icon: <ThunderboltOutlined />, title: "Pluggable Formats", desc: "League, Single & Double Elimination, Swiss, Group Stage, Ladder. Add custom formats via config.", accent: "#1E3A8A" },
            { icon: <TeamOutlined />, title: "Multi-Tenant", desc: "Organizations, roles, permissions, blueprints. Built for teams, schools, and communities.", accent: "#FBBF24" },
            { icon: <BulbOutlined />, title: "Configurable Rules", desc: "Every scoring parameter configurable. Win points, tiebreakers, seeding — nothing is hardcoded.", accent: "#22C55E" },
            { icon: <SafetyOutlined />, title: "Audit & Undo", desc: "Every mutation recorded. Undo any action with one click.", accent: "#8B5CF6" },
            { icon: <TrophyOutlined />, title: "Championship Engine", desc: "Multi-event seasons with configurable points and auto-qualification.", accent: "#F59E0B" },
            { icon: <ThunderboltOutlined />, title: "Blueprints", desc: "Save competitions as templates. Share, import, export, duplicate.", accent: "#06B6D4" },
          ].map((f) => (
            <Col xs={24} sm={12} md={8} key={f.title}>
              <Card className="card-hover" style={{ borderRadius: 14, height: "100%" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${f.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: f.accent, fontSize: 18 }}>
                  {f.icon}
                </div>
                <Title level={4} style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: "#0F172A" }}>{f.title}</Title>
                <Paragraph style={{ color: "#475569", margin: 0, fontSize: 14, lineHeight: 1.7 }}>{f.desc}</Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </Content>

      {/* CTA */}
      <Content style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px 80px", textAlign: "center" }}>
        <div style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)", borderRadius: 20, padding: "56px 32px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 70% 50%, rgba(251, 191, 36, 0.06) 0%, transparent 60%)" }} />
          <Title level={2} style={{ color: "#FFFFFF", fontSize: 28, fontWeight: 700, marginBottom: 12, position: "relative" }}>
            Ready to run your competition?
          </Title>
          <Paragraph style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 16, maxWidth: 460, margin: "0 auto 28px", position: "relative" }}>
            Create your organization and set up your first event in under 5 minutes.
          </Paragraph>
          <Button type="primary" size="large" shape="round" onClick={() => router.push("/register")}
            style={{ height: 50, paddingInline: 40, fontSize: 16, fontWeight: 600, background: "#FBBF24", borderColor: "#FBBF24", color: "#0F172A" }}>
            Get started free <ArrowRightOutlined />
          </Button>
        </div>
      </Content>
    </Layout>
  );
}

export default function Landing() {
  return (
    <AppProvider>
      <LandingInner />
    </AppProvider>
  );
}
