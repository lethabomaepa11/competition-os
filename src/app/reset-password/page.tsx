"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Button, Typography, message, Layout, Result } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { BackButton } from "@/components/common/back-button";

const { Content } = Layout;
const { Title, Text } = Typography;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setHasToken(true);
    }
  }, []);

  const onFinish = async (values: { password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not reset password");
      message.success("Password reset successfully!");
      setDone(true);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!hasToken) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <BackButton fallback="/login" />
        <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ width: 400, maxWidth: "100%", textAlign: "center" }}>
            <Result
              status="info"
              title="No reset token found"
              subTitle="This link is invalid or expired. Request a new password reset."
              extra={
                <Button type="primary" onClick={() => router.push("/forgot-password")}>
                  Request Reset
                </Button>
              }
            />
          </Card>
        </Content>
      </Layout>
    );
  }

  if (done) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <BackButton fallback="/login" />
        <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ width: 400, maxWidth: "100%", textAlign: "center" }}>
            <Result
              status="success"
              title="Password changed"
              subTitle="Your password has been updated successfully."
              extra={
                <Button type="primary" onClick={() => router.push("/login")}>
                  Sign In
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
            <Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Set new password</Title>
            <Text style={{ fontSize: 14, marginTop: 4, display: "block" }}>
              Choose a new password for your account.
            </Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="New Password" name="password" rules={[{ required: true, min: 6, message: "At least 6 characters" }]}>
              <Input.Password placeholder="Your new password" size="large" prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item
              label="Confirm Password"
              name="confirm"
              dependencies={["password"]}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) return Promise.resolve();
                    return Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm new password" size="large" prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                Reset Password
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Content>
    </Layout>
  );
}
