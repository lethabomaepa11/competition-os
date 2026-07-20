"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Select, Button, Typography, message } from "antd";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { Visibility } from "@/domain/types";

const { Title } = Typography;

export default function NewCompetitionPage() {
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { name: string; description?: string; visibility?: Visibility }) => {
    if (!currentOrg || !currentMember) return;
    setLoading(true);
    try {
      const svc = new CompetitionService();
      const comp = await svc.create({
        organizationId: currentOrg.id,
        ...values,
        visibility: values.visibility ?? Visibility.Public,
      }, currentMember.id);
      message.success("Competition created!");
      router.push(`/o/${currentOrg.slug}/competitions/${comp.id}`);
    } catch {
      message.error("Failed to create competition");
    } finally {
      setLoading(false);
    }
  };

  if (!currentOrg) return null;

  return (
    <div style={{ maxWidth: 600 }}>
      <Title level={3}>New Competition</Title>
      <Card>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g., Boxfusion Gaming Championship" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item label="Visibility" name="visibility" initialValue={Visibility.Public}>
            <Select>
              <Select.Option value={Visibility.Public}>Public</Select.Option>
              <Select.Option value={Visibility.Private}>Private</Select.Option>
              <Select.Option value={Visibility.Hidden}>Hidden (by link)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Create Competition
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
