"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Empty, Tag } from "antd";
import { ArrowRightOutlined, PlusOutlined, TrophyOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import type { Competition } from "@/domain/competition";
import { CompetitionStatus } from "@/domain/types";
import styles from "../command.module.css";
import { SystemTable } from "@/components/common/system-table";

const statusColors: Record<string, string> = { draft: "default", published: "blue", in_progress: "green", completed: "purple", archived: "red" };

export default function CompetitionsPage() {
  const router = useRouter();
  const { currentOrg } = useApp();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (currentOrg) new CompetitionService().list(currentOrg.id).then((items) => { setCompetitions(items); setLoading(false); }); }, [currentOrg]);
  if (!currentOrg) return null;
  const createPath = `/o/${currentOrg.slug}/competitions/new`;

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Competition portfolio</span><h1 className="page-title">Every arena, one view.</h1><p className="page-subtitle">Move from concept to registration, matchday, final result, and archive with the full lifecycle visible.</p></div><div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => router.push(createPath)}>New competition</Button></div></header>
      <div className={styles.listMeta}><span>{String(competitions.length).padStart(2,"0")} total</span><span>{competitions.filter((item) => item.status === CompetitionStatus.InProgress).length} live</span><span>{competitions.filter((item) => item.status === CompetitionStatus.Draft).length} drafts</span></div>
      {competitions.length === 0 && !loading ? <div className={styles.emptyState}><TrophyOutlined /><h2>No competitions yet.</h2><p>Build a league, cup, tournament, or championship from scratch.</p><Button type="primary" onClick={() => router.push(createPath)}>Create the first competition</Button></div> : (
        <SystemTable dataSource={competitions} rowKey="id" loading={loading} searchText={(item) => `${item.name} ${item.description} ${item.category} ${item.status}`} scroll={{ x: 760 }} onRow={(record) => ({ onClick: () => router.push(`/o/${currentOrg.slug}/competitions/${record.id}`), style: { cursor: "pointer" } })} columns={[
          { title: "Competition", dataIndex: "name", key: "name", render: (name: string, record) => <div className={styles.competitionName}><span>{name}</span><small>{record.description || "No description"}</small></div> },
          { title: "Status", dataIndex: "status", key: "status", width: 150, render: (status: CompetitionStatus) => <Tag color={statusColors[status]}>{status.replace(/_/g," ")}</Tag> },
          { title: "Start", dataIndex: "dateStart", key: "dateStart", width: 140, render: (date?: string) => date ? new Date(date).toLocaleDateString() : "TBC" },
          { title: "Created", dataIndex: "createdAt", key: "createdAt", width: 140, render: (date: string) => new Date(date).toLocaleDateString() },
          { title: "", key: "open", width: 48, render: () => <ArrowRightOutlined /> },
        ]} locale={{ emptyText: <Empty description="No competitions" /> }} />
      )}
    </>
  );
}
