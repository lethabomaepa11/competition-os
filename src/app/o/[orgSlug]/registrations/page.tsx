"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Avatar, Button, Input, message, Modal, Pagination, Segmented, Tag } from "antd";
import { CheckOutlined, CloseOutlined, InboxOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { categoryLabel, teamTypeLabel } from "@/domain/categories";
import styles from "../command.module.css";
import { PageLoader } from "@/components/common/page-loader";

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
  const [urlReady, setUrlReady] = useState(false);
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [review, setReview] = useState<{ item: Registration; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = async (selected = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: selected, page: String(page), pageSize: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/o/${orgSlug}/registrations?${params}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load registrations");
      setItems(json.data?.items ?? []);
      setTotal(json.data?.total ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not load registrations");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedStatus = params.get("registration_status");
    // URL state is intentionally restored after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (["pending", "approved", "rejected"].includes(savedStatus ?? "")) setStatus(savedStatus!);
    setSearch(params.get("registration_q") ?? "");
    setPage(Math.max(1, Number(params.get("registration_page") ?? 1) || 1));
    setPageSize(Math.min(100, Math.max(10, Number(params.get("registration_size") ?? 10) || 10)));
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    let active = true;
    const timeout = window.setTimeout(() => {
    const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/o/${orgSlug}/registrations?${params}`)
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load registrations");
        return json.data ?? { items: [], total: 0 };
      })
      .then((data: { items: Registration[]; total: number }) => { if (active) { setItems(data.items); setTotal(data.total); } })
      .catch((error: unknown) => { if (active) message.error(error instanceof Error ? error.message : "Could not load registrations"); })
      .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [orgSlug, page, pageSize, search, status, urlReady]);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value?: string) => value ? params.set(key, value) : params.delete(key);
    setOrDelete("registration_status", status !== "pending" ? status : undefined);
    setOrDelete("registration_q", search.trim());
    setOrDelete("registration_page", page > 1 ? String(page) : undefined);
    setOrDelete("registration_size", pageSize !== 10 ? String(pageSize) : undefined);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, [page, pageSize, search, status, urlReady]);

  const decide = async () => {
    if (!review) return;
    setReviewing(true);
    try {
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
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not review registration");
    } finally { setReviewing(false); }
  };

  return (
    <>
      <header className="page-header">
        <div><span className="eyebrow">Entry control</span><h1 className="page-title">Registration approvals</h1><p className="page-subtitle">Verify every club, team, and player before they enter an event, fixture list, table, or bracket.</p></div>
        <Segmented value={status} onChange={(value) => { setLoading(true); setStatus(String(value)); setPage(1); }} options={[{ label: "Pending", value: "pending" }, { label: "Approved", value: "approved" }, { label: "Rejected", value: "rejected" }]} />
      </header>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" }}>
        <Input.Search aria-label="Search registrations" placeholder="Search teams, players or competitions" allowClear value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }} style={{ maxWidth: 380 }} />
        <span aria-live="polite">{total} {total === 1 ? "registration" : "registrations"}</span>
      </div>
      {loading ? <PageLoader className={styles.loading} label="Loading registration approvals" /> : items.length === 0 ? (
        <div className={styles.emptyState}><InboxOutlined /><h2>{search ? "No matching registrations" : `No ${status} registrations`}</h2><p>{search ? "Try a different search." : "Applications will appear here as teams and players register."}</p></div>
      ) : (
        <>
          <section className={styles.approvalList}>
            {items.map((item) => (
              <article key={item.id} className={styles.approvalCard}>
                <Avatar size={48} icon={item.registrantType === "team" ? <TeamOutlined /> : <UserOutlined />} />
                <div className={styles.approvalIdentity}><span>{item.competition?.name}</span><h2>{item.team?.name ?? item.member?.display_name ?? "Entrant"}</h2><p>{item.registrantType === "team" ? `${teamTypeLabel(item.team?.team_type)} · ${item.team?.member_ids.length ?? 0} players` : item.member?.email}</p></div>
                <div className={styles.approvalMeta}><Tag color="blue">{categoryLabel(item.competition?.category)}</Tag><span>{item.targetEvents.length} compatible event{item.targetEvents.length === 1 ? "" : "s"}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>
                {status === "pending" ? <div className={styles.approvalActions}><Button danger icon={<CloseOutlined />} onClick={() => setReview({ item, decision: "rejected" })}>Reject</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => setReview({ item, decision: "approved" })}>Approve</Button></div> : <Tag color={status === "approved" ? "blue" : "default"}>{status}</Tag>}
                {item.registrationNote && <blockquote>{item.registrationNote}</blockquote>}
              </article>
            ))}
          </section>
          <Pagination current={page} pageSize={pageSize} total={total} onChange={(nextPage, nextSize) => { setLoading(true); setPage(nextPage); setPageSize(nextSize); }} showSizeChanger pageSizeOptions={[10, 20, 50, 100]} showTotal={(count, range) => `${range[0]}–${range[1]} of ${count}`} style={{ textAlign: "right", marginTop: 16 }} />
        </>
      )}
      <Modal title={`${review?.decision === "approved" ? "Approve" : "Reject"} registration`} open={!!review} onCancel={() => setReview(null)} onOk={decide} confirmLoading={reviewing} okText={review?.decision === "approved" ? "Approve entrant" : "Reject entrant"} okButtonProps={{ danger: review?.decision === "rejected" }}><p>{review?.decision === "approved" ? "This entrant will be added to every compatible event that still has capacity." : "The applicant will see that this registration was rejected."}</p><Input.TextArea rows={4} value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} placeholder="Optional decision note" /></Modal>
    </>
  );
}
