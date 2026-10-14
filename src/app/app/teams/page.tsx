"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Form, Input, message, Modal, Spin, Tag } from "antd";
import { CrownOutlined, EditOutlined, PlusOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import styles from "../workspace.module.css";

type Team = { id: string; name: string; avatarUrl?: string; canManage: boolean; members: { id: string; email?: string; display_name?: string; avatar_url?: string; captain: boolean }[] };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [form] = Form.useForm();
  const load = async () => { const response = await fetch("/api/me/teams"); const json = await response.json(); setTeams(json.data ?? []); setLoading(false); };
  useEffect(() => {
    let active = true;
    fetch("/api/me/teams").then((response) => response.json()).then((json) => {
      if (active) { setTeams(json.data ?? []); setLoading(false); }
    });
    return () => { active = false; };
  }, []);
  const create = async ({ name }: { name: string }) => { const response = await fetch("/api/me/teams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const json = await response.json(); if (!response.ok) return message.error(json.error); message.success("Team created"); setCreateOpen(false); form.resetFields(); await load(); };
  const update = async (body: Record<string,string>) => { if (!manageTeam) return; const response = await fetch("/api/me/teams", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: manageTeam.id, ...body }) }); const json = await response.json(); if (!response.ok) return message.error(json.error); message.success("Roster updated"); setManageTeam(json.data); await load(); };
  if (loading) return <div className={styles.loading}><Spin size="large" /></div>;
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Team hub</span><h1 className="page-title">Build the roster.</h1><p className="page-subtitle">Create teams, manage player membership, and keep every competition identity connected to real accounts.</p></div><div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create team</Button></div></header>
      {teams.length === 0 ? <div className={styles.emptyPortfolio}><div className={styles.emptyIcon}><TeamOutlined /></div><h2>Your first team starts here.</h2><p>Create a roster, then add players using the email on their CompetitionOS account.</p><Button type="primary" onClick={() => setCreateOpen(true)}>Create team</Button></div> : <section className={styles.teamGrid}>{teams.map((team) => <article key={team.id} className={styles.teamCard}><header><Avatar size={56} src={team.avatarUrl} icon={<TeamOutlined />} /><div><Tag color={team.canManage ? "lime" : "default"}>{team.canManage ? "Captain" : "Player"}</Tag><h2>{team.name}</h2></div>{team.canManage && <Button icon={<EditOutlined />} onClick={() => setManageTeam(team)}>Manage</Button>}</header><div className={styles.roster}>{team.members.slice(0,6).map((member) => <Avatar key={member.id} src={member.avatar_url}>{member.display_name?.charAt(0).toUpperCase() ?? "?"}</Avatar>)}{team.members.length > 6 && <Avatar>+{team.members.length - 6}</Avatar>}</div><footer><span>{team.members.length} player{team.members.length === 1 ? "" : "s"}</span><small>{team.canManage ? "You manage this roster" : "Managed by the team captain"}</small></footer></article>)}</section>}
      <Modal title="Create a team" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null}><p className={styles.modalIntro}>You will become the team captain and can add registered players.</p><Form form={form} layout="vertical" onFinish={create} requiredMark={false}><Form.Item label="Team name" name="name" rules={[{ required: true, min: 2, message: "Enter a team name" }]}><Input size="large" placeholder="e.g. Jozi Titans" /></Form.Item><Button type="primary" htmlType="submit" block size="large">Create team</Button></Form></Modal>
      <Modal title={manageTeam ? `Manage ${manageTeam.name}` : "Manage team"} open={!!manageTeam} onCancel={() => setManageTeam(null)} footer={null} width={600}>
        {manageTeam && <><Form layout="inline" onFinish={({ name }) => update({ action: "rename", name })} initialValues={{ name: manageTeam.name }} className={styles.renameForm}><Form.Item name="name" rules={[{ required: true }]}><Input size="large" /></Form.Item><Button htmlType="submit" size="large">Rename</Button></Form><div className="section-heading"><h3>Roster</h3></div><div className={styles.rosterList}>{manageTeam.members.map((member) => <div className={styles.rosterRow} key={member.id}><Avatar src={member.avatar_url}>{member.display_name?.charAt(0) ?? "?"}</Avatar><div><strong>{member.display_name ?? "Player"} {member.captain && <Tag icon={<CrownOutlined />} color="gold">Captain</Tag>}</strong><span>{member.email}</span></div>{!member.captain && <Button danger type="link" onClick={() => update({ action: "remove", memberId: member.id })}>Remove</Button>}</div>)}</div><Form layout="inline" onFinish={({ email }) => update({ action: "add", email })} className={styles.renameForm}><Form.Item name="email" rules={[{ required: true, type: "email" }]}><Input prefix={<UserAddOutlined />} placeholder="player@email.com" size="large" /></Form.Item><Button type="primary" htmlType="submit" size="large">Add player</Button></Form></>}
      </Modal>
    </>
  );
}
