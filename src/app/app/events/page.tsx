"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Empty, Tag, message } from "antd";
import { ArrowRightOutlined, CalendarOutlined, PlusOutlined, TrophyOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import styles from "../workspace.module.css";
import { PageLoader } from "@/components/common/page-loader";

interface MyEvent { participantId: string; eventId: string; eventName: string; eventStatus: string; eventFormat: string; competitionId: string; competitionName: string; organizationId: string; organizationName: string; organizationSlug: string; registeredAt: string }
const colors: Record<string, string> = { draft: "default", open: "blue", in_progress: "blue", completed: "blue", cancelled: "default" };

export default function MyEventsPage() {
  const router = useRouter();
  const { currentMember } = useApp();
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentMember) { router.push("/login"); return; }
    (async () => { try { const response = await fetch("/api/me/events"); const json = await response.json(); if (!response.ok) throw new Error(json.error); if (json.data) setEvents(json.data); } catch (error) { message.error(error instanceof Error ? error.message : "Could not load your events"); } finally { setLoading(false); } })();
  }, [currentMember, router]);
  if (!currentMember) return null;

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Participant view</span><h1 className="page-title">Your matchday.</h1><p className="page-subtitle">Events you have joined, with a direct route to schedules, results, tables, and the live experience.</p></div><div className="page-actions"><Button size="large" icon={<PlusOutlined />} onClick={() => router.push("/app")}>Find organizations</Button></div></header>
      {loading ? <PageLoader className={styles.loading} label="Loading your events" /> : events.length === 0 ? <div className={styles.emptyEvents}><Empty description="You have not joined an event yet" /><Button type="primary" onClick={() => router.push("/app")}>Explore organizations</Button></div> : (
        <section className={styles.eventGrid}>
          {events.map((event, index) => (
            <button key={event.participantId} className={styles.eventCard} onClick={() => router.push(`/live/${event.organizationSlug}/${event.competitionId}`)}>
              <div className={styles.eventTop}><span>{String(index + 1).padStart(2, "0")}</span><Tag color={colors[event.eventStatus] ?? "default"}>{event.eventStatus.replace(/_/g, " ")}</Tag></div>
              <TrophyOutlined className={styles.eventIcon} />
              <h2>{event.eventName}</h2><p>{event.competitionName}</p>
              <div className={styles.eventFooter}><span><CalendarOutlined /> Joined {new Date(event.registeredAt).toLocaleDateString()}</span><strong>{event.organizationName} <ArrowRightOutlined /></strong></div>
            </button>
          ))}
        </section>
      )}
    </>
  );
}
