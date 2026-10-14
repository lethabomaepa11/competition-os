"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Form, Input, message, Modal, Select, Segmented, Tag } from "antd";
import { ApartmentOutlined, ExportOutlined, PlusOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { ProgressionService } from "@/domain/services/progression.service";
import type { Competition } from "@/domain/competition";
import type { Event } from "@/domain/event";
import type { BlueprintRecord, BlueprintType, CompetitionBlueprintConfig, EventBlueprintConfig } from "@/domain/blueprints";
import { blueprintType } from "@/domain/blueprints";
import { GetWhere, create } from "@/lib/store";
import { generateId } from "@/lib/id";
import styles from "../command.module.css";
import { SystemTable } from "@/components/common/system-table";

export default function BlueprintsPage() {
  const { currentOrg } = useApp();
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<BlueprintType>("competition");
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState("");

  const refresh = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [items, comps] = await Promise.all([
        GetWhere<BlueprintRecord>("blueprints", { organizationId: currentOrg.id }),
        new CompetitionService().list(currentOrg.id),
      ]);
      const nestedEvents = await Promise.all(comps.map((competition) => new EventService().list(competition.id)));
      setBlueprints(items);
      setCompetitions(comps);
      setEvents(nestedEvents.flat());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not load blueprints");
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  if (!currentOrg) return null;

  const save = async () => {
    if (!selected || !name.trim()) return message.error("Enter a name and choose a source");
    setSaving(true);
    try {
      const service = new EventService();
      let config: CompetitionBlueprintConfig | EventBlueprintConfig;
      let description = "";
      if (kind === "event") {
        const event = await service.get(selected);
        if (!event || !events.some((item) => item.id === selected)) throw new Error("Event source is unavailable");
        const [rules, progression] = await Promise.all([service.getRuleSet(event.id), new ProgressionService().getProgressionPlan(event.id)]);
        config = { type: "event", event: { name: event.name, format: event.format, participantType: event.participantType, registrationPolicy: event.registrationPolicy, minParticipants: event.minParticipants, maxParticipants: event.maxParticipants, config: event.config }, rules: rules?.rules ?? [], progression: progression?.phases ?? [] };
        description = `Event blueprint · ${event.format.replaceAll("_", " ")}`;
      } else {
        const competition = await new CompetitionService().get(selected);
        if (!competition || competition.organizationId !== currentOrg.id) throw new Error("Competition source is unavailable");
        const sourceEvents = await service.list(competition.id);
        const eventConfigs = await Promise.all(sourceEvents.map(async (event) => {
          const [rules, progression] = await Promise.all([service.getRuleSet(event.id), new ProgressionService().getProgressionPlan(event.id)]);
          return { type: "event" as const, event: { name: event.name, format: event.format, participantType: event.participantType, registrationPolicy: event.registrationPolicy, minParticipants: event.minParticipants, maxParticipants: event.maxParticipants, config: event.config }, rules: rules?.rules ?? [], progression: progression?.phases ?? [] };
        }));
        config = { type: "competition", competition: { name: competition.name, description: competition.description, category: competition.category, entryType: competition.entryType, eligibility: competition.eligibility, visibility: competition.visibility, game: competition.game }, events: eventConfigs };
        description = competition.description;
      }
      const now = new Date().toISOString();
      await create("blueprints", { id: generateId(), organizationId: currentOrg.id, name: name.trim(), description, config, version: 1, isPublic: false, createdAt: now, updatedAt: now });
      message.success(`${kind === "event" ? "Event" : "Competition"} blueprint saved`);
      setOpen(false);
      setName("");
      setSelected(undefined);
      await refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not save blueprint");
    } finally {
      setSaving(false);
    }
  };

  const exportBlueprint = (blueprint: BlueprintRecord) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(blueprint, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${blueprint.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <>
    <header className="page-header">
      <div><span className="eyebrow">Reusable operating models</span><h1 className="page-title">Blueprint the winning formula.</h1><p className="page-subtitle">Save competition programmes or event formats and rules for consistent reuse.</p></div>
      <div className="page-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Save blueprint</Button></div>
    </header>
    {blueprints.length === 0 && !loading ? <div className={styles.emptyState}><ApartmentOutlined /><h2>No blueprints saved.</h2><p>Save a competition or event configuration to reuse it when planning the next season.</p><Button type="primary" onClick={() => setOpen(true)}>Create a blueprint</Button></div> : <SystemTable tableId="blueprints" dataSource={blueprints} loading={loading} rowKey="id" searchText={(blueprint) => `${blueprint.name} ${blueprint.description} ${blueprintType(blueprint)}`} scroll={{ x: 760 }} columns={[
      { title: "Blueprint", dataIndex: "name", key: "name", render: (value: string, record) => <div className={styles.competitionName}><span>{value}</span><small>{record.description || "Reusable configuration"}</small></div> },
      { title: "Type", key: "type", render: (_: unknown, record) => <Tag color="blue">{blueprintType(record)}</Tag> },
      { title: "Version", dataIndex: "version", key: "version", render: (version: number) => <Tag>V{version}</Tag> },
      { title: "Created", dataIndex: "createdAt", key: "createdAt", render: (date: string) => new Date(date).toLocaleDateString() },
      { title: "", key: "actions", render: (_: unknown, record) => <Button icon={<ExportOutlined />} onClick={() => exportBlueprint(record)}>Export</Button> },
    ]} />}
    <Modal title="Save a blueprint" open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} okText="Save blueprint" width={540}>
      <p className={styles.modalCopy}>Choose a competition to capture its event programme, or save one event format on its own.</p>
      <Form layout="vertical">
        <Form.Item label="Blueprint type"><Segmented value={kind} onChange={(value) => { setKind(value as BlueprintType); setSelected(undefined); }} options={[{ label: "Competition", value: "competition" }, { label: "Event", value: "event" }]} block /></Form.Item>
        <Form.Item label="Blueprint name" required><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={kind === "event" ? "e.g. 16-team knockout" : "e.g. 32-team continental cup"} size="large" maxLength={100} /></Form.Item>
        <Form.Item label={kind === "event" ? "Source event" : "Source competition"} required><Select value={selected} onChange={setSelected} size="large" placeholder="Choose a source" options={(kind === "event" ? events : competitions).map((item) => ({ value: item.id, label: item.name }))} /></Form.Item>
      </Form>
    </Modal>
  </>;
}
