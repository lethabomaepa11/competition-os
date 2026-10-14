"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Divider, Form, Input, Select, message } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, BankOutlined, LockOutlined, MailOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { AuthShell } from "@/components/common/auth-shell";
import { SPORT_CATEGORIES, TEAM_TYPES } from "@/domain/categories";

type AccountType = "operator" | "team" | "player";
type RegistrationValues = { email: string; password: string; displayName: string; organizationName?: string; teamName?: string; category?: string; teamType?: string };

const REDIRECT_KEY = "competitionos_auth_redirect";

function safeInviteRedirect(value: string | null) {
  return value?.startsWith("/invite/") && !value.startsWith("//") ? value : null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form] = Form.useForm<RegistrationValues>();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [inviteRedirect, setInviteRedirect] = useState<string | null>(null);
  const [accountDetails, setAccountDetails] = useState<Pick<RegistrationValues, "displayName" | "email" | "password"> | null>(null);

  useEffect(() => {
    const queryRedirect = safeInviteRedirect(new URLSearchParams(window.location.search).get("redirect"));
    const storedRedirect = safeInviteRedirect(sessionStorage.getItem(REDIRECT_KEY));
    const redirect = queryRedirect ?? storedRedirect;
    if (redirect) {
      sessionStorage.setItem(REDIRECT_KEY, redirect);
      // Restore navigation state that is only available in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInviteRedirect(redirect);
    }
  }, []);

  const createAccount = async (values: RegistrationValues, selectedType: AccountType) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, accountType: selectedType }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Registration failed");
      message.success(inviteRedirect ? "Account created. Sign in to accept your invitation." : selectedType === "operator" ? "Organization and operator account created." : selectedType === "team" ? "Team workspace created." : "Player account created.");
      router.push(inviteRedirect ? `/login?redirect=${encodeURIComponent(inviteRedirect)}` : "/login");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Registration failed");
    } finally { setLoading(false); }
  };

  const onFinish = async (values: RegistrationValues) => {
    if (step === 1 && !inviteRedirect) {
      setAccountDetails({ displayName: values.displayName, email: values.email, password: values.password });
      setStep(2);
      return;
    }
    const selectedType = inviteRedirect ? "player" : accountType;
    if (!selectedType) {
      message.error("Choose the workspace that matches your role");
      return;
    }
    await createAccount({ ...accountDetails, ...values }, selectedType);
  };

  return (
    <AuthShell eyebrow="Purpose built access" title="Start with the workspace that matches your role." description="Create your secure account first. Then choose the workspace and permissions that fit the work you do.">
      <div className="onboarding-progress" aria-label={`Account setup, step ${step} of 2`}>
        <span className="is-active">1</span><i /><span className={step === 2 ? "is-active" : ""}>2</span>
        <strong>{step === 1 ? "Account details" : "Choose your workspace"}</strong>
      </div>
      <div className="auth-card__heading">
        <span className="eyebrow">{inviteRedirect ? "Invitation access" : `Step ${step} of 2`}</span>
        <h1>{step === 1 ? "Create your account." : "How will you use CompetitionOS?"}</h1>
        <p>{step === 1 ? (inviteRedirect ? "Your invitation will connect this account to the right competition or team." : "Use your real details so records and invitations reach the right person.") : "Your choice sets up the tools, navigation, and records available after sign in."}</p>
      </div>
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} preserve>
        {step === 1 && <>
          <Form.Item label="Your name" name="displayName" rules={[{ required: true, message: "Enter your name" }]}><Input prefix={<UserOutlined />} placeholder="Alex Morgan" size="large" autoComplete="name" /></Form.Item>
          <Form.Item label="Email address" name="email" rules={[{ required: true, type: "email", message: "Enter a valid email address" }]}><Input prefix={<MailOutlined />} placeholder="alex@league.com" size="large" autoComplete="email" /></Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, min: 6, message: "Use at least 6 characters" }]} extra="Use at least 6 characters."><Input.Password prefix={<LockOutlined />} placeholder="Create a password" size="large" autoComplete="new-password" /></Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading} size="large">{inviteRedirect ? "Create account and continue" : "Continue"} <ArrowRightOutlined /></Button>
        </>}

        {step === 2 && <>
          <div className="account-type-picker" role="radiogroup" aria-label="Workspace type">
            <button type="button" role="radio" aria-checked={accountType === "operator"} className={accountType === "operator" ? "is-selected" : ""} onClick={() => setAccountType("operator")}><BankOutlined /><span className="account-type-copy"><strong>Competition operator</strong><small>Run one organization, publish tournaments, approve entries, and manage results.</small></span></button>
            <button type="button" role="radio" aria-checked={accountType === "team"} className={accountType === "team" ? "is-selected" : ""} onClick={() => setAccountType("team")}><TeamOutlined /><span className="account-type-copy"><strong>Team owner or captain</strong><small>Create a team, manage its roster, and apply to eligible tournaments.</small></span></button>
            <button type="button" role="radio" aria-checked={accountType === "player"} className={accountType === "player" ? "is-selected" : ""} onClick={() => setAccountType("player")}><UserOutlined /><span className="account-type-copy"><strong>Individual player</strong><small>Enter individual tournaments and keep a personal competition record.</small></span></button>
          </div>

          {accountType === "operator" && <Form.Item label="Company or organization name" name="organizationName" rules={[{ required: true, message: "Enter your organization name" }]}><Input prefix={<BankOutlined />} placeholder="Premier League Operations" size="large" autoComplete="organization" /></Form.Item>}
          {accountType === "team" && <>
            <Form.Item label="Team name" name="teamName" rules={[{ required: true, message: "Enter your team name" }]}><Input prefix={<TeamOutlined />} placeholder="Jozi Titans" size="large" /></Form.Item>
            <div className="auth-field-pair">
              <Form.Item label="Sport or category" name="category" initialValue="football" rules={[{ required: true }]}><Select size="large" options={[...SPORT_CATEGORIES]} /></Form.Item>
              <Form.Item label="Team type" name="teamType" initialValue="club" rules={[{ required: true }]}><Select size="large" options={[...TEAM_TYPES]} /></Form.Item>
            </div>
          </>}
          {accountType === "player" && <div className="role-confirmation"><UserOutlined /><span><strong>Your player profile</strong><small>Your tournament entries, team memberships, fixtures, and results stay connected to this account.</small></span></div>}

          <div className="onboarding-actions">
            <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => setStep(1)}>Back</Button>
            <Button type="primary" htmlType="submit" loading={loading} size="large" disabled={!accountType}>Create account <ArrowRightOutlined /></Button>
          </div>
        </>}
      </Form>
      <Divider plain>Already have an account?</Divider>
      <Button block size="large" onClick={() => router.push(inviteRedirect ? `/login?redirect=${encodeURIComponent(inviteRedirect)}` : "/login")}>Sign in</Button>
    </AuthShell>
  );
}
