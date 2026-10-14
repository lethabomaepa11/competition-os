"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Divider, Form, Input, message, Modal, Select, Tag } from "antd";
import { CopyOutlined, CrownOutlined, EditOutlined, LinkOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import { SPORT_CATEGORIES, TEAM_TYPES, categoryLabel, teamTypeLabel } from "@/domain/categories";
import styles from "../workspace.module.css";
import { PageLoader } from "@/components/common/page-loader";

type Team = { id: string; name: string; avatarUrl?: string; category: string; teamType: string; description: string; canManage: boolean; members: { id: string; email?: string; display_name?: string; avatar_url?: string; captain: boolean }[] };
type TeamValues = { name: string; category: string; teamType: string; description?: string };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const load = async () => {
    try { const response = await fetch("/api/me/teams"); const json = await response.json(); if (!response.ok) throw new Error(json.error); setTeams(json.data ?? []); }
    catch (error) { message.error(error instanceof Error ? error.message : "Could not load your teams"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/me/teams").then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      if (active) setTeams(json.data ?? []);
    }).catch((error) => { if (active) message.error(error instanceof Error ? error.message : "Could not load your teams"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = async (body: Record<string, string | undefined>) => {
    if (!manageTeam) return;
    const response = await fetch("/api/me/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: manageTeam.id, ...body }) });
    const json = await response.json();
    if (!response.ok) return message.error(json.error);
    message.success("Team updated"); setManageTeam(json.data); await load();
  };

  const invite = async ({ email }: { email?: string }) => {
    if (!manageTeam) return;
    const response = await fetch("/api/me/teams/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: manageTeam.id, email }) });
    const json = await response.json();
    if (!response.ok) return message.error(json.error);
    setInviteUrl(json.data.shareUrl); message.success(email ? "Invitation sent and link created" : "Share link created");
  };

  if (loading) return <PageLoader className={styles.loading} label="Loading team and roster" />;
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Club administration</span><h1 className="page-title">Team and roster</h1><p className="page-subtitle">Maintain the team created during onboarding, invite players, and register for eligible competitions.</p></div></header>
      {teams.length === 0 ? <div className={styles.emptyPortfolio}><div className={styles.emptyIcon}><TeamOutlined /></div><h2>Your team is being prepared.</h2><p>Refresh the page in a moment. If this continues, contact your CompetitionOS administrator.</p></div> : <section className={styles.teamGrid}>{teams.map((team) => <article key={team.id} className={styles.teamCard}><header><Avatar size={56} src={team.avatarUrl} icon={<TeamOutlined />} /><div><div className={styles.teamTags}><Tag color="blue">{categoryLabel(team.category)}</Tag><Tag>{teamTypeLabel(team.teamType)}</Tag></div><h2>{team.name}</h2></div>{team.canManage && <Button icon={<EditOutlined />} onClick={() => { setManageTeam(team); setInviteUrl(""); }}>Manage</Button>}</header><p className={styles.teamDescription}>{team.description || "Official competition roster"}</p><div className={styles.roster}>{team.members.slice(0, 6).map((member) => <Avatar key={member.id} src={member.avatar_url}>{member.display_name?.charAt(0).toUpperCase() ?? "?"}</Avatar>)}{team.members.length > 6 && <Avatar>+{team.members.length - 6}</Avatar>}</div><footer><span>{team.members.length} player{team.members.length === 1 ? "" : "s"}</span><small>{team.canManage ? "Captain access" : "Player access"}</small></footer></article>)}</section>}

      <Modal title={manageTeam ? `Manage ${manageTeam.name}` : "Manage team"} open={!!manageTeam} onCancel={() => setManageTeam(null)} footer={null} width={680}>
        {manageTeam && <>
          <Form layout="vertical" onFinish={(values: TeamValues) => update({ action: "update", ...values })} initialValues={{ name: manageTeam.name, category: manageTeam.category, teamType: manageTeam.teamType, description: manageTeam.description }} requiredMark={false}>
            <Form.Item label="Team name" name="name" rules={[{ required: true }]}><Input size="large" /></Form.Item>
            <div className={styles.formPair}><Form.Item label="Category" name="category"><Select size="large" options={SPORT_CATEGORIES.map((item) => ({ ...item }))} /></Form.Item><Form.Item label="Team type" name="teamType"><Select size="large" options={TEAM_TYPES.map((item) => ({ ...item }))} /></Form.Item></div>
            <Form.Item label="Description" name="description"><Input.TextArea rows={2} maxLength={500} /></Form.Item><Button htmlType="submit">Save team identity</Button>
          </Form>
          <Divider />
          <div className="section-heading"><div><h3>Roster</h3><p>Add an existing account immediately or send an invitation.</p></div></div>
          <div className={styles.rosterList}>{manageTeam.members.map((member) => <div className={styles.rosterRow} key={member.id}><Avatar src={member.avatar_url}>{member.display_name?.charAt(0) ?? "?"}</Avatar><div><strong>{member.display_name ?? "Player"} {member.captain && <Tag icon={<CrownOutlined />} color="gold">Captain</Tag>}</strong><span>{member.email}</span></div>{!member.captain && <Button danger type="link" onClick={() => update({ action: "remove", memberId: member.id })}>Remove</Button>}</div>)}</div>
          <Form layout="inline" onFinish={({ email }) => update({ action: "add", email })} className={styles.renameForm}><Form.Item name="email" rules={[{ required: true, type: "email" }]}><Input prefix={<UserAddOutlined />} placeholder="player@email.com" size="large" /></Form.Item><Button type="primary" htmlType="submit" size="large">Add existing player</Button></Form>
          <Divider />
          <div className="section-heading"><div><h3>Invite link</h3><p>Create a private link for email or a team WhatsApp group. Links expire after 14 days.</p></div></div>
          <Form layout="inline" onFinish={invite} className={styles.renameForm}><Form.Item name="email" rules={[{ type: "email" }]}><Input prefix={<LinkOutlined />} placeholder="Optional player email" size="large" /></Form.Item><Button htmlType="submit" size="large">Create invite</Button></Form>
          {inviteUrl && <div className={styles.inviteLink}><code>{inviteUrl}</code><Button icon={<CopyOutlined />} onClick={async () => { await navigator.clipboard.writeText(inviteUrl); message.success("Invite link copied"); }}>Copy</Button></div>}
        </>}
      </Modal>
    </>
  );
}
