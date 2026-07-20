"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Typography, Button, Spin, message, Layout, Result, Tag } from "antd";
import { AppProvider, useApp } from "@/lib/app-context";
import { InviteService } from "@/domain/services/invite.service";
import { OrganizationService, MemberService } from "@/domain/services/organization.service";
import type { Invite } from "@/domain/invite";

const { Content } = Layout;
const { Title, Text } = Typography;

function AcceptInviteInner() {
  const params = useParams();
  const router = useRouter();
  const { currentMember } = useApp();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const token = params.token as string;

  useEffect(() => {
    (async () => {
    const inviteSvc = new InviteService();
    const inv = await inviteSvc.getByToken(token);
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
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }
    const orgSvc = new OrganizationService();
    const memberSvc = new MemberService();
    const member = (await memberSvc.getByEmail(invite.email)) ?? currentMember;
    if (!member) { setError("Could not find your account"); return; }
    await orgSvc.addMember(invite.organizationId, member.id, invite.role as any);
    const inviteSvc = new InviteService();
    await inviteSvc.accept(invite.token, member.id);
    setAccepted(true);
    message.success("You've joined the organization!");
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
        <Result status="success" title="Welcome!" subTitle={`You joined the organization`} extra={<Button type="primary" onClick={() => router.push("/app")}>Go to Dashboard</Button>} />
      </Content>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Card style={{ width: 400, borderRadius: 16, textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📨</div>
          <Title level={3} style={{ margin: 0, fontSize: 20 }}>Organization Invite</Title>
          <Text style={{ color: "#64748B", display: "block", marginTop: 8 }}>
            You've been invited to join as <Tag>{invite?.role}</Tag>
          </Text>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {!currentMember && (
              <Text style={{ fontSize: 13, color: "#94A3B8" }}>
                You'll be automatically signed up with {invite?.email}
              </Text>
            )}
            <Button type="primary" size="large" block onClick={handleAccept}>
              Accept Invite
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

export default function AcceptInvitePage() {
  return (
    <AppProvider>
      <AcceptInviteInner />
    </AppProvider>
  );
}
