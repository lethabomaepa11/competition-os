"use client";

import { useRef, useCallback } from "react";
import { Table, Typography, Tag, Empty, Button, Space, message } from "antd";
import type { StandingsEntry } from "@/domain/formats/interface";
import type { Event } from "@/domain/event";
import { FormatType } from "@/domain/types";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { DownloadOutlined, FilePdfOutlined } from "@ant-design/icons";

const { Title } = Typography;

interface Props {
  standings: StandingsEntry[];
  event: Event;
  hideGroupColumn?: boolean;
  hideHeader?: boolean;
}

export function StandingsTable({ standings, event, hideGroupColumn, hideHeader }: Props) {
  const tableRef = useRef<HTMLDivElement>(null);

  const exportStandings = useCallback(async (format: "png" | "pdf") => {
    if (!tableRef.current) return;
    try {
      const dataUrl = await toPng(tableRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.download = "standings.png";
        link.href = dataUrl;
        link.click();
      } else {
        const pdf = new jsPDF({ orientation: "portrait", unit: "px" });
        const imgProps = pdf.getImageProperties(dataUrl);
        pdf.addImage(dataUrl, "PNG", 0, 0, imgProps.width, imgProps.height);
        pdf.save("standings.pdf");
      }
      message.success(`Standings exported as ${format.toUpperCase()}`);
    } catch {
      message.error("Failed to export standings");
    }
  }, []);

  if (standings.length === 0) {
    return (
      <div>
        <Empty description="No standings data yet. Results will appear here automatically after matches are scored." />
      </div>
    );
  }

  const isKnockout =
    event.format === FormatType.SingleElimination ||
    event.format === FormatType.DoubleElimination;
  const isSwiss = event.format === FormatType.Swiss;
  const isGroupStage = event.format === FormatType.GroupStage;

  const columns: import("antd/es/table").ColumnsType<StandingsEntry> = [
    {
      title: "#",
      dataIndex: "rank",
      key: "rank",
      width: 60,
      render: (r: number) =>
        r <= 3 ? (
          <Tag color={r === 1 ? "gold" : r === 2 ? "silver" : "bronze"}>
            {r}
          </Tag>
        ) : (
          <span>{r}</span>
        ),
    },
    ...(isGroupStage && !hideGroupColumn
      ? [
          {
            title: "Group",
            key: "groupName",
            render: (_: unknown, r: StandingsEntry) => <Tag>{r.groupName}</Tag>,
          },
        ]
      : []),
    { title: "Participant", dataIndex: "displayName", key: "displayName" },
    {
      title: "MP",
      key: "mp",
      render: (_: unknown, r: StandingsEntry) => r.wins + r.losses + r.draws,
    },
    {
      title: "Pts",
      dataIndex: "points",
      key: "points",
      sorter: (a: StandingsEntry, b: StandingsEntry) => a.points - b.points,
    },
    { title: "W", dataIndex: "wins", key: "wins" },
    { title: "L", dataIndex: "losses", key: "losses" },
    { title: "D", dataIndex: "draws", key: "draws" },
  ];

  if (isSwiss) {
    columns.push({
      title: "Buchholz",
      key: "buchholz",
      render: (_: unknown, r: StandingsEntry) =>
        r.stats.buchholz?.toFixed(1) ?? "-",
    });
  }

  if (!isKnockout && !isSwiss) {
    columns.push(
      {
        title: "GF",
        key: "gf",
        render: (_: unknown, r: StandingsEntry) => r.stats.goalsFor ?? "-",
      },
      {
        title: "GA",
        key: "ga",
        render: (_: unknown, r: StandingsEntry) => r.stats.goalsAgainst ?? "-",
      },
      {
        title: "GD",
        key: "gd",
        render: (_: unknown, r: StandingsEntry) => {
          const gd = (r.stats.goalsFor ?? 0) - (r.stats.goalsAgainst ?? 0);
          return (
            <span>
              {gd > 0 ? "+" : ""}
              {gd}
            </span>
          );
        },
      },
    );
  }
  columns.push({
    title: "Qualified",
    key: "qualified",
    render: (q: boolean) => (q ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
  });

  return (
    <div ref={tableRef}>
      {!hideHeader && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            {event.coverImage && (
              <img
                src={event.coverImage}
                alt={event.name}
                style={{
                  height: 32,
                  borderRadius: 6,
                  marginRight: 12,
                  verticalAlign: "middle",
                }}
              />
            )}
            <Title level={4} style={{ display: "inline", margin: 0 }}>
              {event.name} — Standings
            </Title>
          </div>
          <Space>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => exportStandings("png")}
            >
              PNG
            </Button>
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => exportStandings("pdf")}
            >
              PDF
            </Button>
          </Space>
        </div>
      )}
      <Table
        dataSource={standings}
        rowKey="participantId"
        pagination={false}
        columns={columns}
      />
    </div>
  );
}
