"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Button, Card, Descriptions, Result, Tag } from "antd";
import { ArrowRightOutlined, CheckCircleOutlined, MailOutlined, SafetyCertificateOutlined, TeamOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { AuthShell } from "@/components/common/auth-shell";
import { PageLoader } from "@/components/common/page-loader";

type OrganizationInvite = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  inviterName?: string;
};

function OrganizationInviteContent() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { currentMember, ready } = useApp();
  const [invite, setInvite] = useState<OrganizationInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [acceptError, setAcceptError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/organization-invites/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load the invitation");
        setInvite(json.data);
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load the invitation"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  const loginPath = `/login?redirect=${encodeURIComponent(`/invite/${token}`)}`;
  const emailMatches = !!currentMember?.email && !!invite?.email && currentMember.email.toLowerCase() === invite.email.toLowerCase();

  const accept = async () => {
    if (!currentMember) { router.push(loginPath); return; }
    if (!emailMatches) return;
    setAccepting(true);
    try {
      const response = await fetch(`/api/organization-invites/${encodeURIComponent(token)}`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not accept the invitation");
      router.push(`/o/${invite?.organizationSlug}`);
      router.refresh();
    } catch (reason) {
      setAcceptError(reason instanceof Error ? reason.message : "Could not accept the invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || !ready) return <PageLoader className="loading-screen" label="Verifying organization invitation" />;
  if (error || !invite) return <AuthShell eyebrow="Organization invitation" title="Invitation unavailable." description="We could not verify this invitation. Ask the organization administrator to send a new link."><Result status="error" title="We couldn't open this invitation" subTitle={error || "This invitation may have been revoked."} extra={<Button type="primary" onClick={() => router.push("/")}>Return to CompetitionOS</Button>} /></AuthShell>;
  if (invite.status !== "pending") return <AuthShell eyebrow="Organization invitation" title={invite.status === "accepted" ? "You’re already on the roster." : "This invitation is closed."} description={`Invitation status for ${invite.organizationName}.`}><Result status={invite.status === "accepted" ? "success" : "info"} title={invite.status === "accepted" ? "Invitation already accepted" : `Invitation ${invite.status}`} subTitle={invite.status === "accepted" ? `Your account has already joined ${invite.organizationName}.` : "Ask the organization administrator for a new invitation."} extra={<Button type="primary" onClick={() => router.push(invite.status === "accepted" ? `/o/${invite.organizationSlug}` : "/")}>{invite.status === "accepted" ? "Open organization" : "Return to CompetitionOS"}</Button>} /></AuthShell>;

  return (
    <AuthShell eyebrow="Organization invitation" title="Your next competition starts here." description="Join the people running the competition and get access to the organization workspace, schedule, and tools assigned to your role.">
      <div className="auth-card__heading">
        <span className="eyebrow">Secure invitation</span>
        <h1>Join the organization.</h1>
        <p>{invite.inviterName ? `${invite.inviterName} invited you to join.` : "You’ve been invited to join this organization."}</p>
      </div>
      <Card variant="outlined" style={{ margin: "24px 0", borderColor: "#d6e4ff", background: "#f7faff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 12, background: "#eaf2ff", color: "#155eef", fontSize: 22 }}><TeamOutlined /></span>
          <div><span style={{ color: "#52627a", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Organization</span><div style={{ color: "#14243a", fontSize: 20, fontWeight: 700 }}>{invite.organizationName}</div></div>
        </div>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Your access"><Tag color="blue" style={{ textTransform: "capitalize" }}>{invite.role}</Tag></Descriptions.Item>
          <Descriptions.Item label="Invited email"><span style={{ wordBreak: "break-word" }}><MailOutlined style={{ color: "#155eef", marginRight: 8 }} />{invite.email}</span></Descriptions.Item>
        </Descriptions>
      </Card>

      {acceptError && <Alert showIcon type="error" style={{ marginBottom: 16 }} title="We couldn’t accept this invitation" description={acceptError} />}
      {currentMember && !emailMatches && <Alert showIcon type="info" style={{ marginBottom: 16 }} title="Switch to the invited account" description={`This invitation is for ${invite.email}. You are signed in as ${currentMember.email ?? "another account"}; accept is available only to the invited email.`} action={<Button size="small" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push(loginPath); }}>Switch account</Button>} />}

      {!currentMember ? <>
        <Button type="primary" size="large" block icon={<ArrowRightOutlined />} onClick={() => router.push(loginPath)}>Sign in to review invitation</Button>
        <Button size="large" block style={{ marginTop: 10 }} onClick={() => router.push(`/register?redirect=${encodeURIComponent(`/invite/${token}`)}`)}>Create an account</Button>
      </> : <Button type="primary" size="large" block icon={<CheckCircleOutlined />} loading={accepting} disabled={!emailMatches} onClick={accept}>Accept and join {invite.organizationName}</Button>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", color: "#697a91", fontSize: 12, marginTop: 20 }}><SafetyCertificateOutlined style={{ color: "#155eef" }} /> This secure link can only be accepted by the invited email address.</div>
    </AuthShell>
  );
}

export default function AcceptInvitePage() {
  return <AppProvider><OrganizationInviteContent /></AppProvider>;
}
