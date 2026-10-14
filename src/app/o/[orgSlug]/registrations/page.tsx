"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Avatar, Button, Input, message, Modal, Pagination, Segmented, Spin, Tag } from "antd";
import { CheckOutlined, CloseOutlined, InboxOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { categoryLabel, teamTypeLabel } from "@/domain/categories";
import styles from "../command.module.css";

type Registration = {
  id: string;
  competition?: { name: string; category: string };
  registrantType: "team" | "individual";
  team?: { name: string; team_type: string; member_ids: string[] };
  member?: { display_name: string; email: string };
  status: string;
  registrationNote: string;
  createdAt: string;
  targetEvents: { id: string; name: string; status: string }[];
};

export default function RegistrationsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [items, setItems] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedStatus, setLoadedStatus] = useState("");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<{ item: Registration; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");

  const load = async (selected = status) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/o/${orgSlug}/registrations?status=${selected}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load registrations");
      setItems(json.data ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not load registrations");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/o/${orgSlug}/registrations?status=${status}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load registrations");
        return json.data ?? [];
      })
      .then((data: Registration[]) => { if (active) { setItems(data); setLoadedStatus(status); } })
      .catch((error: unknown) => { if (active) message.error(error instanceof Error ? error.message : "Could not load registrations"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orgSlug, status]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) => `${item.competition?.name ?? ""} ${item.team?.name ?? ""} ${item.member?.display_name ?? ""} ${item.member?.email ?? ""} ${item.competition?.category ?? ""} ${item.registrationNote} ${item.targetEvents.map((event) => event.name).join(" ")}`.toLocaleLowerCase().includes(query));
  }, [items, search]);
  const visibleItems = filteredItems.slice((page - 1) * 10, page * 10);

  const decide = async () => {
    if (!review) return;
    const response = await fetch(`/api/o/${orgSlug}/registrations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: review.item.id, status: review.decision, reviewNote: note }),
    });
    const json = await response.json();
    if (!response.ok) return message.error(json.error);
    message.success(review.decision === "approved" ? `Approved and added to ${json.data.provisioned} compatible event${json.data.provisioned === 1 ? "" : "s"}` : "Registration rejected");
    setReview(null);
    setNote("");
    await load();
  };

  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Entry control</span><h1 className="page-title">Registration approvals</h1><p className="page-subtitle">Verify every club, team, and player before they enter an event, fixture list, table, or bracket.</p></div>
        <Segmented value={status} onChange={(value) => { setStatus(String(value)); setPage(1); }} options={[{ label: "Pending", value: "pending" }, { label: "Approved", value: "approved" }, { label: "Rejected", value: "rejected" }]} />
      </header>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <Input.Search aria-label="Search registrations" placeholder="Search teams, players or events" allowClear value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} style={{ maxWidth: 380 }} />
        <span aria-live="polite">{filteredItems.length} {filteredItems.length === 1 ? "registration" : "registrations"}</span>
      </div>
      {loading || loadedStatus !== status ? <div className={styles.loading}><Spin size="large" /></div> : filteredItems.length === 0 ? (
        <div className={styles.emptyState}><InboxOutlined /><h2>{search ? "No matching registrations" : `No ${status} registrations`}</h2><p>{search ? "Try a different search." : "Applications will appear here as teams and players register."}</p></div>
      ) : (
        <>
          <section className={styles.approvalList}>
            {visibleItems.map((item) => (
              <article key={item.id} className={styles.approvalCard}>
                <Avatar size={48} icon={item.registrantType === "team" ? <TeamOutlined /> : <UserOutlined />} />
                <div className={styles.approvalIdentity}><span>{item.competition?.name}</span><h2>{item.team?.name ?? item.member?.display_name ?? "Entrant"}</h2><p>{item.registrantType === "team" ? `${teamTypeLabel(item.team?.team_type)} · ${item.team?.member_ids.length ?? 0} players` : item.member?.email}</p></div>
                <div className={styles.approvalMeta}><Tag color="blue">{categoryLabel(item.competition?.category)}</Tag><span>{item.targetEvents.length} compatible event{item.targetEvents.length === 1 ? "" : "s"}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>
                {status === "pending" ? <div className={styles.approvalActions}><Button danger icon={<CloseOutlined />} onClick={() => setReview({ item, decision: "rejected" })}>Reject</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => setReview({ item, decision: "approved" })}>Approve</Button></div> : <Tag color={status === "approved" ? "green" : "red"}>{status}</Tag>}
                {item.registrationNote && <blockquote>{item.registrationNote}</blockquote>}
              </article>
            ))}
          </section>
          <Pagination current={page} pageSize={10} total={filteredItems.length} onChange={setPage} showSizeChanger={false} style={{ textAlign: "right", marginTop: 16 }} />
        </>
      )}
      <Modal title={`${review?.decision === "approved" ? "Approve" : "Reject"} registration`} open={!!review} onCancel={() => setReview(null)} onOk={decide} okText={review?.decision === "approved" ? "Approve entrant" : "Reject entrant"} okButtonProps={{ danger: review?.decision === "rejected" }}><p>{review?.decision === "approved" ? "This entrant will be added to every compatible event that still has capacity." : "The applicant will see that this registration was rejected."}</p><Input.TextArea rows={4} value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} placeholder="Optional decision note" /></Modal>
    </>
  );
}
