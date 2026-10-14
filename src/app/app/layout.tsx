"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, Button, Dropdown, Layout, Menu } from "antd";
import { AppstoreOutlined, BarChartOutlined, BellOutlined, BookOutlined, LogoutOutlined, TeamOutlined, TrophyOutlined, UserOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { BrandMark } from "@/components/common/brand-mark";
import styles from "./layout.module.css";
import { PageLoader } from "@/components/common/page-loader";

const participantItems = [
  { key: "/app", label: "Home", icon: <AppstoreOutlined /> },
  { key: "/app/events", label: "My events", icon: <TrophyOutlined /> },
  { key: "/app/performance", label: "Performance", icon: <BarChartOutlined /> },
  { key: "/app/teams", label: "Teams", icon: <TeamOutlined /> },
  { key: "/app/opportunities", label: "Tournaments", icon: <BellOutlined /> },
  { key: "/how-to", label: "How to", icon: <BookOutlined /> },
];

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentMember, organizations, ready, logout } = useApp();
  const items = participantItems.filter((item) => item.key !== "/app/teams" || currentMember?.accountType === "team");
  const activeKey = [...items].sort((a, b) => b.key.length - a.key.length).find((item) => pathname === item.key || pathname.startsWith(`${item.key}/`))?.key ?? "/app";

  useEffect(() => {
    if (!ready) return;
    if (!currentMember) router.replace("/login");
    else if (currentMember.accountType === "operator") router.replace(organizations[0] ? `/o/${organizations[0].slug}` : "/login");
  }, [ready, currentMember, organizations, router]);

  if (!ready || !currentMember || currentMember.accountType === "operator") return <PageLoader className={styles.loading} label="Opening participant workspace" />;

  const accountMenu = {
    items: [
      { key: "profile", icon: <UserOutlined />, label: "Profile", onClick: () => router.push("/profile") },
      { type: "divider" as const },
      { key: "logout", icon: <LogoutOutlined />, label: "Sign out", onClick: async () => { await logout(); router.push("/login"); } },
    ],
  };

  return (
    <Layout className={styles.shell}>
      <header className={styles.header}>
        <button className={styles.brand} onClick={() => router.push("/app")} aria-label="Go to workspace home"><BrandMark dark /></button>
        <span className={styles.mode}>{currentMember.accountType === "team" ? "Team workspace" : "Player workspace"}</span>
        {currentMember && (
          <Dropdown menu={accountMenu} placement="bottomRight">
            <Button type="text" className={styles.account}>
              <Avatar size={32}>{currentMember.displayName.charAt(0).toUpperCase()}</Avatar>
              <span>{currentMember.displayName}</span>
            </Button>
          </Dropdown>
        )}
      </header>
      <div className={styles.navRow}>
        <Menu mode="horizontal" selectedKeys={[activeKey]} items={items} onClick={({ key }) => router.push(key)} className={styles.menu} />
        <span><i /> Secure session</span>
      </div>
      <main className={styles.content}>{children}</main>
    </Layout>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider><AppLayoutInner>{children}</AppLayoutInner></AppProvider>;
}
