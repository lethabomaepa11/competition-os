"use client";

import { Table, Typography, Tag, Empty } from "antd";
import type { StandingsEntry } from "@/domain/formats/interface";
import type { Event } from "@/domain/event";
import { FormatType } from "@/domain/types";

const { Title } = Typography;

interface Props {
  standings: StandingsEntry[];
  event: Event;
}

export function StandingsTable({ standings, event }: Props) {
  if (standings.length === 0) {
    return (
      <div>
        <Empty description="No standings data yet. Results will appear here automatically after matches are scored." />
      </div>
    );
  }

  const isKnockout = event.format === FormatType.SingleElimination || event.format === FormatType.DoubleElimination;
  const isSwiss = event.format === FormatType.Swiss;
  const isGroupStage = event.format === FormatType.GroupStage;

  const columns: import("antd/es/table").ColumnsType<StandingsEntry> = [
    {
      title: "#", dataIndex: "rank", key: "rank", width: 60,
      render: (r: number) => (
        r <= 3
          ? <Tag color={r === 1 ? "gold" : r === 2 ? "silver" : "bronze"}>{r}</Tag>
          : <span>{r}</span>
      ),
    },
    ...(isGroupStage ? [{ title: "Group", key: "groupName", render: (_: unknown, r: StandingsEntry) => <Tag>{r.groupName}</Tag> }] : []),
    { title: "Participant", dataIndex: "displayName", key: "displayName" },
    { title: "MP", key: "mp", render: (_: unknown, r: StandingsEntry) => r.wins + r.losses + r.draws },
    { title: "Pts", dataIndex: "points", key: "points", sorter: (a: StandingsEntry, b: StandingsEntry) => a.points - b.points },
    { title: "W", dataIndex: "wins", key: "wins" },
    { title: "L", dataIndex: "losses", key: "losses" },
    { title: "D", dataIndex: "draws", key: "draws" },
  ];

  if (isSwiss) {
    columns.push(
      { title: "Buchholz", key: "buchholz", render: (_: unknown, r: StandingsEntry) => r.stats.buchholz?.toFixed(1) ?? "-" },
    );
  }

  if (!isKnockout && !isSwiss) {
    columns.push(
      { title: "GF", key: "gf", render: (_: unknown, r: StandingsEntry) => r.stats.goalsFor ?? "-" },
      { title: "GA", key: "ga", render: (_: unknown, r: StandingsEntry) => r.stats.goalsAgainst ?? "-" },
      { title: "GD", key: "gd", render: (_: unknown, r: StandingsEntry) => {
        const gd = (r.stats.goalsFor ?? 0) - (r.stats.goalsAgainst ?? 0);
        return <span style={{ color: gd > 0 ? "#52c41a" : gd < 0 ? "#ff4d4f" : undefined }}>{gd > 0 ? "+" : ""}{gd}</span>;
      }},
    );
  }
  columns.push({
    title: "Qualified", dataIndex: "qualified", key: "qualified",
    render: (q: boolean) => q ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>,
  });

  return (
    <div>
      <Table
        dataSource={standings}
        rowKey="participantId"
        pagination={false}
        columns={columns}
      />
    </div>
  );
}
