"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Empty, Progress, Spin, Table, Tag } from "antd";
import { ArrowRightOutlined, FireOutlined, LineChartOutlined, TrophyOutlined } from "@ant-design/icons";
import styles from "../workspace.module.css";

type Performance = {
  summary: { events: number; played: number; wins: number; draws: number; losses: number; winRate: number; scored: number; conceded: number };
  entries: { participantId: string; displayName: string; status: string; seed?: number; eventName: string; eventStatus: string; competitionName: string }[];
  recentMatches: { id: string; eventName: string; competitionName: string; organizationName: string; organizationSlug: string; competitionId: string; scheduledAt?: string; status: string; ownScore: number; otherScore: number; result: string }[];
};

export default function PerformancePage() {
  const router = useRouter();
  const [data, setData] = useState<Performance | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/me/performance").then((response) => response.json()).then((json) => setData(json.data ?? null)).finally(() => setLoading(false)); }, []);
  if (loading) return <div className={styles.loading}><Spin size="large" /></div>;
  if (!data || data.entries.length === 0) return <><header className="page-header"><div><span className="eyebrow">Player intelligence</span><h1 className="page-title">Your performance.</h1><p className="page-subtitle">Results, form, scoring, and every active competition entry connected to your account.</p></div></header><div className={styles.emptyEvents}><Empty description="Join an event to start building your performance record" /></div></>;
  const { summary } = data;
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Player intelligence</span><h1 className="page-title">Your performance.</h1><p className="page-subtitle">A personal view of results, form, scoring, and every competition entry connected to your account.</p></div></header>
      <section className={styles.performanceHero}>
        <div><span>Career win rate</span><strong>{summary.winRate}%</strong><Progress percent={summary.winRate} showInfo={false} strokeColor="#B8FF3D" railColor="rgba(255,255,255,.12)" /><small>{summary.wins} wins from {summary.played} completed matches</small></div>
        <div><span><TrophyOutlined /> Results</span><b>{summary.wins}<small>W</small> {summary.draws}<small>D</small> {summary.losses}<small>L</small></b></div>
        <div><span><FireOutlined /> Score line</span><b>{summary.scored}<small>for</small> {summary.conceded}<small>against</small></b></div>
        <div><span><LineChartOutlined /> Entries</span><b>{summary.events}<small>events</small></b></div>
      </section>
      <div className="section-heading"><h2>Competition entries</h2></div>
      <div className={styles.entryGrid}>{data.entries.map((entry) => <article key={entry.participantId} className={styles.entryCard}><div><Tag color={entry.eventStatus === "in_progress" ? "green" : "default"}>{entry.eventStatus.replace(/_/g," ")}</Tag><span>{entry.seed ? `Seed ${entry.seed}` : "Unseeded"}</span></div><h3>{entry.displayName}</h3><p>{entry.eventName}</p><footer>{entry.competitionName}</footer></article>)}</div>
      <div className="section-heading"><h2>Recent matches</h2></div>
      <Table dataSource={data.recentMatches} rowKey="id" pagination={false} scroll={{ x: 720 }} onRow={(record) => ({ onClick: () => record.organizationSlug && router.push(`/live/${record.organizationSlug}/${record.competitionId}`), style: { cursor: record.organizationSlug ? "pointer" : "default" } })} columns={[
        { title: "Result", dataIndex: "result", key: "result", width: 100, render: (result: string) => <Tag color={result === "win" ? "green" : result === "loss" ? "red" : result === "draw" ? "orange" : "default"}>{result}</Tag> },
        { title: "Score", key: "score", width: 110, render: (_: unknown, match) => <strong className={styles.score}>{match.ownScore} : {match.otherScore}</strong> },
        { title: "Match", key: "match", render: (_: unknown, match) => <div className={styles.competitionCell}><strong>{match.eventName}</strong><span>{match.competitionName} · {match.organizationName}</span></div> },
        { title: "Date", dataIndex: "scheduledAt", key: "scheduledAt", width: 140, render: (date?: string) => date ? new Date(date).toLocaleDateString() : "TBC" },
        { title: "", key: "open", width: 40, render: () => <ArrowRightOutlined /> },
      ]} />
    </>
  );
}
