"use client";

import { Typography, Card, Form, Input, Button, message, Alert, Descriptions, Space, Tag } from "antd";
import { CheckCircleOutlined, CloudServerOutlined, DatabaseOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";
import { getSupabaseReadiness } from "@/lib/supabase/status";

const { Title, Text } = Typography;

export default function SettingsPage() {
  const { currentOrg } = useApp();
  const orgSvc = new OrganizationService();
  const supabase = getSupabaseReadiness();

  const handleUpdate = async (values: { name: string }) => {
    if (!currentOrg) return;
    await orgSvc.update(currentOrg.id, { name: values.name });
    message.success("Settings updated!");
  };

  if (!currentOrg) return null;

  return (
    <div style={{ maxWidth: 840 }}>
      <Title level={3}>Organization Settings</Title>
      <Card style={{ marginBottom: 16 }}>
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

      <Card
        title={<Space><DatabaseOutlined /> Persistence</Space>}
        extra={
          <Tag color={supabase.mode === "supabase-ready" ? "green" : "blue"}>
            {supabase.mode === "supabase-ready" ? "Supabase configured" : "Local first"}
          </Tag>
        }
      >
        <Alert
          type={supabase.mode === "supabase-ready" ? "success" : "info"}
          showIcon
          message={supabase.mode === "supabase-ready" ? "Supabase environment is configured" : "Local browser storage is active"}
          description={
            supabase.mode === "supabase-ready"
              ? "The local Supabase project can be used as the next persistence target once the service layer is switched from localStorage to database repositories."
              : "CompetitionOS keeps working locally without a remote project. Start Supabase locally, add the public URL and anon key, then migrate repositories table by table."
          }
          style={{ marginBottom: 16 }}
        />
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label={<Space><CloudServerOutlined /> Local API</Space>}>
            <Text copyable={{ text: supabase.localApiUrl }}>{supabase.localApiUrl}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Local Studio">
            <Text copyable={{ text: supabase.localStudioUrl }}>{supabase.localStudioUrl}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="NEXT_PUBLIC_SUPABASE_URL">
            {supabase.hasUrl ? <Tag color="green" icon={<CheckCircleOutlined />}>Set</Tag> : <Tag>Missing</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="NEXT_PUBLIC_SUPABASE_ANON_KEY">
            {supabase.hasAnonKey ? <Tag color="green" icon={<CheckCircleOutlined />}>Set</Tag> : <Tag>Missing</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
