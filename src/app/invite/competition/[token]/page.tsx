"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Typography, Button, Spin, message, Layout, Result, Tag, Row, Col, Space, Divider, Input, Form, Collapse, Avatar } from "antd";
import {
  TrophyOutlined,
  TeamOutlined,
  LoginOutlined,
  UserAddOutlined,
  RightOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { CompetitionInviteService } from "@/domain/services/competition-invite.service";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { MemberService } from "@/domain/services/organization.service";
import type { Competition } from "@/domain/competition";
import type { Event } from "@/domain/event";
import type { Participant } from "@/domain/participant";
import { EventStatus } from "@/domain/types";
import { sendMailEvent } from "@/lib/mail/client";
import TipTapRenderer from "@/components/editor/tiptap-renderer";

const { Content } = Layout;
const { Title, Text } = Typography;

function AcceptCompetitionInviteInner() {
  const params = useParams();
  const router = useRouter();
  const { currentMember } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsWithParticipants, setEventsWithParticipants] = useState<Map<string, Participant[]>>(new Map());
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const token = params.token as string;

  useEffect(() => {
    const inviteSvc = new CompetitionInviteService();
    (async () => {
      const inv = await inviteSvc.getByToken(token);
      if (!inv) {
        setError("Invite not found");
      } else if (inv.status !== "active") {
        setError("This invite link is no longer active");
      } else {
        const compSvc = new CompetitionService();
        const comp = await compSvc.get(inv.competitionId);
        if (!comp) {
          setError("Competition not found");
        } else {
          setCompetition(comp);
          const evtSvc = new EventService();
          const evts = await evtSvc.list(comp.id);
          setEvents(evts);

          const regSvc = new RegistrationService();
          const participantMap = new Map<string, Participant[]>();
          for (const evt of evts) {
            const participants = await regSvc.getParticipants(evt.id);
            participantMap.set(evt.id, participants);
          }
          setEventsWithParticipants(participantMap);
        }
      }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
    if (!currentMember || !competition) return;
    const regSvc = new RegistrationService();
    const joined = new Set<string>();
    for (const evt of events) {
      if (await regSvc.isRegistered(evt.id, currentMember.id)) {
        joined.add(evt.id);
      }
    }
    setRegisteredEvents(joined);
    })();
  }, [currentMember, competition, events]);

  const handleAuth = async (values: { displayName: string; email: string }) => {
    setAuthLoading(true);
    try {
      const password = crypto.randomUUID();
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password, displayName: values.displayName }),
      });
      if (!regRes.ok) {
        const json = await regRes.json();
        message.error(json.error ?? "Could not create account");
        setAuthLoading(false);
        return;
      }
      sendMailEvent({
        kind: "account_created",
        to: [{ email: values.email, name: values.displayName }],
        params: {
          password,
          actionLabel: "Sign in",
        },
        actionUrl: `${window.location.origin}/login`,
      });
      const logRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password }),
      });
      if (!logRes.ok) {
        message.error("Account created but could not sign in. Please log in manually.");
        router.push(`/login?redirect=/invite/competition/${token}`);
        return;
      }
      sessionStorage.setItem("invite_display_name", values.displayName);
      window.location.reload();
    } catch {
      message.error("Something went wrong");
      setAuthLoading(false);
    }
  };

  const handleJoinEvent = async (eventId: string) => {
    if (!currentMember) return;
    setJoiningId(eventId);
    try {
      const regSvc = new RegistrationService();
      const evt = events.find((e) => e.id === eventId);
      const displayName = sessionStorage.getItem("invite_display_name") ?? currentMember.displayName;
      await regSvc.register(eventId, currentMember.id, displayName);
      sendMailEvent({
        kind: "participant_registered",
        to: [{ email: currentMember.email, name: displayName }],
        actionUrl: `${window.location.origin}/app`,
        params: {
          eventName: evt?.name ?? "event",
          competitionName: competition?.name,
          participantName: displayName,
          actionLabel: "Open dashboard",
        },
      });
      sessionStorage.removeItem("invite_display_name");
      message.success("Joined event!");
      setRegisteredEvents((prev) => new Set(prev).add(eventId));

      const participants = await regSvc.getParticipants(eventId);
      setEventsWithParticipants((prev) => new Map(prev).set(eventId, participants));
    } catch {
      message.error("Failed to join");
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 100 }} />;

  if (error) {
    return (
      <Content style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Result status="error" title="Invalid Invite" subTitle={error} extra={<Button onClick={() => router.push("/")}>Go Home</Button>} />
      </Content>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <div style={{
        position: "relative",
        minHeight: competition?.coverImage ? 420 : 280,
        display: "flex",
        alignItems: "flex-end",
        overflow: "hidden",
        background: competition?.coverImage ? "none" : "linear-gradient(135deg, #0A0B0F 0%, #13141A 50%, #0A0B0F 100%)",
      }}>
        {competition?.coverImage && (
          <>
            <img
              src={competition.coverImage}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(transparent 40%, rgba(10,11,15,0.95))",
            }} />
          </>
        )}
        {!competition?.coverImage && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(232,166,35,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />
        )}

        <div style={{
          position: "relative",
          zIndex: 1,
          padding: competition?.coverImage ? "120px 24px 48px" : "64px 24px 40px",
          maxWidth: 800,
          margin: "0 auto",
          width: "100%",
        }}>
          <Space style={{ marginBottom: 12 }}>
            <Tag color="gold" style={{ fontSize: 12 }}>{competition?.game?.name ?? "Competition"}</Tag>
            <Tag style={{ fontSize: 12 }}>{events.length} {events.length === 1 ? "Event" : "Events"}</Tag>
          </Space>
          <Title level={1} style={{ margin: 0, fontSize: 32 }}>
            {competition?.name}
          </Title>
          {competition?.game && (
            <Text style={{ fontSize: 14, display: "block", marginTop: 4 }}>
              {competition.game.name}
            </Text>
          )}
          {competition?.description && (
            <Text style={{ display: "block", marginTop: 8, fontSize: 15, maxWidth: 600 }}>
              {competition.description}
            </Text>
          )}
        </div>
      </div>

      <Content style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 48px" }}>
        {competition?.content && (
          <Card style={{
            marginBottom: 24,
            marginTop: -24,
            position: "relative",
            zIndex: 2,
          }}>
            <TipTapRenderer content={competition.content} />
          </Card>
        )}

        <Card style={{
          marginBottom: 24,
          marginTop: !competition?.content ? -24 : 0,
          position: !competition?.content ? "relative" : "static",
          zIndex: !competition?.content ? 2 : "auto",
        }}>
          {!currentMember ? (
            <div>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <Title level={4}>You're invited!</Title>
                <Text style={{ display: "block" }}>
                  Enter your name to create an account and join.
                </Text>
              </div>
              <Form layout="vertical" onFinish={handleAuth} requiredMark={false}>
                <Form.Item label="Your Name" name="displayName" rules={[{ required: true, message: "Enter your name" }]}>
                  <Input placeholder="e.g., Alex" size="large" />
                </Form.Item>
                <Form.Item label="Email" name="email" rules={[{ required: true, type: "email", message: "Enter your email" }]}>
                  <Input placeholder="you@example.com" size="large" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 12 }}>
                  <Button type="primary" htmlType="submit" size="large" icon={<UserAddOutlined />} block loading={authLoading}>
                    Create Account & Join
                  </Button>
                </Form.Item>
              </Form>
              <div style={{ textAlign: "center" }}>
                <Button type="link" icon={<LoginOutlined />} onClick={() => router.push(`/login?redirect=/invite/competition/${token}`)}>
                  I already have an account
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Title level={4} style={{ margin: 0 }}>Events</Title>
                <Text type="secondary" style={{ fontSize: 13 }}>{events.length} available</Text>
              </div>

              {events.length === 0 ? (
                <Text type="secondary">No events in this competition yet.</Text>
              ) : (
                <Row gutter={[16, 16]}>
                  {events.map((evt) => {
                    const joined = registeredEvents.has(evt.id);
                    const participants = eventsWithParticipants.get(evt.id) ?? [];
                    return (
                      <Col xs={24} key={evt.id}>
                        <Card size="small">
                          <Row gutter={[16, 16]} align="middle">
                            <Col xs={24} md={14}>
                              <Space direction="vertical" size={2}>
                                <Text strong style={{ fontSize: 15 }}>{evt.name}</Text>
                                <Space size={8}>
                                  <Tag style={{ fontSize: 11 }}>{evt.format}</Tag>
                                  <Tag
                                    color={evt.status === EventStatus.InProgress ? "green" : evt.status === EventStatus.Completed ? "purple" : "default"}
                                    style={{ fontSize: 11 }}
                                  >
                                    {evt.status}
                                  </Tag>
                                </Space>
                              </Space>
                            </Col>
                            <Col xs={12} md={5}>
                              <Space>
                                <TeamOutlined style={{ fontSize: 12 }} />
                                <Text style={{ fontSize: 12 }}>
                                  {participants.length}{evt.maxParticipants ? ` / ${evt.maxParticipants}` : ""} registered
                                </Text>
                              </Space>
                            </Col>
                            <Col xs={12} md={5} style={{ textAlign: "right" }}>
                              {joined ? (
                                <Tag color="green" icon={<TeamOutlined />}>Joined</Tag>
                              ) : (
                                <Button
                                  type="primary"
                                  size="small"
                                  loading={joiningId === evt.id}
                                  onClick={() => handleJoinEvent(evt.id)}
                                >
                                  Join
                                </Button>
                              )}
                            </Col>
                          </Row>

                          {participants.length > 0 && (
                            <Collapse
                              ghost
                              size="small"
                              style={{ marginTop: 8 }}
                              items={[{
                                key: "participants",
                                label: (
                                  <Space size={4}>
                                    <UserOutlined style={{ fontSize: 11 }} />
                                    <Text style={{ fontSize: 12 }}>
                                      {participants.length} {participants.length === 1 ? "Participant" : "Participants"}
                                    </Text>
                                  </Space>
                                ),
                                children: (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {participants.map((p) => (
                                      <Space key={p.id} size={4}>
                                        <Avatar size={22} style={{ fontSize: 10, fontWeight: 600 }}>
                                          {p.displayName.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Text style={{ fontSize: 12 }}>{p.displayName}</Text>
                                      </Space>
                                    ))}
                                  </div>
                                ),
                              }]}
                            />
                          )}
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </div>
          )}
        </Card>

        {currentMember && (
          <div style={{ textAlign: "center" }}>
            <Button type="link" icon={<RightOutlined />} onClick={() => router.push("/app")}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </Content>
    </Layout>
  );
}

export default function AcceptCompetitionInvitePage() {
  return (
    <AppProvider>
      <AcceptCompetitionInviteInner />
    </AppProvider>
  );
}
