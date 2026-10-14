"use client";

import { useEffect, useState } from "react";
import { Button, Form, Input, message, Modal, Select, Table, Tag } from "antd";
import { ApartmentOutlined, ExportOutlined, PlusOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import type { Competition } from "@/domain/competition";
import type { Event } from "@/domain/event";
import { GetWhere, create } from "@/lib/store";
import { generateId } from "@/lib/id";
import styles from "../command.module.css";

interface Blueprint { id: string; organizationId: string; name: string; description: string; config: { competition: Competition; events: Event[] }; version: number; isPublic: boolean; createdAt: string }

export default function BlueprintsPage() {
  const { currentOrg } = useApp();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState("");
  const refresh = async () => { if (currentOrg) { const [items, comps] = await Promise.all([GetWhere<Blueprint>("blueprints", { organizationId: currentOrg.id }), new CompetitionService().list(currentOrg.id)]); setBlueprints(items); setCompetitions(comps); } };
  useEffect(() => {
    if (!currentOrg) return;
    let active = true;
    Promise.all([GetWhere<Blueprint>("blueprints", { organizationId: currentOrg.id }), new CompetitionService().list(currentOrg.id)]).then(([items, comps]) => {
      if (active) { setBlueprints(items); setCompetitions(comps); }
    });
    return () => { active = false; };
  }, [currentOrg]);
  if (!currentOrg) return null;

  const save = async () => {
    if (!selected || !name) return;
    const competition = await new CompetitionService().get(selected);
    if (!competition) return;
    const events = await new EventService().list(competition.id);
    await create("blueprints", { id: generateId(), organizationId: currentOrg.id, name, description: competition.description, config: { competition, events }, version: 1, isPublic: false, createdAt: new Date().toISOString() });
    message.success("Blueprint saved"); setOpen(false); await refresh();
  };
  const exportBlueprint = (blueprint: Blueprint) => { const url = URL.createObjectURL(new Blob([JSON.stringify(blueprint.config, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `${blueprint.name}.json`; link.click(); URL.revokeObjectURL(url); };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Reusable operating models</span><h1 className="page-title">Blueprint the winning formula.</h1><p className="page-subtitle">Package formats, events, and configuration into a repeatable starting point for the next season.</p></div><div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Save blueprint</Button></div></header>
      {blueprints.length === 0 ? <div className={styles.emptyState}><ApartmentOutlined /><h2>No blueprints saved.</h2><p>Turn a proven competition into a reusable operating model.</p><Button type="primary" onClick={() => setOpen(true)}>Create a blueprint</Button></div> : <Table dataSource={blueprints} rowKey="id" scroll={{ x: 680 }} columns={[
        { title: "Blueprint", dataIndex: "name", key: "name", render: (value: string, record) => <div className={styles.competitionName}><span>{value}</span><small>{record.description || "Reusable competition configuration"}</small></div> },
        { title: "Version", dataIndex: "version", key: "version", render: (version: number) => <Tag>V{version}</Tag> },
        { title: "Created", dataIndex: "createdAt", key: "createdAt", render: (date: string) => new Date(date).toLocaleDateString() },
        { title: "", key: "actions", render: (_: unknown, record: Blueprint) => <Button icon={<ExportOutlined />} onClick={() => exportBlueprint(record)}>Export</Button> },
      ]} />}
      <Modal title="Save competition blueprint" open={open} onCancel={() => setOpen(false)} onOk={save} okText="Save blueprint" width={520}><p className={styles.modalCopy}>Capture a competition and its events as a versioned template.</p><Form layout="vertical"><Form.Item label="Blueprint name" required><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. 32 Team Continental Cup" size="large" /></Form.Item><Form.Item label="Source competition" required><Select value={selected} onChange={setSelected} size="large" placeholder="Choose a competition" options={competitions.map((item) => ({ value: item.id, label: item.name }))} /></Form.Item></Form></Modal>
    </>
  );
}
