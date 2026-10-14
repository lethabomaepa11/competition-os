"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Form, Input, message, Modal, Select, Tag } from "antd";
import { ArrowRightOutlined, BellOutlined, CalendarOutlined, GlobalOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { categoryLabel } from "@/domain/categories";
import styles from "../workspace.module.css";
import { PageLoader } from "@/components/common/page-loader";

type Opportunity = { id: string; name: string; description: string; category: string; entryType: "team" | "individual"; eligibility: { region?: string; minRosterSize?: number; maxRosterSize?: number }; dateStart?: string; isNew: boolean; organization?: { name: string; slug: string }; eligibleTeams: { id: string; name: string; rosterSize: number }[]; applications: { status: string; teamId?: string }[] };

export default function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try { const response = await fetch("/api/me/opportunities"); const json = await response.json(); if (!response.ok) throw new Error(json.error); setItems(json.data?.opportunities ?? []); }
    catch (error) { message.error(error instanceof Error ? error.message : "Could not load eligible competitions"); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    fetch("/api/me/opportunities").then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      if (active) setItems(json.data?.opportunities ?? []);
    }).catch((error) => { if (active) message.error(error instanceof Error ? error.message : "Could not load eligible competitions"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => filter === "all" ? items : items.filter((item) => item.category === filter), [items, filter]);
  const categories = [...new Set(items.map((item) => item.category))];

  const apply = async (values: { teamId?: string; note?: string }) => {
    if (!selected) return;
    setSubmitting(true);
    const response = await fetch("/api/me/registrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competitionId: selected.id, registrantType: selected.entryType, teamId: values.teamId, note: values.note }) });
    const json = await response.json(); setSubmitting(false);
    if (!response.ok) return message.error(json.error);
    message.success("Registration submitted for operator approval"); setSelected(null); await load();
  };

  if (loading) return <PageLoader className={styles.loading} label="Finding eligible competitions" />;
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Competition directory</span><h1 className="page-title">Eligible tournaments</h1><p className="page-subtitle">Newly published competitions that match you or a team you captain. Every application is reviewed by the organizer.</p></div><div className={styles.alertMetric}><BellOutlined /><span><strong>{items.filter((item) => item.isNew && !item.applications.length).length}</strong> new alerts</span></div></header>
      <div className={styles.directoryBar}><strong>{visible.length} open competitions</strong><Select value={filter} onChange={setFilter} options={[{ value: "all", label: "All categories" }, ...categories.map((category) => ({ value: category, label: categoryLabel(category) }))]} /></div>
      {visible.length === 0 ? <div className={styles.emptyPortfolio}><Empty description="No eligible published competitions yet" /></div> : <section className={styles.opportunityGrid}>{visible.map((item) => {
        const application = item.applications[0];
        return <article key={item.id} className={styles.opportunityCard}><header><div>{item.isNew && <Tag color="blue">New</Tag>}<Tag>{categoryLabel(item.category)}</Tag></div><span>{item.entryType === "team" ? <TeamOutlined /> : <UserOutlined />} {item.entryType === "team" ? "Team entry" : "Player entry"}</span></header><h2>{item.name}</h2><p>{item.description}</p><dl><div><dt><GlobalOutlined /> Organizer</dt><dd>{item.organization?.name ?? "Competition organizer"}</dd></div><div><dt><CalendarOutlined /> Starts</dt><dd>{item.dateStart ? new Date(item.dateStart).toLocaleDateString() : "To be confirmed"}</dd></div></dl>{item.eligibility.region && <small>Eligibility: {item.eligibility.region}</small>}<footer>{application ? <Tag color={application.status === "approved" ? "green" : application.status === "rejected" ? "red" : "gold"}>{application.status}</Tag> : <Button type="primary" onClick={() => setSelected(item)}>Register <ArrowRightOutlined /></Button>}<Button type="link" href={`/c/${item.id}`}>View competition</Button></footer></article>;
      })}</section>}

      <Modal title={`Register for ${selected?.name ?? "competition"}`} open={!!selected} onCancel={() => setSelected(null)} footer={null}>
        {selected && <Form layout="vertical" onFinish={apply} requiredMark={false}>
          <p className={styles.modalIntro}>The organizer will review this application before the entrant is added to any event, league, or bracket.</p>
          {selected.entryType === "team" && <Form.Item label="Eligible team" name="teamId" rules={[{ required: true, message: "Choose the team to register" }]}><Select size="large" options={selected.eligibleTeams.map((team) => ({ value: team.id, label: `${team.name} · ${team.rosterSize} players` }))} /></Form.Item>}
          <Form.Item label="Registration note" name="note"><Input.TextArea rows={4} maxLength={600} showCount placeholder="Share qualification details, division, ranking, or context for the organizer." /></Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>Submit for approval</Button>
        </Form>}
      </Modal>
    </>
  );
}
