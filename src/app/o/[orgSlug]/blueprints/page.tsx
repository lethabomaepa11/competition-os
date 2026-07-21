"use client";

import { useEffect, useState } from "react";
import { Table, Typography, Button, Modal, Form, Input, message, Tag } from "antd";
import { PlusOutlined, ExportOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import type { Competition } from "@/domain/competition";
import type { Event } from "@/domain/event";
import { GetAll, GetWhere, create, Delete, Get } from "@/lib/store";
import { generateId } from "@/lib/id";

const { Title } = Typography;
const BLUEPRINT_KEY = "blueprints";

interface Blueprint {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  config: { competition: Competition; events: Event[] };
  version: number;
  isPublic: boolean;
  createdAt: string;
}

export default function BlueprintsPage() {
  const { currentOrg } = useApp();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [bpName, setBpName] = useState("");
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  const compSvc = new CompetitionService();
  const evtSvc = new EventService();

  const refresh = async () => {
    if (!currentOrg) return;
    const [all, comps] = await Promise.all([
      GetWhere<Blueprint>(BLUEPRINT_KEY, { organizationId: currentOrg.id }),
      compSvc.list(currentOrg.id),
    ]);
    setBlueprints(all);
    setCompetitions(comps);
  };

  useEffect(() => { refresh(); }, [currentOrg]);

  const handleSaveBlueprint = async () => {
    if (!currentOrg || !selectedComp || !bpName) return;
    const comp = await compSvc.get(selectedComp);
    if (!comp) return;
    const events = await evtSvc.list(comp.id);
    const bp: Blueprint = {
      id: generateId(),
      organizationId: currentOrg.id,
      name: bpName,
      description: comp.description,
      config: { competition: comp, events },
      version: 1,
      isPublic: false,
      createdAt: new Date().toISOString(),
    };
    await create(BLUEPRINT_KEY, bp);
    message.success("Blueprint saved!");
    setCreateOpen(false);
    await refresh();
  };

  const handleExport = (bp: Blueprint) => {
    const blob = new Blob([JSON.stringify(bp.config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bp.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentOrg) return null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Blueprints</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Save as Blueprint
        </Button>
      </div>
      <Table
        dataSource={blueprints}
        rowKey="id"
        columns={[
          { title: "Name", dataIndex: "name", key: "name" },
          { title: "Description", dataIndex: "description", key: "description", ellipsis: true },
          { title: "Version", dataIndex: "version", key: "version" },
          { title: "Created", dataIndex: "createdAt", key: "createdAt", render: (d: string) => new Date(d).toLocaleDateString() },
          {
            title: "Actions", key: "actions",
            render: (_: unknown, record: Blueprint) => (
              <Button size="small" icon={<ExportOutlined />} onClick={() => handleExport(record)}>
                Export
              </Button>
            ),
          },
        ]}
      />

      <Modal title="Save Blueprint" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={handleSaveBlueprint}>
        <Form layout="vertical">
          <Form.Item label="Blueprint Name" required>
            <Input value={bpName} onChange={(e) => setBpName(e.target.value)} placeholder="e.g., Corporate Gaming League" />
          </Form.Item>
          <Form.Item label="From Competition" required>
            <select
              value={selectedComp ?? ""}
              onChange={(e) => setSelectedComp(e.target.value)}
              style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: "1px solid #d9d9d9" }}
            >
              <option value="">Select competition...</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
