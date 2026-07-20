"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Button, Typography, message, Divider, Layout } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { BackButton } from "@/components/common/back-button";


const { Content } = Layout;
const { Title, Text } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string; displayName: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password: values.password, displayName: values.displayName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      message.success("Account created! You can now sign in.");
      router.push("/login");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <BackButton fallback="/" />
      <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Card style={{ width: 400, maxWidth: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 64, marginBottom: 12 }} />
            <Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Create your account</Title>
            <Text style={{ fontSize: 14, marginTop: 4, display: "block" }}>No credit card required</Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Display Name" name="displayName" rules={[{ required: true }]}>
              <Input placeholder="Your name" size="large" />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="you@example.com" size="large" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="Create a password" size="large" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                Create Account <ArrowRightOutlined />
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: "16px 0" }}>
            <Text style={{ fontSize: 12 }}>Already registered?</Text>
          </Divider>

          <Button type="default" block size="large" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        </Card>
      </Content>
    </Layout>
  );
}
