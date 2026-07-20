"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Button, Typography, message, Layout, Result } from "antd";
import { MailOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { BackButton } from "@/components/common/back-button";

const { Content } = Layout;
const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send reset email");
      setSent(true);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
    <Layout style={{ minHeight: "100vh" }}>
      <BackButton fallback="/login" />
      <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ width: 400, maxWidth: "100%", textAlign: "center" }}>
            <Result
              status="success"
              title="Check your email"
              subTitle="If an account with that email exists, we've sent a password reset link."
              extra={
                <Button type="primary" onClick={() => router.push("/login")}>
                  Back to Sign In
                </Button>
              }
            />
          </Card>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <BackButton fallback="/login" />
      <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Card style={{ width: 400, maxWidth: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 64, marginBottom: 12 }} />
            <Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Reset your password</Title>
            <Text style={{ fontSize: 14, marginTop: 4, display: "block" }}>
              Enter your email and we'll send you a reset link.
            </Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email" }]}>
              <Input placeholder="you@example.com" size="large" prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                Send Reset Link
              </Button>
            </Form.Item>
          </Form>

          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => router.push("/login")} block>
            Back to Sign In
          </Button>
        </Card>
      </Content>
    </Layout>
  );
}
