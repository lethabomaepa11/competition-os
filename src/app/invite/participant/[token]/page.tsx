"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Typography, Button, Spin, message, Layout, Result, Tag } from "antd";
import { AppProvider, useApp } from "@/lib/app-context";
import { ParticipantInviteService } from "@/domain/services/participant-invite.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { MemberService } from "@/domain/services/organization.service";
import type { ParticipantInvite } from "@/domain/participant-invite";
import { sendMailEvent } from "@/lib/mail/client";

const { Content } = Layout;
const { Title, Text } = Typography;

function AcceptParticipantInviteInner() {
  const params = useParams();
  const router = useRouter();
  const { currentMember } = useApp();
  const [invite, setInvite] = useState<ParticipantInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const token = params.token as string;

  useEffect(() => {
    (async () => {
      const svc = new ParticipantInviteService();
      const inv = await svc.getByToken(token);
      if (!inv) {
        setError("Invite not found");
      } else if (inv.status !== "pending") {
        setError(`Invite is ${inv.status}`);
      } else {
        setInvite(inv);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!invite) return;

    if (!currentMember) {
      const password = crypto.randomUUID();
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email, password, displayName: invite.displayName }),
      });
      if (!regRes.ok) {
        const json = await regRes.json();
        setError(json.error ?? "Could not create account");
        return;
      }
      const logRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invite.email, password }),
      });
      if (!logRes.ok) {
        router.push(`/login?redirect=/invite/participant/${token}`);
        return;
      }
      window.location.reload();
      return;
    }

    const memberSvc = new MemberService();
    const member = (await memberSvc.getByEmail(invite.email)) ?? currentMember;
    if (!member) { setError("Could not find your account"); return; }

    const regSvc = new RegistrationService();
    if (await regSvc.isRegistered(invite.eventId, member.id)) {
      message.warning("Already registered for this event");
      setAccepted(true);
      return;
    }

    await regSvc.register(invite.eventId, member.id, invite.displayName);
    const inviteSvc = new ParticipantInviteService();
    await inviteSvc.accept(invite.token);
    sendMailEvent({
      kind: "participant_registered",
      to: [{ email: member.email, name: member.displayName }],
      params: {
        eventName: "your event",
        participantName: invite.displayName,
        actionLabel: "Open dashboard",
      },
      actionUrl: `${window.location.origin}/app`,
    });
    setAccepted(true);
    message.success("You're registered!");
  };

  if (loading) return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 100 }} />;

  if (error) {
    return (
      <Content style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#F8FAFC" }}>
        <Result status="error" title="Invalid Invite" subTitle={error} extra={<Button onClick={() => router.push("/")}>Go Home</Button>} />
      </Content>
    );
  }

  if (accepted) {
    return (
      <Content style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#F8FAFC" }}>
        <Result status="success" title="You're In!" subTitle="You've been registered for the event" extra={<Button type="primary" onClick={() => router.push("/app")}>Go to Dashboard</Button>} />
      </Content>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Card style={{ width: 400, borderRadius: 16, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎮</div>
          <Title level={3} style={{ margin: 0, fontSize: 20 }}>Event Invitation</Title>
          <Text style={{ color: "#64748B", display: "block", marginTop: 8 }}>
            You've been invited to compete as <strong>{invite?.displayName}</strong>
          </Text>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {!currentMember && (
              <Text style={{ fontSize: 13, color: "#94A3B8" }}>
                You'll be automatically signed up with {invite?.email}
              </Text>
            )}
            <Button type="primary" size="large" block onClick={handleAccept}>
              Accept & Register
            </Button>
            <Button block onClick={() => router.push("/")}>
              Decline
            </Button>
          </div>
        </Card>
      </Content>
    </Layout>
  );
}

export default function AcceptParticipantInvitePage() {
  return (
    <AppProvider>
      <AcceptParticipantInviteInner />
    </AppProvider>
  );
}
