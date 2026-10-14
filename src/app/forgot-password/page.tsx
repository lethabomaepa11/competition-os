"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, message, Result } from "antd";
import { ArrowRightOutlined, MailOutlined } from "@ant-design/icons";
import { AuthShell } from "@/components/common/auth-shell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not send reset email");
      setSent(true);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell fallback="/login" eyebrow="Account recovery" title="A quick reset. Then back to matchday." description="We will send a secure recovery link to the email connected to your operator account.">
      {sent ? (
        <Result status="success" title="Check your inbox" subTitle="If the account exists, a secure reset link is on its way." extra={<Button type="primary" onClick={() => router.push("/login")}>Return to sign in</Button>} />
      ) : (
        <>
          <div className="auth-card__heading"><span className="eyebrow">Recover access</span><h1>Reset password.</h1><p>Enter the email connected to your account.</p></div>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Email address" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email address" }]}><Input prefix={<MailOutlined />} placeholder="operator@league.com" size="large" autoComplete="email" /></Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} size="large">Send recovery link <ArrowRightOutlined /></Button>
          </Form>
          <Button type="link" block style={{ marginTop: 16 }} onClick={() => router.push("/login")}>Return to sign in</Button>
        </>
      )}
    </AuthShell>
  );
}
