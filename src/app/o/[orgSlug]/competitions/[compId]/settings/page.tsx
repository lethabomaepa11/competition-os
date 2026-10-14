"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Breadcrumb, Button, Card, Col, ColorPicker, Form, Input, Row, Select, Space, Typography, message } from "antd";
import Link from "next/link";
import { CompetitionService } from "@/domain/services/competition.service";
import type { Competition } from "@/domain/competition";
import { ParticipantType, Visibility } from "@/domain/types";
import { SPORT_CATEGORIES } from "@/domain/categories";
import { useApp } from "@/lib/app-context";
import { canManageCompetition } from "@/lib/permissions";
import ImageUpload from "@/components/upload/image-upload";
import TipTapEditor from "@/components/editor/tiptap-editor";
import { PageLoader } from "@/components/common/page-loader";

const { Title, Text } = Typography;

export default function CompetitionSettingsPage() {
  const params = useParams<{ orgSlug: string; compId: string }>();
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!currentOrg || !currentMember) return;
      try {
      const service = new CompetitionService();
      const [item, allowed] = await Promise.all([
        service.get(params.compId),
        canManageCompetition(currentMember.id, currentOrg.id),
      ]);
      if (!active) return;
      if (!item || item.organizationId !== currentOrg.id) {
        message.error("Competition not found");
        router.push(`/o/${currentOrg.slug}/competitions`);
        return;
      }
      setCompetition(item);
      setAuthorized(allowed);
      } catch (error) {
        if (active) message.error(error instanceof Error ? error.message : "Could not load competition settings");
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [currentOrg, currentMember, params.compId, router, form]);

  const save = async (values: Partial<Competition>) => {
    if (!competition || !currentMember || !authorized) return;
    setSaving(true);
    try {
      const updated = await new CompetitionService().update(competition.id, values, currentMember.id);
      if (updated) setCompetition(updated);
      message.success("Competition settings saved");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not save competition settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader label="Loading competition settings" />;
  if (!competition || !currentOrg) return null;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px" }}>
      <Breadcrumb items={[
        { title: <Link href={`/o/${currentOrg.slug}/competitions`}>Competitions</Link> },
        { title: <Link href={`/o/${currentOrg.slug}/competitions/${competition.id}`}>{competition.name}</Link> },
        { title: "Settings" },
      ]} />
      <Space orientation="vertical" size={4} style={{ margin: "20px 0" }}>
        <Title level={2} style={{ margin: 0 }}>Competition settings</Title>
        <Text type="secondary">Manage identity, registration and how this competition appears to participants.</Text>
      </Space>
      {!authorized ? <Alert type="error" showIcon message="You need an owner or admin role to edit this competition." /> : (
        <Form form={form} initialValues={competition} layout="vertical" onFinish={save} requiredMark="optional">
          <Card title="Identity and appearance" style={{ marginBottom: 16 }}>
            <Row gutter={24}>
              <Col xs={24} md={15}>
                <Form.Item label="Competition name" name="name" rules={[{ required: true }, { min: 3, max: 90 }]}><Input size="large" maxLength={90} /></Form.Item>
                <Form.Item label="Description" name="description" rules={[{ required: true }, { min: 20, max: 600 }]} extra="Explain who can enter, what they will compete in, and the key dates or conditions."><Input.TextArea rows={5} showCount maxLength={600} /></Form.Item>
              </Col>
              <Col xs={24} md={9}>
                <Form.Item label="Competition image" name="coverImage"><ImageUpload currentUrl={competition.coverImage} onUpload={(url) => form.setFieldValue("coverImage", url)} /></Form.Item>
              </Col>
            </Row>
            <Form.Item label="Page content" name="content" getValueFromEvent={(value) => value}>
              <TipTapEditor placeholder="Add details participants need before they register." minHeight={220} />
            </Form.Item>
            <Form.Item label="Public page accent color" name="themeColor" getValueFromEvent={(color) => color?.toHexString()} rules={[{ pattern: /^#[0-9A-Fa-f]{6}$/, message: "Choose a valid six-digit color" }]} extra="Optional. This affects public competition pages only; your operator workspace stays blue."><ColorPicker format="hex" showText allowClear /></Form.Item>
          </Card>
          <Card title="Registration and visibility" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={12}><Form.Item label="Sport or category" name="category" rules={[{ required: true }]}><Select size="large" options={SPORT_CATEGORIES.map((category) => ({ ...category }))} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="Who can register" name="entryType" rules={[{ required: true }]}><Select size="large" options={[{ value: ParticipantType.Team, label: "Teams" }, { value: ParticipantType.Individual, label: "Individual players" }]} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item label="Page visibility" name="visibility" rules={[{ required: true }]}><Select size="large" options={[{ value: Visibility.Public, label: "Public" }, { value: Visibility.Private, label: "Private" }, { value: Visibility.Hidden, label: "Hidden by link" }]} /></Form.Item></Col>
            </Row>
          </Card>
          <Space>
            <Button onClick={() => router.push(`/o/${currentOrg.slug}/competitions/${competition.id}`)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>Save settings</Button>
          </Space>
        </Form>
      )}
    </div>
  );
}
