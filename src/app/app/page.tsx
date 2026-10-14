"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Form, Input, Modal, message } from "antd";
import { ArrowRightOutlined, PlusOutlined, TeamOutlined, TrophyOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";
import styles from "./workspace.module.css";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "org";
}

export default function AppDashboard() {
  const router = useRouter();
  const { currentMember, organizations, createOrg, ready } = useApp();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [host, setHost] = useState("");
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { if (ready && !currentMember) router.push("/login"); }, [ready, currentMember, router]);
  if (!currentMember) return null;

  const openCreate = () => {
    setHost(window.location.host);
    setOpen(true);
  };

  const create = async (values: { name: string }) => {
    setCreating(true);
    try {
      const service = new OrganizationService();
      let finalSlug = slugify(values.name);
      if (await service.getBySlug(finalSlug)) finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
      const org = await createOrg(values.name, finalSlug);
      message.success("Organization created");
      setOpen(false); form.resetFields(); setSlug("");
      router.push(`/o/${org.slug}`);
    } catch { message.error("Could not create the organization"); }
    finally { setCreating(false); }
  };

  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Operator portfolio</span><h1 className="page-title">Choose your arena.</h1><p className="page-subtitle">Every organization has its own competitions, people, blueprints, controls, and public audience.</p></div>
        <div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreate}>New organization</Button></div>
      </header>

      <div className={styles.portfolioMeta}><span><b>{String(organizations.length).padStart(2, "0")}</b> Organizations</span><span><b>{currentMember.displayName}</b> Operator</span><span><i /> Workspace online</span></div>

      {organizations.length === 0 ? (
        <section className={styles.emptyPortfolio}>
          <div className={styles.emptyIcon}><TeamOutlined /></div>
          <span className="eyebrow">Your first workspace</span>
          <h2>Give the operation a home.</h2>
          <p>Create an organization for your league, club, federation, school, company, or tournament brand.</p>
          <Button type="primary" size="large" onClick={openCreate}>Create organization <ArrowRightOutlined /></Button>
        </section>
      ) : (
        <section className={styles.orgGrid} aria-label="Your organizations">
          {organizations.map((org, index) => (
            <button key={org.id} className={styles.orgCard} onClick={() => router.push(`/o/${org.slug}`)}>
              <span className={styles.orgIndex}>{String(index + 1).padStart(2, "0")}</span>
              <Avatar size={48} icon={<TrophyOutlined />} />
              <div><strong>{org.name}</strong><span>/{org.slug}</span></div>
              <ArrowRightOutlined className={styles.orgArrow} />
            </button>
          ))}
          <button className={`${styles.orgCard} ${styles.addCard}`} onClick={openCreate}><PlusOutlined /><div><strong>Add organization</strong><span>Open another arena</span></div></button>
        </section>
      )}

      <Modal title="Create an organization" open={open} onCancel={() => { setOpen(false); form.resetFields(); setSlug(""); }} footer={null} width={500}>
        <p className={styles.modalIntro}>Organizations separate competitions, teams, settings, and access.</p>
        <Form form={form} layout="vertical" onFinish={create} requiredMark={false}>
          <Form.Item label="Organization name" name="name" rules={[{ required: true, message: "Enter an organization name" }]}><Input placeholder="e.g. Continental Esports League" size="large" autoFocus onChange={(event) => setSlug(slugify(event.target.value))} /></Form.Item>
          <div className={styles.slugPreview}><span>Workspace URL</span><code>{host}/o/{slug || "your-organization"}</code></div>
          <Button type="primary" htmlType="submit" block loading={creating} size="large">Create workspace <ArrowRightOutlined /></Button>
        </Form>
      </Modal>
    </>
  );
}
