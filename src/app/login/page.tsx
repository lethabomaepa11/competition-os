"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Divider, Form, Input, message } from "antd";
import { ArrowRightOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { AuthShell } from "@/components/common/auth-shell";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("redirect");
    if (requested?.startsWith("/invite/") && !requested.startsWith("//")) sessionStorage.setItem("competitionos_auth_redirect", requested);
  }, []);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not sign in");
      message.success("Welcome back");
      const requested = new URLSearchParams(window.location.search).get("redirect");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : (json.nextPath ?? "/app");
      if (destination.startsWith("/invite/")) sessionStorage.removeItem("competitionos_auth_redirect");
      router.push(destination);
      router.refresh();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Could not sign in");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Secure account access" title="Return to your competition workspace." description="Operators, team captains, and players each return to the tools and records assigned to their account.">
      <div className="auth-card__heading"><span className="eyebrow">Secure sign in</span><h1>Welcome back.</h1><p>Enter the command center.</p></div>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item label="Email address" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email address" }]}><Input prefix={<MailOutlined />} placeholder="operator@league.com" size="large" autoComplete="email" /></Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, min: 6, message: "Enter your password" }]}><Input.Password prefix={<LockOutlined />} placeholder="Your password" size="large" autoComplete="current-password" /></Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "-10px 0 20px" }}><Button type="link" style={{ padding: 0 }} onClick={() => router.push("/forgot-password")}>Forgot password?</Button></div>
        <Button type="primary" htmlType="submit" block loading={loading} size="large">Sign in <ArrowRightOutlined /></Button>
      </Form>
      <Divider plain>New to CompetitionOS?</Divider>
      <Button block size="large" onClick={() => {
        const requested = new URLSearchParams(window.location.search).get("redirect");
        router.push(requested?.startsWith("/invite/") && !requested.startsWith("//") ? `/register?redirect=${encodeURIComponent(requested)}` : "/register");
      }}>Create an account</Button>
    </AuthShell>
  );
}
