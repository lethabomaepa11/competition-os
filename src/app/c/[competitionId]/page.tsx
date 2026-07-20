"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Typography, Tag, Descriptions, Spin, Alert, Space, Row, Col } from "antd";
import { TrophyOutlined, CalendarOutlined, TeamOutlined, ScheduleOutlined } from "@ant-design/icons";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { OrganizationService } from "@/domain/services/organization.service";
import type { Competition } from "@/domain/competition";
import type { Event, Stage } from "@/domain/event";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus } from "@/domain/types";

const { Title, Text } = Typography;

export default function PublicCompetitionPage() {
  const params = useParams();
  const competitionId = params.competitionId as string;
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [orgName, setOrgName] = useState("");
  const [events, setEvents] = useState<(Event & { participantCount: number; matchCount: number; completedCount: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
    if (!competitionId) return;
    const compSvc = new CompetitionService();
    const evtSvc = new EventService();
    const regSvc = new RegistrationService();
    const orgSvc = new OrganizationService();

    const comp = await compSvc.get(competitionId);
    setCompetition(comp ?? null);

    if (comp) {
      const org = await orgSvc.get(comp.organizationId);
      setOrgName(org?.name ?? "");

      const evts = await evtSvc.list(comp.id);
      const enriched = [];
      for (const e of evts) {
        const participants = await regSvc.getParticipants(e.id);
        const stages = await evtSvc.getStages(e.id);
        const allRounds = [];
        for (const s of stages) {
          const rounds = await evtSvc.getRounds(s.id);
          allRounds.push(...rounds);
        }
        const roundIds = new Set(allRounds.map(r => r.id));
        const allMatches = (await evtSvc.getMatches(e.id)).filter((m: Match) => roundIds.has(m.roundId));
        enriched.push({
          ...e,
          participantCount: participants.length,
          matchCount: allMatches.length,
          completedCount: allMatches.filter((m: Match) => m.status === MatchStatus.Completed).length,
        });
      }
      setEvents(enriched);
    }
    setLoading(false);
    })();
  }, [competitionId]);

  if (loading) return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 100 }} />;

  if (!competition) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        <Alert message="Competition not found" type="error" showIcon />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "default",
    published: "blue",
    in_progress: "green",
    completed: "purple",
    archived: "orange",
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Space align="center" style={{ marginBottom: 8 }}>
          <TrophyOutlined style={{ fontSize: 32, color: "#faad14" }} />
          <Title level={2} style={{ margin: 0 }}>{competition.name}</Title>
        </Space>
        {orgName && <Text type="secondary" style={{ display: "block", fontSize: 16 }}>Organized by {orgName}</Text>}
        <Tag color={statusColors[competition.status] ?? "default"} style={{ marginTop: 8 }}>{competition.status}</Tag>
      </div>

      {competition.description && (
        <Card style={{ marginBottom: 16 }}>
          <Text>{competition.description}</Text>
        </Card>
      )}

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        {competition.game?.name && <Descriptions.Item label="Game">{competition.game.name}</Descriptions.Item>}
        <Descriptions.Item label="Events">{events.length}</Descriptions.Item>
        <Descriptions.Item label="Visibility">{competition.visibility}</Descriptions.Item>
        {competition.dateStart && <Descriptions.Item label="Start">{new Date(competition.dateStart).toLocaleDateString()}</Descriptions.Item>}
        {competition.dateEnd && <Descriptions.Item label="End">{new Date(competition.dateEnd).toLocaleDateString()}</Descriptions.Item>}
      </Descriptions>

      <Title level={4}>Events</Title>
      <Row gutter={[16, 16]}>
        {events.map(e => (
          <Col key={e.id} xs={24} sm={12} md={8}>
            <Card
              size="small"
              style={{ height: "100%" }}
              title={<Space><ScheduleOutlined /> {e.name}</Space>}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <Tag>{e.format}</Tag>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 13 }}>
                  <span><TeamOutlined /> {e.participantCount} participants</span>
                  <span><ScheduleOutlined /> {e.completedCount}/{e.matchCount} matches</span>
                </div>
                {e.dateStart && (
                  <Text style={{ fontSize: 12, color: "#888" }}>
                    <CalendarOutlined /> {new Date(e.dateStart).toLocaleDateString()}
                  </Text>
                )}
              </Space>
            </Card>
          </Col>
        ))}
        {events.length === 0 && (
          <Col span={24}>
            <Text type="secondary">No events yet.</Text>
          </Col>
        )}
      </Row>

      <div style={{ textAlign: "center", marginTop: 32, padding: 16, borderTop: "1px solid #f0f0f0" }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Powered by CompetitionOS</Text>
      </div>
    </div>
  );
}
