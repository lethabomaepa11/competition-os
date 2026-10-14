"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Avatar, Button, Empty, Input, message, Modal, Segmented, Spin, Tag } from "antd";
import { CheckOutlined, CloseOutlined, InboxOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { categoryLabel, teamTypeLabel } from "@/domain/categories";
import styles from "../command.module.css";

type Registration = { id: string; competition?: { name: string; category: string }; registrantType: "team" | "individual"; team?: { name: string; team_type: string; member_ids: string[] }; member?: { display_name: string; email: string }; status: string; registrationNote: string; createdAt: string; targetEvents: { id: string; name: string; status: string }[] };

export default function RegistrationsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [items, setItems] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [review, setReview] = useState<{ item: Registration; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const load = async (selected = status) => { setLoading(true); const response = await fetch(`/api/o/${orgSlug}/registrations?status=${selected}`); const json = await response.json(); setItems(json.data ?? []); setLoading(false); };
  useEffect(() => { void load(status); }, [orgSlug, status]);
  const decide = async () => {
    if (!review) return;
    const response = await fetch(`/api/o/${orgSlug}/registrations`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId: review.item.id, status: review.decision, reviewNote: note }) });
    const json = await response.json();
    if (!response.ok) return message.error(json.error);
    message.success(review.decision === "approved" ? `Approved and added to ${json.data.provisioned} compatible event${json.data.provisioned === 1 ? "" : "s"}` : "Registration rejected");
    setReview(null); setNote(""); await load();
  };

  return <>
    <header className="page-header"><div><span className="eyebrow">Entry control</span><h1 className="page-title">Registration approvals</h1><p className="page-subtitle">Verify every club, team, and player before they enter an event, fixture list, table, or bracket.</p></div><Segmented value={status} onChange={(value) => setStatus(String(value))} options={[{ label: "Pending", value: "pending" }, { label: "Approved", value: "approved" }, { label: "Rejected", value: "rejected" }]} /></header>
    {loading ? <div className={styles.loading}><Spin size="large" /></div> : items.length === 0 ? <div className={styles.emptyState}><InboxOutlined /><h2>No {status} registrations</h2><p>Applications will appear here as teams and players register.</p></div> : <section className={styles.approvalList}>{items.map((item) => <article key={item.id} className={styles.approvalCard}><Avatar size={48} icon={item.registrantType === "team" ? <TeamOutlined /> : <UserOutlined />} /><div className={styles.approvalIdentity}><span>{item.competition?.name}</span><h2>{item.team?.name ?? item.member?.display_name ?? "Entrant"}</h2><p>{item.registrantType === "team" ? `${teamTypeLabel(item.team?.team_type)} · ${item.team?.member_ids.length ?? 0} players` : item.member?.email}</p></div><div className={styles.approvalMeta}><Tag color="blue">{categoryLabel(item.competition?.category)}</Tag><span>{item.targetEvents.length} compatible event{item.targetEvents.length === 1 ? "" : "s"}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>{status === "pending" ? <div className={styles.approvalActions}><Button danger icon={<CloseOutlined />} onClick={() => setReview({ item, decision: "rejected" })}>Reject</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => setReview({ item, decision: "approved" })}>Approve</Button></div> : <Tag color={status === "approved" ? "green" : "red"}>{status}</Tag>}{item.registrationNote && <blockquote>{item.registrationNote}</blockquote>}</article>)}</section>}
    <Modal title={`${review?.decision === "approved" ? "Approve" : "Reject"} registration`} open={!!review} onCancel={() => setReview(null)} onOk={decide} okText={review?.decision === "approved" ? "Approve entrant" : "Reject entrant"} okButtonProps={{ danger: review?.decision === "rejected" }}><p>{review?.decision === "approved" ? "This entrant will be added to every compatible event that still has capacity." : "The applicant will see that this registration was rejected."}</p><Input.TextArea rows={4} value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} placeholder="Optional decision note" /></Modal>
  </>;
}
