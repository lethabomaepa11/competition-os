"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  Descriptions,
  Popconfirm,
  Table,
  InputNumber,
  Divider,
  Collapse,
  Statistic,
  Progress,
  Alert,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  LinkOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  GlobalOutlined,
  EyeOutlined,
  RocketOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  CalendarOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { CompetitionInviteService } from "@/domain/services/competition-invite.service";
import { ProgressionService } from "@/domain/services/progression.service";
import type { Competition } from "@/domain/competition";
import type { Event } from "@/domain/event";
import type { CompetitionInvite } from "@/domain/competition-invite";
import {
  CompetitionStatus,
  FormatType,
  Visibility,
  EventStatus,
  RuleValueType,
} from "@/domain/types";
import { FormatRuleDefinitions } from "@/domain/rules";
import type { ProgressionPlan, PhaseConfig } from "@/domain/progression";
import { autoQualifierCount } from "@/domain/progression";
import { canManageCompetition } from "@/lib/permissions";
import { sendMailEvent } from "@/lib/mail/client";
import ImageUpload from "@/components/upload/image-upload";
import TipTapEditor from "@/components/editor/tiptap-editor";

const { Title, Text } = Typography;

export default function CompetitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invites, setInvites] = useState<CompetitionInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteEventModalOpen, setDeleteEventModalOpen] = useState(false);
  const [deleteEventTarget, setDeleteEventTarget] = useState<Event | null>(
    null,
  );
  const [deleteEventConfirmText, setDeleteEventConfirmText] = useState("");
  const [createFormat, setCreateFormat] = useState<FormatType>(
    FormatType.League,
  );
  const [createRules, setCreateRules] = useState<Record<string, unknown>>({});
  const [createPhases, setCreatePhases] = useState<PhaseConfig[]>([]);
  const [newPhaseFormat, setNewPhaseFormat] = useState<FormatType>(
    FormatType.SingleElimination,
  );
  const [newPhaseQualifiers, setNewPhaseQualifiers] = useState(4);
  const [editForm] = Form.useForm();
  const [isAdmin, setIsAdmin] = useState(false);

  const compId = params.compId as string;
  const inviteSvc = new CompetitionInviteService();

  const refresh = async () => {
    const svc = new CompetitionService();
    const comp = await svc.get(compId);
    setCompetition(comp ?? null);
    if (comp) {
      const evtSvc = new EventService();
      setEvents(await evtSvc.list(comp.id));
      setInvites(await inviteSvc.listByCompetition(comp.id));
    }
    if (currentMember && currentOrg) {
      setIsAdmin(await canManageCompetition(currentMember.id, currentOrg.id));
    }
  };

  useEffect(() => {
    if (!compId) return;
    refresh();
  }, [compId]);

  if (!currentOrg || !competition) return null;

  const statusColors: Record<string, string> = {
    [CompetitionStatus.Draft]: "default",
    [CompetitionStatus.Published]: "blue",
    [CompetitionStatus.InProgress]: "green",
    [CompetitionStatus.Completed]: "purple",
    [CompetitionStatus.Archived]: "red",
  };

  const handleCreateEvent = async (values: { name: string }) => {
    if (!currentMember) return;
    setLoading(true);
    try {
      const evtSvc = new EventService();
      const event = await evtSvc.create(
        {
          competitionId: competition.id,
          name: values.name,
          format: createFormat,
        },
        currentMember.id,
      );

      const allRules = FormatRuleDefinitions[createFormat].map((d) => ({
        key: d.key,
        value:
          createRules[d.key] !== undefined
            ? createRules[d.key]
            : d.defaultValue,
      }));
      await evtSvc.saveRuleSet(event.id, allRules);

      if (createPhases.length > 0) {
        const progSvc = new ProgressionService();
        await progSvc.saveProgressionPlan(event.id, { phases: createPhases });
      }

      message.success("Event created!");
      setEventModalOpen(false);
      resetCreateForm();
      refresh();
    } catch {
      message.error("Failed to create event");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCompetition = async (values: {
    name: string;
    description?: string;
    visibility: Visibility;
    coverImage?: string;
    content?: Record<string, unknown>;
  }) => {
    if (!currentMember) return;
    setSaving(true);
    try {
      const svc = new CompetitionService();
      await svc.update(
        competition.id,
        {
          name: values.name,
          description: values.description ?? "",
          visibility: values.visibility,
          coverImage: values.coverImage,
          content: values.content,
        },
        currentMember.id,
      );
      message.success("Competition updated!");
      setEditModalOpen(false);
      refresh();
    } catch {
      message.error("Failed to update competition");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const svc = new CompetitionService();
    await svc.Delete(competition.id);
    message.success("Competition deleted");
    router.push(`/o/${currentOrg.slug}/competitions`);
  };

  const handleStatusChange = async (status: CompetitionStatus) => {
    if (!currentMember) return;
    const svc = new CompetitionService();
    await svc.update(competition.id, { status }, currentMember.id);
    sendMailEvent({
      kind:
        status === CompetitionStatus.Published
          ? "competition_published"
          : status === CompetitionStatus.InProgress
            ? "competition_started"
            : status === CompetitionStatus.Completed
              ? "competition_completed"
              : "competition_archived",
      to: [{ email: currentMember.email, name: currentMember.displayName }],
      actionUrl: `${window.location.origin}/o/${currentOrg.slug}/competitions/${competition.id}`,
      params: {
        competitionName: competition.name,
        organizationName: currentOrg.name,
        actionLabel: "Open competition",
      },
    });
    message.success(`Competition marked ${status.replace(/_/g, " ")}`);
    refresh();
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventTarget) return;
    const evtSvc = new EventService();
    await evtSvc.Delete(deleteEventTarget.id);
    message.success(`Event "${deleteEventTarget.name}" deleted`);
    setDeleteEventModalOpen(false);
    setDeleteEventTarget(null);
    setDeleteEventConfirmText("");
    refresh();
  };

  const resetCreateForm = () => {
    setCreateFormat(FormatType.League);
    setCreateRules({});
    setCreatePhases([]);
    setNewPhaseFormat(FormatType.SingleElimination);
    setNewPhaseQualifiers(4);
  };

  const handleAddPhase = () => {
    setCreatePhases((prev) => [
      ...prev,
      { format: newPhaseFormat, qualifierCount: newPhaseQualifiers },
    ]);
  };

  const handleRemovePhase = (idx: number) => {
    setCreatePhases((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateInvite = async () => {
    if (!currentMember) return;
    const invite = await inviteSvc.create(
      competition.id,
      currentOrg.id,
      "Discord",
      currentMember.id,
    );
    sendMailEvent({
      kind: "competition_invite_created",
      to: [{ email: currentMember.email, name: currentMember.displayName }],
      actionUrl: `${window.location.origin}/invite/competition/${invite.token}`,
      params: {
        competitionName: competition.name,
        organizationName: currentOrg.name,
        actionLabel: "Open invite link",
      },
    });
    message.success("Invite link created!");
    refresh();
  };

  const publishedEvents = events.filter(
    (evt) => evt.status !== EventStatus.Draft,
  ).length;
  const activeEvents = events.filter(
    (evt) =>
      evt.status === EventStatus.Open || evt.status === EventStatus.InProgress,
  ).length;
  const completedEvents = events.filter(
    (evt) => evt.status === EventStatus.Completed,
  ).length;
  const setupItems = [
    {
      label: "Competition details",
      ready: Boolean(competition.name && competition.description),
    },
    { label: "At least one event", ready: events.length > 0 },
    {
      label: "Invite link ready",
      ready: invites.some((invite) => invite.status === "active"),
    },
    {
      label: "Public or live view",
      ready: competition.visibility !== Visibility.Private,
    },
  ];
  const setupProgress = Math.round(
    (setupItems.filter((item) => item.ready).length / setupItems.length) * 100,
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {competition.name}
          </Title>
          {competition.description && (
            <Text type="secondary">{competition.description}</Text>
          )}
        </div>
        <Space>
          <Button
            icon={<GlobalOutlined />}
            onClick={() => window.open(`/c/${competition.id}`, "_blank")}
          >
            Public Page
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() =>
              window.open(
                `/live/${currentOrg.slug}/${competition.id}`,
                "_blank",
              )
            }
          >
            Live View
          </Button>
          {isAdmin && (
            <Button
              icon={<LinkOutlined />}
              onClick={() => setInviteModalOpen(true)}
            >
              Invites
            </Button>
          )}
          {isAdmin && (
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                editForm.setFieldsValue(competition);
                setEditModalOpen(true);
              }}
            >
              Edit
            </Button>
          )}
          {isAdmin && (
            <Button
              icon={<CopyOutlined />}
              onClick={async () => {
                const svc = new CompetitionService();
                await svc.duplicate(competition.id, currentMember?.id ?? "");
                message.success("Duplicated!");
                refresh();
              }}
            >
              Duplicate
            </Button>
          )}
          {isAdmin && (
            <Popconfirm
              title="Delete this competition?"
              onConfirm={handleDelete}
              okText="Delete"
              okType="danger"
            >
              <Button danger icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          )}
          <Tag color={statusColors[competition.status]}>
            {competition.status}
          </Tag>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic
              title="Setup"
              value={setupProgress}
              suffix="%"
              prefix={<RocketOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic
              title="Events"
              value={events.length}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic
              title="Active"
              value={activeEvents}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic
              title="Completed"
              value={completedEvents}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card size="small" title="Launch Readiness">
            <Progress
              percent={setupProgress}
              size="small"
              style={{ marginBottom: 12 }}
            />
            <Space wrap>
              {setupItems.map((item) => (
                <Tag
                  key={item.label}
                  color={item.ready ? "green" : "default"}
                  icon={
                    item.ready ? <CheckCircleOutlined /> : <InboxOutlined />
                  }
                >
                  {item.label}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title="Status Controls">
            <Space wrap>
              <Button
                icon={<RocketOutlined />}
                disabled={competition.status !== CompetitionStatus.Draft}
                onClick={() => handleStatusChange(CompetitionStatus.Published)}
              >
                Publish
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                disabled={
                  !events.length ||
                  competition.status === CompetitionStatus.InProgress
                }
                onClick={() => handleStatusChange(CompetitionStatus.InProgress)}
              >
                Start
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                disabled={competition.status === CompetitionStatus.Completed}
                onClick={() => handleStatusChange(CompetitionStatus.Completed)}
              >
                Complete
              </Button>
              <Button
                icon={<InboxOutlined />}
                disabled={competition.status === CompetitionStatus.Archived}
                onClick={() => handleStatusChange(CompetitionStatus.Archived)}
              >
                Archive
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {events.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Create the first event to unlock scheduling, standings, brackets, live view, and participant registration."
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="Visibility">
              {competition.visibility}
            </Descriptions.Item>
            <Descriptions.Item label="Events">
              {events.length}
            </Descriptions.Item>
            <Descriptions.Item label="Published Events">
              {publishedEvents}
            </Descriptions.Item>
            <Descriptions.Item label="Game">
              {competition.game?.name ?? "Any"}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {new Date(competition.createdAt).toLocaleDateString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              <Space>
                <CalendarOutlined />
                {new Date(competition.updatedAt).toLocaleDateString()}
              </Space>
            </Descriptions.Item>
          </Descriptions>
        </Col>
      </Row>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Events
        </Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEventModalOpen(true)}
          >
            Add Event
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {events.map((evt) => (
          <Col key={evt.id} xs={24} sm={12} md={8}>
            <Card
              hoverable
              className="card-hover"
              style={{ borderRadius: 14, border: "1px solid #E2E8F0" }}
              onClick={() =>
                router.push(
                  `/o/${currentOrg.slug}/competitions/${competition.id}/events/${evt.id}`,
                )
              }
              actions={
                isAdmin
                  ? [
                      <DeleteOutlined
                        key="delete"
                        style={{ color: "#ff4d4f" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteEventTarget(evt);
                          setDeleteEventConfirmText("");
                          setDeleteEventModalOpen(true);
                        }}
                      />,
                    ]
                  : undefined
              }
            >
              <Card.Meta
                title={evt.name}
                description={
                  <Space>
                    <Tag>{evt.format}</Tag>
                    <Tag
                      color={
                        evt.status === EventStatus.InProgress
                          ? "green"
                          : evt.status === EventStatus.Completed
                            ? "purple"
                            : "default"
                      }
                    >
                      {evt.status}
                    </Tag>
                  </Space>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="Create Event"
        open={eventModalOpen}
        onCancel={() => {
          setEventModalOpen(false);
          resetCreateForm();
        }}
        footer={null}
        width={680}
      >
        <Form
          layout="vertical"
          onFinish={handleCreateEvent}
          requiredMark={false}
        >
          <Form.Item
            label="Event Name"
            name="name"
            rules={[{ required: true, message: "Enter event name" }]}
          >
            <Input placeholder="e.g., EA FC League" size="large" />
          </Form.Item>
          <Form.Item label="Format" required>
            <Select
              size="large"
              value={createFormat}
              onChange={(v) => {
                setCreateFormat(v);
                setCreateRules({});
                setNewPhaseFormat(FormatType.SingleElimination);
                setNewPhaseQualifiers(
                  autoQualifierCount(16, FormatType.SingleElimination),
                );
              }}
            >
              <Select.Option value={FormatType.League}>League</Select.Option>
              <Select.Option value={FormatType.SingleElimination}>
                Single Elimination
              </Select.Option>
              <Select.Option value={FormatType.DoubleElimination}>
                Double Elimination
              </Select.Option>
              <Select.Option value={FormatType.Swiss}>Swiss</Select.Option>
              <Select.Option value={FormatType.GroupStage}>
                Group Stage
              </Select.Option>
            </Select>
          </Form.Item>

          <Collapse
            ghost
            items={[
              {
                key: "rules",
                label: "Format Rules & Settings",
                children: (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {FormatRuleDefinitions[createFormat].map((def) => (
                      <div key={def.key}>
                        <Text
                          style={{
                            fontSize: 13,
                            display: "block",
                            marginBottom: 4,
                          }}
                        >
                          {def.label}
                        </Text>
                        {def.type === RuleValueType.Boolean ? (
                          <Select
                            value={
                              (createRules[def.key] as boolean) ??
                              def.defaultValue
                            }
                            onChange={(v) =>
                              setCreateRules((p) => ({ ...p, [def.key]: v }))
                            }
                            style={{ width: "100%" }}
                            options={[
                              { value: true, label: "Yes" },
                              { value: false, label: "No" },
                            ]}
                          />
                        ) : def.type === RuleValueType.Number ? (
                          <InputNumber
                            value={
                              (createRules[def.key] as number) ??
                              def.defaultValue
                            }
                            onChange={(v) =>
                              setCreateRules((p) => ({ ...p, [def.key]: v }))
                            }
                            min={def.validation?.min}
                            max={def.validation?.max}
                            style={{ width: "100%" }}
                          />
                        ) : def.type === RuleValueType.Selection ? (
                          <Select
                            value={
                              (createRules[def.key] as string) ??
                              def.defaultValue
                            }
                            onChange={(v) =>
                              setCreateRules((p) => ({ ...p, [def.key]: v }))
                            }
                            style={{ width: "100%" }}
                            options={def.options?.map((o) => ({
                              value: o,
                              label: String(o).replace(/_/g, " "),
                            }))}
                          />
                        ) : (
                          <Input
                            value={
                              (createRules[def.key] as string) ??
                              String(def.defaultValue)
                            }
                            onChange={(e) =>
                              setCreateRules((p) => ({
                                ...p,
                                [def.key]: e.target.value,
                              }))
                            }
                          />
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          Default: {String(def.defaultValue)}
                        </Text>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />

          <Divider />
          <div style={{ marginBottom: 12 }}>
            <Text strong>Phase Progression</Text>
            <Text type="secondary" style={{ display: "block", fontSize: 13 }}>
              Optional. Add subsequent phases (e.g., League → Bracket). Can be
              changed later in event settings.
            </Text>
          </div>
          {createPhases.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {createPhases.map((p, i) => (
                <Tag
                  key={i}
                  closable
                  onClose={() => handleRemovePhase(i)}
                  style={{ marginBottom: 4 }}
                >
                  Phase {i + 1}: {p.format}
                  {p.qualifierCount > 0 ? ` (top ${p.qualifierCount})` : ""}
                </Tag>
              ))}
            </div>
          )}
          <Space style={{ marginBottom: 16 }}>
            <Select
              size="small"
              value={newPhaseFormat}
              onChange={(v) => {
                setNewPhaseFormat(v);
                setNewPhaseQualifiers(autoQualifierCount(16, v));
              }}
              style={{ width: 160 }}
              options={[
                {
                  value: FormatType.SingleElimination,
                  label: "Single Elimination",
                },
                {
                  value: FormatType.DoubleElimination,
                  label: "Double Elimination",
                },
                { value: FormatType.League, label: "League" },
                { value: FormatType.Swiss, label: "Swiss" },
              ]}
            />
            <InputNumber
              size="small"
              min={2}
              max={64}
              value={newPhaseQualifiers}
              onChange={(v) => setNewPhaseQualifiers(v ?? 2)}
              style={{ width: 80 }}
              placeholder="Top N"
            />
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddPhase}
            >
              Add
            </Button>
          </Space>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              Create Event
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit Competition"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditCompetition}
          requiredMark={false}
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Enter competition name" }]}
          >
            <Input placeholder="Competition name" size="large" />
          </Form.Item>
          <Form.Item label="Cover Image" name="coverImage">
            <ImageUpload
              currentUrl={competition?.coverImage}
              onUpload={(url) => editForm.setFieldValue("coverImage", url)}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item
            label="Content"
            name={["content"]}
            getValueFromEvent={(val) => val}
          >
            <TipTapEditor
              placeholder="Rich content for your competition page..."
              minHeight={250}
            />
          </Form.Item>
          <Form.Item
            label="Visibility"
            name="visibility"
            rules={[{ required: true }]}
          >
            <Select size="large">
              <Select.Option value={Visibility.Public}>Public</Select.Option>
              <Select.Option value={Visibility.Private}>Private</Select.Option>
              <Select.Option value={Visibility.Hidden}>
                Hidden (by link)
              </Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              size="large"
              block
            >
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Competition Invites"
        open={inviteModalOpen}
        onCancel={() => setInviteModalOpen(false)}
        footer={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateInvite}
          >
            Generate New Link
          </Button>
        }
        width={520}
      >
        {invites.length === 0 ? (
          <Text
            type="secondary"
            style={{ display: "block", textAlign: "center", padding: 24 }}
          >
            No invite links yet. Share a link so people can join this
            competition.
          </Text>
        ) : (
          <Table
            dataSource={invites}
            rowKey="id"
            pagination={false}
            columns={[
              {
                title: "Link",
                key: "link",
                render: (_: unknown, record: CompetitionInvite) => {
                  const link = `${window.location.origin}/invite/competition/${record.token}`;
                  return (
                    <Text copyable={{ text: link }} style={{ fontSize: 13 }}>
                      {link}
                    </Text>
                  );
                },
              },
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                render: (s: string) => (
                  <Tag color={s === "active" ? "green" : "default"}>{s}</Tag>
                ),
              },
              {
                title: "Created",
                dataIndex: "createdAt",
                key: "createdAt",
                render: (d: string) => new Date(d).toLocaleDateString(),
              },
              {
                title: "Actions",
                key: "actions",
                render: (_: unknown, record: CompetitionInvite) => (
                  <Button
                    size="small"
                    icon={<StopOutlined />}
                    onClick={async () => {
                      await inviteSvc.toggle(record.id);
                      refresh();
                    }}
                  >
                    {record.status === "active" ? "Disable" : "Enable"}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Modal>

      <Modal
        title={
          <span>
            <ExclamationCircleOutlined
              style={{ color: "#ff4d4f", marginRight: 8 }}
            />
            Delete Event
          </span>
        }
        open={deleteEventModalOpen}
        onCancel={() => {
          setDeleteEventModalOpen(false);
          setDeleteEventTarget(null);
          setDeleteEventConfirmText("");
        }}
        okText="Delete this event"
        okButtonProps={{
          danger: true,
          disabled: deleteEventConfirmText !== deleteEventTarget?.name,
        }}
        onOk={handleDeleteEvent}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            This action cannot be undone. This will permanently delete the event
            and all associated data (matches, standings, stages, registrations).
          </Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>
            Please type <Text code>{deleteEventTarget?.name}</Text> to confirm:
          </Text>
        </div>
        <Input
          value={deleteEventConfirmText}
          onChange={(e) => setDeleteEventConfirmText(e.target.value)}
          placeholder={deleteEventTarget?.name}
          onPressEnter={() => {
            if (deleteEventConfirmText === deleteEventTarget?.name)
              handleDeleteEvent();
          }}
        />
      </Modal>
    </div>
  );
}
