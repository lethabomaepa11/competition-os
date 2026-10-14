"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Breadcrumb, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Spin, Typography, message, Switch, Divider } from "antd";
import { EventService } from "@/domain/services/event.service";
import type { Event } from "@/domain/event";
import { useApp } from "@/lib/app-context";
import { canManageCompetition } from "@/lib/permissions";
import { CompetitionService } from "@/domain/services/competition.service";
import ImageUpload from "@/components/upload/image-upload";
import { EventStatus, RegistrationPolicy, ParticipantType, FormatType } from "@/domain/types";

const { Title, Text } = Typography;

export default function EventSettingsPage() {
  const params = useParams<{ orgSlug: string; compId: string; eventId: string }>();
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [event, setEvent] = useState<Event | null>(null);
  const [competitionName, setCompetitionName] = useState("");
  const [competitionCategory, setCompetitionCategory] = useState("");
  const [hasFixtures, setHasFixtures] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!currentOrg || !currentMember) return;
      const [item, competition, allowed, stages] = await Promise.all([
        new EventService().get(params.eventId),
        new CompetitionService().get(params.compId),
        canManageCompetition(currentMember.id, currentOrg.id),
        new EventService().getStages(params.eventId),
      ]);
      if (!active) return;
      if (!item || item.competitionId !== params.compId || !competition || competition.organizationId !== currentOrg.id) {
        message.error("Event not found");
        router.push(`/o/${currentOrg.slug}/competitions`);
        return;
      }
      setEvent(item);
      setCompetitionName(competition.name);
      setCompetitionCategory(competition.category);
      setHasFixtures(stages.length > 0);
      setAuthorized(allowed);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [currentOrg, currentMember, params.compId, params.eventId, router, form]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const save = async (values: Partial<Event>) => {
    if (!event || !currentMember || !authorized) return;
    if (values.minParticipants && values.maxParticipants && values.minParticipants > values.maxParticipants) {
      form.setFields([{ name: "maxParticipants", errors: ["Maximum entrants must be at least the minimum"] }]);
      return;
    }
    setSaving(true);
    try {
      const updates = {
        ...values,
        config: { ...event.config, ...(values.config ?? {}) },
        dateStart: values.dateStart ? new Date(values.dateStart).toISOString() : undefined,
        dateEnd: values.dateEnd ? new Date(values.dateEnd).toISOString() : undefined,
      };
      const updated = await new EventService().update(event.id, updates, currentMember.id);
      if (updated) {
        setEvent(updated);
        form.setFieldsValue({ ...updated, dateStart: updated.dateStart?.slice(0, 16), dateEnd: updated.dateEnd?.slice(0, 16) });
      }
      setDirty(false);
      message.success("Event settings saved");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not save event settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loading"><Spin size="large" /></div>;
  if (!event || !currentOrg) return null;
  const cancel = () => {
    if (dirty && !window.confirm("Discard your unsaved event changes?")) return;
    router.push(`/o/${currentOrg.slug}/competitions/${params.compId}/events/${event.id}`);
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <Breadcrumb items={[
        { title: <Link href={`/o/${currentOrg.slug}/competitions`}>Competitions</Link> },
        { title: <Link href={`/o/${currentOrg.slug}/competitions/${params.compId}`}>{competitionName}</Link> },
        { title: <Link href={`/o/${currentOrg.slug}/competitions/${params.compId}/events/${event.id}`}>{event.name}</Link> },
        { title: "Settings" },
      ]} />
      <Space orientation="vertical" size={4} style={{ margin: "20px 0" }}>
        <Title level={2} style={{ margin: 0 }}>Event settings</Title>
        <Text type="secondary">Manage format, entry, scheduling, scoring, publishing and game links. Existing registrations and results retain their event IDs.</Text>
        {dirty && <Text type="warning">You have unsaved changes.</Text>}
      </Space>
      {!authorized ? <Alert type="error" showIcon message="You need an owner or admin role to edit this event." /> : (
        <Form form={form} initialValues={{ ...event, dateStart: event.dateStart?.slice(0, 16), dateEnd: event.dateEnd?.slice(0, 16) }} layout="vertical" onValuesChange={() => setDirty(true)} onFinish={save} requiredMark="optional">
          <Card title="Identity and appearance" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={24} md={15}>
                <Form.Item label="Event name" name="name" rules={[{ required: true }, { min: 2, max: 100 }]} extra="Renaming changes the display label only; registrations and scores remain linked to this event."><Input size="large" maxLength={100} /></Form.Item>
                <Form.Item label="Event image" name="coverImage"><ImageUpload currentUrl={event.coverImage} onUpload={(url) => form.setFieldValue("coverImage", url)} /></Form.Item>
                <Form.Item label="Public page accent color" name="themeColor" rules={[{ pattern: /^#[0-9A-Fa-f]{6}$/, message: "Enter a six-digit hex color such as #1C5FD4" }]} extra="Optional. Applies to this event’s public view and keeps operator navigation unchanged."><Input placeholder="#1C5FD4" maxLength={7} /></Form.Item>
              </Col>
              <Col xs={24} md={9}><Alert type="info" showIcon title="Image uploads live here" description="The event page stays focused on fixtures and operations. Change its cover image from settings." /></Col>
            </Row>
          </Card>
          <Card title="Entry and capacity" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item label="Entry type" name="participantType"><Select size="large" options={[{ value: ParticipantType.Team, label: "Teams" }, { value: ParticipantType.Individual, label: "Individual players" }]} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="Registration policy" name="registrationPolicy"><Select size="large" options={Object.values(RegistrationPolicy).map((policy) => ({ value: policy, label: policy.replaceAll("_", " ") }))} /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item label="Minimum entrants" name="minParticipants"><InputNumber min={2} style={{ width: "100%" }} /></Form.Item></Col>
              <Col xs={24} md={4}><Form.Item label="Maximum entrants" name="maxParticipants"><InputNumber min={2} style={{ width: "100%" }} /></Form.Item></Col>
            </Row>
          </Card>
          <Card title="Format and scoring" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Competition format" name="format" extra={hasFixtures ? "Format is locked after fixtures are generated so existing match and score history stays intact." : "Choose the structure used to generate stages and fixtures."}>
                  <Select disabled={hasFixtures} size="large" options={Object.values(FormatType).map((format) => ({ value: format, label: format.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Score label" name={["config", "scoreLabel"]} extra="Shown beside submitted match values; does not change stored scores.">
                  <Select size="large" options={["Goals", "Points", "Runs", "Sets", "Maps", "Rounds", "Time", "Score"].map((label) => ({ value: label, label }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Public scoring breakdown" name={["config", "showScoreBreakdown"]} valuePropName="checked" extra="Show component score values in public results."><Switch /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Scoring instructions" name={["config", "scoringInstructions"]}><Input.TextArea rows={3} maxLength={500} placeholder="Explain tie-breaks or scoring conventions for this event" /></Form.Item>
              </Col>
            </Row>
          </Card>
          {competitionCategory === "esports" && <Card title="Game identity and integrations" style={{ marginBottom: 16 }}>
            <Alert type="info" showIcon title="Game metadata is optional" description="Choose the game and add official references to help teams understand eligibility and follow the event." style={{ marginBottom: 16 }} />
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item label="Game" name={["config", "gameId"]}><Select showSearch optionFilterProp="label" size="large" placeholder="Choose a game" options={["Counter-Strike 2", "Dota 2", "League of Legends", "Valorant", "Rocket League", "EA SPORTS FC", "PUBG", "Overwatch 2", "Mobile Legends: Bang Bang", "Other"].map((game) => ({ value: game.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: game }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="Official game page" name={["config", "gameUrl"]} rules={[{ type: "url", warningOnly: true, message: "Enter a complete URL starting with https://" }]}><Input placeholder="https://" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="External tournament ID" name={["config", "externalTournamentId"]}><Input maxLength={120} placeholder="Optional provider reference" /></Form.Item></Col>
            </Row>
          </Card>}
          <Card title="Schedule and status" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={8}><Form.Item label="Starts" name="dateStart"><Input type="datetime-local" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="Ends" name="dateEnd" dependencies={["dateStart"]} rules={[({ getFieldValue }) => ({ validator(_, value) { const start = getFieldValue("dateStart"); return !start || !value || new Date(value) >= new Date(start) ? Promise.resolve() : Promise.reject(new Error("End time must be after the start time")); } })]}><Input type="datetime-local" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item label="Status" name="status"><Select options={Object.values(EventStatus).map((status) => ({ value: status, label: status.replaceAll("_", " ") }))} /></Form.Item></Col>
            </Row>
          </Card>
          <Card title="Registration and publication" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item label="Registration notice" name={["config", "registrationNotice"]} extra="Optional instructions shown with event registration links."><Input.TextArea rows={3} maxLength={700} placeholder="Eligibility, required documents, or contact details" /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="Public results" name={["config", "publicResults"]} valuePropName="checked" extra="Allow public viewers to see standings, brackets, and results."><Switch /></Form.Item><Form.Item label="Require operator approval" name="registrationPolicy" valuePropName="checked" getValueProps={(policy: RegistrationPolicy) => ({ checked: policy === RegistrationPolicy.ApprovalRequired })} getValueFromEvent={(checked: boolean) => checked ? RegistrationPolicy.ApprovalRequired : RegistrationPolicy.Open}><Switch /></Form.Item></Col>
            </Row>
            <Divider />
            <Text type="secondary">Publication status controls whether this event accepts registrations. Existing approvals and registrations are retained when this setting changes.</Text>
          </Card>
          <Space>
            <Button onClick={cancel}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} disabled={!dirty}>{dirty ? "Save changes" : "All changes saved"}</Button>
          </Space>
        </Form>
      )}
    </div>
  );
}
