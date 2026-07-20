"use client";

import { useRouter } from "next/navigation";
import { Card, Row, Col, Typography, Statistic } from "antd";
import { TrophyOutlined, TeamOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { AppProvider, useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { OrganizationService } from "@/domain/services/organization.service";
import { useEffect, useState } from "react";

const { Title } = Typography;

function OrgDashboardInner() {
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [compCount, setCompCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!currentOrg || !currentMember) return;
    (async () => {
      const compSvc = new CompetitionService();
      const orgSvc = new OrganizationService();
      setCompCount((await compSvc.list(currentOrg.id)).length);
      setMemberCount((await orgSvc.getMembers(currentOrg.id)).length);
    })();
  }, [currentOrg, currentMember]);

  if (!currentOrg) return null;

  return (
    <div>
      <Title level={3}>{currentOrg.name} Dashboard</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => router.push(`/o/${currentOrg.slug}/competitions`)}>
            <Statistic title="Competitions" value={compCount} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => router.push(`/o/${currentOrg.slug}/members`)}>
            <Statistic title="Members" value={memberCount} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => router.push(`/o/${currentOrg.slug}/competitions/new`)}>
            <Statistic title="Quick Action" value="New Competition" prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default function OrgDashboardPage() {
  return <OrgDashboardInner />;
}
