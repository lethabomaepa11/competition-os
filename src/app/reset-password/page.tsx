"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, message, Result, Spin } from "antd";
import { ArrowRightOutlined, LockOutlined } from "@ant-design/icons";
import { AuthShell } from "@/components/common/auth-shell";

/** Reads whichever recovery credential Supabase put on the link. */
function recoveryPayload(): Record<string, string> | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const code = query.get("code");
  if (code) return { code };
  const tokenHash = query.get("token_hash");
  if (tokenHash) return { tokenHash };
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [linkState, setLinkState] = useState<"checking" | "ready" | "invalid">("checking");
  const [linkError, setLinkError] = useState("This link is invalid or has expired.");
  const verified = useRef(false);

  useEffect(() => {
    // Recovery codes are single-use, so verify once even if the effect re-runs.
    if (verified.current) return;
    verified.current = true;
    const payload = recoveryPayload();
    const linkProblem = new URLSearchParams(window.location.search).get("error_description")
      ?? new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    window.history.replaceState(null, "", window.location.pathname);
    if (!payload) {
      const task = window.setTimeout(() => {
        if (linkProblem) setLinkError(linkProblem);
        setLinkState("invalid");
      }, 0);
      return () => window.clearTimeout(task);
    }
    fetch("/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(async (res) => {
        if (res.ok) { setLinkState("ready"); return; }
        const json = await res.json().catch(() => ({}));
        setLinkError(json.error ?? "This link is invalid or has expired.");
        setLinkState("invalid");
      })
      .catch(() => setLinkState("invalid"));
  }, []);

  const onFinish = async (values: { password: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: values.password }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not reset password");
      setDone(true);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  };

  let content;
  if (linkState === "checking") {
    content = <Result icon={<Spin size="large" />} title="Checking your reset link" subTitle="One moment while we verify it." />;
  } else if (linkState === "invalid") {
    content = <Result status="info" title="Reset link unavailable" subTitle={linkError} extra={<Button type="primary" onClick={() => router.push("/forgot-password")}>Request a new link</Button>} />;
  } else if (done) {
    content = <Result status="success" title="Password updated" subTitle="Your account is secure and ready." extra={<Button type="primary" onClick={() => router.push("/login")}>Sign in</Button>} />;
  } else {
    content = <><div className="auth-card__heading"><span className="eyebrow">Secure your account</span><h1>Choose a new password.</h1><p>Use a password you have not used here before.</p></div><Form layout="vertical" onFinish={onFinish} requiredMark={false}><Form.Item label="New password" name="password" rules={[{ required: true, min: 6, message: "Use at least 6 characters" }]}><Input.Password prefix={<LockOutlined />} placeholder="New password" size="large" autoComplete="new-password" /></Form.Item><Form.Item label="Confirm password" name="confirm" dependencies={["password"]} rules={[{ required: true, message: "Confirm your password" },({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue("password") === value ? Promise.resolve() : Promise.reject(new Error("Passwords do not match")); } })]}><Input.Password prefix={<LockOutlined />} placeholder="Repeat new password" size="large" autoComplete="new-password" /></Form.Item><Button type="primary" htmlType="submit" block loading={loading} size="large">Update password <ArrowRightOutlined /></Button></Form></>;
  }

  return <AuthShell fallback="/login" eyebrow="Secure recovery" title="Protect the operation. Keep the team moving." description="A secure account keeps competition data, match results, and organization controls in the right hands.">{content}</AuthShell>;
}
