"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { MatchStatus } from "@/domain/types";
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
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const competitionService = new CompetitionService();
      const eventService = new EventService();
      const registrationService = new RegistrationService();
      const record = await competitionService.get(competitionId);
      setCompetition(record ?? null);
      if (record) {
        const [organization, eventRecords] = await Promise.all([
          new OrganizationService().get(record.organizationId),
          eventService.list(record.id),
        ]);
        setOrgName(organization?.name ?? "");
        setEvents(
          await Promise.all(
            eventRecords.map(async (event) => {
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

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <BrandMark dark />
        <span>
          <i /> Official competition page
        </span>
        <small>CompetitionOS broadcast</small>
      </nav>
      <header className={styles.hero}>
        {competition.coverImage && <img src={competition.coverImage} alt="" />}
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <div className={styles.tags}>
            <Tag color="lime">{competition.status.replace(/_/g, " ")}</Tag>
            <Tag>{competition.game?.name ?? "Open competition"}</Tag>
          </div>
          <span className={styles.organizer}>
            Presented by {orgName || "Competition organizer"}
          </span>
          <h1>{competition.name}</h1>
          {competition.description && <p>{competition.description}</p>}
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
        <div className={styles.overview}>
          <div>
            <span>Competition progress</span>
            <strong>{completion}%</strong>
            <Progress
              percent={completion}
              showInfo={false}
              strokeColor="#1c5fd4"
              railColor="#DDE3E0"
            />
          </div>
          <div>
            <span>Total fixtures</span>
            <strong>{String(totalMatches).padStart(2, "0")}</strong>
            <small>
              Across {events.length} event{events.length === 1 ? "" : "s"}
            </small>
          </div>
          <div>
            <span>Competitors</span>
            <strong>
              {String(
                events.reduce((sum, event) => sum + event.participantCount, 0),
              ).padStart(2, "0")}
            </strong>
            <small>Registered entries</small>
          </div>
        </div>

        <div className={styles.sectionHeading}>
          <div>
            <span>Competition programme</span>
            <h2>Events and progress.</h2>
          </div>
          <p>Follow every format from opening fixture to final result.</p>
        </div>
        <div className={styles.eventGrid}>
          {events.map((event, index) => {
            const percent = event.matchCount
              ? Math.round((event.completedCount / event.matchCount) * 100)
              : 0;
            return (
              <article key={event.id} className={styles.eventCard}>
                <div className={styles.eventTop}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Tag
                    color={event.status === "in_progress" ? "green" : "default"}
                  >
                    {event.status.replace(/_/g, " ")}
                  </Tag>
                </div>
                <h3>{event.name}</h3>
                <p>{event.format.replace(/_/g, " ")}</p>
                <div className={styles.eventStats}>
                  <span>
                    <TeamOutlined /> {event.participantCount} entries
                  </span>
                  <span>
                    <ScheduleOutlined /> {event.completedCount}/
                    {event.matchCount} complete
                  </span>
                </div>
                <Progress
                  percent={percent}
                  showInfo={false}
                  strokeColor="#1c5fd4"
                  railColor="#E3E8E5"
                />
                <footer>
                  <span>
                    {event.dateStart
                      ? new Date(event.dateStart).toLocaleDateString()
                      : "Date TBC"}
                  </span>
                  <ArrowRightOutlined />
                </footer>
              </article>
            );
          })}
          {events.length === 0 && (
            <div className={styles.empty}>
              The competition programme will appear here when events are
              published.
            </div>
          )}
        </div>
      </section>
      <footer className={styles.footer}>
        <BrandMark dark />
        <span>Official competition data</span>
        <small>© {new Date().getFullYear()}</small>
      </footer>
    </main>
  );
}
