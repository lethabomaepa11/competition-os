"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Typography, Card, Row, Col, Button, Empty, Avatar, Space, Modal, Form, Input, message } from "antd";
import { PlusOutlined, TeamOutlined, RightOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";

const { Title, Text } = Typography;

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "org";
}

export default function AppDashboard() {
  const router = useRouter();
  const { currentMember, organizations, createOrg } = useApp();
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
    <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 36 }}>
          <div>
            <Text type="secondary" style={{ fontWeight: 600, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dashboard</Text>
            <Title level={2} style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700 }}>
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
          <Card style={{ textAlign: "center", padding: 40 }}>
            <Empty
              description={
                <div>
                  <Text style={{ fontSize: 15, display: "block", marginBottom: 4 }}>Create your first organization</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>Organizations group your competitions, members, and settings</Text>
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
                  onClick={() => router.push(`/o/${org.slug}`)}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <Avatar
                        size={48}
                        icon={<TeamOutlined />}
                        style={{ fontSize: 20 }}
                      />
                      <div>
                        <Title level={4} style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{org.name}</Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>{org.slug}</Text>
                      </div>
                    </div>
                    <Button type="text" icon={<RightOutlined />} />
                  </div>
                </Card>
              </Col>
            ))}
            <Col xs={24} sm={12}>
              <Card
                hoverable
                styles={{ body: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 88, cursor: "pointer" } }}
                onClick={() => setModalOpen(true)}
              >
                <Space>
                  <PlusOutlined style={{ fontSize: 18 }} />
                  <Text style={{ fontWeight: 500, cursor: "pointer" }}>Create Organization</Text>
                </Space>
              </Card>
            </Col>
          </Row>
        )}

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
              <Text type="secondary" style={{ fontSize: 13 }}>
                URL: <Text strong style={{ color: "inherit" }}>competitionos.io/o/{slug}</Text>
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
    </>
  );
}
