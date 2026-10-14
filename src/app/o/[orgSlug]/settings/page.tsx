"use client";

import { Button, Form, Input, message } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";
import styles from "../command.module.css";

export default function SettingsPage() {
  const { currentOrg } = useApp();
  if (!currentOrg) return null;
  const update = async (values: { name: string }) => { await new OrganizationService().update(currentOrg.id, values); message.success("Organization identity updated"); };
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Organization configuration</span><h1 className="page-title">Identity and control.</h1><p className="page-subtitle">Manage the name operators and audiences see across competition and public surfaces.</p></div></header>
      <section className={styles.settingsGrid}>
        <div className={styles.settingsCard}><span className="eyebrow">Organization identity</span><h2>Workspace details</h2><Form layout="vertical" onFinish={update} initialValues={{ name: currentOrg.name }} requiredMark={false}><Form.Item label="Organization name" name="name" rules={[{ required: true, message: "Enter an organization name" }]}><Input size="large" /></Form.Item><Form.Item label="Permanent workspace slug"><Input value={currentOrg.slug} disabled size="large" /></Form.Item><Button type="primary" htmlType="submit" size="large">Save changes</Button></Form></div>
        <aside className={styles.governanceCard}><SafetyCertificateOutlined /><span>Protected identity</span><h3>The workspace slug is permanent.</h3><p>This keeps public competition links and operator bookmarks stable while the display name evolves.</p></aside>
      </section>
    </>
  );
}
