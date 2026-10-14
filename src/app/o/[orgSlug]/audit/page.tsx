"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button, message, Tag } from "antd";
import { AuditOutlined, UndoOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { getAuditLogPage, undoAudit } from "@/domain/audit";
import type { AuditEntry } from "@/domain/types";
import styles from "../command.module.css";
import { SystemTable, type SystemTableQuery } from "@/components/common/system-table";

export default function AuditPage() {
  const { currentOrg } = useApp();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const lastQuery = useRef<SystemTableQuery>({ page: 1, pageSize: 10, search: "", filters: {} });
  const refresh = useCallback(async (query = lastQuery.current) => {
    if (!currentOrg) return;
    lastQuery.current = query;
    setLoading(true);
    try {
      const result = await getAuditLogPage(currentOrg.id, { page: query.page, pageSize: query.pageSize, search: query.search, resourceTypes: query.filters.resourceType?.map(String), sortField: query.sortField, sortOrder: query.sortOrder });
      setEntries(result.items); setTotal(result.total);
    } catch (error) { message.error(error instanceof Error ? error.message : "Could not load audit entries"); }
    finally { setLoading(false); }
  }, [currentOrg]);
  const server = useMemo(() => ({ total, onChange: refresh }), [refresh, total]);
  if (!currentOrg) return null;
  const undo = async (id: string) => { if (await undoAudit(id)) { message.success("Action reversed"); await refresh(); } else message.error("This action could not be reversed"); };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Governance and recovery</span><h1 className="page-title">Nothing happens in the dark.</h1><p className="page-subtitle">Review the latest organization changes, understand their scope, and reverse supported actions.</p></div></header>
      <div className={styles.auditBanner}><AuditOutlined /><div><strong>Traceable by design</strong><span>Search the full organization history. Undo is available where a valid snapshot exists.</span></div><b>{total} entries</b></div>
      <SystemTable tableId="audit" server={server} dataSource={entries} rowKey="id" loading={loading} searchText={(entry) => `${entry.action} ${entry.resourceType} ${entry.resourceId} ${Object.keys(entry.diff).join(" ")}`} scroll={{ x: 850 }} columns={[
        { title: "Action", dataIndex: "action", key: "action", render: (value: string) => <Tag>{value}</Tag> },
        { title: "Resource", dataIndex: "resourceType", key: "resourceType", filters: [...new Set(entries.map((entry) => entry.resourceType))].map((value) => ({ text: value, value })) },
        { title: "ID", dataIndex: "resourceId", key: "resourceId", ellipsis: true, width: 180 },
        { title: "Changed fields", dataIndex: "diff", key: "diff", render: (diff: Record<string,unknown>) => Object.keys(diff).join(", ") || "None" },
        { title: "Date", dataIndex: "createdAt", key: "createdAt", render: (date: string) => new Date(date).toLocaleString() },
        { title: "", key: "actions", render: (_: unknown, record: AuditEntry) => <Button size="small" icon={<UndoOutlined />} onClick={() => undo(record.id)}>Undo</Button> },
      ]} />
    </>
  );
}
