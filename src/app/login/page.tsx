"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Button, Typography, message, Divider, Layout } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { BackButton } from "@/components/common/back-button";


const { Content } = Layout;
const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not sign in");
      message.success("Signed in!");
      router.push("/app");
      router.refresh();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Could not sign in");
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
            <Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Welcome back</Title>
            <Text style={{ fontSize: 14, marginTop: 4, display: "block" }}>Sign in to CompetitionOS</Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="you@example.com" size="large" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="Your password" size="large" />
            </Form.Item>
            <div style={{ textAlign: "right", marginTop: -12, marginBottom: 16 }}>
              <Button type="link" style={{ padding: 0 }} onClick={() => router.push("/forgot-password")}>
                Forgot password?
              </Button>
            </div>
            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                Sign In <ArrowRightOutlined />
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: "16px 0" }}>
            <Text style={{ fontSize: 12 }}>New here?</Text>
          </Divider>

          <Button type="default" block size="large" onClick={() => router.push("/register")}>
            Create an account
          </Button>
        </Card>
      </Content>
    </Layout>
  );
}
