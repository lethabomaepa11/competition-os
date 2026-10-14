"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "antd";
import { ArrowRightOutlined, PlusOutlined, TeamOutlined, TrophyOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { OrganizationService } from "@/domain/services/organization.service";
import styles from "./command.module.css";

export default function OrgDashboardPage() {
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [counts, setCounts] = useState({ competitions: 0, members: 0 });

  useEffect(() => {
    if (!currentOrg || !currentMember) return;
    Promise.all([new CompetitionService().list(currentOrg.id), new OrganizationService().getMembers(currentOrg.id)]).then(([competitions, members]) => setCounts({ competitions: competitions.length, members: members.length }));
  }, [currentOrg, currentMember]);
  if (!currentOrg) return null;

  const base = `/o/${currentOrg.slug}`;
  return (
    <>
      <header className="page-header"><div><span className="eyebrow">Organization overview</span><h1 className="page-title">{currentOrg.name}</h1><p className="page-subtitle">Competition health, operator access, and the next actions that keep matchday moving.</p></div><div className="page-actions"><Button size="large" onClick={() => router.push(`${base}/members`)}><TeamOutlined /> Invite people</Button><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => router.push(`${base}/competitions/new`)}>New competition</Button></div></header>

      <section className={styles.metrics}>
        <button className="metric-card metric-card--dark" onClick={() => router.push(`${base}/competitions`)}><span className="metric-card__label">Competition portfolio</span><strong className="metric-card__value">{String(counts.competitions).padStart(2, "0")}</strong><span className="metric-card__footer"><TrophyOutlined /> View every competition <ArrowRightOutlined /></span></button>
        <button className="metric-card" onClick={() => router.push(`${base}/members`)}><span className="metric-card__label">Accredited people</span><strong className="metric-card__value">{String(counts.members).padStart(2, "0")}</strong><span className="metric-card__footer"><TeamOutlined /> Manage roles and access <ArrowRightOutlined /></span></button>
        <button className={`${styles.launchCard}`} onClick={() => router.push(`${base}/competitions/new`)}><span>Quick launch</span><PlusOutlined /><strong>Create<br />competition</strong><small>Format, rules, registration, and events.</small></button>
      </section>

      <section className={styles.controlPanel}>
        <div className={styles.controlIntro}><span className="eyebrow">Matchday readiness</span><h2>Your control room is ready.</h2><p>CompetitionOS connects planning, participation, live scoring, public views, and governance in one operational chain.</p></div>
        <div className={styles.readinessList}>
          {[ ["01","Competition engine","Formats and rules ready"], ["02","Live operations","Scores and progression connected"], ["03","Public broadcast","Fixtures, tables, and brackets ready"], ["04","Governance","Every mutation auditable"] ].map(([n,title,copy]) => <div key={n}><span>{n}</span><strong>{title}</strong><small>{copy}</small><i /></div>)}
        </div>
      </section>
    </>
  );
}
