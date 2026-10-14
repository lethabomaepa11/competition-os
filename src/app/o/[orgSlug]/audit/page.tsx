"use client";

import { useEffect, useState } from "react";
import { Button, message, Tag } from "antd";
import { AuditOutlined, UndoOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { getAuditLog, undoAudit } from "@/domain/audit";
import type { AuditEntry } from "@/domain/types";
import styles from "../command.module.css";
import { SystemTable } from "@/components/common/system-table";

export default function AuditPage() {
  const { currentOrg } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => { if (currentOrg) { setLoading(true); setEntries(await getAuditLog(currentOrg.id, { limit: 50 })); setLoading(false); } };
  useEffect(() => {
    if (!currentOrg) return;
    let active = true;
    getAuditLog(currentOrg.id, { limit: 50 }).then((items) => { if (active) { setEntries(items); setLoading(false); } });
    return () => { active = false; };
  }, [currentOrg]);
  if (!currentOrg) return null;
  const undo = async (id: string) => { if (await undoAudit(id)) { message.success("Action reversed"); await refresh(); } else message.error("This action could not be reversed"); };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Governance and recovery</span><h1 className="page-title">Nothing happens in the dark.</h1><p className="page-subtitle">Review the latest organization changes, understand their scope, and reverse supported actions.</p></div></header>
      <div className={styles.auditBanner}><AuditOutlined /><div><strong>Traceable by design</strong><span>The latest 50 mutations are shown below. Undo is available where a valid snapshot exists.</span></div><b>{entries.length} entries</b></div>
      <SystemTable dataSource={entries} rowKey="id" loading={loading} searchText={(entry) => `${entry.action} ${entry.resourceType} ${entry.resourceId} ${Object.keys(entry.diff).join(" ")}`} scroll={{ x: 850 }} columns={[
        { title: "Action", dataIndex: "action", key: "action", render: (value: string) => <Tag>{value}</Tag> },
        { title: "Resource", dataIndex: "resourceType", key: "resourceType" },
        { title: "ID", dataIndex: "resourceId", key: "resourceId", ellipsis: true, width: 180 },
        { title: "Changed fields", dataIndex: "diff", key: "diff", render: (diff: Record<string,unknown>) => Object.keys(diff).join(", ") || "None" },
        { title: "Date", dataIndex: "createdAt", key: "createdAt", render: (date: string) => new Date(date).toLocaleString() },
        { title: "", key: "actions", render: (_: unknown, record: AuditEntry) => <Button size="small" icon={<UndoOutlined />} onClick={() => undo(record.id)}>Undo</Button> },
      ]} />
    </>
  );
}
