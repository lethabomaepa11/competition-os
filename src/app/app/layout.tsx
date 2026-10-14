"use client";

import { usePathname, useRouter } from "next/navigation";
import { Avatar, Button, Dropdown, Layout, Menu } from "antd";
import { AppstoreOutlined, LogoutOutlined, TrophyOutlined, UserOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { BrandMark } from "@/components/common/brand-mark";
import styles from "./layout.module.css";

const items = [
  { key: "/app", label: "Organizations", icon: <AppstoreOutlined /> },
  { key: "/app/events", label: "My events", icon: <TrophyOutlined /> },
];

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentMember, logout } = useApp();
  const activeKey = [...items].sort((a, b) => b.key.length - a.key.length).find((item) => pathname === item.key || pathname.startsWith(`${item.key}/`))?.key ?? "/app";

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
        <span className={styles.mode}>Operator workspace</span>
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
