"use client";

import { usePathname, useRouter } from "next/navigation";
import { Layout, Typography, Avatar, Space, Button, Menu } from "antd";
import { LogoutOutlined, TeamOutlined, TrophyOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const TAB_ITEMS = [
  { key: "/app", label: "Organizations", icon: <TeamOutlined /> },
  { key: "/app/events", label: "My Events", icon: <TrophyOutlined /> },
];

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentMember, logout } = useApp();

  const activeKey = TAB_ITEMS.find((t) => pathname.startsWith(t.key))?.key ?? "/app";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <Space>
          <img src="/logo.jpg" alt="CompetitionOS" style={{ height: 40 }} />
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>CompetitionOS</Title>
        </Space>
        {currentMember && (
          <Space>
            <Avatar size={32} style={{ fontSize: 13, fontWeight: 600 }}>
              {currentMember.displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Text style={{ fontWeight: 500 }}>{currentMember.displayName}</Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => { logout(); router.push("/login"); }}
            />
          </Space>
        )}
      </Header>

      <Menu
        mode="horizontal"
        selectedKeys={[activeKey]}
        items={TAB_ITEMS}
        onClick={({ key }) => router.push(key)}
        style={{ display: "flex", justifyContent: "center", borderBottom: "1px solid #f0f0f0" }}
      />

      <Content style={{ padding: "48px 32px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        {children}
      </Content>
    </Layout>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppProvider>
  );
}
