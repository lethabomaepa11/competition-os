"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Typography, Button, Avatar, Space, Spin, Dropdown, Drawer, Grid } from "antd";
import {
  DashboardOutlined,
  TrophyOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

function OrgLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { currentMember, organizations, ready, logout, selectOrg } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const screens = useBreakpoint();
  const orgSlug = params.orgSlug as string;

  const isMobile = !screens.md;

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

  const selectedKey = menuItems.find((item) => {
    if (item.key === basePath) return pathname === basePath;
    return pathname === item.key || pathname.startsWith(item.key + "/");
  })?.key || basePath;

  const handleMenuClick = (key: string) => {
    router.push(key);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  const sidebarContent = (
    <>
      <div style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 16px",
      }}>
        <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 36 }} />
        {!isMobile && <Title level={4} style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.name}</Title>}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={({ key }) => handleMenuClick(key)}
        style={{ borderInlineEnd: "none" }}
        inlineCollapsed={!isMobile && collapsed}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Layout.Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme="light"
          width={240}
          className="org-layout-sider"
        >
          {sidebarContent}
        </Layout.Sider>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <>
          <Drawer
            title={
              <Space>
                <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 32 }} />
                <Text strong>{org.name}</Text>
              </Space>
            }
            placement="left"
            onClose={() => setMobileDrawerOpen(false)}
            open={mobileDrawerOpen}
            width={260}
            styles={{ body: { padding: 0 } }}
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={({ key }) => handleMenuClick(key)}
              style={{ borderInlineEnd: "none" }}
            />
          </Drawer>
        </>
      )}

      <Layout>
        <Header className="org-layout-header" style={{
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push("/app");
                }
              }}
            >
              Back
            </Button>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
              />
            )}
          </Space>
          <Dropdown
            menu={{
              items: [
                ...organizations.filter((o) => o.id !== org.id).map((o) => ({
                  key: o.slug,
                  label: o.name,
                  onClick: () => router.push(`/o/${o.slug}`),
                })),
                { type: "divider" },
                { key: "profile", icon: <UserOutlined />, label: "Profile", onClick: () => router.push("/profile") },
                { key: "logout", icon: <LogoutOutlined />, label: "Logout", onClick: () => { logout(); router.push("/login"); } },
              ],
            }}
          >
            <Space style={{ cursor: "pointer" }}>
              <Avatar style={{ fontSize: 14, fontWeight: 600 }}>
                {currentMember.displayName.charAt(0).toUpperCase()}
              </Avatar>
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
