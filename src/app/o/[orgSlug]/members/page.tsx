"use client";

import { useEffect, useState } from "react";
import { Table, Typography, Tag, Button, Modal, Form, Input, Select, message, Space, Tooltip } from "antd";
import { PlusOutlined, LinkOutlined, CopyOutlined, StopOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { OrganizationService, MemberService } from "@/domain/services/organization.service";
import { InviteService } from "@/domain/services/invite.service";
import { Role } from "@/domain/types";
import type { Invite } from "@/domain/invite";
import type { OrganizationMember, Member } from "@/domain/organization";
import { sendMailEvent } from "@/lib/mail/client";

type OrganizationMemberWithMember = OrganizationMember & { member: Member | undefined };

const { Title, Text } = Typography;

export default function MembersPage() {
  const { currentOrg, currentMember } = useApp();
  const [members, setMembers] = useState<OrganizationMemberWithMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const orgSvc = new OrganizationService();
  const memberSvc = new MemberService();
  const inviteSvc = new InviteService();

  const refresh = async () => {
    if (!currentOrg) return;
    setMembers(await orgSvc.getMembers(currentOrg.id));
    setInvites(await inviteSvc.listByOrg(currentOrg.id));
  };

  useEffect(() => { refresh(); }, [currentOrg]);

  const handleInvite = async (values: { email: string; displayName: string; role: Role }) => {
    if (!currentOrg || !currentMember) return;
    const member = await memberSvc.getByEmail(values.email);
    if (member) {
      const existing = (await orgSvc.getMembers(currentOrg.id)).find((m) => m.memberId === member.id);
      if (existing) {
        message.warning("Already a member");
        return;
      }
    }
    const invite = await inviteSvc.create(currentOrg.id, values.email, values.role, currentMember.id);
    sendMailEvent({
      kind: "organization_invite",
      to: [{ email: values.email, name: values.displayName }],
      actionUrl: `${window.location.origin}/invite/${invite.token}`,
      params: {
        organizationName: currentOrg.name,
        role: values.role,
        inviterName: currentMember.displayName,
        actionLabel: "Accept invite",
      },
    });
    message.success("Invite sent!");
    setInviteOpen(false);
    await refresh();
  };

  if (!currentOrg) return null;

  const statusColors: Record<string, string> = {
    pending: "orange",
    accepted: "green",
    revoked: "red",
    expired: "default",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Members</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviteOpen(true)}>
          Invite Member
        </Button>
      </div>

      <Table
        dataSource={members}
        rowKey="id"
        pagination={false}
        style={{ marginBottom: 32 }}
        columns={[
          { title: "Name", key: "name", render: (_: unknown, r: OrganizationMemberWithMember) => r.member?.displayName ?? "Unknown" },
          { title: "Email", key: "email", render: (_: unknown, r: OrganizationMemberWithMember) => r.member?.email ?? "-" },
          { title: "Role", dataIndex: "role", key: "role", render: (r: Role) => <Tag>{r}</Tag> },
          { title: "Joined", dataIndex: "joinedAt", key: "joinedAt", render: (d: string) => new Date(d).toLocaleDateString() },
        ]}
      />

      {invites.length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>Pending Invites</Title>
          <Table
            dataSource={invites}
            rowKey="id"
            pagination={false}
            columns={[
              { title: "Email", dataIndex: "email", key: "email" },
              { title: "Role", dataIndex: "role", key: "role", render: (r: string) => <Tag>{r}</Tag> },
              {
                title: "Status", dataIndex: "status", key: "status",
                render: (s: string) => <Tag color={statusColors[s]}>{s}</Tag>,
              },
              {
                title: "Invite Link", key: "link",
                render: (_: unknown, record: Invite) => {
                  if (record.status !== "pending") return "-";
                  const link = `${window.location.origin}/invite/${record.token}`;
                  return (
                    <Space>
                      <Text copyable={{ text: link, icon: [<CopyOutlined key="copy" />, <CopyOutlined key="copied" />] }} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", fontSize: 13 }}>
                        {link}
                      </Text>
                    </Space>
                  );
                },
              },
              {
                title: "Actions", key: "actions",
                render: (_: unknown, record: Invite) => (
                  record.status === "pending" ? (
                    <Button size="small" danger icon={<StopOutlined />} onClick={async () => { await inviteSvc.revoke(record.id); await refresh(); }}>
                      Revoke
                    </Button>
                  ) : null
                ),
              },
            ]}
          />
        </>
      )}

      <Modal title="Invite Member" open={inviteOpen} onCancel={() => setInviteOpen(false)} footer={null}>
        <Form layout="vertical" onFinish={handleInvite} requiredMark={false}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: "email", message: "Valid email required" }]}>
            <Input placeholder="email@example.com" size="large" />
          </Form.Item>
          <Form.Item label="Display Name" name="displayName" rules={[{ required: true }]}>
            <Input placeholder="Their name" size="large" />
          </Form.Item>
          <Form.Item label="Role" name="role" initialValue={Role.Member}>
            <Select size="large">
              <Select.Option value={Role.Admin}>Admin</Select.Option>
              <Select.Option value={Role.Moderator}>Moderator</Select.Option>
              <Select.Option value={Role.Referee}>Referee</Select.Option>
              <Select.Option value={Role.Member}>Member</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block>
              Send Invite
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
