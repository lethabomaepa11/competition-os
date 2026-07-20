"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Table, Button, Typography, Space, Tag, Card } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import type { Competition } from "@/domain/competition";
import { CompetitionStatus } from "@/domain/types";

const { Title } = Typography;

export default function CompetitionsPage() {
  const router = useRouter();
  const { currentOrg } = useApp();
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      const svc = new CompetitionService();
      setCompetitions(await svc.list(currentOrg.id));
    })();
  }, [currentOrg]);

  if (!currentOrg) return null;

  const statusColors: Record<string, string> = {
    [CompetitionStatus.Draft]: "default",
    [CompetitionStatus.Published]: "blue",
    [CompetitionStatus.InProgress]: "green",
    [CompetitionStatus.Completed]: "purple",
    [CompetitionStatus.Archived]: "red",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Competitions</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push(`/o/${currentOrg.slug}/competitions/new`)}>
          New Competition
        </Button>
      </div>
      <Table
        dataSource={competitions}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => router.push(`/o/${currentOrg.slug}/competitions/${record.id}`),
          style: { cursor: "pointer" },
        })}
        columns={[
          { title: "Name", dataIndex: "name", key: "name" },
          { title: "Description", dataIndex: "description", key: "description", ellipsis: true },
          {
            title: "Status", dataIndex: "status", key: "status",
            render: (s: CompetitionStatus) => <Tag color={statusColors[s]}>{s}</Tag>,
          },
          { title: "Created", dataIndex: "createdAt", key: "createdAt", render: (d: string) => new Date(d).toLocaleDateString() },
        ]}
      />
    </div>
  );
}
