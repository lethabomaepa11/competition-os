"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, Form, Input, Button, Typography, message, Layout, Avatar, Space, Divider, Upload } from "antd";
import { LockOutlined, CameraOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { BackButton } from "@/components/common/back-button";
import { AppProvider, useApp } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/client";

const { Content } = Layout;
const { Title, Text } = Typography;

function ProfileInner() {
  const router = useRouter();
  const { currentMember, ready } = useApp();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready && !currentMember) router.push("/login");
  }, [ready, currentMember, router]);

  useEffect(() => {
    if (currentMember?.id) {
      (async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", currentMember.id)
          .single();
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      })();
    }
  }, [currentMember?.id]);

  if (!ready || !currentMember) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      message.error("Image must be under 2MB");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const filePath = `${currentMember.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", currentMember.id);

      if (updateError) throw updateError;

      message.success("Avatar updated");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const onFinish = async (values: { currentPassword: string; newPassword: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not change password");
      message.success("Password changed successfully");
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const initial = currentMember.displayName?.charAt(0).toUpperCase() ?? "?";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <BackButton fallback="/app" />
      <Content style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Card style={{ width: 440, maxWidth: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <Avatar size={96} src={avatarUrl} style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
                {initial}
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: -4,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                <CameraOutlined />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
              />
            </div>
            {uploading && <Text type="secondary" style={{ display: "block", fontSize: 12 }}>Uploading...</Text>}
            <Title level={3} style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{currentMember.displayName}</Title>
            <Text style={{ fontSize: 14, marginTop: 2, display: "block" }}>{currentMember.email}</Text>
          </div>

          <Divider />
          <Title level={5} style={{ marginTop: 0 }}>Change Password</Title>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              label="Current Password"
              name="currentPassword"
              rules={[{ required: true, message: "Enter your current password" }]}
            >
              <Input.Password placeholder="Current password" size="large" prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item
              label="New Password"
              name="newPassword"
              rules={[{ required: true, min: 6, message: "At least 6 characters" }]}
            >
              <Input.Password placeholder="New password" size="large" prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item
              label="Confirm New Password"
              name="confirm"
              dependencies={["newPassword"]}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                    return Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm new password" size="large" prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block loading={loading} size="large">
                Update Password
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 16, textAlign: "center" }}>
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => router.push("/app")}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </Content>
    </Layout>
  );
}

export default function ProfilePage() {
  return (
    <AppProvider>
      <ProfileInner />
    </AppProvider>
  );
}
