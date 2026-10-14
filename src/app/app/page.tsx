"use client";

import { Button } from "antd";
import { ArrowRightOutlined, BarChartOutlined, BellOutlined, TeamOutlined, TrophyOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import styles from "./workspace.module.css";

export default function ParticipantHome() {
  const router = useRouter();
  const { currentMember } = useApp();
  if (!currentMember) return null;
  const teamAccount = currentMember.accountType === "team";

  return <>
    <header className="page-header"><div><span className="eyebrow">{teamAccount ? "Captain workspace" : "Player workspace"}</span><h1 className="page-title">Welcome, {currentMember.displayName}.</h1><p className="page-subtitle">{teamAccount ? "Manage your official roster, find eligible tournaments, submit registrations, and follow results." : "Find individual tournaments, track registrations, and keep your competition record in one place."}</p></div></header>
    <section className={styles.quickGrid}>
      {teamAccount && <button onClick={() => router.push("/app/teams")}><TeamOutlined /><span>Team and roster</span><strong>Manage identity, players, and invite links</strong><ArrowRightOutlined /></button>}
      <button onClick={() => router.push("/app/opportunities")}><BellOutlined /><span>Tournament directory</span><strong>See competitions that match your account</strong><ArrowRightOutlined /></button>
      <button onClick={() => router.push("/app/events")}><TrophyOutlined /><span>My events</span><strong>Follow approved entries and fixtures</strong><ArrowRightOutlined /></button>
      <button onClick={() => router.push("/app/performance")}><BarChartOutlined /><span>Performance</span><strong>Review results and competition history</strong><ArrowRightOutlined /></button>
    </section>
    <div className={styles.helpStrip}><div><span>Need a walkthrough?</span><strong>Use the CompetitionOS how to center for role specific instructions.</strong></div><Button onClick={() => router.push("/how-to")}>Open guides</Button></div>
  </>;
}
