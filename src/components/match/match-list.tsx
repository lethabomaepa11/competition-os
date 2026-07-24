"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  Button,
  Tag,
  Modal,
  message,
  Space,
  DatePicker,
  Input,
  Typography,
  Empty,
  Tooltip,
} from "antd";
import {
  CheckCircleOutlined,
  UndoOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  MinusOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import type { Match, MatchScore } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus, FormatType, type ID } from "@/domain/types";
import { MatchService } from "@/domain/services/match.service";
import { EventService } from "@/domain/services/event.service";
import { MemberService } from "@/domain/services/organization.service";
import { getStringRule } from "@/domain/rules";
import { ScoreAuditService } from "@/domain/services/score-audit.service";
import { compactRecipients, sendMailEvent } from "@/lib/mail/client";
import type { MailEventKind } from "@/lib/mail/templates";
import dayjs from "dayjs";

const { Text } = Typography;

interface Props {
  matches: Match[];
  participants: Participant[];
  eventId: ID;
  eventFormat: FormatType;
  onMatchUpdate: () => void;
  isAdmin?: boolean;
}

export function MatchListView({
  matches,
  participants,
  eventId,
  eventFormat,
  onMatchUpdate,
  isAdmin = true,
}: Props) {
  const [scoreModal, setScoreModal] = useState<Match | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dateEditId, setDateEditId] = useState<string | null>(null);
  const [venueEditId, setVenueEditId] = useState<string | null>(null);
  const [noScores, setNoScores] = useState(false);
  const [isDraw, setIsDraw] = useState(false);

  const matchSvc = new MatchService();
  const evtSvc = new EventService();
  const auditSvc = new ScoreAuditService();
  const memberSvc = new MemberService();

  useEffect(() => {
    (async () => {
      const event = await evtSvc.get(eventId);
      if (event) {
        const ruleSet = await evtSvc.getRuleSet(eventId);
        const rules = ruleSet?.rules ?? [];
        const scoring = getStringRule(rules, "scoring", event.format);
        setNoScores(scoring === "winner_only");
      }
    })();
  }, [eventId]);

  const handleScoreChange = async (participantId: string, value: number) => {
    const prevVal = scores[participantId] ?? 0;
    const newVal = Math.max(0, value);
    const newScores = { ...scores, [participantId]: newVal };
    setScores(newScores);

    if (scoreModal) {
      const actionType =
        newVal > prevVal ? "increment" : newVal < prevVal ? "decrement" : "set";
      await matchSvc.recordScore(
        scoreModal.id,
        participantId,
        newVal,
        actionType,
      );

      const liveScoreArray: MatchScore[] = scoreModal.participants.map((p) => ({
        participantId: p.participantId,
        label: participants.find((pt) => pt.id === p.participantId)?.displayName ?? "Unknown",
        value: newScores[p.participantId] ?? 0,
      }));
      await matchSvc.updateScores(scoreModal.id, liveScoreArray);
    }

    const participantIds =
      scoreModal?.participants.map((p) => p.participantId) ?? [];
    if (participantIds.length === 2) {
      const [a, b] = participantIds;
      const scoreA = newScores[a] ?? 0;
      const scoreB = newScores[b] ?? 0;
      if (scoreA !== scoreB) {
        setWinnerId(scoreA > scoreB ? a : b);
        setIsDraw(false);
      } else if (
        eventFormat !== FormatType.SingleElimination &&
        eventFormat !== FormatType.DoubleElimination
      ) {
        setIsDraw(true);
        setWinnerId(null);
      } else {
        setWinnerId(null);
        setIsDraw(false);
      }
    }
  };

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  const getMatchName = (match: Match) =>
    match.participants
      .map((p) => participantMap.get(p.participantId)?.displayName ?? "TBD")
      .join(" vs ");

  const notifyMatch = async (
    kind: Extract<
      MailEventKind,
      | "match_scheduled"
      | "match_started"
      | "match_result_submitted"
      | "match_disputed"
      | "match_dispute_resolved"
    >,
    match: Match,
    params: Record<string, string | number | boolean | null | undefined> = {},
  ) => {
    const members = await Promise.all(
      match.participants.map(async (matchParticipant) => {
        const participant = participantMap.get(matchParticipant.participantId);
        if (!participant) return null;
        const member = await memberSvc.get(participant.memberId);
        return member
          ? { email: member.email, name: member.displayName }
          : null;
      }),
    );
    const recipients = compactRecipients(members);
    if (recipients.length === 0) return;
    const event = await evtSvc.get(eventId);
    sendMailEvent({
      kind,
      to: recipients,
      params: {
        eventName: event?.name,
        matchName: getMatchName(match),
        actionLabel: "Open match",
        ...params,
      },
    });
  };

  const undoableIds = useMemo(() => {
    const completed = matches
      .filter(
        (m) => m.status === MatchStatus.Completed && m.result?.finalizedAt,
      )
      .sort(
        (a, b) =>
          new Date(b.result!.finalizedAt!).getTime() -
          new Date(a.result!.finalizedAt!).getTime(),
      );
    return new Set(completed.slice(0, 3).map((m) => m.id));
  }, [matches]);

  const statusColors: Record<string, string> = {
    [MatchStatus.Scheduled]: "default",
    [MatchStatus.InProgress]: "processing",
    [MatchStatus.Completed]: "success",
    [MatchStatus.Disputed]: "warning",
    [MatchStatus.Cancelled]: "error",
    [MatchStatus.Walkover]: "purple",
  };

  const handleSubmitResult = async () => {
    if (!scoreModal) return;

    const pIds = scoreModal.participants.map((p) => p.participantId);
    let finalWinnerId = winnerId;
    let finalIsDraw = isDraw;

    if (!noScores && pIds.length === 2) {
      const [a, b] = pIds;
      const scoreA = scores[a] ?? 0;
      const scoreB = scores[b] ?? 0;
      if (scoreA === scoreB) {
        finalIsDraw =
          eventFormat !== FormatType.SingleElimination &&
          eventFormat !== FormatType.DoubleElimination;
        finalWinnerId = null;
      } else {
        finalWinnerId = scoreA > scoreB ? a : b;
        finalIsDraw = false;
      }
    }

    if (!finalIsDraw && !finalWinnerId) return;
    if (
      !noScores &&
      (eventFormat === FormatType.SingleElimination ||
        eventFormat === FormatType.DoubleElimination)
    ) {
      if (!finalWinnerId) {
        message.error(
          "Scores cannot be equal in bracket format — a winner must be determined.",
        );
        return;
      }
    }
    setSubmitting(true);
    try {
      const scoreArray: MatchScore[] = noScores
        ? []
        : scoreModal.participants.map((p) => ({
            participantId: p.participantId,
            label:
              participantMap.get(p.participantId)?.displayName ?? "Unknown",
            value: scores[p.participantId] ?? 0,
          }));
      await matchSvc.submitResult(
        scoreModal.id,
        finalWinnerId ?? undefined,
        scoreArray,
      );
      message.success(finalIsDraw ? "Draw recorded!" : "Result submitted!");
      setScoreModal(null);
    } catch {
      message.error("Failed to submit result");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async (matchId: ID) => {
    const match = await matchSvc.dispute(matchId);
    onMatchUpdate();
    message.info("Match disputed");
  };

  const handleUndo = (matchId: ID) => {
    Modal.confirm({
      title: "Undo match result?",
      icon: <ExclamationCircleOutlined />,
      content:
        "This will revert the match to Scheduled status and remove the result. You can only undo the 3 most recent completed matches.",
      okText: "Undo",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        await matchSvc.undo(matchId);
        onMatchUpdate();
        message.info("Match undone");
      },
    });
  };

  if (matches.length === 0) {
    return (
      <Empty description="No matches yet. Initialize the event to generate matches." />
    );
  }

  return (
    <div>
      <Table
        dataSource={matches}
        rowKey="id"
        pagination={false}
        columns={[
          {
            title: "Match",
            key: "matchup",
            render: (_: unknown, record: Match) => (
              <Text>
                {record.participants
                  .map(
                    (p) =>
                      participantMap.get(p.participantId)?.displayName ?? "???",
                  )
                  .join(" vs ")}
              </Text>
            ),
          },
          {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (s: MatchStatus) => <Tag color={statusColors[s]}>{s}</Tag>,
          },
          {
            title: "Date",
            key: "schedule",
            render: (_: unknown, record: Match) => {
              if (record.status !== MatchStatus.Scheduled) {
                return record.scheduledAt ? (
                  <Text style={{ fontSize: 13 }}>
                    {dayjs(record.scheduledAt).format("MMM D, YYYY h:mm A")}
                  </Text>
                ) : (
                  "-"
                );
              }
              if (dateEditId === record.id) {
                return (
                  <DatePicker
                    showTime
                    size="small"
                    autoFocus
                    value={
                      record.scheduledAt ? dayjs(record.scheduledAt) : null
                    }
                    onChange={async (d) => {
                      const scheduledAt = d?.toISOString() ?? "";
                      const match = await matchSvc.schedule(
                        record.id,
                        scheduledAt,
                        record.venue,
                      );
                      if (match) {
                        await notifyMatch("match_scheduled", match, {
                          scheduledAt: scheduledAt
                            ? dayjs(scheduledAt).format("MMM D, YYYY h:mm A")
                            : "TBD",
                        });
                      }
                      onMatchUpdate();
                      setDateEditId(null);
                    }}
                  />
                );
              }
              return (
                <Space>
                  {record.scheduledAt ? (
                    <Text style={{ fontSize: 13 }}>
                      {dayjs(record.scheduledAt).format("MMM D, YYYY h:mm A")}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      TBD
                    </Text>
                  )}
                  <Button
                    size="small"
                    type="link"
                    icon={<CalendarOutlined />}
                    onClick={() => setDateEditId(record.id)}
                  />
                </Space>
              );
            },
          },
          {
            title: "Venue",
            key: "venue",
            render: (_: unknown, record: Match) => {
              if (venueEditId === record.id) {
                return (
                  <Input
                    size="small"
                    style={{ width: 140 }}
                    placeholder="Venue"
                    autoFocus
                    defaultValue={record.venue}
                    onPressEnter={async (e) => {
                      const venue = (e.target as HTMLInputElement).value;
                      const match = await matchSvc.schedule(
                        record.id,
                        record.scheduledAt ?? "",
                        venue,
                      );
                      if (match) {
                        await notifyMatch("match_scheduled", match, {
                          scheduledAt: record.scheduledAt
                            ? dayjs(record.scheduledAt).format(
                                "MMM D, YYYY h:mm A",
                              )
                            : "TBD",
                          venue,
                        });
                      }
                      onMatchUpdate();
                      setVenueEditId(null);
                    }}
                    onBlur={async (e) => {
                      const venue = e.target.value;
                      const match = await matchSvc.schedule(
                        record.id,
                        record.scheduledAt ?? "",
                        venue,
                      );
                      if (match) {
                        await notifyMatch("match_scheduled", match, {
                          scheduledAt: record.scheduledAt
                            ? dayjs(record.scheduledAt).format(
                                "MMM D, YYYY h:mm A",
                              )
                            : "TBD",
                          venue,
                        });
                      }
                      onMatchUpdate();
                      setVenueEditId(null);
                    }}
                  />
                );
              }
              return (
                <Space>
                  {record.venue ? (
                    <Text style={{ fontSize: 13 }}>
                      <EnvironmentOutlined /> {record.venue}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      -
                    </Text>
                  )}
                  <Button
                    size="small"
                    type="link"
                    icon={<EnvironmentOutlined />}
                    onClick={() => setVenueEditId(record.id)}
                  />
                </Space>
              );
            },
          },
          {
            title: "Score",
            key: "score",
            render: (_: unknown, record: Match) => {
              if (!record.result) return "-";
              if (record.result.scores.length === 0) {
                if (!record.result.winnerId) return "Draw";
                const winner = record.result.winnerId
                  ? participantMap.get(record.result.winnerId)?.displayName
                  : null;
                return winner ? `${winner} won` : "Winner declared";
              }
              return record.result.scores
                .map(
                  (s) =>
                    `${participantMap.get(s.participantId)?.displayName ?? "?"}: ${s.value}`,
                )
                .join(" | ");
            },
          },
          {
            title: "Actions",
            key: "actions",
            render: (_: unknown, record: Match) => (
              <Space>
                {isAdmin &&
                  (record.status === MatchStatus.Scheduled ||
                    record.status === MatchStatus.InProgress) && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        if (record.status === MatchStatus.Scheduled) {
                          await matchSvc.startMatch(record.id);
                        }
                      } catch {
                        message.error("Failed to start match");
                        setSubmitting(false);
                        return;
                      }
                      setSubmitting(false);
                      setScoreModal(record);
                      setWinnerId(null);
                      setScores({});
                      setIsDraw(false);
                    }}
                  >
                    {record.status === MatchStatus.InProgress ? "Resume" : "Score"}
                  </Button>
                )}
                {isAdmin &&
                  record.status === MatchStatus.Completed &&
                  undoableIds.has(record.id) && (
                    <Button
                      size="small"
                      icon={<UndoOutlined />}
                      onClick={() => handleUndo(record.id)}
                    >
                      Undo
                    </Button>
                  )}
                {record.status === MatchStatus.Completed && record.result && (
                  <Tooltip title="View score audit trail">
                    <Button
                      size="small"
                      icon={<HistoryOutlined />}
                      onClick={async () => {
                        const events = await auditSvc.getMatchEvents(record.id);
                        const info =
                          events.length > 0
                            ? events
                                .map(
                                  (e) =>
                                    `[${new Date(e.timestamp).toLocaleTimeString()}] ${participantMap.get(e.participantId)?.displayName ?? "?"} → ${e.score} (${e.actionType})`,
                                )
                                .join("\n")
                            : "No score events recorded.";
                        Modal.info({
                          title: "Score Audit Trail",
                          width: 450,
                          content: (
                            <pre
                              style={{
                                fontSize: 12,
                                whiteSpace: "pre-wrap",
                                maxHeight: 400,
                                overflow: "auto",
                              }}
                            >
                              {info}
                            </pre>
                          ),
                        });
                      }}
                    />
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Enter Match Result"
        open={!!scoreModal}
        onCancel={async () => {
          if (scoreModal) {
            await matchSvc.resetToScheduled(scoreModal.id);
          }
          setScoreModal(null);
        }}
        onOk={() => {
          Modal.confirm({
            title: "Finalize this result?",
            content:
              "This will mark the match as completed and propagate results through the bracket.",
            okText: "Finalize",
            okType: "primary",
            cancelText: "Cancel",
            onOk: handleSubmitResult,
          });
        }}
        okText="Submit Result"
        confirmLoading={submitting}
        afterClose={onMatchUpdate}
      >
        {scoreModal && (
          <div>
            {noScores ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>Select Winner:</Text>
                </div>
                <div style={{
                  display: "flex",
                  gap: 12,
                  flexDirection: scoreModal.participants.length === 2 ? "row" : "column",
                }}>
                  {scoreModal.participants.map((p) => {
                    const name =
                      participantMap.get(p.participantId)?.displayName ??
                      "Unknown";
                    const isSelected = winnerId === p.participantId;
                    return (
                      <div
                        key={p.participantId}
                        style={{
                          flex: scoreModal.participants.length === 2 ? 1 : undefined,
                          padding: 20,
                          border: isSelected
                            ? "3px solid #1677ff"
                            : "1px solid #d9d9d9",
                          borderRadius: 12,
                          cursor: "pointer",
                          background: isSelected ? "#f0f5ff" : "#fafafa",
                          textAlign: "center",
                          transition: "all 0.2s",
                        }}
                        onClick={() => {
                          setWinnerId(p.participantId);
                          setIsDraw(false);
                        }}
                      >
                        <Text strong={isSelected} style={{ fontSize: 16 }}>
                          {name}
                        </Text>
                        {isSelected && (
                          <Tag color="blue" style={{ marginLeft: 8, fontSize: 13, padding: "2px 8px" }}>
                            WINNER
                          </Tag>
                        )}
                      </div>
                    );
                  })}
                </div>
                {eventFormat !== FormatType.SingleElimination &&
                  eventFormat !== FormatType.DoubleElimination && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: "1px solid #f0f0f0",
                    }}
                  >
                    <Button
                      block
                      size="large"
                      type={isDraw ? "primary" : "default"}
                      onClick={() => {
                        setIsDraw(!isDraw);
                        if (!isDraw) setWinnerId(null);
                      }}
                    >
                      {isDraw ? "Draw Selected" : "Mark as Draw"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                display: "flex",
                gap: 16,
                flexDirection: scoreModal.participants.length === 2 ? "row" : "column",
              }}>
                {scoreModal.participants.map((p) => {
                  const name =
                    participantMap.get(p.participantId)?.displayName ??
                    "Unknown";
                  const participantIds = scoreModal.participants.map(
                    (x) => x.participantId,
                  );
                  const isAutoWinner = winnerId === p.participantId;
                  const isAutoDraw = participantIds.length === 2 && isDraw;
                  const borderColor = isAutoWinner ? "#1677ff" : isAutoDraw ? "#faad14" : "#e8e8e8";
                  return (
                    <div
                      key={p.participantId}
                      style={{
                        flex: participantIds.length === 2 ? 1 : undefined,
                        padding: "24px 16px",
                        border: `${isAutoWinner || isAutoDraw ? 3 : 1}px solid ${borderColor}`,
                        borderRadius: 12,
                        background: isAutoWinner ? "#f0f5ff" : isAutoDraw ? "#fffbe6" : "#fafafa",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          marginBottom: 16,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Text
                          strong
                          style={{ fontSize: 16 }}
                        >
                          {name}
                        </Text>
                        {isAutoWinner && (
                          <Tag color="blue" style={{ fontSize: 13, padding: "2px 8px" }}>
                            WINNER
                          </Tag>
                        )}
                        {isAutoDraw && (
                          <Tag color="gold" style={{ fontSize: 13, padding: "2px 8px" }}>
                            DRAW
                          </Tag>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 48,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          marginBottom: 20,
                          color: isAutoWinner ? "#1677ff" : isAutoDraw ? "#faad14" : "#262626",
                        }}
                      >
                        {scores[p.participantId] ?? 0}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 16,
                        }}
                      >
                        <Button
                          shape="circle"
                          size="large"
                          icon={<MinusOutlined />}
                          onClick={() =>
                            handleScoreChange(
                              p.participantId,
                              (scores[p.participantId] ?? 0) - 1,
                            )
                          }
                        />
                        <Button
                          shape="circle"
                          size="large"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            handleScoreChange(
                              p.participantId,
                              (scores[p.participantId] ?? 0) + 1,
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
