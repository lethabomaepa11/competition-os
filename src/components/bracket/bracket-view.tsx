"use client";

import { useMemo, useRef, useCallback } from "react";
import { Tag, Empty, Typography, Button, message } from "antd";
import { Bracket } from "bracketkit";
import type { BracketRound } from "bracketkit";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import type { Round } from "@/domain/event";
import { MatchStatus } from "@/domain/types";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

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

  const bracketRef = useRef<HTMLDivElement>(null);

  const exportBracket = useCallback(async (format: "png" | "pdf") => {
    if (!bracketRef.current) return;
    try {
      const dataUrl = await toPng(bracketRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      if (format === "png") {
        const link = document.createElement("a");
        link.download = "bracket.png";
        link.href = dataUrl;
        link.click();
      } else {
        const pdf = new jsPDF({ orientation: "landscape", unit: "px" });
        const imgProps = pdf.getImageProperties(dataUrl);
        pdf.addImage(dataUrl, "PNG", 0, 0, imgProps.width, imgProps.height);
        pdf.save("bracket.pdf");
      }
      message.success(`Bracket exported as ${format.toUpperCase()}`);
    } catch {
      message.error("Failed to export bracket");
    }
  }, []);

  if (matches.length === 0 || !rounds || rounds.length === 0) {
    return <Empty description="No bracket data available yet." />;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
          gap: 8,
        }}
      >
        <Button size="small" onClick={() => exportBracket("png")}>
          Export PNG
        </Button>
        <Button size="small" onClick={() => exportBracket("pdf")}>
          Export PDF
        </Button>
      </div>
      <div
        ref={bracketRef}
        style={{
          overflow: "auto",
          padding: "16px 0",
        }}
      >
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
                fontWeight: 700,
                fontSize: 13,
                marginBottom: 12,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {round.name}
            </div>
          )}
          renderMatch={(match) => <MatchCard match={match} />}
        />
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatchData }) {
  const isP1Winner = match.winner === match.p1Name;
  const isP2Winner = match.winner === match.p2Name;
  const isEmpty = match.p1Name === "TBD" && match.p2Name === "TBD";

  const isWalkover = match.status === MatchStatus.Walkover;
  const isCompleted = match.status === MatchStatus.Completed;

  const p1Color = isP1Winner ? undefined : undefined;
  const p2Color = isP2Winner ? undefined : undefined;

  return (
    <div
      style={{
        border: `1px solid ${isCompleted ? "#2ABFAA" : isWalkover ? "#E8A623" : undefined}`,
        borderRadius: 12,
        padding: "10px 12px",
        opacity: isWalkover ? 0.7 : 1,
        minWidth: 190,
        transition: "all 0.2s ease",
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
              marginBottom: 6,
              padding: "4px 6px",
              borderRadius: 6,
              background: isP1Winner ? "rgba(232,166,35,0.08)" : "transparent",
            }}
          >
            <Text
              strong={!!isP1Winner}
              delete={isP2Winner && !!match.winner}
              style={{
                fontSize: 13,
                fontWeight: isP1Winner ? 700 : 500,
              }}
            >
              {match.p1Name}
            </Text>
            {match.p1Score !== undefined && (
              <Tag
                color={isP1Winner ? "blue" : "default"}
                style={{
                  margin: 0,
                  fontWeight: 600,
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {match.p1Score}
              </Tag>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 6px",
              borderRadius: 6,
              background: isP2Winner ? "rgba(232,166,35,0.08)" : "transparent",
            }}
          >
            <Text
              strong={!!isP2Winner}
              delete={isP1Winner && !!match.winner}
              style={{
                fontSize: 13,
                fontWeight: isP2Winner ? 700 : 500,
              }}
            >
              {match.p2Name}
            </Text>
            {match.p2Score !== undefined && (
              <Tag
                color={isP2Winner ? "blue" : "default"}
                style={{
                  margin: 0,
                  fontWeight: 600,
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {match.p2Score}
              </Tag>
            )}
          </div>
        </>
      )}
      {isCompleted && match.winner && !isEmpty && (
        <div style={{ marginTop: 6, textAlign: "center" }}>
          <Tag
            color="green"
            style={{ fontSize: 11, fontWeight: 600, borderRadius: 6 }}
          >
            Winner: {match.winner}
          </Tag>
        </div>
      )}
      {isWalkover && (
        <div style={{ marginTop: 6, textAlign: "center" }}>
          <Tag
            color="orange"
            style={{ fontSize: 11, fontWeight: 600, borderRadius: 6 }}
          >
            Walkover
          </Tag>
        </div>
      )}
    </div>
  );
}
