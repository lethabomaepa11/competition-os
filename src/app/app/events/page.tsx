"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout, Typography, Card, Row, Col, Spin, Empty, Tag, Space, Button, Avatar } from "antd";
import { TrophyOutlined, LogoutOutlined, RightOutlined, TeamOutlined, PlusOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

interface MyEvent {
  participantId: string;
  eventId: string;
  eventName: string;
  eventStatus: string;
  eventFormat: string;
  competitionId: string;
  competitionName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  registeredAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  open: "blue",
  in_progress: "green",
  completed: "purple",
  cancelled: "red",
};

function MyEventsInner() {
  const router = useRouter();
  const { currentMember, logout } = useApp();
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMember) { router.push("/login"); return; }
    (async () => {
      try {
        const res = await fetch("/api/me/events");
        const json = await res.json();
        if (json.data) setEvents(json.data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [currentMember, router]);

  if (!currentMember) return null;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <Space>
          <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 40 }} />
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>CompetitionOS</Title>
        </Space>
        <Space>
          <Button type="text" style={{ color: "#fff" }} onClick={() => router.push("/app")}>
            Dashboard
          </Button>
          <Avatar size={32} style={{ fontSize: 13, fontWeight: 600 }}>
            {currentMember.displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Text style={{ fontWeight: 500, color: "#fff" }}>{currentMember.displayName}</Text>
          <Button type="text" icon={<LogoutOutlined />} style={{ color: "#fff" }}
            onClick={() => { logout(); router.push("/login"); }}
          />
        </Space>
      </Header>

      <Content style={{ padding: "48px 32px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              My Events
            </Text>
            <Title level={2} style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700 }}>
              Events You&apos;ve Joined
            </Title>
          </div>
          <Button icon={<PlusOutlined />} onClick={() => router.push("/app")}>
            Browse Competitions
          </Button>
        </div>

        {loading ? (
          <Spin style={{ display: "flex", justifyContent: "center", marginTop: 60 }} />
        ) : events.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <Empty
              description={
                <div>
                  <Text style={{ fontSize: 15, display: "block", marginBottom: 4 }}>You haven&apos;t joined any events yet</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Join a competition to see your events here
                  </Text>
                </div>
              }
            >
              <Button type="primary" size="large" onClick={() => router.push("/app")} style={{ marginTop: 8 }}>
                Browse Organizations
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {events.map((evt) => (
              <Col xs={24} sm={12} key={evt.participantId}>
                <Card
                  hoverable
                  className="card-hover"
                  onClick={() => {
                    if (evt.organizationSlug && evt.competitionId) {
                      router.push(`/live/${evt.organizationSlug}/${evt.competitionId}`);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <Avatar size={48} icon={<TrophyOutlined />} style={{ fontSize: 20, flexShrink: 0 }} />
                      <div>
                        <Title level={4} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{evt.eventName}</Title>
                        <Tag color={STATUS_COLORS[evt.eventStatus] ?? "default"} style={{ marginTop: 4 }}>
                          {evt.eventStatus?.replace(/_/g, " ")}
                        </Tag>
                        <div style={{ marginTop: 8 }}>
                          <Text style={{ display: "block", fontSize: 13, color: "#64748b" }}>
                            <TeamOutlined style={{ marginRight: 4 }} />
                            {evt.competitionName}
                          </Text>
                          <Text style={{ display: "block", fontSize: 12, color: "#94a3b8" }}>
                            {evt.organizationName}
                          </Text>
                        </div>
                      </div>
                    </div>
                    <Button type="text" icon={<RightOutlined />} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Content>
    </Layout>
  );
}

export default function MyEventsPage() {
  return (
    <AppProvider>
      <MyEventsInner />
    </AppProvider>
  );
}
