"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Divider, Form, Input, Radio, Select, message } from "antd";
import { ArrowRightOutlined, BankOutlined, LockOutlined, MailOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { AuthShell } from "@/components/common/auth-shell";
import { SPORT_CATEGORIES, TEAM_TYPES } from "@/domain/categories";

type AccountType = "operator" | "team" | "player";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("operator");

  const onFinish = async (values: { email: string; password: string; displayName: string; organizationName?: string; teamName?: string; category?: string; teamType?: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, accountType }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      message.success(accountType === "operator" ? "Organization and operator account created." : accountType === "team" ? "Team workspace created." : "Player account created.");
      router.push("/login");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Purpose built access" title="Start with the workspace that matches your role." description="Account type controls the data, navigation, and actions available after sign in. Each operator account owns one organization.">
      <div className="auth-card__heading"><span className="eyebrow">Create account</span><h1>Choose your role.</h1><p>This cannot be changed casually because it defines your workspace and permissions.</p></div>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Radio.Group className="account-type-picker" value={accountType} onChange={(event) => setAccountType(event.target.value)}>
          <Radio.Button value="operator"><BankOutlined /><strong>Operator</strong><span>Run one organization</span></Radio.Button>
          <Radio.Button value="team"><TeamOutlined /><strong>Team</strong><span>Captain and roster</span></Radio.Button>
          <Radio.Button value="player"><UserOutlined /><strong>Player</strong><span>Personal competition record</span></Radio.Button>
        </Radio.Group>
        {accountType === "operator" && <Form.Item label="Company or organization name" name="organizationName" rules={[{ required: true, message: "Enter your organization name" }]}><Input prefix={<BankOutlined />} placeholder="Premier League Operations" size="large" autoComplete="organization" /></Form.Item>}
        {accountType === "team" && <>
          <Form.Item label="Team name" name="teamName" rules={[{ required: true, message: "Enter your team name" }]}><Input prefix={<TeamOutlined />} placeholder="Jozi Titans" size="large" /></Form.Item>
          <div className="auth-field-pair">
            <Form.Item label="Sport or category" name="category" initialValue="football" rules={[{ required: true }]}><Select size="large" options={[...SPORT_CATEGORIES]} /></Form.Item>
            <Form.Item label="Team type" name="teamType" initialValue="club" rules={[{ required: true }]}><Select size="large" options={[...TEAM_TYPES]} /></Form.Item>
          </div>
        </>}
        <Form.Item label="Your name" name="displayName" rules={[{ required: true, message: "Enter your name" }]}><Input prefix={<UserOutlined />} placeholder="Alex Morgan" size="large" autoComplete="name" /></Form.Item>
        <Form.Item label="Work email" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email address" }]}><Input prefix={<MailOutlined />} placeholder="alex@league.com" size="large" autoComplete="email" /></Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, min: 6, message: "Use at least 6 characters" }]} extra="Use at least 6 characters."><Input.Password prefix={<LockOutlined />} placeholder="Create a password" size="large" autoComplete="new-password" /></Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} size="large">Create {accountType} account <ArrowRightOutlined /></Button>
      </Form>
      <Divider plain>Already have an account?</Divider>
      <Button block size="large" onClick={() => router.push("/login")}>Sign in</Button>
    </AuthShell>
  );
}
