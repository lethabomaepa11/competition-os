"use client";

import { useRef, useCallback, useMemo } from "react";
import { Card, Typography, Space, Button, message } from "antd";
import { DownloadOutlined, FilePdfOutlined } from "@ant-design/icons";
import type { StandingsEntry } from "@/domain/formats/interface";
import type { Event } from "@/domain/event";
import { StandingsTable } from "@/components/standings/standings-table";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

const { Title } = Typography;

interface Props {
  standings: StandingsEntry[];
  event: Event;
  groupNames: string[];
}

export function GroupStandingsView({ standings, event, groupNames }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const groupedStandings = useMemo(() => {
    return groupNames.map((_, idx) => ({
      name: groupNames[idx],
      entries: standings.filter((s) => s.stats?.groupIndex === idx),
    }));
  }, [standings, groupNames]);

  const exportAll = useCallback(async (format: "png" | "pdf") => {
    if (!wrapperRef.current) return;
    try {
      const dataUrl = await toPng(wrapperRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${event.name}-group-standings.png`;
        link.href = dataUrl;
        link.click();
      } else {
        const pdf = new jsPDF({ orientation: "portrait", unit: "px" });
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        let heightRemaining = pdfHeight;
        let posY = 0;
        while (heightRemaining > 0) {
          if (posY > 0) pdf.addPage();
          pdf.addImage(dataUrl, "PNG", 0, posY, pdfWidth, pdfHeight, undefined, "FAST");
          heightRemaining -= pdf.internal.pageSize.getHeight();
          posY -= pdf.internal.pageSize.getHeight();
        }
      }
      message.success(`All group standings exported as ${format.toUpperCase()}`);
    } catch {
      message.error("Failed to export standings");
    }
  }, [event.name]);

  return (
    <div ref={wrapperRef}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>{event.name} — Standings</Title>
        <Space>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => exportAll("png")}
          >
            Export All PNG
          </Button>
          <Button
            size="small"
            icon={<FilePdfOutlined />}
            onClick={() => exportAll("pdf")}
          >
            Export All PDF
          </Button>
        </Space>
      </div>
      {groupedStandings.map((group) => (
        <Card
          key={group.name}
          title={`Group ${group.name}`}
          style={{ marginBottom: 16 }}
        >
          <StandingsTable
            standings={group.entries}
            event={event}
            hideGroupColumn
            hideHeader
          />
        </Card>
      ))}
    </div>
  );
}
