"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Spin } from "antd";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  LogoutOutlined,
  MenuOutlined,
  FormOutlined,
  SettingOutlined,
  BookOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { BrandMark } from "@/components/common/brand-mark";
import styles from "./layout.module.css";

const { useBreakpoint } = Grid;

function OrgLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const screens = useBreakpoint();
  const { currentMember, organizations, ready, logout, selectOrg } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const orgSlug = params.orgSlug as string;
  const org = organizations.find((item) => item.slug === orgSlug);
  const mobile = !screens.lg;

  useEffect(() => {
    if (!ready) return;
    if (!currentMember) { router.push("/login"); return; }
    if (currentMember.accountType !== "operator") { router.replace("/app"); return; }
    if (org) selectOrg(org);
  }, [ready, currentMember, org, selectOrg, router]);

  useEffect(() => {
    if (ready && currentMember && !org && organizations.length > 0) router.push("/app");
  }, [ready, org, organizations, currentMember, router]);

  if (!ready || (currentMember && !org)) return <div className={styles.loading}><Spin size="large" /></div>;
  if (!currentMember || !org) return null;

  const base = `/o/${orgSlug}`;
  const menuItems = [
    { key: base, icon: <AppstoreOutlined />, label: "Command center" },
    { key: `${base}/competitions`, icon: <TrophyOutlined />, label: "Competitions" },
    { key: `${base}/registrations`, icon: <FormOutlined />, label: "Registrations" },
    { key: `${base}/members`, icon: <TeamOutlined />, label: "People" },
    { key: `${base}/blueprints`, icon: <ApartmentOutlined />, label: "Blueprints" },
    { key: `${base}/audit`, icon: <AuditOutlined />, label: "Audit trail" },
    { key: `${base}/settings`, icon: <SettingOutlined />, label: "Settings" },
    { key: "/how-to", icon: <BookOutlined />, label: "How to" },
  ];
  const selected = [...menuItems].sort((a, b) => b.key.length - a.key.length).find((item) => pathname === item.key || pathname.startsWith(`${item.key}/`))?.key ?? base;
  const go = (key: string) => { router.push(key); setDrawerOpen(false); };

  const navigation = (
    <div className={styles.navigation}>
      <div className={styles.sideBrand}><BrandMark compact={collapsed && !mobile} dark /></div>
      <div className={styles.orgIdentity}>
        <span>Organization</span>
        {(!collapsed || mobile) && <strong>{org.name}</strong>}
      </div>
      <Menu theme="dark" mode="inline" inlineCollapsed={collapsed && !mobile} selectedKeys={[selected]} items={menuItems} onClick={({ key }) => go(key)} className={styles.sideMenu} />
      {(!collapsed || mobile) && <div className={styles.systemCard}><span><i /> Live systems ready</span><p>Scores, brackets, tables, and public views are connected.</p></div>}
    </div>
  );

  return (
    <Layout className={styles.shell}>
      {!mobile && <Layout.Sider width={270} collapsedWidth={84} collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" className={`org-layout-sider ${styles.sider}`}>{navigation}</Layout.Sider>}
      {mobile && <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ wrapper: { width: 286 }, body: { padding: 0, background: "#07111f" }, header: { display: "none" } }}>{navigation}</Drawer>}
      <Layout>
        <header className={`org-layout-header ${styles.header}`}>
          <div className={styles.headerLead}>
            {mobile && <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} aria-label="Open navigation" />}
            <div><span>Competition operations</span><strong>{menuItems.find((item) => item.key === selected)?.label}</strong></div>
          </div>
          <div className={styles.headerStatus}><span><i /> Platform live</span><b>All systems nominal</b></div>
          <Dropdown placement="bottomRight" menu={{ items: [
            { key: "guide", icon: <BookOutlined />, label: "How to use CompetitionOS", onClick: () => router.push("/how-to") },
            { type: "divider" },
            { key: "profile", icon: <UserOutlined />, label: "Profile", onClick: () => router.push("/profile") },
            { key: "logout", icon: <LogoutOutlined />, label: "Sign out", onClick: async () => { await logout(); router.push("/login"); } },
          ] }}>
            <Button type="text" className={styles.account}><Avatar size={34}>{currentMember.displayName.charAt(0).toUpperCase()}</Avatar><span>{currentMember.displayName}</span></Button>
          </Dropdown>
        </header>
        <main className="org-content">{children}</main>
      </Layout>
    </Layout>
  );
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return <AppProvider><OrgLayoutInner>{children}</OrgLayoutInner></AppProvider>;
}
