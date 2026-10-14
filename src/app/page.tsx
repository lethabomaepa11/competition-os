"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "antd";
import {
  ArrowRightOutlined,
  CheckOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { BrandMark } from "@/components/common/brand-mark";
import styles from "./page.module.css";

const operations = [
  { number: "01", title: "Design the format", copy: "League, knockout, Swiss, groups, or a hybrid season. Every rule stays configurable." },
  { number: "02", title: "Run the operation", copy: "Registration, seeding, schedules, officials, scores, disputes, and progression in one control plane." },
  { number: "03", title: "Broadcast the story", copy: "Publish live fixtures, tables, brackets, commentary, and player statistics to every screen." },
];

const platformPoints = [
  "Multi organization governance",
  "Role based competition operations",
  "Live scoring and match control",
  "Audit history with undo",
  "Reusable competition blueprints",
  "Responsive public broadcast views",
];

function LandingInner() {
  const router = useRouter();
  const { currentMember } = useApp();

  useEffect(() => {
    if (currentMember) router.push("/app");
  }, [currentMember, router]);

  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <button className={styles.brandButton} onClick={() => router.push("/")} aria-label="CompetitionOS home">
          <BrandMark dark />
        </button>
        <div className={styles.navMeta}>
          <span><span className="status-dot status-dot--live" /> Systems operational</span>
          <Button type="text" className={styles.signIn} onClick={() => router.push("/login")}>Sign in</Button>
          <Button type="primary" onClick={() => router.push("/register")}>Start building <ArrowRightOutlined /></Button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <div className={styles.kicker}><ThunderboltOutlined /> Competition infrastructure for the main stage</div>
          <h1>Every match.<br />Every format.<br /><em>One command.</em></h1>
          <p>Build, operate, and broadcast world class competitions across football, esports, schools, communities, and everything between.</p>
          <div className={styles.heroActions}>
            <Button type="primary" size="large" onClick={() => router.push("/register")}>Create your competition <ArrowRightOutlined /></Button>
            <Button size="large" ghost onClick={() => document.getElementById("platform")?.scrollIntoView()}><PlayCircleOutlined /> Explore the platform</Button>
          </div>
          <div className={styles.trustRow}>
            <span><SafetyCertificateOutlined /> Auditable</span>
            <span><GlobalOutlined /> Multi tenant</span>
            <span><ThunderboltOutlined /> Live ready</span>
          </div>
        </div>

        <div className={styles.broadcast} aria-label="Competition operations preview">
          <div className={styles.broadcastTop}>
            <span>CO / LIVE CONTROL</span>
            <span className={styles.livePill}><i /> On air</span>
          </div>
          <div className={styles.scoreboard}>
            <div className={styles.matchMeta}><span>Premier division · Matchday 18</span><span>72:14</span></div>
            <div className={styles.teams}>
              <div><b>CT</b><span>Cape Town City</span></div>
              <strong>2</strong><i>:</i><strong>1</strong>
              <div><b>OR</b><span>Orlando Rovers</span></div>
            </div>
            <div className={styles.timeline}><i /><i /><i /><i /><i /></div>
          </div>
          <div className={styles.broadcastStats}>
            <div><span>Live events</span><strong>08</strong><small>+3 today</small></div>
            <div><span>Matches</span><strong>142</strong><small>92% complete</small></div>
            <div><span>Audience</span><strong>84K</strong><small>Across 12 regions</small></div>
          </div>
          <div className={styles.fixtureStrip}>
            <span>Up next</span>
            <b>Jozi Titans</b><i>vs</i><b>Durban United</b>
            <time>20:00</time>
          </div>
        </div>
      </section>

      <div className={styles.ticker} aria-label="Supported competition types">
        <div>
          <span>Premier leagues</span><i>✦</i><span>Continental cups</span><i>✦</i><span>Esports majors</span><i>✦</i><span>School championships</span><i>✦</i><span>Community tournaments</span><i>✦</i><span>Premier leagues</span><i>✦</i><span>Continental cups</span>
        </div>
      </div>

      <section className={styles.operationSection} id="platform">
        <header className={styles.sectionIntro}>
          <span className="eyebrow">One operating system</span>
          <h2>From blank canvas<br />to final whistle.</h2>
          <p>The whole competition lifecycle lives in one connected workspace. Operators move faster. Participants know what is next. Audiences stay inside the story.</p>
        </header>
        <div className={styles.operationList}>
          {operations.map((item) => (
            <article key={item.number} className={styles.operationItem}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <ArrowRightOutlined />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.formatSection}>
        <div className={styles.formatBoard}>
          <div className={styles.formatHeader}><span>FORMAT ENGINE / 05</span><span>Built to adapt</span></div>
          <div className={styles.formatMain}>
            <span className={styles.formatIndex}>01</span>
            <div><small>Selected format</small><h3>Group stage<br />+ knockout</h3><p>32 teams · 8 groups · 64 matches</p></div>
          </div>
          <div className={styles.formatTabs}><span className={styles.activeTab}>Groups</span><span>League</span><span>Single elim</span><span>Double elim</span><span>Swiss</span></div>
        </div>
        <div className={styles.formatCopy}>
          <span className="eyebrow">Rules without limits</span>
          <h2>Your competition should not have to fit the software.</h2>
          <p>Choose a proven format, then control scoring, tiebreakers, seeding, progression, registration, and scheduling around the way your organization actually works.</p>
          <div className={styles.checkGrid}>
            {platformPoints.map((point) => <span key={point}><CheckOutlined /> {point}</span>)}
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span>Ready when the pressure is on.</span>
          <h2>Build the competition<br />everyone remembers.</h2>
        </div>
        <Button type="primary" size="large" onClick={() => router.push("/register")}>Enter the command center <ArrowRightOutlined /></Button>
      </section>

      <footer className={styles.footer}>
        <BrandMark dark />
        <p>Competition infrastructure for serious operators.</p>
        <span>© {new Date().getFullYear()} CompetitionOS</span>
      </footer>
    </main>
  );
}

export default function Landing() {
  return <AppProvider><LandingInner /></AppProvider>;
}
