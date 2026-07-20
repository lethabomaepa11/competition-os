"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Layout, Typography, Card, Row, Col, Button, Empty, Avatar, Space, Modal, Form, Input, message } from "antd";
import { PlusOutlined, TeamOutlined, LogoutOutlined, RightOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "org";
}

function DashboardInner() {
  const router = useRouter();
  const { currentMember, organizations, createOrg, logout } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const orgSvc = new OrganizationService();

  useEffect(() => {
    if (!currentMember) router.push("/login");
  }, [currentMember, router]);

  if (!currentMember) return null;

  const handleCreateOrg = async (values: { name: string }) => {
    setCreating(true);
    try {
      let finalSlug = slugify(values.name);
      if (await orgSvc.getBySlug(finalSlug)) {
        finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
      }
      const org = await createOrg(values.name, finalSlug);
      message.success("Organization created!");
      setModalOpen(false);
      form.resetFields();
      setSlug("");
      router.push(`/o/${org.slug}`);
    } catch {
      message.error("Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      <Header style={{
        background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <Space>
          <img src="/logo.svg" alt="CompetitionOS" style={{ height: 28 }} />
          <Title level={4} style={{ margin: 0, color: "#0F172A", fontWeight: 700 }}>CompetitionOS</Title>
        </Space>
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #1E3A8A, #1E40AF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFFFFF", fontSize: 13, fontWeight: 600,
          }}>
            {currentMember.displayName.charAt(0).toUpperCase()}
          </div>
          <Text style={{ color: "#475569", fontWeight: 500 }}>{currentMember.displayName}</Text>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={() => { logout(); router.push("/login"); }}
            style={{ color: "#94A3B8" }}
          />
        </Space>
      </Header>

      <Content style={{ padding: "48px 32px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <Text style={{ color: "#1E3A8A", fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dashboard</Text>
            <Title level={2} style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700, color: "#0F172A" }}>
              Your Organizations
            </Title>
          </div>
          {organizations.length > 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              New Organization
            </Button>
          )}
        </div>

        {organizations.length === 0 ? (
          <Card style={{
            borderRadius: 16, border: "1px dashed #CBD5E1",
            background: "#FFFFFF",
            textAlign: "center", padding: 40,
          }}>
            <Empty
              image={<div style={{ fontSize: 48, marginBottom: 16 }}>🏢</div>}
              description={
                <div>
                  <Text style={{ color: "#64748B", fontSize: 15, display: "block", marginBottom: 4 }}>Create your first organization</Text>
                  <Text style={{ color: "#94A3B8", fontSize: 13 }}>Organizations group your competitions, members, and settings</Text>
                </div>
              }
            >
              <Button type="primary" size="large" onClick={() => setModalOpen(true)} style={{ marginTop: 8 }}>
                Create Organization
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {organizations.map((org) => (
              <Col xs={24} sm={12} key={org.id}>
                <Card
                  hoverable
                  className="card-hover"
                  style={{ borderRadius: 14, border: "1px solid #E2E8F0", background: "#FFFFFF" }}
                  onClick={() => router.push(`/o/${org.slug}`)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <Avatar
                        size={48}
                        icon={<TeamOutlined />}
                        style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #1E40AF 100%)", color: "#FFFFFF", fontSize: 20 }}
                      />
                      <div>
                        <Title level={4} style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0F172A" }}>{org.name}</Title>
                        <Text style={{ color: "#64748B", fontSize: 13 }}>{org.slug}</Text>
                      </div>
                    </div>
                    <Button type="text" icon={<RightOutlined />} style={{ color: "#CBD5E1" }} />
                  </div>
                </Card>
              </Col>
            ))}
            <Col xs={24} sm={12}>
              <Card
                hoverable
                style={{
                  borderRadius: 14, border: "1px dashed #CBD5E1",
                  background: "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", minHeight: 88, cursor: "pointer",
                }}
                onClick={() => setModalOpen(true)}
              >
                <Space>
                  <PlusOutlined style={{ color: "#94A3B8", fontSize: 18 }} />
                  <Text style={{ color: "#64748B", fontWeight: 500, cursor: "pointer" }}>Create Organization</Text>
                </Space>
              </Card>
            </Col>
          </Row>
        )}
      </Content>

      <Modal
        title="Create Organization"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setSlug(""); }}
        footer={null}
        width={440}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrg} requiredMark={false}>
          <Form.Item
            label="Organization Name"
            name="name"
            rules={[{ required: true, message: "Enter your organization name" }]}
          >
            <Input
              placeholder="e.g., Boxfusion Gaming"
              size="large"
              autoFocus
              onChange={(e) => setSlug(slugify(e.target.value))}
            />
          </Form.Item>
          {slug && (
            <div style={{ marginTop: -16, marginBottom: 20, paddingLeft: 2 }}>
              <Text style={{ color: "#64748B", fontSize: 13 }}>
                URL: <span style={{ color: "#1E3A8A", fontWeight: 500 }}>competitionos.io/o/{slug}</span>
              </Text>
            </div>
          )}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={creating} size="large">
              Create Organization
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default function AppDashboard() {
  return (
    <AppProvider>
      <DashboardInner />
    </AppProvider>
  );
}
