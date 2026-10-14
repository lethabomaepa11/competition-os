"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Divider, Form, Input, message } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { AuthShell } from "@/components/common/auth-shell";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string; displayName: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      message.success("Account created. You can sign in now.");
      router.push("/login");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Build your arena" title="Big competition energy. Zero spreadsheet chaos." description="Create your workspace, shape the rules, invite your team, and take your first competition live.">
      <div className="auth-card__heading"><span className="eyebrow">New workspace</span><h1>Start operating.</h1><p>Your first organization takes less than a minute.</p></div>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item label="Your name" name="displayName" rules={[{ required: true, message: "Enter your name" }]}><Input prefix={<UserOutlined />} placeholder="Alex Morgan" size="large" autoComplete="name" /></Form.Item>
        <Form.Item label="Work email" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email address" }]}><Input prefix={<MailOutlined />} placeholder="alex@league.com" size="large" autoComplete="email" /></Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, min: 6, message: "Use at least 6 characters" }]} extra="Use at least 6 characters."><Input.Password prefix={<LockOutlined />} placeholder="Create a password" size="large" autoComplete="new-password" /></Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large">Create account <ArrowRightOutlined /></Button>
      </Form>
      <Divider plain>Already have an account?</Divider>
      <Button block size="large" onClick={() => router.push("/login")}>Sign in</Button>
    </AuthShell>
  );
}
