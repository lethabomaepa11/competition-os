"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Result, Tag, message } from "antd";
import { LoginOutlined, TeamOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { AuthShell } from "@/components/common/auth-shell";
import { categoryLabel, teamTypeLabel } from "@/domain/categories";
import { PageLoader } from "@/components/common/page-loader";

type Invite = { teamName: string; category: string; teamType: string; status: string; expiresAt: string };

function TeamInviteContent() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { currentMember, ready } = useApp();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/team-invites/${token}`).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setInvite(json.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Invite not found")).finally(() => setLoading(false));
  }, [token]);

  const accept = async () => {
    if (!currentMember) { router.push(`/login?redirect=/invite/team/${token}`); return; }
    setJoining(true);
    const response = await fetch(`/api/team-invites/${token}`, { method: "POST" });
    const json = await response.json();
    setJoining(false);
    if (!response.ok) { message.error(json.error); return; }
    message.success(`You joined ${invite?.teamName}`);
    router.push("/app/teams");
  };

  if (loading || !ready) return <PageLoader className="loading-screen" label="Verifying team invitation" />;
  if (error || !invite || invite.status !== "pending" || new Date(invite.expiresAt) <= new Date()) return <Result status="error" title="Invite unavailable" subTitle={error || "This team invite has expired or has already been used."} extra={<Button onClick={() => router.push("/")}>Return home</Button>} />;

  return (
    <AuthShell eyebrow="Team invitation" title={`Join ${invite.teamName}.`} description="Accept the invitation to become part of the official roster. Your player account will stay connected to the team's competitions and results." fallback="/">
      <div className="auth-card__heading"><TeamOutlined style={{ fontSize: 30 }} /><h1>Roster invitation</h1><p>You have been invited to an official CompetitionOS team.</p></div>
      <div style={{ display: "flex", gap: 8, margin: "24px 0" }}><Tag color="blue">{categoryLabel(invite.category)}</Tag><Tag>{teamTypeLabel(invite.teamType)}</Tag></div>
      <Button type="primary" size="large" block icon={<LoginOutlined />} loading={joining} onClick={accept}>{currentMember ? "Accept and join team" : "Sign in to accept"}</Button>
    </AuthShell>
  );
}

export default function TeamInvitePage() { return <AppProvider><TeamInviteContent /></AppProvider>; }
