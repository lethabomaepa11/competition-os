"use client";

import { useMemo } from "react";
import { Card, Table, Typography, Tag, Row, Col, Empty } from "antd";
import {
  TrophyOutlined,
  SafetyOutlined,
  FireOutlined,
  GoldOutlined,
  CrownOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus } from "@/domain/types";

const { Title, Text } = Typography;

interface PlayerStats {
  participantId: string;
  displayName: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  winRate: number;
}

function computeStats(
  matches: Match[],
  participants: Participant[],
): PlayerStats[] {
  const completed = matches.filter(
    (m) =>
      m.status === MatchStatus.Completed ||
      m.status === MatchStatus.Walkover,
  );

  const statsMap = new Map<string, PlayerStats>();

  for (const p of participants) {
    statsMap.set(p.id, {
      participantId: p.id,
      displayName: p.displayName,
      mp: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      winRate: 0,
    });
  }

  for (const match of completed) {
    const matchParticipants = match.participants ?? [];
    if (matchParticipants.length < 2) continue;

    const matchScores = match.result?.scores ?? [];
    const map = new Map(matchScores.map((s) => [s.participantId, s.value]));

    const isDraw =
      matchParticipants.length >= 2 && !match.result?.winnerId;
    const winnerId = match.result?.winnerId;

    for (const mp of matchParticipants) {
      const stat = statsMap.get(mp.participantId);
      if (!stat) continue;
      stat.mp++;
      const scored = map.get(mp.participantId) ?? 0;
      const conceded = [...map.entries()]
        .filter(([pid]) => pid !== mp.participantId)
        .reduce((sum, [, v]) => sum + v, 0);

      stat.gf += scored;
      stat.ga += conceded;

      if (isDraw) {
        stat.d++;
      } else if (winnerId === mp.participantId) {
        stat.w++;
      } else {
        stat.l++;
      }
    }
  }

  for (const stat of statsMap.values()) {
    if (stat.mp > 0) {
      stat.gd = stat.gf - stat.ga;
      stat.winRate = Math.round((stat.w / stat.mp) * 100);
    }
  }

  return [...statsMap.values()].filter((s) => s.mp > 0);
}

function StatCard({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      size="small"
      title={
        <span>
          <span style={{ color, marginRight: 6 }}>{icon}</span>
          {label}
        </span>
      }
      style={{
        borderTop: `3px solid ${color}`,
        height: "100%",
      }}
    >
      {children}
    </Card>
  );
}

function RankingList({
  items,
  valueLabel,
  valueColor,
  formatValue,
  emptyLabel,
}: {
  items: { participantId: string; displayName: string; value: number }[];
  valueLabel: string;
  valueColor: string;
  formatValue?: (v: number) => string;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <Empty description={emptyLabel} />;
  }

  return (
    <div>
      {items.slice(0, 10).map((item, i) => (
        <div
          key={item.participantId}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 4px",
            borderBottom:
              i < Math.min(items.length, 10) - 1
                ? "1px solid #f0f0f0"
                : "none",
          }}
        >
          <div
            style={{
              width: 28,
              fontWeight: 700,
              fontSize: 13,
              color: i < 3 ? ["#FFD700", "#C0C0C0", "#CD7F32"][i] : "#999",
            }}
          >
            {i === 0 ? <CrownOutlined style={{ color: "#FFD700" }} /> : `#${i + 1}`}
          </div>
          <Text
            strong
            ellipsis
            style={{ flex: 1, fontSize: 13, marginLeft: 8 }}
          >
            {item.displayName}
          </Text>
          <Tag
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: valueColor,
              background: `${valueColor}15`,
              border: "none",
            }}
          >
            {formatValue ? formatValue(item.value) : item.value}
          </Tag>
        </div>
      ))}
    </div>
  );
}

interface PlayerStatsProps {
  matches: Match[];
  participants: Participant[];
}

export function PlayerStats({ matches, participants }: PlayerStatsProps) {
  const stats = useMemo(
    () => computeStats(matches, participants),
    [matches, participants],
  );

  const topScorers = useMemo(
    () =>
      [...stats]
        .sort((a, b) => b.gf - a.gf || b.winRate - a.winRate)
        .map((s) => ({
          participantId: s.participantId,
          displayName: s.displayName,
          value: s.gf,
        })),
    [stats],
  );

  const bestDefense = useMemo(
    () =>
      [...stats]
        .sort(
          (a, b) => a.ga - b.ga || b.winRate - a.winRate,
        )
        .map((s) => ({
          participantId: s.participantId,
          displayName: s.displayName,
          value: s.ga,
        })),
    [stats],
  );

  const bestPlayers = useMemo(
    () =>
      [...stats]
        .sort(
          (a, b) => b.winRate - a.winRate || b.w - a.w,
        )
        .map((s) => ({
          participantId: s.participantId,
          displayName: s.displayName,
          value: s.winRate,
        })),
    [stats],
  );

  const columns = [
    {
      title: "#",
      key: "rank",
      width: 45,
      render: (_: unknown, __: unknown, i: number) => (
        <span style={{ fontWeight: 700, color: "#999", fontSize: 12 }}>
          {i + 1}
        </span>
      ),
    },
    {
      title: "Player",
      key: "player",
      render: (_: unknown, record: PlayerStats) => (
        <Text strong style={{ fontSize: 13 }}>
          {record.displayName}
        </Text>
      ),
    },
    {
      title: "MP",
      dataIndex: "mp",
      key: "mp",
      width: 50,
      align: "center" as const,
    },
    {
      title: "W",
      dataIndex: "w",
      key: "w",
      width: 45,
      align: "center" as const,
      render: (v: number) => <span style={{ color: "#22c55e", fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "D",
      dataIndex: "d",
      key: "d",
      width: 45,
      align: "center" as const,
      render: (v: number) => <span style={{ color: "#f59e0b", fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "L",
      dataIndex: "l",
      key: "l",
      width: 45,
      align: "center" as const,
      render: (v: number) => <span style={{ color: "#ef4444", fontWeight: 600 }}>{v}</span>,
    },
    {
      title: "GF",
      dataIndex: "gf",
      key: "gf",
      width: 50,
      align: "center" as const,
      render: (v: number) => (
        <span style={{ color: "#3b82f6", fontWeight: 700, fontSize: 14 }}>
          {v}
        </span>
      ),
    },
    {
      title: "GA",
      dataIndex: "ga",
      key: "ga",
      width: 50,
      align: "center" as const,
      render: (v: number) => (
        <span style={{ color: "#f43f5e", fontWeight: 600 }}>{v}</span>
      ),
    },
    {
      title: "GD",
      dataIndex: "gd",
      key: "gd",
      width: 50,
      align: "center" as const,
      render: (v: number) => {
        const color = v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#999";
        return (
          <span style={{ color, fontWeight: 700, fontSize: 14 }}>
            {v > 0 ? `+${v}` : v}
          </span>
        );
      },
    },
    {
      title: "Win%",
      dataIndex: "winRate",
      key: "winRate",
      width: 65,
      align: "center" as const,
      render: (v: number) => (
        <Tag
          color={v >= 75 ? "green" : v >= 50 ? "blue" : v >= 25 ? "orange" : "red"}
          style={{ fontWeight: 700, border: "none" }}
        >
          {v}%
        </Tag>
      ),
    },
  ];

  if (stats.length === 0) {
    return (
      <Card>
        <Empty description="No completed matches yet. Stats will appear once results are in." />
      </Card>
    );
  }

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <StatCard
            icon={<FireOutlined />}
            label="Top Scorers"
            color="#3b82f6"
          >
            <RankingList
              items={topScorers}
              valueLabel="Goals"
              valueColor="#3b82f6"
              emptyLabel="No goals scored yet"
            />
          </StatCard>
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={  <SafetyOutlined />}
            label="Best Defense"
            color="#22c55e"
          >
            <RankingList
              items={bestDefense}
              valueLabel="Conceded"
              valueColor="#22c55e"
              emptyLabel="No matches played yet"
            />
          </StatCard>
        </Col>
        <Col xs={24} md={8}>
          <StatCard
            icon={<TrophyOutlined />}
            label="Best Players"
            color="#f59e0b"
          >
            <RankingList
              items={bestPlayers}
              valueLabel="Win Rate"
              valueColor="#f59e0b"
              formatValue={(v) => `${v}%`}
              emptyLabel="No matches played yet"
            />
          </StatCard>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <span>
            <TeamOutlined style={{ marginRight: 6 }} />
            Player Rankings
          </span>
        }
      >
        <Table
          dataSource={[...stats].sort(
            (a, b) => b.w - a.w || b.gd - a.gd || b.gf - a.gf,
          )}
          rowKey="participantId"
          columns={columns}
          pagination={false}
          size="small"
          scroll={{ x: true }}
        />
      </Card>
    </div>
  );
}
