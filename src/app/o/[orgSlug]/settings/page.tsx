"use client";

import { Typography, Card, Form, Input, Button, message } from "antd";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";

const { Title } = Typography;

export default function SettingsPage() {
  const { currentOrg } = useApp();
  const orgSvc = new OrganizationService();

  const handleUpdate = async (values: { name: string }) => {
    if (!currentOrg) return;
    await orgSvc.update(currentOrg.id, { name: values.name });
    message.success("Settings updated!");
  };

  if (!currentOrg) return null;

  return (
    <div style={{ maxWidth: 840 }}>
      <Title level={3}>Organization Settings</Title>
      <Card>
        <Form layout="vertical" onFinish={handleUpdate} initialValues={{ name: currentOrg.name }}>
          <Form.Item label="Organization Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Slug">
            <Input value={currentOrg.slug} disabled />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">Save Changes</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
