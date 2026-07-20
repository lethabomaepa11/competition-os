"use client";

import { useMemo } from "react";
import { Tag, Empty, Typography } from "antd";
import { Bracket } from "bracketkit";
import type { BracketRound } from "bracketkit";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import type { Round } from "@/domain/event";
import { MatchStatus } from "@/domain/types";

const { Text } = Typography;

interface Props {
  matches: Match[];
  participants: Participant[];
  rounds?: Round[];
}

interface BracketMatchData {
  id: string;
  p1Name: string;
  p2Name: string;
  p1Score?: number;
  p2Score?: number;
  winner?: string;
  status: MatchStatus;
}

export function BracketView({ matches, participants, rounds }: Props) {
  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p.displayName])),
    [participants],
  );

  const roundOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    rounds?.forEach((r, idx) => map.set(r.id, r.roundNumber ?? idx));
    return map;
  }, [rounds]);

  const roundNameMap = useMemo(
    () => new Map(rounds?.map((r) => [r.id, r.name]) ?? []),
    [rounds],
  );

  const renderKey = useMemo(() => {
    let hash = 0;
    for (const m of matches) {
      const scoreStr = (m.result?.scores ?? [])
        .map((s) => `${s.participantId}:${s.value}`)
        .join(",");
      hash = ((hash << 5) - hash + (m.status + scoreStr).length * 31) | 0;
    }
    return `bracket-${hash}`;
  }, [matches]);

  const bracketRounds: BracketRound<BracketMatchData>[] = useMemo(() => {
    const roundMap = new Map<string, BracketMatchData[]>();
    for (const m of matches) {
      const [p1, p2] = m.participants;
      const scores = m.result?.scores ?? [];
      const data: BracketMatchData = {
        id: m.id,
        p1Name: p1 ? (participantMap.get(p1.participantId) ?? "BYE") : "TBD",
        p2Name: p2 ? (participantMap.get(p2.participantId) ?? "BYE") : "TBD",
        p1Score: scores.find((s) => s.participantId === p1?.participantId)
          ?.value,
        p2Score: scores.find((s) => s.participantId === p2?.participantId)
          ?.value,
        winner: m.result?.winnerId
          ? participantMap.get(m.result.winnerId)
          : undefined,
        status: m.status,
      };
      const list = roundMap.get(m.roundId) ?? [];
      list.push(data);
      roundMap.set(m.roundId, list);
    }
    return Array.from(roundMap.entries())
      .map(([roundId, roundMatches]) => ({
        id: roundId,
        name: roundNameMap.get(roundId) ?? `Round ${roundId.slice(0, 4)}`,
        matches: roundMatches,
      }))
      .sort(
        (a, b) =>
          (roundOrderMap.get(a.id) ?? 0) - (roundOrderMap.get(b.id) ?? 0),
      );
  }, [matches, participantMap, roundNameMap, roundOrderMap]);

  if (matches.length === 0 || !rounds || rounds.length === 0) {
    return <Empty description="No bracket data available yet." />;
  }

  return (
    <div style={{ overflow: "auto", padding: "16px 0" }}>
      <Bracket
        key={renderKey}
        rounds={bracketRounds}
        matchWidth={220}
        connectorWidth={48}
        matchGap={12}
        renderRoundHeader={(round) => (
          <div
            style={{
              textAlign: "center",
              fontWeight: 600,
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {round.name}
          </div>
        )}
        renderMatch={(match) => <MatchCard match={match} />}
      />
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatchData }) {
  const isP1Winner = match.winner === match.p1Name;
  const isP2Winner = match.winner === match.p2Name;
  const isEmpty = match.p1Name === "TBD" && match.p2Name === "TBD";

  const isWalkover = match.status === MatchStatus.Walkover;
  const isCompleted = match.status === MatchStatus.Completed;

  return (
    <div
      style={{
        border: `1px solid ${isCompleted ? "#52c41a" : "#d9d9d9"}`,
        borderRadius: 8,
        padding: "8px 12px",
        background: "#fff",
        opacity: isWalkover ? 0.6 : 1,
        minWidth: 180,
      }}
    >
      {isEmpty ? (
        <Text type="secondary" style={{ fontSize: 13 }}>
          Awaiting participants
        </Text>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              strong={!!isP1Winner}
              delete={isP2Winner && !!match.winner}
              style={{ fontSize: 14 }}
            >
              {match.p1Name}
            </Text>
            {match.p1Score !== undefined && (
              <Tag style={{ margin: 0 }}>{match.p1Score}</Tag>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              strong={!!isP2Winner}
              delete={isP1Winner && !!match.winner}
              style={{ fontSize: 14 }}
            >
              {match.p2Name}
            </Text>
            {match.p2Score !== undefined && (
              <Tag style={{ margin: 0 }}>{match.p2Score}</Tag>
            )}
          </div>
        </>
      )}
      {isCompleted && match.winner && !isEmpty && (
        <Tag color="green" style={{ marginTop: 4, fontSize: 11 }}>
          Winner: {match.winner}
        </Tag>
      )}
      {isWalkover && <Tag style={{ marginTop: 4 }}>Walkover</Tag>}
    </div>
  );
}
