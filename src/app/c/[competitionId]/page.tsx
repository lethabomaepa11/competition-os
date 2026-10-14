"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Alert, Progress, Spin, Tag } from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { BrandMark } from "@/components/common/brand-mark";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { OrganizationService } from "@/domain/services/organization.service";
import type { Competition } from "@/domain/competition";
import type { Event } from "@/domain/event";
import type { Match } from "@/domain/match";
import { EventStatus, MatchStatus, Visibility } from "@/domain/types";
import { ensureRequiredCompetitionPages, type CompetitionPageBlock } from "@/domain/competition-pages";
import { PublicCompetitionModule } from "@/components/competition/public-competition-module";
import styles from "./page.module.css";

type PublicEvent = Event & {
  participantCount: number;
  matchCount: number;
  completedCount: number;
};

export default function PublicCompetitionPage() {
  const competitionId = useParams().competitionId as string;
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [pageSlug, setPageSlug] = useState("home");
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");

  useEffect(() => {
    (async () => {
      const competitionService = new CompetitionService();
      const eventService = new EventService();
      const registrationService = new RegistrationService();
      const record = await competitionService.get(competitionId);
      setCompetition(record ?? null);
      setPageSlug(new URLSearchParams(window.location.search).get("page") ?? "home");
      if (record?.visibility === Visibility.Private) {
        setAccessError("This competition is private.");
      } else if (record) {
        const [organization, eventRecords] = await Promise.all([
          new OrganizationService().get(record.organizationId),
          eventService.list(record.id),
        ]);
        setOrgName(organization?.name ?? "");
        setOrgSlug(organization?.slug ?? "");
        setEvents(
          await Promise.all(
            eventRecords.filter((event) => event.status !== EventStatus.Draft && event.status !== EventStatus.Cancelled).map(async (event) => {
              const [participants, matches] = await Promise.all([
                registrationService.getParticipants(event.id),
                eventService.getMatches(event.id),
              ]);
              return {
                ...event,
                participantCount: participants.length,
                matchCount: matches.length,
                completedCount: matches.filter(
                  (match: Match) => match.status === MatchStatus.Completed,
                ).length,
              };
            }),
          ),
        );
      }
      setLoading(false);
    })();
  }, [competitionId]);

  if (loading)
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    );
  if (accessError)
    return <div className={styles.loading}><Alert message="Competition unavailable" description={accessError} type="info" showIcon /></div>;
  if (!competition)
    return (
      <div className={styles.loading}>
        <Alert message="Competition not found" type="error" showIcon />
      </div>
    );
  const totalMatches = events.reduce((sum, event) => sum + event.matchCount, 0);
  const completedMatches = events.reduce(
    (sum, event) => sum + event.completedCount,
    0,
  );
  const completion = totalMatches
    ? Math.round((completedMatches / totalMatches) * 100)
    : 0;
  const pages = ensureRequiredCompetitionPages(competition.pages ?? []);
  const activePage = pages.find((page) => page.slug === pageSlug && page.enabled) ?? pages.find((page) => page.kind === "home")!;
  const liveUrl = `/live/${orgSlug}/${competition.id}`;
  const safeHref = (href?: string) => href && (/^https?:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//"))) ? href : "/register";
  const renderBlock = (block: CompetitionPageBlock) => {
    if (block.type === "hero") return null;
    if (block.type === "statistics" && activePage.kind === "live") return <PublicCompetitionModule key={block.id} kind="statistics" title={block.title || "Statistics"} events={events} />;
    if (block.type === "statistics") return (
      <div className={styles.overview} key={block.id}>
        <div><span>{block.title || "Competition progress"}</span><strong>{completion}%</strong><Progress percent={completion} showInfo={false} strokeColor={competition.themeColor ?? "#1c5fd4"} railColor="#DDE3E0" /></div>
        <div><span>Total fixtures</span><strong>{String(totalMatches).padStart(2, "0")}</strong><small>Across {events.length} events</small></div>
        <div><span>Competitors</span><strong>{String(events.reduce((sum, event) => sum + event.participantCount, 0)).padStart(2, "0")}</strong><small>Registered entries</small></div>
      </div>
    );
    if (block.type === "event_list") return (
      <section className={styles.pageSection} key={block.id}>
        <div className={styles.sectionHeading}><div><span>Competition programme</span><h2>{block.title || "Events and progress"}</h2></div><p>Follow every format from opening fixture to final result.</p></div>
        <div className={styles.eventGrid}>
          {events.map((event, index) => {
            const percent = event.matchCount ? Math.round((event.completedCount / event.matchCount) * 100) : 0;
            return <article key={event.id} className={styles.eventCard}><div className={styles.eventTop}><span>{String(index + 1).padStart(2, "0")}</span><Tag color={event.status === "in_progress" ? "blue" : "default"}>{event.status.replace(/_/g, " ")}</Tag></div><h3>{event.name}</h3><p>{event.format.replace(/_/g, " ")}</p><div className={styles.eventStats}><span><TeamOutlined /> {event.participantCount} entries</span><span><ScheduleOutlined /> {event.completedCount}/{event.matchCount} complete</span></div><Progress percent={percent} showInfo={false} strokeColor={competition.themeColor ?? "#1c5fd4"} railColor="#E3E8E5" /><footer><span>{event.dateStart ? new Date(event.dateStart).toLocaleDateString() : "Date TBC"}</span><ArrowRightOutlined /></footer></article>;
          })}
          {events.length === 0 && <div className={styles.empty}>The competition programme will appear here when events are published.</div>}
        </div>
      </section>
    );
    if (["standings", "bracket", "results", "schedule", "roster"].includes(block.type)) return <PublicCompetitionModule key={block.id} kind={block.type as "standings" | "bracket" | "results" | "schedule" | "roster"} title={block.title || block.type} events={events} />;
    if (block.type === "call_to_action") {
      const pageLink = block.href?.startsWith("page:") ? pages.find((page) => page.slug === block.href?.slice(5) && page.enabled) : undefined;
      const href = pageLink ? `/c/${competition.id}?page=${encodeURIComponent(pageLink.slug)}` : block.id === "live-link" ? liveUrl : safeHref(block.href);
      const linkLabel = activePage.kind === "invite" ? "Continue to registration" : block.title?.toLowerCase().includes("join") ? "Join this competition" : pageLink?.name ?? (block.id === "live-link" ? "Open live view" : block.title || "Continue");
      return <section className={styles.customBlock} key={block.id}><div><span>{block.type.replace(/_/g, " ")}</span><h2>{block.title || "Continue to the competition"}</h2>{block.body && <p>{block.body}</p>}</div><Link className={styles.actionLink} href={href}>{linkLabel} <ArrowRightOutlined /></Link></section>;
    }
    return <section className={styles.customBlock} key={block.id}><div><span>{block.type.replace(/_/g, " ")}</span><h2>{block.title || "Competition information"}</h2>{block.body && <p>{block.body}</p>}</div></section>;
  };

  return (
    <main className={styles.page} style={{ "--competition-accent": competition.themeColor ?? "#1c5fd4" } as React.CSSProperties}>
      <nav className={styles.nav} aria-label="Competition pages">
        <BrandMark dark />
        <div className={styles.pageNav}>{pages.filter((page) => page.enabled).map((page) => <a key={page.id} href={`/c/${competition.id}?page=${encodeURIComponent(page.slug)}`} aria-current={page.id === activePage.id ? "page" : undefined}>{page.name}</a>)}</div>
        <small>CompetitionOS broadcast</small>
      </nav>
      <header className={styles.hero}>
        {competition.coverImage && <Image src={competition.coverImage} alt="" fill sizes="100vw" priority unoptimized />}
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <div className={styles.tags}>
            <Tag color="blue">{competition.status.replace(/_/g, " ")}</Tag>
            <Tag>{competition.game?.name ?? "Open competition"}</Tag>
          </div>
          <span className={styles.organizer}>
            Presented by {orgName || "Competition organizer"}
          </span>
          <h1>{activePage.kind === "home" ? competition.name : activePage.name}</h1>
          {activePage.kind === "home" && competition.description && <p>{competition.description}</p>}
          {activePage.kind === "invite" && <p>Choose the event that fits your team or player profile, then complete your registration.</p>}
          {activePage.kind === "live" && <p>Follow fixtures, results, standings, brackets and qualification as they happen.</p>}
          {activePage.kind === "custom" && <p>{competition.name} · Official competition information</p>}
          <div className={styles.heroActions}>
            {activePage.kind === "home" && pages.find((page) => page.kind === "invite")?.enabled && <Link href={`/c/${competition.id}?page=invite`}>Join <ArrowRightOutlined /></Link>}
            {activePage.kind !== "live" && pages.find((page) => page.kind === "live")?.enabled && <Link href={liveUrl}>Live view <ArrowRightOutlined /></Link>}
            {activePage.kind === "live" && <Link href={liveUrl}>Open live competition centre <ArrowRightOutlined /></Link>}
          </div>
          <div className={styles.heroMeta}>
            <span>
              <TrophyOutlined /> {events.length} events
            </span>
            <span>
              <ScheduleOutlined /> {completedMatches}/{totalMatches} matches
            </span>
            {competition.dateStart && (
              <span>
                <CalendarOutlined />{" "}
                {new Date(competition.dateStart).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <section className={styles.content}>
        {activePage.kind === "invite" ? activePage.blocks.map(renderBlock)
          : activePage.kind === "live" ? activePage.blocks.map(renderBlock)
            : activePage.kind === "custom" ? activePage.blocks.map(renderBlock)
              : activePage.blocks.map(renderBlock)}
      </section>
      <footer className={styles.footer}>
        <BrandMark dark />
        <span>Official competition data</span>
        <small>© {new Date().getFullYear()}</small>
      </footer>
    </main>
  );
}
