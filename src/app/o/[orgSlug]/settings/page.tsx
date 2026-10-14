"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Breadcrumb, Button, Card, Col, Form, Input, message, Modal, Row, Space, Tag, Typography } from "antd";
import { AuditOutlined, SafetyCertificateOutlined, TeamOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";
import styles from "../command.module.css";
import { canManageCompetition } from "@/lib/permissions";

export default function SettingsPage() {
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [authorized, setAuthorized] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [memberCounts, setMemberCounts] = useState({ total: 0, admins: 0, owners: 0 });
  useEffect(() => {
    if (currentOrg && currentMember) {
      void canManageCompetition(currentMember.id, currentOrg.id).then(setAuthorized);
      void new OrganizationService().getMembers(currentOrg.id).then((members) => setMemberCounts({
        total: members.length,
        admins: members.filter((member) => member.role === "admin").length,
        owners: members.filter((member) => member.role === "owner").length,
      })).catch(() => setMemberCounts({ total: 0, admins: 0, owners: 0 }));
    }
  }, [currentOrg, currentMember]);
  if (!currentOrg) return null;
  const update = async (values: { name: string }) => { await new OrganizationService().update(currentOrg.id, values); message.success("Organization identity updated"); };
  const deleteOrganization = async () => {
    if (!authorized || confirmName.trim() !== currentOrg.name) return;
    setDeleting(true);
    try {
      await new OrganizationService().Delete(currentOrg.id);
      message.success("Organization deleted");
      router.push("/");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not delete organization");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      <Breadcrumb items={[{ title: <Link href={`/o/${currentOrg.slug}`}>{currentOrg.name}</Link> }, { title: "Settings" }]} />
      <header className="page-header"><div><span className="eyebrow">Organization configuration</span><h1 className="page-title">Identity and control.</h1><p className="page-subtitle">Manage the name operators and audiences see across competition and public surfaces.</p></div></header>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}><Card><Space><TeamOutlined /><Typography.Text type="secondary">Members</Typography.Text></Space><Typography.Title level={2} style={{ margin: "8px 0 0" }}>{memberCounts.total}</Typography.Title><Typography.Text type="secondary">{memberCounts.owners} owners · {memberCounts.admins} admins</Typography.Text></Card></Col>
        <Col xs={24} md={8}><Card><Space><TeamOutlined /><Typography.Text type="secondary">Access management</Typography.Text></Space><Typography.Title level={4}>Roles and invitations</Typography.Title><Link href={`/o/${currentOrg.slug}/members`}>Review membership →</Link></Card></Col>
        <Col xs={24} md={8}><Card><Space><AuditOutlined /><Typography.Text type="secondary">Organization history</Typography.Text></Space><Typography.Title level={4}>Audit trail</Typography.Title><Link href={`/o/${currentOrg.slug}/audit`}>Review recent changes →</Link></Card></Col>
      </Row>
      <section className={styles.settingsGrid}>
        <div className={styles.settingsCard}><span className="eyebrow">Organization identity</span><h2>Workspace details</h2>{authorized ? <Form layout="vertical" onFinish={update} initialValues={{ name: currentOrg.name }} requiredMark={false}><Form.Item label="Organization name" name="name" rules={[{ required: true, message: "Enter an organization name" }]}><Input size="large" /></Form.Item><Form.Item label="Permanent workspace slug"><Input value={currentOrg.slug} disabled size="large" /></Form.Item><Button type="primary" htmlType="submit" size="large">Save changes</Button></Form> : <Alert type="info" title="Owner or admin access required" description="Ask an organization owner or admin to update workspace settings." showIcon />}</div>
        <aside className={styles.governanceCard}><SafetyCertificateOutlined /><span>Protected identity</span><h3>The workspace slug is permanent.</h3><p>This keeps public competition links and operator bookmarks stable while the display name evolves.</p><Tag color="blue">{authorized ? "Owner or admin" : "Read only"}</Tag></aside>
      </section>
      {authorized && <section className={styles.settingsCard} style={{ marginTop: 24, borderColor: "#d92d20" }}>
        <span className="eyebrow" style={{ color: "#b42318" }}>Danger zone</span><h2>Delete this organization</h2><p>This permanently removes the workspace. Type <strong>{currentOrg.name}</strong> to enable deletion.</p>
        <Button danger onClick={() => { setConfirmName(""); setDeleteOpen(true); }}>Delete organization</Button>
      </section>}
      <Modal title="Delete organization" open={deleteOpen} onCancel={() => setDeleteOpen(false)} onOk={deleteOrganization} okText="Delete organization" okButtonProps={{ danger: true, disabled: confirmName.trim() !== currentOrg.name, loading: deleting }}>
        <p>Workspace deletion is permanent. Enter the organization name exactly to continue.</p>
        <Input aria-label="Confirm organization name" value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" />
      </Modal>
    </>
  );
}
