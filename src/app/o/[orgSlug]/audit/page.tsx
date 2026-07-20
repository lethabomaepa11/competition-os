"use client";

import { useEffect, useState } from "react";
import { Table, Typography, Tag, Button, message } from "antd";
import { UndoOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { getAuditLog, undoAudit } from "@/domain/audit";
import type { AuditEntry } from "@/domain/types";

const { Title } = Typography;

export default function AuditPage() {
  const { currentOrg } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    (async () => {
      setEntries(await getAuditLog(currentOrg.id, { limit: 50 }));
    })();
  }, [currentOrg]);

  const handleUndo = async (id: string) => {
    const success = await undoAudit(id);
    if (success) {
      message.success("Action undone!");
      if (currentOrg) setEntries(await getAuditLog(currentOrg.id, { limit: 50 }));
    } else {
      message.error("Undo failed");
    }
  };

  if (!currentOrg) return null;

  return (
    <div>
      <Title level={3}>Audit Log</Title>
      <Table
        dataSource={entries}
        rowKey="id"
        columns={[
          { title: "Action", dataIndex: "action", key: "action", render: (a: string) => <Tag>{a}</Tag> },
          { title: "Resource", dataIndex: "resourceType", key: "resourceType" },
          { title: "Resource ID", dataIndex: "resourceId", key: "resourceId", ellipsis: true },
          {
            title: "Changes", dataIndex: "diff", key: "diff",
            render: (d: Record<string, unknown>) => (
              <span style={{ fontSize: 12 }}>{Object.keys(d).join(", ") || "none"}</span>
            ),
          },
          { title: "Date", dataIndex: "createdAt", key: "createdAt", render: (d: string) => new Date(d).toLocaleString() },
          {
            title: "Actions", key: "actions",
            render: (_: unknown, record: AuditEntry) => (
              <Button size="small" icon={<UndoOutlined />} onClick={() => handleUndo(record.id)}>
                Undo
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
