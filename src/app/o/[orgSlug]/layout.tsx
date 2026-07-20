"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Typography, Button, Avatar, Space, Spin, Dropdown } from "antd";
import {
  DashboardOutlined,
  TrophyOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { OrganizationService } from "@/domain/services/organization.service";
import type { Organization } from "@/domain/organization";

const { Sider, Header, Content } = Layout;
const { Title, Text } = Typography;

function OrgLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { currentMember, organizations, ready, logout, selectOrg } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const orgSlug = params.orgSlug as string;

  const org = organizations.find((o) => o.slug === orgSlug);

  useEffect(() => {
    if (!ready) return;
    if (!currentMember) { router.push("/login"); return; }
    if (org) selectOrg(org);
  }, [ready, currentMember, org, selectOrg, router]);

  useEffect(() => {
    if (!ready) return;
    if (!currentMember) return;
    if (!org && organizations.length > 0) {
      router.push("/app");
    }
  }, [ready, org, organizations, currentMember, router]);

  if (!ready) return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 100 }} />;
  if (!currentMember) return null;
  if (!org) return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 100 }} />;

  const basePath = `/o/${orgSlug}`;

  const menuItems = [
    { key: basePath, icon: <DashboardOutlined />, label: "Dashboard" },
    { key: `${basePath}/competitions`, icon: <TrophyOutlined />, label: "Competitions" },
    { key: `${basePath}/members`, icon: <TeamOutlined />, label: "Members" },
    { key: `${basePath}/blueprints`, icon: <FileTextOutlined />, label: "Blueprints" },
    { key: `${basePath}/settings`, icon: <SettingOutlined />, label: "Settings" },
    { key: `${basePath}/audit`, icon: <AuditOutlined />, label: "Audit Log" },
  ];

  const selectedKey = menuItems.find((item) =>
    pathname === item.key || pathname.startsWith(item.key + "/")
  )?.key || basePath;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="light"
        style={{ borderRight: "1px solid #f0f0f0" }}
      >
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderBottom: "1px solid #f0f0f0" }}>
          <img src="/logo.svg" alt="CompetitionOS" style={{ height: 24 }} />
          {!collapsed && <Title level={4} style={{ margin: 0 }}>{org.name}</Title>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderInlineEnd: "none" }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown
            menu={{
              items: [
                ...organizations.filter((o) => o.id !== org.id).map((o) => ({
                  key: o.slug,
                  label: o.name,
                  onClick: () => router.push(`/o/${o.slug}`),
                })),
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "Logout", onClick: () => { logout(); router.push("/login"); } },
              ],
            }}
          >
            <Space style={{ cursor: "pointer" }}>
              <Avatar icon={<TeamOutlined />} />
              <Text>{currentMember.displayName}</Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ padding: 24, overflow: "auto" }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <OrgLayoutInner>{children}</OrgLayoutInner>
    </AppProvider>
  );
}
