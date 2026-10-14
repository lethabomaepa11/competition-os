"use client";

import { useEffect, useState } from "react";
import { Button, Form, Input, message, Modal, Select, Table, Tag, Typography } from "antd";
import { CopyOutlined, PlusOutlined, StopOutlined, TeamOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { MemberService, OrganizationService } from "@/domain/services/organization.service";
import { InviteService } from "@/domain/services/invite.service";
import { Role } from "@/domain/types";
import type { Invite } from "@/domain/invite";
import type { Member, OrganizationMember } from "@/domain/organization";
import { sendMailEvent } from "@/lib/mail/client";
import styles from "../command.module.css";

type Row = OrganizationMember & { member: Member | undefined };
const inviteColors: Record<string, string> = { pending: "orange", accepted: "green", revoked: "red", expired: "default" };

export default function MembersPage() {
  const { currentOrg, currentMember } = useApp();
  const [members, setMembers] = useState<Row[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [open, setOpen] = useState(false);
  const orgService = new OrganizationService();
  const memberService = new MemberService();
  const inviteService = new InviteService();
  const refresh = async () => { if (currentOrg) { const [people, pending] = await Promise.all([orgService.getMembers(currentOrg.id), inviteService.listByOrg(currentOrg.id)]); setMembers(people); setInvites(pending); } };
  useEffect(() => {
    if (!currentOrg) return;
    let active = true;
    Promise.all([new OrganizationService().getMembers(currentOrg.id), new InviteService().listByOrg(currentOrg.id)]).then(([people, pending]) => {
      if (active) { setMembers(people); setInvites(pending); }
    });
    return () => { active = false; };
  }, [currentOrg]);
  if (!currentOrg) return null;

  const invite = async (values: { email: string; displayName: string; role: Role }) => {
    if (!currentMember) return;
    const existingMember = await memberService.getByEmail(values.email);
    if (existingMember && (await orgService.getMembers(currentOrg.id)).some((item) => item.memberId === existingMember.id)) { message.warning("This person is already a member"); return; }
    const record = await inviteService.create(currentOrg.id, values.email, values.role, currentMember.id);
    sendMailEvent({ kind: "organization_invite", to: [{ email: values.email, name: values.displayName }], actionUrl: `${window.location.origin}/invite/${record.token}`, params: { organizationName: currentOrg.name, role: values.role, inviterName: currentMember.displayName, actionLabel: "Accept invite" } });
    message.success("Invitation sent"); setOpen(false); await refresh();
  };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">People and access</span><h1 className="page-title">Build the crew.</h1><p className="page-subtitle">Give operators, officials, moderators, and members the right access for every competition day.</p></div><div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Invite member</Button></div></header>
      <div className={styles.peopleSummary}><div><TeamOutlined /><span><b>{members.length}</b> active members</span></div><div><CopyOutlined /><span><b>{invites.filter((item) => item.status === "pending").length}</b> pending invites</span></div></div>
      <div className="section-heading"><Typography.Title level={3}>Accredited team</Typography.Title></div>
      <Table dataSource={members} rowKey="id" pagination={false} scroll={{ x: 680 }} columns={[
        { title: "Person", key: "person", render: (_: unknown, row: Row) => <div className={styles.personCell}><span>{row.member?.displayName?.charAt(0).toUpperCase() ?? "?"}</span><div><strong>{row.member?.displayName ?? "Unknown"}</strong><small>{row.member?.email ?? "—"}</small></div></div> },
        { title: "Role", dataIndex: "role", key: "role", render: (role: Role) => <Tag>{role}</Tag> },
        { title: "Joined", dataIndex: "joinedAt", key: "joinedAt", render: (date: string) => new Date(date).toLocaleDateString() },
      ]} />
      {invites.length > 0 && <><div className="section-heading"><Typography.Title level={3}>Invitations</Typography.Title></div><Table dataSource={invites} rowKey="id" pagination={false} scroll={{ x: 700 }} columns={[
        { title: "Email", dataIndex: "email", key: "email" },
        { title: "Role", dataIndex: "role", key: "role", render: (role: string) => <Tag>{role}</Tag> },
        { title: "Status", dataIndex: "status", key: "status", render: (status: string) => <Tag color={inviteColors[status]}>{status}</Tag> },
        { title: "Invite link", key: "link", render: (_: unknown, record: Invite) => record.status === "pending" ? <Typography.Text copyable={{ text: `${window.location.origin}/invite/${record.token}` }}>{record.token.slice(0, 12)}…</Typography.Text> : "—" },
        { title: "", key: "action", render: (_: unknown, record: Invite) => record.status === "pending" ? <Button size="small" danger icon={<StopOutlined />} onClick={async () => { await inviteService.revoke(record.id); await refresh(); }}>Revoke</Button> : null },
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
