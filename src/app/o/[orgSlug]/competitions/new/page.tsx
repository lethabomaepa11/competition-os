"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Form, Input, message, Select } from "antd";
import { ArrowRightOutlined, EyeOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { ParticipantType, RegistrationPolicy, Visibility } from "@/domain/types";
import { SPORT_CATEGORIES } from "@/domain/categories";
import { GetWhere, create as createRecord } from "@/lib/store";
import { generateId } from "@/lib/id";
import { EventService } from "@/domain/services/event.service";
import { ProgressionService } from "@/domain/services/progression.service";
import type { BlueprintRecord, CompetitionBlueprintConfig } from "@/domain/blueprints";
import { blueprintType, isBlueprintCompatible, normalizeCompetitionBlueprint } from "@/domain/blueprints";
import styles from "./page.module.css";

type Values = { name: string; description: string; category: string; discipline?: string; entryType: ParticipantType; region?: string; minRosterSize?: number; maxRosterSize?: number; visibility: Visibility; blueprintId?: string };

export default function NewCompetitionPage() {
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [loading, setLoading] = useState(false);
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [saveAsBlueprint, setSaveAsBlueprint] = useState(false);
  const [form] = Form.useForm<Values>();
  const name = Form.useWatch("name", form);
  const description = Form.useWatch("description", form);
  const discipline = Form.useWatch("discipline", form);
  const category = Form.useWatch("category", form);
  const entryType = Form.useWatch("entryType", form);
  const visibility = Form.useWatch("visibility", form);
  useEffect(() => {
    if (!currentOrg) return;
    let active = true;
    void GetWhere<BlueprintRecord>("blueprints", { organizationId: currentOrg.id }).then((items) => {
      if (active) setBlueprints(items.filter((item) => blueprintType(item) === "competition"));
    });
    return () => { active = false; };
  }, [currentOrg]);
  if (!currentOrg) return null;

  const create = async (values: Values) => {
    if (!currentMember) return;
    setLoading(true);
    try {
      const blueprint = blueprints.find((item) => item.id === values.blueprintId);
      const template = normalizeCompetitionBlueprint(blueprint?.config);
      const competition = await new CompetitionService().create({ organizationId: currentOrg.id, name: values.name.trim(), description: values.description.trim(), category: values.category, entryType: values.entryType, eligibility: { region: values.region?.trim(), minRosterSize: values.minRosterSize, maxRosterSize: values.maxRosterSize }, visibility: values.visibility, game: values.discipline ? { name: values.discipline.trim(), category: values.category } : { name: values.category, category: values.category } }, currentMember.id);
      const eventService = new EventService();
      for (const eventBlueprint of template?.events ?? []) {
        const event = await eventService.create({ competitionId: competition.id, name: eventBlueprint.event.name, format: eventBlueprint.event.format, participantType: eventBlueprint.event.participantType, registrationPolicy: eventBlueprint.event.registrationPolicy ?? RegistrationPolicy.Open, minParticipants: eventBlueprint.event.minParticipants, maxParticipants: eventBlueprint.event.maxParticipants, config: eventBlueprint.event.config }, currentMember.id);
        await eventService.saveRuleSet(event.id, eventBlueprint.rules ?? []);
        if (eventBlueprint.progression?.length) await new ProgressionService().saveProgressionPlan(event.id, { phases: eventBlueprint.progression });
      }
      if (saveAsBlueprint) {
        const config: CompetitionBlueprintConfig = { type: "competition", competition: { name: competition.name, description: competition.description, category: competition.category, entryType: competition.entryType, eligibility: competition.eligibility, visibility: competition.visibility, game: competition.game }, events: template?.events ?? [] };
        const now = new Date().toISOString();
        await createRecord("blueprints", { id: generateId(), organizationId: currentOrg.id, name: competition.name, description: competition.description, config, version: 1, isPublic: false, createdAt: now, updatedAt: now });
      }
      message.success(template?.events?.length ? `Competition created with ${template.events.length} blueprint event${template.events.length === 1 ? "" : "s"}` : "Competition created");
      router.push(`/o/${currentOrg.slug}/competitions/${competition.id}`);
    } catch { message.error("Could not create the competition"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <header className="page-header"><div><span className="eyebrow">New competition</span><h1 className="page-title">Name the arena.</h1><p className="page-subtitle">Create the competition identity first. Events, formats, rules, registration, and schedules come next.</p></div></header>
      <div className={styles.builder}>
        <section className={styles.formPanel}>
          <div className={styles.step}><span>01</span><div><strong>Competition identity</strong><small>Required information shown to operators and participants.</small></div></div>
          <Form form={form} layout="vertical" onFinish={create} initialValues={{ visibility: Visibility.Public, category: "football", entryType: ParticipantType.Team }} requiredMark={false}>
            <Form.Item label="Start from a competition blueprint" name="blueprintId" extra="Applying a blueprint creates its events with fresh IDs and leaves existing records untouched.">
              <Select allowClear placeholder="Start from scratch" options={blueprints.map((item) => ({ value: item.id, label: isBlueprintCompatible(item) ? item.name : `${item.name} (version unavailable)`, disabled: !isBlueprintCompatible(item) }))} onChange={(id) => {
                const blueprint = blueprints.find((item) => item.id === id);
                const template = normalizeCompetitionBlueprint(blueprint?.config);
                if (!template) return;
                form.setFieldsValue({ name: template.competition.name, description: template.competition.description, category: template.competition.category, discipline: template.competition.game?.name, entryType: template.competition.entryType, visibility: template.competition.visibility, region: String(template.competition.eligibility?.region ?? ""), minRosterSize: Number(template.competition.eligibility?.minRosterSize) || undefined, maxRosterSize: Number(template.competition.eligibility?.maxRosterSize) || undefined });
              }} />
            </Form.Item>
            <Form.Item label="Competition name" name="name" rules={[{ required: true, message: "Enter the competition name" }, { min: 3, message: "Use at least 3 characters" }, { max: 90, message: "Keep the name under 90 characters" }]}><Input size="large" placeholder="e.g. 2026 Continental Champions Cup" showCount maxLength={90} /></Form.Item>
            <Form.Item label="Competition description" name="description" rules={[{ required: true, message: "Describe the competition" }, { min: 20, message: "Use at least 20 characters so participants understand the competition" }, { max: 600, message: "Keep the description under 600 characters" }]} extra="Explain who it is for, what is being contested, and what makes this competition distinct."><Input.TextArea rows={6} placeholder="A season-long competition bringing together…" showCount maxLength={600} /></Form.Item>
            <div className={styles.fieldPair}>
              <Form.Item label="Sport or category" name="category" rules={[{ required: true, message: "Select a competition category" }]}><Select size="large" options={SPORT_CATEGORIES.map((item) => ({ ...item }))} /></Form.Item>
              <Form.Item label="Who can register" name="entryType" rules={[{ required: true }]}><Select size="large" options={[{ value: ParticipantType.Team, label: "Teams" }, { value: ParticipantType.Individual, label: "Individual players" }]} /></Form.Item>
            </div>
            <Form.Item label="Sport, game, or discipline" name="discipline" extra="This helps participants understand the competition at a glance."><Input size="large" placeholder="e.g. Football, Counter-Strike 2, Debate" /></Form.Item>
            <Form.Item label="Eligible region" name="region" extra="Leave broad for open competitions, or name the eligible country, province, campus, or association."><Input size="large" placeholder="e.g. South Africa, Gauteng, UEFA member associations" /></Form.Item>
            {entryType === ParticipantType.Team && <div className={styles.fieldPair}>
              <Form.Item label="Minimum roster" name="minRosterSize"><Input type="number" min={1} size="large" placeholder="11" /></Form.Item>
              <Form.Item label="Maximum roster" name="maxRosterSize"><Input type="number" min={1} size="large" placeholder="25" /></Form.Item>
            </div>}
            <Form.Item label="Initial visibility" name="visibility" rules={[{ required: true }]}><Select size="large" options={[{ value: Visibility.Public, label: "Public — visible to everyone" }, { value: Visibility.Hidden, label: "Unlisted — available by link" }, { value: Visibility.Private, label: "Private — organization access only" }]} /></Form.Item>
            <Form.Item><Checkbox checked={saveAsBlueprint} onChange={(event) => setSaveAsBlueprint(event.target.checked)}>Create competition and save as blueprint</Checkbox></Form.Item>
            <div className={styles.actions}><Button size="large" onClick={() => router.back()}>Cancel</Button><Button type="primary" htmlType="submit" loading={loading} size="large">Create competition <ArrowRightOutlined /></Button></div>
          </Form>
        </section>
        <aside className={styles.preview}>
          <div className={styles.previewTop}><span><EyeOutlined /> Public identity preview</span><TagLabel visibility={visibility ?? Visibility.Public} /></div>
          <div className={styles.previewBody}><span>{discipline || category || "Competition discipline"} · {entryType === ParticipantType.Individual ? "Individual entry" : "Team entry"}</span><h2>{name || "Your competition name"}</h2><p>{description || "A clear description tells participants, teams, partners, and audiences exactly what this competition is about."}</p></div>
          <div className={styles.previewFooter}><SafetyCertificateOutlined /><span><strong>Safe draft</strong><small>Creating this competition does not publish events or fixtures. You control when it goes live.</small></span></div>
        </aside>
      </div>
    </>
  );
}

function TagLabel({ visibility }: { visibility: Visibility }) {
  return <b>{visibility === Visibility.Public ? "Public" : visibility === Visibility.Hidden ? "Unlisted" : "Private"}</b>;
}
