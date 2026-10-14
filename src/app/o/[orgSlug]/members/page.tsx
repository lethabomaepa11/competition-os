"use client";

import { useEffect, useState } from "react";
import { Button, Form, Input, message, Modal, Select, Tag, Typography } from "antd";
import { CopyOutlined, PlusOutlined, StopOutlined, TeamOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";
import { Role } from "@/domain/types";
import type { Invite } from "@/domain/invite";
import type { Member, OrganizationMember } from "@/domain/organization";
import styles from "../command.module.css";
import { SystemTable } from "@/components/common/system-table";

type Row = OrganizationMember & { member: Member | undefined };
const inviteColors: Record<string, string> = { pending: "blue", accepted: "blue", revoked: "default", expired: "default" };

export default function MembersPage() {
  const { currentOrg, currentMember } = useApp();
  const [members, setMembers] = useState<Row[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const refresh = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const [people, inviteResponse] = await Promise.all([
      new OrganizationService().getMembers(currentOrg.id),
      fetch(`/api/organizations/${currentOrg.id}/invites`),
    ]);
    const pending = await inviteResponse.json();
    if (!inviteResponse.ok) throw new Error(pending.error ?? "Could not load invitations");
    setMembers(people);
    setInvites(pending.data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    if (!currentOrg) return;
    let active = true;
    Promise.all([new OrganizationService().getMembers(currentOrg.id), fetch(`/api/organizations/${currentOrg.id}/invites`).then((response) => response.json())]).then(([people, pending]) => {
      if (active) { setMembers(people); setInvites(pending.data ?? []); setLoading(false); }
    }).catch((error) => { if (active) message.error(error instanceof Error ? error.message : "Could not load organization members"); });
    return () => { active = false; };
  }, [currentOrg]);
  if (!currentOrg) return null;

  const invite = async (values: { email: string; displayName: string; role: Role }) => {
    if (!currentMember) return;
    const response = await fetch(`/api/organizations/${currentOrg.id}/invites`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    const json = await response.json();
    if (!response.ok) { message.error(json.error ?? "Could not create invitation"); return; }
    message.success(json.data.emailSent ? "Invitation sent" : "Invitation created. Copy the link while email delivery is unavailable.");
    setOpen(false);
    await refresh();
  };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">People and access</span><h1 className="page-title">Build the crew.</h1><p className="page-subtitle">Give operators, officials, moderators, and members the right access for every competition day.</p></div><div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Invite member</Button></div></header>
      <div className={styles.peopleSummary}><div><TeamOutlined /><span><b>{members.length}</b> active members</span></div><div><CopyOutlined /><span><b>{invites.filter((item) => item.status === "pending").length}</b> pending invites</span></div></div>
      <div className="section-heading"><Typography.Title level={3}>Accredited team</Typography.Title></div>
      <SystemTable dataSource={members} rowKey="id" loading={loading} searchText={(row) => `${row.member?.displayName ?? ""} ${row.member?.email ?? ""} ${row.role}`} scroll={{ x: 680 }} columns={[
        { title: "Person", key: "person", render: (_: unknown, row: Row) => <div className={styles.personCell}><span>{row.member?.displayName?.charAt(0).toUpperCase() ?? "?"}</span><div><strong>{row.member?.displayName ?? "Unknown"}</strong><small>{row.member?.email ?? "—"}</small></div></div> },
        { title: "Role", dataIndex: "role", key: "role", render: (role: Role) => <Tag>{role}</Tag> },
        { title: "Joined", dataIndex: "joinedAt", key: "joinedAt", render: (date: string) => new Date(date).toLocaleDateString() },
      ]} />
      {invites.length > 0 && <><div className="section-heading"><Typography.Title level={3}>Invitations</Typography.Title></div><SystemTable dataSource={invites} rowKey="id" loading={loading} searchText={(row) => `${row.email} ${row.role} ${row.status}`} scroll={{ x: 700 }} columns={[
        { title: "Email", dataIndex: "email", key: "email" },
        { title: "Role", dataIndex: "role", key: "role", render: (role: string) => <Tag>{role}</Tag> },
        { title: "Status", dataIndex: "status", key: "status", render: (status: string) => <Tag color={inviteColors[status]}>{status}</Tag> },
        { title: "Invite link", key: "link", render: (_: unknown, record: Invite) => record.status === "pending" ? <Typography.Text copyable={{ text: `${window.location.origin}/invite/${record.token}` }}>{record.token.slice(0, 12)}…</Typography.Text> : "—" },
        { title: "", key: "action", render: (_: unknown, record: Invite) => record.status === "pending" ? <Button size="small" icon={<StopOutlined />} onClick={async () => { const response = await fetch(`/api/organizations/${currentOrg.id}/invites/${record.id}`, { method: "DELETE" }); const json = await response.json(); if (!response.ok) { message.error(json.error ?? "Could not revoke invitation"); return; } await refresh(); message.success("Invitation revoked"); }}>Revoke</Button> : null },
      ]} /></>}

      <Modal title="Invite to the organization" open={open} onCancel={() => setOpen(false)} footer={null} width={520}>
        <p className={styles.modalCopy}>Choose a role based on what this person needs to operate.</p>
        <Form layout="vertical" onFinish={invite} requiredMark={false}>
          <Form.Item label="Email address" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email address" }]}><Input placeholder="official@league.com" size="large" /></Form.Item>
          <Form.Item label="Display name" name="displayName" rules={[{ required: true, message: "Enter their name" }]}><Input placeholder="Their name" size="large" /></Form.Item>
          <Form.Item label="Access role" name="role" initialValue={Role.Member}><Select size="large" options={[Role.Admin,Role.Moderator,Role.Referee,Role.Member].map((role) => ({ value: role, label: role.charAt(0).toUpperCase() + role.slice(1) }))} /></Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>Send secure invitation</Button>
        </Form>
      </Modal>
    </>
  );
}
