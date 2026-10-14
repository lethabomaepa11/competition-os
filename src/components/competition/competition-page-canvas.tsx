"use client";

import { ArrowRightOutlined, CalendarOutlined, ScheduleOutlined, TeamOutlined, TrophyOutlined } from "@ant-design/icons";
import { Progress, Tag, Typography } from "antd";
import type { Competition } from "@/domain/competition";
import type { CompetitionPage, CompetitionPageBlock } from "@/domain/competition-pages";
import type { Event } from "@/domain/event";
import { EventStatus } from "@/domain/types";
import { PublicCompetitionModule } from "@/components/competition/public-competition-module";
import styles from "./competition-page-canvas.module.css";

type PreviewEvent = Event & { participantCount: number; matchCount: number; completedCount: number };

type Props = {
  competition: Competition;
  page: CompetitionPage;
  pages: CompetitionPage[];
  events: PreviewEvent[];
  selectedBlockId?: string;
  dropIndex?: number | null;
  onSelectBlock: (id: string) => void;
  onDropAt: (event: React.DragEvent, index: number) => void;
  onHoverIndex: (index: number | null) => void;
};

export function CompetitionPageCanvas({ competition, page, pages, events, selectedBlockId, dropIndex, onSelectBlock, onDropAt, onHoverIndex }: Props) {
  const totalMatches = events.reduce((sum, event) => sum + event.matchCount, 0);
  const completedMatches = events.reduce((sum, event) => sum + event.completedCount, 0);
  const entrantCount = events.reduce((sum, event) => sum + event.participantCount, 0);
  const completion = totalMatches ? Math.round(completedMatches / totalMatches * 100) : 0;
  const publishedPages = pages.filter((item) => item.enabled);

  const moduleByBlock = (block: CompetitionPageBlock) => {
    if (["standings", "bracket", "results", "schedule", "roster"].includes(block.type)) {
      return <PublicCompetitionModule kind={block.type as "standings" | "bracket" | "results" | "schedule" | "roster"} title={block.title || block.type} events={events} />;
    }
    if (block.type === "statistics" && page.kind === "live") {
      return <PublicCompetitionModule kind="statistics" title={block.title || "Statistics"} events={events} />;
    }
    return null;
  };

  const renderBlock = (block: CompetitionPageBlock) => {
    if (block.type === "hero") return null;
    const liveModule = moduleByBlock(block);
    if (liveModule) return liveModule;
    if (block.type === "statistics") return (
      <div className={styles.metrics}>
        <div><span>{block.title || "Competition progress"}</span><strong>{completion}%</strong><Progress percent={completion} showInfo={false} strokeColor={competition.themeColor ?? "#1c5fd4"} /></div>
        <div><span>Total fixtures</span><strong>{String(totalMatches).padStart(2, "0")}</strong><small>Across {events.length} events</small></div>
        <div><span>Competitors</span><strong>{String(entrantCount).padStart(2, "0")}</strong><small>Registered entries</small></div>
      </div>
    );
    if (block.type === "event_list") return (
      <section className={styles.eventGrid}>
        {events.map((event, index) => {
          const percent = event.matchCount ? Math.round(event.completedCount / event.matchCount * 100) : 0;
          return <article key={event.id} className={styles.eventCard}>
            <div className={styles.eventTop}><span>{String(index + 1).padStart(2, "0")}</span><Tag color={event.status === EventStatus.InProgress ? "blue" : "default"}>{event.status.replace(/_/g, " ")}</Tag></div>
            <h4>{event.name}</h4><p>{event.format.replace(/_/g, " ")}</p>
            <div className={styles.eventMeta}><span><TeamOutlined /> {event.participantCount} entrants</span><span><ScheduleOutlined /> {event.completedCount}/{event.matchCount} complete</span></div>
            <Progress percent={percent} showInfo={false} strokeColor={event.themeColor ?? competition.themeColor ?? "#1c5fd4"} />
            <footer><span>{event.dateStart ? new Date(event.dateStart).toLocaleDateString() : "Date TBC"}</span><ArrowRightOutlined /></footer>
          </article>;
        })}
        {events.length === 0 && <div className={styles.empty}><CalendarOutlined /><strong>No events published yet</strong><span>Published events will appear here automatically.</span></div>}
      </section>
    );
    if (block.type === "call_to_action") {
      const target = block.href?.startsWith("page:") ? pages.find((item) => item.slug === block.href?.slice(5) && item.enabled) : undefined;
      const href = target ? `?page=${encodeURIComponent(target.slug)}` : block.href || "#";
      return <section className={styles.cta}><div><small>Next step</small><h3>{block.title || "Continue to the competition"}</h3>{block.body && <p>{block.body}</p>}</div><a href={href}>{target?.name || "Continue"}<ArrowRightOutlined /></a></section>;
    }
    return <section className={styles.textBlock}><small>{block.type.replace(/_/g, " ")}</small><h3>{block.title || (block.type === "sponsors" ? "Our partners" : "Competition information")}</h3>{block.body ? <p>{block.body}</p> : <Typography.Text type="secondary">Add content in the block settings to show it here.</Typography.Text>}</section>;
  };

  return (
    <div className={styles.browser} style={{ "--preview-accent": competition.themeColor ?? "#1c5fd4" } as React.CSSProperties}>
      <div className={styles.browserBar}><i /><i /><i /><span>competitionos.io/c/{competition.id}?page={page.slug}</span></div>
      <div className={styles.nav}>
        <strong>{competition.name}</strong>
        <div>{publishedPages.map((item) => <span key={item.id} className={item.id === page.id ? styles.activePage : ""} aria-current={item.id === page.id ? "page" : undefined}>{item.name}</span>)}</div>
      </div>
      <header className={styles.hero} style={competition.coverImage ? { backgroundImage: `linear-gradient(90deg, rgba(5, 15, 32, .94), rgba(5, 15, 32, .42)), url("${competition.coverImage}")` } : undefined}>
        <small>{page.kind === "live" ? "Live competition centre" : "Official competition page"}</small>
        <h2>{page.kind === "home" ? competition.name : page.name}</h2>
        <p>{page.kind === "home" ? competition.description : `${competition.name} · ${page.name}`}</p>
        <div className={styles.heroMeta}><span><TrophyOutlined /> {events.length} events</span><span><ScheduleOutlined /> {completedMatches}/{totalMatches} matches</span><span><TeamOutlined /> {entrantCount} entrants</span></div>
      </header>
      <div className={styles.content} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropAt(event, page.blocks.length)}>
        {page.blocks.map((block, index) => (
          <div key={block.id} className={`${styles.block} ${block.id === selectedBlockId ? styles.blockSelected : ""}`} data-drop-target={dropIndex === index} draggable onClick={() => onSelectBlock(block.id)} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-competition-block-id", block.id); }} onDragEnter={() => onHoverIndex(index)} onDragLeave={() => onHoverIndex(null)} onDragOver={(event) => { event.preventDefault(); }} onDrop={(event) => { event.stopPropagation(); onDropAt(event, index); }}>
            {block.type !== "hero" && <button type="button" className={styles.editBlock} onClick={(event) => { event.stopPropagation(); onSelectBlock(block.id); }}>Edit section</button>}
            {renderBlock(block)}
          </div>
        ))}
        {page.blocks.length === 0 && <div className={styles.dropEmpty}>Drag a component here to start building this page.</div>}
      </div>
      <footer className={styles.footer}>Official competition data <span>Preview with real competition data</span></footer>
    </div>
  );
}

export type { PreviewEvent };
